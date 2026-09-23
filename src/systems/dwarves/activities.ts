/** `10-dwarves.md` §§ Eating and drinking, Sleeping, Social, comfort, joy;
 * `algorithms/creature-brains.md` § startNeed. Plans are saved by 10. */
import { C, type Brain, type Needs, type Relationships } from '@core/components';
import { NEED_MAX, TICKS_PER_HOUR } from '@core/constants';
import { FluidType, TileFlag } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { DINING_SEARCH_RADIUS, DRINK_TICKS, EAT_TICKS, FRIEND_TALKS, HEARTH_VISIT_TICKS, SIT_TICKS, SLEEP_HOURS, SOCIAL_WAIT_TICKS, TALK_TICKS } from './constants';
import type { NeedName } from './needs';
import type { ActivityPlan } from './state';

const clamp = (n: number): number => Math.max(0, Math.min(NEED_MAX, n));

function tile(ctx: TickContext, id: EntityId): TileIndex {
  return ctx.world.services.movement?.tileOf(id) ?? -1;
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
    const d = distance(ctx, from, to);
    if (d < bestDistance) { best = to; bestDistance = d; }
  }
  return best;
}

function hallTile(ctx: TickContext, from: TileIndex, wagon: TileIndex): TileIndex {
  const hall = buildings(ctx)?.hearthHallTiles() ?? [];
  return nearest(ctx, from, hall) >= 0 ? nearest(ctx, from, hall) : wagon;
}

function socialTile(ctx: TickContext, from: TileIndex): TileIndex {
  const b = buildings(ctx);
  if (b === null) return -1;
  const candidates = b.hearthHallTiles();
  for (const zone of b.zonesOfType('meeting_area')) candidates.push(...(b.zone(zone)?.tiles ?? []));
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
    const d = distance(ctx, from, to);
    if (dining && d > DINING_SEARCH_RADIUS) continue;
    const tier = roomTier(ctx, to);
    if (!dining && tier < 2) continue;
    if (ctx.readers.entities.at(to).some((occupant) => ctx.world.entities.has(occupant, C.Brain))) continue;
    if (chosen === null || (!dining && tier > chosen.tier) || (tier === chosen.tier && d < chosenDistance)) {
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
      if (v?.state === 'built' && v.footprint.some((t) => b.zonesAt(t).includes(ownZone)))
        return plan('rest', v.origin, { ownBed: true, roomTier: b.room(ownZone)?.tier ?? 0, itemId: bid });
    }
  }
  const free = b?.freeBeds() ?? [];
  const goal = b === null ? -1 : nearest(ctx, from, free.map((x) => b.get(x)?.origin ?? -1));
  if (goal >= 0) return plan('rest', goal, { roomTier: roomTier(ctx, goal), itemId: free.find((x) => b?.get(x)?.origin === goal) ?? 0 });
  const floor = hallTile(ctx, from, wagon);
  return plan('rest', floor >= 0 ? floor : from);
}

function water(ctx: TickContext, from: TileIndex): TileIndex {
  const m = ctx.world.map;
  if (!m.validIndex(from)) return -1;
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let dy = -32; dy <= 32; dy += 1) for (let dx = -32; dx <= 32; dx += 1) {
    const t = m.offset(from, dx, dy, 0);
    if (t < 0 || m.fluidLevelAt(t) < 1 || m.fluidTypeAt(t) !== FluidType.Water) continue;
    const stand = standBeside(ctx, from, t);
    const d = distance(ctx, from, stand);
    if (d < bestDistance) { best = stand; bestDistance = d; }
  }
  return best;
}

function standBeside(ctx: TickContext, from: TileIndex, source: TileIndex): TileIndex {
  const map = ctx.world.map;
  const choices: TileIndex[] = [];
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    if (dx === 0 && dy === 0) continue;
    const at = map.offset(source, dx, dy, 0);
    if (at >= 0 && ctx.readers.map.isWalkable(at, 'walker')) choices.push(at);
  }
  return nearest(ctx, from, choices);
}

export class Activities {
  readonly plans = new Map<EntityId, ActivityPlan>();

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
        const candidates = its.findItems({ drinkable: true }, 128, from, 'walker', { reservable: true });
        const drink = candidates.find((x) => {
          const container = its.containerOf(x);
          return container !== 0 && its.containerRecord(container)?.classId === 'barrel'
            && its.stockpileAt(its.tileOf(x)) !== 0;
        }) ?? 0;
        if (drink !== 0) {
          const record = its.get(drink);
          const one = record !== undefined && record.count > 1 ? ctx.world.services.items.split(drink, 1) : drink;
          const target = its.tileOf(one);
          if (target >= 0) { ctx.world.services.items.reserve(one, id); p = plan(need, target, { itemId: one }); }
        }
      }
      if (p === null) {
        const br = buildings(ctx);
        const wells = br?.wells().filter((x) => br.wellWorking(x)) ?? [];
        const target = br === null ? -1 : nearest(ctx, from, wells.map((x) => standBeside(ctx, from, br.get(x)?.origin ?? -1)));
        p = target >= 0 ? plan(need, target) : (water(ctx, from) >= 0 ? plan(need, water(ctx, from)) : null);
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
      const target = socialTile(ctx, from);
      const rel = ctx.world.entities.get(id, C.Relationships);
      const peers = dwarves.filter((x) => x !== id && tile(ctx, x) >= 0);
      peers.sort((a, c) => Number(rel?.friends.includes(c) ?? false) - Number(rel?.friends.includes(a) ?? false)
        || distance(ctx, from, tile(ctx, a)) - distance(ctx, from, tile(ctx, c)) || a - c);
      const partner = peers[0] ?? 0;
      if (partner !== 0 && target >= 0) p = plan(need, target, { partner });
    } else if (need === 'comfort') {
      const s = seat(ctx, from, false);
      const target = s?.tile ?? nearest(ctx, from, buildings(ctx)?.hearthHallTiles() ?? []);
      if (target >= 0) p = plan(need, target, { roomTier: s?.tier ?? 0 });
    } else if (need === 'joy') {
      const target = nearest(ctx, from, buildings(ctx)?.hearthHallTiles() ?? []);
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
        if (result === 'unreachable') { this.cancel(ctx, id); return true; }
        return false;
      }
      if (p.need === 'social' && distance(ctx, at, tile(ctx, p.partner)) > 2) {
        if (p.until === 0) p.until = ctx.tick + SOCIAL_WAIT_TICKS;
        if (ctx.tick >= p.until) { this.cancel(ctx, id); return true; }
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
        : p.need === 'social' ? TALK_TICKS : p.need === 'comfort' ? SIT_TICKS
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
      if (ctx.world.entities.alive(partner) && distance(ctx, at, tile(ctx, partner)) <= 2) {
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
