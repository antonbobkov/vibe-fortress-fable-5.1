/** `10-dwarves.md` §§ Eating and drinking, Sleeping, Social, comfort, joy;
 * `algorithms/creature-brains.md` § startNeed. Plans are saved by 10. */
import { C, type Brain, type Needs, type Relationships } from '@core/components';
import { NEED_MAX, TICKS_PER_HOUR } from '@core/constants';
import { FluidType, TileFlag, TileKind } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { Z_DISTANCE_WEIGHT } from '@systems/jobs/constants';
import { DINING_SEARCH_RADIUS, DRINK_SEARCH_RADIUS, DRINK_TICKS, EAT_TICKS, FRIEND_TALKS, HEARTH_VISIT_TICKS, LEISURE_MARK, LEISURE_RETRY_TICKS, NEED_RETRY_TICKS, SIT_TICKS, SLEEP_HOURS, SOCIAL_WAIT_TICKS, TALK_CHECK_TICKS, TALK_TICKS, THREAT_RADIUS } from './constants';
import { CRITICAL, WANT, type NeedName } from './needs';
import type { ActivityPlan } from './state';
import type { EntityStore } from '@core/entities';

interface SeatTarget { tile: TileIndex; tier: number }
interface ActivityTargets {
  revision: string;
  hall: TileIndex[];
  /** Membership only; never iterated. */
  hallSet: Set<TileIndex>;
  social: TileIndex[];
  wells: EntityId[];
  dining: SeatTarget[];
  comfort: SeatTarget[];
}
const targetCache = new WeakMap<EntityStore, ActivityTargets>();

/** Only static choices are cached; reachability, distance and occupancy stay live per dwarf. */
function activityTargets(ctx: TickContext): ActivityTargets {
  const entities = ctx.world.entities;
  const revision = [C.Building, C.Room, C.Zone].map((type) => entities.revision(type)).join(':');
  const cached = targetCache.get(entities);
  if (cached?.revision === revision) return cached;
  const b = buildings(ctx);
  const hall = b?.hearthHallTiles() ?? [];
  const targets = (ids: readonly EntityId[]): SeatTarget[] => ids.flatMap((id) => {
    const view = b?.get(id);
    return view?.state === 'built' ? [{ tile: view.origin, tier: roomTier(ctx, view.origin) }] : [];
  });
  const value = { revision, hall, hallSet: new Set(hall),
    social: [...hall, ...(b?.zonesOfType('meeting_area') ?? []).flatMap((id) => b?.zone(id)?.tiles ?? [])],
    wells: b?.wells() ?? [],
    dining: targets(b?.diningSeats() ?? []), comfort: targets(b?.byTag('sit') ?? []) };
  targetCache.set(entities, value);
  return value;
}

const clamp = (n: number): number => Math.max(0, Math.min(NEED_MAX, n));

function tile(ctx: TickContext, id: EntityId): TileIndex {
  return ctx.world.services.movement?.tileOf(id) ?? -1;
}

function reachable(ctx: TickContext, from: TileIndex, tile: TileIndex): boolean {
  if (from < 0 || tile < 0) return false;
  return ctx.readers.pathing.passable(tile, 'walker') && ctx.readers.pathing.reachable(from, tile, 'walker');
}

function distance(ctx: TickContext, a: TileIndex, b: TileIndex): number {
  const m = ctx.world.map;
  if (!m.validIndex(a) || !m.validIndex(b)) return Number.POSITIVE_INFINITY;
  return Math.max(Math.abs(m.xOf(a) - m.xOf(b)), Math.abs(m.yOf(a) - m.yOf(b))) + Math.abs(m.zOf(a) - m.zOf(b)) * 4;
}

function buildings(ctx: TickContext): BuildingsReader | null {
  return ctx.readers.has('14') ? ctx.readers.of<BuildingsReader>('14') : null;
}

function items(ctx: TickContext): ItemsReader | null {
  return ctx.readers.has('13') ? ctx.readers.of<ItemsReader>('13') : null;
}

function roomTier(ctx: TickContext, at: TileIndex): number {
  const b = buildings(ctx);
  if (b === null) return 0;
  let tier = 0;
  for (const zone of b.zonesAt(at)) tier = Math.max(tier, b.room(zone)?.tier ?? 0);
  return tier;
}

function nearest(ctx: TickContext, from: TileIndex, choices: readonly TileIndex[]): TileIndex {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const to of choices) {
    if (to < 0) continue;
    const d = distance(ctx, from, to);
    if (d < bestDistance || (d === bestDistance && (best < 0 || to < best))) {
      best = to;
      bestDistance = d;
    }
  }
  return best;
}

