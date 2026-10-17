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
import type { EntityId, Tick, TileIndex } from '@core/types';
import {
  ADOPT_PERMILLE,
  ANIMAL_STARVE_DAYS,
  BREED_PERMILLE,
  BREED_RADIUS,
  CONDITION_PER_GRASS,
  CONDITION_PER_HOUR,
  GRAZE_SEARCH_RADIUS,
  GRAZE_SKIP_TICKS,
  PET_FOLLOW_RADIUS,
  WAR_ANIMAL_RADIUS,
} from './constants';
import { fleeTile, grassNear, movementClassOf, tileOf, type BrainHost } from './brain';
import type { BuildingsReader } from '../buildings/reader';

export function isDoorTile(host: BrainHost, tile: TileIndex): boolean {
  if (tile < 0 || !host.readers.has('14')) return false;
  return host.readers.of<BuildingsReader>('14').doorAt(tile);
}

export function findStepOffDoorTile(
  host: BrainHost,
  doorTile: TileIndex,
  headingToTile: TileIndex = -1,
): TileIndex {
  const map = host.map;
  const pathing = host.readers.pathing;
  const buildings = host.readers.has('14') ? host.readers.of<BuildingsReader>('14') : null;
  const x = map.xOf(doorTile);
  const y = map.yOf(doorTile);
  const z = map.zOf(doorTile);

  const deltas: readonly [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
  ];

  const targetX = headingToTile >= 0 ? map.xOf(headingToTile) : -1;
  const targetY = headingToTile >= 0 ? map.yOf(headingToTile) : -1;

  let bestTile = -1;
  let bestScore = Infinity;

  for (const [dx, dy] of deltas) {
    const nx = x + dx;
    const ny = y + dy;
    if (!map.inBounds(nx, ny, z)) continue;
    const nTile = map.index(nx, ny, z);
    if (buildings && buildings.doorAt(nTile)) continue;
    if (!pathing.passable(nTile, 'walker', { tame: true })) continue;

    let score = 0;
    if (headingToTile >= 0) {
      const dist = Math.max(Math.abs(nx - targetX), Math.abs(ny - targetY));
      const isDiag = Math.abs(dx) === 1 && Math.abs(dy) === 1;
      score = dist * 10 + (isDiag ? 1 : 0);
    } else {
      const isDiag = Math.abs(dx) === 1 && Math.abs(dy) === 1;
      score = isDiag ? 1 : 0;
    }

    if (score < bestScore) {
      bestScore = score;
      bestTile = nTile;
    }
  }

  return bestTile;
}

export function stepOffDoor(
  host: BrainHost,
  id: EntityId,
  doorTile: TileIndex,
  headingToTile: TileIndex = -1,
  ctx: TickContext,
): void {
  const stepOff = findStepOffDoorTile(host, doorTile, headingToTile);
  if (stepOff >= 0) {
    host.movement?.walkTo(id, stepOff, 'wander', ctx);
  }
}

/** `08` § Pastures and feeding: "at 100 the animal is `starving`". */
export const CONDITION_MAX = 100;
/** `creature-brains.md`: "if `T.condition > 40` … walkTo(grass)". */
export const CONDITION_EAT_ABOVE = 40;

export interface TameHost extends BrainHost {
  /** The tiles of a pasture zone, or an empty list. */
  pastureTiles(zoneId: EntityId): readonly TileIndex[];
  /** The idle anchor for a tame animal with no pasture: the hearth hall, else the wagon tile. */
  homeTile(): TileIndex;
  /** One grass tile feeds one grazer: `true` when this call took the tile, `false` when it is already held. */
  claimGraze(tile: TileIndex): boolean;
  /** A tile some grazer holds until 07 has cleared its grass. */
  grazeClaimed(tile: TileIndex): boolean;
  /** True while this grazer passes over the tile because its walk there came back unreachable. */
  grazeSkipped(animalId: EntityId, tile: TileIndex, tick: Tick): boolean;
  /** This grazer passes over the tile until `until`. */
  skipGraze(animalId: EntityId, tile: TileIndex, until: Tick): void;
  /** `06` weather: a cold snap doubles the condition rise. */
  isColdSnap(): boolean;
  /** 19 § War animals: chain, squad or hearth entrance. */
  stationTile(animalId: EntityId, assignedTo: EntityId): TileIndex;
}

