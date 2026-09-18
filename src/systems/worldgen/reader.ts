/**
 * The 01 world generation reader. `02-systems/01-world-generation.md` § Interfaces § Reader.
 */

import type { Civ } from '@core/types';
import type { RegionRecord, RiverRecord, WorldMap } from './state';

/** `world.findRegions(filter)`, the map filter panel's query. Every stated field must hold. */
export interface RegionFilter {
  readonly biomes?: readonly string[];
  readonly wealth?: readonly [number, number];
  readonly peril?: readonly [number, number];
  readonly temper?: readonly [number, number];
  /** `true`: on a river; `false`: not on one. */
  readonly river?: boolean;
  readonly volcano?: boolean;
  /** The region carries every listed trait. */
  readonly traits?: readonly string[];
}

export interface WorldgenReader {
  size(): number;
  region(id: number): RegionRecord | undefined;
  regionAt(x: number, y: number): RegionRecord | undefined;
  /** Frozen array in id order. */
  regions(): readonly RegionRecord[];
  civHome(civ: Civ): number;
  /** The first river (lowest id) that runs through the region, or `undefined`. */
  riverOf(regionId: number): RiverRecord | undefined;
  /** Matching regions in id order. */
  findRegions(filter: RegionFilter): readonly RegionRecord[];
}

function inRange(v: number, range: readonly [number, number] | undefined): boolean {
  return range === undefined || (v >= range[0] && v <= range[1]);
}

export function matchesFilter(r: RegionRecord, f: RegionFilter): boolean {
  if (f.biomes !== undefined && !f.biomes.includes(r.biome)) return false;
  if (!inRange(r.wealth, f.wealth) || !inRange(r.peril, f.peril) || !inRange(r.temper, f.temper)) return false;
  if (f.river !== undefined && (r.river !== null) !== f.river) return false;
  if (f.volcano !== undefined && r.volcano !== f.volcano) return false;
  if (f.traits !== undefined && !f.traits.every((t) => r.traits.includes(t))) return false;
  return true;
}

export function worldReader(world: WorldMap): WorldgenReader {
  return {
    size: () => world.size,
    region: (id) => world.regions[id],
    regionAt: (x, y) =>
      x < 0 || y < 0 || x >= world.size || y >= world.size ? undefined : world.regions[y * world.size + x],
    regions: () => world.regions,
    civHome: (civ) => world.civHomes[civ],
    riverOf: (regionId) => world.rivers.find((rv) => rv.regions.includes(regionId)),
    findRegions: (filter) => Object.freeze(world.regions.filter((r) => matchesFilter(r, filter))),
  };
}