function hallTile(ctx: TickContext, from: TileIndex, wagon: TileIndex, allowed: (tile: TileIndex) => boolean = () => true): TileIndex {
  const hall = activityTargets(ctx).hall.filter((t) => reachable(ctx, from, t) && allowed(t));
  if (hall.length > 0) return nearest(ctx, from, hall);
  return wagon >= 0 && reachable(ctx, from, wagon) && allowed(wagon) ? wagon : -1;
}

function socialTile(ctx: TickContext, from: TileIndex, allowed: (tile: TileIndex) => boolean): TileIndex {
  return nearest(ctx, from, activityTargets(ctx).social.filter((t) => reachable(ctx, from, t) && allowed(t)));
}

function plan(need: NeedName, target: TileIndex, extra: Partial<ActivityPlan> = {}): ActivityPlan {
  return { need, phase: 'travel', itemId: 0, partner: 0, target, until: 0, ownBed: false, roomTier: 0,
    startedRest: 0, atTable: false, ...extra };
}

function seat(ctx: TickContext, from: TileIndex, dining: boolean, allowed: (tile: TileIndex) => boolean = () => true): { tile: TileIndex; tier: number } | null {
  const b = buildings(ctx);
  if (b === null) return null;
  const choices = dining ? activityTargets(ctx).dining : activityTargets(ctx).comfort;
  let chosen: { tile: TileIndex; tier: number } | null = null;
  let chosenDistance = Number.POSITIVE_INFINITY;
  for (const { tile: to, tier } of choices) {
    if (!reachable(ctx, from, to) || !allowed(to)) continue;
    const d = distance(ctx, from, to);
    if (dining && d > DINING_SEARCH_RADIUS) continue;
    if (!dining && tier < 2) continue;
    if (ctx.readers.entities.at(to).some((occupant) => ctx.world.entities.has(occupant, C.Brain))) continue;
    if (chosen === null || (!dining && tier > chosen.tier) || (tier === chosen.tier && (d < chosenDistance || (d === chosenDistance && to < chosen.tile)))) {
      chosen = { tile: to, tier }; chosenDistance = d;
    }
  }
  return chosen;
}

function bed(ctx: TickContext, id: EntityId, from: TileIndex, wagon: TileIndex, allowed: (tile: TileIndex) => boolean): ActivityPlan {
  // Rest at NEED_MAX is an involuntary pass-out at the current tile.
  if ((ctx.world.entities.get(id, C.Needs)?.rest ?? 0) >= NEED_MAX) return plan('rest', from);
  const b = buildings(ctx);
  const ownZone = b?.bedroomOf(id) ?? 0;
  if (b !== null && ownZone !== 0) {
    for (const bid of b.byTag('sleep')) {
      const v = b.get(bid);
      if (v?.state === 'built' && (b.bedHolder(bid) === 0 || b.bedHolder(bid) === id) &&
          v.footprint.some((t) => b.zonesAt(t).includes(ownZone))) {
        if (reachable(ctx, from, v.origin) && allowed(v.origin)) {
          return plan('rest', v.origin, { ownBed: true, roomTier: b.room(ownZone)?.tier ?? 0, itemId: bid });
        }
      }
    }
  }
  const free = b?.freeBeds(id) ?? [];
  const reachableFree = free.filter((x) => {
    const orig = b?.get(x)?.origin ?? -1;
    return reachable(ctx, from, orig) && allowed(orig);
  });
  const goal = b === null ? -1 : nearest(ctx, from, reachableFree.map((x) => b.get(x)?.origin ?? -1));
  if (goal >= 0) return plan('rest', goal, { roomTier: roomTier(ctx, goal), itemId: reachableFree.find((x) => b?.get(x)?.origin === goal) ?? 0 });
  const floor = hallTile(ctx, from, wagon, allowed);
  return plan('rest', floor >= 0 ? floor : from);
}