export function tameOf(host: BrainHost, id: EntityId): Tame | undefined {
  return host.entities.get(id, C.Tame);
}

/**
 * The grass a grazer passes over: a tile in another region of its movement class (shut in by trees), a tile
 * a grazer holds, and a tile its last walk found unreachable (behind a `no_pets` door, which the regions,
 * computed without a faction, do not show). An animal with no region of its own (label 0) shuts nothing out.
 */
function passedOver(host: TameHost, id: EntityId, tick: Tick): (tile: TileIndex) => boolean {
  const at = tileOf(host, id);
  const cls = movementClassOf(host, id);
  const region = at < 0 ? 0 : host.readers.pathing.labelOf(at, cls);
  return (tile) => host.grazeClaimed(tile) || host.grazeSkipped(id, tile, tick) ||
    (region !== 0 && host.readers.pathing.labelOf(tile, cls) !== region);
}

/**
 * A grass tile a tame grazer may eat and can reach: inside its pasture, or within 6 tiles with no
 * pasture; see {@link passedOver} for what it skips.
 */
export function grassForTame(host: TameHost, id: EntityId, t: Tame, tick: Tick): TileIndex {
  const at = tileOf(host, id);
  if (at < 0) return -1;
  const skip = passedOver(host, id, tick);
  if (t.pastureId === 0) return grassNear(host, at, GRAZE_SEARCH_RADIUS, skip);
  let best = -1;
  let bestD = Number.MAX_SAFE_INTEGER;
  const map = host.map;
  for (const tile of host.pastureTiles(t.pastureId)) {
    if (!map.hasFlag(tile, TileFlag.Grass) || map.hasFlag(tile, TileFlag.Snow) || skip(tile)) continue;
    const d = Math.max(Math.abs(map.xOf(tile) - map.xOf(at)), Math.abs(map.yOf(tile) - map.yOf(at)));
    if (d >= bestD) continue;
    bestD = d;
    best = tile;
  }
  return best;
}

/**
 * The tile a grazer is walking to is still grass for it: uneaten, unclaimed, not passed over, in its pasture
 * (or within 6 tiles with no pasture) and in its region.
 */
function grassStillFor(host: TameHost, id: EntityId, t: Tame, tile: TileIndex, tick: Tick): boolean {
  const map = host.map;
  if (!map.hasFlag(tile, TileFlag.Grass) || map.hasFlag(tile, TileFlag.Snow) || passedOver(host, id, tick)(tile)) return false;
  if (t.pastureId !== 0 && !host.pastureTiles(t.pastureId).includes(tile)) return false;
  const at = tileOf(host, id);
  if (at < 0) return false;
  return t.pastureId !== 0 || Math.max(Math.abs(map.xOf(tile) - map.xOf(at)), Math.abs(map.yOf(tile) - map.yOf(at))) <= GRAZE_SEARCH_RADIUS;
}

