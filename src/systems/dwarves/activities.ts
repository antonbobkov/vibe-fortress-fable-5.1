/** `10-dwarves.md` §§ Eating and drinking, Sleeping, Social, comfort, joy;
 * `algorithms/creature-brains.md` § startNeed. Plans are saved by 10. */
import { C, type Brain, type Needs, type Relationships } from '@core/components';
import { NEED_MAX, TICKS_PER_HOUR } from '@core/constants';
import { FluidType, TileFlag } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { Z_DISTANCE_WEIGHT } from '@systems/jobs/constants';
import { DINING_SEARCH_RADIUS, DRINK_TICKS, EAT_TICKS, FRIEND_TALKS, HEARTH_VISIT_TICKS, NEED_RETRY_TICKS, SIT_TICKS, SLEEP_HOURS, SOCIAL_WAIT_TICKS, TALK_TICKS } from './constants';
import type { NeedName } from './needs';
import type { ActivityPlan } from './state';

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

function hallTile(ctx: TickContext, from: TileIndex, wagon: TileIndex): TileIndex {
  const hall = (buildings(ctx)?.hearthHallTiles() ?? []).filter((t) => reachable(ctx, from, t));
  if (hall.length > 0) return nearest(ctx, from, hall);
  return wagon >= 0 && reachable(ctx, from, wagon) ? wagon : -1;
}

function socialTile(ctx: TickContext, from: TileIndex): TileIndex {
  const b = buildings(ctx);
  if (b === null) return -1;
  const candidates: TileIndex[] = [];
  for (const t of b.hearthHallTiles()) {
    if (reachable(ctx, from, t)) candidates.push(t);
  }
  for (const zone of b.zonesOfType('meeting_area')) {
    for (const t of b.zone(zone)?.tiles ?? []) {
      if (reachable(ctx, from, t)) candidates.push(t);
    }
  }
  return nearest(ctx, from, candidates);
}

function plan(need: NeedName, target: TileIndex, extra: Partial<ActivityPlan> = {}): ActivityPlan {
  return { need, phase: 'travel', itemId: 0, partner: 0, target, until: 0, ownBed: false, roomTier: 0,
    startedRest: 0, atTable: false, ...extra };
}

function seat(ctx: TickContext, from: TileIndex, dining: boolean): { tile: TileIndex; tier: number } | null {
  const b = buildings(ctx);
  if (b === null) return null;
  const ids = dining ? b.diningSeats() : b.byTag('sit');
  let chosen: { tile: TileIndex; tier: number } | null = null;
  let chosenDistance = Number.POSITIVE_INFINITY;
  for (const id of ids) {
    const v = b.get(id);
    if (v?.state !== 'built') continue;
    const to = v.origin;
    if (!reachable(ctx, from, to)) continue;
    const d = distance(ctx, from, to);
    if (dining && d > DINING_SEARCH_RADIUS) continue;
    const tier = roomTier(ctx, to);
    if (!dining && tier < 2) continue;
    if (ctx.readers.entities.at(to).some((occupant) => ctx.world.entities.has(occupant, C.Brain))) continue;
    if (chosen === null || (!dining && tier > chosen.tier) || (tier === chosen.tier && (d < chosenDistance || (d === chosenDistance && to < chosen.tile)))) {
      chosen = { tile: to, tier }; chosenDistance = d;
    }
  }
  return chosen;
}

function bed(ctx: TickContext, id: EntityId, from: TileIndex, wagon: TileIndex): ActivityPlan {
  // Rest at NEED_MAX is an involuntary pass-out at the current tile.
  if ((ctx.world.entities.get(id, C.Needs)?.rest ?? 0) >= NEED_MAX) return plan('rest', from);
  const b = buildings(ctx);
  const ownZone = b?.bedroomOf(id) ?? 0;
  if (b !== null && ownZone !== 0) {
    for (const bid of b.byTag('sleep')) {
      const v = b.get(bid);
      if (v?.state === 'built' && v.footprint.some((t) => b.zonesAt(t).includes(ownZone))) {
        if (reachable(ctx, from, v.origin)) {
          return plan('rest', v.origin, { ownBed: true, roomTier: b.room(ownZone)?.tier ?? 0, itemId: bid });
        }
      }
    }
  }
  const free = b?.freeBeds() ?? [];
  const reachableFree = free.filter((x) => {
    const orig = b?.get(x)?.origin ?? -1;
    return reachable(ctx, from, orig);
  });
  const goal = b === null ? -1 : nearest(ctx, from, reachableFree.map((x) => b.get(x)?.origin ?? -1));
  if (goal >= 0) return plan('rest', goal, { roomTier: roomTier(ctx, goal), itemId: reachableFree.find((x) => b?.get(x)?.origin === goal) ?? 0 });
  const floor = hallTile(ctx, from, wagon);
  return plan('rest', floor >= 0 ? floor : from);
}

