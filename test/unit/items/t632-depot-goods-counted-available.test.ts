/**
 * T-632: goods taken to the trade depot belong to the trade until they are removed (20), so 13's
 * `countAvailable` leaves them out under every filter, as the stock counts do for one type
 * (13 § Searching, § Stock counts). T-631's world: barley straw at the depot, free straw and reeds;
 * the straw pallet's build row read `(19)` while 8 units could be fetched.
 */
import { describe, expect, it } from 'vitest';
import { ItemFlag } from '@core/components';
import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import type { BuildingRow } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { BuildTool } from '@ui/panels/build';
import type { PanelContext } from '@ui/panels/context';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from '../ui/ui-fixture';

const Z = 32;

function ctxOf(w: TestWorld): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
}

describe('T-632 goods at the trade depot are not available under any filter', () => {
  it('depot straw counts toward no filter and not toward the straw pallet\'s build row, until it is taken back', () => {
    const w = new TestWorld({ seed: 't632-depot-straw', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const items = w.game.world.services.items;
    if (items === null) throw new Error('no item API');
    const at = (x: number): number => w.index(x, 30, Z);
    // 11 at the depot, one at a time as the audit's depot listed them; 4 free straw, 4 free reeds.
    const depot: EntityId[] = [];
    for (let k = 0; k < 11; k += 1) depot.push(w.spawnItem('straw', 'barley', at(20 + (k % 5)), 1));
    for (const id of depot) items.setFlag(id, ItemFlag.AtDepot, true);
    w.spawnItem('straw', 'barley', at(30), 4);
    w.spawnItem('reed', 'reed_bed', at(31), 4);

    const reader = w.readers.of<ItemsReader>('13');
    const table = w.game.registry.table('items');
    const straw = table.index('straw');
    const types = ['fiber', 'straw', 'reed'].map((id) => table.index(id));
    const barley = w.game.registry.table('materials').index('barley');
    // One type reads the stock counts; every other filter counts the items by the same rule.
    expect(reader.countAvailable({ type: straw })).toBe(4);
    expect(reader.countAvailable({ types })).toBe(8);
    expect(reader.countAvailable({ types: [straw] })).toBe(4);
    expect(reader.countAvailable({ type: straw, materialId: barley })).toBe(4);
    expect(reader.countAvailable({ category: 'textile' })).toBe(8);
    // Every unit is still in stock, whatever its flags.
    expect(reader.countMatching({ types })).toBe(19);

    // The straw pallet's build row and its material choice count what can be fetched.
    const ctx = ctxOf(w);
    const row = w.game.registry.table<BuildingRow>('buildings').byId('straw_pallet') as BuildingRow;
    expect(new BuildTool().available(ctx, row)).toBe(8);
    const tool = new BuildTool();
    tool.category = 'furniture';
    tool.list.selected = tool.rows(ctx).findIndex((r) => r.id === 'straw_pallet');
    expect(tool.current(ctx)?.id).toBe('straw_pallet');
    expect(tool.materials(ctx)[0]?.count).toBe(8);

    // Taken back from the depot (20 `RemoveFromDepot` clears the flag), the straw counts again.
    for (const id of depot) items.setFlag(id, ItemFlag.AtDepot, false);
    expect(reader.countAvailable({ types })).toBe(19);
    expect(reader.countAvailable({ type: straw })).toBe(15);
    expect(new BuildTool().available(ctx, row)).toBe(19);
  });
});
