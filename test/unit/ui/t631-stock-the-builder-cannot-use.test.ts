/**
 * T-631: the Stocks panel counts every unit that is not a merchant's, while a build, an order and a
 * workshop count only what is available (13's `countAvailable`). The line under the rot line says
 * how many of the selected row can be used now and why the rest cannot (`panels.md` § Stocks).
 *
 * The world: barley straw at the depot, forbidden, reserved, carried and free; reeds free.
 */
import { describe, expect, it } from 'vitest';
import { C, ItemFlag } from '@core/components';
import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { PanelContext } from '@ui/panels/context';
import { drawStocksPanel, StocksPanel, unusableReason } from '@ui/panels/stocks';
import type { TreeNode } from '@ui/widgets';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, strings, surface, theme } from './ui-fixture';

const Z = 32;

function ctxOf(w: TestWorld): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
}

/** Select a row of the stocks tree by its node id, with every row expanded so that it shows. */
function select(panel: StocksPanel, ctx: PanelContext, node: string): void {
  const expand = (nodes: readonly TreeNode[]): void => {
    for (const n of nodes) {
      panel.tree.expanded.add(n.id);
      expand(n.children);
    }
  };
  expand(panel.visibleForest(ctx));
  panel.tree.selected = 0;
  for (let guard = 0; guard < 500; guard += 1) {
    if (panel.selectedNode(ctx) === node) return;
    const before = panel.tree.selected;
    panel.move(1, ctx);
    if (panel.tree.selected === before) break;
  }
  throw new Error(`no row ${node}`);
}

function draw(panel: StocksPanel, ctx: PanelContext): string[] {
  const s = surface(36, 40);
  drawStocksPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, panel, ctx);
  return s.lines().map((line) => line.trimEnd());
}

describe('T-631 Stocks says how much of a row can be used now, and why not the rest', () => {
  it('straw at the depot, forbidden, reserved and carried: the line names each, and the pallet counts the rest', () => {
    const w = new TestWorld({ seed: 't631-straw', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const ctx = ctxOf(w);
    const items = w.game.world.services.items;
    if (items === null) throw new Error('no item API');
    const at = (x: number): number => w.index(x, 30, Z);
    // 11 at the depot, as the audit's depot listed them: one at a time.
    const depot: EntityId[] = [];
    for (let k = 0; k < 11; k += 1) depot.push(w.spawnItem('straw', 'barley', at(20 + (k % 5)), 1));
    for (const id of depot) items.setFlag(id, ItemFlag.AtDepot, true);
    const forbidden = w.spawnItem('straw', 'barley', at(30), 3);
    w.game.world.applyCommand({ type: 'ForbidItem', itemId: forbidden, on: true });
    const reserved = w.spawnItem('straw', 'barley', at(31), 2);
    items.reserve(reserved, 77);
    const hauler = w.spawnDwarf({ at: at(32) });
    const carried = w.spawnItem('straw', 'barley', at(32), 1);
    items.attachToCarrier(carried, hauler);
    w.spawnItem('straw', 'barley', at(33), 4);
    w.spawnItem('reed', 'reed_bed', at(34), 4);

    const read = (id: EntityId): ReturnType<ItemsReader['get']> => w.readers.of<ItemsReader>('13').get(id);
    expect(unusableReason(read(depot[0] as EntityId)!)).toBe('depot');
    expect(unusableReason(read(forbidden)!)).toBe('forbidden');
    expect(unusableReason(read(reserved)!)).toBe('reserved');
    expect(unusableReason(read(carried)!)).toBe('carried');

    const panel = new StocksPanel();
    const straw = w.game.registry.table('items').index('straw');
    select(panel, ctx, `type:${straw}`);
    const lines = draw(panel, ctx);
    // 21 barley straw in all; 4 free.
    const use = lines.findIndex((line) => line.trim().startsWith('Usable'));
    expect(use).toBeGreaterThan(0);
    const text = `${lines[use]?.trim()} ${lines[use + 1]?.trim()}`.trim();
    expect(text).toBe('Usable 4 of 21: 11 at the depot, 3 forbidden, 1 carried, 2 reserved');
    // The line sits under the rot line, above the wealth.
    expect(lines[use + 2]?.trim()).toMatch(/^Wealth /);

    // What the line calls usable is 13's available count of the type (its stock counts).
    expect(w.readers.of<ItemsReader>('13').countAvailable({ type: straw })).toBe(4);

    // One forbidden stack: its own line, in the alert colour since none of it can be used.
    select(panel, ctx, `item:${forbidden}`);
    const s = surface(36, 40);
    drawStocksPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, panel, ctx);
    const row = s.lines().findIndex((line) => line.trim().startsWith('Usable'));
    expect(s.lines()[row]?.trim()).toBe('Usable 0 of 3: 3 forbidden');
    expect(fgOfText(s, row, 'Usable')).toBe(hexOf(theme.alert));

    // A free stack, and the reeds: no line.
    select(panel, ctx, `type:${w.game.registry.table('items').index('reed')}`);
    expect(draw(panel, ctx).some((line) => line.includes('Usable'))).toBe(false);
  });

  it('a forbid made while paused shows at once; the category row sums its types', () => {
    const w = new TestWorld({ seed: 't631-paused', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const ctx = ctxOf(w);
    const a = w.spawnItem('straw', 'barley', w.index(30, 30, Z), 5);
    w.spawnItem('reed', 'reed_bed', w.index(31, 30, Z), 4);
    const panel = new StocksPanel();
    const straw = w.game.registry.table('items').index('straw');
    select(panel, ctx, `type:${straw}`);
    expect(draw(panel, ctx).some((line) => line.includes('Usable'))).toBe(false);
    // No tick passes: the counts are cached for the tick, the line reads the items as they are.
    w.game.world.applyCommand({ type: 'ForbidItem', itemId: a, on: true });
    expect(panel.useLine(ctx)).toEqual({ text: 'Usable 0 of 5: 5 forbidden', alert: true });
    // The category over straw (textile/straw) and reed (textile/reed) counts both.
    expect(w.readers.of<ItemsReader>('13').categoryOf(straw)).toBe('textile/straw');
    select(panel, ctx, 'textile');
    expect(panel.useLine(ctx)).toEqual({ text: 'Usable 4 of 9: 5 forbidden', alert: false });
    expect(w.game.world.entities.get(a, C.Item)?.flags ?? 0).toBe(ItemFlag.Forbidden);
  });
});
