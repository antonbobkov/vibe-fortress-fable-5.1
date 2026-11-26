/**
 * T-790: Add order's "no bar" note said "○ Anvil · no bar: made at a smelter" with 13 bars in stock,
 * of which 3 were iron or steel; once ordered, "Waiting for bar (12 in stock)". And "○ Glowstone lamp
 * · no rough gem (from mining)" with four bought glowstones at the depot (playtest 7, finding 8). The
 * note now names the input as the recipe takes it, the shortfall, and units that exist but cannot be
 * used (`panels.md` § Add order).
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import { ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { JobsSystem } from '@systems/jobs';
import type { PanelContext } from '@ui/panels/context';
import { OrdersPanel } from '@ui/panels/orders';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const Z = 25;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 60 * TICKS_PER_DAY });
  w.digRoom(10, 10, Z, 20, 12);
  for (let y = 9; y <= 22; y += 1) for (let x = 9; x <= 30; x += 1) w.discover(w.index(x, y, Z));
  const notices: string[] = [];
  const ctx: PanelContext = {
    readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false, notice: (text: string) => { notices.push(text); },
  };
  const orders = new OrdersPanel();
  orders.openPicker(ctx);
  const recipes = w.game.registry.table<{ id: string }>('recipes');
  const note = (id: string): string => orders.pickerNote(ctx, orders.pickerRecipes(ctx).find((r) => r.id === id) ?? (recipes.byId(id) as never));
  return { w, ctx, orders, note, notices };
}

describe('T-790 Add order\'s note says what is short', () => {
  it('the anvil: no iron or steel bar, then 5 needed with 3 in stock; the order row and the status say the same', () => {
    const { w, ctx, orders, note } = setup('t790-anvil');
    const forge = w.build('forge', w.index(11, 11, Z), 'granite');
    w.spawnItem('bar', 'copper', w.index(20, 15, Z), 5);
    w.spawnItem('bar', 'copper', w.index(21, 15, Z), 5);
    w.step(1);
    expect(note('forge_anvil')).toBe('· no iron or steel bar: made at a smelter');
    w.spawnItem('bar', 'iron', w.index(22, 15, Z), 1);
    w.spawnItem('bar', 'steel', w.index(23, 15, Z), 2);
    expect(note('forge_anvil')).toBe('· needs 5 iron or steel bars, 3 in stock: made at a smelter');
    // The Orders list says the same words for an order of it.
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: forge, order: { recipeId: 'forge_anvil', mode: 'once', count: 1 } }).ok).toBe(true);
    const rows = orders.rows(ctx).map((row) => orders.rowText(ctx, row));
    expect(rows).toEqual(['×1 Anvil · needs 5 iron or steel bars, 3 in stock']);
  });

  it('the lamp: glowstone at the depot, then reserved by the jeweler, says so and names no maker', () => {
    const { w, note } = setup('t790-lamp');
    const jeweler = w.build('jeweler', w.index(11, 11, Z), 'granite');
    w.spawnItem('stone_block', 'granite', w.index(24, 15, Z), 1);
    w.step(1);
    expect(note('make_glowstone_lamp')).toBe('· no glowstone rough gem (from mining)');
    const gems = w.spawnItem('rough_gem', 'glowstone', w.index(20, 15, Z), 4);
    expect(note('make_glowstone_lamp')).toBe('');
    w.items.setFlag(gems, ItemFlag.AtDepot, true);
    expect(note('make_glowstone_lamp')).toBe('· 4 glowstone rough gems at the depot');
    w.items.setFlag(gems, ItemFlag.AtDepot, false);
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const job = board.create('t790:cut', { type: 'craft', target: { kind: 'building', ref: jeweler }, workTile: 'adjacent', inputs: [], labor: 'gem_cutting' });
    w.items.reserve(gems, job);
    expect(note('make_glowstone_lamp')).toBe("· 4 glowstone rough gems reserved (Jeweler's workshop #1)");
  });

  it('an input with no material and none in stock keeps its words: "no log (from felling trees)"', () => {
    const { w, note } = setup('t790-log');
    w.build('carpenter', w.index(11, 11, Z), 'granite');
    w.step(1);
    expect(note('make_bed')).toMatch(/^· no log/);
  });
});