function water(ctx: TickContext, from: TileIndex): TileIndex {
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
    if (Math.abs(dz) * Z_DISTANCE_WEIGHT > bestDistance) break;
    const z = fz + dz;
    if (z < 0 || z >= m.d) continue;

    for (let dy = -32; dy <= 32; dy += 1) {
      const wy = fy + dy;
      if (wy < 0 || wy >= m.h) continue;
      for (let dx = -32; dx <= 32; dx += 1) {
        const wx = fx + dx;
        if (wx < 0 || wx >= m.w) continue;
        const wTile = m.index(wx, wy, z);
        if (m.fluidLevelAt(wTile) < 1 || m.fluidTypeAt(wTile) !== FluidType.Water || m.fluidFrozenAt(wTile)) continue;

        for (let sy = wy - 1; sy <= wy + 1; sy += 1) {
          if (sy < 0 || sy >= m.h) continue;
          for (let sx = wx - 1; sx <= wx + 1; sx += 1) {
            if (sx < 0 || sx >= m.w) continue;
            if (sx === wx && sy === wy) continue;
            const sTile = m.index(sx, sy, z);
            if (!reachable(ctx, from, sTile)) continue;
            const d = Math.max(Math.abs(sx - fx), Math.abs(sy - fy)) + Math.abs(dz) * Z_DISTANCE_WEIGHT;
            if (d < bestDistance || (d === bestDistance && (best < 0 || sTile < best))) {
              best = sTile;
              bestDistance = d;
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

export class Activities {
  readonly plans = new Map<EntityId, ActivityPlan>();
  readonly retryUntil = new Map<EntityId, Map<NeedName, number>>();

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
      if (api !== null) {
        if (items(ctx)?.get(p.itemId)?.carriedBy === id) api.dropAt(p.itemId, tile(ctx, id));
        api.release(p.itemId);
      }
    }
    this.plans.delete(id);
  }

  start(ctx: TickContext, id: EntityId, need: NeedName, b: Brain, wagon: TileIndex, dwarves: readonly EntityId[]): boolean {
    if (this.isBlocked(id, need, ctx.tick)) return false;
    const from = tile(ctx, id);
    if (from < 0) return false;
    const its = items(ctx);
    let p: ActivityPlan | null = null;
    if (need === 'hunger' && its !== null && ctx.world.services.items !== null) {
      const food = its.findItem({ edible: true, category: 'food/meal' }, from, 'walker', { reservable: true })
        || its.findItem({ edible: true }, from, 'walker', { reservable: true });
      if (food !== 0) {
        const record = its.get(food);
        const one = record !== undefined && record.count > 1 ? ctx.world.services.items.split(food, 1) : food;
        const target = its.tileOf(one);
        if (target >= 0) { ctx.world.services.items.reserve(one, id); p = plan(need, target, { itemId: one }); }
      }
    } else if (need === 'thirst') {
      if (its !== null && ctx.world.services.items !== null) {
        const drink = its.findItem({ drinkable: true }, from, 'walker',
          { reservable: true, stockpiledContainerClass: 'barrel' });
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
          const wells = br.wells().filter((x) => br.wellWorking(x));
          const wellStands = wells.map((x) => standBeside(ctx, from, br.get(x)?.origin ?? -1)).filter((t) => t >= 0 && reachable(ctx, from, t));
          const target = wellStands.length === 0 ? -1 : nearest(ctx, from, wellStands);
          if (target >= 0) p = plan(need, target);
        }
        if (p === null) {
          const w = water(ctx, from);
          if (w >= 0) p = plan(need, w);
        }
      }
      // D-120: loose alcohol is still drinkable when no barrel, well or water exists.
      if (p === null && its !== null && ctx.world.services.items !== null) {
        const drink = its.findItem({ drinkable: true }, from, 'walker', { reservable: true });
        if (drink !== 0) {
          const record = its.get(drink);
          const one = record !== undefined && record.count > 1 ? ctx.world.services.items.split(drink, 1) : drink;
          const target = its.tileOf(one);
          if (target >= 0) { ctx.world.services.items.reserve(one, id); p = plan(need, target, { itemId: one }); }
        }
      }
    } else if (need === 'rest') p = bed(ctx, id, from, wagon);
    else if (need === 'social') {
      if (!dwarves.some((x) => x !== id && ctx.world.entities.alive(x))) return false;
      const target = socialTile(ctx, from);
      if (target >= 0) p = plan(need, target);
    } else if (need === 'comfort') {
      const s = seat(ctx, from, false);
      const hall = (buildings(ctx)?.hearthHallTiles() ?? []).filter((t) => reachable(ctx, from, t));
      const target = s?.tile ?? (hall.length > 0 ? nearest(ctx, from, hall) : -1);
      if (target >= 0) p = plan(need, target, { roomTier: s?.tier ?? 0 });
    } else if (need === 'joy') {
      const hall = (buildings(ctx)?.hearthHallTiles() ?? []).filter((t) => reachable(ctx, from, t));
      const target = hall.length > 0 ? nearest(ctx, from, hall) : -1;
      if (target >= 0) p = plan(need, target);
    }
    if (p === null) return false;
    this.plans.set(id, p);
    b.behavior = 'need'; b.activity = need === 'rest' ? 'sleep' : need;
    b.targetTile = p.target;
    return true;
  }

  /** Returns true when the activity finished or became impossible. */
  step(ctx: TickContext, id: EntityId, b: Brain): boolean {
    const p = this.plans.get(id);
    if (p === undefined) return true;
    const movement = ctx.world.services.movement;
    const at = tile(ctx, id);
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
        const s = seat(ctx, at, true);
        if (s !== null) { p.target = s.tile; p.roomTier = s.tier; p.phase = 'seat'; p.atTable = true; b.targetTile = s.tile; return false; }
      }
      p.phase = 'use';
      p.until = ctx.tick + (p.need === 'hunger' ? EAT_TICKS : p.need === 'thirst' ? DRINK_TICKS
        : p.need === 'comfort' ? SIT_TICKS
        : p.need === 'joy' ? HEARTH_VISIT_TICKS : SLEEP_HOURS * TICKS_PER_HOUR);
      p.startedRest = ctx.world.entities.get(id, C.Needs)?.rest ?? 0;
    }
    if (p.need === 'rest' && (ctx.world.entities.get(id, C.Needs)?.rest ?? 0) <= 0) p.until = ctx.tick;
    if (ctx.tick < p.until) return false;
    const n = ctx.world.entities.get(id, C.Needs);
    if (n === undefined) { this.cancel(ctx, id); return true; }
    const change = (name: NeedName, relief: number): void => ctx.world.entities.add(id, C.Needs, { ...n, [name]: clamp(n[name] - relief) } as Needs);
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
      }
    } else if (p.need === 'thirst') {
      if (p.itemId !== 0) {
        const item = its?.get(p.itemId);
        if (item !== undefined) {
          ctx.world.services.items?.consume(p.itemId, 1); change('thirst', 100);
          ctx.emit({ type: 'DrankAlcohol', id, material: item.material, quality: item.quality });
        }
      } else {
        change('thirst', 80);
        ctx.emit({ type: 'DrankWater', id, outdoors: ctx.world.map.hasFlag(at, TileFlag.Outdoor) });
      }
    } else if (p.need === 'rest') {
      change('rest', n.rest);
      const bedItem = buildings(ctx)?.get(p.itemId)?.itemId ?? 0;
      ctx.emit({ type: 'Slept', id, bedQuality: its?.get(bedItem)?.quality ?? 0, roomTier: p.roomTier,
        onFloor: p.itemId === 0, outdoors: ctx.world.map.hasFlag(at, TileFlag.Outdoor), ownBed: p.ownBed,
        restored: p.startedRest - n.rest });
    } else if (p.need === 'social') {
      const partner = p.partner;
      if (partner !== 0 && ctx.world.entities.alive(partner)) {
        const friends = (ctx.world.entities.get(id, C.Relationships)?.friends ?? []).includes(partner);
        change('social', friends ? 60 : 40);
        const other = ctx.world.entities.get(partner, C.Needs);
        if (other !== undefined) ctx.world.entities.add(partner, C.Needs, { ...other, social: clamp(other.social - (friends ? 60 : 40)) });
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
    } else if (p.need === 'comfort') {
      change('comfort', p.roomTier >= 2 ? 40 : 20);
      ctx.emit({ type: 'Sat', id, roomTier: p.roomTier });
    } else if (p.need === 'joy') {
      change('joy', 30); ctx.emit({ type: 'HearthVisited', id });
    }
    this.plans.delete(id);
    return true;
  }
}
