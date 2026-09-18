/**
 * Arrival: `02-systems/02-embark-and-loadout.md` § Arrival.
 *
 * T-M1-04 implements the steps that need no items or buildings: the wagon site (step 2, whose
 * tree clearing records the logs it owes), the dwarves adjacent to it (step 5), the Thane
 * (step 6), the calendar (step 7) and `Embarked` (step 8). The wagon building, the supplies and
 * the animals (steps 3 and 4) are wired by T-M2-08, which consumes {@link ArrivalResult.wagon},
 * {@link ArrivalResult.supplies} and {@link ArrivalResult.logDrops}.
 */

import { C } from '@core/components';
import { START_HOUR, TICKS_PER_HOUR, TICKS_PER_YEAR } from '@core/constants';
import { isSolidBottomed, TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { Registry } from '@core/registry';
import type { World } from '@core/world';
import type { EntityId, Edge, TileIndex } from '@core/types';
import type { DwarfRecord } from '@systems/dwarves/rules/make-dwarf';
import { dwarfComponents } from '@systems/dwarves/rules/components';
import { ARRIVAL_SEARCH_DEPTH } from './constants';
import type { LocalMapSpec } from './spec';
import type { SupplyLine } from './party';
import { thaneIndex } from './party';

/** `02` § Arrival step 5: "Needs start at 20 (mildly hungry, thirsty, rested)". */
export const ARRIVAL_NEEDS = 20;

/** The wagon's footprint side (`02` § Concepts: "a 3×3 building"). */
export const WAGON_SIZE = 3;

export interface WagonSite {
  /** Centre tile of the 3×3 patch. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Tiles whose trees had to be cleared; each owes its logs (M2). */
  readonly cleared: readonly TileIndex[];
}

/** The midpoint of an edge of the local map. */
export function edgeMidpoint(map: Map3D, edge: Edge): { x: number; y: number } {
  const mx = Math.floor(map.w / 2);
  const my = Math.floor(map.h / 2);
  switch (edge) {
    case 'n':
      return { x: mx, y: 0 };
    case 's':
      return { x: mx, y: map.h - 1 };
    case 'w':
      return { x: 0, y: my };
    case 'e':
      return { x: map.w - 1, y: my };
    default:
      return { x: mx, y: 0 };
  }
}

/** Distance of a tile from an edge, in tiles (0 on the edge row or column). */
function inward(map: Map3D, edge: Edge, x: number, y: number): number {
  return edge === 'n' ? y : edge === 's' ? map.h - 1 - y : edge === 'w' ? x : map.w - 1 - x;
}

function patchState(map: Map3D, cx: number, cy: number): { z: number; clear: boolean; treeTiles: TileIndex[] } | null {
  const z = map.columnSurfaceZ(cx, cy);
  if (z < 0) return null;
  const trees: TileIndex[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = cx + dx;
      const y = cy + dy;
      if (map.columnSurfaceZ(x, y) !== z) return null;
      const i = map.index(x, y, z);
      if (map.fluidLevelAt(i) > 0) return null;
      const kind = map.kindAt(i);
      if (kind === TileKind.Tree) trees.push(i);
      else if (kind !== TileKind.Floor) return null;
    }
  }
  return { z, clear: trees.length === 0, treeTiles: trees };
}

/**
 * Step 2: "the 3×3 patch of walkable surface tiles with no trees, nearest to the midpoint of the
 * `arrivalEdge`, searching inward up to `ARRIVAL_SEARCH_DEPTH` tiles; if none, clear trees from the
 * first candidate patch". A patch is nine `Floor` tiles on one surface level with no fluid (a
 * `Tree` tile counts as a candidate to clear); nearest is by squared distance of the centre, ties
 * by `(y, x)`. Returns `null` when no patch exists at all.
 */
