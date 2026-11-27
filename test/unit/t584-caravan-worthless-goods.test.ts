/**
 * T-584: a caravan brings the goods of its list that are worth nothing in the fortress (sand, clay,
 * brightleaf). 20 § Party, Goods: a good worth nothing counts `CARAVAN_GOOD_VALUE_MIN` marks a unit
 * in the draw and a request, and stays worth nothing in the fortress and at the merchant's price.
 */

import { describe, expect, it } from 'vitest';
import { RngStream } from '@core/rng';
import { CARAVAN_GOOD_VALUE_MIN, eligibleGoodsEntries, generateGoods, type GoodsEntry } from '@systems/trade';
import { itemValue } from '@systems/items/value';
import type { Civ } from '@core/types';
import { registry } from './ui/ui-fixture';

const CIVS: readonly Civ[] = ['mountainhome', 'hillfolk', 'wildwood'];
/** A renown whose budget's request share holds the dearest good of every list. */
const RENOWN = 2000;
const REPUTATION = 100;
const items = registry.table<{ id: string; tags?: string[] }>('items');
const materials = registry.table<{ id: string; class: string }>('materials');

/** The goods an entry names: its item keys (a packaged or paired entry's first only) by its materials. */
function goodsOf(entry: GoodsEntry): { itemType: string; material?: string }[] {
  const keys = Array.isArray(entry.item) ? entry.item : [entry.item];
  const packaged = entry.container !== undefined || keys.includes('drink') || keys.includes('seed') || keys.includes('flour');
  const paired = keys.includes('crossbow') || keys.includes('bandage');
  const named = packaged || paired ? keys.slice(0, 1) : keys;
  const result: { itemType: string; material?: string }[] = [];
  for (const itemType of named) {
    if (entry.materials.length === 0 || itemType === 'bandage') result.push({ itemType });
    else for (const m of entry.materials) result.push({ itemType, material: m.material });
  }
  return result;
}

/** Whether a planned good is of the asked item (by id or tag) and material (by id or class). */
function matches(type: number, material: number, species: number | undefined, asked: { itemType: string; material?: string }): boolean {
  const row = items.byIndex(type);
  const isType = row?.id === asked.itemType || row?.tags?.includes(asked.itemType) === true
    || (species !== undefined && registry.table('creatures').byIndex(species)?.id === asked.itemType);
  if (!isType) return false;
  if (asked.material === undefined) return true;
  const mat = materials.byIndex(material);
  return mat?.id === asked.material || mat?.class === asked.material;
}

describe('T-584 caravans bring the goods worth nothing', () => {
  it('sand, clay and brightleaf are listed and worth nothing in the fortress', () => {
    const value = (item: string, material: string): number => {
      const row = registry.table<{ id: string; mult: number; quality: boolean }>('items').byId(item)!;
      const mat = registry.table<{ id: string; value: number }>('materials').byId(material)!;
      return itemValue(mat.value, row.mult, 1, row.quality, 1);
    };
    expect(value('soil_load', 'sand')).toBe(0);
    expect(value('soil_load', 'clay')).toBe(0);
    expect(value('brightleaf', 'brightleaf')).toBe(0);
  });

  it('every good of every list can be brought by a request, and counts for more than nothing', () => {
    for (const civ of CIVS) {
      // The Hillfolk's camels are listed in a desert, and their honey where the Wildwood is farther.
      const site = { wildwoodFarther: true, ...(civ === 'hillfolk' ? { biome: 'desert' } : {}) };
      for (const entry of eligibleGoodsEntries(registry, civ, REPUTATION, site)) {
        for (const asked of goodsOf(entry)) {
          const label = `${civ} ${asked.itemType} ${asked.material ?? ''}`;
          const goods = generateGoods(registry, civ, RENOWN, REPUTATION, [{ ...asked, priority: 3 }], new RngStream(584), new RngStream(585), site);
          // The request's draws come first, before the weighted pool's; T-798: a request that finds an
          // extra entry raises its roll instead, so its good comes as an extra.
          const brought = goods.filter((g) => (entry.extra !== undefined || !g.extra) && matches(g.type, g.material, g.species, asked));
          expect(brought.length, label).toBeGreaterThan(0);
          for (const g of brought) expect(g.value, label).toBeGreaterThan(0);
        }
      }
    }
  });

  it('a good worth nothing counts the floor a unit, and the weighted draw brings it', () => {
    const sand = materials.index('sand');
    const soil = items.index('soil_load');
    let lots = 0;
    for (let seed = 0; seed < 40; seed += 1) {
      const goods = generateGoods(registry, 'mountainhome', 0, 0, [], new RngStream(seed), new RngStream(1000 + seed));
      for (const g of goods) {
        if (g.type !== soil || g.material !== sand) continue;
        lots += 1;
        expect(g.value).toBe(g.count * CARAVAN_GOOD_VALUE_MIN);
      }
    }
    expect(lots).toBeGreaterThan(0);
  });
});