function water(ctx: TickContext, from: TileIndex, allowed: (tile: TileIndex) => boolean): TileIndex {
  const m = ctx.world.map;
  if (!m.validIndex(from)) return -1;
  const fx = m.xOf(from);
  const fy = m.yOf(from);
  const fz = m.zOf(from);

  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  // Search level by level outward: dz = 0, -1, +1, -2, +2, ..., -8, +8
  const dzSequence: number[] = [0];
  for (let step = 1; step <= 8; step += 1) {
    dzSequence.push(-step, step);
  }

  for (const dz of dzSequence) {
    // A water tile is drunk from its own level or from the bank one level above it, so its stand
    // tile may be one level nearer the dwarf than the water itself.
    const near = dz < 0 ? Math.abs(dz) - 1 : Math.abs(dz);
    if ((Math.abs(dz) - 1) * Z_DISTANCE_WEIGHT > bestDistance) break;
    const z = fz + dz;
    if (z < 0 || z >= m.d) continue;

    for (let dy = -DRINK_SEARCH_RADIUS; dy <= DRINK_SEARCH_RADIUS; dy += 1) {
      if (Math.abs(dy) - 1 + near * Z_DISTANCE_WEIGHT > bestDistance) continue;
      const wy = fy + dy;
      if (wy < 0 || wy >= m.h) continue;
      for (let dx = -DRINK_SEARCH_RADIUS; dx <= DRINK_SEARCH_RADIUS; dx += 1) {
        // Every standing tile is at most one cell closer than its water tile. Keep equal
        // distances so the original lowest-tile tie remains eligible.
        if (Math.max(Math.abs(dx), Math.abs(dy)) - 1 + near * Z_DISTANCE_WEIGHT > bestDistance) continue;
        const wx = fx + dx;
        if (wx < 0 || wx >= m.w) continue;
        const wTile = m.index(wx, wy, z);
        if (m.fluidLevelAt(wTile) < 1 || m.fluidTypeAt(wTile) !== FluidType.Water || m.fluidFrozenAt(wTile)) continue;

        // The bank one level up reaches the water only through open air over it (as fishing's bank, 09).
        const over = z + 1 < m.d ? m.index(wx, wy, z + 1) : -1;
        const fromAbove = over >= 0 && m.kindAt(over) === TileKind.Open && m.fluidLevelAt(over) === 0;
        for (const sz of fromAbove ? [z, z + 1] : [z]) {
          for (let sy = wy - 1; sy <= wy + 1; sy += 1) {
            if (sy < 0 || sy >= m.h) continue;
            for (let sx = wx - 1; sx <= wx + 1; sx += 1) {
              if (sx < 0 || sx >= m.w) continue;
              if (sx === wx && sy === wy) continue;
              const sTile = m.index(sx, sy, sz);
              const d = Math.max(Math.abs(sx - fx), Math.abs(sy - fy)) + Math.abs(sz - fz) * Z_DISTANCE_WEIGHT;
              if (d > bestDistance || (d === bestDistance && best >= 0 && sTile >= best)) continue;
              if (!reachable(ctx, from, sTile) || !allowed(sTile)) continue;
              if (d < bestDistance || (d === bestDistance && (best < 0 || sTile < best))) {
                best = sTile;
                bestDistance = d;
              }
            }
          }
        }
      }
    }
  }

  return best;
}

function standBeside(ctx: TickContext, from: TileIndex, source: TileIndex): TileIndex {
  const map = ctx.world.map;
  const choices: TileIndex[] = [];
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    if (dx === 0 && dy === 0) continue;
    const at = map.offset(source, dx, dy, 0);
    if (at >= 0 && reachable(ctx, from, at)) choices.push(at);
  }
  return nearest(ctx, from, choices);
}

/** Talk partners stand within Chebyshev distance 2 on one level. */
function inTalkReach(ctx: TickContext, a: TileIndex, b: TileIndex): boolean {
  const m = ctx.world.map;
  return a >= 0 && b >= 0 && m.zOf(a) === m.zOf(b) &&
    Math.max(Math.abs(m.xOf(a) - m.xOf(b)), Math.abs(m.yOf(a) - m.yOf(b))) <= 2;
}

export class Activities {
  readonly plans = new Map<EntityId, ActivityPlan>();
  readonly retryUntil = new Map<EntityId, Map<NeedName, number>>();
  /** Talks in passing; each talk has an entry for both dwarves. */
  readonly talks = new Map<EntityId, { partner: EntityId; until: number }>();
  /** Ticks eaten, drunk and sat in the hearth hall toward the next hearth visit. */
  readonly hearthTicks = new Map<EntityId, number>();
  /** The tick before which a dwarf takes no hall errand before work. */
  readonly hallRetryUntil = new Map<EntityId, number>();

  serializeTalks(): [EntityId, EntityId, number][] {
    return Array.from(this.talks).filter(([id, talk]) => id < talk.partner)
      .map(([id, talk]) => [id, talk.partner, talk.until] as [EntityId, EntityId, number]).sort((a, b) => a[0] - b[0]);
  }

  private endTalk(id: EntityId): void {
    const talk = this.talks.get(id);
    if (talk === undefined) return;
    this.talks.delete(id);
    this.talks.delete(talk.partner);
  }

  /** A dead dwarf keeps no talk and no hearth time. */
  forget(id: EntityId): void {
    this.endTalk(id);
    this.hearthTicks.delete(id);
    this.hallRetryUntil.delete(id);
  }

