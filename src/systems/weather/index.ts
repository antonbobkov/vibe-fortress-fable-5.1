/**
 * 06 Weather & seasons: the system. `02-systems/06-weather-and-seasons.md`,
 * `04-implementation/algorithms/environment.md` § Weather tick, `tick-order.md` (06 runs at
 * `(tick − 7) % 50`, once per game hour), `regions-biomes-and-traits.md` § Weather and
 * `schemas/system-state.md` `WeatherState`.
 *
 * Every tile flag this system writes (`snow`, `wet`, `mud`) is written in its own tick through the
 * terrain API, never in an event handler (D-089). docs/archive/decisions-archive.md D-101.
 */

import { C } from '@core/components';
import { CHUNK_SIZE, TICKS_PER_HOUR } from '@core/constants';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import { FLUID_FROZEN_BIT, FLUID_LEVEL_MASK, TileFlag, TileKind, type Map3D } from '@core/map3d';
import { WADE_LARGE_SIZE } from '@core/path-constants';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TerrainApi, type TickContext } from '@core/system';
import type { ChunkIndex, TileIndex } from '@core/types';
import type { LocalMapSpec } from '@systems/embark/spec';
import {
  INITIAL_WEATHER,
  LIGHTNING_PER_HOUR_PERMILLE,
  LIGHTNING_TALL_WEIGHT,
  LIGHTNING_TREE_WEIGHT,
  MELT_C,
  MUD_RAIN_HOURS,
  SNOW_CHUNKS_PER_HOUR,
  THUNDERHEAD_LIGHTNING_DENOMINATOR,
  THUNDERHEAD_LIGHTNING_NUMERATOR,
  WEATHER_CADENCE,
  WEATHER_PHASE,
  WEATHER_STATES,
  WET_DURATION_HOURS,
  type WeatherStateId,
} from './constants';
import type { WeatherReader } from './reader';
import type { WeatherStateV1 } from './state';
import {
  constrain,
  daylightWindow,
  growthModifier,
  isDaylightAt,
  isWeatherState,
  surfaceTemp,
  thirstModifier,
  transitionWeights,
  visibilityModifier,
  weightedIndex,
  type Climate,
} from './transitions';

export type { WeatherReader } from './reader';
export type { WeatherStateId } from './constants';

/** The id 06 registers its reader under. */
export const WEATHER_ID = '06';

export interface WeatherOptions {
  /** The embark region: biome, `tempC`, temper and traits. */
  readonly spec: Pick<LocalMapSpec, 'biome' | 'temper' | 'traits'> & { readonly tempC?: number };
}

interface BiomeRow {
  readonly id: string;
  readonly referenceTempC: number;
  readonly seasonTemp: readonly number[];
}

interface WeatherStateRow {
  readonly id: string;
  readonly minHours: number;
  readonly maxHours: number;
}

interface TransitionRow {
  readonly season: number;
  readonly from: string;
  readonly to: Readonly<Record<string, number>>;
}

interface CalendarLike {
  readonly tick: number;
  isDaylight: boolean;
}

export class WeatherSystem extends BaseSystem<WeatherStateV1> {
  readonly id = WEATHER_ID;
  readonly order = 6;
  override readonly cadence = WEATHER_CADENCE;
  override readonly phase = WEATHER_PHASE;
  override readonly subscribes: readonly EventType[] = ['SeasonChanged'];

  private readonly options: WeatherOptions;
  private mapRef: Map3D | null = null;
  private rng: RngStream | null = null;
  private calendar: CalendarLike | null = null;
  private hourNow: () => number = () => 0;
  private seasonNow: () => number = () => 0;
  private readerRef: WeatherReader | null = null;
  climate: Climate = { seasonTemp: [0, 0, 0, 0], referenceTempC: 0, tempC: 0, temper: 0, traits: [] };
  private durations = new Map<string, WeatherStateRow>();
  private transitions = new Map<string, Readonly<Record<string, number>>>();
  private soilOf: (material: number) => boolean = () => false;
  private tallAt: (i: TileIndex) => boolean = () => false;
  /** Highest outdoor solid tile per map column; fluid exposure is checked each hour. */
  private exposedSurface: Int32Array | null = null;

