/**
 * Arrival: `02-systems/02-embark-and-loadout.md` § Arrival.
 *
 * Steps 2-8 onto a generated map: the wagon site (step 2; cleared trees become logs on the
 * ground), the wagon building (step 3, placed by 14 through {@link ArrivalOptions.placeWagon}),
 * every purchased item inside the wagon's container and the animals, `Tame` with no pasture,
 * beside it (step 4), the dwarves adjacent to it (step 5), the Thane (step 6), the calendar
 * (step 7), `Embarked` (step 8); and the trait spawn list of the local map (stage 10 of 03: the
 * battlefield's items, the sunken halls' furniture and vault treasure). T-M2-08; D-076.
 */

import { START_HOUR, TICKS_PER_HOUR, TICKS_PER_YEAR } from '@core/constants';
import { isSolidBottomed, TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { Registry } from '@core/registry';
import type { World } from '@core/world';
import type { EntityId, Edge, TileIndex } from '@core/types';
import type { DwarfRecord } from '@systems/dwarves/rules/make-dwarf';
import { dwarfComponents } from '@systems/dwarves/rules/components';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import { ARRIVAL_SEARCH_DEPTH, WAGON_LOGS } from './constants';
import { TREE_LOGS_MAX, TREE_LOGS_MIN } from '@systems/terrain/constants';
import type { SpawnEntry } from '@systems/terrain/generate/common';
import { C, type Tame } from '@core/components';
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
  /** Tiles whose trees had to be cleared; each owes its logs. */
  readonly cleared: readonly TileIndex[];
  /** The tree species (the tile's material before clearing) of each cleared tile, in the same order. */
  readonly clearedSpecies?: readonly number[];
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
  const species = firstCandidate.trees.map((i) => map.materialAt(i));
  for (const i of firstCandidate.trees) {
    // A felled tree leaves floor (grass on soil), as `chop` does; `arrive` drops its logs.
    map.setKind(i, TileKind.Floor, map.materialAt(map.below(i)));
    map.setFlag(i, TileFlag.Grass, true);
  }
  return { x: firstCandidate.x, y: firstCandidate.y, z: firstCandidate.z, cleared: firstCandidate.trees, clearedSpecies: species };
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
 * Creates one dwarf entity at a tile (`02` § Arrival step 5: "Spawn the dwarves adjacent to the
 * wagon with all labors enabled").
 */
export type DwarfSpawner = (dwarf: DwarfRecord, at: TileIndex, title: 'none' | 'thane') => EntityId;

interface SpeciesRow {
  readonly id: string;
}

/**
 * The dwarf spawner of the arrival: `ctx.spawn.creature` (`module-interfaces.md` § The spawn API,
 * T-M1-11) with 10's components built from the record by `dwarfComponents`, the sleep hour drawn
 * from 10's stream (D-057). It replaces the stand-in of D-044.
 */
export function spawnApiDwarfSpawner(world: World): DwarfSpawner {
  const registry: Registry = world.registry;
  const species = registry.table<SpeciesRow>('creatures');
  if (species.byId('dwarf') === undefined) throw new RangeError('content has no dwarf species');
  const dwarf = species.index('dwarf');
  return (record, at, title) =>
    world.services.spawn.creature(dwarf, at, 'fortress', {
      name: record.name,
      sex: record.sex,
      ageTicks: record.ageYears * TICKS_PER_YEAR,
      child: record.ageYears < ADULT_AGE_YEARS,
      dwarf: dwarfComponents(record, registry, world.rngFor('10'), title),
    });
}

export interface ArrivalOptions {
  readonly fortressName: string;
  readonly supplies?: readonly SupplyLine[];
  readonly spawnDwarf?: DwarfSpawner;
  /**
   * 14's wagon placement (step 3): builds the wagon around its centre with the logs it yields and
   * returns its id. Without it (a world without 14) the supplies land on the wagon's centre tile.
   */
  readonly placeWagon?: (centre: TileIndex, logs: { type: string; material: number; count: number }) => EntityId;
  /** The local map's trait spawn list (`LocalMapResult.spawns`); its items are spawned. */
  readonly spawns?: readonly SpawnEntry[];
}

export interface ArrivalResult {
  readonly wagon: WagonSite;
  readonly dwarves: readonly EntityId[];
  readonly thane: EntityId;
  /** Purchased supplies, spawned into the wagon. */
  readonly supplies: readonly SupplyLine[];
  /** Tiles whose cleared trees left their logs on the ground. */
  readonly logDrops: readonly TileIndex[];
  /** The wagon building, or 0 without 14. */
  readonly wagonId: EntityId;
  /** The embark animals, in spawn order. */
  readonly animals: readonly EntityId[];
}

/**
 * The container item a catalog entry comes in (`embark-catalog.md`: "barrel of ale", "10 flour (in
 * a bag)"), made of the material the catalog sells that container in: the "empty barrel" is pine,
 * the "linen bag" flax cloth (D-076).
 */
export const SUPPLY_CONTAINER_MATERIAL: Readonly<Record<string, string>> = Object.freeze({ barrel: 'pine', bag: 'flax_cloth' });

/** The wagon is wooden; taking it apart yields `WAGON_LOGS` logs of this wood (D-076). */
export const WAGON_WOOD = 'pine';

interface CatalogRow {
  readonly id: string;
  readonly item?: string;
  readonly material?: string;
  readonly count?: number;
  readonly container?: string;
  readonly species?: string;
  readonly sex?: 0 | 1;
  readonly trained?: 'war' | 'hunting';
}

interface PlantRow {
  readonly id: string;
  readonly logs?: readonly number[];
  readonly yieldMaterial?: string;
}

/** A new tame animal's `Tame` (`08` § State): no pasture, fed, untrained unless bought trained. */
export function arrivalTame(trained: 'none' | 'war' | 'hunting'): Tame {
  return {
    pastureId: 0,
    condition: 0,
    trained,
    assignedTo: 0,
    pregnantUntil: 0,
    lastProductTick: {},
    juvenileUntil: 0,
    slaughter: false,
    petOf: 0,
    noBreed: false,
  };
}

/**
 * The animals a supply list buys, in list order: species, sex and training. An entry's explicit
 * sex wins; a unit of several animals ("3 chickens and a rooster") is females then one male;
 * single animals of one line alternate female, male ("pairs breed"). D-076.
 */
export function supplyAnimals(registry: Registry, supplies: readonly SupplyLine[]): { species: string; sex: 0 | 1; trained: 'none' | 'war' | 'hunting' }[] {
  const table = registry.table<CatalogRow>('embarkCatalog');
  const out: { species: string; sex: 0 | 1; trained: 'none' | 'war' | 'hunting' }[] = [];
  for (const line of supplies) {
    const row = table.byId(line.entry);
    if (row?.species === undefined) continue;
    const per = row.count ?? 1;
    for (let u = 0; u < line.count; u += 1) {
      for (let k = 0; k < per; k += 1) {
        const sex: 0 | 1 = row.sex !== undefined ? row.sex : per > 1 ? (k === per - 1 ? 0 : 1) : u % 2 === 0 ? 1 : 0;
        out.push({ species: row.species, sex, trained: row.trained ?? 'none' });
      }
    }
  }
  return out;
}

/** Step 4: every purchased item, into the wagon's container (or onto `tile` without a wagon). */
export function spawnSupplies(world: World, supplies: readonly SupplyLine[], wagonId: EntityId, tile: TileIndex): EntityId[] {
  const registry = world.registry;
  const table = registry.table<CatalogRow>('embarkCatalog');
  const items = registry.table('items');
  const materials = registry.table('materials');
  const spawn = world.services.spawn;
  const into = (at: EntityId): TileIndex | { containerId: EntityId } => (at === 0 ? tile : { containerId: at });
  const made: EntityId[] = [];
  for (const line of supplies) {
    const row = table.byId(line.entry);
    if (row === undefined) throw new RangeError(`arrival: unknown catalog entry ${line.entry}`);
    if (row.item === undefined || row.material === undefined) continue;
    const type = items.index(row.item);
    const material = materials.index(row.material);
    for (let u = 0; u < line.count; u += 1) {
      let holder = wagonId;
      if (row.container !== undefined) {
        const cMat = SUPPLY_CONTAINER_MATERIAL[row.container];
        if (cMat === undefined) throw new RangeError(`arrival: no material for a ${row.container}`);
        const c = spawn.item(items.index(row.container), materials.index(cMat), into(wagonId), 1);
        made.push(c);
        holder = c;
      }
      made.push(spawn.item(type, material, holder === 0 ? tile : { containerId: holder }, row.count ?? 1));
    }
  }
  return made;
}

/** The logs a cleared tree leaves: the species' `logs` range (clamped as 03's `chop`), drawn from 02's stream. */
function treeLogs(world: World, species: number): { material: number; count: number } | null {
  const plants = world.registry.table<PlantRow>('plants');
  const row = plants.byIndex(species);
  if (row === undefined) return null;
  const lo = Math.max(TREE_LOGS_MIN, row.logs?.[0] ?? TREE_LOGS_MIN);
  const hi = Math.min(TREE_LOGS_MAX, Math.max(lo, row.logs?.[1] ?? lo));
  const materials = world.registry.table('materials');
  const wood = row.yieldMaterial ?? row.id;
  if (!materials.has(wood)) return null;
  return { material: materials.index(wood), count: world.rngFor('02').int(lo, hi) };
}

/** The item entries of a local map's trait spawn list (creatures belong to 08 and 18). */
export function spawnTraitItems(world: World, spawns: readonly SpawnEntry[]): EntityId[] {
  const items = world.registry.table('items');
  const materials = world.registry.table('materials');
  const out: EntityId[] = [];
  for (const s of spawns) {
    if (s.kind !== 'item' || s.material === undefined) continue;
    if (!items.has(s.type) || !materials.has(s.material)) throw new RangeError(`arrival: trait spawn ${s.type} of ${s.material}`);
    out.push(world.services.spawn.item(items.index(s.type), materials.index(s.material), s.tile, 1, s.quality ?? 1));
  }
  return out;
}

/**
 * Steps 2-8 of `02` § Arrival onto a world whose local map is already generated (step 1).
 * The Thane is chosen by Charm before spawning, so the title is written once.
 */
export function arrive(world: World, spec: LocalMapSpec, party: readonly DwarfRecord[], options: ArrivalOptions): ArrivalResult {
  const map = world.map;
  const registry = world.registry;
  const wagon = findWagonSite(map, spec.arrivalEdge);
  if (wagon === null) throw new Error(`arrival: no wagon site within ${ARRIVAL_SEARCH_DEPTH} tiles of edge ${spec.arrivalEdge}`);
  const centre = map.index(wagon.x, wagon.y, wagon.z);
  // Step 7's calendar first, so that everything the arrival makes is made at the arrival's tick.
  const tick = START_HOUR * TICKS_PER_HOUR;
  world.calendar.setTick(tick);

  // Step 2: the cleared trees "become logs on the ground".
  const logType = registry.table('items').index('log');
  wagon.cleared.forEach((i, k) => {
    const logs = treeLogs(world, wagon.clearedSpecies?.[k] ?? 0);
    if (logs !== null && logs.count > 0) world.services.spawn.item(logType, logs.material, i, logs.count);
  });

  // Step 3: the wagon; step 4: the supplies inside it, the animals beside it.
  const supplies = [...(options.supplies ?? [])];
  const wagonId = options.placeWagon?.(centre, { type: 'log', material: registry.table('materials').index(WAGON_WOOD), count: WAGON_LOGS }) ?? 0;
  spawnSupplies(world, supplies, wagonId, centre);
  const animalsWanted = supplyAnimals(registry, supplies);
  const tiles = tilesAroundWagon(map, wagon, party.length + animalsWanted.length);
  if (tiles.length < party.length) throw new Error('arrival: not enough walkable tiles around the wagon');
  const species = registry.table('creatures');
  const animals = animalsWanted.map((a, k) => {
    const at = (tiles[party.length + k] ?? tiles[k % Math.max(1, tiles.length)]) as TileIndex;
    const id = world.services.spawn.creature(species.index(a.species), at, 'fortress', { sex: a.sex });
    world.entities.add(id, C.Tame, arrivalTame(a.trained));
    return id;
  });

  // Step 5: the dwarves, on the first tiles around the wagon; step 6: the Thane.
  const thane = thaneIndex(party.map((d) => d.attributes.cha));
  const spawn = options.spawnDwarf ?? spawnApiDwarfSpawner(world);
  const dwarves = party.map((d, k) =>
    spawn({ ...d, needs: ARRIVAL_NEEDS }, tiles[k] as TileIndex, k === thane ? 'thane' : 'none'),
  );

  // The local map's trait features: their items lie where generation put them.
  spawnTraitItems(world, options.spawns ?? []);

  // Step 7: spring (START_SEASON), day 1, START_HOUR, year 1 (the tick was set above).
  world.fortress.name = options.fortressName;
  world.fortress.embarkTick = tick;
  world.fortress.regionId = spec.regionId;

  // Step 8.
  world.events.emit({ type: 'Embarked', fortressName: options.fortressName, regionId: spec.regionId });

  return {
    wagon,
    dwarves,
    thane: dwarves[thane] as EntityId,
    supplies,
    logDrops: wagon.cleared,
    wagonId,
    animals,
  };
}
