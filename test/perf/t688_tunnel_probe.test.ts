/**
 * T-688's probe of a level tunnel fed by a full column, and of what the fluid rules cost on a big
 * map. Local measurement only (set `T688_PROBE=1`); not part of `npm test`.
 *
 * - `tunnel`: on `flat-test`, a water source over an open shaft seven deep onto the floor of a
 *   1-wide tunnel of 40 tiles at z 20; the tunnel's levels at 2,000, 10,000 and 40,000 ticks.
 * - `u-tunnel`: the same tunnel ending under a second open shaft twelve high; the second shaft's
 *   levels.
 * - `generated`: the `perf-1` map with every non-source water tile touched; the ticks until the
 *   active set is empty (at most 4,200), the fluid system's time and the active tiles summed over
 *   the ticks.
 */

import { describe, expect, it } from 'vitest';
import { generatedSpec } from '@app/headless';
import { FLUID_MAX_LEVEL } from '@core/constants';
import { TileKind } from '@core/map3d';
import { TestWorld } from '../scenarios/test-world';

const Y = 40;
const FLOOR = 20;
const X0 = 10;
const TUNNEL = 40;
const DROP = 7;

function tunnelWorld(secondShaft: number): TestWorld {
  const w = new TestWorld({ seed: 't688', world: 'flat-test', embark: 'none' });
  for (let x = X0; x <= X0 + TUNNEL; x += 1) w.carve(w.index(x, Y, FLOOR), TileKind.Floor);
  for (let z = FLOOR + 1; z <= FLOOR + DROP + 1; z += 1) w.carve(w.index(X0, Y, z), TileKind.Open);
  w.setFluid(w.index(X0, Y, FLOOR + DROP + 1), FLUID_MAX_LEVEL, 'water', true);
  for (let z = FLOOR + 1; z <= FLOOR + secondShaft; z += 1) w.carve(w.index(X0 + TUNNEL, Y, z), TileKind.Open);
  return w;
}

describe('T-688 probe: pressure through a level tunnel', () => {
  it.runIf(process.env['T688_PROBE'] === '1')('tunnel', () => {
    const w = tunnelWorld(0);
    const row = (): string => {
      const out: number[] = [];
      for (let x = X0; x <= X0 + TUNNEL; x += 1) out.push(w.fluids.sim.level(w.index(x, Y, FLOOR)));
      return out.join(' ');
    };
    let done = 0;
    for (const at of [2000, 10000, 40000]) {
      w.step(at - done);
      done = at;
      const col: number[] = [];
      for (let z = FLOOR + 1; z <= FLOOR + DROP + 1; z += 1) col.push(w.fluids.sim.level(w.index(X0, Y, z)));
      console.log(`tunnel @${at}: ${row()} | feed ${col.join(' ')} | active ${w.fluids.sim.activeCount()}`);
    }
    expect(done).toBe(40000);
  });

  it.runIf(process.env['T688_PROBE'] === '1')('u-tunnel', () => {
    const w = tunnelWorld(12);
    const row = (): string => {
      const out: number[] = [];
      for (let x = X0; x <= X0 + TUNNEL; x += 1) out.push(w.fluids.sim.level(w.index(x, Y, FLOOR)));
      const col: number[] = [];
      for (let z = FLOOR + 1; z <= FLOOR + 12; z += 1) col.push(w.fluids.sim.level(w.index(X0 + TUNNEL, Y, z)));
      return `${out.join(' ')} | shaft ${col.join(' ')}`;
    };
    let done = 0;
    for (const at of [2000, 10000, 40000]) {
      w.step(at - done);
      done = at;
      console.log(`u-tunnel @${at}: ${row()} | active ${w.fluids.sim.activeCount()}`);
    }
    expect(done).toBe(40000);
  });

  it.runIf(process.env['T688_PROBE'] === '1')('generated', () => {
    for (const seed of ['perf-1', 'perf-2', 'perf-3']) {
      const w = new TestWorld({ seed, world: 'local', spec: generatedSpec(seed), embark: 'none' });
      const map = w.game.world.map;
      const sim = w.fluids.sim;
      let water = 0;
      for (let i = 0; i < map.tileCount; i += 1) {
        if (sim.hasWater(i)) water += 1;
        if (sim.hasWater(i) && !sim.isSource(i)) sim.touch(i);
      }
      let fluidMs = 0;
      const step = sim.step.bind(sim);
      sim.step = (magma: boolean): void => {
        const s0 = performance.now();
        step(magma);
        fluidMs += performance.now() - s0;
      };
      let ticks = 0;
      let activeSum = 0;
      const t0 = performance.now();
      while (sim.activeCount() > 0 && ticks < 4200) {
        w.step(1);
        ticks += 1;
        activeSum += sim.activeCount();
      }
      const wall = performance.now() - t0;
      console.log(`generated ${seed}: water tiles ${water}, settled after ${ticks} ticks, active left ${sim.activeCount()}, active summed ${activeSum}, fluid steps ${fluidMs.toFixed(0)} ms, wall ${wall.toFixed(0)} ms`);
    }
  });
});