  // State (`06` § State).
  state: WeatherStateId = INITIAL_WEATHER;
  stateEndsTick = 0;
  surfaceTempCached = 0;
  growthModifierCached = 0;
  readonly snowCovered = new Set<ChunkIndex>();
  readonly wetChunks = new Map<ChunkIndex, number>();
  started = false;
  forced: WeatherStateId | null = null;
  rainHours = 0;
  isDaylightCached = true;

  constructor(options: WeatherOptions) {
    super();
    this.options = options;
  }

  get map(): Map3D {
    if (this.mapRef === null) throw new Error('06 weather: used before init');
    return this.mapRef;
  }

  override init(ctx: InitContext): void {
    this.mapRef = ctx.world.map;
    this.exposedSurface = new Int32Array(this.map.w * this.map.h);
    for (let at = 0; at < this.exposedSurface.length; at += 1) {
      this.exposedSurface[at] = this.findOutdoorSurface(at);
    }
    // Snow lying on the map from generation (03 stage 9) is snow cover like fallen snow: it melts.
    for (let at = 0; at < this.exposedSurface.length; at += 1) {
      const i = this.exposedSurface[at] as number;
      if (i >= 0 && this.map.hasFlag(i, TileFlag.Snow)) this.snowCovered.add(this.map.chunkOf(i));
    }
    this.rng = ctx.rng;
    this.calendar = ctx.world.calendar as CalendarLike;
    this.hourNow = () => ctx.readers.calendar.hour;
    this.seasonNow = () => ctx.readers.calendar.season;
    const spec = this.options.spec;
    const biome = ctx.registry.table<BiomeRow>('biomes').byId(spec.biome);
    if (biome === undefined) throw new RangeError(`06 weather: unknown biome ${spec.biome}`);
    this.climate = Object.freeze({
      seasonTemp: biome.seasonTemp,
      referenceTempC: biome.referenceTempC,
      tempC: spec.tempC ?? biome.referenceTempC,
      temper: spec.temper,
      traits: [...spec.traits],
    });
    this.durations = new Map();
    const states = ctx.registry.table<WeatherStateRow>('weatherStates');
    for (const id of states.ids()) this.durations.set(id, states.byId(id) as WeatherStateRow);
    this.transitions = new Map();
    for (const row of ctx.registry.derived<readonly TransitionRow[]>('weatherTables')) this.transitions.set(`${row.season}:${row.from}`, row.to);
    const materials = ctx.registry.table<{ id: string; class: string }>('materials');
    const soil: boolean[] = [];
    for (let m = 1; m <= materials.size; m += 1) soil[m] = materials.byIndex(m)?.class === 'soil';
    this.soilOf = (m) => soil[m] === true;
    const entities = ctx.world.entities;
    this.tallAt = (i) => {
      for (const id of ctx.readers.entities.at(i)) {
        const c = entities.get(id, C.Creature);
        if (c !== undefined && c.sizeClass >= WADE_LARGE_SIZE) return true;
      }
      return false;
    };
    this.refresh();
    this.readerRef = this.makeReader();
    // `06` § Registrations.
    ctx.register.announcement('WeatherChanged', {
      severity: 'note',
      stringKey: 'announce.weather',
      keyField: 'to',
      oneOf: { field: 'to', values: ['storm', 'snow', 'heatwave', 'cold_snap'] },
    });
    ctx.register.announcement('SeasonChanged', { severity: 'note', stringKey: 'announce.season', keyField: 'season' });
    ctx.register.inspector('tile', { id: 'weather', order: 30 });
  }

  // ---------- the hourly tick ----------

