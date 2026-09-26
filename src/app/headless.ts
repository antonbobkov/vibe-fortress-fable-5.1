/**
 * The headless runner.
 *
 * Implements `01-architecture/simulation-core.md` § Headless mode: a `World` with the full system
 * set and no platform, plus the `flat-test` map builder of
 * `04-implementation/acceptance-tests.md` (flat granite surface at z = 32, a three-level soil
 * layer, no river, no caverns) and the world hash of `simulation-core.md` § Determinism.
 *
 * The map builder follows the column rule of `algorithms/local-map-generation.md` § 3 with a flat
 * height map, so the real generator of T-M1-05 produces the same shapes; this builder stays
 * afterwards as the test fixture, exactly as T-M0-11 asks.
 */

import { contentRegistry } from '@content/loader';
import { LOCAL_MAP_H, LOCAL_MAP_W, LOCAL_MAP_Z, MAGMA_SEA_TOP_Z } from '@core/constants';
import { FluidType, Map3D, TileFlag, TileKind } from '@core/map3d';
import { MovementHelper } from '@core/movement';
import { PathingCore, type PathfinderOptions, type TerrainHooks } from '@core/pathfinding';
import { SpatialIndex } from '@core/spatial';
import { CoreSpawn } from '@core/spawn';
import { StateHasher } from '@core/serialize';
import { World, type WorldOptions } from '@core/world';
import { entityIndex } from '@core/entities';
import type { ComponentType } from '@core/entities';
import type { GameSystem } from '@core/system';
import type { Registry } from '@core/registry';
import {
  EmbarkSession,
  arrive,
  spawnApiDwarfSpawner,
  localMapSpec,
  type ArrivalOptions,
  type ArrivalResult,
  type LocalMapSpec,
} from '@systems/embark';
import { generateLocal, type LocalMapResult, type StackLayer } from '@systems/terrain/generate';
import { TerrainSystem } from '@systems/terrain';
import { JobsSystem } from '@systems/jobs';
import { DwarvesSystem } from '@systems/dwarves';
import { ItemsSystem } from '@systems/items';
import { BuildingsSystem } from '@systems/buildings';
import { MoraleSystem } from '@systems/morale';
import { WorkshopsSystem } from '@systems/workshops';
import { FluidsSystem } from '@systems/fluids';
import { MaterialsSystem } from '@systems/materials';
import { WeatherSystem } from '@systems/weather';
import { PlantsSystem } from '@systems/plants';
import { AnimalsSystem } from '@systems/animals';
import { ForagingSystem } from '@systems/foraging';
import { HealthSystem } from '@systems/health';
import { generate as generateWorld, type RegionRecord, type WorldMap } from '@systems/worldgen';
import { WORLD_SIZE_STANDARD } from '@core/constants';

/** `acceptance-tests.md`: the `flat-test` surface. */
export const FLAT_TEST_SURFACE_Z = 32;

/** `acceptance-tests.md`: "a 3-level soil layer". */
export const FLAT_TEST_SOIL_DEPTH = 3;

/** The rock every `flat-test` column is made of below the soil. */
export const FLAT_TEST_STONE = 'granite';

/** The soil of the three levels above it. */
export const FLAT_TEST_SOIL = 'loam';

/** The shell of the Sea of Fire (`local-map-generation.md` § 3). */
export const FLAT_TEST_MAGMA_SHELL = 'basalt';

function materialIndex(registry: Registry, id: string): number {
  return registry.table('materials').index(id);
}

/**
 * Build the `flat-test` local map straight into a `Map3D`.
 *
 * Columns follow `local-map-generation.md` § 3 with `top = FLAT_TEST_SURFACE_Z` everywhere and no
 * undulation: the Sea of Fire fills z ≤ `MAGMA_SEA_TOP_Z` behind a basalt rim and cap, granite
 * fills the rock, the top three solid levels are soil, and the topmost solid tile becomes the
 * walkable `Floor`. There is no river, no lake and no cavern; see DECISIONS.md D-027. A smaller
 * `w × h` builds the same columns on a compact map, for statistical scenarios (D-059).
 */
