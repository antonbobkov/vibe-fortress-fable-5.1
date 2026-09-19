/**
 * A small hand-built map with a bare {@link FluidSim}, for the rule tests of 04 fluids: no world, no
 * connectivity build, so thousands of steps cost milliseconds.
 */

import { Map3D, TileFlag, TileKind } from '@core/map3d';
import { RngStream } from '@core/rng';
import type { GameEvent } from '@core/events';
import type { TerrainApi } from '@core/system';
import type { TileIndex } from '@core/types';
import { FluidSim } from '@systems/fluids';

export interface Harness {
  readonly map: Map3D;
  readonly sim: FluidSim;
  readonly events: GameEvent[];
  readonly kindWrites: { tile: TileIndex; kind: TileKind; material: number }[];
  /** Tiles a closed floodgate stands on. */
  readonly fluidBlocked: Set<TileIndex>;
  /** Tiles with a locked hatch. */
  readonly fallBlocked: Set<TileIndex>;
  steps(n: number, magma?: boolean): void;
  sum(tiles: readonly TileIndex[], magma?: boolean): number;
}

/** Material indices of the harness: 1 stone (mud), 2 an other class (no mud). */
export const STONE = 1;
export const METAL = 2;

/** A `w × h × d` map of stone walls. */
export function harness(seed: string, w = 12, h = 12, d = 6): Harness {
  const map = new Map3D(w, h, d);
  map.kind.fill(TileKind.Wall);
  map.material.fill(STONE);
  const events: GameEvent[] = [];
  const kindWrites: { tile: TileIndex; kind: TileKind; material: number }[] = [];
  const fluidBlocked = new Set<TileIndex>();
  const fallBlocked = new Set<TileIndex>();
  const terrain: TerrainApi = {
    setKind: (i, kind, material) => {
      map.setKind(i, kind, material);
      kindWrites.push({ tile: i, kind, material });
    },
    setFlag: (i, flag: TileFlag, value) => map.setFlag(i, flag, value),
    setDesignation: () => {},
  };
  const sim = new FluidSim({
    map,
    rng: RngStream.forStream(seed, '04'),
    terrain: () => terrain,
    blocksFluidAt: (i) => fluidBlocked.has(i),
    blocksFallAt: (i) => fallBlocked.has(i),
    mudMaterial: (m) => m === STONE,
    emit: (e) => events.push(e),
  });
  return {
    map,
    sim,
    events,
    kindWrites,
    fluidBlocked,
    fallBlocked,
    steps(n, magma = false) {
      for (let k = 0; k < n; k += 1) sim.step(magma);
    },
    sum(tiles, magma = false) {
      let s = 0;
      for (const t of tiles) if (sim.level(t) > 0 && sim.isMagma(t) === magma) s += sim.level(t);
      return s;
    },
  };
}

/** Carve a rectangle of one kind at one level; returns its tiles. */
export function carve(map: Map3D, x: number, y: number, z: number, w: number, h: number, kind: TileKind = TileKind.Floor): TileIndex[] {
  const out: TileIndex[] = [];
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      const i = map.index(x + dx, y + dy, z);
      map.kind[i] = kind;
      out.push(i);
    }
  }
  return out;
}
