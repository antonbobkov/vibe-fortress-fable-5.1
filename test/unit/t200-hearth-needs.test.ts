/**
 * T-200: under a `hearth` alert a civilian's critical hunger, thirst or rest overrides the
 * retreat, and a want-level need is served only from inside the shelter (10 § Behavior selection).
 */

import { describe, it, expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { CRITICAL, WANT } from '@systems/dwarves/needs';
import { TestWorld } from '../scenarios/test-world';

/** One level of the flat test world, dug out below the surface. */
const Z = FLAT_TEST_SURFACE_Z - 7;

function rect(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  const out: TileIndex[] = [];
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) out.push(w.index(x + dx, y + dy, Z));
  return out;
}

interface Fortress {
  readonly w: TestWorld;
  readonly dwarves: EntityId[];
  /** The hearth hall's tiles now (the hall grows as the hearth is built). */
  inHall(tile: TileIndex): boolean;
}

/**
 * One dug chamber: a 7x7 hearth hall at x 17..23, a food stockpile and a drink stockpile at
 * x 40..41, outside the hall. `inHall` puts one meal and one barrel of ale in the hall instead.
 */
function fortress(seed: string, count: number, inHall = false): Fortress {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  w.digRoom(14, 14, Z, 34, 14);
  for (const tile of rect(w, 14, 14, 34, 14)) w.discover(tile);
  w.build('hearth', w.index(20, 20, Z), 'granite');
  w.zone('hearth_hall', rect(w, 17, 17, 7, 7));
  const food = w.zone('stockpile', rect(w, 40, 19, 2, 2));
  w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: food, filter: 'food' });
  const drink = w.zone('stockpile', rect(w, 40, 22, 2, 2));
  w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: drink, filter: 'drink' });
  if (inHall) {
    w.spawnItem('easy_meal', 'dimcap', w.index(22, 22, Z), 15);
    const barrel = w.spawnItem('barrel', 'pine', w.index(22, 18, Z));
    w.spawnItem('drink', 'ale', { containerId: barrel }, 20);
  } else {
    for (const tile of rect(w, 40, 19, 2, 2)) w.spawnItem('easy_meal', 'dimcap', tile, 15);
    for (const tile of rect(w, 40, 22, 2, 2)) {
      const barrel = w.spawnItem('barrel', 'pine', tile);
      w.spawnItem('drink', 'ale', { containerId: barrel }, 20);
    }
  }
  const dwarves: EntityId[] = [];
  for (let i = 0; i < count; i += 1) dwarves.push(w.spawnDwarf({ at: w.index(18 + i, 19, Z) }));
  const hallHas = (tile: TileIndex): boolean => w.readers.of<BuildingsReader>('14').hearthHallTiles().includes(tile);
  return { w, dwarves, inHall: hallHas };
}

function tileOf(w: TestWorld, id: EntityId): TileIndex {
  const at = w.game.world.entities.get(id, C.Position);
  if (at === undefined) throw new Error('no position');
  return w.index(at.x, at.y, at.z);
}

function needOf(w: TestWorld, id: EntityId, need: 'hunger' | 'thirst' | 'rest'): number {
  return w.game.world.entities.get(id, C.Needs)?.[need] ?? Number.NaN;
}

/** Steps `ticks` and holds the needs other than `keep` low, so that only `keep` is in play. */
function run(f: Fortress, ticks: number, keep: 'hunger' | 'thirst' | 'none', each?: () => boolean): void {
  for (let t = 0; t < ticks; t += 10) {
    f.w.step(10);
    for (const id of f.dwarves) {
      for (const need of ['hunger', 'thirst', 'rest'] as const) {
        if (need !== keep && needOf(f.w, id, need) > 20) f.w.setNeed(id, need, 0);
      }
    }
    if (each !== undefined && each()) return;
  }
}

