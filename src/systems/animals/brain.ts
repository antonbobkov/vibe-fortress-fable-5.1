/**
 * The wild animal brain: `02-systems/08-animals-and-domestication.md` § Perception and brains,
 * § Wild behavior, and `04-implementation/algorithms/creature-brains.md` § Animal brain.
 *
 * ```
 * tickAnimal(id):
 *   if tick < lastThink + thinkInterval(id): moveAlongPath(id); return
 *   lastThink = tick; threats = perceivedThreats(id)
 *   idle:   threats → flee; aggressive carnivore and hungry with a quarry → hunt (the pack's
 *           quarry, else the nearest animal prey, else the nearest dwarf); territorial with a
 *           dwarf within TERRITORY_RADIUS → attack; rest time → sleep; grazer with grass within 6
 *           → graze; else wander
 *   graze:  walk to grass; on arrival GrassGrazed, wait GRAZE_TICKS, idle
 *   wander: walk to a random tile within WANDER_RADIUS of the home chunk; on arrival or timeout idle
 *   flee:   the tile of 8 directions × 6 steps that maximises the distance to the threats; an edge
 *           within perception means leave; FLEE_TICKS without a threat means idle
 *   hunt:   combat.setTarget(prey) (16 resolves it); no longer hungry (the pack has eaten) → idle
 *   attack: 16 drives; the target dead or lost means idle (a kill ends the hunger); a defending
 *           attack (provoked, not hunting) breaks off into wander when its target is beyond the
 *           provoke radius of the tile where the attack began, or unconscious
 *   eat:    walk to the saved corpse; wait EAT_CORPSE_TICKS there, consume through 13, idle
 *   sleep:  stay until stateUntil; a threat wakes it; struck (wakeStruck): below the flee percent
 *           flee the striker unless aggressive, territorial defend against it from its tile, else idle
 *   leave:  walk to the nearest edge tile; despawn on arrival (AnimalLeft)
 * ```
 *
 * The brain reads the map and the spatial index and writes only `Wild` and the mover's path; the
 * tile a grazer clears is handed to 07, which owns grass (D-089).
 */

import { C, type Wild } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { GameEvent } from '@core/events';
import { CHUNK_SIZE } from '@core/constants';
import { TileFlag, type Map3D } from '@core/map3d';
import type { RngStream } from '@core/rng';
import type { MovementApi, ReaderSetLike, TickContext } from '@core/system';
import type { EntityId, MovementClass, TileIndex } from '@core/types';
import {
  APPROACH_RADIUS,
  ATTACK_PERCEPTION_GRACE_TICKS,
  EAT_CORPSE_TICKS,
  FLEE_BLOOD_PERCENT,
  FLEE_SAMPLE_DIRECTIONS,
  FLEE_SAMPLE_STEPS,
  FLEE_TICKS,
  GRAZE_SEARCH_RADIUS,
  GRAZE_TICKS,
  IDLE_MAX_TICKS,
  IDLE_MIN_TICKS,
  NEAR_DWARF_RADIUS,
  PREY_PACK_MAX_MEMBERS,
  PREY_SIZE_PERMILLE,
  SLEEP_TICKS,
  TERRITORY_RADIUS,
  WANDER_RADIUS,
  WANDER_TIMEOUT_TICKS,
  WILD_THINK_TICKS,
} from './constants';
import type { AnimalFacts } from './facts';

/** `08` § Wild behavior: the nine states. */
export type WildState = 'idle' | 'graze' | 'wander' | 'flee' | 'hunt' | 'attack' | 'eat' | 'sleep' | 'leave';

export const WILD_STATES: readonly WildState[] = Object.freeze([
  'idle',
  'graze',
  'wander',
  'flee',
  'hunt',
  'attack',
  'eat',
  'sleep',
  'leave',
]);

/** The eight directions the flee sample walks. */
const DIRECTIONS: readonly (readonly [number, number])[] = Object.freeze([
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
]);

