/**
 * U-03: work orders have a quantity (`docs/archive/ui-fixes/README.md` D-U5; `reports/audits/ui-audit.md`
 * issue 3, M2, Q2, S3). Adding an order opens the picker (type-ahead filter, recipes grouped by
 * output category with the recent ones first, quantity, `once N` / `keep ≥ N`, material, and the
 * workshop of a global order); in the list `+`/`-` change the selected order's count, `[S-n]`
 * adds, `[r]` repeats, and every order shows its status.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { computeLayout } from '@render/cellbuffer';
import type { WorkshopsReader } from '@systems/workshops';
import { ORDER_COUNT_MAX } from '@ui/constants';
import { helpKeyRows } from '@ui/panels/help';
import { countStep, drawOrdersPanel, drawWorkshopPanel } from '@ui/panels/orders';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import type { Speed } from '@ui/status';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const RECT = { col: 0, row: 0, cols: 36, rows: 40 };

interface Asked { id: string; params: Record<string, unknown> }

interface Fixture {
  readonly w: TestWorld;
  readonly screen: FortressScreen;
  readonly sent: Command[];
  readonly asked: Asked[];
  readonly speeds: Speed[];
  /** What the confirmation dialog answers. */
  answer: boolean;
  orders(): WorkshopsReader;
}

/** A fortress screen over a flat world; commands are applied by the world on its next step. */
function setup(seed: string): Fixture {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const sent: Command[] = [];
  const asked: Asked[] = [];
  const speeds: Speed[] = [];
  const fixture: { answer: boolean } = { answer: true };
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => { sent.push(cmd); w.submit(cmd); },
    speed: () => 1,
    setSpeed: (speed) => { speeds.push(speed); },
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => computeLayout(80, 42, true),
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
    confirm: (id, params, reply) => {
      asked.push({ id, params: params as Record<string, unknown> });
      reply(fixture.answer);
    },
  };
  const screen = new FortressScreen(host, keymap, strings);
  return {
    w, screen, sent, asked, speeds,
    get answer() { return fixture.answer; },
    set answer(value: boolean) { fixture.answer = value; },
    orders: () => w.readers.of<WorkshopsReader>('12'),
  };
}

/** Type a word, one key at a time. */
function type(screen: FortressScreen, word: string): void {
  for (const ch of word) expect(screen.key(press(ch))).toBe(true);
}

function panelText(f: Fixture): string {
  const s = surface(RECT.cols, RECT.rows);
  drawOrdersPanel(s, RECT, f.screen.orders, f.screen.ctx);
  return s.lines().join('\n');
}

/** A carpenter's workshop with its panel open. */
function carpenter(f: Fixture): number {
  const shop = f.w.build('carpenter', f.w.index(15, 15, z));
  f.w.step(1);
  f.screen.workshopId = shop;
  f.screen.openPanel('workshop');
  return shop;
}