  /**
   * `10` § Behavior selection step 6: one sit in the hearth hall for a dwarf with social, comfort or
   * joy at `LEISURE_MARK`. The seat is the nearest free chair on a hall tile, else a hall tile.
   */
  startHallErrand(ctx: TickContext, id: EntityId, b: Brain, allowTarget?: (tile: TileIndex) => boolean): boolean {
    if (ctx.tick < (this.hallRetryUntil.get(id) ?? 0)) return false;
    const from = tile(ctx, id);
    if (from < 0) return false;
    const allowed = allowTarget ?? (() => true);
    const targets = activityTargets(ctx);
    const usable = (to: TileIndex): boolean => reachable(ctx, from, to) && allowed(to);
    const free = (to: TileIndex): boolean => !ctx.readers.entities.at(to).some((occupant) => occupant !== id && ctx.world.entities.has(occupant, C.Brain));
    const chairs = targets.comfort.filter((s) => targets.hallSet.has(s.tile) && usable(s.tile) && free(s.tile)).map((s) => s.tile);
    const target = chairs.length > 0 ? nearest(ctx, from, chairs) : nearest(ctx, from, targets.hall.filter(usable));
    if (target < 0) return false;
    this.plans.set(id, plan('comfort', target, { roomTier: roomTier(ctx, target), hall: true }));
    b.behavior = 'need'; b.activity = 'comfort';
    b.targetTile = target;
    return true;
  }

  /** Awake and not walking. */
  private canTalk(ctx: TickContext, id: EntityId): boolean {
    const entities = ctx.world.entities;
    if (!entities.alive(id) || !entities.has(id, C.Brain) || tile(ctx, id) < 0) return false;
    if (ctx.readers.has('17') && !ctx.readers.of<{ isConscious(id: EntityId): boolean }>('17').isConscious(id)) return false;
    const p = this.plans.get(id);
    if (p !== undefined && p.need === 'rest' && p.phase === 'use') return false;
    return (ctx.world.services.movement?.walkTarget(id) ?? -1) < 0;
  }

  /** A social errand finds its own partner; a stay for a talk in passing has no partner of its own. */
  private onSocialErrand(id: EntityId): boolean {
    const p = this.plans.get(id);
    return p !== undefined && p.need === 'social' && !(p.phase === 'use' && p.partner === 0);
  }

  /**
   * `10` § Social, comfort, joy, talks in passing. Every `TALK_CHECK_TICKS`: a talk whose two
   * dwarves no longer stand awake and still within reach ends without effect, a talk that has
   * lasted `TALK_TICKS` relieves both, and each still, awake dwarf over its social want threshold
   * starts one with a neighbour found through the spatial index.
   */
  passingTalks(ctx: TickContext, dwarves: readonly EntityId[]): void {
    if (ctx.tick % TALK_CHECK_TICKS !== 0) return;
    for (const id of Array.from(this.talks.keys()).sort((a, b) => a - b)) {
      const talk = this.talks.get(id);
      if (talk === undefined || id > talk.partner) continue;
      const together = this.canTalk(ctx, id) && this.canTalk(ctx, talk.partner) &&
        inTalkReach(ctx, tile(ctx, id), tile(ctx, talk.partner));
      if (together && ctx.tick < talk.until) continue;
      this.endTalk(id);
      if (together) this.talked(ctx, id, talk.partner);
    }
    if (!ctx.readers.has('spatial')) return;
    let all: Set<EntityId> | null = null;
    for (const id of dwarves) {
      if (this.talks.has(id) || this.onSocialErrand(id)) continue;
      if ((ctx.world.entities.get(id, C.Needs)?.social ?? 0) < WANT.social || !this.canTalk(ctx, id)) continue;
      all ??= new Set(dwarves);
      const at = tile(ctx, id);
      const friends = ctx.world.entities.get(id, C.Relationships)?.friends ?? [];
      let partner = 0;
      // Ascending ids from the index: the first friend, else the first other dwarf.
      for (const other of ctx.readers.spatial.inRadius(at, 2, 'creature')) {
        if (other === id || !all.has(other) || this.talks.has(other) || this.onSocialErrand(other)) continue;
        if (!inTalkReach(ctx, at, tile(ctx, other)) || !this.canTalk(ctx, other)) continue;
        if (friends.includes(other)) { partner = other; break; }
        if (partner === 0) partner = other;
      }
      if (partner === 0) continue;
      this.talks.set(id, { partner, until: ctx.tick + TALK_TICKS });
      this.talks.set(partner, { partner: id, until: ctx.tick + TALK_TICKS });
    }
  }

