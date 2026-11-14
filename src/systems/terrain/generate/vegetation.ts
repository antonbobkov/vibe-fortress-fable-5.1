/**
 * Stage 9: trees and vegetation. `03-terrain-and-mining.md` § Local map generation stage 9;
 * `algorithms/local-map-generation.md` step 7; species weights from `03-content/plants.md`.
 */

import type { Fixed } from '@core/fixed';
import { FluidType, TileFlag, TileKind } from '@core/map3d';
import {
  CAVE_SHRUB_DENSITY,
  CAVE_TREE_DENSITY,
  CONVERT_SHALLOW_MAX,
  CONVERT_WATER_RADIUS,
  GLASSLANDS_TREE_DENSITY,
  RIVER_TREE_CLEARANCE,
} from '../constants';
import { COL_LAKE, COL_RIVER, hasTrait, materialIndex, stageStream, type LocalGen } from './common';

interface PlantRow {
  readonly id: string;
  readonly kind: string;
  readonly biomes?: readonly { readonly biome: string; readonly weight: number }[];
  readonly caverns?: readonly { readonly tier: number; readonly weight: number }[];
  readonly rarePermille?: readonly [number, number, number];
}

interface BiomeRow {
  readonly id: string;
  readonly treeDensity: Fixed;
  readonly shrubDensity: Fixed;
}

/** `fungal_depths` (07 hook): "cavern shrub density ×2". */
export const FUNGAL_SHRUB_FACTOR = 2;

type Weighted = (readonly [number, number])[];

function speciesFor(g: LocalGen, kinds: readonly string[], pick: (p: PlantRow) => number): Weighted {
  const plants = g.registry.table<PlantRow>('plants');
  const out: Weighted = [];
  for (const id of plants.ids()) {
    const p = plants.byId(id) as PlantRow;
    if (!kinds.includes(p.kind)) continue;
    const w = pick(p);
    if (w > 0) out.push([materialIndex(g, id), w]);
  }
  return out;
}

/** The surface tree density of a spec: the biome's, or `glasslands`' own. */
export function surfaceTreeDensity(traits: readonly string[], biome: { readonly treeDensity: Fixed } | undefined): Fixed {
  return traits.includes('glasslands') ? GLASSLANDS_TREE_DENSITY : (biome?.treeDensity ?? 0);
}

