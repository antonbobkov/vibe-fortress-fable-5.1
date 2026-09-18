/**
 * Stage 9: names. `02-systems/01-world-generation.md` § Names; `03-content/names.md` § Region
 * names: `flavor + landform`, the flavor list chosen by the biome's group and the landform by
 * elevation and water.
 */

import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import type { GenRegion, GenWorld } from '../state';
import { elevBand, stageStream } from './common';

interface NamesTable {
  readonly regionFlavor: Readonly<Record<string, readonly string[]>>;
  readonly landform: Readonly<Record<string, readonly string[]>>;
}

/**
 * The flavor group of a biome: a group key is `|`-separated alternatives ("forest|dark
 * forest|tropical"); a biome belongs to the first group with an alternative equal to its id, or
 * to one of its `_`-separated words (`temperate_forest` → "forest", `cold_steppe` → "steppe").
 * `ocean` belongs to no group.
 */
export function flavorGroup(biome: string, groups: readonly string[]): string | null {
  const words = biome.split('_');
  for (const key of groups) {
    for (const alt of key.split('|')) {
      const a = alt.trim().replace(/\s+/g, '_');
      if (a === biome || words.includes(a)) return key;
    }
  }
  return null;
}

/** The landform of `names.md`: water (river or lake), high (mountain band), hills, low. */
export function landformOf(r: GenRegion): 'water' | 'high' | 'hills' | 'low' {
  if (r.river !== null || r.lake) return 'water';
  const band = elevBand(r.elevation);
  return band === 'mountain' ? 'high' : band === 'hills' ? 'hills' : 'low';
}

/**
 * `regionName(st, r)`: a flavor word joined to a lowercase landform word ("Coldmere"). A region
 * with no flavor group (the sea) has no name (DECISIONS.md D-042).
 */
export function regionName(st: RngStream, r: GenRegion, names: NamesTable): string {
  const group = flavorGroup(r.biome, Object.keys(names.regionFlavor));
  if (group === null) return '';
  const flavor = st.pick(names.regionFlavor[group] as readonly string[]);
  const landform = st.pick(names.landform[landformOf(r)] as readonly string[]);
  return `${flavor}${landform}`;
}

export function stageNames(g: GenWorld, registry: Registry): void {
  const st = stageStream(g.s, 'worldgen.names');
  const names = registry.derived<NamesTable>('names');
  for (const r of g.regions) r.name = regionName(st, r, names);
}