  /**
   * The partner of a dwarf seated on a hall errand whose social need is at its want threshold: as
   * on a social errand, any other dwarf within reach that is not asleep; a friend first, then by id.
   */
  private hallPartner(ctx: TickContext, id: EntityId, at: TileIndex): EntityId {
    if ((ctx.world.entities.get(id, C.Needs)?.social ?? 0) < WANT.social || !ctx.readers.has('spatial')) return 0;
    const friends = ctx.world.entities.get(id, C.Relationships)?.friends ?? [];
    let partner = 0;
    for (const other of ctx.readers.spatial.inRadius(at, 2, 'creature')) {
      if (other === id || !ctx.world.entities.alive(other) || !ctx.world.entities.has(other, C.Brain) || !ctx.world.entities.has(other, C.Needs)) continue;
      if (!inTalkReach(ctx, at, tile(ctx, other))) continue;
      const plan = this.plans.get(other);
      if (plan !== undefined && plan.need === 'rest' && plan.phase === 'use') continue;
      if (friends.includes(other)) return other;
      if (partner === 0) partner = other;
    }
    return partner;
  }

  /** A dwarf in a talk in passing stays where it is until the talk ends. */
  linger(ctx: TickContext, id: EntityId, b: Brain): boolean {
    const talk = this.talks.get(id);
    const at = tile(ctx, id);
    if (talk === undefined || ctx.tick >= talk.until || at < 0) return false;
    this.plans.set(id, plan('social', at, { phase: 'use', until: talk.until }));
    b.behavior = 'need'; b.activity = 'social';
    b.targetTile = at;
    return true;
  }

  /** Both dwarves are relieved, their talk counts rise, and `Talked` is emitted. */
  private talked(ctx: TickContext, id: EntityId, partner: EntityId): void {
    const friends = (ctx.world.entities.get(id, C.Relationships)?.friends ?? []).includes(partner);
    for (const who of [id, partner]) {
      const n = ctx.world.entities.get(who, C.Needs);
      if (n !== undefined) ctx.world.entities.add(who, C.Needs, { ...n, social: clamp(n.social - (friends ? 60 : 40)) });
    }
    for (const [a, z] of [[id, partner], [partner, id]] as [EntityId, EntityId][]) {
      const rel = ctx.world.entities.get(a, C.Relationships);
      if (rel === undefined) continue;
      const counts = new Map(rel.talkCount);
      const count = (counts.get(z) ?? 0) + 1; counts.set(z, count);
      const friendsList = count >= FRIEND_TALKS && !rel.friends.includes(z) ? [...rel.friends, z].sort((x, y) => x - y) : rel.friends;
      ctx.world.entities.add(a, C.Relationships, { ...rel, friends: friendsList, talkCount: Array.from(counts).sort((x, y) => x[0] - y[0]) } as Relationships);
    }
    ctx.emit({ type: 'Talked', a: id, b: partner, friends });
  }

  isBlocked(id: EntityId, need: NeedName, tick: number): boolean {
    const dwarfMap = this.retryUntil.get(id);
    if (dwarfMap === undefined) return false;
    const until = dwarfMap.get(need);
    if (until === undefined) return false;
    if (tick < until) return true;
    dwarfMap.delete(need);
    return false;
  }

  setRetryUntil(id: EntityId, need: NeedName, until: number): void {
    let m = this.retryUntil.get(id);
    if (m === undefined) {
      m = new Map();
      this.retryUntil.set(id, m);
    }
    m.set(need, until);
  }

  serializeRetryUntil(): [EntityId, NeedName, number][] {
    const out: [EntityId, NeedName, number][] = [];
    const ids = Array.from(this.retryUntil.keys()).sort((a, b) => a - b);
    for (const id of ids) {
      const map = this.retryUntil.get(id);
      if (map === undefined) continue;
      const needs = Array.from(map.keys()).sort() as NeedName[];
      for (const need of needs) {
        const until = map.get(need);
        if (until !== undefined) {
          out.push([id, need, until]);
        }
      }
    }
    return out;
  }

  cancel(ctx: TickContext, id: EntityId): void {
    const p = this.plans.get(id);
    if (p?.itemId && (p.need === 'hunger' || p.need === 'thirst')) {
      const api = ctx.world.services.items;
      const item = items(ctx)?.get(p.itemId);
      if (api !== null && item !== undefined) {
        if (item.carriedBy === id) api.dropAt(p.itemId, tile(ctx, id));
        if (item.reservedBy === id) {
          api.release(p.itemId);
          ctx.emit({ type: 'ItemReleased', itemId: p.itemId, jobId: id });
        }
      }
    }
    this.plans.delete(id);
  }

