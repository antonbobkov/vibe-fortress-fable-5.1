/**
 * T-651: when every `○` recipe of a workshop lacks the same input with the same step back (a
 * carpenter's with no log), the Workshop panel and Add order opened from it say that once above the
 * list, and each row keeps its short "· no log" on one line (`ui-screens/panels.md` § Workshop,
 * § Add order).
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { WorkshopsReader } from '@systems/workshops';
import type { PanelContext } from '@ui/panels/context';
import { drawOrdersPanel, drawWorkshopPanel, OrdersPanel } from '@ui/panels/orders';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const Z = 25;
const ROWS = 32;
const SHARED = 'No log (from felling trees)';

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 60 * TICKS_PER_DAY });
  w.digRoom(10, 10, Z, 20, 12);
  for (let y = 9; y <= 22; y += 1) for (let x = 9; x <= 30; x += 1) w.discover(w.index(x, y, Z));
  const ctx: PanelContext = {
    readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
  const shop = w.build('carpenter', w.index(11, 11, Z), 'granite');
  w.step(1);
  return { w, ctx, shop, orders: new OrdersPanel() };
}

/** Drawn lines as text: the margin and the scrollbar off. */
const rowsOf = (lines: readonly string[]): string[] => lines.map((line) => line.slice(1).trimEnd().replace(/\s*[│█]$/, '').trimEnd());

/** The Workshop panel drawn in a 36-cell sidebar, 32 rows. */
function workshop(ctx: PanelContext, orders: OrdersPanel, id: EntityId): string[] {
  const s = surface(36, ROWS);
  drawWorkshopPanel(s, { col: 0, row: 0, cols: 36, rows: ROWS }, id, orders, ctx);
  return rowsOf(s.lines());
}

const count = (rows: readonly string[], text: string): number => rows.join('\n').split(text).length - 1;
const joined = (rows: readonly string[]): string => rows.join(' ').replace(/\s+/g, ' ');

describe('T-651 a missing input every recipe shares is said once', () => {
  it('a woodless carpenter\'s panel names "no log (from felling trees)" once and shows its recipes one row each', () => {
    const { ctx, shop, orders } = setup('t651-woodless');
    const rows = workshop(ctx, orders, shop);
    expect(count(rows, 'felling trees')).toBe(1);
    // On the state row, under the worker: the Recipes rule stays on row 3, so the list keeps its 19 rows.
    expect(rows[2]).toBe(SHARED);
    expect(rows[3]).toMatch(/^─+ Recipes ─+$/);
    expect(rows[ROWS - 9]).toMatch(/^─+ Orders \(0\) ─+$/);
    const list = rows.slice(4, ROWS - 9);
    expect(list).toHaveLength(19);
    // Every row is a heading or one recipe on one line, with its short note.
    for (const row of list) expect(row).toMatch(/^(─+ .+ ─+|○ [^·]+ · no log)$/);
    expect(list.filter((row) => row.startsWith('○')).length).toBeGreaterThanOrEqual(12);
    expect(rows.join('\n')).not.toContain('»');
  });

  it('in a narrow panel the note wraps and the Recipes rule moves down under it', () => {
    const { ctx, shop, orders } = setup('t651-narrow');
    const s = surface(20, ROWS);
    drawWorkshopPanel(s, { col: 0, row: 0, cols: 20, rows: ROWS }, shop, orders, ctx);
    const rows = rowsOf(s.lines());
    expect(`${rows[2]} ${rows[3]}`).toBe(SHARED);
    expect(rows[4]).toMatch(/^─+ Recipes ─+$/);
    expect(rows[ROWS - 9]).toMatch(/^─+ Orders \(0\) ─+$/);
  });

  it('recipes that lack different things keep their own notes', () => {
    const { w, ctx, shop, orders } = setup('t651-one-log');
    // One log: a shield lacks a bar, a cabinet its second log.
    w.spawnItem('log', 'oak', w.index(20, 15, Z), 1);
    let rows = workshop(ctx, orders, shop);
    expect(rows[2]).toBe('');
    expect(rows[3]).toMatch(/^─+ Recipes ─+$/);
    expect(joined(rows)).toContain('○ Shield · no bar: made at a smelter');
    const reader = ctx.readers.of<WorkshopsReader>('12');
    const ordered = orders.groupRecipes(ctx, reader.recipesFor('carpenter')).flatMap((row) => ('recipe' in row ? [row.recipe.id] : []));
    orders.workshopList(shop).selected = ordered.indexOf('make_cabinet_wood');
    rows = workshop(ctx, orders, shop);
    // T-790: one log of the two a cabinet takes says the shortfall.
    expect(joined(rows)).toContain('○ Cabinet · needs 2 logs, 1 in stock (from felling trees)');
  });

  it('Add order opened from the woodless carpenter says it once too', () => {
    const { ctx, shop, orders } = setup('t651-picker');
    orders.openPicker(ctx, { workshopId: shop });
    const s = surface(36, 30);
    drawOrdersPanel(s, { col: 0, row: 0, cols: 36, rows: 30 }, orders, ctx);
    const rows = rowsOf(s.lines());
    expect(rows[2]).toBe(SHARED);
    expect(count(rows, 'felling trees')).toBe(1);
    const recipes = rows.filter((row) => row.startsWith('○'));
    expect(recipes.length).toBeGreaterThan(8);
    for (const row of recipes) expect(row).toMatch(/^○ [^·]+ · no log$/);
  });
});
