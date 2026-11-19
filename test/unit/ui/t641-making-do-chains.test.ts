/**
 * T-641: Add order's `○` rows say where a missing input comes from, one step back, and how long a
 * placed workshop's build has waited and why (`ui-screens/panels.md` § Add order; the audit
 * `reports/audits/2026-11-19-t635-midgame-ux.md`, finding 21). The rows wrap at the sidebar's width.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import { TICKS_PER_DAY } from '@core/constants';
import type { TileIndex } from '@core/types';
import type { JobsSystem } from '@systems/jobs';
import type { PanelContext } from '@ui/panels/context';
import { drawOrdersPanel, OrdersPanel } from '@ui/panels/orders';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const Z = 25;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 60 * TICKS_PER_DAY });
  w.digRoom(10, 10, Z, 20, 12);
  for (let y = 9; y <= 22; y += 1) for (let x = 9; x <= 30; x += 1) w.discover(w.index(x, y, Z));
  const ctx: PanelContext = {
    readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
  const orders = new OrdersPanel();
  orders.openPicker(ctx);
  const recipes = w.game.registry.table<{ id: string }>('recipes');
  const note = (id: string): string => orders.pickerNote(ctx, orders.pickerRecipes(ctx).find((r) => r.id === id) ?? (recipes.byId(id) as never));
  const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
  return { w, ctx, orders, note, board };
}

/** The picker drawn in a 36-cell sidebar with a filter typed; its rows as text. */
function picker(orders: OrdersPanel, ctx: PanelContext, filter: string): string[] {
  orders.picker.filter = filter;
  const s = surface(36, 30);
  drawOrdersPanel(s, { col: 0, row: 0, cols: 36, rows: 30 }, orders, ctx);
  return s.lines().map((line) => line.slice(1).trimEnd());
}

describe('T-641 a ○ recipe names its missing input one step back', () => {
  it('soap with no tallow: render fat at a kitchen, and fat comes from butchering', () => {
    const { w, note } = setup('t641-soap');
    w.build('kitchen', w.index(11, 11, Z), 'granite');
    w.step(1);
    expect(note('make_soap')).toBe('· no tallow: render fat at a kitchen (needs fat from butchering)');
    // With fat in stock the step back is only the rendering.
    w.spawnItem('fat', 'tallow', w.index(20, 15, Z), 1);
    expect(note('make_soap')).toBe('· no tallow: render fat at a kitchen');
    expect(note('make_candles_tallow')).toBe('· no craftsdwarf\'s workshop');
  });

  it('wax candles with no beeswax: press honeycomb at a farmer\'s workshop, from a hive', () => {
    const { w, note } = setup('t641-wax');
    w.build('craftdwarf', w.index(11, 11, Z), 'granite');
    w.step(1);
    expect(note('make_candles_wax')).toBe('· no beeswax: press honeycomb at a farmer\'s workshop (needs honeycomb from a hive)');
    expect(note('make_candles_tallow')).toBe('· no tallow: render fat at a kitchen (needs fat from butchering)');
  });

  it('press honeycomb: no farmer\'s workshop, then no honeycomb, which a hive gives', () => {
    const { w, note } = setup('t641-honey');
    expect(note('press_honeycomb')).toBe('· no farmer\'s workshop');
    w.build('farmers_workshop', w.index(11, 11, Z), 'granite');
    w.step(1);
    expect(note('press_honeycomb')).toBe('· no honeycomb (from a hive)');
  });

  it('an input two recipes make names where they are made, not one recipe', () => {
    const { w, note } = setup('t641-thread');
    w.build('loom', w.index(11, 11, Z), 'granite');
    w.step(1);
    expect(note('weave_cloth')).toBe('· no thread: made at a loom');
  });

  it('a long note wraps at the sidebar\'s width rather than cutting', () => {
    const { w, ctx, orders } = setup('t641-wrap');
    let rows = picker(orders, ctx, 'presshoneycomb');
    expect(rows.join('\n')).not.toContain('»');
    expect(rows.find((row) => row.includes('Press honeycomb'))).toBeDefined();
    expect(rows.join(' ').replace(/ +/g, ' ')).toContain('Press honeycomb · no farmer\'s workshop');
    w.build('kitchen', w.index(11, 11, Z), 'granite');
    w.step(1);
    rows = picker(orders, ctx, 'soap');
    const at = rows.findIndex((row) => row.includes('Soap'));
    expect(rows.slice(at, at + 3).every((row) => row.length <= 34)).toBe(true);
    expect(rows.slice(at, at + 3).join(' ').replace(/ +/g, ' ')).toContain('○ Soap · no tallow: render fat at a kitchen (needs fat from butchering)');
    expect(rows.join('\n')).not.toContain('»');
  });
});

describe('T-641 a placed workshop says how long its build has waited, and why', () => {
  function placedKiln(seed: string) {
    const a = setup(seed);
    const { w } = a;
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'kiln', origin: w.index(11, 11, Z), orientation: 0, materialChoice: 0 })).toMatchObject({ ok: true });
    w.step(1);
    const job = Array.from(a.board.jobs.values()).find((j) => j.type === w.game.registry.table('jobTypes').index('build'));
    expect(job).toBeDefined();
    return { ...a, job: job! };
  }

  it('under a day it is only "not built yet"', () => {
    const { note } = placedKiln('t641-kiln-new');
    expect(note('make_mugs_glass')).toBe('· kiln not built yet');
  });

  it('41 days open with no mason: the wait and that nobody has the labor', () => {
    const { w, note, job } = placedKiln('t641-kiln-nobody');
    job.state = 'open';
    job.blockedReason = null;
    job.createdTick = w.readers.calendar.tick - 41 * TICKS_PER_DAY - 5;
    expect(note('make_mugs_glass')).toBe('· kiln not built: waiting 41 days, no dwarf has the masonry labor');
  });

  it('41 days open while the only mason is busy: waiting for a builder', () => {
    const { w, note, job, board } = placedKiln('t641-kiln-busy');
    const mason = w.spawnDwarf({ at: w.index(20, 15, Z), name: 'Orm Ashbrow' });
    w.setLabor(mason, 'masonry', true);
    const other = board.create('t641-other', { type: 'plant', target: { kind: 'tile', ref: w.index(21, 15, Z) as TileIndex }, workTile: 'at', data: { labor: 'masonry' } });
    board.jobs.get(other)!.state = 'working';
    board.jobs.get(other)!.workerId = mason;
    board.setWorker(mason, { jobId: other });
    job.state = 'open';
    job.blockedReason = null;
    job.workerId = 0;
    job.createdTick = w.readers.calendar.tick - 41 * TICKS_PER_DAY - 5;
    expect(note('make_mugs_glass')).toBe('· kiln not built: waiting 41 days for a builder');
  });

  it('a blocked build gives its block\'s reason', () => {
    const { w, note, job } = placedKiln('t641-kiln-blocked');
    job.state = 'blocked';
    job.blockedReason = 'unreachable';
    job.createdTick = w.readers.calendar.tick - 2 * TICKS_PER_DAY;
    expect(note('make_mugs_glass')).toBe('· kiln not built: waiting 2 days (no path)');
  });
});
