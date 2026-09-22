/**
 * Tame animals: `02-systems/08-animals-and-domestication.md` § Tame behavior, § Pastures and
 * feeding, § Breeding, § Products, § Pets, § Slaughter, and `algorithms/creature-brains.md`
 * § Animal brain (the `T:` branch).
 *
 * ```
 * brain:   a pet far from its dwarf follows it; a grazer over condition 40 walks to grass inside
 *          its pasture (or within 6 with none) and eats it; otherwise it wanders near the pasture
 * hourly:  condition += CONDITION_PER_HOUR (×2 in a cold snap); 100 → AnimalStarving once per
 *          season; ANIMAL_STARVE_DAYS at 100 → CreatureDied { starvation }
 * daily:   pregnancies come due (AnimalBorn, juveniles); breeding rolls under the breeding cap;
 *          product timers (milk, wool, eggs in a nest box) and their hatching
 * seasonal: each cat that is not a pet adopts a dwarf with ADOPT_PERMILLE (PetAdopted)
 * ```
 *
 * `08` owns `Tame`; grass is 07's, so a grazed tile is handed over, never written here (D-089).
 */

import { C, type Tame } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import {
  ADOPT_PERMILLE,
  ANIMAL_STARVE_DAYS,
  BREED_PERMILLE,
  BREED_RADIUS,
  CONDITION_PER_GRASS,
  CONDITION_PER_HOUR,
  GRAZE_SEARCH_RADIUS,
  PET_FOLLOW_RADIUS,
  WAR_ANIMAL_RADIUS,
} from './constants';
import { fleeTile, grassNear, tileOf, type BrainHost } from './brain';

/** `08` § Pastures and feeding: "at 100 the animal is `starving`". */
export const CONDITION_MAX = 100;
/** `creature-brains.md`: "if `T.condition > 40` … walkTo(grass)". */
export const CONDITION_EAT_ABOVE = 40;

export interface TameHost extends BrainHost {
  /** The tiles of a pasture zone, or an empty list. */
  pastureTiles(zoneId: EntityId): readonly TileIndex[];
  /** The idle anchor for a tame animal with no pasture: the hearth hall, else the wagon tile. */
  homeTile(): TileIndex;
  /** `06` weather: a cold snap doubles the condition rise. */
  isColdSnap(): boolean;
}

export function tameOf(host: BrainHost, id: EntityId): Tame | undefined {
  return host.entities.get(id, C.Tame);
}

/** A grass tile a tame grazer may eat: inside its pasture, or within 6 tiles with no pasture. */
export function grassForTame(host: TameHost, id: EntityId, t: Tame): TileIndex {
  const at = tileOf(host, id);
  if (at < 0) return -1;
  if (t.pastureId === 0) return grassNear(host, at, GRAZE_SEARCH_RADIUS);
  let best = -1;
  let bestD = Number.MAX_SAFE_INTEGER;
  const map = host.map;
  for (const tile of host.pastureTiles(t.pastureId)) {
    if (!map.hasFlag(tile, TileFlag.Grass) || map.hasFlag(tile, TileFlag.Snow)) continue;
    const d = Math.max(Math.abs(map.xOf(tile) - map.xOf(at)), Math.abs(map.yOf(tile) - map.yOf(at)));
    if (d >= bestD) continue;
    bestD = d;
    best = tile;
  }
  return best;
}

