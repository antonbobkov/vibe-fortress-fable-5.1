/**
 * T-738: Stocks at scale (`panels.md` § Stocks). Under a type, stacks that read alike (material,
 * quality, rot stage, marks) are one row with their units, which opens to them; a stack that differs
 * keeps a row of its own. A filter opens matching types down to those rows and no further, and lists
 * a category or type that matches before one that matches only by a stack's material.
 */
import { describe, expect, it } from 'vitest';
import { ItemFlag } from '@core/components';
import type { Command } from '@core/commands';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { PanelContext } from '@ui/panels/context';
import { drawStocksPanel, StocksPanel } from '@ui/panels/stocks';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const Z = 32;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const sent: Command[] = [];
  const ctx: PanelContext = { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { sent.push(cmd); expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
  return { w, ctx, sent, panel: new StocksPanel(), type: (id: string): number => w.game.registry.table('items').index(id) };
}

/** The rows the tree shows, top to bottom. */
function rows(panel: StocksPanel, ctx: PanelContext): string[] {
  const out: string[] = [];
  panel.tree.selected = 0;
  for (let guard = 0; guard < 500; guard += 1) {
    const node = panel.selectedNode(ctx);
    if (node !== null) out.push(node);
    const before = panel.tree.selected;
    panel.move(1, ctx);
    if (panel.tree.selected === before) break;
  }
  return out;
}

function select(panel: StocksPanel, ctx: PanelContext, node: string): void {
  const at = rows(panel, ctx).indexOf(node);
  if (at < 0) throw new Error(`no row ${node}`);
  panel.tree.selected = at;
}

function draw(panel: StocksPanel, ctx: PanelContext, cols = 36): string[] {
  const s = surface(cols, 50);
  drawStocksPanel(s, { col: 0, row: 0, cols, rows: 50 }, panel, ctx);
  return s.lines().map((line) => line.trimEnd());
}

/** Barley seed in bags of 1 to 10, as the playtest's Year 3 held it: 18 bags hold 120 seeds. */
function barley(w: TestWorld, bags = 18): EntityId[] {
  const counts = [4, 8, 4, 9, 9, 9, 10, 10, 10, 10, 10, 1, 1, 1, 4, 6, 6, 8].slice(0, bags);
  return counts.map((n, k) => w.spawnItem('seed', 'barley', w.index(10 + (k % 9), 10 + Math.floor(k / 9), Z), n));
}

describe('T-738 Stocks shows like stacks as one row', () => {
  it('18 barley bags are one row with the total; Enter opens it to the bags; the line under the tree counts them', () => {
    const { w, ctx, panel, type } = setup('t738-merge');
    const bags = barley(w);
    for (const id of ['seed', `type:${type('seed')}`]) panel.tree.expanded.add(id);
    const shown = rows(panel, ctx);
    const merged = shown.filter((id) => id.startsWith('stacks:'));
    expect(merged).toHaveLength(1);
    expect(shown.filter((id) => id.startsWith('item:'))).toEqual([]);
    const lines = draw(panel, ctx);
    expect(lines.filter((line) => line.includes('barley'))).toHaveLength(1);
    expect(lines.find((line) => line.includes('barley'))).toMatch(/^ {5}► barley +120 +\d+ ☼$/);
    select(panel, ctx, merged[0] as string);
    expect(panel.rotLine(ctx)).toEqual({ text: '18 stacks', alert: false });
    expect(draw(panel, ctx)).toContain(' 18 stacks');
    // Enter opens the row to its 18 bags, one per row, each with its count.
    panel.expand(ctx);
    const open = rows(panel, ctx);
    expect(open.filter((id) => id.startsWith('item:'))).toEqual(bags.map((id) => `item:${id}`));
    expect(draw(panel, ctx).filter((line) => /barley x\d+/.test(line))).toHaveLength(18);
  });

  it('a forbidden bag and a stale turnip keep rows of their own', () => {
    const { w, ctx, panel, type } = setup('t738-apart');
    const tile = w.index(30, 30, Z);
    w.forceTemperature(tile, 20);
    const old = w.spawnItem('plant_food', 'turnip', tile, 20);
    w.step(16 * TICKS_PER_DAY);
    expect(w.readers.of<ItemsReader>('13').rotOutlook(old)?.stage).toBe(1);
    const fresh = [0, 1, 2].map((k) => w.spawnItem('plant_food', 'turnip', w.index(31 + k, 30, Z), 10));
    const bags = barley(w, 13);
    const forbidden = w.spawnItem('seed', 'barley', w.index(20, 20, Z), 10);
    w.game.world.applyCommand({ type: 'ForbidItem', itemId: forbidden, on: true });
    for (const id of ['seed', `type:${type('seed')}`, 'food', 'food/plant', 'food/plant/raw', `type:${type('plant_food')}`]) panel.tree.expanded.add(id);
    const shown = rows(panel, ctx);
    // The turnips: the stale one alone; the three fresh ones one row.
    expect(shown).toContain(`item:${old}`);
    for (const id of fresh) expect(shown).not.toContain(`item:${id}`);
    const turnips = shown.find((id) => id.startsWith(`stacks:${type('plant_food')}:`)) as string;
    expect(panel.rowItems(ctx, turnips)).toEqual(fresh);
    // The seed: the 13 unmarked bags one row, the forbidden one its own.
    expect(shown).toContain(`item:${forbidden}`);
    const seeds = shown.filter((id) => id.startsWith(`stacks:${type('seed')}:`));
    expect(seeds).toHaveLength(1);
    expect(panel.rowItems(ctx, seeds[0] as string)).toEqual(bags);
    select(panel, ctx, seeds[0] as string);
    expect(panel.rotLine(ctx)).toEqual({ text: '13 stacks', alert: false });
    select(panel, ctx, turnips);
    expect(panel.rotLine(ctx)).toEqual({ text: '3 stacks · 0 rot within 3 days', alert: false });
  });

  it('forbid on the row forbids all 13 bags, and a second press clears them', () => {
    const { w, ctx, panel, sent, type } = setup('t738-forbid');
    const bags = barley(w, 13);
    for (const id of ['seed', `type:${type('seed')}`]) panel.tree.expanded.add(id);
    select(panel, ctx, rows(panel, ctx).find((id) => id.startsWith('stacks:')) as string);
    panel.flag(ctx, 'ForbidItem');
    expect(sent).toEqual(bags.map((itemId) => ({ type: 'ForbidItem', itemId, on: true })));
    const reader = w.readers.of<ItemsReader>('13');
    for (const id of bags) expect((reader.get(id)?.flags ?? 0) & ItemFlag.Forbidden).toBe(ItemFlag.Forbidden);
    // Still one row, now of forbidden bags: the next press clears them all.
    w.step(1);
    const merged = rows(panel, ctx).filter((id) => id.startsWith('stacks:'));
    expect(merged).toHaveLength(1);
    select(panel, ctx, merged[0] as string);
    expect(panel.flagCommands(ctx, 'ForbidItem')).toEqual(bags.map((itemId) => ({ type: 'ForbidItem', itemId, on: false })));
  });

  it('the filter `bar` lists the bars before the barley seed, which stays one row', () => {
    const { w, ctx, panel, type } = setup('t738-filter');
    barley(w);
    for (let k = 0; k < 6; k += 1) w.spawnItem('bar', k < 4 ? 'iron' : 'steel', w.index(10 + k, 20, Z), 5);
    for (let k = 0; k < 15; k += 1) w.spawnItem('coal_bar', 'coal', w.index(10 + k, 22, Z), 2);
    panel.filter.value = 'bar';
    const shown = rows(panel, ctx);
    // The bar category and everything under it, opened down to the rows of like stacks, then the seed.
    expect(shown.indexOf('bar')).toBe(0);
    expect(shown.indexOf('seed')).toBeGreaterThan(shown.indexOf(`type:${type('coal_bar')}`));
    expect(shown.filter((id) => id.startsWith('item:'))).toEqual([]);
    const lines = draw(panel, ctx);
    expect(lines.filter((line) => /barley/.test(line))).toHaveLength(1);
    expect(lines.filter((line) => /► (iron|steel|coal) /.test(line))).toHaveLength(3);
    expect(lines.findIndex((line) => line.includes('iron'))).toBeLessThan(lines.findIndex((line) => line.includes('barley')));
    // Enter on the barley row opens it while the filter is set.
    select(panel, ctx, shown.find((id) => id.startsWith(`stacks:${type('seed')}:`)) as string);
    panel.expand(ctx);
    expect(rows(panel, ctx).filter((id) => id.startsWith('item:'))).toHaveLength(18);
  });
});
