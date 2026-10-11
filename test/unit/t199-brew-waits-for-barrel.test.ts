import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import type { WorkshopsReader } from '@systems/workshops';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { Strings } from '@ui/strings';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../scenarios/test-world';

const Z = 32;

/** A still, plants, five barrels that each hold one stack of food, and a brew order. */
function setup() {
  const w = new TestWorld({ seed: 't199-barrel', world: 'flat-test', embark: 'none' });
  const still = w.build('still', w.index(15, 15, Z));
  w.spawnItem('plant_food', 'dimcap', w.index(19, 17, Z), 12);
  for (let i = 0; i < 5; i += 1) {
    const barrel = w.spawnItem('barrel', 'pine', w.index(25 + i, 25, Z));
    w.spawnItem('easy_meal', 'dimcap', { containerId: barrel }, 4);
  }
  w.step(1);
  const registry = w.game.registry;
  const ui = defaultUiState(Z);
  const log = new AnnouncementLog(new Strings(registry), registry);
  log.register(w.game.world.registrations.announcements);
  const hints = new HintEngine(registry, ui, log);
  w.game.world.onEvents((events) => {
    for (const event of events) log.announce(event, w.readers, w.tick);
    hints.onEvents(events, w.readers);
  });
  const brew = (): unknown => w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: still,
    order: { recipeId: 'brew', mode: 'once', remaining: 1, priority: 5 } });
  const alerts = (): string[] => log.lines.filter((line) => line.severity === 'alert').map((line) => line.text);
  return { w, still, ui, log, brew, alerts };
}

describe('T-199 a brew waits for an empty barrel and the game says so', () => {
  it('announces the missing empty barrel once over a long wait, and shows the barrel hint', () => {
    const { w, still, ui, log, brew, alerts } = setup();
    expect(brew()).toEqual({ ok: true });
    w.step(10);
    expect(w.readers.of<WorkshopsReader>('12').isRunnable('brew', still).reason).toBe('waiting for barrel');
    w.step(3 * TICKS_PER_DAY);
    const blocked = w.events('WorkshopBlocked').filter((e) => e['workshopId'] === still);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.['reason']).toBe('no_empty_container');
    expect(blocked[0]?.['container']).toBe('barrel');
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0]).toMatch(/empty barrel/);
    expect(log.lines.filter((line) => line.count > 1)).toHaveLength(0);
    expect(ui.hintsShown).toContain('hint_barrel');
    const hint = log.lines.filter((line) => line.text.startsWith('☼') && /barrel/.test(line.text));
    expect(hint).toHaveLength(1);
    expect(hint[0]?.text).toMatch(/carpenter/);
    expect(w.events('JobCreated').filter((e) => e['jobType'] === 'craft')).toHaveLength(0);
  }, 60_000);

  it('announces again only when a wait begins anew after the first has ended', () => {
    const { w, still, log, brew, alerts } = setup();
    expect(brew()).toEqual({ ok: true });
    w.step(TICKS_PER_DAY);
    expect(alerts()).toHaveLength(1);
    expect(w.game.world.applyCommand({ type: 'RemoveWorkOrder', workshopId: still, index: 0 })).toEqual({ ok: true });
    w.step(TICKS_PER_DAY);
    expect(w.events('WorkshopIdle').filter((e) => e['workshopId'] === still)).toHaveLength(1);
    expect(alerts()).toHaveLength(1);
    expect(brew()).toEqual({ ok: true });
    w.step(TICKS_PER_DAY);
    expect(w.events('WorkshopBlocked').filter((e) => e['workshopId'] === still)).toHaveLength(2);
    // The log merges identical lines within LOG_DEDUP_TICKS, so the second announcement raises the count.
    const lines = log.lines.filter((line) => line.severity === 'alert' && /empty barrel/.test(line.text));
    expect(lines.reduce((sum, line) => sum + line.count, 0)).toBe(2);
  }, 60_000);
});
