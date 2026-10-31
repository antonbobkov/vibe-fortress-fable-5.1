/**
 * T-449: on a map with relief a river and a lake stay in their beds
 * (`03-terrain-and-mining.md` § Local map generation stage 2; `04-fluids.md` § Sources and sinks in
 * play). The water stood at each band's own level, so a brook stepped down the map and spilled on
 * to any bank no higher than its water; its source then kept the flood fed, and dwarves drowned on
 * dry ground.
 */

import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { LOCAL_MAP_Z } from '@core/constants';
import { Map3D, TileKind, type TileFlag } from '@core/map3d';
import { RngStream } from '@core/rng';
import type { TerrainApi } from '@core/system';
import { regionSpec } from '@app/headless';
import { generateLocal, type LocalMapResult } from '@systems/terrain/generate';
import { COL_LAKE, COL_RIVER } from '@systems/terrain/generate/common';
import { FluidSim } from '@systems/fluids';

const registry = contentRegistry();
const SIZE = 48;
/** Long enough for water that can leave its bed to reach dry ground on every map below. */
const STEPS = 500;

interface River { readonly class: 'brook' | 'river' | 'major'; readonly inflow: readonly ('n' | 's' | 'e' | 'w')[]; readonly outflow: 'n' | 's' | 'e' | 'w' | null }

function generated(seed: string, relief: 0 | 1 | 2 | 3, river: River): { map: Map3D; local: LocalMapResult } {
  const spec = regionSpec(seed, { peril: 0, wealth: 2, biome: 'temperate_forest', geology: 'mixed', traits: [], relief, river: { class: river.class, inflow: [...river.inflow], outflow: river.outflow } }, registry);
  const map = new Map3D(SIZE, SIZE, LOCAL_MAP_Z);
  return { map, local: generateLocal(spec, map, registry) };
}

const isWet = (local: LocalMapResult, c: number): boolean => ((local.columns[c] as number) & (COL_RIVER | COL_LAKE)) !== 0;

/** Every water tile of the map's surface water (the columns the generator marked wet). */
function waterTiles(map: Map3D, local: LocalMapResult): number[] {
  const tiles: number[] = [];
  for (let c = 0; c < SIZE * SIZE; c += 1) {
    if (!isWet(local, c)) continue;
    for (let z = local.surface[c] as number; z < map.d; z += 1) {
      const i = map.index(c % SIZE, Math.floor(c / SIZE), z);
      if (map.fluidLevelAt(i) > 0) tiles.push(i);
    }
  }
  return tiles;
}

/** Wake the water, as the first dig or thaw beside it does, and let it run with nothing else on the map. */
function runWater(seed: string, map: Map3D, local: LocalMapResult): void {
  const terrain: TerrainApi = { setKind: (i, k, m) => map.setKind(i, k, m), setFlag: (i, f: TileFlag, v) => map.setFlag(i, f, v), setDesignation: () => {} };
  const sim = new FluidSim({ map, rng: RngStream.forStream(seed, '04'), terrain: () => terrain, blocksFluidAt: () => false, blocksFallAt: () => false, mudMaterial: () => true, obsidian: 0, entitiesAt: () => [], creatureSize: () => -1, emit: () => {} });
  sim.scanSources();
  sim.rescanDrained();
  for (const s of [...local.sinks].sort((a, b) => a - b)) sim.sinks.push(s);
  for (const i of waterTiles(map, local)) sim.touch(i);
  for (let s = 0; s < STEPS; s += 1) sim.step(false);
}

/** The water above a dry column's own floor, deepest level first. */
function waterOnDryGround(map: Map3D, local: LocalMapResult): { tiles: number; deep: number } {
  let tiles = 0;
  let deep = 0;
  for (let c = 0; c < SIZE * SIZE; c += 1) {
    if (isWet(local, c)) continue;
    for (let z = local.surface[c] as number; z < map.d; z += 1) {
      const level = map.fluidLevelAt(map.index(c % SIZE, Math.floor(c / SIZE), z));
      if (level > 0) tiles += 1;
      if (level >= 4) deep += 1;
    }
  }
  return { tiles, deep };
}

const RIVERS: readonly River[] = [
  { class: 'brook', inflow: ['w'], outflow: 's' },
  { class: 'river', inflow: ['n', 'w'], outflow: 'e' },
  { class: 'major', inflow: ['e'], outflow: 'n' },
  { class: 'brook', inflow: [], outflow: 's' },
  { class: 'river', inflow: ['s'], outflow: null },
];

describe('T-449 a river and a lake stay in their beds on relief', () => {
  it('the water that drowned the bank of the three-year map stays in the brook once it runs', () => {
    const { map, local } = generated('three-years-p0-2', 1, { class: 'brook', inflow: ['w'], outflow: 's' });
    runWater('three-years-p0-2', map, local);
    expect(waterOnDryGround(map, local)).toEqual({ tiles: 0, deep: 0 });
  });

  for (const relief of [1, 2, 3] as const) {
    for (const river of RIVERS) {
      const name = `${river.class} from ${river.inflow.join('+') || 'a spring'} to ${river.outflow ?? 'a lake'} on relief ${relief}`;

      it(`${name}: one water level, walled on every side`, () => {
        for (const seed of ['t449-a', 't449-b', 't449-c', 't449-d']) {
          const { map, local } = generated(seed, relief, river);
          const tiles = waterTiles(map, local);
          expect(tiles.length, seed).toBeGreaterThan(0);
          const tops = new Set<number>();
          for (let c = 0; c < SIZE * SIZE; c += 1) {
            if (!isWet(local, c)) continue;
            const x = c % SIZE;
            const y = Math.floor(c / SIZE);
            let top = -1;
            for (let z = local.surface[c] as number; z < map.d; z += 1) if (map.fluidLevelAt(map.index(x, y, z)) > 0) top = z;
            expect(top, `${seed}: column ${x},${y} holds water`).toBeGreaterThanOrEqual(0);
            tops.add(top);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || isWet(local, ny * SIZE + nx)) continue;
              expect(map.kindAt(map.index(nx, ny, top)), `${seed}: the bank at ${nx},${ny} beside the water at ${x},${y},${top}`).toBe(TileKind.Wall);
            }
          }
          expect([...tops], seed).toHaveLength(1);
        }
      });

      it(`${name}: no water on dry ground once it runs`, () => {
        const { map, local } = generated('t449-a', relief, river);
        runWater('t449-a', map, local);
        expect(waterOnDryGround(map, local)).toEqual({ tiles: 0, deep: 0 });
      });
    }
  }

  it('a bank one level above the water can still be drunk from: the lowest bank stands exactly there', () => {
    for (const seed of ['t449-a', 't449-b', 't449-c', 't449-d']) {
      const { map, local } = generated(seed, 1, { class: 'brook', inflow: ['w'], outflow: 's' });
      const top = Math.max(...waterTiles(map, local).map((i) => map.zOf(i)));
      let low = Infinity;
      for (let c = 0; c < SIZE * SIZE; c += 1) {
        if (!isWet(local, c)) continue;
        const x = c % SIZE;
        const y = Math.floor(c / SIZE);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || isWet(local, ny * SIZE + nx)) continue;
          low = Math.min(low, local.surface[ny * SIZE + nx] as number);
        }
      }
      expect(low, seed).toBe(top + 1);
    }
  });
});
