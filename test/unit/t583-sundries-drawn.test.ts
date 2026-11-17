/**
 * T-583: every good a caravan lists can come (`caravan-goods.md`; 20 § Goods, § Sundries). The draw
 * skips a good worth nothing, and three were: the Mountainhome's sand and the Hillfolk's clay (soil,
 * value 0) and the Wildwood's brightleaf (a plant of value 0, both its entries). None of them came, by
 * the draw or by a request: in twenty three-year fortresses, sixty years of caravans, not one.
 */

import { describe, expect, it } from 'vitest';
import { RngStream } from '@core/rng';
import { generateGoods } from '@systems/trade';
import { registry } from './ui/ui-fixture';

interface Entry { item: string | string[]; materials: { material: string }[]; biomes?: string[] }

describe('T-583 every listed good can come', () => {
  it('a request brings each good of each civilization in each of its materials, worth something', () => {
    const goods = registry.derived<readonly { civ: string; entries: Entry[] }[]>('caravanGoods');
    const items = registry.table('items');
    const creatures = registry.table('creatures');
    const missing: string[] = [];
    for (const { civ, entries } of goods) {
      for (const e of entries) {
        for (const item of Array.isArray(e.item) ? e.item : [e.item]) {
          for (const material of e.materials.length === 0 ? [undefined] : e.materials.map((m) => m.material)) {
            if (material === 'deepsilver') continue; // Never sold below reputation 75 (20 § Never sold).
            // A budget that holds the dearest good; the Hillfolk's honey and camels need their site.
            const site = { wildwoodFarther: true, biome: e.biomes?.[0] ?? 'temperate_forest' };
            const brought = generateGoods(registry, civ as never, 100, 60, [{ itemType: item, ...(material === undefined ? {} : { material }), priority: 3 }],
              new RngStream(583), new RngStream(584), site);
            const ok = brought.some((g) => g.value > 0 && (creatures.has(item) ? g.species === creatures.index(item) : !items.has(item) || g.type === items.index(item)));
            if (!ok) missing.push(`${civ} ${item}${material === undefined ? '' : ` of ${material}`}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('a load of sand, clay or peat is worth a mark, a brightleaf four', () => {
    for (const id of ['sand', 'clay', 'peat']) expect(registry.table<{ id: string; value: number }>('materials').byId(id)?.value, id).toBe(1);
    expect(registry.table<{ id: string; value: number }>('materials').byId('brightleaf')?.value).toBe(1);
  });
});
