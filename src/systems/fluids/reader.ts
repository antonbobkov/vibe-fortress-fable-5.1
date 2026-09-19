/**
 * `readers.of('04')`: `02-systems/04-fluids.md` § Interfaces › Reader.
 */

import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { FluidSim } from './step';

export type FluidTypeName = 'none' | 'water' | 'magma';

export interface FluidsReader {
  levelAt(i: TileIndex): number;
  typeAt(i: TileIndex): FluidTypeName;
  isSource(i: TileIndex): boolean;
  isFrozen(i: TileIndex): boolean;
  isMisty(i: TileIndex): boolean;
  /**
   * The first tile in the column below `i`, within `maxDepth` levels, with liquid water (level ≥ 1,
   * not frozen); -1 when there is none. The column is followed through `open` tiles only (D-094).
   */
  waterBelow(i: TileIndex, maxDepth: number): TileIndex;
  /** Magma (level ≥ 1) within Chebyshev `radius` of `i`, on its level and the levels around it. */
  isMagmaAdjacent(i: TileIndex, radius: number): boolean;
  /**
   * The tile is in the active set (its fluid may still move). 23's animation reads this: "settled
   * tiles do not animate" (D-103).
   */
  isActive(i: TileIndex): boolean;
  /** Debug: tiles in the active set. */
  activeCount(): number;
}

export function makeReader(sim: FluidSim, misty: (i: TileIndex) => boolean): FluidsReader {
  const map = sim.map;
  return {
    levelAt: (i) => sim.level(i),
    typeAt: (i) => (sim.level(i) === 0 ? 'none' : sim.isMagma(i) ? 'magma' : 'water'),
    isSource: (i) => sim.isSource(i),
    isFrozen: (i) => sim.isFrozen(i),
    isMisty: (i) => misty(i),
    waterBelow: (i, maxDepth) => {
      let cur = i;
      for (let d = 1; d <= maxDepth; d += 1) {
        cur = map.below(cur);
        if (cur < 0) return -1;
        if (sim.hasWater(cur)) return cur;
        if (map.kindAt(cur) !== TileKind.Open) return -1;
      }
      return -1;
    },
    isMagmaAdjacent: (i, radius) => {
      const { x, y, z } = map.unpack(i);
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            if (!map.inBounds(x + dx, y + dy, z + dz)) continue;
            if (sim.hasMagma(map.index(x + dx, y + dy, z + dz))) return true;
          }
        }
      }
      return false;
    },
    isActive: (i) => sim.isActive[i] === 1,
    activeCount: () => sim.activeCount(),
  };
}
