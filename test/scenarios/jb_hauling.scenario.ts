/**
 * `jb_hauling` of `04-implementation/acceptance-tests.md` § 11 Jobs: "50 stones on the ground, a
 * stone stockpile of 20 tiles | 20 hauled; `StockpileFull` once; 30 remain".
 */

import { expect } from 'vitest';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';
import { rect } from './m1-helpers';

const Z = 32;
let pile = 0;
const stones: EntityId[] = [];

const scenario: Scenario = {
  id: 'jb_hauling',
  milestone: 2,
  seed: 'jb-hauling',
  world: 'flat-test',
  embark: 'default',
  setup: (w) => {
    stones.length = 0;
    for (let k = 0; k < 50; k += 1) stones.push(w.spawnItem('raw_stone', 'granite', w.index(40 + (k % 10), 16 + Math.floor(k / 10), Z)));
    pile = w.zone('stockpile', rect(w, 44, 26, Z, 5, 4));
    const r = w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'stone' });
    if (!r.ok) throw new Error(`filter: ${r.reason}`);
  },
  run: (w) => {
    const items = w.readers.of<ItemsReader>('13');
    const inPile = (): number => stones.filter((s) => items.stockpileAt(items.tileOf(s)) === pile).length;
    const spent = w.until(() => inPile() === 20, 4000);
    expect(spent).toBeGreaterThan(20);
    w.step(600);
    expect(w.events('JobCompleted').filter((e) => e['jobType'] === 'haul_to_stockpile')).toHaveLength(20);
    expect(inPile()).toBe(20);
    expect(w.events('StockpileFull')).toEqual([expect.objectContaining({ id: pile })]);
    const outside = stones.filter((s) => items.stockpileAt(items.tileOf(s)) === 0);
    expect(outside).toHaveLength(30);
    expect(items.count('raw_stone')).toBe(50);
    // One stone per tile, none left carried, no haul job left open.
    for (const t of rect(w, 44, 26, Z, 5, 4)) expect(items.at(t)).toHaveLength(1);
    expect(stones.every((s) => items.get(s)?.carriedBy === 0 && items.get(s)?.reservedBy === 0)).toBe(true);
    expect(w.game.world.readers.of<{ list(): { producer: string }[] }>('11').list().filter((j) => j.producer === 'items')).toHaveLength(0);
  },
};

export default scenario;
