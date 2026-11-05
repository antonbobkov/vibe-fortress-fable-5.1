import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z - 2;

function hallWorld(seed: string): { w: TestWorld; hall: TileIndex[] } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.digRoom(10, 10, Z, 8, 8);
  const hall: TileIndex[] = [];
  for (let y = 10; y < 18; y += 1) for (let x = 10; x < 18; x += 1) {
    w.discover(w.index(x, y, Z));
    hall.push(w.index(x, y, Z));
  }
  w.build('hearth', w.index(14, 14, Z), 'granite');
  w.zone('hearth_hall', hall);
  w.step(1);
  expect(w.readers.of<BuildingsReader>('14').hearthHallTiles().length).toBeGreaterThan(0);
  return { w, hall };
}

describe('T-463 idle tame animals spread out', () => {
  // Pigs: dogs and cats heap on the pets' spot by the hearth (T-482); the spreading rule is for the rest.
  it('six idle pigs in a hall stand on six tiles, and stay there', () => {
    const { w, hall } = hallWorld('t463-six');
    const dogs = [0, 1, 2, 3, 4, 5].map(() => w.spawnTame('pig', hall[20]!));
    w.step(1200);
    const tiles = (): TileIndex[] => dogs.map((d) => w.game.movement.tileOf(d));
    const first = tiles();
    expect(new Set(first).size, `tiles ${first.join(',')}`).toBe(6);
    for (const t of first) expect(hall).toContain(t);
    w.step(1200);
    expect(tiles(), 'no wander: they stand where they took').toEqual(first);
  });

  it('pigs whose last walk ended where they stand still spread out', () => {
    const { w, hall } = hallWorld('t463-stale');
    const dogs = [0, 1, 2].map(() => w.spawnTame('pig', hall[20]!));
    // A walk that arrived stays recorded until it is asked for again: its target is the dog's own tile.
    const walks = (w.game.movement as unknown as { walks: Map<number, { target: number; request: number; following: boolean; attempts: number }> }).walks;
    for (const d of dogs) walks.set(d, { target: hall[20]!, request: 0, following: true, attempts: 0 });
    expect(dogs.every((d) => w.game.movement.walkTarget(d) === w.game.movement.tileOf(d))).toBe(true);
    w.step(1200);
    const tiles = dogs.map((d) => w.game.movement.tileOf(d));
    expect(new Set(tiles).size, `tiles ${tiles.join(',')}`).toBe(3);
  });

  it('pigs take hall tiles before the lower-index tiles beside the hall', () => {
    const { w, hall } = hallWorld('t463-beside');
    w.digRoom(10, 9, Z, 8, 1);
    for (let x = 10; x < 18; x += 1) w.discover(w.index(x, 9, Z));
    w.step(1);
    const dogs = [0, 1, 2, 3].map(() => w.spawnTame('pig', hall[20]!));
    w.step(1200);
    for (const d of dogs) expect(hall).toContain(w.game.movement.tileOf(d));
  });

  it('a dog on a tile of its own is not moved by a dwarf arriving there', () => {
    const { w, hall } = hallWorld('t463-pass');
    const dog = w.spawnTame('dog', hall[3]!);
    w.step(600);
    const stands = w.game.movement.tileOf(dog);
    w.spawnDwarf({ at: stands });
    w.step(5);
    expect(w.game.movement.tileOf(dog)).toBe(stands);
  });
});
