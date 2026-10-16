import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import { TestWorld } from '../../scenarios/test-world';
import { threeYearsWorld } from '../../scenarios/three_years_fortress';

const Z = 32;

describe('T-350 a dwarf drinks from the bank above a brook', () => {
  it('drinks from a walkable tile one level above the water, beside it', () => {
    // The generated brook's shape: the water fills its bed one level below the surface, the tile
    // over it is open, and its only walkable neighbours are the banks on the surface.
    const w = new TestWorld({ seed: 't350-bank', world: 'flat-test', embark: 'none' });
    for (let y = 10; y <= 14; y += 1) {
      const cut = w.index(20, y, Z);
      w.carve(cut, TileKind.Open);
      w.map.setFlag(cut, TileFlag.Outdoor, true);
      w.carve(w.index(20, y, Z - 1), TileKind.Floor);
      w.setFluid(w.index(20, y, Z - 1), 7, 'water', true);
    }
    const id = w.spawnDwarf({ at: w.index(24, 12, Z) });
    w.setNeed(id, 'thirst', 55);
    w.step(1);
    const target = w.dwarves.activities.plans.get(id)?.target ?? -1;
    expect(target, 'a bank tile beside the brook').toBeGreaterThanOrEqual(0);
    expect(w.map.zOf(target)).toBe(Z);
    expect(Math.abs(w.map.xOf(target) - 20)).toBe(1);
    w.step(200);
    expect(w.events('DrankWater').some((e) => e['id'] === id)).toBe(true);
  });

  it('does not drink through a floor or a wall over the water', () => {
    // Water one level down with the surface floor left over it, and the same under rock: a dug
    // floor beside the covered tile is no bank.
    const w = new TestWorld({ seed: 't350-covered', world: 'flat-test', embark: 'none' });
    w.carve(w.index(20, 12, Z - 1), TileKind.Floor);
    w.setFluid(w.index(20, 12, Z - 1), 7, 'water', true);
    w.carve(w.index(30, 12, Z - 1), TileKind.Floor);
    w.setFluid(w.index(30, 12, Z - 1), 7, 'water', true);
    w.carve(w.index(30, 12, Z), TileKind.Wall);
    const a = w.spawnDwarf({ at: w.index(21, 12, Z) });
    const b = w.spawnDwarf({ at: w.index(31, 12, Z) });
    w.setNeed(a, 'thirst', 55);
    w.setNeed(b, 'thirst', 55);
    w.step(200);
    expect(w.events('DrankWater')).toEqual([]);
  });

  it('on the three-year map, a dwarf with no drink in stock drinks from the brook', () => {
    const w = threeYearsWorld('three-years');
    const ent = w.game.world.entities;
    const drink = w.game.registry.table('items').index('drink');
    for (const item of ent.with(C.Item).filter((i) => ent.get(i, C.Item)?.type === drink)) w.game.world.services.items?.destroy(item, 'consumed');
    const dwarves = ent.with(C.Labors);
    for (const id of dwarves) w.setNeed(id, 'thirst', 90);
    w.until(() => w.events('DrankWater').length > 0, 2_400);
    expect(w.events('DrankWater').length).toBeGreaterThan(0);
  });
});
