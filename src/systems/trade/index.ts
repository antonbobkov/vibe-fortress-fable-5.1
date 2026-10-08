/** 20 Trade and caravans: schedule, cargo, parties, depot arrival and departure. */
import { C, ItemFlag } from '@core/components';
import type { Command, CommandResult } from '@core/commands';
import { OK, reject } from '@core/commands';
import { TICKS_PER_DAY } from '@core/constants';
import { yearOf } from '@core/calendar';
import type { GameEvent } from '@core/events';
import type { EventType } from '@core/event-types';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext } from '@core/system';
import type { Civ, EntityId, TileIndex } from '@core/types';
import type { LocalMapSpec } from '@systems/embark/spec';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { ThreatsReader } from '@systems/threats/reader';
import type { DwarvesReader } from '@systems/dwarves/reader';
import type { ItemsReader } from '@systems/items/reader';
import type { Job, JobsReader } from '@systems/jobs';
import { grantXp } from '@systems/dwarves/skills';
import { CARAVAN_STAY_DAYS, CARAVAN_THINK_TICKS, CARAVAN_BAN_YEARS, CARAVAN_BAN_REP, DEPOT_WAIT_DAYS, REP_DRIFT_PER_YEAR, REP_NO_DEPOT, REP_FORTRESS_KILL, REP_OTHER_KILL, REP_CARAVAN_LOST, DEPOT_HAUL_PRIORITY, REQUEST_MAX, TRADE_XP, TRADE_XP_VALUE, EXOTIC_CAGED_PREFERENCE, REPUTATION_MIN, REPUTATION_MAX, REP_BANDIT_CAGED, REP_BANDIT_KILLED } from './constants';
import { spawnCaravan } from './caravan';
import { generateGoods } from './goods';
import { arrivalTick, initialSchedule, skipCaravan, TRADE_CIVS } from './schedule';
import type { TradeReader } from './reader';
import type { ActiveCaravan, OfferLine, ReputationEntry, TradeRequest, TradeSession, TradeStateV1 } from './state';
import { giftReputation, marginPercent, merchantPrice, preferencePercent, requiredValue, tradeReputation } from './valuation';

export * from './constants';
export * from './schedule';
export * from './goods';
export * from './caravan';
export * from './valuation';
export type { TradeReader } from './reader';
export type { TradeRequest, TradeStateV1 } from './state';

export class TradeSystem extends BaseSystem<TradeStateV1> {
  readonly id = '20';
  readonly order = 20;
  override readonly ownsCommands = ['MoveToDepot', 'RemoveFromDepot', 'TradeOpen', 'TradeOffer', 'TradeCancel', 'SetRequests'] as const;
  override readonly subscribes: readonly EventType[] = ['DayPassed', 'YearPassed', 'BuildingCompleted', 'AttackResolved', 'CreatureDied', 'TitleAssigned'];
  private rng!: RngStream;
  private scheduleState: TradeStateV1['schedule'] = {};
  private active: ActiveCaravan | null = null;
  private requestsState: Record<string, TradeRequest[]> = { hillfolk: [], wildwood: [], mountainhome: [] };
  private lastBroughtState: Record<string, string[]> = { hillfolk: [], wildwood: [], mountainhome: [] };
  private sessionState: TradeSession | null = null;
  private reputationEntries: ReputationEntry[] = [];
  private readerRef!: TradeReader;
  // A completion rejected in 10 is retried in 11 after the old job is removed.
  // This flag is cleared in the same atomic tick, before any save can observe it.
  private retryTradeRequest = false;

  constructor(private readonly spec: LocalMapSpec | null = null) { super(); }