/** One think of a tame animal. */
export function thinkTame(host: TameHost, ctx: TickContext, id: EntityId, t: Tame): Tame {
  const next: Tame = { ...t, lastProductTick: { ...t.lastProductTick } };
  const at = tileOf(host, id);
  if (at < 0) return next;
  const movement = host.movement;
  const species = host.entities.get(id, C.Creature)?.species ?? 0;
  const hostiles = host.readers.spatial.inRadius(at, host.facts.perceptionOf(species), 'creature').filter((other) => {
    const creature = host.entities.get(other, C.Creature);
    const to = tileOf(host, other);
    return creature !== undefined && (creature.faction.startsWith('hostile') || creature.faction === 'deep') && to >= 0 && host.map.zOf(to) === host.map.zOf(at) && host.readers.pathing.lineOfSight(at, to);
  });
  if (next.trained === 'war') {
    const station = host.stationTile(id, next.assignedTo);
    const target = hostiles.find((other) => {
      const to = tileOf(host, other);
      return station >= 0 && Math.max(Math.abs(host.map.xOf(to) - host.map.xOf(station)), Math.abs(host.map.yOf(to) - host.map.yOf(station))) <= WAR_ANIMAL_RADIUS;
    });
    if (target !== undefined) {
      host.setTarget(id, target);
      return next;
    }
  }
  if (next.trained === 'hunting' && next.assignedTo !== 0) {
    const hunterTarget = host.targetOf ? host.targetOf(next.assignedTo) : 0;
    if (hunterTarget !== 0 && host.entities.alive(hunterTarget)) {
      host.setTarget(id, hunterTarget);
      return next;
    }
  }
  const station = host.stationTile(id, next.assignedTo);
  if (next.trained === 'war' && station >= 0) {
    const distance = Math.max(Math.abs(host.map.xOf(station) - host.map.xOf(at)), Math.abs(host.map.yOf(station) - host.map.yOf(at)));
    const limit = next.assignedTo !== 0 ? 1 : 0;
    if (host.map.zOf(station) !== host.map.zOf(at) || distance > limit) movement?.walkTo(id, station, 'wander', ctx);
    else if (isDoorTile(host, at)) stepOffDoor(host, id, at, station, ctx);
    else movement?.stopWalking(id);
    return next;
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
      } else if (d <= 2) {
        if (isDoorTile(host, at)) {
          stepOffDoor(host, id, at, to, ctx);
        } else {
          movement?.stopWalking(id);
        }
      } else if (isDoorTile(host, at)) {
        stepOffDoor(host, id, at, to, ctx);
      }
      return next;
    }
  }

  // A hungry grazer eats.
  if (host.facts.dietOf(species) === 'grazer' && next.condition > CONDITION_EAT_ABOVE) {
    const inPasture = next.pastureId === 0 || host.pastureTiles(next.pastureId).includes(at);
    if (inPasture && host.map.hasFlag(at, TileFlag.Grass) && !host.map.hasFlag(at, TileFlag.Snow) && host.claimGraze(at)) {
      next.condition = Math.max(0, next.condition - CONDITION_PER_GRASS);
      if (isDoorTile(host, at)) stepOffDoor(host, id, at, -1, ctx);
      else movement?.stopWalking(id);
      return next;
    }
    // A grazer keeps walking to the tile it is walking to while that tile is still grass for it: chosen
    // again by straight distance on every think, it would turn back and forth around an obstacle.
    const walking = movement?.walkTarget(id) ?? -1;
    const grass = walking >= 0 && grassStillFor(host, id, next, walking, ctx.tick) ? walking : grassForTame(host, id, next, ctx.tick);
    if (grass >= 0) {
      // A walk that comes back unreachable (a `no_pets` door in the way) is not tried again at once.
      if (movement?.walkTo(id, grass, 'wander', ctx) === 'unreachable') host.skipGraze(id, grass, ctx.tick + GRAZE_SKIP_TICKS);
      return next;
    }
  }

  // Otherwise it stays in its pasture, or near the hearth.
  const tiles = next.pastureId === 0 ? [] : host.pastureTiles(next.pastureId);
  if (tiles.length > 0) {
    if (!tiles.includes(at)) movement?.walkTo(id, tiles[host.rng.int(0, tiles.length - 1)] as TileIndex, 'wander', ctx);
    else if (isDoorTile(host, at)) stepOffDoor(host, id, at, -1, ctx);
    else movement?.stopWalking(id);
    return next;
  }
  const home = host.homeTile();
  if (home >= 0 && movement !== null && movement.tileOf(id) !== home) movement.walkTo(id, home, 'wander', ctx);
  else if (isDoorTile(host, at)) stepOffDoor(host, id, at, home, ctx);
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
