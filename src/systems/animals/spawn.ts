/**
 * Wild spawning and leaving: `02-systems/08-animals-and-domestication.md` § Wild spawning and the
 * `leave` rule of § Wild behavior; `03-content/creatures.md` (the cap rule and the biome and
 * cavern weight columns); `03-content/regions-biomes-and-traits.md` § Traits (the `08` hooks).
 *
 * ```
 * each DayPassed, for each species of the biome's list for this season, below its cap:
 *   with SPAWN_PERMILLE × weight, spawn a group at a walkable outdoor edge tile at least
 *   SPAWN_MIN_DISTANCE from any dwarf, with `home` set to the spawn chunk
 * a dangerous species neither rolls nor spawns within DANGEROUS_QUIET_DAYS of the last dangerous
 *   group's arrival, except on a `beastwood` map (T-545)
 * cavern fauna respawns by the same rule at random walkable cavern tiles once breached
 * the global MAX_CREATURES cap applies
 * leaving: over the species cap, or longer on the map than WILD_LIFETIME_DAYS
 * ```
 */

import { C } from '@core/components';
import { MAX_CREATURES, TICKS_PER_DAY } from '@core/constants';
import { TileFlag, type Map3D } from '@core/map3d';
import type { RngStream } from '@core/rng';
import type { MovementClass, EntityId, TileIndex } from '@core/types';
import type { PathingReader } from '@core/readers';
import {
  BEASTWOOD_ALL_FACTOR_PERCENT,
  BEASTWOOD_SPECIES,
  BEASTWOOD_SPECIES_FACTOR_PERCENT,
  DANGEROUS_QUIET_DAYS,
  FROSTMARROW_SNOW_LEOPARD,
  FROSTMARROW_SNOW_LEOPARD_CAP_BONUS,
  FROSTMARROW_YAK,
  FROSTMARROW_YAK_GROUP,
  FROSTMARROW_YAK_WEIGHT,
  FUNGAL_DEPTHS_CAVERN_FACTOR_PERCENT,
  SERENE_VALE_BANNED,
  SERENE_VALE_HERBIVORE_FACTOR_PERCENT,
  SPAWN_MIN_DISTANCE,
  SPAWN_PERMILLE,
  WILD_LIFETIME_DAYS,
} from './constants';
import type { AnimalFacts } from './facts';

export interface SpawnHost {
  readonly map: Map3D;
  readonly facts: AnimalFacts;
  readonly rng: RngStream;
  readonly pathing: PathingReader;
  /** The embark region's biome, its `wildlifeDensity` (Fixed) and its traits. */
  readonly biome: string;
  readonly wildlifeDensity: number;
  readonly traits: readonly string[];
  /** Wild creatures of a species now. */
  countWild(species: number): number;
  /** Every living creature, for `MAX_CREATURES`. */
  creatureCount(): number;
  /** Dwarf tiles, for `SPAWN_MIN_DISTANCE`. */
  dwarfTiles(): readonly TileIndex[];
  /** The breached caverns, ascending tier. */
  breachedCaverns(): readonly number[];
  /** Walkable floor tiles of a cavern tier. */
  cavernTiles(tier: number): readonly TileIndex[];
  /** Create the creature through the spawn API; returns its id. */
  spawn(species: number, at: TileIndex): EntityId;
  /** T-545: the tick the last dangerous surface group arrived, -1 for none; `dailySpawn` sets it. */
  lastDangerousTick: number;
}

/**
 * T-545: whether dangerous species keep quiet at `tick`, within `DANGEROUS_QUIET_DAYS` of the last
 * dangerous group's arrival. A `beastwood` map has no quiet spell.
 */
export function dangerousQuiet(host: Pick<SpawnHost, 'traits' | 'lastDangerousTick'>, tick: number): boolean {
  if (host.traits.includes('beastwood') || host.lastDangerousTick < 0) return false;
  return tick - host.lastDangerousTick < DANGEROUS_QUIET_DAYS * TICKS_PER_DAY;
}

/** `SPAWN_PERMILLE` at weight 100, scaled by the species' weight in the biome (D-110). */
export function spawnPermille(weight: number): number {
  return Math.min(1000, Math.floor((SPAWN_PERMILLE * weight) / 100));
}

/** A percentage multiplier applied to a cap, rounded up so a trait never lowers one. */
function scale(value: number, percent: number): number {
  return Math.ceil((value * percent) / 100);
}

/** `creatures.md` and the region trait hooks: the live cap of a surface species. */
export function surfaceCap(host: SpawnHost, species: number, weight: number): number {
  const id = host.facts.idOf(species);
  if (host.traits.includes('serene_vale') && SERENE_VALE_BANNED.includes(id)) return 0;
  let cap = scale(host.facts.baseCap(weight), Math.max(1, Math.round(host.wildlifeDensity / 10)));
  if (host.traits.includes('beastwood')) {
    cap = scale(cap, BEASTWOOD_ALL_FACTOR_PERCENT);
    if (BEASTWOOD_SPECIES.includes(id)) cap = scale(cap, BEASTWOOD_SPECIES_FACTOR_PERCENT);
  }
  if (host.traits.includes('serene_vale') && host.facts.dietOf(species) === 'grazer') {
    cap = scale(cap, SERENE_VALE_HERBIVORE_FACTOR_PERCENT);
  }
  if (host.traits.includes('frostmarrow') && id === FROSTMARROW_SNOW_LEOPARD && cap > 0) cap += FROSTMARROW_SNOW_LEOPARD_CAP_BONUS;
  return cap;
}