describe('U-03 work orders have a quantity (D-U5, M2, Q2)', () => {
  it('crafting 5 doors takes one order with remaining 5', () => {
    const f = setup('u03-five-doors');
    const shop = carpenter(f);
    // [S-n] on the workshop opens the picker; "door" filters, 5 is the quantity, Enter adds.
    expect(f.screen.key(press('N', { shift: true }))).toBe(true);
    expect(f.screen.ui.panel).toBe('orders');
    expect(f.screen.orders.picker.open).toBe(true);
    type(f.screen, 'door');
    expect(f.screen.orders.pickerRecipes(f.screen.ctx).map((r) => r.id)).toEqual(['make_door_wood']);
    expect(f.screen.key(press('5'))).toBe(true);
    expect(f.screen.key(press('Enter'))).toBe(true);
    expect(f.sent).toEqual([{ type: 'AddWorkOrder', workshopId: shop, order: { recipeId: 'make_door_wood', mode: 'once', remaining: 5, threshold: 0, priority: 5, materialFilter: null } }]);
    f.w.step(1);
    const orders = f.orders().ordersOf(shop);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ mode: 'once', remaining: 5 });
    expect(f.screen.orders.picker.open).toBe(false);
    // The status row says what was ordered, and the list shows one row with its count.
    expect(f.screen.statusRow2()).toBe('Ordered: ×5 Door. Waiting for log (0 in stock).');
    expect(panelText(f)).toContain('x5 Door · ');
  });

  it('the picker: digits type the quantity, +/- step it by 1 and with Shift by 10, within 1–999', () => {
    const f = setup('u03-quantity');
    carpenter(f);
    f.screen.key(press('N', { shift: true }));
    const p = f.screen.orders.picker;
    expect(p.quantity).toBe(1);
    f.screen.key(press('1'));
    f.screen.key(press('2'));
    expect(p.quantity).toBe(12);
    f.screen.key(press('+'));
    expect(p.quantity).toBe(13);
    f.screen.key(press('='));
    expect(p.quantity).toBe(14);
    f.screen.key(press('-'));
    expect(p.quantity).toBe(13);
    f.screen.key(press('+', { shift: true }));
    expect(p.quantity).toBe(23);
    f.screen.key(press('_', { shift: true }));
    expect(p.quantity).toBe(13);
    // A digit after another key starts a new number; 0 alone is not a quantity.
    f.screen.key(press('7'));
    expect(p.quantity).toBe(7);
    f.screen.key(press('-'));
    f.screen.key(press('0'));
    expect(p.quantity).toBe(6);
    for (const digit of '9999') f.screen.key(press(digit));
    expect(p.quantity).toBe(ORDER_COUNT_MAX);
    for (let k = 0; k < 3; k += 1) f.screen.key(press('_', { shift: true }));
    f.screen.key(press('7'));
    f.screen.key(press('-', { shift: true }));
    expect(p.quantity).toBe(1);
    expect(countStep(press('x'))).toBe(0);
  });

  it('the picker groups recipes by output category with the recent ones first, and the filter narrows them', () => {
    const f = setup('u03-groups');
    carpenter(f);
    f.screen.key(press('N', { shift: true }));
    const headings = (): string[] => f.screen.orders.pickerRows(f.screen.ctx).flatMap((row) => ('heading' in row ? [row.heading] : []));
    expect(headings()).toEqual([...headings()].sort());
    expect(headings()).toEqual(expect.arrayContaining(['Furniture', 'Container']));
    expect(headings()).not.toContain('Recent');
    const text = panelText(f);
    expect(text).toContain('Add order');
    expect(text).toContain('Find [');
    expect(text).toMatch(/─ Furniture ─/);
    expect(text).toContain('Quantity [-]   1 [+]');
    expect(text).toContain('once: make 1');
    expect(text).toContain('any material');
    expect(text).toContain("Carpenter's workshop #1");
    expect(text).toContain('[Enter] add [Tab] next [Esc] back');
    // Order a bed: the next picker lists it under "Recent" first.
    type(f.screen, 'bed');
    f.screen.key(press('Enter'));
    f.screen.key(press('N', { shift: true }));
    expect(headings()[0]).toBe('Recent');
    expect(f.screen.orders.pickerRecipe(f.screen.ctx)?.id).toBe('make_bed');
    // The filter is letters only; Backspace takes one back; an unmatched filter says so on Enter.
    type(f.screen, 'zzz');
    expect(f.screen.orders.pickerRecipes(f.screen.ctx)).toEqual([]);
    expect(panelText(f)).toContain('No recipe matches "zzz".');
    const before = f.sent.length;
    f.screen.key(press('Enter'));
    expect(f.sent).toHaveLength(before);
    expect(f.screen.statusRow2()).toBe('No recipe matches "zzz".');
    expect(f.screen.orders.picker.open).toBe(true);
    for (let k = 0; k < 3; k += 1) f.screen.key(press('Backspace'));
    expect(f.screen.orders.picker.filter).toBe('');
    // Esc closes the picker and leaves the panel open.
    f.screen.key(press('Esc'));
    expect(f.screen.orders.picker.open).toBe(false);
    expect(f.screen.ui.panel).toBe('orders');
  });

  it('the picker toggles once N / keep ≥ N and picks a material with Tab and the arrows', () => {
    const f = setup('u03-mode');
    const shop = carpenter(f);
    f.screen.key(press('N', { shift: true }));
    type(f.screen, 'barrel');
    f.screen.key(press('1'));
    f.screen.key(press('0'));
    const p = f.screen.orders.picker;
    expect(p.field).toBe('recipe');
    f.screen.key(press('Tab'));
    expect(p.field).toBe('quantity');
    f.screen.key(press('→'));
    expect(p.quantity).toBe(11);
    f.screen.key(press('←'));
    f.screen.key(press('Tab'));
    expect(p.field).toBe('mode');
    f.screen.key(press('→'));
    expect(p.mode).toBe('maintain');
    expect(panelText(f)).toContain('keep ≥ 10 in stock');
    f.screen.key(press('Tab'));
    expect(p.field).toBe('material');
    const options = f.screen.orders.materialOptions(f.screen.ctx, f.screen.orders.pickerRecipe(f.screen.ctx)).map((o) => o.id);
    expect(options[0]).toBe('');
    expect(options).toContain('oak');
    while (p.material !== 'oak') f.screen.key(press('→'));
    expect(panelText(f)).toContain('oak');
    // A workshop's own order has no workshop to choose: Tab wraps to the recipe; Shift+Tab goes back.
    f.screen.key(press('Tab'));
    expect(p.field).toBe('recipe');
    f.screen.key(press('Tab', { shift: true }));
    expect(p.field).toBe('material');
    f.screen.key(press('Enter'));
    expect(f.sent.at(-1)).toEqual({ type: 'AddWorkOrder', workshopId: shop, order: { recipeId: 'make_barrel', mode: 'maintain', remaining: 1, threshold: 10, priority: 5, materialFilter: 'oak' } });
    f.w.step(1);
    expect(f.orders().ordersOf(shop)[0]).toMatchObject({ mode: 'maintain', threshold: 10, materialFilter: f.w.game.registry.table('materials').index('oak') });
  });

  it('a global order chooses its workshop: any of the type, or one of them', () => {
    const f = setup('u03-where');
    const first = f.w.build('carpenter', f.w.index(15, 15, z));
    const second = f.w.build('carpenter', f.w.index(25, 15, z));
    f.w.step(1);
    f.screen.openPanel('orders');
    f.screen.key(press('N', { shift: true }));
    const p = f.screen.orders.picker;
    expect(p.fixed).toBe(false);
    type(f.screen, 'door');
    // Every workshop type's recipes are offered: three doors (wood, stone, metal).
    expect(f.screen.orders.pickerRecipes(f.screen.ctx).map((r) => r.id).sort()).toEqual(['forge_door', 'make_door_stone', 'make_door_wood']);
    f.screen.orders.picker.list.selected = f.screen.orders.pickerRecipes(f.screen.ctx).findIndex((r) => r.id === 'make_door_wood');
    expect(f.screen.orders.whereOptions(f.screen.ctx)).toEqual([0, first, second]);
    // (The 33-cell row cuts the name; hovering shows it whole, U-08.)
    expect(panelText(f)).toContain("Where    any carpenter's work");
    for (let k = 0; k < 4; k += 1) f.screen.key(press('Tab'));
    expect(p.field).toBe('where');
    f.screen.key(press('→'));
    f.screen.key(press('→'));
    expect(p.workshopId).toBe(second);
    expect(panelText(f)).toContain("Carpenter's workshop #2");
    // Another recipe's workshop type cannot take it: back to "any".
    f.screen.orders.picker.list.selected = f.screen.orders.pickerRecipes(f.screen.ctx).findIndex((r) => r.id === 'forge_door');
    f.screen.orders.move(0, f.screen.ctx);
    expect(p.workshopId).toBe(0);
    f.screen.orders.picker.list.selected = f.screen.orders.pickerRecipes(f.screen.ctx).findIndex((r) => r.id === 'make_door_wood');
    f.screen.key(press('→'));
    expect(p.workshopId).toBe(first);
    f.screen.key(press('←'));
    f.screen.key(press('3'));
    f.screen.key(press('Enter'));
    expect(f.sent.at(-1)).toMatchObject({ type: 'AddWorkOrder', workshopId: 0, order: { recipeId: 'make_door_wood', remaining: 3 } });
    f.w.step(1);
    expect(f.orders().globalOrders()).toHaveLength(1);
  });

  it('+/- in the list change the count, Shift by 10, and never reach the game speed', () => {
    const f = setup('u03-count');
    const shop = carpenter(f);
    f.w.submit({ type: 'AddWorkOrder', workshopId: shop, order: { recipeId: 'make_door_wood', mode: 'once', remaining: 5, threshold: 0, priority: 5 } });
    f.w.step(1);
    f.screen.openPanel('orders');
    const remaining = (): number => f.orders().ordersOf(shop)[0]?.remaining ?? 0;
    const keyThenStep = (key: string, shift = false): void => {
      expect(f.screen.key(press(key, { shift }))).toBe(true);
      f.w.step(1);
    };
    keyThenStep('+');
    expect(remaining()).toBe(6);
    keyThenStep('=');
    expect(remaining()).toBe(7);
    keyThenStep('-');
    keyThenStep('-');
    expect(remaining()).toBe(5);
    keyThenStep('+', true);
    expect(remaining()).toBe(15);
    keyThenStep('_', true);
    expect(remaining()).toBe(5);
    // At the bound the count stays and the status row says why.
    for (let k = 0; k < 6; k += 1) keyThenStep('-');
    expect(remaining()).toBe(1);
    expect(f.screen.statusRow2()).toBe('An order is for 1 to 999.');
    expect(f.orders().ordersOf(shop)).toHaveLength(1);
    // Q2: neither key was the speed key, and `+` did not open "new global order".
    expect(f.speeds).toEqual([]);
    expect(f.screen.orders.picker.open).toBe(false);
    // The count is clickable too: `[-] n [+]` on the selected order's lines.
    const s = surface(RECT.cols, RECT.rows);
    drawOrdersPanel(s, RECT, f.screen.orders, f.screen.ctx);
    const row = s.lines().findIndex((line) => line.includes('Count [-] 1 [+]'));
    expect(row).toBeGreaterThan(0);
    s.hitAt((s.lines()[row] as string).indexOf('[+]') + 1, row)?.action();
    f.w.step(1);
    expect(remaining()).toBe(2);
  });

  it('+/- change the threshold of a keep ≥ N order, and [S-m] [S-p] edit mode and priority', () => {
    const f = setup('u03-keep');
    const shop = carpenter(f);
    f.w.submit({ type: 'AddWorkOrder', workshopId: shop, order: { recipeId: 'make_barrel', mode: 'once', remaining: 2, threshold: 0, priority: 5 } });
    f.w.step(1);
    f.screen.openPanel('orders');
    const order = (): { mode: string; threshold: number; remaining: number; priority: number } => f.orders().ordersOf(shop)[0] as never;
    expect(f.screen.key(press('M', { shift: true }))).toBe(true);
    f.w.step(1);
    expect(order()).toMatchObject({ mode: 'maintain', threshold: 20 });
    expect(panelText(f)).toContain('Keep ≥ [-] 20 [+]');
    f.screen.key(press('+'));
    f.w.step(1);
    expect(order()).toMatchObject({ threshold: 21, remaining: 2 });
    f.screen.key(press('_', { shift: true }));
    f.w.step(1);
    expect(order().threshold).toBe(11);
    expect(f.screen.key(press('P', { shift: true }))).toBe(true);
    f.w.step(1);
    expect(order().priority).toBe(6);
    expect(f.speeds).toEqual([]);
  });

  it('with no order selected, + and - are the speed keys again and [S-n] is the way to add', () => {
    const f = setup('u03-empty');
    f.screen.openPanel('orders');
    expect(panelText(f)).toContain('No work orders. [S-n] adds one,');
    f.screen.key(press('+'));
    expect(f.speeds).toEqual([2]);
    expect(f.screen.orders.picker.open).toBe(false);
    f.screen.key(press('-'));
    expect(f.speeds).toEqual([2, 1]);
    // The keys that need an order say there is none.
    f.screen.key(press('x'));
    expect(f.screen.statusRow2()).toBe('No order is selected: [S-n] adds one.');
    f.screen.key(press('r'));
    expect(f.screen.statusRow2()).toBe('There is no order to repeat yet.');
    expect(f.sent).toEqual([]);
    // Bare `n` is the Animals panel (D-U2); `[S-n]` opens the picker, here for a global order.
    f.screen.key(press('n'));
    expect(f.screen.ui.panel).toBe('animals');
    f.screen.key(press('o'));
    f.screen.key(press('N', { shift: true }));
    expect(f.screen.orders.picker.open).toBe(true);
    expect(f.screen.orders.picker.fixed).toBe(false);
    // In the picker `+`/`-` are the quantity, not the speed.
    f.screen.key(press('+'));
    expect(f.speeds).toEqual([2, 1]);
    expect(f.screen.orders.picker.quantity).toBe(2);
  });

  it('each order shows its status: waiting for an input, no workshop, in progress, stocked, done', () => {
    const f = setup('u03-status');
    const shop = carpenter(f);
    const status = (index: number): string => {
      const row = f.screen.orders.rows(f.screen.ctx)[index];
      return row === undefined ? '' : f.screen.orders.status(f.screen.ctx, row).short;
    };
    f.w.submit({ type: 'AddWorkOrder', workshopId: shop, order: { recipeId: 'make_door_wood', mode: 'once', remaining: 2, threshold: 0, priority: 5 } });
    f.w.submit({ type: 'AddWorkOrder', workshopId: 0, order: { recipeId: 'make_stone_block', mode: 'once', remaining: 1, threshold: 0, priority: 5 } });
    f.w.step(1);
    f.screen.openPanel('orders');
    expect(status(0)).toBe('waiting for log (0)');
    expect(status(1)).toBe("no mason's workshop");
    const text = panelText(f);
    expect(text).toContain('x2 Door · waiting for log (0)');
    expect(text).toContain("x1 Blocks · no mason's workshop");
    // The selected order's lines say it in full, with where to get the input (U-01's block text).
    expect(text).toContain('Waiting for log (0 available)');
    f.screen.orders.list.selected = 1;
    expect(panelText(f)).toContain("No mason's workshop is built: [b]");
    // With logs and a carpenter the order runs: queued, then in progress, then done.
    f.w.spawnItem('log', 'oak', f.w.index(18, 18, z), 2);
    f.w.spawnDwarf({ at: f.w.index(17, 19, z), skills: { carpentry: 6 } });
    f.w.step(1);
    expect(['queued', 'in progress']).toContain(status(0));
    f.w.until(() => (f.w.readers.entities.get(shop, C.Workshop)?.currentJobId ?? 0) !== 0, 200);
    expect(status(0)).toBe('in progress');
    f.screen.orders.list.selected = 0;
    expect(panelText(f)).toContain('In progress: a dwarf is at work');
    f.w.until(() => f.w.events('WorkOrderCompleted').length > 0, 3000);
    f.screen.onEvents(f.w.events('WorkOrderCompleted'));
    const rows = f.screen.orders.rows(f.screen.ctx);
    expect(rows.map((row) => row.kind)).toEqual(['live', 'done']);
    expect(status(1)).toBe('done');
    expect(panelText(f)).toMatch(/─ Finished ─/);
    // A keep ≥ N order whose stock is at the threshold is "stocked".
    f.w.submit({ type: 'AddWorkOrder', workshopId: shop, order: { recipeId: 'make_door_wood', mode: 'maintain', remaining: 1, threshold: 1, priority: 5 } });
    f.w.step(1);
    expect(status(0)).toMatch(/^stocked \(\d+\)$/);
    // The workshop panel shows the same rows.
    const s = surface(RECT.cols, RECT.rows);
    drawWorkshopPanel(s, RECT, shop, f.screen.orders, f.screen.ctx);
    expect(s.lines().join('\n')).toMatch(/≥1 Door · stocked \(\d+\)/);
  });

  it('[r] repeats the selected order, and a finished one with the count it was ordered with', () => {
    const f = setup('u03-repeat');
    const shop = carpenter(f);
    f.w.spawnItem('log', 'oak', f.w.index(18, 18, z), 4);
    f.w.spawnDwarf({ at: f.w.index(17, 19, z), skills: { carpentry: 6 } });
    f.screen.key(press('N', { shift: true }));
    type(f.screen, 'door');
    f.screen.key(press('2'));
    f.screen.key(press('Enter'));
    f.w.step(1);
    // Repeat the live order: a second order with the same recipe and count.
    expect(f.screen.key(press('r'))).toBe(true);
    f.w.step(1);
    expect(f.orders().ordersOf(shop).map((o) => o.remaining)).toEqual([2, 2]);
    expect(f.sent.at(-1)).toMatchObject({ type: 'AddWorkOrder', workshopId: shop, order: { recipeId: 'make_door_wood', remaining: 2 } });
    // Let both finish; each `WorkOrderCompleted` leaves a done row.
    f.w.until(() => f.w.events('WorkOrderCompleted').length >= 2, 6000);
    f.screen.onEvents(f.w.allEvents());
    expect(f.orders().ordersOf(shop)).toHaveLength(0);
    const rows = f.screen.orders.rows(f.screen.ctx);
    expect(rows.every((row) => row.kind === 'done')).toBe(true);
    expect(panelText(f)).toContain('x2 Door · done');
    expect(panelText(f)).toContain('Done. [r] orders it again.');
    // `+` on a done row explains; `r` orders it again with its count of 2; `x` just clears a done row.
    f.screen.key(press('+'));
    expect(f.screen.statusRow2()).toBe('That order is finished: [r] orders it again.');
    const before = f.sent.length;
    f.screen.key(press('r'));
    expect(f.sent).toHaveLength(before + 1);
    expect(f.sent.at(-1)).toEqual({ type: 'AddWorkOrder', workshopId: shop, order: { recipeId: 'make_door_wood', mode: 'once', remaining: 2, threshold: 0, priority: 5, materialFilter: null } });
    expect(f.screen.statusRow2()).toBe("Ordered: ×2 Door · Carpenter's workshop #1");
    f.w.step(1);
    expect(f.screen.orders.rows(f.screen.ctx).map((row) => row.kind)).toEqual(['live', 'done']);
    f.screen.orders.list.selected = 1;
    f.screen.key(press('x'));
    expect(f.asked).toEqual([]);
    expect(f.screen.orders.rows(f.screen.ctx).map((row) => row.kind)).toEqual(['live']);
  });

  it('[x] on an order asks first (default No) and Shift+arrows reorder with a message at the ends', () => {
    const f = setup('u03-remove');
    const shop = carpenter(f);
    f.w.submit({ type: 'AddWorkOrder', workshopId: shop, order: { recipeId: 'make_door_wood', mode: 'once', remaining: 5, threshold: 0, priority: 5 } });
    f.w.submit({ type: 'AddWorkOrder', workshopId: shop, order: { recipeId: 'make_bed', mode: 'once', remaining: 1, threshold: 0, priority: 5 } });
    f.w.step(1);
    f.screen.openPanel('orders');
    f.answer = false;
    expect(f.screen.key(press('x'))).toBe(true);
    expect(f.asked).toEqual([{ id: 'c_remove_order', params: { recipe: 'Door' } }]);
    expect(f.sent).toEqual([]);
    f.screen.key(press('↑', { shift: true }));
    expect(f.screen.statusRow2()).toBe('That order is already first in its queue.');
    f.screen.key(press('↓', { shift: true }));
    expect(f.sent.at(-1)).toEqual({ type: 'ReorderWorkOrder', workshopId: shop, from: 0, to: 1 });
    f.w.step(1);
    expect(f.screen.orders.list.selected).toBe(1);
    f.screen.key(press('↓', { shift: true }));
    expect(f.screen.statusRow2()).toBe('That order is already last in its queue.');
    f.answer = true;
    f.screen.key(press('x'));
    f.w.step(1);
    expect(f.orders().ordersOf(shop).map((o) => o.remaining)).toEqual([1]);
  });

  it('the workshop panel names its actions with their keys, and each is clickable', () => {
    const f = setup('u03-workshop');
    const shop = carpenter(f);
    const s = surface(RECT.cols, RECT.rows);
    const clicked: string[] = [];
    drawWorkshopPanel(s, RECT, shop, f.screen.orders, f.screen.ctx, (action, recipeId) => clicked.push(recipeId === undefined ? action : `${action}:${recipeId}`));
    const lines = s.lines();
    const text = lines.join('\n');
    expect(text).toContain("Carpenter's workshop #1");
    expect(text).toContain('[S-n] new order  [S-o] its orders');
    expect(text).toContain('[S-f] material  [w] worker');
    expect(text).toContain('[S-s] suspend  [x] take apart');
    const click = (caption: string): void => {
      const row = lines.findIndex((line) => line.includes(caption));
      s.hitAt((lines[row] as string).indexOf(caption) + 1, row)?.action();
    };
    for (const caption of ['[S-n]', '[S-o]', '[S-f]', '[w]', '[S-s]', '[x]', 'Door']) click(caption);
    expect(clicked).toEqual(['new', 'orders', 'material', 'worker', 'suspend', 'deconstruct', 'new:make_door_wood']);
    // A click on a recipe opens the picker on that recipe.
    f.screen.orders.workshopAction(f.screen.ctx, shop, 'new', () => {}, 'make_door_wood');
    expect(f.screen.orders.pickerRecipe(f.screen.ctx)?.id).toBe('make_door_wood');
    f.screen.key(press('Esc'));
    // [S-f] with no orders says so; the bare `+` is the speed key now, not "new order".
    f.screen.openPanel('workshop');
    f.screen.key(press('F', { shift: true }));
    expect(f.screen.statusRow2()).toBe('This workshop has no orders: [S-n] adds one.');
    f.screen.key(press('+'));
    expect(f.screen.orders.picker.open).toBe(false);
    expect(f.speeds).toEqual([2]);
  });

  it('the picker opens preset to an item and a count (the build tool\'s "[o] order N", D-U6)', () => {
    const f = setup('u03-preset');
    f.w.build('carpenter', f.w.index(15, 15, z));
    f.w.step(1);
    f.screen.orders.openPicker(f.screen.ctx, { itemId: 'bed', quantity: 4 });
    expect(f.screen.orders.pickerRecipe(f.screen.ctx)?.id).toBe('make_bed');
    expect(f.screen.orders.picker.quantity).toBe(4);
    expect(f.screen.orders.picker.workshopId).toBe(0);
  });

  it('Help lists the order keys and the Shift rule', () => {
    const rows = helpKeyRows(keymap, strings).map((row) => row.text);
    expect(rows).toContain('Work orders');
    expect(rows).toContain('Shift+N  new order (the picker)');
    expect(rows).toContain('+ = -  count ±1 (Shift: ±10)');
    expect(rows).toContain('r  repeat the selected or last finished order');
    expect(rows).toContain('Shift+letter  a panel action on a panel letter: [S-m]');
  });

  it('T-174: reopening a material picker selects the normalized material instead of Any', () => {
    const f = setup('t174-picker');
    expect(f.w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: 0,
      order: { recipeId: 'forge_pick', mode: 'once', remaining: 1, materialFilter: 'iron' } })).toEqual({ ok: true });
    f.screen.openPanel('orders');
    f.screen.orders.openMaterials(f.screen.ctx);
    expect(f.screen.orders.materialOpen).toBe(true);
    const options = f.screen.orders.materialOptions(f.screen.ctx);
    expect(options[f.screen.orders.materials.selected]?.id).toBe('iron');
  });
});
