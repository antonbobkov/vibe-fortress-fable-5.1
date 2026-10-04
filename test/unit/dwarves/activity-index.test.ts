import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { TickContext } from '@core/system';
import { TileKind } from '@core/map3d';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M8-01 static activity choices retain live invalidation and reachability', () => {
  it('sees furniture completed on the same tick and checks the current connectivity on a cached list', () => {
    const w = new TestWorld({ seed: 'm801-activity-index', world: 'flat-test', embark: 'none' });
    w.step(1);
    const from = w.index(20, 20, 32);
    const dwarf = w.spawnDwarf({ at: from });
    const brain = w.game.world.entities.get(dwarf, C.Brain);
    if (brain === undefined) throw new Error('missing brain');
    const ctx = { world: w.game.world, readers: w.readers, registry: w.game.registry, tick: w.tick } as unknown as TickContext;
    const choose = (): number => {
      expect(w.dwarves.activities.start(ctx, dwarf, 'rest', brain, -1, [dwarf])).toBe(true);
      return w.dwarves.activities.plans.get(dwarf)?.target ?? -1;
    };
    const far = w.index(20, 30, 32);
    w.build('bed', far, 'oak');
    expect(choose()).toBe(far);
    const near = w.index(23, 20, 32);
    w.build('bed', near, 'oak');
    expect(choose()).toBe(near);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx !== 0 || dy !== 0) w.carve(w.index(23 + dx, 20 + dy, 32), TileKind.Wall);
    }
    w.pathing.connectivity.rebuildDirty();
    expect(choose()).toBe(far);
  });

  it('T-M8-01 retains the lowest standing-tile tie when pruning water candidates', () => {
    const w = new TestWorld({ seed: 'm801-water-tie', world: 'flat-test', embark: 'none' });
    const from = w.index(12, 12, 32);
    const id = w.spawnDwarf({ at: from });
    w.setFluid(w.index(10, 15, 32), 1, 'water', true);
    w.setFluid(w.index(14, 15, 32), 1, 'water', true);
    w.setNeed(id, 'thirst', 55);
    w.step(1);
    expect(w.dwarves.activities.plans.get(id)?.target).toBe(w.index(10, 14, 32));
  });
});
