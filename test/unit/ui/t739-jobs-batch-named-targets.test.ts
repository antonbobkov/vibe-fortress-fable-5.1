/**
 * T-739: the Jobs panel batches jobs on named targets as it batches bare-tile jobs (`panels.md`
 * § Jobs): planned beds blocked for one input, straw hauls nobody took, one row each with a count,
 * wherever in their priority the like jobs stand.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Command } from '@core/commands';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { JobsSystem } from '@systems/jobs';
import { drawJobsPanel } from '@ui/panels/jobs';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup() {
  const w = new TestWorld({ seed: 't739-jobs', world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 60 * TICKS_PER_DAY });
  const sent: Command[] = [];
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (cmd) => { sent.push(cmd); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => computeLayout(80, 42, true), precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 0,
  };
  const f = new FortressScreen(host, keymap, strings);
  const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
  const items = w.game.registry.table('items');
  f.openPanel('jobs');
  return { w, f, sent, board, items };
}

type Fixture = ReturnType<typeof setup>;

/** Nine beds, each with a build job blocked for one log that the fortress does not have. */
function beds(a: Fixture, input = (_k: number) => 'log'): number[] {
  const ids: number[] = [];
  for (let k = 0; k < 9; k += 1) {
    const bed = a.w.build('bed', a.w.index(30 + k, 12 + (k % 3) * 4, z), 'oak');
    const id = a.board.create(`t739-bed-${k}`, {
      type: 'build', priority: 4, target: { kind: 'building', ref: bed }, workTile: 'adjacent',
      inputs: [{ filter: { type: a.items.index(input(k)) }, count: 1 }],
    });
    const job = a.board.jobs.get(id)!;
    job.state = 'blocked';
    job.blockedReason = 'missing_input';
    ids.push(id);
  }
  return ids;
}

/** Twenty open straw hauls, with a seed haul between every few: the order the board makes them in. */
function hauls(a: Fixture): { straw: number[]; seed: number[] } {
  const straw: number[] = [];
  const seed: number[] = [];
  const now = a.w.readers.calendar.tick;
  for (let k = 0; k < 20; k += 1) {
    const item = a.w.spawnItem('straw', 'barley', a.w.index(40 + k, 40, z));
    const id = a.board.create(`t739-straw-${k}`, { type: 'haul_to_stockpile', priority: 6, target: { kind: 'entity', ref: item }, workTile: 'adjacent' });
    Object.assign(a.board.jobs.get(id)!, { state: 'open' }).createdTick = now - (16 - Math.floor(k / 2)) * TICKS_PER_DAY;
    straw.push(id);
    if (k % 4 === 1) {
      const s = a.w.spawnItem('seed', 'barley', a.w.index(40 + k, 42, z));
      const sid = a.board.create(`t739-seed-${k}`, { type: 'haul_to_stockpile', priority: 6, target: { kind: 'entity', ref: s }, workTile: 'adjacent' });
      Object.assign(a.board.jobs.get(sid)!, { state: 'open' }).createdTick = now - 2 * TICKS_PER_DAY;
      seed.push(sid);
    }
  }
  return { straw, seed };
}

function draw(f: FortressScreen, rows = 40): string[] {
  const s = surface(36, rows);
  drawJobsPanel(s, { col: 0, row: 0, cols: 36, rows }, f.jobs, f.ctx);
  // The panel's content starts one cell in, as the sidebar draws it.
  return s.lines().map((line) => line.slice(1).trimEnd());
}

