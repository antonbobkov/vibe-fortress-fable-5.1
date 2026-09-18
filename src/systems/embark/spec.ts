/**
 * The `LocalMapSpec`: `02-systems/02-embark-and-loadout.md` § Local map specification;
 * `schemas/system-state.md` (`LocalMapSpec`, `EmbarkState`).
 *
 * "03 generates the map from this and nothing else, so a region always generates the same local
 * map."
 */

import { hash64 } from '@core/noise';
import type { Registry } from '@core/registry';
import type { Civ, Edge } from '@core/types';
import type { RegionRecord, WorldMap } from '@systems/worldgen';

export interface LocalMapSpec {
  readonly seed: string;
  readonly regionId: number;
  readonly biome: string;
  readonly elevation: number;
  readonly relief: 0 | 1 | 2 | 3;
  readonly soilDepth: number;
  readonly geology: string;
  readonly wealth: number;
  readonly peril: number;
  readonly temper: number;
  readonly deepness: number;
  readonly traits: readonly string[];
  readonly volcano: boolean;
  readonly river: { readonly inflowEdges: readonly Edge[]; readonly outflowEdge: Edge | null; readonly class: string } | null;
  readonly lake: boolean;
  readonly civEdges: Readonly<Record<Civ, Edge>>;
  readonly arrivalEdge: Edge;
}

export interface EmbarkState {
  readonly stateVersion: 1;
  readonly spec: LocalMapSpec;
}

interface BiomeRow {
  readonly id: string;
  readonly soilDepth: number;
}

/**
 * `relief (0–3 from neighbor elevation differences)`: the largest elevation difference to any of
 * the eight neighbouring regions, mapped linearly from the 0 … 255 elevation range onto the four
 * relief levels (`floor(diff × 4 / 256)`, so 64 per level). DECISIONS.md D-044.
 */
export function reliefOf(world: WorldMap, regionId: number): 0 | 1 | 2 | 3 {
  const size = world.size;
  const x = regionId % size;
  const y = Math.floor(regionId / size);
  const here = world.regions[regionId]?.elevation ?? 0;
  let diff = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if ((dx === 0 && dy === 0) || x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;
      const e = world.regions[(y + dy) * size + x + dx]?.elevation ?? here;
      diff = Math.max(diff, Math.abs(e - here));
    }
  }
  return Math.min(3, Math.floor((diff * 4) / 256)) as 0 | 1 | 2 | 3;
}

/** Build the spec of one region: `seed: hash(worldSeed, regionId)` and the region's fields. */
export function localMapSpec(world: WorldMap, regionId: number, registry: Registry): LocalMapSpec {
  const r: RegionRecord | undefined = world.regions[regionId];
  if (r === undefined) throw new RangeError(`localMapSpec: no region ${regionId}`);
  const biome = registry.table<BiomeRow>('biomes').byId(r.biome);
  if (biome === undefined) throw new RangeError(`localMapSpec: unknown biome ${r.biome}`);
  return Object.freeze({
    seed: hash64(world.seed, regionId),
    regionId,
    biome: r.biome,
    elevation: r.elevation,
    relief: reliefOf(world, regionId),
    soilDepth: biome.soilDepth,
    geology: r.geology,
    wealth: r.wealth,
    peril: r.peril,
    temper: r.temper,
    deepness: r.deepness,
    traits: Object.freeze([...r.traits]),
    volcano: r.volcano,
    river:
      r.river === null
        ? null
        : Object.freeze({ inflowEdges: Object.freeze([...r.river.inflow]), outflowEdge: r.river.outflow, class: r.river.class }),
    lake: r.lake,
    civEdges: Object.freeze({ ...r.nearestEdgeTo }),
    arrivalEdge: r.nearestEdgeTo.mountainhome,
  });
}
