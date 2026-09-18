/**
 * The 01 world generation reader. `02-systems/01-world-generation.md` § Interfaces § Reader.
 */

import type { WorldMap, RegionRecord } from './state';

export interface WorldgenReader {
  size(): number;
  region(id: number): RegionRecord | undefined;
  regionAt(x: number, y: number): RegionRecord | undefined;
  /** Frozen array in id order. */
  regions(): readonly RegionRecord[];
}

export function worldReader(world: WorldMap): WorldgenReader {
  return {
    size: () => world.size,
    region: (id) => world.regions[id],
    regionAt: (x, y) =>
      x < 0 || y < 0 || x >= world.size || y >= world.size ? undefined : world.regions[y * world.size + x],
    regions: () => world.regions,
  };
}