  override init(ctx: InitContext): void {
    this.rng = ctx.rng;
    this.scheduleState = initialSchedule(this.rng);
    const fortress = ctx.world.fortress;
    this.readerRef = {
      activeCaravan: () => this.active && ({
        civ: this.active.civ, state: this.active.state,
        daysRemaining: Math.max(0, Math.ceil((this.active.stateSince + CARAVAN_STAY_DAYS * TICKS_PER_DAY - ctx.world.calendar.tick) / TICKS_PER_DAY)),
      }),
      schedule: () => ({ hillfolk: 'summer', wildwood: 'autumn', mountainhome: 'spring' }),
      isBanned: (civ) => this.banned(civ, fortress.reputation[civ] ?? 0, yearOf(ctx.world.calendar.tick)),
      reputation: (civ) => fortress.reputation[civ] ?? 0,
      reputationLog: (civ) => this.reputationEntries.filter((entry) => entry.civ === civ).map((entry) => ({ ...entry })),
      marginPercent: (civ) => this.margin(ctx, civ),
      valuation: (civ, id) => this.valuation(ctx, civ, id),
      price: (civ, id) => merchantPrice(this.valuation(ctx, civ, id)),
      depotItems: () => {
        const ids: EntityId[] = [];
        for (const id of ctx.world.entities.with(C.Item)) {
          const item = ctx.world.entities.get(id, C.Item);
          if (item && (item.flags & ItemFlag.AtDepot) !== 0 && (item.flags & ItemFlag.Merchant) === 0) ids.push(id);
        }
        return ids;
      },
      merchantItems: () => this.active?.goods.filter((id) => (ctx.world.entities.get(id, C.Item)?.flags ?? 0) & ItemFlag.Merchant) ?? [],
      requests: (civ) => (this.requestsState[civ] ?? []).map((r) => ({ ...r })),
      lastBrought: (civ) => (this.lastBroughtState[civ] ?? []).slice(),
      sessionOpen: () => this.sessionState !== null,
      session: () => this.sessionState && structuredClone(this.sessionState),
    };
    ctx.register.jobProducer({
      id: 'trade', produce: (tick) => {
        const retry = this.retryTradeRequest;
        this.retryTradeRequest = false;
        if (this.active && this.active.state !== 'atDepot') this.cancelTradeJob(tick, this.active.depotId);
        this.repairTradeJob(tick, retry);
      },
      onComplete: (job, tick) => this.completeJob(job as Job, tick),
      workCentiTicks: (job) => (job as Job).key.startsWith('trade:') ? 100 : undefined,
    });
    ctx.register.announcement('CaravanArrived', { severity: 'alert', stringKey: 'announce.caravan_arrived' });
    ctx.register.announcement('CaravanWaiting', { severity: 'alert', stringKey: 'announce.caravan_waiting' });
    ctx.register.announcement('CaravanDeparted', { severity: 'note', stringKey: 'announce.caravan_departed' });
    ctx.register.announcement('CaravanLost', { severity: 'alert', stringKey: 'announce.caravan_lost' });
    ctx.register.announcement('TradeCompleted', { severity: 'note', stringKey: 'announce.trade_completed' });
    ctx.register.announcement('ReputationChanged', { severity: 'note', stringKey: 'announce.reputation_changed', atMost: { field: 'delta', value: 0 } });
  }

  override reader(): TradeReader { return this.readerRef; }

  private banned(civ: Civ, reputation: number, year: number): boolean {
    return reputation <= CARAVAN_BAN_REP || year <= (this.scheduleState[civ]?.banUntilYear ?? 0);
  }

