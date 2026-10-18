/**
 * 05 Materials & temperature: the system. `02-systems/05-materials-and-temperature.md`,
 * `04-implementation/algorithms/environment.md` § Temperature, `tick-order.md` (05 runs at
 * `(tick − 3) % 10`: fire, the override recompute of dirty chunks, `TemperatureTick`) and
 * `schemas/system-state.md` `MaterialsState`.
 */

import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import type { Map3D } from '@core/map3d';
import { BaseSystem, type InitContext, type TickContext } from '@core/system';
import type { ChunkIndex, TileIndex } from '@core/types';
import { C } from '@core/components';
import { MAGMA_C } from '@systems/fluids/constants';
import { HEARTH_WARMTH_C } from '@systems/buildings/constants';
import { Fire } from './fire';
import { MATERIALS_CADENCE, MATERIALS_PHASE, UNDERGROUND_BASE_C } from './constants';
import type { AlloyInput, MaterialsReader, OreYield } from './reader';
import type { BurningState, MaterialsStateV1 } from './state';
import { chunkTiles, magmaSignature, reachOf, recomputeChunk, temperatureOf, type OverrideSources } from './temperature';

export type { MaterialsReader, MaterialProperty, OreYield, AlloyInput } from './reader';

/** The id 05 registers its reader under. */
export const MATERIALS_ID = '05';

/** 06's reader as far as 05 reads it. */
interface WeatherLike {
  surfaceTempC(): number;
  state?(): string;
}

interface MaterialRow {
  readonly id: string;
  readonly class: string;
  readonly value: number;
  readonly density: number;
  readonly hardness: number;
  readonly sharpness?: number;
  readonly meltsAtC: number;
  readonly burnable: boolean;
  readonly burnTicks: number;
  readonly color: string;
}

export interface MaterialsOptions {
  /** `gemsprings` warm spring tiles of the generated map (`LocalMapResult.warmSprings`). */
  readonly warmSprings?: readonly TileIndex[];
}

const WEATHER_ID = '06';

export class MaterialsSystem extends BaseSystem<MaterialsStateV1> {
  readonly id = MATERIALS_ID;
  readonly order = 5;
  override readonly cadence = MATERIALS_CADENCE;
  override readonly phase = MATERIALS_PHASE;
  override readonly subscribes: readonly EventType[] = ['FluidsChanged', 'MagmaContact', 'LightningStrike', 'SnowCoverChanged'];

  private readonly options: MaterialsOptions;
  private mapRef: Map3D | null = null;
  private rng: RngStream | null = null;
  private readerRef: MaterialsReader | null = null;
  private weather: () => WeatherLike | null = () => null;
  private hearthLightAt: (i: TileIndex) => boolean = () => false;

  // Property arrays (`05` § Material properties), rebuilt from the registry; not saved.
  hardnessOf = new Int32Array(0);
  meltsAtOf = new Int32Array(0);
  burnableOf = new Uint8Array(0);
  valueTable = new Int32Array(0);
  burnTicksOf = new Int32Array(0);
  private rows: (MaterialRow | undefined)[] = [];
  private yields = new Map<number, OreYield[]>();
  private alloys = new Map<number, AlloyInput[]>();

  // State.
  private fireRef: Fire | null = null;
  readonly warmSprings: TileIndex[] = [];
  private springSet = new Set<TileIndex>();
  readonly magmaSourceChunks = new Set<ChunkIndex>();
  /** Per chunk with magma, a signature of where its magma lies (D-095). */
  readonly magmaSignatures = new Map<ChunkIndex, number>();
  started = false;
  readonly pendingChunks = new Set<ChunkIndex>();
  readonly forced = new Map<TileIndex, number>();
  /** How many chunk recomputes ran (a debug counter for the tests; not state). */
  recomputes = 0;

  constructor(options: MaterialsOptions = {}) {
    super();
    this.options = options;
  }

  /** Fire (T-M3-04); valid after `init`. */
  get fire(): Fire {
    if (this.fireRef === null) throw new Error('05 materials: used before init');
    return this.fireRef;
  }

  get burning(): Map<TileIndex, BurningState> {
    return this.fire.burning;
  }

  get map(): Map3D {
    if (this.mapRef === null) throw new Error('05 materials: used before init');
    return this.mapRef;
  }