  override tick(ctx: TickContext): void {
    if (!this.started) {
      this.started = true;
      this.stateEndsTick = ctx.tick + this.rollHours(this.state) * TICKS_PER_HOUR;
    } else if (this.forced === null && ctx.tick >= this.stateEndsTick) {
      this.transition(ctx);
    }
    this.refresh();
    const raining = this.state === 'rain' || this.state === 'storm';
    this.rainHours = raining ? this.rainHours + 1 : 0;
    const changed = new Set<ChunkIndex>();
    let columns: ChunkIndex[][] | null = null;
    const exposed = (): ChunkIndex[][] => {
      columns ??= this.exposedColumns();
      return columns;
    };
    if (raining) this.rain(ctx.terrain, ctx.tick, exposed());
    if (this.state === 'storm') this.lightning(ctx, exposed());
    if (this.state === 'snow') this.cover(ctx.terrain, exposed(), changed);
    else if (this.surfaceTempCached > MELT_C && this.snowCovered.size > 0) this.melt(ctx.terrain, changed);
    this.dry(ctx.terrain, ctx.tick);
    if (changed.size > 0) ctx.emit({ type: 'SnowCoverChanged', chunks: Array.from(changed).sort((a, b) => a - b) });
  }

  /** `algorithms/environment.md` `transition()`. */
  private transition(ctx: TickContext): void {
    const rng = this.rng as RngStream;
    const season = this.seasonNow();
    const row = this.transitions.get(`${season}:${this.state}`) ?? {};
    const weights = transitionWeights(row, season, this.climate);
    const k = weightedIndex(weights, (total) => rng.int(0, total - 1));
    const drawn = k < 0 ? INITIAL_WEATHER : (WEATHER_STATES[k] as WeatherStateId);
    const next = constrain(drawn, this.surfaceTempCached, this.climate);
    const from = this.state;
    this.state = next;
    this.stateEndsTick = ctx.tick + this.rollHours(next) * TICKS_PER_HOUR;
    if (from !== next) ctx.emit({ type: 'WeatherChanged', from, to: next });
  }

  private rollHours(state: string): number {
    const row = this.durations.get(state);
    if (row === undefined) return 1;
    return (this.rng as RngStream).int(row.minHours, row.maxHours);
  }

  /**
   * The cached surface temperature, growth modifier and daylight of the current hour. Public for
   * the arrival, which sets the calendar to `START_HOUR` after the systems' `init` (D-103).
   */
  refresh(): void {
    const season = this.seasonNow();
    const hour = this.hourNow();
    this.surfaceTempCached = surfaceTemp(season, hour, this.state, this.climate);
    this.growthModifierCached = growthModifier(season, this.state, this.climate);
    this.isDaylightCached = isDaylightAt(season, hour, this.climate);
    if (this.calendar !== null) this.calendar.isDaylight = this.isDaylightCached;
  }

  // ---------- outdoor tiles ----------

  /** A tile snow and rain land on: outdoor, not `open`, and holding no liquid (D-101). */
  private isExposed(i: TileIndex): boolean {
    const map = this.map;
    if (!map.hasFlag(i, TileFlag.Outdoor) || map.kindAt(i) === TileKind.Open) return false;
    const f = map.fluid[i] as number;
    return (f & FLUID_LEVEL_MASK) === 0 || (f & FLUID_FROZEN_BIT) !== 0;
  }

