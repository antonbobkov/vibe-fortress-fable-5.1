/** T-241 Jobs and Stocks show their targets and filters. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { computeLayout } from '@render/cellbuffer';
import { JobsSystem } from '@systems/jobs';
import { drawJobsPanel } from '@ui/panels/jobs';
import { drawStocksPanel } from '@ui/panels/stocks';
import { helpKeyRows } from '@ui/panels/help';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
function fixture() {
  const w = new TestWorld({ seed: 't241-panels', world: 'flat-test', embark: 'none' });
  const focused: number[] = [];
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: () => {},
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {},
    centerOn: (x, y, level) => focused.push(w.index(x, y, level)), home: () => {}, zoom: () => {},
    layout: () => computeLayout(80, 42, true), precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 0,
  };
  const f = new FortressScreen(host, keymap, strings);
  const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
  return { w, f, board, focused };
}
function jobs() {
  const a = fixture();
  const bed = a.w.build('bed', a.w.index(20, 20, z), 'oak');
  const worker = a.w.spawnDwarf({ at: a.w.index(21, 20, z) });
  const log = a.w.spawnItem('log', 'oak', a.w.index(23, 20, z));
  a.w.game.world.entities.get(worker, C.Creature)!.name = 'Vera';
  const build = a.board.create('t241-build', { type: 'build', target: { kind: 'building', ref: bed }, workTile: 'adjacent', data: { labor: 'carpentry' } });
  const haul = a.board.create('t241-haul', { type: 'haul_to_stockpile', target: { kind: 'entity', ref: log }, workTile: 'adjacent' });
  const dig = a.board.create('t241-dig', { type: 'dig', target: { kind: 'tile', ref: a.w.index(25, 20, z) }, workTile: 'adjacent' });
  const b = a.board.jobs.get(build)!; b.state = 'fetching'; b.workerId = worker;
  a.board.jobs.get(haul)!.state = 'open';
  const d = a.board.jobs.get(dig)!; d.state = 'blocked'; d.blockedReason = 'no_tool';
  return { ...a, build, haul, dig, log, bed };
}
const rect = { col: 0, row: 0, cols: 80, rows: 32 };
function draw(f: FortressScreen, which: 'jobs' | 'stocks', width = 80) {
  const s = surface(width, 32);
  if (which === 'jobs') drawJobsPanel(s, { ...rect, cols: width }, f.jobs, f.ctx);
  else drawStocksPanel(s, { ...rect, cols: width }, f.stocks, f.ctx);
  return s;
}
function type(f: FortressScreen, text: string) { f.key(press('/')); for (const ch of text) f.key(press(ch)); f.key(press('Enter')); }

describe('T-241 job names, empty line and panel filters', () => {
  it('empty Jobs draws the advice after the table clears its body', () => {
    const { f } = fixture();
    expect(draw(f, 'jobs', 36).lines().join('\n')).toContain('No jobs. Designate');
  });
  it('names building and hauled item targets, keeps bare tile coordinates and centres the target', () => {
    const { f, build, focused, w } = jobs();
    const s = draw(f, 'jobs'); const text = s.lines().join('\n');
    expect(text).toContain('Build bed'); expect(text).toContain('Haul log');
    expect(text).toContain('Dig (25,20,z32)');
    f.openPanel('jobs'); f.jobs.list.selected = f.jobs.jobs(f.ctx).findIndex(j => j.id === build);
    f.key(press('Enter')); expect(focused).toEqual([w.index(20, 20, z)]);
    const row = s.lines().findIndex(line => line.includes('Build bed')); s.hitAt(8, row)?.action();
    expect(focused).toEqual([w.index(20, 20, z), w.index(20, 20, z)]);
  });
  it('text matches the target name or worker, and focus captures panel letters until Enter or Esc', () => {
    const { f, build } = jobs(); f.openPanel('jobs'); type(f, 'bed');
    expect(f.ui.panel).toBe('jobs'); expect(f.jobs.jobs(f.ctx).map(j => j.id)).toEqual([build]);
    f.key(press('/')); for (let i = 0; i < 3; i++) f.key(press('Backspace'));
    for (const ch of 'VERA') f.key(press(ch)); f.key(press('Esc'));
    expect(f.ui.panel).toBe('jobs'); expect(f.jobs.jobs(f.ctx).map(j => j.id)).toEqual([build]);
    f.key(press('l')); expect(f.ui.panel).toBe('labors');
  });
  it('labor and state filters cycle by key and mouse, including fetching in claimed', () => {
    const { f, build, haul, dig } = jobs(); f.openPanel('jobs');
    f.key(press('s', { shift: true })); expect(f.jobs.jobs(f.ctx).map(j => j.id)).toEqual([haul]);
    f.key(press('s', { shift: true })); expect(f.jobs.jobs(f.ctx).map(j => j.id)).toEqual([build]);
    f.key(press('s', { shift: true })); expect(f.jobs.jobs(f.ctx).map(j => j.id)).toEqual([dig]);
    f.key(press('s', { shift: true })); expect(f.jobs.jobs(f.ctx)).toHaveLength(3);
    const s = draw(f, 'jobs'); const row = s.lines().findIndex(line => line.includes('[S-l] labor: all'));
    expect(row).toBeGreaterThanOrEqual(0); s.hitAt(2, row)?.action();
    expect(f.jobs.jobs(f.ctx).map(j => j.id)).toEqual([build]); // registry labor order: carpentry, hauling, mining
    f.key(press('l', { shift: true })); expect(f.jobs.jobs(f.ctx).map(j => j.id)).toEqual([haul]);
    f.key(press('l', { shift: true })); expect(f.jobs.jobs(f.ctx).map(j => j.id)).toEqual([dig]);
    f.key(press('l', { shift: true })); expect(f.jobs.jobs(f.ctx)).toHaveLength(3);
  });
  it('the filter and both cycles have mouse paths at sidebar width', () => {
    const { f } = jobs(); f.openPanel('jobs'); const s = draw(f, 'jobs', 36);
    for (const caption of ['/filter', '[S-l] labor', '[S-s] state']) {
      const row = s.lines().findIndex(line => line.includes(caption)); expect(row).toBeGreaterThanOrEqual(0);
      expect(s.hitAt(12, row)).not.toBeNull();
    }
    const row = s.lines().findIndex(line => line.includes('/filter')); s.hitAt(12, row)?.action();
    f.key(press('j')); expect(f.ui.panel).toBe('jobs'); f.key(press('Enter'));
    f.key(press('j')); expect(f.ui.panel).toBeNull();
  });
  it('only non-default labor priorities are shown, with full names', () => {
    const { f, w } = fixture();
    expect(draw(f, 'jobs').lines().join('\n')).toContain('All labors at priority 5: change them in the labor manager ([l], Enter).');
    w.submit({ type: 'SetLaborPriority', labor: 'mining', priority: 2 }); w.step(1);
    const text = draw(f, 'jobs').lines().join('\n'); expect(text).toContain('Mining 2');
    expect(text).not.toContain('Anim 5'); expect(text).not.toContain('All labors at priority');
  });
  it('Stocks filters type names and materials with ancestors visible, and accepts mouse text focus', () => {
    const { f, w } = fixture(); w.spawnItem('log', 'oak', w.index(20, 20, z)); w.spawnItem('drink', 'ale', w.index(21, 20, z));
    f.openPanel('stocks'); const s = draw(f, 'stocks', 36);
    const row = s.lines().findIndex(line => line.includes('/filter')); expect(row).toBeGreaterThanOrEqual(0);
    s.hitAt(12, row)?.action(); for (const ch of 'log') f.key(press(ch)); f.key(press('Enter'));
    expect(f.ui.panel).toBe('stocks'); expect(f.stocks.visibleForest(f.ctx).map(n => n.id)).toEqual(['wood']);
    expect(draw(f, 'stocks').lines().join('\n')).toMatch(/log\s+1/);
    expect(draw(f, 'stocks').lines().join('\n')).not.toMatch(/drink\s+1/);
    f.key(press('/')); for (let i = 0; i < 3; i++) f.key(press('Backspace'));
    for (const ch of 'oak') f.key(press(ch)); f.key(press('Enter'));
    const filtered = draw(f, 'stocks');
    const material = filtered.lines().findIndex(line => /oak x1/.test(line));
    expect(material).toBeGreaterThanOrEqual(0); filtered.hitAt(10, material)?.action();
    expect(f.stocks.selectedNode(f.ctx)).toMatch(/^item:/);
    expect(f.stocks.visibleForest(f.ctx).map(n => n.id)).toEqual(['wood']);
  });
  it('Help describes every new filter action', () => {
    const text = helpKeyRows(keymap, strings).map(r => r.text).join('\n');
    expect(text).toContain('[S-l]'); expect(text).toContain('filter jobs'); expect(text).toContain('filter stocks');
  });
});
