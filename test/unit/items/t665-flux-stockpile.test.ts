/**
 * T-665: a stockpile's filter may name a material tag beside its classes (13 § Stockpiles): a material
 * carrying the tag passes whatever the classes allow. `flux` alone keeps the smelter's flux stone (limestone,
 * marble, dolomite, chalk) by the smelter without drawing every other rock of the mine there.
 */

import { describe, expect, it } from 'vitest';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function apply(w: TestWorld, cmd: Record<string, unknown>): { ok: boolean; reason?: string } {
  return w.game.world.applyCommand(cmd as never) as { ok: boolean; reason?: string };
}

describe('T-665 a stockpile that takes flux stone', () => {
  it('a flux-tagged filter takes flux stone and no other rock; a class still adds its own materials', () => {
    const w = new TestWorld({ seed: 't665', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const items = w.readers.of<ItemsReader>('13');
    const sp = w.zone('stockpile', [w.index(10, 10, Z), w.index(11, 10, Z)]);
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: { categories: ['stone/raw'], materialClasses: [], materialTags: ['flux'] } })).toEqual({ ok: true });
    expect(items.stockpile(sp)?.filter.materialTags).toEqual(['flux']);
    const at = w.index(30, 30, Z);
    const limestone = w.spawnItem('raw_stone', 'limestone', at);
    const marble = w.spawnItem('raw_stone', 'marble', at);
    const granite = w.spawnItem('raw_stone', 'granite', at);
    const block = w.spawnItem('stone_block', 'limestone', at);
    expect(items.stockpileAccepts(sp, limestone)).toBe(true);
    expect(items.stockpileAccepts(sp, marble)).toBe(true);
    expect(items.stockpileAccepts(sp, granite)).toBe(false);
    expect(items.stockpileAccepts(sp, block)).toBe(false); // the category still rules
    // A class beside the tag adds its materials; the tag adds flux stone to a class that lacks it.
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: { categories: ['stone/raw', 'ore'], materialClasses: ['ore'], materialTags: ['flux'] } })).toEqual({ ok: true });
    expect(items.stockpileAccepts(sp, limestone)).toBe(true);
    expect(items.stockpileAccepts(sp, granite)).toBe(false);
    // Without the tag the classes alone rule, as before.
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: { categories: ['stone/raw'], materialClasses: [] } })).toEqual({ ok: true });
    expect(items.stockpile(sp)?.filter.materialTags).toBeUndefined();
    expect(items.stockpileAccepts(sp, limestone)).toBe(false);
    // Only the tags the editor offers are accepted.
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: { categories: ['stone/raw'], materialTags: ['fine_cask'] } })).toEqual({ ok: false, reason: 'bad_category' });
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: { categories: ['stone/raw'], materialTags: 'flux' } })).toEqual({ ok: false, reason: 'bad_category' });
  });

  it('a hauler brings the flux stone to the store and leaves the granite where it lies', () => {
    const w = new TestWorld({ seed: 't665b', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const items = w.readers.of<ItemsReader>('13');
    const store = [w.index(10, 10, Z), w.index(11, 10, Z)];
    const sp = w.zone('stockpile', store);
    expect(apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: { categories: ['stone/raw'], materialClasses: [], materialTags: ['flux'] } }).ok).toBe(true);
    const limestone = w.spawnItem('raw_stone', 'limestone', w.index(18, 12, Z));
    const granite = w.spawnItem('raw_stone', 'granite', w.index(18, 13, Z));
    w.spawnDwarf({ at: w.index(14, 12, Z) });
    w.until(() => store.includes(items.tileOf(limestone) ?? -1) && items.get(limestone)?.carriedBy === 0, 3000);
    expect(store).toContain(items.tileOf(limestone));
    expect(items.tileOf(granite)).toBe(w.index(18, 13, Z));
  });
});