  /**
   * Per chunk column (`cy × chunksPerRow + cx`), the chunks, ascending, that hold an exposed tile.
   * Each map column is read from the top down while its tiles are outdoor.
   */
  exposedColumns(): ChunkIndex[][] {
    const map = this.map;
    const columns = map.chunksPerRow * map.chunksPerCol;
    const out: ChunkIndex[][] = Array.from({ length: columns }, () => []);
    const seen = new Uint8Array(map.chunkCount);
    const surfaces = this.exposedSurface ?? new Int32Array(map.w * map.h).fill(-1);
    for (let y = 0; y < map.h; y += 1) {
      for (let x = 0; x < map.w; x += 1) {
        const at = y * map.w + x;
        let i = surfaces[at] as number;
        // Terrain recomputes Outdoor when a roof is placed or removed. A cached surface that
        // became open or lost its sky flag is the only column that needs a new vertical search.
        if (i < 0 || map.kind[i] === TileKind.Open || ((map.flags[i] as number) & TileFlag.Outdoor) === 0) {
          i = this.findOutdoorSurface(at);
          surfaces[at] = i;
        }
        if (i < 0 || !this.isExposed(i)) continue;
        const col = Math.floor(y / CHUNK_SIZE) * map.chunksPerRow + Math.floor(x / CHUNK_SIZE);
        const c = Math.floor(i / (map.w * map.h)) * columns + col;
        if (seen[c] === 0) {
          seen[c] = 1;
          (out[col] as ChunkIndex[]).push(c);
        }
      }
    }
    this.exposedSurface = surfaces;
    for (const list of out) list.sort((a, b) => a - b);
    return out;
  }

  private findOutdoorSurface(at: number): TileIndex {
    const map = this.map;
    const plane = map.w * map.h;
    let i = (map.d - 1) * plane + at;
    for (let z = map.d - 1; z >= 0; z -= 1, i -= plane) {
      if (((map.flags[i] as number) & TileFlag.Outdoor) === 0) break;
      if (map.kind[i] !== TileKind.Open) return i;
    }
    return -1;
  }

  private columnOf(c: ChunkIndex): number {
    return c % (this.map.chunksPerRow * this.map.chunksPerCol);
  }

  /** The tiles of a chunk, ascending. */
  private tilesOf(c: ChunkIndex): TileIndex[] {
    const map = this.map;
    const perLevel = map.chunksPerRow * map.chunksPerCol;
    const z = Math.floor(c / perLevel);
    const rest = c % perLevel;
    const x0 = (rest % map.chunksPerRow) * CHUNK_SIZE;
    const y0 = Math.floor(rest / map.chunksPerRow) * CHUNK_SIZE;
    const out: TileIndex[] = [];
    for (let y = y0; y < Math.min(map.h, y0 + CHUNK_SIZE); y += 1) {
      for (let x = x0; x < Math.min(map.w, x0 + CHUNK_SIZE); x += 1) out.push(map.index(x, y, z));
    }
    return out;
  }

  private isSoilFloor(i: TileIndex): boolean {
    return this.map.kindAt(i) === TileKind.Floor && this.soilOf(this.map.materialAt(i));
  }

  // ---------- rain, snow, lightning ----------

  /** `rain`/`storm`: every outdoor chunk is wet this hour; mud on soil floors after two rain hours. */
  private rain(terrain: TerrainApi, tick: number, columns: readonly ChunkIndex[][]): void {
    const mud = this.rainHours >= MUD_RAIN_HOURS;
    const map = this.map;
    const perLevel = map.chunksPerRow * map.chunksPerCol;
    for (const list of columns) {
      for (const c of list) {
        this.wetChunks.set(c, tick);
        const z = Math.floor(c / perLevel);
        const rest = c % perLevel;
        const x0 = (rest % map.chunksPerRow) * CHUNK_SIZE;
        const y0 = Math.floor(rest / map.chunksPerRow) * CHUNK_SIZE;
        for (let y = y0; y < Math.min(map.h, y0 + CHUNK_SIZE); y += 1) {
          for (let x = x0; x < Math.min(map.w, x0 + CHUNK_SIZE); x += 1) {
            const i = (z * map.h + y) * map.w + x;
            const flags = map.flags[i] as number;
            if ((flags & TileFlag.Outdoor) === 0 || map.kind[i] === TileKind.Open) continue;
            const fluid = map.fluid[i] as number;
            if ((fluid & FLUID_LEVEL_MASK) !== 0 && (fluid & FLUID_FROZEN_BIT) === 0) continue;
            if ((flags & TileFlag.Wet) === 0) terrain.setFlag(i, TileFlag.Wet, true);
            if (mud && (flags & TileFlag.Mud) === 0 && this.isSoilFloor(i)) terrain.setFlag(i, TileFlag.Mud, true);
          }
        }
      }
    }
  }