/**
 * The wild surface species of the region in a season, `[species, weight]`, ascending species: the
 * biome's list, and on a `frostmarrow` map the wild yak (T-445).
 */
export function regionSurfaceSpecies(host: Pick<SpawnHost, 'facts' | 'biome' | 'traits'>, season: number): (readonly [number, number])[] {
  const list = host.facts.surfaceSpecies(host.biome, season);
  if (!host.traits.includes('frostmarrow')) return list;
  const yak = host.facts.indexOf(FROSTMARROW_YAK);
  if (yak <= 0 || list.some(([s]) => s === yak)) return list;
  return [...list, [yak, FROSTMARROW_YAK_WEIGHT] as const].sort((a, b) => a[0] - b[0]);
}

/** The cavern fauna cap of a species: the row's own `cap`, ×1.5 with `fungal_depths`. */
export function cavernCap(host: SpawnHost, species: number): number {
  const row = host.facts.row(species);
  const base = row?.cavern?.cap ?? 0;
  return host.traits.includes('fungal_depths') ? scale(base, FUNGAL_DEPTHS_CAVERN_FACTOR_PERCENT) : base;
}

/** The group size of a spawn; `beastwood` doubles the wolf's and the bear's. */
export function groupSize(host: SpawnHost, species: number): number {
  const row = host.facts.row(species);
  const frostYak = host.traits.includes('frostmarrow') && host.facts.idOf(species) === FROSTMARROW_YAK;
  const [lo, hi] = frostYak ? FROSTMARROW_YAK_GROUP : row?.group ?? [1, 1];
  const n = host.rng.int(lo, hi);
  const doubled = host.traits.includes('beastwood') && BEASTWOOD_SPECIES.includes(host.facts.idOf(species));
  return doubled ? n * BEASTWOOD_SPECIES_FACTOR_PERCENT / 100 : n;
}

/** Chebyshev distance on the x/y plane. */
function planarDistance(map: Map3D, a: TileIndex, b: TileIndex): number {
  return Math.max(Math.abs(map.xOf(a) - map.xOf(b)), Math.abs(map.yOf(a) - map.yOf(b)));
}

/** "at least `SPAWN_MIN_DISTANCE` from any dwarf". */
export function farFromDwarves(host: SpawnHost, tile: TileIndex): boolean {
  for (const d of host.dwarfTiles()) if (planarDistance(host.map, tile, d) < SPAWN_MIN_DISTANCE) return false;
  return true;
}

/** Every walkable outdoor tile on a map edge column, for a movement class. */
export function edgeSpawnTiles(host: SpawnHost, cls: MovementClass): TileIndex[] {
  const map = host.map;
  const out: TileIndex[] = [];
  const consider = (x: number, y: number): void => {
    const z = map.columnSurfaceZ(x, y);
    if (z < 0) return;
    const i = map.index(x, y, z);
    if (!map.hasFlag(i, TileFlag.Outdoor)) return;
    if (!host.pathing.passable(i, cls)) return;
    if (!farFromDwarves(host, i)) return;
    out.push(i);
  };
  for (let x = 0; x < map.w; x += 1) {
    consider(x, 0);
    consider(x, map.h - 1);
  }
  for (let y = 1; y < map.h - 1; y += 1) {
    consider(0, y);
    consider(map.w - 1, y);
  }
  return out;
}

/** The tiles around an anchor a group spawns on, the anchor first. */
export function groupTiles(host: SpawnHost, anchor: TileIndex, n: number, cls: MovementClass): TileIndex[] {
  const map = host.map;
  const out: TileIndex[] = [anchor];
  const x = map.xOf(anchor);
  const y = map.yOf(anchor);
  const z = map.zOf(anchor);
  for (let r = 1; r <= 3 && out.length < n; r += 1) {
    for (let dy = -r; dy <= r && out.length < n; dy += 1) {
      for (let dx = -r; dx <= r && out.length < n; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!map.inBounds(x + dx, y + dy, z)) continue;
        const i = map.index(x + dx, y + dy, z);
        if (out.includes(i) || !host.pathing.passable(i, cls)) continue;
        out.push(i);
      }
    }
  }
  return out;
}

export interface SpawnedGroup {
  readonly species: number;
  readonly ids: readonly EntityId[];
}

