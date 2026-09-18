/**
 * Stage 5: geology, volcanoes, deepness. `02-systems/01-world-generation.md` § Geology,
 * volcanoes, deepness; `algorithms/world-generation.md` step 5.
 */

import { noise2 } from '@core/noise';
import { HILLS_ELEVATION, MOUNTAIN_ELEVATION, VOLCANO_CHANCE_PERMILLE } from '../constants';
import type { Geology, GenWorld } from '../state';
import { clamp, roundFx, stageStream } from './common';

/** The elevation bias: mountains lean igneous and metamorphic, lowlands sedimentary. */
export const GEOLOGY_BIAS = 40;

/**
 * The buckets of the biased noise: `< 102` sedimentary, `< 166` igneous, `< 217` metamorphic,
 * else mixed (the 40 / 25 / 20 / 15 % weights of `01` over 0 … 255).
 */
export function geologyOf(g: number): Geology {
  return g < 102 ? 'sedimentary' : g < 166 ? 'igneous' : g < 217 ? 'metamorphic' : 'mixed';
}

export function stageGeology(g: GenWorld): void {
  const st = stageStream(g.s, 'worldgen.geology');
  const salt = st.nextU32();
  const deep = stageStream(g.s, 'worldgen.deepness');
  const deepSalt = deep.nextU32();
  for (const r of g.regions) {
    const n = roundFx(noise2(salt, r.x, r.y, [g.size / 12], [255]));
    const bias = r.elevation >= MOUNTAIN_ELEVATION ? GEOLOGY_BIAS : r.elevation < HILLS_ELEVATION ? -GEOLOGY_BIAS : 0;
    r.geology = geologyOf(clamp(0, 255, n + bias));
    r.volcano = (r.biome === 'mountain' || r.biome === 'alpine') && st.chance(VOLCANO_CHANCE_PERMILLE);
    if (r.volcano) r.geology = 'igneous';
    r.deepness = clamp(0, 255, roundFx(noise2(deepSalt, r.x, r.y, [g.size / 10], [255])));
  }
}
