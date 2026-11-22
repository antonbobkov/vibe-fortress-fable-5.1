import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { TAME_AMBLE_RADIUS } from '@systems/animals/constants';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';

/**
 * 08 § Tame behavior, *After the hall* (T-683): an unpastured grazer grazes about the wagon by day and comes
 * in to the hall at night, under an alert and while a threat stands near the wagon; shut out, it stays out.
 * A cat prowls the fortress's halls by day and heaps in its corner at night.
 */

const Z = FLAT_TEST_SURFACE_Z;
const H = Z - 2;

/** A hall dug two levels down (10..17, 10..17), a room east of it through a gap, stairs up at (9, 13) to the surface. */
function hallWorld(seed: string): { w: TestWorld; hall: TileIndex[]; wagon: TileIndex } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const map = w.game.map;
  w.digRoom(10, 10, H, 8, 8);
  w.digRoom(18, 13, H, 1, 1);
  w.digRoom(19, 10, H, 6, 8);
  w.carve(map.index(9, 13, H), TileKind.StairsUp);
  w.carve(map.index(9, 13, H + 1), TileKind.StairsUpDown);
  w.carve(map.index(9, 13, Z), TileKind.StairsDown);
  for (let z = H; z <= Z; z += 1) for (let y = 8; y < 20; y += 1) for (let x = 6; x < 27; x += 1) w.discover(map.index(x, y, z));
  const hall: TileIndex[] = [];
  for (let y = 10; y < 18; y += 1) for (let x = 10; x < 18; x += 1) hall.push(map.index(x, y, H));
  w.build('hearth', map.index(14, 14, H), 'granite');
  w.zone('hearth_hall', hall);
  const wagon = map.index(24, 22, Z);
  w.dwarves.wagonTile = wagon;
  // Grass about the wagon (the flat test world has none).
  for (let y = 16; y < 29; y += 1) for (let x = 18; x < 31; x += 1) map.setFlag(map.index(x, y, Z), TileFlag.Grass, true);
  w.step(1);
  expect(w.readers.of<BuildingsReader>('14').hearthHallTiles().length).toBeGreaterThan(0);
  expect(w.reachable(hall[0]!, wagon)).toBe(true);
  return { w, hall, wagon };
}

function far(w: TestWorld, a: TileIndex, b: TileIndex): number {
  const m = w.game.map;
  return Math.max(Math.abs(m.xOf(a) - m.xOf(b)), Math.abs(m.yOf(a) - m.yOf(b)));
}

const day = (w: TestWorld): boolean => w.readers.calendar.isDaylight;

function hungry(w: TestWorld, id: EntityId, condition: number): void {
  w.game.world.entities.add(id, C.Tame, { ...w.game.world.entities.get(id, C.Tame)!, condition });
}

/** Walls round a surface tile, so what stands on it stays there. */
function pen(w: TestWorld, x: number, y: number): void {
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (dx !== 0 || dy !== 0) w.carve(w.game.map.index(x + dx, y + dy, Z), TileKind.Wall);
}

describe('T-683 unpastured animals after the hall', () => {
  it('a grazer with no pasture grazes about the wagon by day and comes in to the hall at night', () => {
    const { w, hall, wagon } = hallWorld('t683-graze');
    const sheep = [0, 1, 2].map((k) => w.spawnTame('sheep', hall[k * 9]!));
    for (const id of sheep) hungry(w, id, 70);
    w.until((x) => !day(x), 2400);
    w.until(day, 2400);
    // By day: out to the wagon's ground, standing on grass, and fed.
    const grazed = new Set<EntityId>();
    for (let k = 0; k < 16; k += 1) {
      w.step(25);
      for (const id of sheep) {
        const at = w.game.movement.tileOf(id);
        if (w.game.map.zOf(at) === Z && far(w, at, wagon) <= TAME_AMBLE_RADIUS && w.game.map.hasFlag(at, TileFlag.Grass)) grazed.add(id);
      }
    }
    expect([...grazed].sort()).toEqual([...sheep].sort());
    for (const id of sheep) expect(w.game.world.entities.get(id, C.Tame)!.condition, `sheep ${id}`).toBeLessThan(70);
    // At night: in the hall.
    w.until((x) => !day(x), 1200);
    w.step(250);
    for (const id of sheep) expect(hall, `sheep ${id} at night`).toContain(w.game.movement.tileOf(id));
  });

  it('under an alert a grazer comes in; it does not go out while a hostile stands near the wagon', () => {
    const { w, hall, wagon } = hallWorld('t683-alert');
    const cow = w.spawnTame('cow', hall[0]!);
    w.until(day, 2400);
    w.step(200);
    expect(far(w, w.game.movement.tileOf(cow), wagon)).toBeLessThanOrEqual(TAME_AMBLE_RADIUS * 2);
    w.submit({ type: 'SetAlert', level: 'watchful' });
    w.step(200);
    expect(hall).toContain(w.game.movement.tileOf(cow));
    // A trollkin penned outdoors near the wagon keeps it in when the alert is over.
    pen(w, 34, 22);
    w.spawnCreature('trollkin', w.game.map.index(34, 22, Z), 'hostile:gloam');
    w.submit({ type: 'SetAlert', level: 'calm' });
    for (let k = 0; k < 6; k += 1) {
      w.step(25);
      expect(day(w)).toBe(true);
      expect(hall, 'the cow stays in').toContain(w.game.movement.tileOf(cow));
    }
  });

  it('shut out of the hall under an alert, a grazer stays out by the wagon and keeps ambling', () => {
    const { w, hall, wagon } = hallWorld('t683-shut');
    const cow = w.spawnTame('cow', hall[0]!);
    w.until(day, 2400);
    w.step(300);
    expect(far(w, w.game.movement.tileOf(cow), wagon)).toBeLessThanOrEqual(TAME_AMBLE_RADIUS * 2);
    // The way down closes, then the alert comes.
    w.carve(w.game.map.index(9, 13, H + 1), TileKind.Wall);
    w.step(2);
    w.submit({ type: 'SetAlert', level: 'hearth' });
    const seen = new Set<TileIndex>();
    for (let k = 0; k < 16; k += 1) {
      w.step(25);
      const at = w.game.movement.tileOf(cow);
      seen.add(at);
      expect(w.game.map.zOf(at)).toBe(Z);
      expect(far(w, at, wagon), 'about the wagon').toBeLessThanOrEqual(TAME_AMBLE_RADIUS * 2);
    }
    expect(seen.size, 'it ambles, it does not stand at the closed way').toBeGreaterThan(1);
  });

  it('a cat prowls the halls by day, never outdoors, and heaps in its corner at night', () => {
    const { w } = hallWorld('t683-cat');
    const cat = w.spawnTame('cat', w.game.map.index(12, 12, H));
    const seen = new Set<TileIndex>();
    let east = false;
    for (let k = 0; k < 100; k += 1) {
      w.step(25);
      if (!day(w)) continue;
      const at = w.game.movement.tileOf(cat);
      seen.add(at);
      expect(w.game.map.hasFlag(at, TileFlag.Outdoor), 'never outdoors').toBe(false);
      if (w.game.map.xOf(at) >= 19) east = true;
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
    expect(east, 'it prowls into the room beside the hall').toBe(true);
    w.until(day, 1200);
    w.until((x) => !day(x), 1200);
    w.step(250);
    // The cats' corner, by T-510's rule.
    expect(w.game.movement.tileOf(cat)).toBe(w.game.map.index(10, 17, H));
    expect(w.game.world.entities.get(cat, C.Tame)?.curled).toBe(true);
  });
});
