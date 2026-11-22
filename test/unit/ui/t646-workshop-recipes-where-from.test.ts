/**
 * T-646: the Workshop panel's `○` recipes say where a missing input comes from, one step back, as
 * Add order does, and wrap at the sidebar's width rather than cutting (`ui-screens/panels.md`
 * § Workshop).
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { WorkshopsReader } from '@systems/workshops';
import type { PanelContext } from '@ui/panels/context';
import { drawWorkshopPanel, OrdersPanel } from '@ui/panels/orders';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const Z = 25;
const ROWS = 32;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 60 * TICKS_PER_DAY });
  w.digRoom(10, 10, Z, 20, 12);
  for (let y = 9; y <= 22; y += 1) for (let x = 9; x <= 30; x += 1) w.discover(w.index(x, y, Z));
  const ctx: PanelContext = {
    readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
  const kitchen = w.build('kitchen', w.index(11, 11, Z), 'granite');
  w.step(1);
  return { w, ctx, kitchen, orders: new OrdersPanel() };
}

/** The panel drawn in a 36-cell sidebar with `recipeId` selected; its rows, margin and scrollbar off. */
function panel(ctx: PanelContext, orders: OrdersPanel, id: EntityId, recipeId: string): string[] {
  const reader = ctx.readers.of<WorkshopsReader>('12');
  const type = ctx.readers.of<BuildingsReader>('14').get(id)!.typeId;
  const ordered = orders.groupRecipes(ctx, reader.recipesFor(type)).flatMap((row) => ('recipe' in row ? [row.recipe.id] : []));
  expect(ordered).toContain(recipeId);
  orders.workshopList(id).selected = ordered.indexOf(recipeId);
  const s = surface(36, ROWS);
  drawWorkshopPanel(s, { col: 0, row: 0, cols: 36, rows: ROWS }, id, orders, ctx);
  return s.lines().map((line) => line.slice(1).replace(/\s*[│█]$/, '').trimEnd());
}

/** The row starting with `start` and the lines hung under it, joined. */
function wrapped(rows: readonly string[], start: string): { text: string; lines: string[] } {
  const at = rows.findIndex((row) => row.startsWith(start));
  expect(at).toBeGreaterThanOrEqual(0);
  let end = at + 1;
  while (end < rows.length && /^ {2}\S/.test(rows[end] as string)) end += 1;
  const lines = rows.slice(at, end);
  return { text: lines.map((line) => line.trim()).join(' '), lines };
}

describe('T-646 a workshop\'s ○ recipe says where its missing input comes from', () => {
  it('a built kitchen reads the soap row with its step back, whole at 36 cells', () => {
    const { ctx, kitchen, orders } = setup('t646-soap');
    const rows = panel(ctx, orders, kitchen, 'make_soap');
    const soap = wrapped(rows, '○ Soap');
    expect(soap.text).toBe('○ Soap · no tallow: render fat at a kitchen (needs fat from butchering)');
    expect(soap.lines.length).toBeGreaterThan(1);
    expect(soap.lines.every((line) => line.length <= 34)).toBe(true);
    expect(rows.join('\n')).not.toContain('»');
  });

  it('with fat in stock the step back is only the rendering', () => {
    const { w, ctx, kitchen, orders } = setup('t646-fat');
    w.spawnItem('fat', 'tallow', w.index(20, 15, Z), 1);
    expect(wrapped(panel(ctx, orders, kitchen, 'make_soap'), '○ Soap').text).toBe('○ Soap · no tallow: render fat at a kitchen');
  });

  it('the foot rows stay where they are', () => {
    const { ctx, kitchen, orders } = setup('t646-foot');
    const rows = panel(ctx, orders, kitchen, 'make_soap');
    expect(rows[ROWS - 9]).toMatch(/^─+ Orders \(0\) ─+$/);
    expect(rows[ROWS - 5]).toContain('[n] new order');
    expect(rows[ROWS - 3]).toContain('[S-s] suspend');
  });
});