export function buildFlatTestMap(registry: Registry = contentRegistry(), w: number = LOCAL_MAP_W, h: number = LOCAL_MAP_H): Map3D {
  const map = new Map3D(w, h, LOCAL_MAP_Z);
  const stone = materialIndex(registry, FLAT_TEST_STONE);
  const soil = materialIndex(registry, FLAT_TEST_SOIL);
  const shell = materialIndex(registry, FLAT_TEST_MAGMA_SHELL);
  const magma = Map3D.packFluid(7, FluidType.Magma, false, true);
  const top = FLAT_TEST_SURFACE_Z;

  for (let z = 0; z < map.d; z += 1) {
    for (let y = 0; y < map.h; y += 1) {
      for (let x = 0; x < map.w; x += 1) {
        const i = map.index(x, y, z);
        if (z <= MAGMA_SEA_TOP_Z) {
          const rim = x < 2 || y < 2 || x >= map.w - 2 || y >= map.h - 2;
          if (rim) {
            map.kind[i] = TileKind.Wall;
            map.material[i] = shell;
          } else {
            map.kind[i] = TileKind.Open;
            map.fluid[i] = magma;
          }
        } else if (z === MAGMA_SEA_TOP_Z + 1) {
          map.kind[i] = TileKind.Wall;
          map.material[i] = shell;
        } else if (z > top) {
          map.kind[i] = TileKind.Open;
        } else if (z > top - FLAT_TEST_SOIL_DEPTH) {
          map.kind[i] = TileKind.Wall;
          map.material[i] = soil;
        } else {
          map.kind[i] = TileKind.Wall;
          map.material[i] = stone;
        }
      }
    }
  }

  // The column's top solid tile is the walkable surface, open to the sky and already seen.
  for (let y = 0; y < map.h; y += 1) {
    for (let x = 0; x < map.w; x += 1) {
      const i = map.index(x, y, top);
      map.kind[i] = TileKind.Floor;
      for (let z = top; z < map.d; z += 1) {
        const t = map.index(x, y, z);
        map.flags[t] = TileFlag.Outdoor | TileFlag.Discovered | TileFlag.Lit;
      }
    }
  }

  // Everything was written straight into the grids, so every chunk still needs its first pass.
  for (let c = 0; c < map.chunkCount; c += 1) {
    const rec = map.chunk(c);
    if (rec === undefined) continue;
    rec.dirtyRender = true;
    rec.dirtyPath = true;
  }
  return map;
}

/**
 * The rock stack of the `flat-test` map, top first: granite from under the soil down to the Sea of
 * Fire's roof (`FLAT_TEST_SURFACE_Z − FLAT_TEST_SOIL_DEPTH` down to `MAGMA_SEA_TOP_Z + 2`).
 */
export const FLAT_TEST_LAYERS: readonly StackLayer[] = Object.freeze([
  { material: FLAT_TEST_STONE, thickness: FLAT_TEST_SURFACE_Z - FLAT_TEST_SOIL_DEPTH - (MAGMA_SEA_TOP_Z + 1) },
]);

/**
 * The `LocalMapSpec` the `flat-test` map stands for: "a `serene_vale`-like region (peril 0,
 * wealth 2, temper 0)" (`acceptance-tests.md`). The arrival edge is north, the first of the
 * `n, e, s, w` edges (DECISIONS.md D-044).
 */
export const FLAT_TEST_SPEC: LocalMapSpec = Object.freeze({
  seed: 'flat-test',
  regionId: 0,
  biome: 'temperate_grassland',
  // The elevation whose base surface is FLAT_TEST_SURFACE_Z (see REGION_SPEC_ELEVATION).
  elevation: 158,
  relief: 0,
  soilDepth: FLAT_TEST_SOIL_DEPTH,
  geology: 'igneous',
  wealth: 2,
  peril: 0,
  temper: 0,
  deepness: 0,
  traits: Object.freeze(['serene_vale']),
  volcano: false,
  river: null,
  lake: false,
  civEdges: Object.freeze({ mountainhome: 'n', hillfolk: 'n', wildwood: 'n', gloam: 'n' }),
  arrivalEdge: 'n',
} as const);

/**
 * The region of a `'generated'` world: the first region in id order that can be embarked on
 * (DECISIONS.md D-046). Region id 0 is always sea (the continental mask), so "region 0" of a
 * seed in the plan means index 0 of the embarkable regions.
 */
