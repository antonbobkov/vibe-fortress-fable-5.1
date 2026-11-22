/**
 * T-677: a stockpile placed over items it does not take moves them off (13 § Stockpiles). A stone on a
 * food stockpile goes to a stockpile that takes stone, or, when none does, to a free tile out of the
 * way, and food fills the tile it left. Goods the stockpile takes stay, and so does a forbidden item.
 */

import { describe, expect, it } from 'vitest';
import { C, ItemFlag } from '@core/components';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';
import { rect } from '../../scenarios/m1-helpers';

const Z = 32;

function items(w: TestWorld): ItemsReader {
  return w.readers.of<ItemsReader>('13');
}

function apply(w: TestWorld, cmd: Record<string, unknown>): { ok: boolean } {
  return w.game.world.applyCommand(cmd as never) as { ok: boolean };
}

/** A dwarf, a stone and a meal: a one-tile food stockpile is placed over the stone. */
function setup(seed: string): { w: TestWorld; sp: number; stone: number; meal: number; tile: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const tile = w.index(10, 10, Z);
  const stone = w.spawnItem('raw_stone', 'granite', tile);
  const meal = w.spawnItem('easy_meal', 'dimcap', w.index(20, 14, Z), 5);
  w.spawnDwarf({ at: w.index(15, 12, Z) });
  w.step(5);
  const sp = w.zone('stockpile', [tile]);
  apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'food' });
  return { w, sp, stone, meal, tile };
}

describe('T-677 a stockpile clears items that do not belong on it', () => {
  it('with no stockpile for stone, the stone goes aside to a free tile and the meal fills the stockpile', () => {
    const { w, sp, stone, meal, tile } = setup('t677-aside');
    w.until(() => items(w).tileOf(meal) === tile, 4000);
    const at = items(w).tileOf(stone);
    expect(at).not.toBe(tile);
    expect(items(w).stockpileAt(at)).toBe(0);
    // Out of the way and near: within a few tiles of the stockpile, on the same level.
    const map = w.game.world.map;
    expect(map.zOf(at)).toBe(Z);
    expect(Math.max(Math.abs(map.xOf(at) - 10), Math.abs(map.yOf(at) - 10))).toBeLessThanOrEqual(2);
    expect(items(w).stockpileAt(items(w).tileOf(meal))).toBe(sp);
    // Once aside, the stone stays there: it has no home and is not moved again.
    const settled = items(w).tileOf(stone);
    w.step(1500);
    expect(items(w).tileOf(stone)).toBe(settled);
  });

  it('with a stockpile that takes stone, the stone goes there', () => {
    const { w, stone, meal, tile } = setup('t677-to-stone');
    const stonePile = w.zone('stockpile', rect(w, 30, 10, Z, 2, 2));
    apply(w, { type: 'SetStockpileFilter', zoneId: stonePile, filter: 'stone' });
    w.until(() => items(w).tileOf(meal) === tile && items(w).stockpileAt(items(w).tileOf(stone)) === stonePile, 6000);
  });

  it('leaves a forbidden item and goods the stockpile takes where they lie', () => {
    const w = new TestWorld({ seed: 't677-stay', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const a = w.index(10, 10, Z);
    const b = w.index(11, 10, Z);
    const stone = w.spawnItem('raw_stone', 'granite', a);
    const food = w.spawnItem('easy_meal', 'dimcap', b, 5);
    w.spawnDwarf({ at: w.index(15, 12, Z) });
    expect(apply(w, { type: 'ForbidItem', itemId: stone, on: true }).ok).toBe(true);
    const sp = w.zone('stockpile', [a, b]);
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'food' });
    w.step(1500);
    expect(items(w).tileOf(stone)).toBe(a);
    expect(items(w).tileOf(food)).toBe(b);
    expect((w.game.world.entities.get(stone, C.Item)!.flags & ItemFlag.Forbidden) !== 0).toBe(true);
  });
});