  private reputation(ctx: TickContext, civ: Civ, delta: number, reason: string): void {
    const old = ctx.world.fortress.reputation[civ] ?? 0;
    const next = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, old + delta));
    ctx.world.fortress.reputation[civ] = next;
    if (next !== old) {
      this.reputationEntries.push({ tick: ctx.tick, civ, delta: next - old, reason });
      ctx.emit({ type: 'ReputationChanged', civ, delta: next - old, reason });
    }
  }

  private valuation(ctx: InitContext, civ: Civ, id: EntityId): number {
    const items = ctx.readers.of<ItemsReader>('13');
    const item = items.get(id);
    if (!item) return 0;
    const category = items.categoryOf(item.type);
    const material = ctx.registry.table<{ id: string; class: string }>('materials').byIndex(item.material);
    const occupant = ctx.world.entities.get(item.occupantId ?? 0, C.Creature);
    const species = occupant ? ctx.registry.table<{ id: string; value: number }>('creatures').byIndex(occupant.species) : undefined;
    const percent = civ === 'mountainhome' && species?.id.startsWith('cave_') ? EXOTIC_CAGED_PREFERENCE
      : preferencePercent(ctx.registry, civ, category, material?.id ?? '', material?.class ?? '', occupant !== undefined);
    const speciesValue = species?.value ?? 0;
    return (items.value(id) + speciesValue) * percent / 100;
  }

  private margin(ctx: InitContext, civ: Civ): number {
    const trader = this.sessionState?.traderId ?? 0;
    const skill = trader ? ctx.readers.of<DwarvesReader>('10').skill(trader, 'trading') : 0;
    return marginPercent(skill, ctx.world.fortress.reputation[civ] ?? 0);
  }

  private broker(ctx: TickContext): EntityId {
    const id = ctx.readers.of<DwarvesReader>('10').holder('broker');
    return ctx.world.entities.alive(id) && ctx.readers.of<JobsReader>('11').laborEnabled(id, 'trading') ? id : 0;
  }

  private cancelTradeJob(ctx: TickContext, depotId: EntityId): void {
    const job = ctx.readers.of<JobsReader>('11').byKey(`trade:${depotId}`);
    if (job) ctx.jobs.cancel(job.id, 'target_invalid');
  }

  private repairTradeJob(ctx: TickContext, create = false): void {
    const a = this.active;
    if (!a || a.state !== 'atDepot' || this.sessionState) return;
    const jobs = ctx.readers.of<JobsReader>('11');
    const old = jobs.byKey(`trade:${a.depotId}`);
    if (!old && !create) return;
    const assignedWorker = this.broker(ctx);
    const invalidWorker = old !== undefined && old.workerId !== 0 &&
      (!ctx.world.entities.alive(old.workerId) || !jobs.laborEnabled(old.workerId, 'trading') ||
        (assignedWorker !== 0 && old.workerId !== assignedWorker));
    if (old && old.data['assignedWorker'] === assignedWorker && !invalidWorker) return;
    const building = ctx.readers.of<BuildingsReader>('14').get(a.depotId);
    if (old) ctx.jobs.cancel(old.id, 'target_invalid');
    if (!building) return;
    ctx.jobs.create(`trade:${a.depotId}`, {
      type: 'trade', ...(old ? { priority: old.priority } : {}),
      target: { kind: 'building', ref: a.depotId }, workTile: building.footprint[0] ?? building.origin,
      data: { depotId: a.depotId, assignedWorker },
    });
  }

  private completeJob(job: Job, ctx: TickContext): void {
    const a = this.active;
    if (job.key.startsWith('depot:')) {
      const depotId = job.data['depotId'] as EntityId;
      if (!ctx.readers.of<BuildingsReader>('14').depots().includes(depotId)) return;
      const id = job.target.ref;
      if (ctx.world.entities.alive(id)) {
        if (!ctx.world.entities.has(depotId, C.Container)) ctx.world.entities.add(depotId, C.Container, { contents: [], capacity: Number.MAX_SAFE_INTEGER, classId: 'wagon' });
        ctx.world.services.items?.putIn(id, depotId);
        ctx.world.services.items?.setFlag(id, ItemFlag.AtDepot, true);
      }
      return;
    }
    if (!a || a.state !== 'atDepot' || a.depotId !== job.data['depotId']) return;
    if (!job.key.startsWith('trade:')) return;
    const broker = this.broker(ctx);
    if (!ctx.world.entities.alive(job.workerId) || !ctx.readers.of<JobsReader>('11').laborEnabled(job.workerId, 'trading') ||
        (broker !== 0 && broker !== job.workerId)) {
      this.retryTradeRequest = true;
      return;
    }
    const merchantId = a.merchants.find((id) => ctx.world.entities.alive(id) && a.destinations[id] === ctx.readers.of<BuildingsReader>('14').holderTile(a.depotId))
      ?? a.merchants.find((id) => ctx.world.entities.alive(id)) ?? 0;
    if (!merchantId) return;
    const building = ctx.readers.of<BuildingsReader>('14').get(a.depotId);
    const merchant = ctx.world.entities.get(merchantId, C.Position);
    const trader = ctx.world.entities.get(job.workerId, C.Position);
    if (!building || !merchant || !trader) return;
    const merchantTile = ctx.world.map.index(merchant.x, merchant.y, merchant.z);
    const traderTile = ctx.world.map.index(trader.x, trader.y, trader.z);
    if (!building.footprint.includes(merchantTile) || !building.footprint.includes(traderTile)) return;
    this.sessionState = { depotId: a.depotId, traderId: job.workerId, merchantId, give: [], take: [], woodOffered: [], woodWarning: false };
  }

  private lines(raw: unknown): OfferLine[] | null {
    if (!Array.isArray(raw)) return null;
    const result: OfferLine[] = [];
    const seen = new Set<number>();
    for (const entry of raw) {
      const itemId = typeof entry === 'number' ? entry : entry?.itemId;
      const count = typeof entry === 'number' ? 0 : entry?.count;
      if (!Number.isInteger(itemId) || itemId <= 0 || seen.has(itemId) || (count !== undefined && (!Number.isInteger(count) || count < 0))) return null;
      seen.add(itemId);
      result.push({ itemId, count: count ?? 0 });
    }
    return result;
  }

  private offer(cmd: Command, ctx: TickContext): CommandResult {
    const a = this.active;
    const session = this.sessionState;
    if (!a || !session || a.state !== 'atDepot') return reject('no_session');
    const give = this.lines(cmd['give']);
    const take = this.lines(cmd['take']);
    if (!give || !take || give.length === 0) return reject('precondition_failed');
    const items = ctx.readers.of<ItemsReader>('13');
    const value = (line: OfferLine, merchant: boolean): number => {
      const item = items.get(line.itemId);
      if (!item || item.containerId !== a.depotId || (item.flags & ItemFlag.Merchant) !== (merchant ? ItemFlag.Merchant : 0)) return -1;
      if (!merchant && (item.flags & ItemFlag.AtDepot) === 0) return -1;
      if ((item.flags & (ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned)) !== 0) return -1;
      const count = line.count || item.count;
      if (count > item.count) return -1;
      return this.valuation(ctx, a.civ, line.itemId) * count / item.count;
    };
    const g = give.map((line) => value(line, false));
    const t = take.map((line) => value(line, true));
    if ([...g, ...t].some((n) => n < 0)) return reject('not_at_depot');
    const givenValue = g.reduce((sum, n) => sum + n, 0);
    const receivedValue = t.reduce((sum, n) => sum + merchantPrice(n), 0);
    const required = requiredValue(receivedValue, this.margin(ctx, a.civ));
    session.give = give;
    session.take = take;
    if (a.civ === 'wildwood') {
      for (const line of give) {
        const item = items.get(line.itemId);
        const cls = ctx.registry.table<{ id: string; class: string }>('materials').byIndex(item?.material ?? 0)?.class;
        if (cls === 'wood' && !session.woodOffered.includes(line.itemId)) {
          session.woodOffered.push(line.itemId);
          session.woodWarning = true;
          this.reputation(ctx, a.civ, -2, 'wood_offered');
        }
      }
    }
    if (take.length > 0 && givenValue < required) {
      ctx.emit({ type: 'TradeRefused', civ: a.civ, shortfall: Math.ceil(required - givenValue) });
      return OK;
    }
    const transfer = (line: OfferLine, toMerchant: boolean): void => {
      const item = items.get(line.itemId);
      if (!item) return;
      const count = line.count || item.count;
      const id = count < item.count ? ctx.world.services.items?.split(line.itemId, count) ?? 0 : line.itemId;
      if (!id) return;
      ctx.world.services.items?.setFlag(id, ItemFlag.Merchant, toMerchant);
      ctx.world.services.items?.setFlag(id, ItemFlag.AtDepot, !toMerchant);
      if (toMerchant && !a.goods.includes(id)) a.goods.push(id);
      const occupant = ctx.world.entities.get(items.get(id)?.occupantId ?? 0, C.Creature);
      if (occupant) ctx.world.entities.add(items.get(id)?.occupantId ?? 0, C.Creature, { ...occupant, faction: toMerchant ? `trader:${a.civ}` : 'fortress' });
    };
    for (const line of give) transfer(line, true);
    for (const line of take) transfer(line, false);
    if (take.length === 0) {
      const delta = giftReputation(givenValue, a.giftedThisCaravan ?? 0);
      a.giftedThisCaravan = (a.giftedThisCaravan ?? 0) + delta;
      this.reputation(ctx, a.civ, delta, 'gift');
      ctx.emit({ type: 'GiftGiven', civ: a.civ, value: givenValue });
    } else {
      a.boughtValue += receivedValue;
      a.soldValue += givenValue;
      const averageValue = (givenValue + receivedValue) / 2;
      this.reputation(ctx, a.civ, tradeReputation(receivedValue), 'trade');
      grantXp(ctx.world.entities, ctx.registry, session.traderId, 'trading', TRADE_XP * (1 + averageValue / TRADE_XP_VALUE), (event) => ctx.emit(event));
      ctx.emit({ type: 'TradeCompleted', civ: a.civ, givenValue, receivedValue });
    }
    session.give = [];
    session.take = [];
    return OK;
  }

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    const a = this.active;
    if (cmd.type === 'SetRequests') {
      const civ = cmd['civ']; const entries = cmd['entries'];
      if (!TRADE_CIVS.includes(civ as Civ) || !Array.isArray(entries) || entries.length > REQUEST_MAX || entries.some((r) => !r || typeof r.itemType !== 'string' || (!ctx.registry.table('items').has(r.itemType) && !ctx.registry.table('creatures').has(r.itemType)) || (r.material !== undefined && (typeof r.material !== 'string' || !ctx.registry.table('materials').has(r.material))) || ![1, 2, 3].includes(r.priority))) return reject('bad_setting');
      this.requestsState[civ as Civ] = entries.map((r) => ({ itemType: r.itemType, ...(r.material ? { material: r.material } : {}), priority: r.priority }));
      return OK;
    }
    if (cmd.type === 'TradeCancel') { if (!this.sessionState) return reject('no_session'); this.sessionState = null; return OK; }
    if (cmd.type === 'TradeOffer') return this.offer(cmd, ctx);
    if (cmd.type === 'TradeOpen') {
      if (!a || a.state !== 'atDepot') return reject('no_caravan');
      if (cmd['depotId'] !== a.depotId) return reject('no_depot');
      if (this.sessionState) return OK;
      if (!ctx.readers.of<BuildingsReader>('14').get(a.depotId)) return reject('no_depot');
      this.repairTradeJob(ctx, true);
      return OK;
    }
    if (cmd.type === 'MoveToDepot' || cmd.type === 'RemoveFromDepot') {
      const depotId = typeof cmd['depotId'] === 'number' ? cmd['depotId'] : ctx.readers.of<BuildingsReader>('14').depots()[0];
      if (!depotId || !ctx.readers.of<BuildingsReader>('14').depots().includes(depotId)) return reject('no_depot');
      const ids = cmd['itemIds'];
      if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id))) return reject('precondition_failed');
      const items = ctx.readers.of<ItemsReader>('13');
      for (const id of ids) {
        const item = items.get(id);
        if (!item || (item.flags & (ItemFlag.Merchant | ItemFlag.Owned | ItemFlag.Installed | ItemFlag.Forbidden)) !== 0) return reject('not_found');
        if (cmd.type === 'RemoveFromDepot' && ((item.flags & ItemFlag.AtDepot) === 0 || item.containerId !== depotId)) return reject('not_at_depot');
        if (cmd.type === 'MoveToDepot' && (item.flags & ItemFlag.AtDepot) !== 0) return reject('precondition_failed');
      }
      for (const id of ids) {
        if (cmd.type === 'RemoveFromDepot') {
          ctx.world.services.items?.setFlag(id, ItemFlag.AtDepot, false);
          ctx.world.services.items?.dropAt(id, ctx.readers.of<BuildingsReader>('14').holderTile(depotId));
        } else {
          ctx.jobs.create(`depot:${id}`, { type: 'haul_to_depot', priority: DEPOT_HAUL_PRIORITY, target: { kind: 'entity', ref: id }, workTile: ctx.readers.of<BuildingsReader>('14').holderTile(depotId), inputs: [{ filter: { itemId: id }, count: 1, wholeItem: true }], data: { depotId } });
        }
      }
      return OK;
    }
    return reject('not_found');
  }

  private depot(ctx: TickContext, edgeTile: TileIndex): EntityId {
    const buildings = ctx.readers.of<BuildingsReader>('14');
    for (const id of buildings.depots()) {
      const building = buildings.get(id);
      if (!building) continue;
      for (const tile of building.footprint) {
        if (ctx.readers.pathing.reachable(edgeTile, tile, 'walker')) return id;
      }
    }
    return 0;
  }

  private seekDepot(ctx: TickContext): void {
    const a = this.active;
    if (!a) return;
    const depotId = this.depot(ctx, a.edgeTile);
    if (depotId) {
      a.depotId = depotId;
      a.state = 'toDepot';
      a.stateSince = ctx.tick;
      const building = ctx.readers.of<BuildingsReader>('14').get(depotId);
      if (building) {
        const map = ctx.world.map;
        const footprint = building.footprint;
        const inside = footprint[Math.floor(footprint.length / 2)] ?? building.origin;
        const around: TileIndex[] = [];
        for (const tile of footprint) {
          const x = map.xOf(tile);
          const y = map.yOf(tile);
          const z = map.zOf(tile);
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
            const nx = x + dx; const ny = y + dy;
            if (!map.inBounds(nx, ny, z)) continue;
            const neighbor = map.index(nx, ny, z);
            if (!footprint.includes(neighbor) && !around.includes(neighbor) && ctx.readers.pathing.passable(neighbor, 'walker') && ctx.readers.pathing.reachable(a.edgeTile, neighbor, 'walker')) around.push(neighbor);
          }
        }
        a.destinations = {};
        for (let i = 0; i < a.merchants.length; i += 1) a.destinations[a.merchants[i] as EntityId] = footprint[i % footprint.length] ?? inside;
        for (let i = 0; i < a.guards.length; i += 1) a.destinations[a.guards[i] as EntityId] = around[i % around.length] ?? inside;
        for (let i = 0; i < a.animals.length; i += 1) a.destinations[a.animals[i] as EntityId] = around[(i + a.guards.length) % around.length] ?? inside;
      }
      const party = ctx.world.entities.get(a.partyId, C.Party);
      if (party) party.state = 'toDepot';
    } else if (a.state !== 'waiting') {
      a.state = 'waiting';
      a.stateSince = ctx.tick;
      const party = ctx.world.entities.get(a.partyId, C.Party);
      if (party) party.state = 'waiting';
      ctx.emit({ type: 'CaravanWaiting', civ: a.civ, partyId: a.partyId });
    }
  }

  private arrive(ctx: TickContext, civ: Civ): void {
    const renown = ctx.readers.of<ThreatsReader>('18').renown();
    const rep = ctx.world.fortress.reputation[civ] ?? 0;
    const goods = generateGoods(ctx.registry, civ, renown, rep, this.requestsState[civ] ?? [], this.rng);
    const edge = this.spec?.civEdges[civ] ?? 'n';
    this.active = spawnCaravan(ctx, civ, edge, this.spec?.peril ?? 0, this.spec?.traits.includes('twilight_pass') ?? false, rep, goods, this.rng);
    this.sessionState = null;
    if (civ === 'hillfolk' && this.active) {
      const bandit = ctx.registry.table('creatures').index('hillfolk_bandit');
      let carrier = 0;
      for (const id of this.active.animals) if (ctx.world.entities.alive(id)) { carrier = id; break; }
      if (carrier) for (const id of ctx.world.entities.with(C.Item)) {
        const item = ctx.world.entities.get(id, C.Item);
        const creature = ctx.world.entities.get(item?.occupantId ?? 0, C.Creature);
        if (!item || !creature || creature.species !== bandit || !ctx.world.entities.alive(item.occupantId ?? 0) || (item.flags & ItemFlag.Merchant) !== 0) continue;
        if (!ctx.world.services.items?.putIn(id, carrier)) continue;
        ctx.world.services.items?.setFlag(id, ItemFlag.AtDepot, false);
        ctx.world.services.items?.setFlag(id, ItemFlag.Merchant, true);
        this.active.goods.push(id);
        this.reputation(ctx, civ, REP_BANDIT_CAGED, 'bandit_caged');
      }
    }
    this.lastBroughtState[civ] = goods.map((good) => good.species === undefined
      ? ctx.registry.table('items').idOf(good.type) : ctx.registry.table('creatures').idOf(good.species));
    this.seekDepot(ctx);
  }

  private unload(ctx: TickContext, a: ActiveCaravan): void {
    const building = ctx.readers.of<BuildingsReader>('14').get(a.depotId);
    if (!building) { a.state = 'waiting'; a.stateSince = ctx.tick; return; }
    if (!ctx.world.entities.has(a.depotId, C.Container)) {
      ctx.world.entities.add(a.depotId, C.Container, { contents: [], capacity: Number.MAX_SAFE_INTEGER, classId: 'wagon' });
    }
    for (const id of a.goods) {
      if (ctx.world.entities.alive(id)) ctx.world.services.items?.putIn(id, a.depotId);
    }
    a.state = 'atDepot';
    a.stateSince = ctx.tick;
    const party = ctx.world.entities.get(a.partyId, C.Party);
    if (party) { party.state = 'wait'; party.stateSince = ctx.tick; }
    ctx.emit({ type: 'CaravanAtDepot', civ: a.civ, partyId: a.partyId, depotId: a.depotId });
  }

  private pack(ctx: TickContext, a: ActiveCaravan): void {
    this.cancelTradeJob(ctx, a.depotId);
    this.sessionState = null;
    let carrier = 0;
    for (const id of a.animals) if (ctx.world.entities.alive(id)) { carrier = id; break; }
    for (const id of a.goods) {
      const it = ctx.world.entities.get(id, C.Item);
      if (!it || (it.flags & ItemFlag.Merchant) === 0 || it.containerId !== a.depotId) continue;
      if (a.lost) continue;
      if (carrier) ctx.world.services.items?.putIn(id, carrier);
      else ctx.world.services.items?.dropAt(id, ctx.readers.of<BuildingsReader>('14').holderTile(a.depotId));
    }
    a.state = 'leave';
    a.stateSince = ctx.tick;
    const party = ctx.world.entities.get(a.partyId, C.Party);
    if (party) { party.state = 'leave'; party.stateSince = ctx.tick; }
  }

  private depart(ctx: TickContext, reason?: string): void {
    const a = this.active;
    if (!a) return;
    this.cancelTradeJob(ctx, a.depotId);
    const inDepot = (itemId: EntityId): boolean => {
      let holder = ctx.world.entities.get(itemId, C.Item)?.containerId ?? 0;
      let depth = 0;
      while (holder !== 0 && depth < 4) {
        if (holder === a.depotId) return true;
        holder = ctx.world.entities.get(holder, C.Item)?.containerId ?? 0;
        depth += 1;
      }
      return false;
    };
    for (const id of a.goods) {
      const it = ctx.world.entities.get(id, C.Item);
      if (!it) continue;
      if (a.lost && inDepot(id)) {
        ctx.world.services.items?.setFlag(id, ItemFlag.Merchant, false);
        if (it.occupantId) {
          const creature = ctx.world.entities.get(it.occupantId, C.Creature);
          if (creature) ctx.world.entities.add(it.occupantId, C.Creature, { ...creature, faction: 'fortress' });
        }
        continue;
      }
      if ((it.flags & ItemFlag.Merchant) !== 0) {
        if (it.occupantId && ctx.world.entities.alive(it.occupantId)) ctx.world.entities.destroy(it.occupantId);
        ctx.world.services.items?.destroy(id, 'caravan_departed');
      }
    }
    for (const id of [...a.merchants, ...a.guards, ...a.animals]) {
      if (!ctx.world.entities.alive(id) || a.dead.includes(id)) continue;
      const equipment = ctx.world.entities.get(id, C.Equipment);
      if (equipment) {
        const kit = [equipment.weapon, equipment.shield, equipment.quiver, ...Object.values(equipment.armor), ...Object.values(equipment.clothing)];
        for (const itemId of kit) if (itemId && ctx.world.entities.alive(itemId)) ctx.world.services.items?.destroy(itemId, 'caravan_departed');
      }
      ctx.world.entities.destroy(id);
    }
    if (ctx.world.entities.alive(a.partyId)) ctx.world.entities.destroy(a.partyId);
    ctx.emit({ type: 'CaravanDeparted', civ: a.civ, boughtValue: a.boughtValue, soldValue: a.soldValue, reason: reason ?? 'completed' });
    if (reason === 'no_depot') this.reputation(ctx, a.civ, REP_NO_DEPOT, 'no_depot');
    this.active = null;
    this.sessionState = null;
  }

  override tick(ctx: TickContext): void {
    const a = this.active;
    if (!a) return;
    if (a.state === 'waiting') {
      if (ctx.tick - a.stateSince >= DEPOT_WAIT_DAYS * TICKS_PER_DAY) this.depart(ctx, 'no_depot');
      return;
    }
    if (a.state === 'atDepot') {
      if (ctx.tick - a.stateSince >= CARAVAN_STAY_DAYS * TICKS_PER_DAY) this.pack(ctx, a);
      return;
    }
    if (a.state === 'unload') { this.unload(ctx, a); return; }
    const movement = ctx.world.services.movement;
    if (!movement) return;
    const leaving = a.state === 'leave' || a.state === 'pack';
    const goal = leaving ? a.edgeTile : ctx.readers.of<BuildingsReader>('14').get(a.depotId)?.origin ?? a.edgeTile;
    let remaining = 0;
    for (const id of [...a.merchants, ...a.guards, ...a.animals]) {
      if (!ctx.world.entities.alive(id)) continue;
      if (leaving && a.guards.includes(id) && ctx.world.services.combat?.targetOf(id)) { remaining += 1; continue; }
      const target = leaving ? a.edgeTile : a.destinations[id] ?? goal;
      const status = movement.walkTo(id, target, leaving ? 'flee' : 'caravan', ctx);
      if (status !== 'arrived') remaining += 1;
    }
    if (remaining === 0) {
      if (a.state === 'leave') this.depart(ctx, a.lost ? 'lost' : undefined);
      else a.state = 'unload';
    } else if (ctx.tick % CARAVAN_THINK_TICKS === 0) {
      const party = ctx.world.entities.get(a.partyId, C.Party);
      if (party) party.goalTile = goal;
    }
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'DayPassed') {
      if (this.active?.state === 'waiting') this.seekDepot(ctx);
      for (const civ of TRADE_CIVS) {
        const entry = this.scheduleState[civ];
        if (!entry || entry.nextArrivalTick > ctx.tick) continue;
        const year = yearOf(ctx.tick);
        if (this.active) { entry.nextArrivalTick += TICKS_PER_DAY; continue; }
        entry.nextArrivalTick = arrivalTick(civ, year + 1, this.rng);
        if (skipCaravan(ctx.world.fortress.reputation[civ] ?? 0, year, entry.banUntilYear, this.spec?.temper ?? 0, this.rng)) continue;
        this.arrive(ctx, civ);
      }
    } else if (event.type === 'YearPassed') {
      for (const civ of TRADE_CIVS) {
        const rep = ctx.world.fortress.reputation[civ] ?? 0;
        if (rep !== 0) this.reputation(ctx, civ, -Math.sign(rep) * Math.min(Math.abs(rep), REP_DRIFT_PER_YEAR), 'yearly_drift');
      }
    } else if (event.type === 'BuildingCompleted' && this.active?.state === 'waiting') {
      this.seekDepot(ctx);
    } else if (event.type === 'AttackResolved') {
      const a = this.active;
      const defender = event['defenderId'] as EntityId;
      const attacker = event['attackerId'] as EntityId;
      if (!a || !ctx.world.entities.get(a.partyId, C.Party)?.members.includes(defender)) return;
      if (!a.attacked) ctx.emit({ type: 'CaravanAttacked', civ: a.civ, partyId: a.partyId });
      a.attacked = true;
      this.cancelTradeJob(ctx, a.depotId);
      this.sessionState = null;
      for (const guard of a.guards) if (ctx.world.entities.alive(guard)) ctx.world.services.combat?.setTarget(guard, attacker);
      a.state = 'leave';
      a.stateSince = ctx.tick;
    } else if (event.type === 'TitleAssigned' && event['title'] === 'broker') {
      this.repairTradeJob(ctx);
    } else if (event.type === 'CreatureDied') {
      this.repairTradeJob(ctx);
      const fallen = ctx.world.entities.get(event['id'] as EntityId, C.Creature);
      if (fallen && ctx.registry.table('creatures').idOf(fallen.species) === 'hillfolk_bandit') this.reputation(ctx, 'hillfolk', REP_BANDIT_KILLED, 'bandit_killed');
      const a = this.active;
      const id = event['id'] as EntityId;
      if (!a || !ctx.world.entities.get(a.partyId, C.Party)?.members.includes(id)) return;
      if (a.dead.includes(id)) return;
      a.dead.push(id);
      const killer = ctx.world.entities.get(event['killerId'] as EntityId, C.Creature);
      if (killer?.faction === 'fortress') {
        this.reputation(ctx, a.civ, REP_FORTRESS_KILL, 'caravan_member_killed');
        const schedule = this.scheduleState[a.civ];
        if (schedule) schedule.banUntilYear = yearOf(ctx.tick) + CARAVAN_BAN_YEARS;
      } else this.reputation(ctx, a.civ, REP_OTHER_KILL, 'caravan_member_killed');
      if (a.merchants.includes(id) && !a.lost) {
        a.lost = true;
        this.reputation(ctx, a.civ, REP_CARAVAN_LOST, 'caravan_lost');
        ctx.emit({ type: 'CaravanLost', civ: a.civ, partyId: a.partyId });
        this.pack(ctx, a);
      }
    }
  }

  serialize(): TradeStateV1 {
    return {
      stateVersion: 1, schedule: structuredClone(this.scheduleState), activeCaravan: this.active && structuredClone(this.active),
      requests: structuredClone(this.requestsState), lastBrought: structuredClone(this.lastBroughtState), rng: this.rng.state(),
      session: this.sessionState && structuredClone(this.sessionState), reputationLog: structuredClone(this.reputationEntries),
    };
  }

  deserialize(state: TradeStateV1, ctx: InitContext): void {
    if (!this.readerRef) this.init(ctx);
    this.retryTradeRequest = false;
    this.scheduleState = structuredClone(state.schedule);
    this.active = state.activeCaravan && structuredClone(state.activeCaravan);
    this.requestsState = structuredClone(state.requests);
    this.lastBroughtState = structuredClone(state.lastBrought);
    this.sessionState = state.session ? structuredClone(state.session) : null;
    this.reputationEntries = structuredClone(state.reputationLog ?? []);
    this.rng.setState(state.rng);
  }
}