function shelter(f: Fortress): void {
  expect(f.w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' })).toEqual({ ok: true });
  run(f, 400, 'none');
  for (const id of f.dwarves) {
    expect(f.inHall(tileOf(f.w, id)), 'every dwarf is in the hall').toBe(true);
    expect(f.w.game.world.entities.get(id, C.Brain)?.behavior).toBe('retreat');
  }
}

describe('T-200 10 a critical need overrides the retreat under a hearth alert', () => {
  it('a fortress with food and drink in stock held under hearth for five days has no Starving event and no death', () => {
    const f = fortress('t200-five-days', 4);
    expect(f.w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' })).toEqual({ ok: true });
    f.w.step(5 * TICKS_PER_DAY);
    expect(f.w.events('Starving').map((e) => `${String(e['id'])}:${String(e['need'])}`)).toEqual([]);
    expect(f.w.events('CreatureDied')).toEqual([]);
    for (const id of f.dwarves) {
      expect(f.w.game.world.entities.alive(id)).toBe(true);
      expect(f.w.game.world.fortress.alert).toBe('hearth');
    }
  }, 120_000);

  it('a sheltering dwarf at want-level hunger with the food outside the hall stays put', () => {
    const f = fortress('t200-want-outside', 1);
    shelter(f);
    const [dwarf] = f.dwarves as [EntityId];
    const hunger = WANT.hunger + 10;
    expect(hunger).toBeLessThan(CRITICAL.hunger as number);
    f.w.setNeed(dwarf, 'hunger', hunger);
    run(f, 200, 'hunger');
    expect(f.inHall(tileOf(f.w, dwarf)), 'it stayed in the hall').toBe(true);
    expect(f.w.game.world.entities.get(dwarf, C.Brain)?.behavior).toBe('retreat');
    expect(needOf(f.w, dwarf, 'hunger')).toBeGreaterThanOrEqual(hunger);
  });

  it('a sheltering dwarf at want-level hunger eats when the food is inside the hall', () => {
    const f = fortress('t200-want-inside', 1, true);
    shelter(f);
    const [dwarf] = f.dwarves as [EntityId];
    const hunger = WANT.hunger + 10;
    f.w.setNeed(dwarf, 'hunger', hunger);
    run(f, 300, 'hunger');
    expect(needOf(f.w, dwarf, 'hunger'), 'it ate').toBeLessThan(hunger - 10);
    expect(f.inHall(tileOf(f.w, dwarf))).toBe(true);
    expect(f.w.game.world.entities.get(dwarf, C.Brain)?.behavior).toBe('retreat');
  });

  it('the same dwarf at critical hunger goes out, eats and is back in the shelter afterwards', () => {
    const f = fortress('t200-critical', 1);
    shelter(f);
    const [dwarf] = f.dwarves as [EntityId];
    f.w.setNeed(dwarf, 'hunger', (CRITICAL.hunger as number) + 5);
    let left = false;
    run(f, 1500, 'hunger', () => {
      if (!f.inHall(tileOf(f.w, dwarf))) left = true;
      return left && needOf(f.w, dwarf, 'hunger') < WANT.hunger;
    });
    expect(left, 'it left the hall for the food').toBe(true);
    expect(needOf(f.w, dwarf, 'hunger'), 'it ate').toBeLessThan(WANT.hunger);
    run(f, 600, 'none');
    expect(f.inHall(tileOf(f.w, dwarf)), 'it is back in the hall').toBe(true);
    expect(f.w.game.world.entities.get(dwarf, C.Brain)?.behavior).toBe('retreat');
    expect(f.w.game.world.fortress.alert).toBe('hearth');
  });

  it('critical thirst goes out for a drink the same way', () => {
    const f = fortress('t200-thirst', 1);
    shelter(f);
    const [dwarf] = f.dwarves as [EntityId];
    f.w.setNeed(dwarf, 'thirst', (CRITICAL.thirst as number) + 5);
    let left = false;
    run(f, 1500, 'thirst', () => {
      if (!f.inHall(tileOf(f.w, dwarf))) left = true;
      return left && needOf(f.w, dwarf, 'thirst') < WANT.thirst;
    });
    expect(left, 'it left the hall for the drink').toBe(true);
    expect(needOf(f.w, dwarf, 'thirst'), 'it drank').toBeLessThan(WANT.thirst);
    run(f, 600, 'none');
    expect(f.inHall(tileOf(f.w, dwarf))).toBe(true);
    expect(f.w.game.world.entities.get(dwarf, C.Brain)?.behavior).toBe('retreat');
  });
});
