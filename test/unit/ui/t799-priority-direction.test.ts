/**
 * T-799: the priority digit says which end is urgent (11 § Concepts: 1 first). The designation status
 * row words it ("priority 2 (urgent)"); the Jobs panel's `[p]` makes a job sooner and `[S-p]` later,
 * neither wrapping; a box drawn over designated tiles gives them, and their jobs, the tool's
 * priority and counts them; Designate's `[p]` re-prioritizes the last box drawn and names it.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Command } from '@core/commands';
import { TileKind } from '@core/map3d';
import { computeLayout } from '@render/cellbuffer';
import type { JobsReader } from '@systems/jobs';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { priorityBand } from '@ui/panels/designate';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const sent: Command[] = [];
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z),
    submit: (cmd) => { sent.push(cmd); w.submit(cmd); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => LAYOUT, precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
  };
  const screen = new FortressScreen(host, keymap, strings);
  for (let x = 30; x <= 33; x += 1) w.game.world.services.terrain.setKind(w.index(x, 30, z), TileKind.Wall, 1);
  return { w, screen, sent };
}

describe('T-799 the priority digit says which end is urgent', () => {
  it('bands the scale: 1-3 urgent, 4-6 normal, 7-9 whenever, and the tool row says it', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(priorityBand)).toEqual(['urgent', 'urgent', 'urgent', 'normal', 'normal', 'normal', 'whenever', 'whenever', 'whenever']);
    const f = setup('t799-row');
    f.screen.key(press('d'));
    f.screen.key(press('D', { shift: true }));
    f.screen.key(press('2'));
    expect(f.screen.statusRow2()).toMatch(/^Dig · priority 2 \(urgent\) · /);
    f.screen.key(press('9'));
    expect(f.screen.statusRow2()).toMatch(/^Dig · priority 9 \(whenever\) · /);
  });

  it('a box drawn over designated tiles gives them and their jobs the tool\'s priority, and says how many', () => {
    const f = setup('t799-redraw');
    f.screen.key(press('d'));
    f.screen.key(press('D', { shift: true }));
    f.screen.key(press('8'));
    f.screen.commit({ x: 30, y: 30, z }, { x: 33, y: 30, z });
    f.w.step(2);
    const jobs = f.w.readers.of<JobsReader>('11');
    const tiles = [30, 31, 32, 33].map((x) => f.w.index(x, 30, z));
    expect(tiles.map((t) => f.w.readers.map.designationPriorityAt(t))).toEqual([8, 8, 8, 8]);
    expect(jobs.list().filter((j) => tiles.includes(j.target.ref)).map((j) => j.priority)).toEqual([8, 8, 8, 8]);
    // Redraw two of them at priority 2.
    f.screen.key(press('2'));
    f.screen.commit({ x: 30, y: 30, z }, { x: 31, y: 30, z });
    expect(f.screen.currentNotice).toBe('Dig: 2 designated, 2 re-prioritized.');
    f.w.step(2);
    expect(tiles.map((t) => f.w.readers.map.designationPriorityAt(t))).toEqual([2, 2, 8, 8]);
    expect(jobs.list().filter((j) => tiles.includes(j.target.ref)).sort((a, b) => a.target.ref - b.target.ref).map((j) => j.priority)).toEqual([2, 2, 8, 8]);
  });

  it('Designate\'s [p] gives the tool\'s priority to the last box drawn and names it', () => {
    const f = setup('t799-last-box');
    f.screen.key(press('d'));
    f.screen.key(press('D', { shift: true }));
    f.screen.key(press('8'));
    f.screen.commit({ x: 30, y: 30, z }, { x: 33, y: 30, z });
    f.w.step(1);
    // A second box over two of the same tiles, at the same priority: nothing new, but it is the last box.
    f.screen.commit({ x: 32, y: 30, z }, { x: 33, y: 30, z });
    f.w.step(1);
    f.sent.length = 0;
    f.screen.key(press('3'));
    f.screen.key(press('P', { shift: true }));
    expect(f.sent).toEqual([{ type: 'SetDesignationPriority', tiles: [f.w.index(32, 30, z), f.w.index(33, 30, z)], priority: 3 }]);
    expect(f.screen.currentNotice).toBe('Dig 2×1: priority 3 (urgent).');
  });

  it('the Jobs panel\'s [p] makes a job sooner and [S-p] later, and neither wraps', () => {
    const jobAt = (priority: number) => {
      const f = setup(`t799-jobs-${priority}`);
      f.screen.key(press('d'));
      f.screen.key(press('D', { shift: true }));
      f.screen.key(press(String(priority)));
      f.screen.commit({ x: 30, y: 30, z }, { x: 30, y: 30, z });
      f.w.step(1);
      f.screen.key(press('Escape'));
      f.screen.key(press('Escape'));
      f.screen.key(press('j'));
      const job = f.w.readers.of<JobsReader>('11').list().find((j) => j.target.ref === f.w.index(30, 30, z))!;
      f.sent.length = 0;
      return { f, job };
    };
    const at5 = jobAt(5);
    at5.f.screen.key(press('p'));
    expect(at5.f.sent).toEqual([{ type: 'SetJobPriority', jobId: at5.job.id, priority: 4 }]);
    const at9 = jobAt(9);
    at9.f.screen.key(press('P', { shift: true }));
    expect(at9.f.sent).toEqual([]);
    expect(at9.f.screen.currentNotice).toBe('Already priority 9, the least urgent.');
    const { f, job } = jobAt(1);
    f.screen.key(press('p'));
    expect(f.sent).toEqual([]);
    expect(f.screen.currentNotice).toBe('Already priority 1, the most urgent.');
    f.screen.key(press('P', { shift: true }));
    expect(f.sent).toEqual([{ type: 'SetJobPriority', jobId: job.id, priority: 2 }]);
  });

  it('the Jobs advice says which way to change the number', () => {
    expect(strings.get('ui.job_wait.ahead', { jobs: '2 more urgent jobs', whom: 'the miners' }))
      .toBe('Nobody takes it yet: 2 more urgent jobs come first for the miners. Give it a lower number (more urgent) to have it sooner.');
  });
});
