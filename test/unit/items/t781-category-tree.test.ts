import { describe, it, expect } from 'vitest';
import itemsJson from '@content/items.json';
import { CATEGORY_TREE, STOCKPILE_PRESETS } from '@systems/items';

describe('T-781 the stockpile editor tree has every category an item uses', () => {
  const tree = new Set(CATEGORY_TREE);

  it('every item type category in items.json is a node of CATEGORY_TREE', () => {
    const missing = [...new Set(itemsJson.map((row) => row.category))].filter((c) => !tree.has(c)).sort();
    expect(missing).toEqual([]);
  });

  it('every prefix of a node is a node, so the editor can draw each leaf under its parent', () => {
    const orphans = CATEGORY_TREE.filter((c) => c.includes('/') && !tree.has(c.slice(0, c.lastIndexOf('/'))));
    expect(orphans).toEqual([]);
  });

  it('the leaves 13 lists for furniture and tools are there, in the spec order', () => {
    const under = (top: string): string[] => CATEGORY_TREE.filter((c) => c.startsWith(`${top}/`)).map((c) => c.slice(top.length + 1));
    expect(under('furniture')).toEqual([
      'bed', 'table', 'chair', 'door', 'hatch', 'cabinet', 'chest', 'coffin', 'statue', 'cage', 'mechanism', 'floodgate', 'anvil',
      'nest_box', 'weapon_rack', 'armor_stand', 'memorial_slab', 'trap_part', 'stone_bed', 'bedding', 'pillow', 'beehive',
      'lantern', 'archery_target', 'chain',
    ]);
    expect(under('tool')).toEqual(['pick', 'axe', 'fishing_rod', 'crutch', 'candle', 'firebrand', 'quiver']);
  });

  it('every preset names a node of the tree, so none takes anything new', () => {
    const stray = Object.values(STOCKPILE_PRESETS).flatMap((p) => p.categories).filter((c) => !tree.has(c));
    expect(stray).toEqual([]);
  });
});