export interface BrainHost {
  farWildThinkTicks?(): number;
  readonly map: Map3D;
  readonly entities: EntityStore;
  readonly facts: AnimalFacts;
  readonly rng: RngStream;
  readonly readers: ReaderSetLike;
  readonly movement: MovementApi | null;
  /** Daylight now; a diurnal species rests at night, a nocturnal one by day. */
  isDaylight(): boolean;
  /** 16's targeting. A stub until M6 records the call (`08` § Wild behavior). */
  setTarget(id: EntityId, targetId: EntityId): void;
  targetOf?(id: EntityId): EntityId;
  /** The creature that attacked this one, or 0 (a `neutral` animal fears only that). */
  provokedBy(id: EntityId): EntityId;
  /** 07 owns grass: the tile a grazer cleared is handed over, not written here. */
  grazed(tile: TileIndex): void;
  /** `AnimalLeft` and the entity's removal. */
  despawn(id: EntityId): void;
  /**
   * T-446: the home chunk a territorial surface animal keeps: `chunk` itself when its centre lies
   * farther than `TERRITORY_AVOID_RADIUS` from the fortress, else the nearest chunk on its level
   * that does, or -1 when none does.
   */
  homeAwayFromFortress?(chunk: number): number;
}

export function tileOf(host: BrainHost, id: EntityId): TileIndex {
  const p = host.entities.get(id, C.Position);
  return p === undefined ? -1 : host.map.index(p.x, p.y, p.z);
}

function speciesOf(host: BrainHost, id: EntityId): number {
  return host.entities.get(id, C.Creature)?.species ?? 0;
}

export function movementClassOf(host: BrainHost, id: EntityId): MovementClass {
  return host.entities.get(id, C.Motion)?.movementClass ?? 'walker';
}

/** `08` § Perception and brains: `1` near a dwarf, `WILD_THINK_TICKS` otherwise. */
export function thinkInterval(host: BrainHost, id: EntityId): number {
  const at = tileOf(host, id);
  const farInterval = host.farWildThinkTicks?.() ?? WILD_THINK_TICKS;
  if (at < 0) return farInterval;
  return nearestDwarf(host, at, NEAR_DWARF_RADIUS) === 0 ? farInterval : 1;
}

function isDwarf(host: BrainHost, id: EntityId): boolean {
  return host.entities.has(id, C.Brain) && host.entities.get(id, C.Creature)?.faction === 'fortress';
}

function isHostile(host: BrainHost, id: EntityId): boolean {
  return (host.entities.get(id, C.Creature)?.faction ?? '').startsWith('hostile');
}

export function nearestDwarf(host: BrainHost, at: TileIndex, radius: number): EntityId {
  const found = host.readers.spatial.inRadius(at, radius, 'creature').filter((other) => isDwarf(host, other));
  for (const id of found) if (visible(host, at, id)) return id;
  return 0;
}

/** Perception: the same z-level, inside the radius, with a line of sight (`08` § Perception). */
function visible(host: BrainHost, at: TileIndex, other: EntityId): boolean {
  const to = tileOf(host, other);
  if (to < 0 || host.map.zOf(to) !== host.map.zOf(at)) return false;
  return host.readers.pathing.lineOfSight(at, to);
}

/**
 * `08` § Wild behavior: "a *threat* is any creature of a faction the species fears: for `timid`,
 * dwarves, hostiles and carnivores; for `neutral`, anything that attacked it; for `territorial`,
 * nothing; for `aggressive` carnivores", dwarves only inside `APPROACH_RADIUS`.
 */
export function perceivedThreats(host: BrainHost, id: EntityId): EntityId[] {
  const at = tileOf(host, id);
  if (at < 0) return [];
  const species = speciesOf(host, id);
  const temper = host.facts.temperOf(species);
  if (temper === 'territorial') return [];
  if (temper === 'neutral' || temper === 'aggressive') {
    const attacker = host.provokedBy(id);
    return attacker !== 0 && visible(host, at, attacker) ? [attacker] : [];
  }
  const radius = host.facts.perceptionOf(species);
  const out: EntityId[] = [];
  for (const other of host.readers.spatial.inRadius(at, radius, 'creature')) {
    const otherSpecies = speciesOf(host, other);
    if (otherSpecies === 0) continue;
    const scary = isDwarf(host, other) || isHostile(host, other) || host.facts.dietOf(otherSpecies) === 'carnivore';
    if (!scary || other === id) continue;
    if (!visible(host, at, other)) continue;
    out.push(other);
  }
  return out;
}

