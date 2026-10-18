import { describe, expect, it } from 'vitest';
import { FLUID_FROZEN_BIT, TileFlag, TileKind } from '@core/map3d';
import { DRINK_SEARCH_RADIUS } from '@systems/dwarves/constants';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

/** The generated brook's shape (T-350): water one level below the surface, open air over it, banks on the surface. */
function brook(w: TestWorld, x: number): number[] {
  const water: number[] = [];
  for (let y = 10; y <= 14; y += 1) {
    const cut = w.index(x, y, Z);
    w.carve(cut, TileKind.Open);
    w.map.setFlag(cut, TileFlag.Outdoor, true);
    w.carve(w.index(x, y, Z - 1), TileKind.Floor);
    w.setFluid(w.index(x, y, Z - 1), 7, 'water', true);
    water.push(w.index(x, y, Z - 1));
  }
  return water;
}

describe('T-398 the drink search reaches a bank far from the dwarf', () => {
  it('a dwarf 45 tiles from the only bank goes to it and drinks', () => {
    const w = new TestWorld({ seed: 't398-far-bank', world: 'flat-test', embark: 'none' });
    brook(w, 56);
    const id = w.spawnDwarf({ at: w.index(11, 12, Z) });
    w.setNeed(id, 'thirst', 90);
    w.step(1);
    const target = w.dwarves.activities.plans.get(id)?.target ?? -1;
    expect(target, 'a bank tile beside the brook').toBeGreaterThanOrEqual(0);
    expect(Math.abs(w.map.xOf(target) - 56)).toBe(1);
    w.step(600);
    expect(w.events('DrankWater').some((e) => e['id'] === id)).toBe(true);
  });

  it('a bank beyond the search radius is not searched for', () => {
    const w = new TestWorld({ seed: 't398-beyond', world: 'flat-test', embark: 'none' });
    const x = 4 + DRINK_SEARCH_RADIUS + 2;
    expect(x, 'the flat test map is wide enough for this case').toBeLessThan(w.map.w - 2);
    brook(w, x);
    const id = w.spawnDwarf({ at: w.index(4, 12, Z) });
    w.setNeed(id, 'thirst', 90);
    w.step(1);
    expect(w.dwarves.activities.plans.get(id)?.target ?? -1).toBe(-1);
  });

  it('a frozen brook gives no water at any distance', () => {
    const w = new TestWorld({ seed: 't398-frozen', world: 'flat-test', embark: 'none' });
    for (const tile of brook(w, 20)) w.map.fluid[tile] = (w.map.fluid[tile] as number) | FLUID_FROZEN_BIT;
    const id = w.spawnDwarf({ at: w.index(24, 12, Z) });
    w.setNeed(id, 'thirst', 90);
    w.step(1);
    expect(w.dwarves.activities.plans.get(id)?.target ?? -1).toBe(-1);
    w.step(300);
    expect(w.events('DrankWater')).toEqual([]);
  });
});
