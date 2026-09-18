/**
 * `bd_room_tiers` of `04-implementation/acceptance-tests.md` § 14 Buildings: "the bedroom and hearth
 * hall examples in buildings-and-furniture.md | tiers bare → decent → fine; grand for the hall".
 *
 * Both worked examples of `buildings-and-furniture.md` § Room quality tiers, reproduced tile by
 * tile in granite on the `flat-test` map: the rooms are dug, smoothed and engraved through the
 * terrain API (engravings of quality 5 in 03's side table), and every piece of furniture is placed
 * from an item of the example's material and quality. Each stage asserts the tier and the exact
 * score of `algorithms/economy.md` § Room quality (8-neighbour border; D-075).
 */

import { expect } from 'vitest';
import { TileFlag } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';
import { rect } from './m1-helpers';

const Z = 25;

/** The 8-neighbour border of a rectangle (all rock walls in these rooms). */
function border(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  const out: TileIndex[] = [];
  for (let yy = y - 1; yy <= y + height; yy += 1) {
    for (let xx = x - 1; xx <= x + width; xx += 1) {
      if (xx >= x && xx < x + width && yy >= y && yy < y + height) continue;
      out.push(w.index(xx, yy, Z));
    }
  }
  return out;
}

function smooth(w: TestWorld, tiles: readonly TileIndex[]): void {
  for (const t of tiles) w.game.world.services.terrain.setFlag(t, TileFlag.Smoothed, true);
}

function engrave(w: TestWorld, tiles: readonly TileIndex[], quality: number): void {
  const terrain = w.game.terrain;
  if (terrain === null) throw new Error('no terrain');
  for (const t of tiles) {
    terrain.core.engravings.set(t, { quality, engraverId: 0, motif: 0 });
    w.game.world.services.terrain.setFlag(t, TileFlag.Engraved, true);
  }
}

/** Place a piece of furniture from a fresh item of the given material and quality. */
function furnish(w: TestWorld, type: string, at: TileIndex, material: string, quality: number): { building: EntityId; item: EntityId } {
  const item = w.spawnItem(type === 'cage_building' ? 'cage' : type, material, at, 1, quality);
  const building = w.build(type, at, material, 0, item);
  return { building, item };
}

const scenario: Scenario = {
  id: 'bd_room_tiers',
  milestone: 2,
  seed: 'bd-room-tiers',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const b = w.readers.of<BuildingsReader>('14');
    const items = w.readers.of<ItemsReader>('13');
    const value = (id: EntityId): number => items.value(id);
    const settle = (): void => w.step(10);
    const expectRoom = (zone: EntityId, facts: Record<string, unknown>, score: number): void => {
      expect(b.room(zone)).toMatchObject(facts);
      expect(b.room(zone)?.score).toBeCloseTo(score, 9);
    };

    // ---- The bedroom: 2×3 dug in granite, unsmoothed, a common pine bed. ----
    const bx = 30;
    const by = 30;
    w.digRoom(bx, by, Z, 2, 3);
    const floor = rect(w, bx, by, Z, 2, 3);
    const walls = border(w, bx, by, 2, 3);
    for (const t of [...floor, ...walls]) w.discover(t);
    const bedroom = w.zone('bedroom', floor);
    const bed = furnish(w, 'bed', w.index(bx, by, Z), 'pine', 1);
    settle();
    expect(value(bed.item)).toBe(10);
    // tiles 6 × 1; walls 0; furniture 10/10; size 6; enclosed × 1.5.
    expectRoom(bedroom, { tier: 0, enclosed: true, requirementsMet: true }, (6 + 0 + 1 + 6) * 1.5);

    // Smooth the six floor tiles and the bordering walls: decent.
    smooth(w, [...floor, ...walls]);
    settle();
    expectRoom(bedroom, { tier: 2 }, (18 + walls.length * 2 + 1 + 6) * 1.5);

    // Add a fine oak cabinet and a common granite chest: still decent.
    const cabinet = furnish(w, 'cabinet', w.index(bx + 1, by, Z), 'oak', 2);
    const chest = furnish(w, 'chest', w.index(bx, by + 2, Z), 'granite', 1);
    settle();
    expect(value(cabinet.item)).toBe(27);
    expect(value(chest.item)).toBe(10);
    const furniture3 = (10 + 27 + 10) / 10;
    expectRoom(bedroom, { tier: 2 }, (18 + walls.length * 2 + furniture3 + 6) * 1.5);

    // Engrave the walls (quality 5: 2 + 2.5 each): still decent.
    engrave(w, walls, 5);
    settle();
    expectRoom(bedroom, { tier: 2 }, (18 + walls.length * 4.5 + furniture3 + 6) * 1.5);

    // A masterwork (oak) bed and engraved floors (3 + 5 each): fine.
    const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
    system.buildings.remove(bed.building);
    const master = furnish(w, 'bed', w.index(bx, by, Z), 'oak', 5);
    engrave(w, floor, 5);
    settle();
    expect(value(master.item)).toBe(75);
    const furniture5 = (75 + 27 + 10) / 10;
    expectRoom(bedroom, { tier: 3 }, (48 + walls.length * 4.5 + furniture5 + 6) * 1.5);
    expect(w.events('RoomQualityChanged').filter((e) => e['zoneId'] === bedroom).map((e) => e['tier'])).toEqual([2, 3]);

    // ---- The hearth hall: 7×7, the hearth, four granite tables, eight chairs, two fine statues. ----
    const hx = 50;
    const hy = 30;
    w.digRoom(hx, hy, Z, 7, 7);
    const hall = rect(w, hx, hy, Z, 7, 7);
    const hallWalls = border(w, hx, hy, 7, 7);
    for (const t of [...hall, ...hallWalls]) w.discover(t);
    const hallZone = w.zone('hearth_hall', hall);
    smooth(w, [...hall, ...hallWalls]);
    w.build('hearth', w.index(hx + 3, hy + 3, Z), 'granite');
    const tables: EntityId[] = [];
    const chairs: EntityId[] = [];
    for (const [tx, ty] of [
      [1, 1],
      [5, 1],
      [1, 5],
      [5, 5],
    ] as const) {
      tables.push(furnish(w, 'table', w.index(hx + tx, hy + ty, Z), 'granite', 1).item);
      chairs.push(furnish(w, 'chair', w.index(hx + tx, hy + ty - 1, Z), 'granite', 1).item);
      chairs.push(furnish(w, 'chair', w.index(hx + tx, hy + ty + 1, Z), 'granite', 1).item);
    }
    const statues = [furnish(w, 'statue', w.index(hx, hy + 3, Z), 'granite', 2).item, furnish(w, 'statue', w.index(hx + 6, hy + 3, Z), 'granite', 2).item];
    settle();
    for (const t of tables) expect(value(t)).toBe(8);
    for (const s of statues) expect(value(s)).toBe(36);
    const hallFurniture = (tables.length * 8 + chairs.reduce((sum, c) => sum + value(c), 0)) / 10 + statues.length * 7.2;
    // tiles 49 × 3; walls (8-neighbour border) × 2; furniture (the hearth links no item: 0); size 40 (cap); × 1.5.
    expectRoom(hallZone, { tier: 4, enclosed: true, requirementsMet: true }, (147 + hallWalls.length * 2 + hallFurniture + 40) * 1.5);
    expect(b.hearthHallTier()).toBe(4);
    expect(b.diningSeats().length).toBe(8);
    expect(w.events('RoomQualityChanged').filter((e) => e['zoneId'] === hallZone).map((e) => e['tier'])).toEqual([4]);
  },
};

export default scenario;
