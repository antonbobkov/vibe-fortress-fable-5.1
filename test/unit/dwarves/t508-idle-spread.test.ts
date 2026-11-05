import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z - 2;

/** An 8×8 hearth hall at (10..17, 10..17) with a corridor running west from its middle row. */
function hallWorld(seed: string): { w: TestWorld; hall: TileIndex[]; outside: TileIndex } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.digRoom(10, 10, Z, 8, 8);
  w.digRoom(4, 13, Z, 6, 1);
  const hall: TileIndex[] = [];
  for (let y = 10; y < 18; y += 1) for (let x = 10; x < 18; x += 1) {
    w.discover(w.index(x, y, Z));
    hall.push(w.index(x, y, Z));
  }
  for (let x = 4; x < 10; x += 1) w.discover(w.index(x, 13, Z));
  w.build('hearth', w.index(14, 14, Z), 'granite');
  w.zone('hearth_hall', hall);
  w.step(1);
  expect(w.readers.of<BuildingsReader>('14').hearthHallTiles().length).toBeGreaterThan(0);
  return { w, hall, outside: w.index(5, 13, Z) };
}

function idleDwarves(w: TestWorld, at: TileIndex, n: number): EntityId[] {
  return Array.from({ length: n }, () => w.spawnDwarf({ at }));
}

/** Steps `ticks` with every dwarf's needs held at zero: with no want to serve, an idle dwarf goes to the hall and stands. */
function stepContent(w: TestWorld, ticks: number, joy = 0): void {
  for (let done = 0; done < ticks; done += 10) {
    for (const id of w.game.world.entities.with(C.Needs)) {
      const needs = w.game.world.entities.get(id, C.Needs)!;
      w.game.world.entities.add(id, C.Needs, { ...needs, hunger: 0, thirst: 0, rest: 0, social: 0, comfort: 0, purpose: 0, joy });
    }
    w.step(10);
  }
}

describe('T-508 idle dwarves spread over the hall', () => {
  it('six idle dwarves coming in by one way stand on six hall tiles, and stay there', () => {
    const { w, hall, outside } = hallWorld('t508-six');
    const dwarves = idleDwarves(w, outside, 6);
    stepContent(w, 600);
    const tiles = (): TileIndex[] => dwarves.map((d) => w.game.movement.tileOf(d));
    const first = tiles();
    for (const d of dwarves) expect(w.game.world.entities.get(d, C.Brain)?.behavior).toBe('idle');
    for (const t of first) expect(hall).toContain(t);
    expect(new Set(first).size, `tiles ${first.join(',')}`).toBe(6);
    stepContent(w, 600);
    expect(tiles(), 'they stand where they took, through later idle waits').toEqual(first);
  });

  it('an idle dwarf leaves a hall tile a pig stands on', () => {
    const { w, hall, outside } = hallWorld('t508-pig');
    const [dwarf] = idleDwarves(w, outside, 1);
    stepContent(w, 600);
    const took = w.game.movement.tileOf(dwarf!);
    expect(hall).toContain(took);
    // Passers-by do not move a standing tame animal (08 § Tame behavior), so the dwarf makes room.
    const pig = w.spawnTame('pig', took);
    stepContent(w, 600);
    expect(w.game.movement.tileOf(pig)).toBe(took);
    const stands = w.game.movement.tileOf(dwarf!);
    expect(hall).toContain(stands);
    expect(stands).not.toBe(took);
  });

  it('dwarves on a joy errand stand in the hall on tiles of their own', () => {
    const { w, hall, outside } = hallWorld('t508-joy');
    const dwarves = idleDwarves(w, outside, 5);
    let seen = 0;
    for (let look = 0; look < 30; look += 1) {
      stepContent(w, 20, 65);
      const standing = dwarves.filter((d) => {
        const b = w.game.world.entities.get(d, C.Brain);
        return b?.activity === 'joy' && w.game.movement.tileOf(d) === b.targetTile;
      }).map((d) => w.game.movement.tileOf(d));
      for (const t of standing) expect(hall).toContain(t);
      expect(new Set(standing).size, `tiles ${standing.join(',')}`).toBe(standing.length);
      if (standing.length >= 2) seen += 1;
    }
    expect(seen, 'looks with two or more dwarves on the errand at once').toBeGreaterThan(0);
  });
});
