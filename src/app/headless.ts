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
import { StateHasher } from '@core/serialize';
import { World, type WorldOptions } from '@core/world';
import { entityIndex } from '@core/entities';
import type { ComponentType } from '@core/entities';
import type { GameSystem } from '@core/system';
import type { Registry } from '@core/registry';
import {
  EmbarkSession,
  arrive,
  basicDwarfSpawner,
  type ArrivalResult,
  type LocalMapSpec,
} from '@systems/embark';

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
 * walkable `Floor`. There is no river, no lake and no cavern; see DECISIONS.md D-027.
 */
export function buildFlatTestMap(registry: Registry = contentRegistry()): Map3D {
  const map = new Map3D(LOCAL_MAP_W, LOCAL_MAP_H, LOCAL_MAP_Z);
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
 * The `LocalMapSpec` the `flat-test` map stands for: "a `serene_vale`-like region (peril 0,
 * wealth 2, temper 0)" (`acceptance-tests.md`). The arrival edge is north, the first of the
 * `n, e, s, w` edges (DECISIONS.md D-044).
 */
export const FLAT_TEST_SPEC: LocalMapSpec = Object.freeze({
  seed: 'flat-test',
  regionId: 0,
  biome: 'temperate_grassland',
  elevation: 120,
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
 * The embark of a headless game: `'none'` (no dwarves), `'default'` (the Balanced preset,
 * `acceptance-tests.md`), or a named preset.
 */
export type HeadlessEmbark = 'none' | 'default' | { readonly preset: string };

/** The preset `'default'` stands for. */
export const DEFAULT_EMBARK_PRESET = 'balanced';

export interface HeadlessOptions {
  readonly seed: string;
  readonly registry?: Registry;
  /** `'flat-test'` builds the fixture map; `'empty'` leaves an all-open map for hand-built tests. */
  readonly world?: 'flat-test' | 'empty';
  /** A map built by the caller, used by the hand-built scenario fixtures. */
  readonly map?: Map3D;
  readonly fortressName?: string;
  readonly systems?: readonly GameSystem[];
  readonly hooks?: Partial<TerrainHooks>;
  readonly pathfinder?: PathfinderOptions;
  readonly startTick?: number;
  /** Omitted means `'none'` (DECISIONS.md D-029). */
  readonly embark?: HeadlessEmbark;
  /** The spec of the local map; the flat-test spec when omitted. */
  readonly spec?: LocalMapSpec;
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
  readonly arrival: ArrivalResult | null;

  constructor(options: HeadlessOptions) {
    this.registry = options.registry ?? contentRegistry();
    const map =
      options.map ??
      (options.world === 'empty'
        ? new Map3D()
        : buildFlatTestMap(this.registry));
    const worldOptions: WorldOptions = {
      seed: options.seed,
      registry: this.registry,
      map,
      ...(options.fortressName === undefined ? {} : { fortressName: options.fortressName }),
      ...(options.startTick === undefined ? {} : { startTick: options.startTick }),
    };
    this.world = new World(worldOptions);
    this.pathing = new PathingCore(map, options.hooks ?? {}, options.pathfinder ?? {});
    this.spatial = new SpatialIndex(map, this.world.entities);
    this.movement = new MovementHelper(map, this.world.entities, this.spatial, this.pathing);

    this.world.readers.register('pathing', this.pathing.reader());
    this.world.readers.register('spatial', this.spatial.reader());
    this.world.readers.setPassability((i, movementClass) => this.pathing.graph.passable(i, movementClass));
    this.world.readers.setTileEntities((i) => this.spatial.at(i));

    // The core phase between steps 2 and 3 of `tick-order.md`: the brains have run, so the move
    // batch goes out, the path queue is served within its budget, and the dirty chunks are
    // relabelled so that the labels are exact at the start of the next tick.
    this.world.connectivityPass = (): void => {
      this.movement.flushMoves((event) => this.world.events.emit(event));
      this.pathing.pathfinder.tick();
      this.pathing.onTickEnd();
    };

    for (const system of options.systems ?? []) this.world.addSystem(system);
    this.world.init();
    this.arrival = this.embark(options.embark ?? 'none', options.spec ?? FLAT_TEST_SPEC, options.fortressName);
  }

  /**
   * `simulation-core.md` § Startup sequence step 4 for a new game: the map exists, so 02's arrival
   * runs with the party of an embark session (`embark.party` stream of the world seed) and the
   * preset's skills and supplies.
   */
  private embark(embark: HeadlessEmbark, spec: LocalMapSpec, fortressName: string | undefined): ArrivalResult | null {
    if (embark === 'none') return null;
    const preset = embark === 'default' ? DEFAULT_EMBARK_PRESET : embark.preset;
    const session = new EmbarkSession(this.registry, this.world.seed, spec.peril);
    const applied = session.apply({ type: 'ApplyPreset', preset });
    if (!applied.ok) throw new Error(`headless embark: preset ${preset}: ${applied.reason ?? 'rejected'}`);
    return arrive(this.world, spec, session.party, {
      fortressName: fortressName ?? this.world.fortress.name,
      supplies: session.supplies,
      spawnDwarf: basicDwarfSpawner(this.world, (id, at) => this.spatial.insert(id, at)),
    });
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