  start(ctx: TickContext, id: EntityId, need: NeedName, b: Brain, wagon: TileIndex, dwarves: readonly EntityId[], allowTarget?: (tile: TileIndex) => boolean): boolean {
    if (this.isBlocked(id, need, ctx.tick)) return false;
    const from = tile(ctx, id);
    if (from < 0) return false;
    const its = items(ctx);
    const allowed = allowTarget ?? (() => true);
    const searchOptions = { reservable: true, ...(allowTarget === undefined ? {} : { allowedTile: allowTarget }) };
    let p: ActivityPlan | null = null;
    if (need === 'hunger' && its !== null && ctx.world.services.items !== null) {
      const food = its.findItem({ edible: true, category: 'food/meal' }, from, 'walker', searchOptions)
        || its.findItem({ edible: true }, from, 'walker', searchOptions);
      if (food !== 0) {
        const record = its.get(food);
        const one = record !== undefined && record.count > 1 ? ctx.world.services.items.split(food, 1) : food;
        const target = its.tileOf(one);
        if (target >= 0) { ctx.world.services.items.reserve(one, id); p = plan(need, target, { itemId: one }); }
      }
    } else if (need === 'thirst') {
      if (its !== null && ctx.world.services.items !== null) {
        const drink = its.findItem({ drinkable: true }, from, 'walker',
          { ...searchOptions, stockpiledContainerClass: 'barrel' });
        if (drink !== 0) {
          const record = its.get(drink);
          const one = record !== undefined && record.count > 1 ? ctx.world.services.items.split(drink, 1) : drink;
          const target = its.tileOf(one);
          if (target >= 0) { ctx.world.services.items.reserve(one, id); p = plan(need, target, { itemId: one }); }
        }
      }
      if (p === null) {
        const br = buildings(ctx);
        if (br !== null) {
          const wells = activityTargets(ctx).wells.filter((x) => br.wellWorking(x));
          const wellStands = wells.map((x) => standBeside(ctx, from, br.get(x)?.origin ?? -1)).filter((t) => t >= 0 && reachable(ctx, from, t) && allowed(t));
          const target = wellStands.length === 0 ? -1 : nearest(ctx, from, wellStands);
          if (target >= 0) p = plan(need, target);
        }
        if (p === null) {
          const w = water(ctx, from, allowed);
          if (w >= 0) p = plan(need, w);
        }
      }
      // D-120: loose alcohol is still drinkable when no barrel, well or water exists.
      if (p === null && its !== null && ctx.world.services.items !== null) {
        const drink = its.findItem({ drinkable: true }, from, 'walker', searchOptions);
        if (drink !== 0) {
          const record = its.get(drink);
          const one = record !== undefined && record.count > 1 ? ctx.world.services.items.split(drink, 1) : drink;
          const target = its.tileOf(one);
          if (target >= 0) { ctx.world.services.items.reserve(one, id); p = plan(need, target, { itemId: one }); }
        }
      }
    } else if (need === 'rest') p = bed(ctx, id, from, wagon, allowed);
    else if (need === 'social') {
      if (!dwarves.some((x) => x !== id && ctx.world.entities.alive(x))) return false;
      const target = socialTile(ctx, from, allowed);
      if (target >= 0) p = plan(need, target);
    } else if (need === 'comfort') {
      const s = seat(ctx, from, false, allowed);
      const hall = activityTargets(ctx).hall.filter((t) => reachable(ctx, from, t) && allowed(t));
      const target = s?.tile ?? (hall.length > 0 ? nearest(ctx, from, hall) : -1);
      if (target >= 0) p = plan(need, target, { roomTier: s?.tier ?? 0 });
    } else if (need === 'joy') {
      const hall = activityTargets(ctx).hall.filter((t) => reachable(ctx, from, t) && allowed(t));
      const target = hall.length > 0 ? nearest(ctx, from, hall) : -1;
      if (target >= 0) p = plan(need, target);
    }
    if (p === null || !allowed(p.target)) return false;
    this.plans.set(id, p);
    b.behavior = 'need'; b.activity = need === 'rest' ? 'sleep' : need;
    b.targetTile = p.target;
    return true;
  }