export function defaultRegionId(world: WorldMap, registry: Registry): number {
  const biomes = registry.table<{ id: string; embarkable: boolean }>('biomes');
  const r = world.regions.find((reg) => biomes.byId(reg.biome)?.embarkable === true);
  if (r === undefined) throw new Error(`world ${world.seed} has no region that can be embarked on`);
  return r.id;
}

/** `world: 'generated'`: the standard world of the seed and its default region's spec. */
export function generatedSpec(seed: string, registry: Registry = contentRegistry()): LocalMapSpec {
  const world = generateWorld(seed, WORLD_SIZE_STANDARD, registry);
  return localMapSpec(world, defaultRegionId(world, registry), registry);
}

/** The elevation whose base surface is `FLAT_TEST_SURFACE_Z` (`03` § Local map generation stage 1). */
export const REGION_SPEC_ELEVATION = 158;

/**
 * `world: { region }`: a spec for a region record given in part, the rest from the flat-test
 * region of `acceptance-tests.md` ("a `serene_vale`-like region (peril 0, wealth 2, temper 0)
 * unless the test says otherwise"), seeded from the scenario seed (D-046).
 */
export function regionSpec(seed: string, region: Partial<RegionRecord>, registry: Registry = contentRegistry()): LocalMapSpec {
  const biome = region.biome ?? FLAT_TEST_SPEC.biome;
  const biomeRow = registry.table<{ id: string; soilDepth: number }>('biomes').byId(biome);
  if (biomeRow === undefined) throw new RangeError(`regionSpec: unknown biome ${biome}`);
  const river = region.river ?? null;
  const edges = region.nearestEdgeTo ?? FLAT_TEST_SPEC.civEdges;
  return Object.freeze({
    seed: `${seed}|region`,
    regionId: region.id ?? 0,
    biome,
    elevation: region.elevation ?? REGION_SPEC_ELEVATION,
    relief: 0,
    soilDepth: biomeRow.soilDepth,
    geology: region.geology ?? FLAT_TEST_SPEC.geology,
    wealth: region.wealth ?? FLAT_TEST_SPEC.wealth,
    peril: region.peril ?? FLAT_TEST_SPEC.peril,
    temper: region.temper ?? FLAT_TEST_SPEC.temper,
    deepness: region.deepness ?? FLAT_TEST_SPEC.deepness,
    traits: Object.freeze([...(region.traits ?? FLAT_TEST_SPEC.traits)]),
    volcano: region.volcano ?? false,
    river: river === null ? null : { inflowEdges: [...river.inflow], outflowEdge: river.outflow, class: river.class },
    lake: region.lake ?? false,
    civEdges: Object.freeze({ ...edges }),
    arrivalEdge: edges.mountainhome,
    ...(region.tempC === undefined ? {} : { tempC: region.tempC }),
  });
}

/**
 * The embark of a headless game: `'none'` (no dwarves), `'default'` (the Balanced preset,
 * `acceptance-tests.md`), or a named preset.
 */
export type HeadlessEmbark = 'none' | 'default' | { readonly preset: string } | { readonly session: EmbarkSession };

/** The preset `'default'` stands for. */
export const DEFAULT_EMBARK_PRESET = 'balanced';

export interface HeadlessOptions {
  readonly seed: string;
  readonly registry?: Registry;
  /**
   * `'flat-test'` builds the fixture map; `'empty'` leaves an all-open map for hand-built tests;
   * `'local'` generates the local map of `spec` (03).
   */
  readonly world?: 'flat-test' | 'empty' | 'local';
  /** A map built by the caller, used by the hand-built scenario fixtures. */
  readonly map?: Map3D;
  readonly fortressName?: string;
  /**
   * The systems to register. Omitted means the standard set of the milestones built so far
   * ({@link HeadlessGame.standardSystems}); given, it replaces that set, which is how the `core_*`
   * scenarios run with stand-in systems only (D-036).
   */
  readonly systems?: readonly GameSystem[];
  readonly hooks?: Partial<TerrainHooks>;
  readonly pathfinder?: PathfinderOptions;
  readonly startTick?: number;
  /** Omitted means `'none'` (DECISIONS.md D-029). */
  readonly embark?: HeadlessEmbark;
  /** The spec of the local map; the flat-test spec when omitted. */
  readonly spec?: LocalMapSpec;
  /** A loaded game labels its map once its buildings are restored (T-M2-11). */
  readonly deferLabels?: boolean;
  /**
   * The clock the scheduler times each system with (`host.stats()`); the performance smoke passes
   * `performance.now`. Omitted, every timing reads 0, as `core` may not read a clock itself.
   */
  readonly now?: () => number;
}

