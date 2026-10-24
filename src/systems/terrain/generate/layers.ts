/**
 * Stages 3 and 4: soil and rock layers, and the walkable surface. `03-terrain-and-mining.md`
 * § Local map generation stages 3-4; `algorithms/local-map-generation.md` step 3 (`rollStack`,
 * `layerAt`); `03-content/minerals-and-metals.md` § Geology layer templates.
 */

import { MAGMA_SEA_TOP_Z } from '@core/constants';
import { FIXED_SCALE } from '@core/fixed';
import { TileKind } from '@core/map3d';
import { noise2 } from '@core/noise';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import type { LocalMapSpec } from '@systems/embark';
import { COL_LAKE, COL_RIVER, clamp, hasTrait, materialIndex, stageStream, type LocalGen, type StackLayer } from './common';

interface TemplateRow {
  readonly id: string;
  readonly layers: readonly { readonly material: string; readonly min: number; readonly max: number }[];
}

interface BiomeRow {
  readonly id: string;
  readonly soil: readonly { readonly material: string; readonly weight: number }[];
}

/** `rollStack`: "append the basement (`granite` 6–10, `gneiss` 4–6) repeated until total ≥ D". */
export const BASEMENT: readonly { readonly material: string; readonly min: number; readonly max: number }[] = [
  { material: 'granite', min: 6, max: 10 },
  { material: 'gneiss', min: 4, max: 6 },
];

/** `glasslands`: "the first rock layer is `basalt` 4–6" (`minerals-and-metals.md`). */
export const GLASSLANDS_FIRST_LAYER = { material: 'basalt', min: 4, max: 6 } as const;

/** `serene_vale` (03 hook): "soil depth +2, `loam` only". */
export const SERENE_VALE_SOIL_BONUS = 2;

/** The undulation noise: one octave, period 24, amplitude 2, minus 1: −1 … +1. */
export const UNDULATION_PERIOD = 24;
export const UNDULATION_AMP = 2;

/**
 * `rollStack(geology, st)`: every template layer with a thickness rolled from its range, then the
 * basement pairs until the stack is at least `depth` levels thick.
 */
export function rollStack(registry: Registry, geology: string, st: RngStream, depth: number, glasslands = false): StackLayer[] {
  const template = registry.table<TemplateRow>('geologyTemplates').byId(geology);
  if (template === undefined) throw new RangeError(`no geology template ${geology}`);
  const stack: StackLayer[] = [];
  if (glasslands) {
    stack.push({ material: GLASSLANDS_FIRST_LAYER.material, thickness: st.int(GLASSLANDS_FIRST_LAYER.min, GLASSLANDS_FIRST_LAYER.max) });
  }
  for (const layer of template.layers) stack.push({ material: layer.material, thickness: st.int(layer.min, layer.max) });
  let total = stack.reduce((n, l) => n + l.thickness, 0);
  while (total < depth) {
    for (const layer of BASEMENT) {
      const thickness = st.int(layer.min, layer.max);
      stack.push({ material: layer.material, thickness });
      total += thickness;
    }
  }
  return stack;
}

/** The index of the layer at `depth` below the first rock level (0); past the end, the last. */
export function layerIndexAt(stack: readonly StackLayer[], depth: number): number {
  let d = Math.max(0, depth);
  for (let k = 0; k < stack.length; k += 1) {
    const t = (stack[k] as StackLayer).thickness;
    if (d < t) return k;
    d -= t;
  }
  return stack.length - 1;
}

/** `layerAt(stack, depth)`: walk the stack summing thicknesses; depth 0 is the first rock level. */
export function layerAt(stack: readonly StackLayer[], depth: number): string {
  return (stack[layerIndexAt(stack, depth)] as StackLayer).material;
}

/** The soil depth a spec gives: the biome's, `+2` on `serene_vale`. */
export function specSoilDepth(spec: Pick<LocalMapSpec, 'soilDepth' | 'traits'>): number {
  return spec.soilDepth + (spec.traits.includes('serene_vale') ? SERENE_VALE_SOIL_BONUS : 0);
}

/** The soil depth of the map: the biome's, `+2` on `serene_vale`. */
export function soilDepthOf(g: LocalGen): number {
  return specSoilDepth(g.spec);
}

/**
 * Stages 3 and 4. For every column: rock from the top of the Sea of Fire's roof up to the soil,
 * with the stack anchored at the column's surface and undulating ±1; `soilDepth` levels of soil
 * (weighted per tile from the biome; `loam` only on `serene_vale`; `obsidian` on `glasslands`); in
 * a wet column the soil levels take the stone just below them, so the bed is stone; the column's
 * top tile is the walkable `Floor` and everything above it is open.
 */
export function stageColumns(g: LocalGen): void {
  const glass = hasTrait(g, 'glasslands');
  const layerStream = stageStream(g.s, 'terrain.layers');
  g.stack = rollStack(g.registry, g.spec.geology, layerStream, g.d, glass);
  const soilStream = stageStream(g.s, 'terrain.soil');
  const undulationSalt = stageStream(g.s, 'terrain.undulation').nextU32();

  const biome = g.registry.table<BiomeRow>('biomes').byId(g.spec.biome);
  const soilChoices: (readonly [number, number])[] = hasTrait(g, 'serene_vale')
    ? [[materialIndex(g, 'loam'), 1]]
    : (biome?.soil ?? []).map((s) => [materialIndex(g, s.material), s.weight] as const);
  const obsidian = materialIndex(g, 'obsidian');
  const soilDepth = soilDepthOf(g);
  const stackIdx = g.stack.map((l) => materialIndex(g, l.material));
  const rockAt = (depth: number): number => stackIdx[layerIndexAt(g.stack, depth)] as number;

  const map = g.map;
  const lowest = MAGMA_SEA_TOP_Z + 2;
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const c = y * g.w + x;
      const top = g.heights[c] as number;
      const wet = ((g.colFlags[c] as number) & (COL_RIVER | COL_LAKE)) !== 0;
      const soil = soilDepth;
      const n = noise2(undulationSalt, x, y, [UNDULATION_PERIOD], [UNDULATION_AMP]);
      const undulation = clamp(-1, 1, Math.round(n / FIXED_SCALE) - 1);
      for (let z = lowest; z < g.d; z += 1) {
        const i = map.index(x, y, z);
        if (z > top) {
          map.kind[i] = TileKind.Open;
          map.material[i] = 0;
        } else if (z > top - soil) {
          map.kind[i] = TileKind.Wall;
          // "Below the surface in a river bed the soil is replaced by the stone below."
          map.material[i] = wet
            ? rockAt(undulation)
            : glass
              ? obsidian
              : soilChoices.length > 0
                ? soilStream.weighted(soilChoices)
                : rockAt(undulation);
        } else {
          map.kind[i] = TileKind.Wall;
          map.material[i] = rockAt(top - soil - z + undulation);
        }
      }
      map.kind[map.index(x, y, top)] = TileKind.Floor;
    }
  }
}