/** The content's initial individuals, once at first breach; ordinary caps still apply. */
export function initialCavernSpawn(host: SpawnHost, tier: number): SpawnedGroup[] {
  const out: SpawnedGroup[] = [];
  for (const [species] of host.facts.cavernSpecies(tier)) {
    const initial = host.facts.row(species)?.cavern?.initial ?? 0;
    const n = Math.min(initial, Math.max(0, cavernCap(host, species) - host.countWild(species)),
      Math.max(0, MAX_CREATURES - host.creatureCount()));
    if (n <= 0) continue;
    const cls = (host.facts.row(species)?.movementClass ?? 'walker') as MovementClass;
    const pool = host.cavernTiles(tier).filter((tile) => host.pathing.passable(tile, cls));
    if (pool.length === 0) continue;
    const ids: EntityId[] = [];
    for (let k = 0; k < n; k++) ids.push(host.spawn(species, pool[host.rng.int(0, pool.length - 1)] as TileIndex));
    out.push({ species, ids });
  }
  return out;
}

/**
 * One day's wild spawning, surface and breached caverns, at `tick`. A dangerous species draws nothing
 * while dangerous species keep quiet; one whose group arrives starts the quiet spell (T-545).
 */
export function dailySpawn(host: SpawnHost, season: number, tick: number): SpawnedGroup[] {
  const out: SpawnedGroup[] = [];
  const surface = regionSurfaceSpecies(host, season);
  let edges: TileIndex[] | null = null;
  for (const [species, weight] of surface) {
    const dangerous = host.facts.isDangerous(species);
    if (dangerous && dangerousQuiet(host, tick)) continue;
    const cap = surfaceCap(host, species, weight);
    if (cap <= 0 || host.countWild(species) >= cap) continue;
    if (host.creatureCount() >= MAX_CREATURES) break;
    if (!host.rng.chance(spawnPermille(weight))) continue;
    const cls = (host.facts.row(species)?.movementClass ?? 'walker') as MovementClass;
    edges ??= edgeSpawnTiles(host, 'walker');
    const pool = cls === 'walker' ? edges : edgeSpawnTiles(host, cls);
    if (pool.length === 0) continue;
    const anchor = pool[host.rng.int(0, pool.length - 1)] as TileIndex;
    const group = spawnGroup(host, species, anchor, cls, cap);
    if (dangerous && group.ids.length > 0) host.lastDangerousTick = tick;
    out.push(group);
  }
  for (const tier of host.breachedCaverns()) {
    const tiles = host.cavernTiles(tier);
    if (tiles.length === 0) continue;
    for (const [species, weight] of host.facts.cavernSpecies(tier)) {
      const cap = cavernCap(host, species);
      if (cap <= 0 || host.countWild(species) >= cap) continue;
      if (host.creatureCount() >= MAX_CREATURES) break;
      if (!host.rng.chance(spawnPermille(weight))) continue;
      const cls = (host.facts.row(species)?.movementClass ?? 'walker') as MovementClass;
      const anchor = tiles[host.rng.int(0, tiles.length - 1)] as TileIndex;
      out.push(spawnGroup(host, species, anchor, cls, cap));
    }
  }
  return out.filter((g) => g.ids.length > 0);
}

function spawnGroup(host: SpawnHost, species: number, anchor: TileIndex, cls: MovementClass, cap: number): SpawnedGroup {
  const room = Math.max(0, cap - host.countWild(species));
  const n = Math.min(groupSize(host, species), room, Math.max(0, MAX_CREATURES - host.creatureCount()));
  const ids: EntityId[] = [];
  for (const tile of groupTiles(host, anchor, n, cls)) {
    if (ids.length >= n) break;
    ids.push(host.spawn(species, tile));
  }
  return { species, ids };
}

/**
 * The wild animals that should walk off the map: over their species cap, or on the map longer
 * than `WILD_LIFETIME_DAYS`.
 */
export function leavers(host: SpawnHost, season: number, tick: number, wild: readonly EntityId[], entities: { get(id: EntityId): { species: number; arrivedTick: number } | undefined }): EntityId[] {
  const caps = new Map<number, number>();
  for (const [species, weight] of regionSurfaceSpecies(host, season)) caps.set(species, surfaceCap(host, species, weight));
  const over = new Map<number, number>();
  const out: EntityId[] = [];
  const lifetime = WILD_LIFETIME_DAYS * TICKS_PER_DAY;
  for (const id of wild) {
    const info = entities.get(id);
    if (info === undefined) continue;
    if (tick - info.arrivedTick > lifetime) {
      out.push(id);
      continue;
    }
    const row = host.facts.row(info.species);
    const cap = row?.cavern !== undefined ? cavernCap(host, info.species) : (caps.get(info.species) ?? 0);
    const seen = (over.get(info.species) ?? 0) + 1;
    over.set(info.species, seen);
    if (seen > cap) out.push(id);
  }
  return out;
}

/** A living creature of the fortress-visible world, for `MAX_CREATURES`. */
export function livingCreatures(entities: { with(...types: unknown[]): EntityId[] }): number {
  return (entities.with(C.Creature) as EntityId[]).length;
}
