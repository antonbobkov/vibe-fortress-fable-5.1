import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { TICKS_PER_DAY } from '@core/constants';
import type { ReaderSet } from '@core/readers';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine, hintPredicate, type HintFacts } from '@ui/hints';
import { Strings } from '@ui/strings';
import { defaultUiState, fromSaved, toSaved } from '@ui/ui-state';

const base: HintFacts = {
  tick: 0, year: 0, season: 0, day: 0,
  stillMissing: false, drinkLow: false, stockpileMissing: false, groundItems: 0,
  hearthMissing: false, hasDiningHall: false, bedrooms: 0, containersMissing: false,
  fuelBlocked: false, hunterReady: false, farmRejected: false, harvested: false,
  bareRoomDays: 0, threatWarned: false, depotMissing: false, seriousWound: false,
  immigrationSkipped: false, raidEnded: false, cageTrapBuilt: false, doorBroken: false,
  deepsilverFound: false, cavernTwoBreached: false,
};

const positive: Record<string, Partial<HintFacts>> = {
  hint_dig: { tick: 1 },
  hint_haulers: { haulingPressure: true },
  hint_still: { stillMissing: true, drinkLow: true },
  hint_stockpile: { stockpileMissing: true, groundItems: 21 },
  hint_winter: { year: 1, season: 0, day: 20 },
  hint_hearth: { hearthMissing: true, bedrooms: 5 },
  hint_containers: { containersMissing: true },
  hint_fuel: { fuelBlocked: true },
  hint_hunter: { hunterReady: true },
  hint_farm: { farmRejected: true },
  hint_seeds: { harvested: true },
  hint_room: { bareRoomDays: 3 },
  hint_alert: { threatWarned: true },
  hint_depot: { year: 1, season: 1, day: 14, depotMissing: true },
  hint_hospital: { seriousWound: true },
  hint_immigration: { immigrationSkipped: true },
  hint_gate: { raidEnded: true },
  hint_cage: { cageTrapBuilt: true },
  hint_troll: { doorBroken: true },
  hint_deep: { deepsilverFound: true },
  hint_magma: { cavernTwoBreached: true },
};

describe('T-M4-16 year-one hints', () => {
  it('has an exact positive and negative predicate fixture for every authored hint', () => {
    const rows = contentRegistry().table('hints').ids();
    expect(rows).toHaveLength(21);
    expect(rows.slice().sort()).toEqual(Object.keys(positive).sort());
    for (const id of rows) {
      expect(hintPredicate(id, base), `${id} baseline`).toBe(false);
      expect(hintPredicate(id, { ...base, ...positive[id] }), `${id} trigger`).toBe(true);
    }
    expect(hintPredicate('hint_still', { ...base, stillMissing: true })).toBe(false);
    expect(hintPredicate('hint_stockpile', { ...base, stockpileMissing: true, groundItems: 20 })).toBe(false);
    expect(hintPredicate('hint_depot', { ...base, year: 1, season: 1, day: 14 })).toBe(false);
  });

  it('shows once as a lamp-prefixed note, honours the setting, and survives the ui save', () => {
    const registry = contentRegistry();
    const ui = defaultUiState(32);
    const log = new AnnouncementLog(new Strings(registry), registry);
    const hints = new HintEngine(registry, ui, log);
    expect(hints.registered).toHaveLength(21);
    expect(hints.show('hint_dig', 1, false)).toBe(false);
    expect(ui.hintsShown).toEqual([]);
    expect(hints.show('hint_dig', 1)).toBe(true);
    expect(hints.show('hint_dig', 2)).toBe(false);
    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]).toMatchObject({ severity: 'note', tick: 1 });
    expect(log.lines[0]?.text.startsWith('☼ ')).toBe(true);
    ui.hintPending.push('hint_seeds');
    ui.hintBareSince.push([7, 3 * TICKS_PER_DAY]);
    const saved = toSaved(ui, log.lines);
    const restored = defaultUiState(0);
    fromSaved(restored, saved);
    expect(restored.hintsShown).toEqual(['hint_dig']);
    expect(restored.hintPending).toEqual(['hint_seeds']);
    expect(restored.hintBareSince).toEqual([[7, 3 * TICKS_PER_DAY]]);
    expect(new HintEngine(registry, restored, log).show('hint_dig', 3)).toBe(false);
  });

  it('D-145: starts the bare-bedroom clock at first hourly observation and waits three days', () => {
    const registry = contentRegistry();
    const ui = defaultUiState(32);
    const log = new AnnouncementLog(new Strings(registry), registry);
    const hints = new HintEngine(registry, ui, log);
    let tick = 0;
    const readers = {
      calendar: { get tick() { return tick; }, hour: 0, dayOfSeason: 1, season: 0, year: 1 },
      has: (id: string) => id === '14',
      of: () => ({ zonesOfType: (type: string) => type === 'bedroom' ? [7] : [], byType: () => [],
        room: () => ({ tier: 0 }), hearth: () => 0, depots: () => [], zone: () => undefined }),
      entities: { with: () => [] },
    } as unknown as ReaderSet;
    const hour = [{ type: 'HourPassed', hour: 0 }] as never;
    hints.onEvents(hour, readers);
    expect(ui.hintBareSince).toEqual([[7, 0]]);
    tick = 3 * TICKS_PER_DAY - 1;
    hints.onEvents(hour, readers);
    expect(ui.hintsShown).not.toContain('hint_room');
    tick = 3 * TICKS_PER_DAY;
    hints.onEvents(hour, readers);
    expect(ui.hintsShown).toContain('hint_room');
  });
});