  /** Returns true when the activity finished or became impossible. */
  step(ctx: TickContext, id: EntityId, b: Brain): boolean {
    const p = this.plans.get(id);
    if (p === undefined) return true;
    if (p.need === 'rest' && p.itemId !== 0 && buildings(ctx)?.bedHolder(p.itemId) !== id) {
      this.cancel(ctx, id);
      return true;
    }
    if (p.itemId !== 0 && (p.need === 'hunger' || p.need === 'thirst')) {
      const reader = items(ctx);
      const item = reader?.get(p.itemId);
      const def = item === undefined ? undefined : reader?.def(item.type);
      if (item === undefined || item.reservedBy !== id || item.rotStage >= 2 ||
          !(p.need === 'hunger' ? def?.edible : def?.drinkable)) {
        this.cancel(ctx, id);
        return true;
      }
    }
    const movement = ctx.world.services.movement;
    const at = tile(ctx, id);
    if (p.need === 'social' && p.phase === 'use' && p.partner === 0) {
      // Staying for a talk in passing: `passingTalks` ends it and relieves both.
      if (this.talks.has(id) && ctx.tick < p.until) return false;
      this.plans.delete(id);
      return true;
    }
    if (p.phase !== 'use') {
      if (p.target < 0) { this.cancel(ctx, id); return true; }
      if (at !== p.target) {
        const result = movement?.walkTo(id, p.target, 'need', ctx);
        if (result === 'unreachable') {
          this.setRetryUntil(id, p.need as NeedName, ctx.tick + NEED_RETRY_TICKS);
          this.cancel(ctx, id);
          return true;
        }
        return false;
      }
      if (p.need === 'social') {
        if (p.until === 0) p.until = ctx.tick + SOCIAL_WAIT_TICKS;
        const m = ctx.world.map;
        const ax = m.xOf(at);
        const ay = m.yOf(at);
        const az = m.zOf(at);
        const rel = ctx.world.entities.get(id, C.Relationships);
        const candidates: EntityId[] = [];
        for (const cid of ctx.world.entities.with(C.Brain, C.Creature)) {
          if (cid === id || !ctx.world.entities.alive(cid)) continue;
          const ctile = tile(ctx, cid);
          if (ctile < 0 || m.zOf(ctile) !== az) continue;
          if (Math.max(Math.abs(m.xOf(ctile) - ax), Math.abs(m.yOf(ctile) - ay)) > 2) continue;
          const cplan = this.plans.get(cid);
          if (cplan !== undefined && cplan.need === 'rest' && cplan.phase === 'use') continue;
          candidates.push(cid);
        }
        candidates.sort((c1, c2) => {
          const f1 = rel?.friends.includes(c1) ? 0 : 1;
          const f2 = rel?.friends.includes(c2) ? 0 : 1;
          return f1 - f2 || c1 - c2;
        });
        const partner = candidates[0] ?? 0;
        if (partner !== 0) {
          p.partner = partner;
          p.phase = 'use';
          p.until = ctx.tick + TALK_TICKS;
          return false;
        }
        if (ctx.tick >= p.until) {
          this.cancel(ctx, id);
          return true;
        }
        return false;
      }
      if (p.need === 'hunger' && p.phase === 'travel') {
        const api = ctx.world.services.items;
        if (api === null || items(ctx)?.get(p.itemId) === undefined) { this.cancel(ctx, id); return true; }
        api.attachToCarrier(p.itemId, id);
        const threat = ctx.readers.has('10') ? ctx.readers.of<{ avoidedThreatTile?(id: EntityId): TileIndex }>('10').avoidedThreatTile?.(id) ?? -1 : -1;
        const critical = (ctx.world.entities.get(id, C.Needs)?.hunger ?? 0) >= (CRITICAL.hunger as number);
        const m = ctx.world.map;
        const s = seat(ctx, at, true, (to) => critical || threat < 0 || m.zOf(to) !== m.zOf(threat) ||
          Math.max(Math.abs(m.xOf(to) - m.xOf(threat)), Math.abs(m.yOf(to) - m.yOf(threat))) > THREAT_RADIUS);
        if (s !== null) { p.target = s.tile; p.roomTier = s.tier; p.phase = 'seat'; p.atTable = true; b.targetTile = s.tile; return false; }
      }
      p.phase = 'use';
      p.until = ctx.tick + (p.need === 'hunger' ? EAT_TICKS : p.need === 'thirst' ? DRINK_TICKS
        : p.need === 'comfort' ? SIT_TICKS
        : p.need === 'joy' ? HEARTH_VISIT_TICKS : SLEEP_HOURS * TICKS_PER_HOUR);
      p.startedRest = ctx.world.entities.get(id, C.Needs)?.rest ?? 0;
    }
    if (p.need === 'rest' && (ctx.world.entities.get(id, C.Needs)?.rest ?? 0) <= 0) p.until = ctx.tick;
    if (p.hall === true && p.partner === 0 && ctx.tick % TALK_CHECK_TICKS === 0 && !this.talks.has(id)) p.partner = this.hallPartner(ctx, id, at);
    if (ctx.tick < p.until) return false;
    const n = ctx.world.entities.get(id, C.Needs);
    if (n === undefined) { this.cancel(ctx, id); return true; }
    const change = (name: NeedName, relief: number): void => {
      const cur = ctx.world.entities.get(id, C.Needs) ?? n;
      ctx.world.entities.add(id, C.Needs, { ...cur, [name]: clamp(cur[name] - relief) } as Needs);
    };
    // Eating, drinking and sitting in the hearth hall add up to a hearth visit.
    const hearthTime = (ticks: number): void => {
      if (!activityTargets(ctx).hallSet.has(at)) return;
      const total = (this.hearthTicks.get(id) ?? 0) + ticks;
      if (total < HEARTH_VISIT_TICKS) { this.hearthTicks.set(id, total); return; }
      this.hearthTicks.delete(id);
      change('joy', 30); ctx.emit({ type: 'HearthVisited', id });
    };
    const its = items(ctx);
    if (p.need === 'hunger') {
      const item = its?.get(p.itemId);
      if (item !== undefined) {
        const def = its?.def(item.type);
        const meal = def?.category.startsWith('food/meal') ?? false;
        ctx.world.services.items?.consume(p.itemId, 1);
        change('hunger', meal ? 100 : 70);
        ctx.emit({ type: 'MealEaten', id, quality: item.quality, atTable: p.atTable, roomTier: p.roomTier,
          stage: item.rotStage, kind: meal ? 'meal' : 'raw', mealType: def?.id ?? '' });
        if (meal && item.quality >= 4) change('joy', 20);
        if (p.atTable) {
          // A meal at a table is also a sit in that room.
          const relief = p.roomTier >= 2 ? 40 : activityTargets(ctx).hallSet.has(at) ? 20 : 0;
          if (relief > 0) { change('comfort', relief); ctx.emit({ type: 'Sat', id, roomTier: p.roomTier }); }
        }
        hearthTime(EAT_TICKS);
      }
    } else if (p.need === 'thirst') {
      if (p.itemId !== 0) {
        const item = its?.get(p.itemId);
        if (item !== undefined) {
          ctx.world.services.items?.consume(p.itemId, 1); change('thirst', 100);
          ctx.emit({ type: 'DrankAlcohol', id, material: item.material, quality: item.quality });
          hearthTime(DRINK_TICKS);
        }
      } else {
        change('thirst', 80);
        ctx.emit({ type: 'DrankWater', id, outdoors: ctx.world.map.hasFlag(at, TileFlag.Outdoor) });
        hearthTime(DRINK_TICKS);
      }
    } else if (p.need === 'rest') {
      change('rest', n.rest);
      const bedItem = buildings(ctx)?.get(p.itemId)?.itemId ?? 0;
      ctx.emit({ type: 'Slept', id, bedQuality: its?.get(bedItem)?.quality ?? 0, roomTier: p.roomTier,
        onFloor: p.itemId === 0, outdoors: ctx.world.map.hasFlag(at, TileFlag.Outdoor), ownBed: p.ownBed,
        restored: p.startedRest - n.rest });
    } else if (p.need === 'social') {
      const partner = p.partner;
      if (partner !== 0 && ctx.world.entities.alive(partner)) this.talked(ctx, id, partner);
    } else if (p.need === 'comfort') {
      change('comfort', p.roomTier >= 2 ? 40 : 20);
      ctx.emit({ type: 'Sat', id, roomTier: p.roomTier });
      hearthTime(SIT_TICKS);
      // The sit was also the talk, with the partner found from the seat, as on a social errand.
      if (p.hall === true && p.partner !== 0 && !this.talks.has(id) && ctx.world.entities.alive(p.partner)) this.talked(ctx, id, p.partner);
      if (p.hall === true && !this.talks.has(id)) {
        // The sit could not relieve everything (nobody to talk to): do not come straight back.
        const after = ctx.world.entities.get(id, C.Needs);
        if (after !== undefined && (after.social >= LEISURE_MARK || after.comfort >= LEISURE_MARK || after.joy >= LEISURE_MARK)) {
          this.hallRetryUntil.set(id, ctx.tick + LEISURE_RETRY_TICKS);
        }
      }
    } else if (p.need === 'joy') {
      change('joy', 30); ctx.emit({ type: 'HearthVisited', id });
    }
    this.plans.delete(id);
    // A talk in passing that began over the meal, the drink or the seat is finished before leaving.
    if (p.need !== 'rest' && p.need !== 'social' && this.linger(ctx, id, b)) return false;
    return true;
  }
}
