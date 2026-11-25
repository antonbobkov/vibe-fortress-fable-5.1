/**
 * T-626: the Thane's whim says how many and how far (`10` § The Thane's whim, `24` § Panels), the
 * build tool names every alternative of an input (`fortress-screen.md` § Build tool), a dark candle
 * stand says where candles come from (`14` § Candle stands and lanterns), and Add order says why a
 * `○` recipe cannot run and when its workshop is placed but not built (`panels.md` § Add order).
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingRow } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';
import { AnnouncementLog } from '@ui/announcements';
import { filterText } from '@ui/messages';
import { BuildingPanel } from '@ui/panels/building';
import { BuildTool, drawBuildPanel, inputText } from '@ui/panels/build';
import type { PanelContext } from '@ui/panels/context';
import { OrdersPanel } from '@ui/panels/orders';
import { drawUnitsPanel, UnitsPanel, whimLine } from '@ui/panels/units';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const Z = 25;
const SEASON = TICKS_PER_DAY * DAYS_PER_SEASON;

function world(seed: string, startTick?: number): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', ...(startTick === undefined ? {} : { startTick }) });
}

/** A dug, discovered room on the flat test map underground, and its tiles. */
function room(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  w.digRoom(x, y, Z, width, height);
  for (let yy = y - 1; yy <= y + height; yy += 1) for (let xx = x - 1; xx <= x + width; xx += 1) w.discover(w.index(xx, yy, Z));
  const out: TileIndex[] = [];
  for (let yy = y; yy < y + height; yy += 1) for (let xx = x; xx < x + width; xx += 1) out.push(w.index(xx, yy, Z));
  return out;
}

function ctxOf(w: TestWorld): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
}

function thane(w: TestWorld, at: TileIndex): EntityId {
  const id = w.spawnDwarf({ at });
  expect(w.game.world.applyCommand({ type: 'AssignTitle', dwarfId: id, title: 'thane' })).toEqual({ ok: true });
  return id;
}

describe('T-626 the Thane\'s whim says how many, by when and how far', () => {
  it('a stock whim counts its item in stock against its count, and says where it is made', () => {
    const w = world('t626-meals', SEASON + 5);
    room(w, 10, 10, 8, 5);
    thane(w, w.index(12, 12, Z));
    w.dwarves.whim = { id: 'whim_fine_meal', setTick: SEASON };
    w.spawnItem('fine_meal', 'turnip', w.index(14, 12, Z), 3);
    const view = w.readers.of<DwarvesReader>('10').whim();
    expect(view).toEqual({ id: 'whim_fine_meal', text: 'fine meals for everyone', met: false, kind: 'stock', count: 20, have: 3 });
    const ctx = ctxOf(w);
    expect(whimLine(ctx, view!)).toBe('The Thane wishes for fine meals for everyone by the end of summer: 3 of 20 fine meals in stock, not yet. Made at a kitchen.');
    // The units panel wraps the line under the filter, whole: the count, the progress and "not yet" are all on screen.
    const s = surface(36, 30);
    drawUnitsPanel(s, { col: 0, row: 0, cols: 36, rows: 30 }, new UnitsPanel(), ctx);
    // T-678: under the tab row and the filter.
    const shown = s.lines().slice(2, 6).map((l) => l.trim()).join(' ');
    expect(shown).toContain('3 of 20 fine meals in stock, not yet. Made at a kitchen.');
    expect(shown).not.toContain('»');
    // Met: the line says so and no longer says where to make them.
    w.spawnItem('fine_meal', 'turnip', w.index(15, 12, Z), 17);
    const met = w.readers.of<DwarvesReader>('10').whim()!;
    expect(met).toMatchObject({ met: true, have: 20 });
    expect(whimLine(ctx, met)).toBe('The Thane wishes for fine meals for everyone by the end of summer: 20 of 20 fine meals in stock, met.');
  });

  it('a whim of a material names the material; a room whim counts what is in place', () => {
    const w = world('t626-mead', 5);
    room(w, 10, 10, 8, 5);
    thane(w, w.index(12, 12, Z));
    w.dwarves.whim = { id: 'whim_mead', setTick: 0 };
    expect(whimLine(ctxOf(w), w.readers.of<DwarvesReader>('10').whim()!)).toBe('The Thane wishes for a barrel of mead by the end of spring: 0 of 20 mead in stock, not yet. Made at a still.');
    w.dwarves.whim = { id: 'whim_lantern', setTick: 0 };
    expect(w.readers.of<DwarvesReader>('10').whim()).toMatchObject({ kind: 'room', count: 1, have: 0 });
    expect(whimLine(ctxOf(w), w.readers.of<DwarvesReader>('10').whim()!)).toBe('The Thane wishes for a lantern in the dining hall by the end of spring: 0 of 1 in place, not yet. Made at a kiln.');
  });

  it('the wish\'s note gives the count and how far the fortress is', () => {
    const w = world('t626-note', 5);
    room(w, 10, 10, 8, 5);
    const id = thane(w, w.index(12, 12, Z));
    w.dwarves.whim = { id: 'whim_fine_meal', setTick: 0 };
    w.spawnItem('fine_meal', 'turnip', w.index(14, 12, Z), 3);
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const line = log.announce({ type: 'WhimSet', thaneId: id, whimId: 'whim_fine_meal' }, w.readers, 1)?.line;
    expect(line?.text).toMatch(/, Thane, wishes for fine meals for everyone by the end of the season: 3 of 20 fine meals in stock\.$/);
  });
});