  override init(ctx: InitContext): void {
    this.mapRef = ctx.world.map;
    this.rng = ctx.rng;
    const table = ctx.registry.table<MaterialRow>('materials');
    const n = table.size + 1;
    this.hardnessOf = new Int32Array(n);
    this.meltsAtOf = new Int32Array(n);
    this.burnableOf = new Uint8Array(n);
    this.valueTable = new Int32Array(n);
    this.burnTicksOf = new Int32Array(n);
    this.rows = [];
    for (let m = 1; m < n; m += 1) {
      const row = table.byIndex(m);
      this.rows[m] = row;
      if (row === undefined) continue;
      this.hardnessOf[m] = row.hardness;
      this.meltsAtOf[m] = row.meltsAtC;
      this.burnableOf[m] = row.burnable ? 1 : 0;
      this.valueTable[m] = row.value;
      this.burnTicksOf[m] = row.burnTicks;
    }
    // Derived tables: `oreYields` and `alloyInputs` (`05` § Material properties).
    this.yields = new Map();
    this.alloys = new Map();
    if (ctx.registry.hasTable('minerals')) {
      const minerals = ctx.registry.table<{ id: string; yields?: { metal: string; count: number }[] }>('minerals');
      for (const id of minerals.ids()) {
        if (!table.has(id)) continue;
        const out = (minerals.byId(id)?.yields ?? []).filter((y) => table.has(y.metal)).map((y) => ({ metal: table.index(y.metal), count: y.count }));
        this.yields.set(table.index(id), out);
      }
    }
    if (ctx.registry.hasTable('metals')) {
      const metals = ctx.registry.table<{ id: string; alloy?: { inputs: { material: string; count: number }[] } }>('metals');
      for (const id of metals.ids()) {
        const alloy = metals.byId(id)?.alloy;
        if (alloy === undefined || !table.has(id)) continue;
        this.alloys.set(
          table.index(id),
          alloy.inputs.filter((i) => table.has(i.material)).map((i) => ({ material: table.index(i.material), count: i.count })),
        );
      }
    }
    const readers = ctx.readers;
    this.weather = () => (readers.has(WEATHER_ID) ? readers.of<WeatherLike>(WEATHER_ID) : null);
    this.hearthLightAt = (i) => readers.has('14') && readers.of<{ hearthLightAt(tile: TileIndex): boolean }>('14').hearthLightAt(i);
    this.warmSprings.length = 0;
    for (const s of [...(this.options.warmSprings ?? [])].sort((a, b) => a - b)) this.warmSprings.push(s);
    this.springSet = new Set(this.warmSprings);
    const world = ctx.world;
    this.fireRef = new Fire({
      map: world.map,
      entities: world.entities,
      rng: ctx.rng,
      classOf: (m) => this.rows[m]?.class ?? '',
      burnable: (m) => this.burnableOf[m] === 1,
      burnTicks: (m) => this.burnTicksOf[m] ?? 0,
      entitiesAt: (i) => readers.entities.at(i),
      raining: () => {
        const state = this.weather()?.state?.();
        return state === 'rain' || state === 'storm';
      },
      sourceChanged: (i) => this.markSourceChanged(i),
    });
    this.readerRef = this.makeReader();
    // `05` § Registrations: overlay `temperature`, inspector section `tile › temperature`.
    ctx.register.overlay({ id: 'temperature', label: 'Temperature', defaultOn: false });
    ctx.register.inspector('tile', { id: 'temperature', order: 20 });
    // `05` § Registrations: "announcements for `FireStarted` (alert …)"; one text, as D-065 does.
    ctx.register.announcement('FireStarted', { severity: 'alert', stringKey: 'announce.fire_started' });
    // `05` § Player-facing behavior: "fire out as a note" (T-M7-10).
    ctx.register.announcement('FireOut', { severity: 'note', stringKey: 'announce.fire_out' });
  }

  // ---------- temperature ----------

  /** 06's `surfaceTempC()`, or {@link SURFACE_FALLBACK_C} while no weather system exists (D-093). */
  surfaceTempC(): number {
    return this.weather()?.surfaceTempC() ?? SURFACE_FALLBACK_C;
  }

  temperatureAt(i: TileIndex): number {
    const forced = this.forced.get(i);
    if (forced !== undefined) return forced;
    return temperatureOf(this.map, i, this.surfaceTempC()) + (this.hearthLightAt(i) ? HEARTH_WARMTH_C : 0);
  }

  /** `TestWorld.forceTemperature(tile, c)`: pin a tile's temperature (null releases it). D-093. */
  forceTemperature(i: TileIndex, c: number | null): void {
    if (c === null) this.forced.delete(i);
    else this.forced.set(i, c);
  }

  private get sources(): OverrideSources {
    return {
      isBurning: (i) => this.burning.has(i),
      isWarmSpring: (i) => this.springSet.has(i),
    };
  }