export function stageVegetation(g: LocalGen): void {
  const st = stageStream(g.s, 'terrain.plants');
  const map = g.map;
  const biome = g.registry.table<BiomeRow>('biomes').byId(g.spec.biome);
  const treeDensity = surfaceTreeDensity(g.spec.traits, biome);
  const shrubDensity = biome?.shrubDensity ?? 0;
  const byBiome = (p: PlantRow): number => p.biomes?.find((b) => b.biome === g.spec.biome)?.weight ?? 0;
  const trees = speciesFor(g, ['tree'], byBiome);
  const shrubs = speciesFor(g, ['shrub'], byBiome);
  const willows = speciesFor(g, ['tree'], (p) => p.biomes?.find((b) => b.biome === 'riverbank')?.weight ?? 0);
  const materials = g.registry.table<{ id: string; class: string }>('materials');

  // Columns within RIVER_TREE_CLEARANCE of a river column.
  const nearRiver = new Uint8Array(g.w * g.h);
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      if (((g.colFlags[y * g.w + x] as number) & COL_RIVER) === 0) continue;
      for (let dy = -RIVER_TREE_CLEARANCE; dy <= RIVER_TREE_CLEARANCE; dy += 1) {
        for (let dx = -RIVER_TREE_CLEARANCE; dx <= RIVER_TREE_CLEARANCE; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < g.w && ny < g.h) nearRiver[ny * g.w + nx] = 1;
        }
      }
    }
  }

  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const c = y * g.w + x;
      if (((g.colFlags[c] as number) & (COL_RIVER | COL_LAKE)) !== 0 || g.bare[c] === 1) continue;
      const i = map.index(x, y, g.heights[c] as number);
      if (map.kindAt(i) !== TileKind.Floor || map.fluidLevelAt(i) > 0) continue;
      if (materials.byIndex(map.materialAt(i))?.class !== 'soil') continue;
      if (nearRiver[c] === 1) {
        // "Trees are not placed within 2 tiles of the river bed except willows."
        if (st.fixed() < treeDensity && willows.length > 0) {
          map.kind[i] = TileKind.Tree;
          map.material[i] = st.weighted(willows);
        } else {
          map.flags[i] = (map.flags[i] as number) | TileFlag.Grass;
        }
        continue;
      }
      if (st.fixed() < treeDensity && trees.length > 0) {
        map.kind[i] = TileKind.Tree;
        map.material[i] = st.weighted(trees);
      } else if (st.fixed() < shrubDensity && shrubs.length > 0) {
        map.kind[i] = TileKind.Shrub;
        map.material[i] = st.weighted(shrubs);
      } else {
        map.flags[i] = (map.flags[i] as number) | TileFlag.Grass;
      }
    }
  }

  // Cavern floors of cave loam: fungus trees 0.12 and cave shrubs 0.08, by cavern weights.
  const caveLoam = materialIndex(g, 'cave_loam');
  const caveShrubDensity = CAVE_SHRUB_DENSITY * (hasTrait(g, 'fungal_depths') ? FUNGAL_SHRUB_FACTOR : 1);
  for (let tier = 1; tier <= 3; tier += 1) {
    const byTier = (p: PlantRow): number => p.caverns?.find((c) => c.tier === tier)?.weight ?? 0;
    const fungi = speciesFor(g, ['fungus_tree'], byTier);
    const caveShrubs = speciesFor(g, ['shrub'], byTier);
    for (const i of g.cavernFloors[tier] ?? []) {
      if (map.kindAt(i) !== TileKind.Floor || map.materialAt(i) !== caveLoam || map.fluidLevelAt(i) > 0) continue;
      if (st.fixed() < CAVE_TREE_DENSITY && fungi.length > 0) {
        map.kind[i] = TileKind.Tree;
        map.material[i] = st.weighted(fungi);
      } else if (st.fixed() < caveShrubDensity && caveShrubs.length > 0) {
        map.kind[i] = TileKind.Shrub;
        map.material[i] = st.weighted(caveShrubs);
      }
      // `07` § Grass ("cavern `cave_loam` floors start with `grass`") is already done by stage 6:
      // every cave loam floor is laid with the flag (see `caverns.ts`).
    }
  }
}

/** `plants.md` § Conversions: the tile kinds a conversion pass may take. */
export type ConvertTile = 'shrub' | 'tree' | 'grass' | 'sand' | 'dry_soil' | 'rock' | 'near_water' | 'shallow' | 'ash_soil';

interface ConvertRow {
  readonly id: string;
  readonly convert?: {
    readonly tiles: readonly { readonly tile: ConvertTile; readonly permille: number }[];
    readonly any?: boolean;
    readonly biomes?: readonly { readonly biome: string; readonly times?: number; readonly permille?: number }[];
  };
}

/** Columns within `CONVERT_WATER_RADIUS` of a wet column (a river, lake or sea column). */
function nearWaterColumns(g: LocalGen): Uint8Array {
  const near = new Uint8Array(g.w * g.h);
  const r = CONVERT_WATER_RADIUS;
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      if ((g.waterTop[y * g.w + x] as number) <= 0) continue;
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < g.w && ny < g.h) near[ny * g.w + nx] = 1;
        }
      }
    }
  }
  return near;
}

/**
 * `03` § Local map generation, the conversions that end stage 10; `plants.md` § Conversions. After
 * every other stage but lighting, one pass per conversion row, each on its own stream
 * (`terrain.convert.<id>`): every eligible surface tile, in column order, turns into the row's
 * plant with the row's permille. A converted tile is not eligible again. The main stage-9 stream
 * draws what it drew before, so a map changes only on converted tiles; a biome a row does not
 * name draws nothing.
 */
