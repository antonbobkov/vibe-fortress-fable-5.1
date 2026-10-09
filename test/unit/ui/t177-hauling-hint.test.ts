import { describe, expect, it } from 'vitest';
import type { JobsReader } from '@systems/jobs';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { Strings } from '@ui/strings';
import { defaultUiState, fromSaved, toSaved } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';

function setup(wanted: number, haulers: number) {
  const w = new TestWorld({ seed: 't177-hauling', world: 'flat-test', embark: 'none' });
  const tiles = Array.from({ length: 256 }, (_, i) => w.index(50 + i % 16, 50 + Math.floor(i / 16), 32));
  const pile = w.zone('stockpile', tiles);
  expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'stone' })).toEqual({ ok: true });
  for (let i = 0; i < haulers; i += 1) {
    const id = w.spawnDwarf({ at: w.index(20, 20, 32), ageYears: 30 });
    expect(w.game.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor: 'hauling', on: true })).toEqual({ ok: true });
  }
  // Each hauler reserves one job input on the dispatch tick; retain the requested backlog after those claims.
  for (let i = 0; i < wanted + haulers; i += 1) w.spawnItem('raw_stone', 'granite', w.index(10, 10, 32));
  w.step(2);
  const jobs = w.readers.of<JobsReader>('11');
  expect(jobs.wantsHaulingCount()).toBe(wanted + haulers);
  expect(jobs.workersWithLabor('hauling')).toHaveLength(haulers);
  const ui = defaultUiState(32);
  const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
  const hints = new HintEngine(w.game.registry, ui, log);
  return { w, ui, log, hints };
}

describe('T-177 the hauling shortage hint is checked daily and saved once', () => {
  it.each([[200, 2, false], [201, 3, false], [201, 2, true], [201, 0, true]] as const)
  ('wanted=%i, haulers=%i warns=%s', (wanted, haulers, warns) => {
    const { w, ui, hints } = setup(wanted, haulers);
    w.game.world.onEvents((batch) => hints.onEvents(batch, w.readers));
    w.game.world.emit({ type: 'DayPassed' });
    w.step(1);
    expect(w.readers.of<JobsReader>('11').wantsHaulingCount()).toBe(wanted);
    expect(ui.hintsShown.includes('hint_haulers')).toBe(warns);
  });
  it('honours disabled hints, checks on DayPassed rather than HourPassed, and does not repeat after UI load', () => {
    const { w, ui, log, hints } = setup(201, 2);
    hints.onEvents([{ type: 'HourPassed', hour: 0 }], w.readers);
    expect(ui.hintsShown).not.toContain('hint_haulers');
    hints.onEvents([{ type: 'DayPassed' }], w.readers, false);
    expect(ui.hintsShown).not.toContain('hint_haulers');
    const before = log.lines.length;
    hints.onEvents([{ type: 'DayPassed' }], w.readers);
    expect(ui.hintsShown).toContain('hint_haulers');
    expect(log.lines).toHaveLength(before + 1);
    expect(log.lines.at(-1)?.text).toMatch(/^\u263c .*hauling/i);
    const restored = defaultUiState(32);
    fromSaved(restored, toSaved(ui, log.lines));
    new HintEngine(w.game.registry, restored, log).onEvents([{ type: 'DayPassed' }], w.readers);
    hints.onEvents([{ type: 'DayPassed' }], w.readers);
    expect(log.lines).toHaveLength(before + 1);
  });
});