  /** Recompute a set of chunks, ascending. */
  recompute(chunks: Iterable<ChunkIndex>): void {
    const map = this.map;
    const sources = this.sources;
    for (const c of Array.from(chunks).sort((a, b) => a - b)) {
      recomputeChunk(map, c, sources);
      this.recomputes += 1;
    }
  }

  /** Queue the chunks a source change at a tile can reach (fire and snow use this too). */
  markSourceChanged(i: TileIndex): void {
    reachOf(this.map, this.map.chunkOf(i), this.pendingChunks);
  }

  /**
   * The first tick: every chunk that holds magma or a warm spring, and the chunks those reach, get
   * their overrides (D-095). Lazily, so a loaded game (whose grid is saved) does not repeat it.
   */
  private start(): void {
    this.started = true;
    const map = this.map;
    const n = map.tileCount;
    for (let i = 0; i < n; i += 1) {
      const f = map.fluid[i] as number;
      if ((f & 7) > 0 && (f & 8) !== 0) this.magmaSourceChunks.add(map.chunkOf(i));
    }
    const due = new Set<ChunkIndex>();
    for (const c of Array.from(this.magmaSourceChunks).sort((a, b) => a - b)) {
      this.magmaSignatures.set(c, magmaSignature(map, c));
      reachOf(map, c, due);
    }
    for (const s of this.warmSprings) reachOf(map, map.chunkOf(s), due);
    this.recompute(due);
  }

  override tick(ctx: TickContext): void {
    if (!this.started) this.start();
    this.tickFire(ctx);
    if (this.pendingChunks.size > 0) {
      const due = Array.from(this.pendingChunks);
      this.pendingChunks.clear();
      this.recompute(due);
    }
    ctx.emit({ type: 'TemperatureTick' });
  }

  /** `05` § Fire, each materials tick. */
  private tickFire(ctx: TickContext): void {
    this.fire.tick({ terrain: ctx.terrain, items: ctx.world.services.items, emit: (e) => ctx.emit(e) });
  }

  /** Burnable tiles beside a chunk's magma (cardinal, or the tile above it) wait to ignite (`05` § Fire, Ignition). */
  private magmaIgnition(c: ChunkIndex): void {
    const map = this.map;
    const fire = this.fire;
    for (const i of chunkTiles(map, c)) {
      const f = map.fluid[i] as number;
      if ((f & 7) === 0 || (f & 8) === 0) continue;
      for (const [dx, dy, dz] of [
        [0, -1, 0],
        [1, 0, 0],
        [0, 1, 0],
        [-1, 0, 0],
        [0, 0, 1],
      ] as const) {
        const j = map.offset(i, dx, dy, dz);
        if (j >= 0 && !fire.burning.has(j) && fire.burnableTile(j)) fire.pendingIgnite.add(j);
      }
    }
  }

