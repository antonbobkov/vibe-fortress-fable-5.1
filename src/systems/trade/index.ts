/** 20 Trade and caravans: schedule, cargo, parties, depot arrival and departure. */
import { C, ItemFlag } from '@core/components';
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
import { CARAVAN_STAY_DAYS, CARAVAN_THINK_TICKS, CARAVAN_BAN_YEARS, CARAVAN_BAN_REP, DEPOT_WAIT_DAYS, REP_DRIFT_PER_YEAR, REP_NO_DEPOT, REP_FORTRESS_KILL, REP_OTHER_KILL, REP_CARAVAN_LOST } from './constants';
import { spawnCaravan } from './caravan';
import { generateGoods } from './goods';
import { arrivalTick, initialSchedule, skipCaravan, TRADE_CIVS } from './schedule';
import type { TradeReader } from './reader';
import type { ActiveCaravan, TradeRequest, TradeStateV1 } from './state';

export * from './constants';
export * from './schedule';
export * from './goods';
export * from './caravan';
export type { TradeReader } from './reader';
export type { TradeRequest, TradeStateV1 } from './state';

export class TradeSystem extends BaseSystem<TradeStateV1> {
  readonly id = '20';
  readonly order = 20;
  override readonly subscribes: readonly EventType[] = ['DayPassed', 'YearPassed', 'BuildingCompleted', 'AttackResolved', 'CreatureDied'];
  private rng!: RngStream;
  private scheduleState: TradeStateV1['schedule'] = {};
  private active: ActiveCaravan | null = null;
  private requestsState: Record<string, TradeRequest[]> = { hillfolk: [], wildwood: [], mountainhome: [] };
  private lastBroughtState: Record<string, string[]> = { hillfolk: [], wildwood: [], mountainhome: [] };
  private readerRef!: TradeReader;

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
      sessionOpen: () => false,
    };
    ctx.register.announcement('CaravanArrived', { severity: 'alert', stringKey: 'announce.caravan_arrived' });
    ctx.register.announcement('CaravanWaiting', { severity: 'alert', stringKey: 'announce.caravan_waiting' });
    ctx.register.announcement('CaravanDeparted', { severity: 'note', stringKey: 'announce.caravan_departed' });
    ctx.register.announcement('CaravanLost', { severity: 'alert', stringKey: 'announce.caravan_lost' });
  }

  override reader(): TradeReader { return this.readerRef; }

  private banned(civ: Civ, reputation: number, year: number): boolean {
    return reputation <= CARAVAN_BAN_REP || year <= (this.scheduleState[civ]?.banUntilYear ?? 0);
  }

  private reputation(ctx: TickContext, civ: Civ, delta: number, reason: string): void {
    const old = ctx.world.fortress.reputation[civ] ?? 0;
    const next = Math.max(-100, Math.min(100, old + delta));
    ctx.world.fortress.reputation[civ] = next;
    if (next !== old) ctx.emit({ type: 'ReputationChanged', civ, delta: next - old, reason });
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
      for (const guard of a.guards) if (ctx.world.entities.alive(guard)) ctx.world.services.combat?.setTarget(guard, attacker);
      a.state = 'leave';
      a.stateSince = ctx.tick;
    } else if (event.type === 'CreatureDied') {
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
    };
  }

  deserialize(state: TradeStateV1, ctx: InitContext): void {
    if (!this.readerRef) this.init(ctx);
    this.scheduleState = structuredClone(state.schedule);
    this.active = state.activeCaravan && structuredClone(state.activeCaravan);
    this.requestsState = structuredClone(state.requests);
    this.lastBroughtState = structuredClone(state.lastBrought);
    this.rng.setState(state.rng);
  }
}
