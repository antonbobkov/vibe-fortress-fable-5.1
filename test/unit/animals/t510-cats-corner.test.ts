import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z - 2;

/**
 * T-510: on `three-years-p0-6` cats that had adopted a dwarf stood together on one tile of the hall's way
 * in for a day or more: a pet within reach of its dwarf stopped where it was, and T-463's spreading rule,
 * for animals with no owner, never moved it. A pet whose dwarf is in or beside the hall now takes its tile
 * as any idle tame animal there does, and cats heap on a corner of their own, off the way in.
 */
function hallWorld(seed: string, way?: { x: number; y: number }): { w: TestWorld; hall: TileIndex[] } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.digRoom(10, 10, Z, 8, 8);
  // A way in: a short corridor west of the hall.
  if (way !== undefined) w.digRoom(way.x - 2, way.y, Z, 3, 1);
  for (let y = 8; y < 20; y += 1) for (let x = 6; x < 20; x += 1) w.discover(w.index(x, y, Z));
  const hall: TileIndex[] = [];
  for (let y = 10; y < 18; y += 1) for (let x = 10; x < 18; x += 1) hall.push(w.index(x, y, Z));
  w.build('hearth', w.index(14, 14, Z), 'granite');
  w.zone('hearth_hall', hall);
  w.step(1);
  expect(w.readers.of<BuildingsReader>('14').hearthHallTiles().length).toBeGreaterThan(0);
  return { w, hall };
}

function adopt(w: TestWorld, cat: EntityId, dwarf: EntityId): void {
  w.game.world.entities.add(cat, C.Tame, { ...w.game.world.entities.get(cat, C.Tame)!, petOf: dwarf });
}

describe('T-510 cats in the hall keep off its way in', () => {
  it('cats that adopted dwarves in the hall do not stay together on the tile they came in on', () => {
    const { w } = hallWorld('t510-owned', { x: 9, y: 13 });
    const dwarves = [0, 1, 2].map((i) => w.spawnDwarf({ at: w.index(13 + i, 15, Z) }));
    const door = w.index(10, 13, Z);
    const cats = dwarves.map((d) => {
      const cat = w.spawnTame('cat', door);
      adopt(w, cat, d);
      return cat;
    });
    w.step(1200);
    const tiles = cats.map((c) => w.game.movement.tileOf(c));
    expect(tiles, `tiles ${tiles.join(',')}`).not.toContain(door);
    // They heap on the cats' corner, the hall's corner farthest from its way in, curled, slowing no one.
    const corner = w.index(17, 10, Z);
    expect(tiles).toEqual([corner, corner, corner]);
    for (const c of cats) expect(w.game.world.entities.get(c, C.Tame)?.curled).toBe(true);
    expect(w.game.movement.crowdPercentAt(corner, 1)).toBe(100);
  });

  it('cats heap in their corner and dogs by the hearth', () => {
    const { w, hall } = hallWorld('t510-clubs');
    const dogs = [0, 1].map((i) => w.spawnTame('dog', hall[i * 9]!));
    const cats = [0, 1].map((i) => w.spawnTame('cat', hall[40 + i * 9]!));
    w.step(1200);
    const spot = w.index(13, 13, Z);
    // With no way in, the corners tie and the lowest index wins.
    const corner = w.index(10, 10, Z);
    expect(dogs.map((d) => w.game.movement.tileOf(d))).toEqual([spot, spot]);
    expect(cats.map((c) => w.game.movement.tileOf(c))).toEqual([corner, corner]);
    for (const a of [...dogs, ...cats]) expect(w.game.world.entities.get(a, C.Tame)?.curled).toBe(true);
  });

  it('the corner is not the one beside the way in', () => {
    const { w } = hallWorld('t510-way', { x: 9, y: 10 });
    const cat = w.spawnTame('cat', w.index(14, 16, Z));
    w.step(1200);
    // (10, 10) has the way in beside it, so four of its neighbours are taken, not five.
    expect(w.game.movement.tileOf(cat)).toBe(w.index(17, 10, Z));
  });

  it('a cat whose dwarf is out of the hall still follows it', () => {
    const { w } = hallWorld('t510-follow', { x: 9, y: 13 });
    w.digRoom(1, 13, Z, 6, 1);
    for (let x = 0; x < 8; x += 1) w.discover(w.index(x, 13, Z));
    const dwarf = w.spawnDwarf({ at: w.index(1, 13, Z) });
    const cat = w.spawnTame('cat', w.index(16, 16, Z));
    adopt(w, cat, dwarf);
    w.step(30);
    const target = w.game.movement.walkTarget(cat);
    expect(target, 'the cat walks to its dwarf, not to its corner').toBeGreaterThanOrEqual(0);
    expect(w.map.xOf(target)).toBeLessThan(10);
  });
});