/**
 * A world with no platform: the core, the pathing stack and the movement helper, driven by
 * `step(n)`. The system set is empty in M0 and grows as the milestones add systems.
 */
export class HeadlessGame {
  readonly registry: Registry;
  readonly world: World;
  readonly pathing: PathingCore;
  readonly spatial: SpatialIndex;
  readonly movement: MovementHelper;
  /** What the arrival did, when there was an embark. */
  arrival: ArrivalResult | null;
  /** The generation result of a `'local'` world. */
  readonly local: LocalMapResult | null;
  /** The spawn API of the world (`module-interfaces.md` § The spawn API). */
  readonly spawn: CoreSpawn;
  /** 03 terrain, when the standard systems are registered. */
  readonly terrain: TerrainSystem | null;

  constructor(options: HeadlessOptions) {
    this.registry = options.registry ?? contentRegistry();
    let local: LocalMapResult | null = null;
    let map: Map3D;
    if (options.map !== undefined) {
      map = options.map;
    } else if (options.world === 'empty') {
      map = new Map3D();
    } else if (options.world === 'local') {
      if (options.spec === undefined) throw new Error("headless: world 'local' needs a spec");
      map = new Map3D();
      local = generateLocal(options.spec, map, this.registry);
    } else {
      map = buildFlatTestMap(this.registry);
    }
    this.local = local;
    const worldOptions: WorldOptions = {
      seed: options.seed,
      registry: this.registry,
      map,
      ...(options.fortressName === undefined ? {} : { fortressName: options.fortressName }),
      ...(options.startTick === undefined ? {} : { startTick: options.startTick }),
      ...(options.now === undefined ? {} : { now: options.now }),
    };
    this.world = new World(worldOptions);
    // The path cache of 22 is saved with 22's state, so the game runs with it (D-021, D-081).
    this.pathing = new PathingCore(map, options.hooks ?? {}, options.pathfinder ?? { cache: true }, options.deferLabels !== true);
    this.spatial = new SpatialIndex(map, this.world.entities);
    this.movement = new MovementHelper(map, this.world.entities, this.spatial, this.pathing);

    this.world.readers.register('pathing', this.pathing.reader());
    this.world.readers.register('spatial', this.spatial.reader());
    this.world.readers.setPassability((i, movementClass) => this.pathing.graph.passable(i, movementClass));
    this.world.readers.setTileEntities((i) => this.spatial.at(i));
    // The brains reach the movement helper through the world's services (D-049).
    this.world.services.movement = this.movement;
    // 13 places and lifts its items in the spatial index directly (D-068).
    this.world.services.spatial = this.spatial;
    // The spawn API (T-M1-11): creatures through the movement helper; items recorded until M2.
    this.spawn = new CoreSpawn(map, this.world.entities, this.registry, this.movement, () => this.world.calendar.tick);
    this.world.services.spawn = this.spawn;

    // The core phase between steps 2 and 3 of `tick-order.md`: the brains have run, so the move
    // batch goes out, the path queue is served within its budget, and the dirty chunks are
    // relabelled so that the labels are exact at the start of the next tick.
    this.world.connectivityPass = (): void => {
      this.movement.flushMoves((event) => this.world.events.emit(event));
      this.pathing.pathfinder.tick();
      this.pathing.onTickEnd();
    };

    const spec = options.spec ?? FLAT_TEST_SPEC;
    const systems = options.systems ?? HeadlessGame.standardSystems(spec, local?.layerStack ?? FLAT_TEST_LAYERS, local);
    for (const system of systems) this.world.addSystem(system);
    this.terrain = (systems.find((s) => s instanceof TerrainSystem) as TerrainSystem | undefined) ?? null;
    this.world.init();
    const terrain = this.terrain;
    if (terrain !== null) this.pathing.graph.hooks.forbidden = (i) => terrain.core.isForbidden(i);
    // 14's buildings block movement through 22's hook (T-M2-05), besides any hook the caller gave.
    const buildings = systems.find((s) => s instanceof BuildingsSystem) as BuildingsSystem | undefined;
    if (buildings !== undefined) {
      const hooks = this.pathing.graph.hooks;
      const given = hooks.blocksMovementAt;
      const store = buildings.buildings;
      hooks.blocksMovementAt = (i, cls, faction, mover) => given(i, cls, faction, mover) || store.blocksMovementAt(i, cls, faction, mover);
      // Doors, hatches and sight (T-M2-06), besides any hook the caller gave.
      const door = hooks.doorAt;
      const hatch = hooks.lockedHatchAt;
      const sight = hooks.blocksSightAt;
      hooks.doorAt = (i) => door(i) || store.doorAt(i);
      hooks.lockedHatchAt = (i) => hatch(i) || store.lockedHatchAt(i);
      hooks.blocksSightAt = (i) => sight(i) || store.blocksSightAt(i);
    }
    // A hostile that opens doors (the species flag `O`) passes an unlocked door (D-074).
    const species = this.registry.table<{ id: string; opensDoors?: boolean }>('creatures');
    this.movement.speciesOpensDoors = (s) => species.byIndex(s)?.opensDoors === true;
    this.arrival = this.embark(options.embark ?? 'none', options.spec ?? FLAT_TEST_SPEC, options.fortressName);
    // The arrival set the calendar to its hour after 06's `init`: 06 reads the hour again (D-103).
    if (this.arrival !== null) (systems.find((s) => s instanceof WeatherSystem) as WeatherSystem | undefined)?.refresh();
    // The idle anchor until there is a hearth hall: the wagon tile (`creature-brains.md`; D-057).
    const dwarves = systems.find((s) => s instanceof DwarvesSystem) as DwarvesSystem | undefined;
    if (dwarves !== undefined && this.arrival !== null) {
      const w = this.arrival.wagon;
      dwarves.wagonTile = this.map.index(w.x, w.y, w.z);
    }
  }

