/**
 * Stage 8: the volcano. `03-terrain-and-mining.md` § Local map generation stage 8;
 * `algorithms/local-map-generation.md` step 6.
 */

import { FLUID_MAX_LEVEL } from '@core/constants';
import { FluidType, Map3D, TileFlag, TileKind } from '@core/map3d';
import {
  GLASSLANDS_PIPE_RADIUS,
  GLASSLANDS_POOLS,
  MAGMA_POOL_RADIUS_MAX,
  MAGMA_POOL_RADIUS_MIN,
  VOLCANO_EDGE_DISTANCE,
  VOLCANO_OBSIDIAN_RADIUS,
} from '../constants';
import { magmaPool } from './caverns';
import { hasTrait, materialIndex, stageStream, type LocalGen } from './common';
import { soilDepthOf } from './layers';
import { edgePoint } from './rivers';
import { SEA_RIM } from './sea';

/** Pipe radius 1–2, or 3 on `glasslands`. */
export const PIPE_RADIUS_MIN = 1;
export const PIPE_RADIUS_MAX = 2;
/** The obsidian ring around the pipe: "ring r+1..r+2". */
export const PIPE_RING = 2;

export function stageVolcano(g: LocalGen): void {
  if (!g.spec.volcano) return;
  const st = stageStream(g.s, 'terrain.volcano');
  const map = g.map;
  const glass = hasTrait(g, 'glasslands');
  const r = glass ? GLASSLANDS_PIPE_RADIUS : st.int(PIPE_RADIUS_MIN, PIPE_RADIUS_MAX);
  const margin = SEA_RIM + r + PIPE_RING;
  const mid = edgePoint(g.w, g.h, g.spec.arrivalEdge);
  // "a random location at least 20 tiles from the arrival edge": Chebyshev from the edge's midpoint.
  let cx = -1;
  let cy = -1;
  for (let k = 0; k < 1000 && cx < 0; k += 1) {
    const x = st.int(margin, g.w - 1 - margin);
    const y = st.int(margin, g.h - 1 - margin);
    if (Math.max(Math.abs(x - mid.x), Math.abs(y - mid.y)) >= VOLCANO_EDGE_DISTANCE) {
      cx = x;
      cy = y;
    }
  }
  if (cx < 0) return;
  g.volcano = cy * g.w + cx;

  const magma = Map3D.packFluid(FLUID_MAX_LEVEL, FluidType.Magma, false, true);
  const obsidian = materialIndex(g, 'obsidian');
  const soil = soilDepthOf(g);
  const outer = r + PIPE_RING;
  for (let y = cy - VOLCANO_OBSIDIAN_RADIUS; y <= cy + VOLCANO_OBSIDIAN_RADIUS; y += 1) {
    for (let x = cx - VOLCANO_OBSIDIAN_RADIUS; x <= cx + VOLCANO_OBSIDIAN_RADIUS; x += 1) {
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 > VOLCANO_OBSIDIAN_RADIUS * VOLCANO_OBSIDIAN_RADIUS) continue;
      const c = y * g.w + x;
      const top = g.heights[c] as number;
      g.bare[c] = 1;
      if (d2 <= r * r) {
        // The pipe: open magma with a source from the Sea of Fire up to the surface.
        for (let z = 0; z <= top; z += 1) {
          const i = map.index(x, y, z);
          map.kind[i] = TileKind.Open;
          map.material[i] = 0;
          map.fluid[i] = magma;
          map.flags[i] = (map.flags[i] as number) & ~TileFlag.Grass;
        }
      } else if (d2 <= outer * outer) {
        // The ring: obsidian walls below a walkable obsidian surface.
        for (let z = 0; z < top; z += 1) {
          const i = map.index(x, y, z);
          map.kind[i] = TileKind.Wall;
          map.material[i] = obsidian;
          map.fluid[i] = 0;
        }
        map.material[map.index(x, y, top)] = obsidian;
      } else {
        // "the surface around it for radius 6 is obsidian and bare".
        for (let z = top; z > top - Math.max(1, soil) && z >= 0; z -= 1) map.material[map.index(x, y, z)] = obsidian;
      }
    }
  }

  // glasslands: "two more shallow magma pools at cavern one depth".
  if (glass) {
    const floors = g.cavernFloors[1] ?? [];
    for (let k = 0; k < GLASSLANDS_POOLS && floors.length > 0; k += 1) {
      magmaPool(g, st.pick(floors), st.int(MAGMA_POOL_RADIUS_MIN, MAGMA_POOL_RADIUS_MAX));
    }
  }
}
