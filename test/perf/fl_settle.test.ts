import { describe, it, expect } from 'vitest';
import { generatedSpec } from '@app/headless';
import { TestWorld } from '../scenarios/test-world';

describe('F-03 perf: fl_settle', () => {
  it('disturbed water in a generated world settles within 4,200 ticks', () => {
    const w = new TestWorld({
      seed: 'perf-1',
      world: 'local',
      spec: generatedSpec('perf-1'),
      embark: 'none',
    });
    const map = w.game.world.map;
    const sim = w.fluids.sim;
    for (let i = 0; i < map.tileCount; i += 1) {
      if (sim.hasWater(i) && !sim.isSource(i)) {
        sim.touch(i);
      }
    }
    const reader = w.fluids.reader();
    let ticks = 0;
    while (reader.activeCount() > 0 && ticks < 4200) {
      w.step(1);
      ticks += 1;
    }
    expect(reader.activeCount()).toBe(0);
    expect(ticks).toBeLessThanOrEqual(4200);
  });
});