  /**
   * `simulation-core.md` § Startup sequence step 4 for a new game: the map exists, so 02's arrival
   * runs with the party of an embark session (`embark.party` stream of the world seed) and the
   * preset's skills and supplies.
   */
  private embark(embark: HeadlessEmbark, spec: LocalMapSpec, fortressName: string | undefined): ArrivalResult | null {
    if (embark === 'none') return null;
    let session: EmbarkSession;
    if (typeof embark === 'object' && 'session' in embark) {
      // The embark screen's session (T-M1-13): its party, supplies and fortress name as chosen.
      session = embark.session;
      return arrive(this.world, spec, session.party, {
        fortressName: fortressName ?? session.fortressName,
        supplies: session.supplies,
        spawnDwarf: spawnApiDwarfSpawner(this.world),
        ...this.arrivalHooks(),
      });
    }
    const preset = embark === 'default' ? DEFAULT_EMBARK_PRESET : embark.preset;
    session = new EmbarkSession(this.registry, this.world.seed, spec.peril);
    const applied = session.apply({ type: 'ApplyPreset', preset });
    if (!applied.ok) throw new Error(`headless embark: preset ${preset}: ${applied.reason ?? 'rejected'}`);
    return arrive(this.world, spec, session.party, {
      fortressName: fortressName ?? this.world.fortress.name,
      supplies: session.supplies,
      spawnDwarf: spawnApiDwarfSpawner(this.world),
      ...this.arrivalHooks(),
    });
  }

  /** 14 places the wagon (T-M2-08); the local map's trait spawn list is spawned. */
  private arrivalHooks(): Pick<ArrivalOptions, 'placeWagon' | 'spawns'> {
    const buildings = this.world.scheduler.inOrder().find((s) => s instanceof BuildingsSystem) as BuildingsSystem | undefined;
    return {
      ...(buildings === undefined ? {} : { placeWagon: (centre: number, logs: { type: string; material: number; count: number }) => buildings.buildings.placeWagon(centre, logs) }),
      spawns: this.local?.spawns ?? [],
    };
  }