export function stageConversions(g: LocalGen): void {
  const plants = g.registry.table<ConvertRow>('plants');
  const rows = plants.ids().map((id) => plants.byId(id) as ConvertRow).filter((p) => p.convert !== undefined);
  if (rows.length === 0) return;
  const map = g.map;
  const materials = g.registry.table<{ id: string; class: string }>('materials');
  const classOf = (m: number): string => materials.byIndex(m)?.class ?? '';
  const sand = materials.has('sand') ? materials.index('sand') : -1;
  const ashSoil = materials.has('ash_soil') ? materials.index('ash_soil') : -1;
  const converted = new Uint8Array(g.w * g.h);
  let nearWater: Uint8Array | null = null;
  for (const row of rows) {
    const conv = row.convert;
    if (conv === undefined) continue;
    const entry = conv.biomes?.find((b) => b.biome === g.spec.biome);
    if (conv.any !== true && entry === undefined) continue;
    const times = entry?.times ?? 1;
    const tiles = conv.tiles
      .map((t) => ({ tile: t.tile, permille: (entry?.permille ?? t.permille) * times }))
      .filter((t) => t.permille > 0);
    if (tiles.length === 0) continue;
    if (nearWater === null && tiles.some((t) => t.tile === 'near_water')) nearWater = nearWaterColumns(g);
    const st = stageStream(g.s, `terrain.convert.${row.id}`);
    const species = materialIndex(g, row.id);
    for (let y = 0; y < g.h; y += 1) {
      for (let x = 0; x < g.w; x += 1) {
        const c = y * g.w + x;
        if (converted[c] === 1) continue;
        const i = map.index(x, y, g.heights[c] as number);
        const kind = map.kindAt(i);
        const level = map.fluidLevelAt(i);
        const water = level > 0 && map.fluidTypeAt(i) === FluidType.Water;
        const dry = (g.waterTop[c] as number) <= 0 && level === 0;
        const m = map.materialAt(i);
        const floor = kind === TileKind.Floor;
        const soil = floor && classOf(m) === 'soil';
        const grass = soil && map.hasFlag(i, TileFlag.Grass);
        let permille = 0;
        for (const t of tiles) {
          let ok = false;
          switch (t.tile) {
            case 'shrub': ok = kind === TileKind.Shrub; break;
            case 'tree': ok = kind === TileKind.Tree; break;
            case 'grass': ok = grass && dry; break;
            case 'sand': ok = floor && m === sand && dry; break;
            case 'dry_soil': ok = soil && dry; break;
            case 'rock': ok = floor && classOf(m) === 'stone' && dry; break;
            case 'near_water': ok = nearWater?.[c] === 1 && level === 0 && (grass || kind === TileKind.Shrub); break;
            case 'shallow': ok = soil && water && level <= CONVERT_SHALLOW_MAX; break;
            case 'ash_soil': ok = floor && m === ashSoil; break;
          }
          if (ok) {
            permille = t.permille;
            break;
          }
        }
        if (permille === 0 || !st.chance(permille)) continue;
        converted[c] = 1;
        // An ironwood keeps its tree's tile: only the species changes.
        if (kind !== TileKind.Tree) {
          map.kind[i] = TileKind.Shrub;
          map.flags[i] = (map.flags[i] as number) & ~(TileFlag.Grass | TileFlag.Snow);
        }
        map.material[i] = species;
      }
    }
  }
}

/**
 * `03-content/plants.md` § Rare cave patches: each rare species takes over its permille of the cave
 * shrubs already placed, tier by tier, on its own stream, so the main stream draws the same numbers.
 */
export function stageRarePatches(g: LocalGen): void {
  const plants = g.registry.table<PlantRow>('plants');
  const rare = plants.ids().map((id) => plants.byId(id) as PlantRow).filter((p) => p.rarePermille !== undefined);
  if (rare.length === 0) return;
  const st = stageStream(g.s, 'terrain.rare_patches');
  const map = g.map;
  for (let tier = 1; tier <= 3; tier += 1) {
    for (const i of g.cavernFloors[tier] ?? []) {
      if (map.kindAt(i) !== TileKind.Shrub) continue;
      for (const p of rare) {
        if (!st.chance(p.rarePermille?.[tier - 1] ?? 0)) continue;
        map.material[i] = materialIndex(g, p.id);
        break;
      }
    }
  }
}