/** One think of a tame animal. */
export function thinkTame(host: TameHost, ctx: TickContext, id: EntityId, t: Tame): Tame {
  const next: Tame = { ...t, lastProductTick: { ...t.lastProductTick } };
  const at = tileOf(host, id);
  if (at < 0) return next;
  const movement = host.movement;
  const species = host.entities.get(id, C.Creature)?.species ?? 0;
  const hostiles = host.readers.spatial.inRadiusWhere(at, host.facts.perceptionOf(species), (other) => {
    const creature = host.entities.get(other, C.Creature);
    const to = tileOf(host, other);
    return creature !== undefined && creature.faction.startsWith('hostile') && to >= 0 && host.map.zOf(to) === host.map.zOf(at) && host.readers.pathing.lineOfSight(at, to);
  });
  if (next.trained === 'war') {
    const station = next.assignedTo === 0 ? at : tileOf(host, next.assignedTo);
    const target = hostiles.find((other) => {
      const to = tileOf(host, other);
      return station >= 0 && Math.max(Math.abs(host.map.xOf(to) - host.map.xOf(station)), Math.abs(host.map.yOf(to) - host.map.yOf(station))) <= WAR_ANIMAL_RADIUS;
    });
    if (target !== undefined) {
      host.setTarget(id, target);
      return next;
    }
  }
  if (host.facts.temperOf(species) === 'timid' && hostiles.length > 0) {
    const away = fleeTile(host, id, hostiles);
    if (away >= 0) movement?.walkTo(id, away, 'flee', ctx);
    return next;
  }

  // A pet follows its dwarf loosely (within `PET_FOLLOW_RADIUS`).
  if (next.petOf !== 0 || next.assignedTo !== 0) {
    const owner = next.petOf !== 0 ? next.petOf : next.assignedTo;
    const to = tileOf(host, owner);
    if (to >= 0) {
      const d = Math.max(Math.abs(host.map.xOf(to) - host.map.xOf(at)), Math.abs(host.map.yOf(to) - host.map.yOf(at)));
      if (d > PET_FOLLOW_RADIUS) {
        movement?.walkTo(id, to, 'wander', ctx);
        return next;
      }
    }
  }

  // A hungry grazer eats.
  if (host.facts.dietOf(species) === 'grazer' && next.condition > CONDITION_EAT_ABOVE) {
    const inPasture = next.pastureId === 0 || host.pastureTiles(next.pastureId).includes(at);
    if (inPasture && host.map.hasFlag(at, TileFlag.Grass) && !host.map.hasFlag(at, TileFlag.Snow)) {
      host.grazed(at);
      next.condition = Math.max(0, next.condition - CONDITION_PER_GRASS);
      movement?.stopWalking(id);
      return next;
    }
    const grass = grassForTame(host, id, next);
    if (grass >= 0) {
      movement?.walkTo(id, grass, 'wander', ctx);
      return next;
    }
  }

  // Otherwise it stays in its pasture, or near the hearth.
  const tiles = next.pastureId === 0 ? [] : host.pastureTiles(next.pastureId);
  if (tiles.length > 0) {
    if (!tiles.includes(at)) movement?.walkTo(id, tiles[host.rng.int(0, tiles.length - 1)] as TileIndex, 'wander', ctx);
    else movement?.stopWalking(id);
    return next;
  }
  const home = host.homeTile();
  if (home >= 0 && movement !== null && movement.tileOf(id) !== home) movement.walkTo(id, home, 'wander', ctx);
  return next;
}

/** `08` § Pastures and feeding: the hourly condition rise, ×2 in a cold snap. */
export function conditionRise(coldSnap: boolean): number {
  return coldSnap ? CONDITION_PER_HOUR * 2 : CONDITION_PER_HOUR;
}

/** The ticks an animal must stay at `CONDITION_MAX` before it dies. */
export const STARVE_TICKS = ANIMAL_STARVE_DAYS * TICKS_PER_DAY;

/** `08` § Breeding: an adult of the species, not a juvenile. */
export function isAdult(t: Tame, tick: number): boolean {
  return t.juvenileUntil <= tick;
}

/** The breeding roll of one eligible female (`BREED_PERMILLE` per day). */
export function breedRadiusOk(host: TameHost, a: EntityId, b: EntityId, samePasture: boolean): boolean {
  if (samePasture) return true;
  const pa = tileOf(host, a);
  const pb = tileOf(host, b);
  if (pa < 0 || pb < 0) return false;
  const map = host.map;
  return Math.max(Math.abs(map.xOf(pa) - map.xOf(pb)), Math.abs(map.yOf(pa) - map.yOf(pb))) <= BREED_RADIUS;
}

export { ADOPT_PERMILLE, BREED_PERMILLE };
