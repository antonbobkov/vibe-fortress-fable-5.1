import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { PET_PILE_MAX } from '@systems/animals';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z - 2;

/** An 8 by 8 hall (x and y 10 to 17) with its hearth at `hearthX`, `hearthY`. */
function hallWorld(seed: string, hearthX = 14, hearthY = 14): { w: TestWorld; hall: TileIndex[] } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.digRoom(10, 10, Z, 8, 8);
  const hall: TileIndex[] = [];
  for (let y = 10; y < 18; y += 1) for (let x = 10; x < 18; x += 1) {
    w.discover(w.index(x, y, Z));
    hall.push(w.index(x, y, Z));
  }
  w.build('hearth', w.index(hearthX, hearthY, Z), 'granite');
  w.zone('hearth_hall', hall);
  w.step(1);
  expect(w.readers.of<BuildingsReader>('14').hearthHallTiles().length).toBeGreaterThan(0);
  return { w, hall };
}

describe('T-482 pets heap on a favourite spot by the hearth', () => {
  it('four idle dogs heap on one tile beside the hearth, and the heap slows no one', () => {
    const { w, hall } = hallWorld('t482-heap');
    const dogs = [0, 1, 2, 3].map((i) => w.spawnTame('dog', hall[i * 9]!));
    w.step(1200);
    const tiles = dogs.map((d) => w.game.movement.tileOf(d));
    const spot = w.index(13, 13, Z);
    expect(tiles, `tiles ${tiles.join(',')}`).toEqual([spot, spot, spot, spot]);
    for (const d of dogs) expect(w.game.world.entities.get(d, C.Tame)?.curled).toBe(true);
    expect(w.game.movement.crowdPercentAt(spot), 'curled pets lie down').toBe(100);
    expect(w.game.movement.crowdPercentAt(spot, 1), 'a dwarf stepping over them is not slowed').toBe(100);
    w.step(1200);
    expect(dogs.map((d) => w.game.movement.tileOf(d)), 'they stay').toEqual(tiles);
  });

  it(`at most ${PET_PILE_MAX} pets heap; the rest spread over the hall`, () => {
    const { w, hall } = hallWorld('t482-full');
    const pets = [...[0, 1, 2, 3, 4].map((i) => w.spawnTame('dog', hall[i * 9]!)), w.spawnTame('cat', hall[60]!)];
    w.step(1500);
    const spot = w.index(13, 13, Z);
    const tiles = pets.map((d) => w.game.movement.tileOf(d));
    expect(tiles.filter((t) => t === spot).length, `tiles ${tiles.join(',')}`).toBe(PET_PILE_MAX);
    const others = tiles.filter((t) => t !== spot);
    expect(new Set(others).size).toBe(others.length);
    for (const t of others) expect(hall).toContain(t);
  });

  it('the spot is the nook between the hearth and a wall, not the open side', () => {
    const { w } = hallWorld('t482-nook', 10, 14);
    const dogs = [0, 1].map(() => w.spawnTame('dog', w.index(16, 16, Z)));
    w.step(1200);
    expect(dogs.map((d) => w.game.movement.tileOf(d))).toEqual([w.index(10, 13, Z), w.index(10, 13, Z)]);
  });

  it('a pig is no pet: it neither heaps nor stands on the spot', () => {
    const { w, hall } = hallWorld('t482-pig');
    const spot = w.index(13, 13, Z);
    const pigs = [w.spawnTame('pig', spot), w.spawnTame('pig', hall[5]!)];
    w.step(1200);
    const tiles = pigs.map((p) => w.game.movement.tileOf(p));
    expect(tiles).not.toContain(spot);
    expect(new Set(tiles).size).toBe(2);
    for (const p of pigs) expect(w.game.world.entities.get(p, C.Tame)?.curled).toBeUndefined();
  });

  it('curled pets add nothing to a crowd; a pet standing there does', () => {
    const { w, hall } = hallWorld('t482-up');
    const dog = w.spawnTame('dog', hall[0]!);
    w.step(600);
    const spot = w.index(13, 13, Z);
    expect(w.game.movement.tileOf(dog)).toBe(spot);
    const others = [0, 1].map(() => w.spawnTame('dog', spot));
    for (const o of others) w.game.world.entities.add(o, C.Tame, { ...w.game.world.entities.get(o, C.Tame)!, curled: true });
    expect(w.game.movement.crowdPercentAt(spot, 1)).toBe(100);
    // One dog standing, two dwarves and one joining: four, so 150%; the two curled dogs add nothing.
    w.game.world.entities.add(dog, C.Tame, { ...w.game.world.entities.get(dog, C.Tame)!, curled: false });
    w.spawnDwarf({ at: spot });
    w.spawnDwarf({ at: spot });
    expect(w.game.movement.crowdPercentAt(spot, 1)).toBe(150);
  });
});