export function findWagonSite(map: Map3D, edge: Edge): WagonSite | null {
  const mid = edgeMidpoint(map, edge);
  let best: { x: number; y: number; z: number; d: number } | null = null;
  let firstCandidate: { x: number; y: number; z: number; d: number; trees: TileIndex[] } | null = null;
  for (let cy = 1; cy < map.h - 1; cy += 1) {
    for (let cx = 1; cx < map.w - 1; cx += 1) {
      if (inward(map, edge, cx, cy) > ARRIVAL_SEARCH_DEPTH) continue;
      const state = patchState(map, cx, cy);
      if (state === null) continue;
      const d = (cx - mid.x) * (cx - mid.x) + (cy - mid.y) * (cy - mid.y);
      if (state.clear) {
        if (best === null || d < best.d) best = { x: cx, y: cy, z: state.z, d };
      } else if (firstCandidate === null || d < firstCandidate.d) {
        firstCandidate = { x: cx, y: cy, z: state.z, d, trees: state.treeTiles };
      }
    }
  }
  if (best !== null) return { x: best.x, y: best.y, z: best.z, cleared: [] };
  if (firstCandidate === null) return null;
  for (const i of firstCandidate.trees) {
    // A felled tree leaves floor (grass on soil), as `chop` does; the logs are owed (M2).
    map.setKind(i, TileKind.Floor, map.materialAt(map.below(i)));
    map.setFlag(i, TileFlag.Grass, true);
  }
  return { x: firstCandidate.x, y: firstCandidate.y, z: firstCandidate.z, cleared: firstCandidate.trees };
}

/** Walkable tiles around the wagon, ring by ring outward, each ring in `(y, x)` order. */
export function tilesAroundWagon(map: Map3D, site: WagonSite, want: number): TileIndex[] {
  const out: TileIndex[] = [];
  const half = Math.floor(WAGON_SIZE / 2);
  for (let ring = half + 1; out.length < want && ring < Math.max(map.w, map.h); ring += 1) {
    for (let y = site.y - ring; y <= site.y + ring; y += 1) {
      for (let x = site.x - ring; x <= site.x + ring; x += 1) {
        if (Math.max(Math.abs(x - site.x), Math.abs(y - site.y)) !== ring) continue;
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
        const z = map.columnSurfaceZ(x, y);
        if (z < 0) continue;
        const i = map.index(x, y, z);
        if (!isSolidBottomed(map.kindAt(i)) || map.fluidLevelAt(i) > 0) continue;
        out.push(i);
        if (out.length === want) return out;
      }
    }
  }
  return out;
}

/**
 * Creates one dwarf entity at a tile. The spawn API (`module-interfaces.md` § The spawn API) is
 * T-M1-11's; until then {@link basicDwarfSpawner} stands in (DECISIONS.md D-044).
 */
export type DwarfSpawner = (dwarf: DwarfRecord, at: TileIndex, title: 'none' | 'thane') => EntityId;

interface SpeciesRow {
  readonly id: string;
  readonly plan: string;
  readonly size: number;
}

/**
 * The stand-in spawner: a `creature` with `Position`, `Creature`, 10's components
 * (`dwarfComponents`), `Motion`, `Worker` and `Labors` (every labor on, step 5), from the record. `onPlaced` lets
 * the host index the new position (the headless game's spatial index).
 */