describe('T-626 the build tool and a waiting building name every alternative', () => {
  it('the straw pallet counts fiber, straw and reed, and names them', () => {
    const w = world('t626-pallet');
    const ctx = ctxOf(w);
    const row = w.game.registry.table<BuildingRow>('buildings').byId('straw_pallet') as BuildingRow;
    expect(inputText(row, w.game.registry)).toBe('3 fiber, straw or reed');
    // A single input keeps its plural; the candle stand's block or bar is named whole.
    expect(inputText(w.game.registry.table<BuildingRow>('buildings').byId('candle_stand') as BuildingRow, w.game.registry)).toBe('1 block or bar');
    expect(inputText(w.game.registry.table<BuildingRow>('buildings').byId('carpenter') as BuildingRow, w.game.registry)).toBe('2 logs');
    w.spawnItem('straw', 'barley', w.index(30, 30, 32), 5);
    w.spawnItem('reed', 'reed_bed', w.index(31, 30, 32), 4);
    expect(new BuildTool().available(ctx, row)).toBe(9);
    // In the Furniture list the row counts every alternative.
    const tool = new BuildTool();
    tool.category = 'furniture';
    const s = surface(36, 60);
    drawBuildPanel(s, { col: 0, row: 0, cols: 36, rows: 60 }, tool, ctx);
    // Too long for one row, the inputs wrap under the name, whole, with the count (T-703).
    const at = s.lines().findIndex((line) => line.trimStart().startsWith('Straw pallet'));
    expect(`${s.lines()[at]?.trim()} ${s.lines()[at + 1]?.trim()}`).toBe('Straw pallet 3 fiber, straw or reed (9)');
    const offer = { match: 'fiber|straw|reed', have: 0, waiting: 1, itemId: 'fiber', recipeId: null, workshops: 'a farmer\'s workshop' };
    expect(new BuildTool().offerText(ctx, offer, 'o')).toEqual({ stock: '0 fiber, straw or reed in stock: 1 will wait', action: 'build a farmer\'s workshop to make fiber' });
    // A single input reads as before.
    expect(new BuildTool().offerText(ctx, { ...offer, match: 'door', itemId: 'door', workshops: 'a carpenter\'s workshop' }, 'o'))
      .toEqual({ stock: '0 doors in stock: 1 will wait', action: 'build a carpenter\'s workshop to make them' });
  });

  it('a building waiting for an input with alternatives names every one of them', () => {
    const w = world('t626-waiting');
    const items = w.game.registry.table('items');
    const types = ['fiber', 'straw', 'reed'].map((id) => items.index(id));
    expect(filterText(w.game.registry, { types }, 3)).toBe('3 fiber, straw or reed');
    expect(filterText(w.game.registry, { types: [items.index('door')] }, 2)).toBe('2 doors');
  });
});

describe('T-626 the candle stand and Add order say how to supply them', () => {
  it('a dark candle stand says where candles are made', () => {
    const w = world('t626-stand');
    room(w, 10, 10, 8, 5);
    const stand = w.build('candle_stand', w.index(12, 12, Z), 'granite');
    const panel = new BuildingPanel();
    panel.id = stand;
    const dark = panel.lines(ctxOf(w)).find((line) => line.id === 'stand:burning');
    expect(dark?.text).toBe('No candle: dark. Order tallow or wax candles at a craftsdwarf\'s workshop.');
  });

  it('a recipe whose workshop is placed reads "not built yet"; a ○ recipe names its missing input', () => {
    const w = world('t626-orders');
    room(w, 10, 10, 12, 8);
    const ctx = ctxOf(w);
    const orders = new OrdersPanel();
    orders.openPicker(ctx);
    const recipes = w.game.registry.table<{ id: string }>('recipes');
    const recipe = (id: string) => orders.pickerRecipes(ctx).find((r) => r.id === id) ?? (recipes.byId(id) as never);
    expect(orders.pickerNote(ctx, recipe('cook_easy_meal'))).toBe('· no kitchen');
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'kitchen', origin: w.index(11, 11, Z), orientation: 0, materialChoice: 0 })).toMatchObject({ ok: true });
    expect(orders.pickerNote(ctx, recipe('cook_easy_meal'))).toBe('· kitchen not built yet');
    w.build('craftdwarf', w.index(16, 11, Z), 'granite');
    w.step(1);
    expect(orders.pickerNote(ctx, recipe('make_candles_tallow'))).toBe('· no tallow: render fat at a kitchen (needs fat from butchering)');
    w.spawnItem('tallow', 'tallow', w.index(19, 15, Z), 1);
    expect(orders.pickerNote(ctx, recipe('make_candles_tallow'))).toBe('');
  });
});