describe('T-739 Jobs batches jobs on named targets', () => {
  it('nine bed builds blocked for one input are one row "Build bed ×9" that Enter opens', () => {
    const a = setup();
    beds(a);
    expect(a.f.jobs.rows(a.f.ctx).map((r) => r.jobs.length)).toEqual([9]);
    const rows = draw(a.f);
    // The glyph set draws `×` as `x` and `–` as `-`.
    expect(rows.find((row) => row.includes('Build bed'))).toMatch(/^ 4 {2}Build bed x9 +waiting: 1 log$/);
    const text = rows.join(' ').replace(/ +/g, ' ');
    expect(text).toContain('9 jobs over (30,12)-(38,20), z');
    expect(text).toContain('[Enter] list them.');
    a.f.key(press('Enter'));
    expect(a.f.jobs.rows(a.f.ctx).map((r) => r.jobs.length)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(draw(a.f).filter((row) => /Build bed +waiting: 1 log$/.test(row))).toHaveLength(9);
  });

  it('a build blocked for another input stays a row of its own', () => {
    const a = setup();
    beds(a, (k) => (k === 4 ? 'stone_block' : 'log'));
    expect(a.f.jobs.rows(a.f.ctx).map((r) => r.jobs.length)).toEqual([8, 1]);
    const rows = draw(a.f);
    expect(rows.some((row) => /Build bed x8 +waiting: 1 log$/.test(row))).toBe(true);
    expect(rows.some((row) => /Build bed +waiting$/.test(row))).toBe(true);
  });

  it('a claimed build leaves the batch: its worker is its fact', () => {
    const a = setup();
    const ids = beds(a);
    const worker = a.w.spawnDwarf({ at: a.w.index(30, 30, z), name: 'Orm Ashbrow' });
    const job = a.board.jobs.get(ids[3] as number)!;
    job.state = 'fetching';
    job.workerId = worker as EntityId;
    expect(a.f.jobs.rows(a.f.ctx).map((r) => r.jobs.length)).toEqual([8, 1]);
    expect(draw(a.f).some((row) => /Build bed +Orm Ashbrow$/.test(row))).toBe(true);
  });

  it('a member of an opened batch is selected on its own and shows its worker once one takes it', () => {
    const a = setup();
    const ids = beds(a);
    a.f.key(press('Enter'));
    a.f.jobs.list.selected = 5;
    expect(a.f.jobs.selected(a.f.ctx)?.id).toBe(ids[5]);
    const worker = a.w.spawnDwarf({ at: a.w.index(30, 30, z), name: 'Orm Ashbrow' });
    const job = a.board.jobs.get(ids[5] as number)!;
    job.state = 'working';
    job.workerId = worker as EntityId;
    // The rest stay opened: their rows last while their jobs do.
    expect(a.f.jobs.rows(a.f.ctx)).toHaveLength(9);
    expect(a.f.jobs.selected(a.f.ctx)?.id).toBe(ids[5]);
    expect(draw(a.f)[5 + 6]).toMatch(/Build bed +Orm Ashbrow$/);
  });

  it('twenty straw hauls with seed hauls between them are one row with the oldest age', () => {
    const a = setup();
    const { straw, seed } = hauls(a);
    const rows = a.f.jobs.rows(a.f.ctx);
    expect(rows.map((r) => r.jobs.length)).toEqual([20, 5]);
    expect(rows[0]?.jobs.map((j) => j.id)).toEqual(straw);
    expect(rows[1]?.jobs.map((j) => j.id)).toEqual(seed);
    const drawn = draw(a.f);
    expect(drawn).toContain(' 6  Haul straw x20  open 16 days');
    expect(drawn).toContain(' 6  Haul seed x5    open 2 days');
  });

  it('hunts never batch: each names its own creature', () => {
    const a = setup();
    for (let k = 0; k < 4; k += 1) {
      const crab = a.w.spawnCreature('cave_crab', a.w.index(60 + k, 60, z), 'wild');
      a.board.create(`t739-hunt-${k}`, { type: 'hunt', target: { kind: 'entity', ref: crab }, workTile: 'adjacent' });
    }
    expect(a.f.jobs.rows(a.f.ctx).map((r) => r.jobs.length)).toEqual([1, 1, 1, 1]);
    expect(a.w.game.world.entities.get(a.board.jobs.get(a.f.jobs.rows(a.f.ctx)[0]?.jobs[0]?.id as number)!.target.ref, C.Creature)).toBeDefined();
  });

  it('[p] on the batch row raises all nine; [x] cancels all nine', () => {
    const a = setup();
    const ids = beds(a);
    a.f.key(press('p'));
    expect(a.sent).toEqual(ids.map((jobId) => ({ type: 'SetJobPriority', jobId, priority: 5 })));
    a.sent.length = 0;
    a.f.key(press('x'));
    expect(a.sent).toEqual(ids.map((jobId) => ({ type: 'CancelJob', jobId })));
  });

  it('a batch too long for its column keeps its count and cuts its name', () => {
    const a = setup();
    const now = a.w.readers.calendar.tick;
    for (let k = 0; k < 12; k += 1) {
      const item = a.w.spawnItem('straw', 'barley', a.w.index(40 + k, 40, z));
      const id = a.board.create(`t739-rot-${k}`, { type: 'haul_to_depot', target: { kind: 'entity', ref: item }, workTile: 'adjacent' });
      Object.assign(a.board.jobs.get(id)!, { state: 'open' }).createdTick = now;
    }
    const row = draw(a.f).find((line) => line.startsWith(' 5'));
    expect(row).toMatch(/^ 5 {2}Haul to de» x12 +-$/);
  });
});
