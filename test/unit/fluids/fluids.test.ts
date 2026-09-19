import { describe, it, expect } from 'vitest';
import { FLUID_MAX_LEVEL } from '@core/constants';
import { FLUID_SETTLED_BIT, TileFlag, TileKind } from '@core/map3d';
import * as K from '@systems/fluids/constants';
import { roundTrip } from '@app/game-save';
import { TestWorld } from '../../scenarios/test-world';
import { tuningConstants } from '../system-constants';
import { METAL, carve, harness } from './harness';

describe('T-M3-01 fluids: tuning constants', () => {
  it('every row of 04 § Tuning constants is in src/systems/fluids/constants.ts', () => {
    const rows = tuningConstants('02-systems/04-fluids.md');
    expect(rows.length).toBe(12);
    const values = K as unknown as Record<string, number>;
    for (const row of rows) expect([row.name, values[row.name]]).toEqual([row.name, row.value]);
  });
});

describe('T-M3-01 fluids: rule 1, fall', () => {
  it('water in an open tile falls into the tile below as far as there is room, conserving units', () => {
    const h = harness('fall');
    const [floor] = carve(h.map, 5, 5, 1, 1, 1, TileKind.Floor) as [number];
    const [top] = carve(h.map, 5, 5, 2, 1, 1, TileKind.Open) as [number];
    h.sim.pour(floor, 3);
    h.sim.pour(top, 6);
    h.steps(1);
    expect(h.sim.level(floor)).toBe(FLUID_MAX_LEVEL);
    expect(h.sim.level(top)).toBe(2);
    expect(h.sum([floor, top])).toBe(9);
  });

  it('D-088: fluid does not fall through a solid-bottomed tile, and a locked hatch holds it', () => {
    const h = harness('fall-floor');
    const upper = h.map.index(5, 5, 2);
    const lower = h.map.index(5, 5, 1);
    h.map.kind[lower] = TileKind.Open;
    h.map.kind[h.map.index(5, 5, 0)] = TileKind.Floor;
    h.map.kind[upper] = TileKind.Floor;
    h.sim.pour(upper, 5);
    h.steps(3);
    expect(h.sim.level(upper)).toBe(5);
    expect(h.sim.level(lower)).toBe(0);
    h.map.kind[upper] = TileKind.Open;
    h.fallBlocked.add(upper);
    h.sim.touch(upper);
    h.steps(3);
    expect(h.sim.level(upper)).toBe(5);
    h.fallBlocked.delete(upper);
    h.sim.touch(upper);
    h.steps(1);
    expect(h.sim.level(upper)).toBe(0);
    expect(h.sim.level(lower)).toBe(5);
  });
});

describe('T-M3-01 fluids: rule 2, spread', () => {
  it('moves one unit to a neighbour two below, never more than SPREAD_MAX_PER_STEP a step', () => {
    const h = harness('spread');
    const row = carve(h.map, 1, 5, 1, 9, 1);
    const mid = h.map.index(5, 5, 1);
    h.sim.pour(mid, 7);
    h.steps(1);
    expect(h.sim.level(mid)).toBe(7 - K.SPREAD_MAX_PER_STEP);
    expect(h.sum(row)).toBe(7);
  });

  it('a closed floodgate blocks the spread', () => {
    const h = harness('floodgate');
    carve(h.map, 1, 5, 1, 3, 1);
    const [a, gate, b] = [h.map.index(1, 5, 1), h.map.index(2, 5, 1), h.map.index(3, 5, 1)];
    h.fluidBlocked.add(gate);
    h.sim.pour(a, 7);
    h.steps(20);
    expect(h.sim.level(a)).toBe(7);
    expect(h.sim.level(gate) + h.sim.level(b)).toBe(0);
  });

  it('rotation removes directional bias: a 7 in the centre of a 9×9 spreads symmetrically within 2 units per side after 100 steps', () => {
    const seeds = 100;
    let northSouth = 0;
    let eastWest = 0;
    for (let s = 0; s < seeds; s += 1) {
      const h = harness(`bias-${s}`, 11, 11, 3);
      const tiles = carve(h.map, 1, 1, 1, 9, 9);
      h.sim.pour(h.map.index(5, 5, 1), 7);
      h.steps(100);
      expect(h.sum(tiles) + h.sim.destroyedUnits).toBe(7);
      for (const t of tiles) {
        const l = h.sim.level(t);
        const x = h.map.xOf(t);
        const y = h.map.yOf(t);
        if (y < 5) northSouth += l;
        if (y > 5) northSouth -= l;
        if (x > 5) eastWest += l;
        if (x < 5) eastWest -= l;
      }
    }
    expect(Math.abs(northSouth / seeds)).toBeLessThanOrEqual(2);
    expect(Math.abs(eastWest / seeds)).toBeLessThanOrEqual(2);
  });

  it('7 units in one tile of a sealed 5×5 floor end with every tile at 0-1 and Σ 7 after 200 steps (C-002: they keep wandering)', () => {
    const h = harness('spread-5x5', 7, 7, 3);
    const tiles = carve(h.map, 1, 1, 1, 5, 5);
    h.sim.pour(h.map.index(1, 1, 1), 7);
    h.steps(200);
    for (const t of tiles) expect(h.sim.level(t)).toBeLessThanOrEqual(1);
    expect(h.sum(tiles) + h.sim.destroyedUnits).toBe(7);
  });
});

