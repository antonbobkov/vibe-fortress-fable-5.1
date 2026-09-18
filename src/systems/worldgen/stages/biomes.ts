/**
 * Stage 3: biomes. `02-systems/01-world-generation.md` § Biomes; `algorithms/world-generation.md`
 * step 3; the lookup table and its elevation overrides are content
 * (`03-content/regions-biomes-and-traits.md` § Biome lookup).
 */

import type { Registry } from '@core/registry';
import type { GenWorld } from '../state';
import { elevBand, rainBand, tempBand, type ElevBand, type RainBand, type TempBand } from './common';

interface LookupRow {
  readonly temp: string;
  readonly rain: string;
  readonly biome: string;
}

/** A biome lookup built once from the content table. */
export interface BiomeLookup {
  (temp: TempBand, rain: RainBand, elev: ElevBand): string;
}

/**
 * The lookup of `regions-biomes-and-traits.md` § Biome lookup: "the elevation band overrides:
 * `ocean` below `SEA_LEVEL`; `mountain` (temperate or warmer) and `alpine` (cold or frozen) for
 * `elevation ≥ MOUNTAIN_ELEVATION`; `temperate_hills` replaces `temperate_grassland` and
 * `temperate_forest` in the hills band."
 */
export function biomeLookup(registry: Registry): BiomeLookup {
  const rows = registry.derived<readonly LookupRow[]>('biomeLookup');
  const table = new Map<string, string>();
  for (const row of rows) table.set(`${row.temp}|${row.rain}`, row.biome);
  return (temp, rain, elev) => {
    if (elev === 'ocean') return 'ocean';
    if (elev === 'mountain') return temp === 'cold' || temp === 'frozen' ? 'alpine' : 'mountain';
    const base = table.get(`${temp}|${rain}`);
    if (base === undefined) throw new RangeError(`biome lookup has no cell ${temp} × ${rain}`);
    if (elev === 'hills' && (base === 'temperate_grassland' || base === 'temperate_forest')) return 'temperate_hills';
    return base;
  };
}

export function stageBiomes(g: GenWorld, registry: Registry): void {
  const lookup = biomeLookup(registry);
  for (const r of g.regions) r.biome = lookup(tempBand(r.tempC), rainBand(r.rain), elevBand(r.elevation));
}
