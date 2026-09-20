/**
 * The daily pass over the wild plants: `02-systems/07-plants-and-farming.md` § Trees, § Shrubs,
 * § Grass, § Ash, and `algorithms/environment.md` § Plant growth ("daily: saplings … regrowth
 * tries; grass regrowth over `bareSoil`; shrub timers; ash expiry").
 *
 * ```
 * saplings: age ≥ saplingYears → Tree, SaplingGrew
 * regrowth: REGROWTH_TRIES_PER_DAY random outdoor soil floors with grass and no tree or sapling
 *           within 2 tiles → a sapling of a biome species with biome.treeDensity × REGROWTH_PERMILLE
 *           (cavern floors do the same for fungus trees inside the cavern bands)
 * grass:    every bareSoil tile with a cardinal grass neighbour regrows with GRASS_REGROW_PERMILLE,
 *           except outdoors in winter and on ash or snow
 * shrubs:   a regrowing shrub is mature again at its timer; ash clears after ASH_DURATION_DAYS
 * ```
 *
 * Every tile change goes through the terrain API, inside 07's own tick (D-089).
 */

import {
  CAVERN_1_Z_MAX,
  CAVERN_1_Z_MIN,
  CAVERN_2_Z_MAX,
  CAVERN_2_Z_MIN,
  CAVERN_3_Z_MAX,
  CAVERN_3_Z_MIN,
  TICKS_PER_YEAR,
} from '@core/constants';
import { TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { RngStream } from '@core/rng';
import type { TerrainApi } from '@core/system';
import type { TileIndex } from '@core/types';
import { GRASS_REGROW_PERMILLE, REGROWTH_PERMILLE, REGROWTH_TRIES_PER_DAY, SAPLING_CLEARANCE } from './constants';
import type { PlantFacts } from './facts';

/** The three cavern bands of `constants.md`, shallowest first. */
export const CAVERN_BANDS: readonly (readonly [number, number, number])[] = Object.freeze([
  [1, CAVERN_1_Z_MIN, CAVERN_1_Z_MAX],
  [2, CAVERN_2_Z_MIN, CAVERN_2_Z_MAX],
  [3, CAVERN_3_Z_MIN, CAVERN_3_Z_MAX],
]);

/** `03-content/regions-biomes-and-traits.md`: the winter season index. */
export const WINTER = 3;

export interface WildHost {
  readonly map: Map3D;
  readonly facts: PlantFacts;
  readonly rng: RngStream;
  readonly terrain: TerrainApi;
  readonly tick: number;
  readonly season: number;
  /** Material class of a tile material (`soil`, `stone`, …). */
  classOf(material: number): string;
  /** The `cave_loam` material index, or -1. */
  readonly caveLoam: number;
  /** `biome.treeDensity` as a Fixed (0…1000), after the region traits. */
  readonly treeDensity: number;
  /** Species weights for surface trees: `[plantIndex, weight]`, ascending plant index. */
  readonly treeWeights: readonly (readonly [number, number])[];
  /** Species weights for fungus trees per cavern tier. */
  fungusWeights(tier: number): readonly (readonly [number, number])[];
  /** A tile belongs to a farm plot, a road or a constructed floor: nothing spreads onto it. */
  isReserved(i: TileIndex): boolean;
}

/** `rng.weighted` over `[value, weight]` pairs; 0 when the list is empty. */
export function weighted(rng: RngStream, pairs: readonly (readonly [number, number])[]): number {
  let total = 0;
  for (const [, w] of pairs) total += w;
  if (total <= 0) return 0;
  let roll = rng.int(0, total - 1);
  for (const [value, w] of pairs) {
    roll -= w;
    if (roll < 0) return value;
  }
  return pairs[pairs.length - 1]?.[0] ?? 0;
}

/** "no tree or sapling within 2 tiles" (Chebyshev, same level). */
export function clearOfTrees(map: Map3D, i: TileIndex, radius = SAPLING_CLEARANCE): boolean {
  const x = map.xOf(i);
  const y = map.yOf(i);
  const z = map.zOf(i);
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      if (!map.inBounds(x + dx, y + dy, z)) continue;
      const k = map.kindAt(map.index(x + dx, y + dy, z));
      if (k === TileKind.Tree || k === TileKind.Sapling) return false;
    }
  }
  return true;
}

/** A tile a sapling may take: a floor of soil (or cave loam) with grass, nothing built on it. */
export function plantable(host: WildHost, i: TileIndex, cave: boolean): boolean {
  const map = host.map;
  if (!map.validIndex(i) || map.kindAt(i) !== TileKind.Floor) return false;
  if (map.hasFlag(i, TileFlag.Constructed) || map.hasFlag(i, TileFlag.Ash)) return false;
  if (!map.hasFlag(i, TileFlag.Grass)) return false;
  if (map.fluidLevelAt(i) > 0) return false;
  const m = map.materialAt(i);
  if (cave ? m !== host.caveLoam : host.classOf(m) !== 'soil') return false;
  if (cave === map.hasFlag(i, TileFlag.Outdoor)) return false;
  if (host.isReserved(i)) return false;
  return clearOfTrees(map, i);
}