export function basicDwarfSpawner(
  world: World,
  onPlaced: (id: EntityId, at: TileIndex) => void = () => {},
): DwarfSpawner {
  const registry: Registry = world.registry;
  const species = registry.table<SpeciesRow>('creatures');
  const dwarf = species.byId('dwarf');
  if (dwarf === undefined) throw new RangeError('content has no dwarf species');
  const labors = registry.table('labors');
  return (record, at, title) => {
    const e = world.entities;
    const id = e.create('creature');
    const map = world.map;
    e.add(id, C.Position, { x: map.xOf(at), y: map.yOf(at), z: map.zOf(at) });
    e.add(id, C.Creature, {
      species: species.index('dwarf'),
      name: record.name,
      sex: record.sex,
      ageTicks: record.ageYears * TICKS_PER_YEAR,
      faction: 'fortress',
      sizeClass: dwarf.size,
      bodyPlan: registry.table('bodyPlans').index(dwarf.plan),
    });
    // 10's components (T-M1-09): Attributes, Skills, Needs, Personality, Schedule, Relationships,
    // Title and Brain, the sleep hour drawn from 10's stream (D-057).
    const parts = dwarfComponents(record, registry, world.rngFor('10'), title);
    e.add(id, C.Attributes, parts.attributes);
    e.add(id, C.Skills, parts.skills);
    e.add(id, C.Needs, parts.needs);
    e.add(id, C.Personality, parts.personality);
    e.add(id, C.Schedule, parts.schedule);
    e.add(id, C.Relationships, parts.relationships);
    e.add(id, C.Title, parts.title);
    e.add(id, C.Brain, parts.brain);
    e.add(id, C.Motion, { pathId: 0, stepIndex: 0, progress: 0, speed: 0, movementClass: 'walker', repathCount: 0, waitUntil: 0 });
    e.add(id, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: 0 });
    const enabled = new Uint8Array(((labors.size + 1) >> 3) + 1);
    for (let k = 1; k <= labors.size; k += 1) enabled[k >> 3] = (enabled[k >> 3] as number) | (1 << (k & 7));
    e.add(id, C.Labors, { enabled });
    onPlaced(id, at);
    return id;
  };
}

export interface ArrivalOptions {
  readonly fortressName: string;
  readonly supplies?: readonly SupplyLine[];
  readonly spawnDwarf?: DwarfSpawner;
}

export interface ArrivalResult {
  readonly wagon: WagonSite;
  readonly dwarves: readonly EntityId[];
  readonly thane: EntityId;
  /** Purchased supplies, spawned into the wagon by T-M2-08. */
  readonly supplies: readonly SupplyLine[];
  /** Tiles whose cleared trees owe logs (T-M2-08). */
  readonly logDrops: readonly TileIndex[];
}

/**
 * Steps 2, 5-8 of `02` § Arrival onto a world whose local map is already generated (step 1).
 * The Thane is chosen by Charm before spawning, so the title is written once.
 */
export function arrive(world: World, spec: LocalMapSpec, party: readonly DwarfRecord[], options: ArrivalOptions): ArrivalResult {
  const map = world.map;
  const wagon = findWagonSite(map, spec.arrivalEdge);
  if (wagon === null) throw new Error(`arrival: no wagon site within ${ARRIVAL_SEARCH_DEPTH} tiles of edge ${spec.arrivalEdge}`);

  const tiles = tilesAroundWagon(map, wagon, party.length);
  if (tiles.length < party.length) throw new Error('arrival: not enough walkable tiles around the wagon');
  const thane = thaneIndex(party.map((d) => d.attributes.cha));
  const spawn = options.spawnDwarf ?? basicDwarfSpawner(world);
  const dwarves = party.map((d, k) =>
    spawn({ ...d, needs: ARRIVAL_NEEDS }, tiles[k] as TileIndex, k === thane ? 'thane' : 'none'),
  );

  // Step 7: spring (START_SEASON), day 1, START_HOUR, year 1.
  const tick = START_HOUR * TICKS_PER_HOUR;
  world.calendar.setTick(tick);
  world.fortress.name = options.fortressName;
  world.fortress.embarkTick = tick;
  world.fortress.regionId = spec.regionId;

  // Step 8.
  world.events.emit({ type: 'Embarked', fortressName: options.fortressName, regionId: spec.regionId });

  return {
    wagon,
    dwarves,
    thane: dwarves[thane] as EntityId,
    supplies: [...(options.supplies ?? [])],
    logDrops: wagon.cleared,
  };
}