  /** Clear `wet` on chunks that have had no rain for `WET_DURATION_HOURS`. */
  private dry(terrain: TerrainApi, tick: number): void {
    if (this.wetChunks.size === 0) return;
    const limit = WET_DURATION_HOURS * TICKS_PER_HOUR;
    for (const c of Array.from(this.wetChunks.keys()).sort((a, b) => a - b)) {
      if ((this.wetChunks.get(c) as number) + limit >= tick) continue;
      this.wetChunks.delete(c);
      for (const i of this.tilesOf(c)) if (this.map.hasFlag(i, TileFlag.Wet)) terrain.setFlag(i, TileFlag.Wet, false);
    }
  }

  /** `snow`: `SNOW_CHUNKS_PER_HOUR` random outdoor chunk columns not yet covered get snow. */
  private cover(terrain: TerrainApi, columns: readonly ChunkIndex[][], changed: Set<ChunkIndex>): void {
    const rng = this.rng as RngStream;
    const open: number[] = [];
    columns.forEach((list, col) => {
      if (list.some((c) => !this.snowCovered.has(c))) open.push(col);
    });
    for (let n = 0; n < SNOW_CHUNKS_PER_HOUR && open.length > 0; n += 1) {
      const col = open.splice(rng.int(0, open.length - 1), 1)[0] as number;
      for (const c of columns[col] as ChunkIndex[]) {
        if (this.snowCovered.has(c)) continue;
        this.snowCovered.add(c);
        changed.add(c);
        for (const i of this.tilesOf(c)) if (this.isExposed(i)) terrain.setFlag(i, TileFlag.Snow, true);
      }
    }
  }

  /** Above `MELT_C` and not snowing: `SNOW_CHUNKS_PER_HOUR` random covered columns melt; mud on soil floors. */
  private melt(terrain: TerrainApi, changed: Set<ChunkIndex>): void {
    const rng = this.rng as RngStream;
    const byColumn = new Map<number, ChunkIndex[]>();
    for (const c of Array.from(this.snowCovered).sort((a, b) => a - b)) {
      const col = this.columnOf(c);
      const list = byColumn.get(col) ?? [];
      list.push(c);
      byColumn.set(col, list);
    }
    const covered = Array.from(byColumn.keys()).sort((a, b) => a - b);
    for (let n = 0; n < SNOW_CHUNKS_PER_HOUR && covered.length > 0; n += 1) {
      const col = covered.splice(rng.int(0, covered.length - 1), 1)[0] as number;
      for (const c of byColumn.get(col) as ChunkIndex[]) {
        this.snowCovered.delete(c);
        changed.add(c);
        for (const i of this.tilesOf(c)) {
          if (!this.map.hasFlag(i, TileFlag.Snow)) continue;
          terrain.setFlag(i, TileFlag.Snow, false);
          if (this.isSoilFloor(i)) terrain.setFlag(i, TileFlag.Mud, true);
        }
      }
    }
  }

  /** `storm`: a strike per hour with `LIGHTNING_PER_HOUR_PERMILLE` (×1.5 `thunderhead`), weighted to trees and tall creatures. */
  private lightning(ctx: TickContext, columns: readonly ChunkIndex[][]): void {
    const rng = this.rng as RngStream;
    let permille = LIGHTNING_PER_HOUR_PERMILLE;
    if (this.climate.traits.includes('thunderhead')) permille = (permille * THUNDERHEAD_LIGHTNING_NUMERATOR) / THUNDERHEAD_LIGHTNING_DENOMINATOR;
    if (!rng.chance(permille)) return;
    const tiles: TileIndex[] = [];
    const weights: number[] = [];
    const chunks = columns.flat().sort((a, b) => a - b);
    for (const c of chunks) {
      for (const i of this.tilesOf(c)) {
        if (!this.isExposed(i)) continue;
        tiles.push(i);
        weights.push(this.map.kindAt(i) === TileKind.Tree ? LIGHTNING_TREE_WEIGHT : this.tallAt(i) ? LIGHTNING_TALL_WEIGHT : 1);
      }
    }
    const k = weightedIndex(weights, (total) => rng.int(0, total - 1));
    if (k >= 0) ctx.emit({ type: 'LightningStrike', tile: tiles[k] as TileIndex });
  }