/** `SaplingGrew` for every sapling old enough; the map is written through the terrain API. */
export function growSaplings(host: WildHost, saplings: Map<TileIndex, number>): { tile: TileIndex; species: string }[] {
  const grown: { tile: TileIndex; species: string }[] = [];
  if (saplings.size === 0) return grown;
  for (const tile of Array.from(saplings.keys()).sort((a, b) => a - b)) {
    if (host.map.kindAt(tile) !== TileKind.Sapling) {
      saplings.delete(tile);
      continue;
    }
    const material = host.map.materialAt(tile);
    const plant = host.facts.plantOfMaterial(material);
    const years = host.facts.saplingYearsOf(plant);
    if (host.tick - (saplings.get(tile) as number) < years * TICKS_PER_YEAR) continue;
    saplings.delete(tile);
    host.terrain.setKind(tile, TileKind.Tree, material);
    grown.push({ tile, species: host.facts.row(plant)?.id ?? '' });
  }
  return grown;
}

/**
 * The regrowth tries of one day: `REGROWTH_TRIES_PER_DAY` random surface columns and the same
 * number of random cavern tiles. Returns the tiles a sapling was planted on.
 */
export function regrowthTries(host: WildHost, saplings: Map<TileIndex, number>): TileIndex[] {
  const map = host.map;
  const rng = host.rng;
  const planted: TileIndex[] = [];
  const permille = Math.floor((host.treeDensity * REGROWTH_PERMILLE) / 1000);
  if (permille > 0 && host.treeWeights.length > 0) {
    for (let k = 0; k < REGROWTH_TRIES_PER_DAY; k += 1) {
      const x = rng.int(0, map.w - 1);
      const y = rng.int(0, map.h - 1);
      const z = map.columnSurfaceZ(x, y);
      if (z < 0) continue;
      const i = map.index(x, y, z);
      if (!plantable(host, i, false)) continue;
      if (!rng.chance(permille)) continue;
      const plant = weighted(rng, host.treeWeights);
      if (plant === 0) continue;
      host.terrain.setKind(i, TileKind.Sapling, host.facts.materialOf(plant));
      saplings.set(i, host.tick);
      planted.push(i);
    }
  }
  for (let k = 0; k < REGROWTH_TRIES_PER_DAY; k += 1) {
    const band = CAVERN_BANDS[rng.int(0, CAVERN_BANDS.length - 1)] as readonly [number, number, number];
    const weights = host.fungusWeights(band[0]);
    if (weights.length === 0) continue;
    const x = rng.int(0, map.w - 1);
    const y = rng.int(0, map.h - 1);
    const z = rng.int(band[1], band[2]);
    const i = map.index(x, y, z);
    if (!plantable(host, i, true)) continue;
    if (!rng.chance(REGROWTH_PERMILLE)) continue;
    const plant = weighted(rng, weights);
    if (plant === 0) continue;
    host.terrain.setKind(i, TileKind.Sapling, host.facts.materialOf(plant));
    saplings.set(i, host.tick);
    planted.push(i);
  }
  return planted;
}

/** A cardinal neighbour on the same level carries grass. */
export function hasGrassNeighbor(map: Map3D, i: TileIndex): boolean {
  const x = map.xOf(i);
  const y = map.yOf(i);
  const z = map.zOf(i);
  const around: readonly (readonly [number, number])[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of around) {
    if (!map.inBounds(x + dx, y + dy, z)) continue;
    if (map.hasFlag(map.index(x + dx, y + dy, z), TileFlag.Grass)) return true;
  }
  return false;
}

/**
 * "every tile in `bareSoil` … with at least one cardinal `grass` neighbor regrows with
 * `GRASS_REGROW_PERMILLE`, except outdoors in winter and on `ash` or `snow` tiles". The regrown
 * tiles leave `bareSoil`; so do tiles that stopped qualifying.
 */
export function regrowGrass(host: WildHost, bareSoil: TileIndex[]): TileIndex[] {
  if (bareSoil.length === 0) return [];
  const map = host.map;
  const regrown: TileIndex[] = [];
  const keep: TileIndex[] = [];
  for (const i of bareSoil) {
    if (!map.validIndex(i) || map.kindAt(i) !== TileKind.Floor || map.hasFlag(i, TileFlag.Grass)) continue;
    const m = map.materialAt(i);
    const outdoor = map.hasFlag(i, TileFlag.Outdoor);
    if (outdoor ? host.classOf(m) !== 'soil' : m !== host.caveLoam) continue;
    if (map.hasFlag(i, TileFlag.Constructed) || host.isReserved(i)) continue;
    keep.push(i);
    if (map.hasFlag(i, TileFlag.Ash) || map.hasFlag(i, TileFlag.Snow)) continue;
    if (outdoor && host.season === WINTER) continue;
    if (!hasGrassNeighbor(map, i)) continue;
    if (!host.rng.chance(GRASS_REGROW_PERMILLE)) continue;
    host.terrain.setFlag(i, TileFlag.Grass, true);
    regrown.push(i);
    keep.pop();
  }
  bareSoil.length = 0;
  bareSoil.push(...keep);
  return regrown;
}