  /**
   * `FluidsChanged { chunks }`: a chunk whose magma tiles are not where they were at its last look
   * has its reach queued for the next materials tick (`magmaSourceChunks`, `05` § State); water
   * alone never recomputes. D-095.
   */
  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'LightningStrike') {
      // `05` § Fire: "a `LightningStrike` names it" (06); ignites at the next materials tick.
      this.fire.pendingIgnite.add(event['tile'] as TileIndex);
      return;
    }
    if (event.type === 'SnowCoverChanged') {
      // Snow adds `SNOW_OVERRIDE` on its own tile only (D-095): the chunk is recomputed next tick.
      for (const c of event['chunks'] as readonly ChunkIndex[]) this.pendingChunks.add(c);
      return;
    }
    if (event.type === 'MagmaContact') {
      this.melt(event['entities'] as readonly number[], ctx);
      return;
    }
    if (event.type !== 'FluidsChanged') return;
    const map = this.map;
    for (const c of event['chunks'] as readonly ChunkIndex[]) {
      const before = this.magmaSignatures.get(c) ?? 0;
      const after = magmaSignature(map, c);
      if (before === after) continue;
      if (after === 0) {
        this.magmaSignatures.delete(c);
        this.magmaSourceChunks.delete(c);
      } else {
        this.magmaSignatures.set(c, after);
        this.magmaSourceChunks.add(c);
      }
      reachOf(map, c, this.pendingChunks);
      if (after !== 0) this.magmaIgnition(c);
    }
  }

  /**
   * `05` § Melting: on `MagmaContact { entities }`, every item whose material melts at or below
   * `MAGMA_C` is destroyed with `ItemMelted { id }` (13 destroys it); the rest are unharmed.
   */
  private melt(entities: readonly number[], ctx: TickContext): void {
    const store = ctx.world.entities;
    for (const id of entities) {
      if (!store.alive(id) || store.kind(id) !== 'item') continue;
      const item = store.get(id, C.Item);
      if (item === undefined) continue;
      if ((this.meltsAtOf[item.material] ?? 0) <= MAGMA_C) ctx.emit({ type: 'ItemMelted', id });
    }
  }

  // ---------- the reader ----------

  private makeReader(): MaterialsReader {
    return {
      temperatureAt: (i) => this.temperatureAt(i),
      surfaceTempC: () => this.surfaceTempC(),
      isBurning: (i) => this.burning.has(i),
      burningTiles: () => Array.from(this.burning.keys()).sort((a, b) => a - b),
      burnableTile: (i) => this.fire.burnableTile(i),
      propertyOf: (m, p) => {
        const row = this.rows[m];
        if (row === undefined) return undefined;
        if (p === 'magmaSafe') return row.meltsAtC > MAGMA_C;
        return row[p];
      },
      hardness: (m) => this.hardnessOf[m] ?? 0,
      meltsAt: (m) => this.meltsAtOf[m] ?? 0,
      burnable: (m) => this.burnableOf[m] === 1,
      value: (m) => this.valueTable[m] ?? 0,
      classOf: (m) => this.rows[m]?.class ?? '',
      isMagmaSafe: (m) => (this.meltsAtOf[m] ?? 0) > MAGMA_C,
      yieldsOf: (m) => this.yields.get(m) ?? [],
      alloyInputs: (m) => this.alloys.get(m) ?? [],
      isWarmSpring: (i) => this.springSet.has(i),
    };
  }

  override reader(): MaterialsReader {
    if (this.readerRef === null) throw new Error('05 materials: reader before init');
    return this.readerRef;
  }

  serialize(): MaterialsStateV1 {
    return {
      stateVersion: 1,
      burning: Array.from(this.burning.keys())
        .sort((a, b) => a - b)
        .map((t): [TileIndex, BurningState] => [t, { ...(this.burning.get(t) as BurningState) }]),
      warmSprings: this.warmSprings.slice(),
      magmaSourceChunks: Array.from(this.magmaSourceChunks).sort((a, b) => a - b),
      magmaSignatures: Array.from(this.magmaSignatures.keys())
        .sort((a, b) => a - b)
        .map((c): [ChunkIndex, number] => [c, this.magmaSignatures.get(c) as number]),
      rng: (this.rng as RngStream).state(),
      started: this.started,
      pendingChunks: Array.from(this.pendingChunks).sort((a, b) => a - b),
      forced: Array.from(this.forced.keys())
        .sort((a, b) => a - b)
        .map((t): [TileIndex, number] => [t, this.forced.get(t) as number]),
      itemBurn: this.serializeItemBurn(),
      pendingIgnite: this.serializePendingIgnite(),
    };
  }

  private serializeItemBurn(): MaterialsStateV1['itemBurn'] {
    const burn = this.fire.itemBurn;
    return Array.from(burn.keys())
      .sort((a, b) => a - b)
      .map((id): [number, number] => [id, burn.get(id) as number]);
  }

  private serializePendingIgnite(): MaterialsStateV1['pendingIgnite'] {
    return Array.from(this.fire.pendingIgnite).sort((a, b) => a - b);
  }

  deserialize(state: MaterialsStateV1, ctx: InitContext): void {
    if (this.mapRef === null) this.init(ctx);
    this.burning.clear();
    for (const [t, s] of state.burning) this.burning.set(t, { ...s });
    this.warmSprings.length = 0;
    for (const s of state.warmSprings) this.warmSprings.push(s);
    this.springSet = new Set(this.warmSprings);
    this.magmaSourceChunks.clear();
    for (const c of state.magmaSourceChunks) this.magmaSourceChunks.add(c);
    this.magmaSignatures.clear();
    for (const [c, sig] of state.magmaSignatures) this.magmaSignatures.set(c, sig);
    this.started = state.started;
    this.pendingChunks.clear();
    for (const c of state.pendingChunks) this.pendingChunks.add(c);
    this.forced.clear();
    for (const [t, c] of state.forced) this.forced.set(t, c);
    this.deserializeFire(state);
    this.rng?.setState(state.rng);
  }

  private deserializeFire(state: MaterialsStateV1): void {
    const fire = this.fire;
    fire.itemBurn.clear();
    for (const [id, t] of state.itemBurn) fire.itemBurn.set(id, t);
    fire.pendingIgnite.clear();
    for (const t of state.pendingIgnite) fire.pendingIgnite.add(t);
  }
}

/**
 * D-093: while no weather system (06, T-M3-06) is registered, the surface temperature is
 * `UNDERGROUND_BASE_C`, the one neutral temperature 05 itself defines.
 */
export const SURFACE_FALLBACK_C = UNDERGROUND_BASE_C;