  // ---------- events, forcing ----------

  /** `SeasonChanged`: the modifiers are recomputed, then `SeasonEffectsChanged { season }`. */
  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type !== 'SeasonChanged') return;
    this.refresh();
    ctx.emit({ type: 'SeasonEffectsChanged', season: event['season'] as number });
  }

  /** `TestWorld.forceWeather(state)`: hold a state until released with `null` (D-101). */
  force(state: WeatherStateId | null, tick: number): void {
    if (state === null) {
      this.forced = null;
      this.stateEndsTick = tick;
      return;
    }
    this.forced = state;
    this.state = state;
    this.refresh();
  }

  // ---------- the reader ----------

  private makeReader(): WeatherReader {
    return {
      state: () => this.state,
      surfaceTempC: () => this.surfaceTempCached,
      isDaylight: () => this.isDaylightCached,
      growthModifier: () => this.growthModifierCached,
      thirstModifier: () => thirstModifier(this.state),
      visibilityModifier: () => visibilityModifier(this.state),
      isSnowCovered: (i) => this.map.hasFlag(i, TileFlag.Snow),
      isWet: (i) => this.map.hasFlag(i, TileFlag.Wet),
      forecast: () => Math.max(0, Math.ceil((this.stateEndsTick - (this.calendar?.tick ?? 0)) / TICKS_PER_HOUR)),
      snowCoveredChunks: () => Array.from(this.snowCovered).sort((a, b) => a - b),
      daylightHours: () => daylightWindow(this.seasonNow(), this.climate),
    };
  }

  override reader(): WeatherReader {
    if (this.readerRef === null) throw new Error('06 weather: reader before init');
    return this.readerRef;
  }

  serialize(): WeatherStateV1 {
    return {
      stateVersion: 1,
      state: this.state,
      stateEndsTick: this.stateEndsTick,
      surfaceTempCached: this.surfaceTempCached,
      growthModifierCached: this.growthModifierCached,
      snowCoveredChunks: Array.from(this.snowCovered).sort((a, b) => a - b),
      wetChunks: Array.from(this.wetChunks.keys())
        .sort((a, b) => a - b)
        .map((c): [ChunkIndex, number] => [c, this.wetChunks.get(c) as number]),
      rng: (this.rng as RngStream).state(),
      started: this.started,
      forced: this.forced,
      rainHours: this.rainHours,
      isDaylightCached: this.isDaylightCached,
    };
  }

  deserialize(state: WeatherStateV1, ctx: InitContext): void {
    if (this.mapRef === null) this.init(ctx);
    this.state = isWeatherState(state.state) ? state.state : INITIAL_WEATHER;
    this.stateEndsTick = state.stateEndsTick;
    this.surfaceTempCached = state.surfaceTempCached;
    this.growthModifierCached = state.growthModifierCached;
    this.snowCovered.clear();
    for (const c of state.snowCoveredChunks) this.snowCovered.add(c);
    this.wetChunks.clear();
    for (const [c, t] of state.wetChunks) this.wetChunks.set(c, t);
    this.started = state.started;
    this.forced = state.forced !== null && isWeatherState(state.forced) ? state.forced : null;
    this.rainHours = state.rainHours;
    this.isDaylightCached = state.isDaylightCached;
    if (this.calendar !== null) this.calendar.isDaylight = this.isDaylightCached;
    this.rng?.setState(state.rng);
  }
}