/** The candidate nearest to `at` (Chebyshev distance, then ascending id), or 0. */
function nearestOf(host: BrainHost, at: TileIndex, ids: readonly EntityId[]): EntityId {
  let best: EntityId = 0;
  let bestD = Number.MAX_SAFE_INTEGER;
  for (const id of ids) {
    const d = chebyshev(host, at, tileOf(host, id));
    if (d < bestD || (d === bestD && id < best)) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

/** An animal (wild or tame) within this predator pack's current prey-size limit. */
function isAnimalPrey(host: BrainHost, id: EntityId, other: EntityId): boolean {
  if (!host.entities.has(other, C.Wild) && !host.entities.has(other, C.Tame)) return false;
  const s = speciesOf(host, other);
  if (s === 0 || host.facts.dietOf(s) === 'carnivore') return false;
  const species = speciesOf(host, id);
  const singleLimit = (host.facts.sizeOf(species) * PREY_SIZE_PERMILLE) / 1000;
  const size = host.facts.sizeOf(s);
  if (size >= singleLimit * PREY_PACK_MAX_MEMBERS) return false;
  const quarryTile = tileOf(host, other);
  if (quarryTile < 0) return false;
  const radius = host.facts.perceptionOf(species);
  let members = 0;
  for (const member of [id, ...packOf(host, id)]) {
    if (!host.entities.alive(member)) continue;
    const at = tileOf(host, member);
    if (at < 0 || chebyshev(host, at, quarryTile) > radius || !visible(host, at, other)) continue;
    members += 1;
    if (members === PREY_PACK_MAX_MEMBERS) break;
  }
  return size < singleLimit * members;
}

function isHuntQuarry(host: BrainHost, id: EntityId, target: EntityId): boolean {
  return isDwarf(host, target) || isAnimalPrey(host, id, target);
}

/**
 * `08` § Wild behavior: a *pack* is the wild animals of one species that arrived on the map in the
 * same group (the same species and the same `arrivedTick`). The other living members, ascending id.
 */
export function packOf(host: BrainHost, id: EntityId): EntityId[] {
  const w = host.entities.get(id, C.Wild);
  const species = speciesOf(host, id);
  if (w === undefined || species === 0) return [];
  return host.entities.with(C.Wild).filter((other) => other !== id && host.entities.alive(other) &&
    speciesOf(host, other) === species && host.entities.get(other, C.Wild)?.arrivedTick === w.arrivedTick);
}

/** The quarry a hungry member of the pack is hunting (`hunt`, or an `attack` a hunt led to), or 0. */
export function packQuarry(host: BrainHost, id: EntityId): EntityId {
  for (const mate of packOf(host, id)) {
    const w = host.entities.get(mate, C.Wild);
    if (w === undefined || !w.hungry) continue;
    if (w.state !== 'hunt' && !(w.state === 'attack' && w.defendFrom === undefined)) continue;
    const quarry = host.targetOf ? host.targetOf(mate) : 0;
    if (quarry !== 0 && host.entities.alive(quarry)) return quarry;
  }
  return 0;
}

/**
 * `08` § Wild behavior, the hungry predator's quarry: the quarry its pack already hunts, if it
 * perceives it (else none); otherwise the nearest animal prey in perception, wild or tame; a dwarf
 * in perception only when no animal prey is.
 */
export function findHuntTarget(host: BrainHost, id: EntityId): EntityId {
  const at = tileOf(host, id);
  if (at < 0) return 0;
  const species = speciesOf(host, id);
  const radius = host.facts.perceptionOf(species);
  const shared = packQuarry(host, id);
  if (shared !== 0) {
    const to = tileOf(host, shared);
    return to >= 0 && chebyshev(host, at, to) <= radius && visible(host, at, shared) &&
      isHuntQuarry(host, id, shared) ? shared : 0;
  }
  const near = host.readers.spatial.inRadius(at, radius, 'creature').filter((o) => o !== id && host.entities.alive(o));
  const prey = near.filter((o) => visible(host, at, o) && isAnimalPrey(host, id, o));
  if (prey.length > 0) return nearestOf(host, at, prey);
  return nearestOf(host, at, near.filter((o) => isDwarf(host, o) && visible(host, at, o)));
}

/** "sleep if it is the species' rest time (night for diurnal, day for nocturnal)". */
export function isRestTime(host: BrainHost, species: number): boolean {
  return host.facts.isNocturnal(species) === host.isDaylight();
}

/** A grass tile within `radius` on the animal's level, nearest first, or -1. */
export function grassNear(host: BrainHost, at: TileIndex, radius: number, skip?: (tile: TileIndex) => boolean): TileIndex {
  const map = host.map;
  const x = map.xOf(at);
  const y = map.yOf(at);
  const z = map.zOf(at);
  let best = -1;
  let bestD = radius + 1;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (!map.inBounds(x + dx, y + dy, z)) continue;
      const i = map.index(x + dx, y + dy, z);
      if (!map.hasFlag(i, TileFlag.Grass)) continue;
      if (map.hasFlag(i, TileFlag.Snow)) continue;
      if (skip !== undefined && skip(i)) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d >= bestD) continue;
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function isEdgeTile(map: Map3D, i: TileIndex): boolean {
  const x = map.xOf(i);
  const y = map.yOf(i);
  return x === 0 || y === 0 || x === map.w - 1 || y === map.h - 1;
}

/** The nearest map-edge tile on the animal's level, in a straight line, that it can reach (T-427), or -1. */
export function edgeTile(host: BrainHost, id: EntityId): TileIndex {
  const map = host.map;
  const at = tileOf(host, id);
  if (at < 0) return -1;
  const cls = movementClassOf(host, id);
  const x = map.xOf(at);
  const y = map.yOf(at);
  const z = map.zOf(at);
  const candidates: TileIndex[] = [map.index(0, y, z), map.index(map.w - 1, y, z), map.index(x, 0, z), map.index(x, map.h - 1, z)];
  let best = -1;
  let bestD = Number.MAX_SAFE_INTEGER;
  for (const c of candidates) {
    if (!host.readers.pathing.passable(c, cls)) continue;
    const d = Math.max(Math.abs(map.xOf(c) - x), Math.abs(map.yOf(c) - y));
    if (d >= bestD || !host.readers.pathing.reachable(at, c, cls)) continue;
    bestD = d;
    best = c;
  }
  return best;
}

/** An edge tile within the animal's perception (`flee` turns into `leave`). */
export function edgeWithinPerception(host: BrainHost, id: EntityId): boolean {
  const map = host.map;
  const at = tileOf(host, id);
  if (at < 0) return false;
  const r = host.facts.perceptionOf(speciesOf(host, id));
  const x = map.xOf(at);
  const y = map.yOf(at);
  return x <= r || y <= r || x >= map.w - 1 - r || y >= map.h - 1 - r;
}

/** `creature-brains.md` `flee`: the sampled tile that maximises the distance to the threats. */
export function fleeTile(host: BrainHost, id: EntityId, threats: readonly EntityId[]): TileIndex {
  const map = host.map;
  const at = tileOf(host, id);
  if (at < 0 || threats.length === 0) return -1;
  const cls = movementClassOf(host, id);
  const x = map.xOf(at);
  const y = map.yOf(at);
  const z = map.zOf(at);
  const spots = threats.map((t) => tileOf(host, t)).filter((t) => t >= 0);
  let best = -1;
  let bestScore = -1;
  for (let d = 0; d < FLEE_SAMPLE_DIRECTIONS; d += 1) {
    const dir = DIRECTIONS[d] as readonly [number, number];
    for (let step = 1; step <= FLEE_SAMPLE_STEPS; step += 1) {
      const nx = x + dir[0] * step;
      const ny = y + dir[1] * step;
      if (!map.inBounds(nx, ny, z)) break;
      const i = map.index(nx, ny, z);
      if (!host.readers.pathing.passable(i, cls)) break;
      let score = 0;
      for (const s of spots) score += Math.max(Math.abs(map.xOf(s) - nx), Math.abs(map.yOf(s) - ny));
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
  }
  return best;
}

/** The middle tile of a chunk, the anchor `Wild.homeChunk` stands for. */
export function chunkCentre(map: Map3D, chunk: number): TileIndex {
  const perLevel = map.chunksPerRow * map.chunksPerCol;
  if (chunk < 0 || chunk >= perLevel * map.d) return -1;
  const z = Math.floor(chunk / perLevel);
  const rest = chunk % perLevel;
  const x = Math.min(map.w - 1, (rest % map.chunksPerRow) * CHUNK_SIZE + (CHUNK_SIZE >> 1));
  const y = Math.min(map.h - 1, Math.floor(rest / map.chunksPerRow) * CHUNK_SIZE + (CHUNK_SIZE >> 1));
  return map.index(x, y, z);
}

/** A random walkable tile within `WANDER_RADIUS` of the home chunk, or -1. */
export function wanderTile(host: BrainHost, id: EntityId, home: number): TileIndex {
  const map = host.map;
  const at = tileOf(host, id);
  if (at < 0) return -1;
  const cls = movementClassOf(host, id);
  const centre = chunkCentre(map, home);
  const anchor = centre < 0 ? at : centre;
  const x = map.xOf(anchor);
  const y = map.yOf(anchor);
  const z = map.zOf(at);
  for (let tries = 0; tries < 8; tries += 1) {
    const nx = x + host.rng.int(-WANDER_RADIUS, WANDER_RADIUS);
    const ny = y + host.rng.int(-WANDER_RADIUS, WANDER_RADIUS);
    if (!map.inBounds(nx, ny, z)) continue;
    const i = map.index(nx, ny, z);
    if (host.readers.pathing.passable(i, cls)) return i;
  }
  return -1;
}

function walk(host: BrainHost, ctx: TickContext, id: EntityId, target: TileIndex): 'pending' | 'moving' | 'arrived' | 'unreachable' {
  const movement = host.movement;
  if (movement === null || target < 0) return 'unreachable';
  if (tileOf(host, id) === target) return 'arrived';
  return movement.walkTo(id, target, 'wander', ctx);
}

/** One think of a wild animal; the caller writes the returned record back. */
export function thinkWild(host: BrainHost, ctx: TickContext, id: EntityId, w: Wild): Wild {
  const next: Wild = { ...w, lastThinkTick: ctx.tick };
  const species = speciesOf(host, id);
  const at = tileOf(host, id);
  if (at < 0) return next;
  const temper = host.facts.temperOf(species);
  const threats = perceivedThreats(host, id);
  // 13 creates the corpse during death dispatch; CorpseCreated arrives next tick.
  if (next.pendingMeal !== undefined) return next;
  if (next.mealId !== undefined && ['idle', 'wander', 'hunt'].includes(next.state)) {
    next.state = 'eat'; next.stateUntil = 0;
    host.setTarget(id, 0); host.movement?.stopWalking(id);
  }

  // Ground away from the fortress (T-446): a territorial animal moves its home off the fortress, or leaves.
  if (temper === 'territorial' && host.homeAwayFromFortress !== undefined && host.facts.row(species)?.cavern === undefined &&
      (next.state === 'idle' || next.state === 'graze' || next.state === 'wander' || next.state === 'sleep')) {
    const home = host.homeAwayFromFortress(next.homeChunk);
    if (home < 0) {
      delete next.defendFrom; delete next.unseenSince;
      next.state = 'leave';
      host.movement?.stopWalking(id);
      walk(host, ctx, id, edgeTile(host, id));
      return next;
    }
    if (home !== next.homeChunk) {
      next.homeChunk = home;
      delete next.defendFrom; delete next.unseenSince;
      next.state = 'wander';
      next.stateUntil = ctx.tick + WANDER_TIMEOUT_TICKS;
      host.movement?.stopWalking(id);
      walk(host, ctx, id, wanderTile(host, id, home));
      return next;
    }
  }

  switch (next.state as WildState) {
    case 'idle': {
      if (threats.length > 0) {
        startFlee(host, ctx, id, next, threats);
        break;
      }
      if (temper === 'aggressive' && host.facts.dietOf(species) === 'carnivore' && next.hungry) {
        const huntTarget = findHuntTarget(host, id);
        if (huntTarget !== 0) {
          next.state = 'hunt';
          host.setTarget(id, huntTarget);
          break;
        }
      }
      // "for `territorial`, … any dwarf within `TERRITORY_RADIUS` triggers `attack`"; an
      // aggressive animal "ignores dwarves unless approached within 3 tiles".
      const provokeRadius = temper === 'territorial' ? TERRITORY_RADIUS : temper === 'aggressive' ? APPROACH_RADIUS : 0;
      if (provokeRadius > 0) {
        const dwarf = nearestDwarf(host, at, provokeRadius);
        if (dwarf !== 0) {
          next.state = 'attack';
          next.defendFrom = at;
          host.setTarget(id, dwarf);
          break;
        }
      }
      if (ctx.tick < next.stateUntil) break;
      if (isRestTime(host, species)) {
        next.state = 'sleep';
        next.stateUntil = ctx.tick + SLEEP_TICKS;
        break;
      }
      const grass = host.facts.dietOf(species) === 'grazer' ? grassNear(host, at, GRAZE_SEARCH_RADIUS) : -1;
      if (grass >= 0) {
        next.state = 'graze';
        next.stateUntil = ctx.tick + GRAZE_TICKS + IDLE_MAX_TICKS;
        walk(host, ctx, id, grass);
        break;
      }
      next.state = 'wander';
      next.stateUntil = ctx.tick + WANDER_TIMEOUT_TICKS;
      walk(host, ctx, id, wanderTile(host, id, next.homeChunk));
      break;
    }
    case 'graze': {
      if (threats.length > 0) {
        startFlee(host, ctx, id, next, threats);
        break;
      }
      if (host.map.hasFlag(at, TileFlag.Grass)) {
        host.grazed(at);
        toIdle(host, ctx, id, next);
        break;
      }
      const grass = grassNear(host, at, GRAZE_SEARCH_RADIUS);
      if (grass < 0 || ctx.tick >= next.stateUntil || walk(host, ctx, id, grass) === 'unreachable') toIdle(host, ctx, id, next);
      break;
    }
    case 'wander': {
      if (threats.length > 0) {
        startFlee(host, ctx, id, next, threats);
        break;
      }
      const target = host.movement?.walkTarget(id) ?? -1;
      if (ctx.tick >= next.stateUntil || target < 0 || walk(host, ctx, id, target) !== 'moving') toIdle(host, ctx, id, next);
      break;
    }
    case 'flee': {
      if (edgeWithinPerception(host, id)) {
        next.state = 'leave';
        walk(host, ctx, id, edgeTile(host, id));
        break;
      }
      if (threats.length === 0) {
        if (ctx.tick >= next.stateUntil) toIdle(host, ctx, id, next);
        break;
      }
      next.stateUntil = ctx.tick + FLEE_TICKS;
      walk(host, ctx, id, fleeTile(host, id, threats));
      break;
    }
    case 'hunt': {
      if (!next.hungry) {
        // The pack's kill ended the hunger (index.ts).
        toIdle(host, ctx, id, next);
        host.setTarget(id, 0);
        break;
      }
      let target = host.targetOf ? host.targetOf(id) : 0;
      if (target === 0 || !host.entities.alive(target)) {
        target = findHuntTarget(host, id);
      }
      if (target === 0 || !host.entities.alive(target) || !isHuntQuarry(host, id, target)) {
        toIdle(host, ctx, id, next);
        host.setTarget(id, 0);
        break;
      }
      host.setTarget(id, target);
      const to = tileOf(host, target);
      if (to < 0 || host.map.zOf(to) !== host.map.zOf(at)) {
        toIdle(host, ctx, id, next);
        host.setTarget(id, 0);
        break;
      }
      const dx = Math.abs(host.map.xOf(to) - host.map.xOf(at));
      const dy = Math.abs(host.map.yOf(to) - host.map.yOf(at));
      if (Math.max(dx, dy) <= 1) {
        next.state = 'attack';
      } else {
        walk(host, ctx, id, to);
      }
      break;
    }
    case 'attack': {
      if (woundedToFlee(host, id)) {
        const currentTarget = host.targetOf ? host.targetOf(id) : 0;
        host.setTarget(id, 0);
        startFlee(host, ctx, id, next, currentTarget !== 0 ? [currentTarget] : threats);
        break;
      }
      const target = host.targetOf ? host.targetOf(id) : 0;
      if (target === 0 || !host.entities.alive(target)) {
        // "the animal returns to `idle` when the target dies" (a kill ends the hunger: index.ts).
        toIdle(host, ctx, id, next);
        host.setTarget(id, 0);
        break;
      }
      if (next.hungry && next.defendFrom === undefined && !isHuntQuarry(host, id, target)) {
        toIdle(host, ctx, id, next);
        host.setTarget(id, 0);
        break;
      }
      // An attack loaded from before the field existed: a fed animal was defending where it stands.
      if (next.defendFrom === undefined && !next.hungry) next.defendFrom = at;
      const to = tileOf(host, target);
      if (next.defendFrom !== undefined) {
        // A defending animal drives the intruder out and leaves a beaten one alone.
        const from = next.defendFrom;
        const radius = temper === 'aggressive' ? APPROACH_RADIUS : TERRITORY_RADIUS;
        const out = host.map.zOf(to) !== host.map.zOf(from) || chebyshev(host, to, from) > radius;
        if (out || host.entities.get(target, C.Body)?.conscious === false) {
          host.setTarget(id, 0);
          breakOff(host, ctx, id, next);
          break;
        }
      }
      const seen = to >= 0 && host.map.zOf(to) === host.map.zOf(at) &&
        chebyshev(host, to, at) <= host.facts.perceptionOf(species) && visible(host, at, target);
      if (seen) delete next.unseenSince;
      else {
        next.unseenSince ??= ctx.tick;
        if (ctx.tick - next.unseenSince >= ATTACK_PERCEPTION_GRACE_TICKS) {
          toIdle(host, ctx, id, next); host.setTarget(id, 0); break;
        }
      }
      host.setTarget(id, target);
      break;
    }
    case 'eat': {
      const meal = next.mealId;
      const pos = meal === undefined ? undefined : host.entities.get(meal, C.Position);
      if (meal === undefined || pos === undefined || !host.entities.has(meal, C.Corpse)) {
        delete next.mealId; toIdle(host, ctx, id, next); break;
      }
      const mealTile = host.map.index(pos.x, pos.y, pos.z);
      if (at !== mealTile) {
        next.stateUntil = 0;
        if (walk(host, ctx, id, mealTile) === 'unreachable') {
          delete next.mealId; toIdle(host, ctx, id, next);
        }
      } else if (next.stateUntil === 0) {
        host.movement?.stopWalking(id);
        next.stateUntil = ctx.tick + EAT_CORPSE_TICKS;
      } else if (ctx.tick >= next.stateUntil) {
        ctx.world.services.items?.consume(meal, 1);
        delete next.mealId; toIdle(host, ctx, id, next);
      }
      break;
    }
    case 'sleep': {
      // A sleeper struck wakes at once, on the strike's AttackResolved (wakeStruck, T-535).
      if (threats.length > 0) {
        startFlee(host, ctx, id, next, threats);
        break;
      }
      if (ctx.tick >= next.stateUntil) toIdle(host, ctx, id, next);
      break;
    }
    case 'leave': {
      // The edge tile chosen for this leave is kept while the walk to it lasts (T-427): picked again
      // from each tile, the nearest edge changed with the animal's row, and where the way winds the
      // animal walked to and fro between two edge tiles.
      const walking = host.movement?.walkTarget(id) ?? -1;
      const edge = walking >= 0 && isEdgeTile(host.map, walking) ? walking : edgeTile(host, id);
      if (edge < 0 || walk(host, ctx, id, edge) === 'arrived' || isEdgeTile(host.map, at)) host.despawn(id);
      break;
    }
    default:
      toIdle(host, ctx, id, next);
      break;
  }
  return next;
}

/**
 * `08` § Wild behavior: wounded animals (blood below the species' `flee` percent, defaulting to
 * 16's `FLEE_BLOOD_PERCENT`) flee unless `aggressive` (a species percent applies to any temper).
 */
function woundedToFlee(host: BrainHost, id: EntityId): boolean {
  const species = speciesOf(host, id);
  const body = host.entities.get(id, C.Body);
  const fleeThresh = host.facts.fleeBloodPercentOf(species) ?? (host.facts.temperOf(species) === 'aggressive' ? null : FLEE_BLOOD_PERCENT);
  if (!body || body.maxBlood <= 0 || fleeThresh === null) return false;
  return (body.blood / body.maxBlood) * 100 < fleeThresh;
}

/**
 * `08` § Wild behavior, `sleep` (T-535): an animal attacked in its sleep wakes at once. Below its
 * flee percent it flees the striker unless aggressive, as in `attack`; a territorial one defends
 * against the striker from its own tile, as `idle`'s provoke rule starts a defence; any other
 * wakes to `idle`, where its threats decide. Called on `AttackResolved` against the animal; a
 * record not in `sleep` is returned unchanged.
 */
export function wakeStruck(host: BrainHost, ctx: TickContext, id: EntityId, w: Wild, striker: EntityId): Wild {
  if (w.state !== 'sleep') return w;
  const next: Wild = { ...w };
  const at = tileOf(host, id);
  if (woundedToFlee(host, id)) {
    host.setTarget(id, 0);
    startFlee(host, ctx, id, next, striker !== 0 ? [striker] : []);
  } else if (at >= 0 && striker !== 0 && host.entities.alive(striker) &&
      host.facts.temperOf(speciesOf(host, id)) === 'territorial') {
    next.state = 'attack';
    next.defendFrom = at;
    delete next.unseenSince;
    host.setTarget(id, striker);
  } else {
    toIdle(host, ctx, id, next);
  }
  return next;
}

function chebyshev(host: BrainHost, a: TileIndex, b: TileIndex): number {
  const map = host.map;
  return Math.max(Math.abs(map.xOf(a) - map.xOf(b)), Math.abs(map.yOf(a) - map.yOf(b)));
}

/** A defending animal lets go and wanders; a `wander` ignores dwarves until it ends. */
function breakOff(host: BrainHost, ctx: TickContext, id: EntityId, w: Wild): void {
  delete w.defendFrom;
  delete w.unseenSince;
  w.state = 'wander';
  w.stateUntil = ctx.tick + WANDER_TIMEOUT_TICKS;
  host.movement?.stopWalking(id);
  walk(host, ctx, id, wanderTile(host, id, w.homeChunk));
}

function toIdle(host: BrainHost, ctx: TickContext, id: EntityId, w: Wild): void {
  delete w.defendFrom;
  delete w.unseenSince;
  w.state = 'idle';
  w.stateUntil = ctx.tick + host.rng.int(IDLE_MIN_TICKS, IDLE_MAX_TICKS);
  host.movement?.stopWalking(id);
}

function startFlee(host: BrainHost, ctx: TickContext, id: EntityId, w: Wild, threats: readonly EntityId[]): void {
  const from = threats.length > 0 ? (threats[0] as EntityId) : 0;
  delete w.defendFrom;
  delete w.unseenSince;
  ctx.emit({ type: 'CreatureFled', id, from });
  if (edgeWithinPerception(host, id)) {
    w.state = 'leave';
    walk(host, ctx, id, edgeTile(host, id));
    return;
  }
  w.state = 'flee';
  w.stateUntil = ctx.tick + FLEE_TICKS;
  walk(host, ctx, id, fleeTile(host, id, threats));
}

/** The per-tick entry point (`creature-brains.md` `tickAnimal`). */
export function tickAnimal(host: BrainHost, ctx: TickContext, id: EntityId): void {
  const w = host.entities.get(id, C.Wild);
  if (w === undefined) return;
  const deadlineDue = (w.state === 'eat' && w.stateUntil > 0 && ctx.tick >= w.stateUntil) ||
    (w.state === 'attack' && w.unseenSince !== undefined && ctx.tick >= w.unseenSince + ATTACK_PERCEPTION_GRACE_TICKS);
  if (deadlineDue || ctx.tick >= w.lastThinkTick + thinkInterval(host, id)) {
    host.entities.add(id, C.Wild, thinkWild(host, ctx, id, w));
  }
  host.movement?.moveAlongPath(id, ctx);
}

/** The event an animal that walked off the map leaves behind. */
export function animalLeftEvent(id: EntityId, species: string): GameEvent {
  return { type: 'AnimalLeft', id, species } as GameEvent;
}

/** `APPROACH_RADIUS` is re-exported so the table-driven state test can name it. */
export { APPROACH_RADIUS };