  /**
   * The systems of the milestones built so far, in no particular order (the scheduler orders
   * them): 03 terrain (T-M1-07), 04 fluids (T-M3-01), 05 materials (T-M3-03), 06 weather (T-M3-06),
   * 07 plants (T-M4-01), 08 animals (T-M4-03), 10 dwarves, 11 jobs, 13 items (T-M2-01),
   * 14 buildings (T-M2-03). A generated map hands its river sinks to 04 and its warm springs to 05.
   */
  static standardSystems(
    spec: LocalMapSpec,
    layerStack: readonly StackLayer[],
    local: Pick<LocalMapResult, 'sinks' | 'warmSprings'> | null = null,
  ): GameSystem[] {
    return [
      new TerrainSystem({ spec, layerStack }),
      new FluidsSystem({ sinks: local?.sinks ?? [] }),
      new MaterialsSystem({ warmSprings: local?.warmSprings ?? [] }),
      new WeatherSystem({ spec }),
      new PlantsSystem({ spec }),
      new AnimalsSystem({ spec }),
      new ForagingSystem(),
      new DwarvesSystem(),
      new JobsSystem(),
      new WorkshopsSystem(),
      new ItemsSystem(),
      new BuildingsSystem(),
      new MoraleSystem(),
      new HealthSystem(),
    ];
  }

  get map(): Map3D {
    return this.world.map;
  }

  get tick(): number {
    return this.world.calendar.tick;
  }

  step(n = 1): void {
    this.world.run(n);
  }

  /** `simulation-core.md` § Determinism: grids, entities in id order, every system's state. */
  hash(): string {
    return worldHash(this);
  }
}

/**
 * The world hash: the `Map3D` grids, the entity tables in slot order with every component, the
 * calendar, the fortress state, every rng stream and every system's `serialize()` output.
 */
export function worldHash(game: HeadlessGame): string {
  const hasher = new StateHasher();
  const map = game.map;
  hasher.string('map');
  hasher.number(map.w).number(map.h).number(map.d);
  hasher.array(map.kind);
  hasher.array(map.material);
  hasher.array(map.fluid);
  hasher.array(map.designation);
  hasher.array(map.flags);
  hasher.array(map.tempOverride);
  const buildings = map.buildingEntries();
  hasher.number(buildings.length);
  for (let k = 0; k < buildings.length; k += 1) {
    const entry = buildings[k] as [number, number];
    hasher.number(entry[0]).number(entry[1]);
  }
  hasher.string('chunks');
  for (let c = 0; c < map.chunkCount; c += 1) hasher.number(map.chunk(c)?.activeFluidCount ?? 0);

  hasher.string('entities');
  const entities = game.world.entities;
  const types = entities.componentTypes();
  const ids = entities.allIds();
  hasher.number(ids.length);
  for (let k = 0; k < ids.length; k += 1) {
    const id = ids[k] as number;
    const index = entityIndex(id);
    hasher.number(id);
    hasher.string(entities.kind(id) ?? '');
    for (let t = 0; t < types.length; t += 1) {
      const type = types[t] as ComponentType<unknown>;
      const store = entities.store(type);
      if (!store.has(index)) continue;
      hasher.string(type.name);
      hasher.value(store.get(index));
    }
  }

  hasher.string('calendar');
  hasher.number(game.world.calendar.tick);
  hasher.string('fortress');
  hasher.value(game.world.fortress);
  hasher.string('rng');
  hasher.value(game.world.rngState());
  hasher.string('systems');
  for (const system of game.world.scheduler.inOrder()) {
    hasher.string(system.id);
    hasher.value(system.serialize());
  }
  return hasher.digest();
}

/** Build a headless game and run it for `ticks`, returning the hash at each checkpoint. */
export function hashesAt(options: HeadlessOptions, checkpoints: readonly number[]): Map<number, string> {
  const game = new HeadlessGame(options);
  const wanted = Array.from(checkpoints).sort((a, b) => a - b);
  const out = new Map<number, string>();
  let at = 0;
  for (let k = 0; k < wanted.length; k += 1) {
    const target = wanted[k] as number;
    if (target > at) {
      game.step(target - at);
      at = target;
    }
    out.set(target, game.hash());
  }
  return out;
}