describe('T-M3-01 fluids: the active set', () => {
  it('a still pool settles after FLUID_SETTLE_STEPS idle steps and is marked settled', () => {
    const h = harness('settle');
    const pool = carve(h.map, 2, 2, 1, 3, 3);
    for (const t of pool) h.sim.pour(t, 3);
    h.steps(K.FLUID_SETTLE_STEPS - 1);
    expect(h.sim.activeCount()).toBe(9);
    h.steps(1);
    expect(h.sim.activeCount()).toBe(0);
    for (const t of pool) expect((h.map.fluid[t] as number) & FLUID_SETTLED_BIT).toBe(FLUID_SETTLED_BIT);
    expect(h.map.chunk(h.map.chunkOf(pool[0] as number))?.activeFluidCount).toBe(0);
  });

  it('touching a settled tile wakes it and its neighbours', () => {
    const h = harness('wake');
    const pool = carve(h.map, 2, 2, 1, 3, 1);
    for (const t of pool) h.sim.pour(t, 3);
    h.steps(K.FLUID_SETTLE_STEPS);
    expect(h.sim.activeCount()).toBe(0);
    h.sim.touch(pool[1] as number);
    expect(h.sim.activeCount()).toBe(3);
  });

  it('D-087: a step of one type leaves the other type waiting in the active set', () => {
    const h = harness('types');
    carve(h.map, 2, 2, 1, 3, 1);
    const magma = h.map.index(2, 2, 1);
    h.sim.pour(magma, 7, true);
    h.steps(3, false);
    expect(h.sim.isActive[magma]).toBe(1);
    expect(h.sim.level(magma)).toBe(7);
    h.steps(1, true);
    expect(h.sim.level(magma)).toBeLessThan(7);
    expect(h.sum(carve(h.map, 2, 2, 1, 3, 1), true)).toBe(7);
  });

  it('parity and rotation advance with every step', () => {
    const h = harness('parity');
    expect([h.sim.parity, h.sim.rotation]).toEqual([0, 0]);
    h.steps(1);
    expect([h.sim.parity, h.sim.rotation]).toEqual([1, 1]);
    h.steps(1, true);
    expect([h.sim.parity, h.sim.rotation]).toEqual([0, 2]);
  });
});

describe('T-M3-01 fluids: sources, sinks and mud', () => {
  it('a source refills to full every step; a sink drains whatever reaches it', () => {
    const h = harness('river', 12, 4, 3);
    const channel = carve(h.map, 1, 1, 1, 10, 1);
    const source = channel[0] as number;
    const sink = channel[9] as number;
    h.sim.pour(source, 7, false, true);
    expect(h.sim.waterSources).toContain(source);
    h.sim.sinks.push(sink);
    let drained = false;
    for (let k = 0; k < 300; k += 1) {
      h.steps(1);
      expect(h.sim.level(source)).toBe(FLUID_MAX_LEVEL);
      expect(h.sim.level(sink)).toBe(0);
      if (h.sim.drainedUnits > 0) drained = true;
    }
    expect(drained).toBe(true);
    // Every unit is accounted for: in the channel, created by the source, destroyed by the sink.
    expect(h.sum(channel)).toBe(7 + h.sim.sourcedUnits - h.sim.drainedUnits - h.sim.destroyedUnits);
  });

  it('water arriving on a stone or soil floor sets mud; on another material it does not', () => {
    const h = harness('mud');
    const row = carve(h.map, 1, 5, 1, 4, 1);
    h.map.material[row[3] as number] = METAL;
    h.map.material[row[2] as number] = METAL;
    h.sim.pour(row[0] as number, 7);
    h.steps(40);
    expect(h.map.hasFlag(row[1] as number, TileFlag.Mud)).toBe(true);
    expect(h.map.hasFlag(row[3] as number, TileFlag.Mud)).toBe(false);
  });
});

describe('T-M3-01 fluids: the system', () => {
  it('emits FluidsChanged with the touched chunks, and a saved game continues identically', () => {
    const w = new TestWorld({ seed: 'fluids-system', world: 'flat-test' });
    const floor = [];
    for (let x = 20; x < 30; x += 1) floor.push(w.index(x, 20, 25));
    for (const t of floor) w.carve(t, TileKind.Floor);
    w.setFluid(floor[0] as number, 7);
    w.step(2);
    const changed = w.events('FluidsChanged');
    expect(changed.length).toBeGreaterThan(0);
    expect(changed[0]?.['chunks']).toEqual([w.map.chunkOf(floor[0] as number)]);
    w.step(9);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    w.step(60);
    loaded.step(60);
    expect(loaded.hash()).toBe(w.hash());
    expect(w.fluidSum(floor)).toBe(7);
  });
});
