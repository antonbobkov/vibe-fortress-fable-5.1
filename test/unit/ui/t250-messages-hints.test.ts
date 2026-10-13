import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { ReaderSet } from '@core/readers';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { rejectionText } from '@ui/messages';
import { defaultUiState, fromSaved, toSaved } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { registry, strings } from './ui-fixture';

// Audited handler paths returning this reason, excluding World's malformed-command fallback.
const PRECONDITION_COMMANDS = ['Designate', 'UndoDesignation', 'DesignateStairwell', 'SetTraffic', 'DesignateHarvest',
  'TrainAnimal', 'TameCaged', 'ReleaseCaged', 'ReleaseCage', 'DeconstructBuilding', 'SetBuildingPriority', 'AssignCoffin',
  'AssignRoom', 'SetHospitalSupplies', 'ForbidItem', 'DumpItem', 'MeltItem', 'ClaimItem', 'SetJobPriority', 'TradeOffer',
  'MoveToDepot', 'RemoveFromDepot', 'AddWorkOrder', 'EditWorkOrder', 'SuspendWorkshop', 'SetWorkshopWorker'] as const;

function world() { return new TestWorld({ seed: 't250-guidance', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' }); }
function logFor(w: TestWorld, ui = defaultUiState(z)) {
  const log = new AnnouncementLog(strings, w.game.registry, ui);
  log.register(w.game.world.registrations.announcements); return { log, ui };
}
function pathClock() {
  const w = world(), ui = defaultUiState(z), log = new AnnouncementLog(strings, w.game.registry);
  const clock = { tick: 100 };
  const job = { id: 9, state: 'blocked', blockedReason: 'unreachable' as string | null };
  const calendar = new Proxy(w.readers.calendar, { get: (target, key) => key === 'tick' ? clock.tick : key === 'hour' ? 0 : Reflect.get(target, key) });
  const readers: ReaderSet = new Proxy(w.readers, { get: (target, key) => {
    if (key === 'calendar') return calendar;
    if (key === 'of') return (id: string) => id === '11' ? { list: () => [job], workersWithLabor: () => [], wantsHaulingCount: () => 0 } : target.of(id);
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
  const hints = new HintEngine(w.game.registry, ui, log);
  const hour = (tick: number, enabled = true) => { clock.tick = tick; hints.onEvents([{ type: 'HourPassed', hour: 0 }], readers, enabled); };
  return { w, ui, log, clock, job, readers, hints, hour };
}

describe('T-250 named refusals, idle workshops, seed plots and hourly hints', () => {
  it.each(PRECONDITION_COMMANDS)('%s has its own precondition refusal', type => {
    expect(strings.has(`ui.reject.precondition_failed.${type}`), type).toBe(true);
    expect(strings.get(`ui.reject.precondition_failed.${type}`)).not.toBe(strings.get('reject.precondition_failed'));
  });
  it('counts the unique tiles still designated after a partial undo', () => {
    const w = world(), a = w.index(20,20,z-1), b = w.index(21,20,z-1);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [a], priority: 5 }).ok).toBe(true);
    expect(rejectionText({ readers: w.readers, registry, strings }, { type: 'UndoDesignation', tiles: [a,b,a] }, 'has_progress'))
      .toBe('1 designations kept: work has begun there');
  });
  it('a real missing-log workshop event names its input and announces the named workshop as a note', () => {
    const w = world(), shop = w.build('carpenter', w.index(20,20,z)); w.step(1);
    w.submit({ type: 'AddWorkOrder', workshopId: shop, order: { recipeId: 'make_door_wood', mode: 'once', remaining: 5, threshold: 0, priority: 5 } }); w.step(20);
    expect(w.game.world.commandLog.all().at(-1)?.result.ok).toBe(true);
    const event = w.events('WorkshopBlocked').find(e => e['workshopId'] === shop && e['reason'] === 'missing_input');
    expect(event).toMatchObject({ input: 'log' });
    const { log } = logFor(w); const announced = log.announce(event!, w.readers, w.readers.calendar.tick);
    expect(announced?.severity).toBe('note'); expect(announced?.line.text).toBe("Carpenter's workshop #1 is idle: no log.");
  });
  it('suppresses missing-input notes until that workshop completes a craft, including across UI save/load', () => {
    const w = world(), shop = w.build('carpenter', w.index(20,20,z)); const { log, ui } = logFor(w);
    const event: GameEvent = { type: 'WorkshopBlocked', workshopId: shop, reason: 'missing_input', input: 'log' };
    expect(log.announce(event, w.readers, 1)).not.toBeNull(); expect(log.announce(event, w.readers, 1000)).toBeNull();
    const restored = defaultUiState(z); fromSaved(restored, toSaved(ui, log.lines)); const again = logFor(w, restored).log;
    expect(again.announce(event, w.readers, 1100)).toBeNull();
    again.announce({ type: 'JobCompleted', jobId: 1, jobType: 'craft', target: shop, workerId: 0 }, w.readers, 1200);
    expect(again.announce(event, w.readers, 1300)?.line.text).toBe("Carpenter's workshop #1 is idle: no log.");
  });
  it('names alternative input types and gives a legacy event without input a readable fallback', () => {
    const w = world(), shop = w.build('clothier', w.index(20,20,z));
    const first = logFor(w).log;
    expect(first.announce({ type: 'WorkshopBlocked', workshopId: shop, reason: 'missing_input', input: 'fiber|wool_raw' }, w.readers, 1)?.line.text).toContain('no fiber or wool.');
    const legacy = logFor(w).log;
    expect(legacy.announce({ type: 'WorkshopBlocked', workshopId: shop, reason: 'missing_input' }, w.readers, 1)?.line.text).toContain('no input.');
  });
  it('the seed note names the specific plot', () => {
    const w = world(); w.zone('farm_plot',[w.index(10,10,z)]); const plot = w.zone('farm_plot',[w.index(15,10,z)]);
    const { log } = logFor(w); expect(log.announce({ type: 'PlotNeedsSeeds', zoneId: plot, species: 'dimcap' }, w.readers, 1)?.line.text)
      .toBe('Farm plot #2 has no dimcap seeds.');
  });
  it('warns on the hourly pass when dig exists and no living dwarf has mining enabled', () => {
    const w = world(), id = w.spawnDwarf({ at: w.index(20,20,z) });
    expect(w.game.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor: 'mining', on: false }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [w.index(20,20,z-1)], priority: 5 }).ok).toBe(true);
    const ui = defaultUiState(z), log = new AnnouncementLog(strings, w.game.registry), hints = new HintEngine(w.game.registry, ui, log);
    hints.onEvents([{ type: 'HourPassed', hour: 0 }], w.readers, false); expect(ui.hintsShown).not.toContain('hint_no_miners');
    hints.onEvents([{ type: 'HourPassed', hour: 0 }], w.readers); expect(ui.hintsShown).toContain('hint_no_miners');
    expect(log.lines.some(l => l.text.includes('No one has mining enabled. Turn it on in Labors [l].'))).toBe(true);
  });
  it('does not warn with an enabled living miner, or when there is no dig designation', () => {
    const w = world(), id = w.spawnDwarf({ at: w.index(20,20,z) }), tile = w.index(20,20,z-1);
    expect(w.game.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor: 'mining', on: true }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [tile], priority: 5 }).ok).toBe(true);
    const ui = defaultUiState(z), log = new AnnouncementLog(strings,w.game.registry), hints = new HintEngine(w.game.registry,ui,log);
    hints.onEvents([{ type: 'HourPassed', hour: 0 }],w.readers); expect(ui.hintsShown).not.toContain('hint_no_miners');
    expect(w.game.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor: 'mining', on: false }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'UndoDesignation', tiles: [tile] }).ok).toBe(true);
    hints.onEvents([{ type: 'HourPassed', hour: 0 }],w.readers); expect(ui.hintsShown).not.toContain('hint_no_miners');
  });
  it('waits a whole day of observed unreachable blocking, then shows the saved once-only hint', () => {
    const f = pathClock(); f.hour(100); f.hour(100+TICKS_PER_DAY-1); expect(f.ui.hintsShown).not.toContain('hint_no_path');
    f.hour(100+TICKS_PER_DAY); expect(f.ui.hintsShown).toContain('hint_no_path');
    const restored = defaultUiState(z); fromSaved(restored,toSaved(f.ui,f.log.lines));
    new HintEngine(f.w.game.registry,restored,f.log).onEvents([{ type: 'HourPassed', hour: 0 }],f.readers);
    expect(f.log.lines.filter(l => l.text.includes('Jobs are blocked: no path.'))).toHaveLength(1);
  });
  it('clears the unreachable clock when the reason changes and preserves its clock through UI load', () => {
    const f = pathClock(); f.hour(100); f.job.blockedReason = 'no_worker'; f.hour(600);
    f.job.blockedReason = 'unreachable'; f.hour(700); const restored = defaultUiState(z); fromSaved(restored,toSaved(f.ui,f.log.lines));
    const engine = new HintEngine(f.w.game.registry,restored,f.log);
    f.clock.tick = 700+TICKS_PER_DAY-1; engine.onEvents([{ type: 'HourPassed', hour: 0 }],f.readers); expect(restored.hintsShown).not.toContain('hint_no_path');
    f.clock.tick++; engine.onEvents([{ type: 'HourPassed', hour: 0 }],f.readers); expect(restored.hintsShown).toContain('hint_no_path');
  });
});
