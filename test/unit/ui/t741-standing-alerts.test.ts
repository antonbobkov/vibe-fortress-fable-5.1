/**
 * T-741: a standing alert (food about to rot, a workshop waiting for an empty barrel, miasma, a
 * starving animal) that comes again on the next day folds into its line of the day before, marked
 * with the days in a row it has come; a day without it starts a new line. Danger lines and deaths
 * never fold, and a folded line neither flashes the strip nor pauses (24 § Announcements and the log).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { lastWords } from '@app/legend';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import { computeLayout } from '@render/cellbuffer';
import { AnnouncementLog, lineText, type LogLine } from '@ui/announcements';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState, fromSaved, toSaved, type SavedUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings } from './ui-fixture';

const Z = FLAT_TEST_SURFACE_Z;
const event = (fields: Record<string, unknown>): GameEvent => fields as unknown as GameEvent;
const at = (day: number, hour = 2): number => day * TICKS_PER_DAY + hour * 50;
const barrel = (container = 'barrel'): GameEvent => event({ type: 'WorkshopBlocked', workshopId: 0, reason: 'no_empty_container', container });
const BARREL = '! A workshop is waiting for an empty barrel: every one holds something.';

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

/** The log through a save and a load, as the `ui` section carries it. */
function reloaded(lines: readonly LogLine[]): LogLine[] {
  const saved = JSON.parse(JSON.stringify(toSaved(defaultUiState(Z), lines))) as SavedUiState;
  return fromSaved(defaultUiState(Z), saved);
}

describe('T-741 a standing alert is one line while it comes day after day', () => {
  it('a workshop waiting for a barrel five days running is one line reading five days; after a day without it, a new line', () => {
    const w = world('t741-barrel');
    const log = announcer(w);
    const first = log.announce(barrel(), w.readers, at(10));
    expect(first?.folded).toBeUndefined();
    for (let day = 11; day < 15; day += 1) {
      // Another line between, so that the fold is seen to move the line to the newest place.
      log.append('note', `Note of day ${day}.`, at(day, 1));
      const again = log.announce(barrel(), w.readers, at(day));
      expect(again?.folded).toBe(true);
      expect(again?.line).toBe(first?.line);
    }
    const standing = log.lines.filter((l) => l.key === 'announce.workshop_no_container');
    expect(standing).toHaveLength(1);
    expect(log.lines.at(-1)).toBe(standing[0]);
    expect(standing[0]?.tick).toBe(at(14));
    expect(standing[0]?.days).toBe(5);
    expect(lineText(standing[0]!)).toBe(`${BARREL} (5 days)`);
    // A second one the same day merges as any line of a day does, and still reads five days.
    log.announce(barrel(), w.readers, at(14, 10));
    expect(log.lines.filter((l) => l.key === 'announce.workshop_no_container')).toHaveLength(1);
    expect(lineText(standing[0]!)).toBe(`${BARREL} (5 days)`);
    // Day 15 without it ends the run: day 16's starts a line of its own.
    const later = log.announce(barrel(), w.readers, at(16));
    expect(later?.folded).toBeUndefined();
    const lines = log.lines.filter((l) => l.key === 'announce.workshop_no_container');
    expect(lines.map((l) => lineText(l))).toEqual([`${BARREL} (5 days)`, BARREL]);
  });

  it('the rot alert five days running is one line with the fifth day\'s numbers; with the barrel alert on the same days, two lines', () => {
    const w = world('t741-rot');
    const log = announcer(w);
    for (let k = 0; k < 7; k += 1) w.spawnDwarf({ at: w.index(20 + k, 20, Z) });
    const meat = (x: number, n: number): number => {
      const tile = w.index(x, 10, Z);
      w.forceTemperature(tile, 20);
      const id = w.spawnItem('raw_meat', 'boar_meat', tile, n);
      w.submit({ type: 'ForbidItem', itemId: id, on: true });
      return id;
    };
    // Raw meat keeps 6 days. Stacks of 3 to 7 laid half a day apart enter the 3 days' window one by
    // one: each day's alert counts more, and names the newest stack as the largest.
    const stacks: number[] = [];
    for (let k = 0; k < 5; k += 1) {
      stacks.push(meat(10 + k, 3 + k));
      w.step(TICKS_PER_DAY / 2);
    }
    w.step(TICKS_PER_DAY / 2 + TICKS_PER_DAY / 4);
    const texts: string[] = [];
    for (let k = 0; k < 5; k += 1) {
      const day = 100 + k;
      const rot = log.rotAlert(w.readers, at(day));
      expect(rot?.folded).toBe(k === 0 ? undefined : true);
      texts.push(rot?.line.text ?? '');
      log.announce(barrel(), w.readers, at(day, 3));
      w.step(TICKS_PER_DAY / 2);
    }
    expect(texts[0]).toBe('3 food will rot within 3 days; the largest stack is 3 boar meat in the open.');
    const rot = log.lines.filter((l) => l.key === 'announce.rot_soon');
    const waits = log.lines.filter((l) => l.key === 'announce.workshop_no_container');
    expect(rot).toHaveLength(1);
    expect(waits).toHaveLength(1);
    expect(log.lines.filter((l) => l.severity === 'alert')).toHaveLength(2);
    // The fifth day's words, place and stack.
    expect(rot[0]?.text).toBe('25 food will rot within 3 days; the largest stack is 7 boar meat in the open.');
    expect(rot[0]?.subject).toBe(stacks[4]);
    expect(rot[0]?.focus).toBe(w.index(14, 10, Z));
    expect(lineText(rot[0]!)).toMatch(/ \(5 days\)$/);
    expect(lineText(waits[0]!)).toBe(`${BARREL} (5 days)`);
  });

  it('deaths and danger lines between them are never folded, and the standing line passes them', () => {
    const w = world('t741-deaths');
    const log = announcer(w);
    const asa = w.spawnDwarf({ at: w.index(10, 10, Z), name: 'Asa Forgehall' });
    const orm = w.spawnDwarf({ at: w.index(12, 10, Z), name: 'Orm Ashbrow' });
    log.announce(barrel(), w.readers, at(20));
    log.announce(event({ type: 'CreatureDied', id: asa, cause: 'starvation', species: 0, faction: 'fortress', name: 'Asa Forgehall', tile: w.index(10, 10, Z) }), w.readers, at(20, 5));
    log.announce(barrel(), w.readers, at(21));
    log.announce(event({ type: 'CreatureDied', id: orm, cause: 'starvation', species: 0, faction: 'fortress', name: 'Orm Ashbrow', tile: w.index(12, 10, Z) }), w.readers, at(21, 5));
    log.announce(barrel(), w.readers, at(22));
    const deaths = log.lines.filter((l) => l.key?.startsWith('announce.died.') === true);
    expect(deaths.map((l) => [l.severity, l.text, l.days])).toEqual([
      ['danger', 'Asa Forgehall has starved to death.', undefined],
      ['danger', 'Orm Ashbrow has starved to death.', undefined],
    ]);
    expect(log.lines.map((l) => lineText(l))).toEqual([
      '!! Asa Forgehall has starved to death.',
      '!! Orm Ashbrow has starved to death.',
      `${BARREL} (3 days)`,
    ]);
    // The legend counts the folded line's days, once, and keeps the deaths apart.
    expect(lastWords(log.lines, strings)).toEqual([`${BARREL} (3 days)`, '!! Orm Ashbrow has starved to death.', '!! Asa Forgehall has starved to death.']);
  });

  it('one condition folds with its own: two animals starving are two lines, a barrel and a bag are two lines', () => {
    const w = world('t741-animals');
    const log = announcer(w);
    const named = (name: string, x: number): number => {
      const id = w.spawnTame('cow', w.index(x, 10, Z));
      expect(w.game.world.applyCommand({ type: 'NameAnimal', animalId: id, name }).ok).toBe(true);
      return id;
    };
    const bramble = named('Bramble', 10);
    const rex = named('Rex', 12);
    for (let day = 30; day < 33; day += 1) {
      log.announce(event({ type: 'AnimalStarving', id: bramble }), w.readers, at(day));
      log.announce(event({ type: 'AnimalStarving', id: rex }), w.readers, at(day, 3));
      log.announce(barrel(), w.readers, at(day, 4));
      log.announce(barrel('bag'), w.readers, at(day, 5));
    }
    expect(log.lines.map((l) => lineText(l))).toEqual([
      '! Bramble is starving. (3 days)',
      '! Rex is starving. (3 days)',
      `${BARREL} (3 days)`,
      '! A workshop is waiting for an empty bag: every one holds something. (3 days)',
    ]);
    // Rex starving only every other day is a new line each time.
    log.announce(event({ type: 'AnimalStarving', id: rex }), w.readers, at(34));
    expect(log.lines.filter((l) => l.text === 'Rex is starving.').map((l) => l.days ?? 1)).toEqual([3, 1]);
  });

  it('an event alert of one key on the next day is a line of its own', () => {
    const w = world('t741-events');
    const log = announcer(w);
    log.announce(event({ type: 'CavernBreached', cavern: 1, tile: w.index(10, 10, Z) }), w.readers, at(40));
    log.announce(event({ type: 'CavernBreached', cavern: 2, tile: w.index(12, 10, Z) }), w.readers, at(41));
    expect(log.lines.map((l) => lineText(l))).toEqual(['! A cavern has been breached.', '! A cavern has been breached.']);
  });

  it('a save and a load keep the days, and the run goes on after the load', () => {
    const w = world('t741-save');
    const log = announcer(w);
    for (let day = 50; day < 53; day += 1) log.announce(barrel(), w.readers, at(day));
    expect(toSaved(defaultUiState(Z), log.lines).logTail.map((l) => l.days)).toEqual([3]);
    const loaded = announcer(w);
    loaded.lines.push(...reloaded(log.lines));
    expect(loaded.lines.map((l) => lineText(l))).toEqual([`${BARREL} (3 days)`]);
    loaded.announce(barrel(), w.readers, at(53));
    expect(loaded.lines.map((l) => lineText(l))).toEqual([`${BARREL} (4 days)`]);
    // A line of one day saves no days, and an older save's lines (none) are one day.
    expect(toSaved(defaultUiState(Z), [{ tick: 1, severity: 'alert', text: 'x', count: 1 }]).logTail[0]).not.toHaveProperty('days');
  });

  it('the strip flashes and pauses for the first day only', () => {
    const w = world('t741-flash');
    let paused = 0;
    const host: FortressHost = {
      readers: w.readers, registry: w.game.registry, ui: defaultUiState(Z), submit: (cmd) => w.submit(cmd),
      speed: () => 1, setSpeed: (n) => { if (n === 0) paused += 1; }, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
      layout: () => computeLayout(80, 42, true), precondition: () => true,
      registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
      now: () => 1000, confirm: (_id, _params, reply) => reply(true),
    };
    const f = new FortressScreen(host, keymap, strings);
    const flash = f as unknown as { flashUntil: number };
    f.settings.autoPauseAlert = true;
    const day = (): void => {
      flash.flashUntil = 0;
      f.onEvents([barrel()]);
    };
    day();
    expect(flash.flashUntil).toBeGreaterThan(0);
    expect(paused).toBe(1);
    w.step(TICKS_PER_DAY);
    day();
    expect(flash.flashUntil).toBe(0);
    expect(paused).toBe(1);
    const lines = f.log.lines.filter((l) => l.key === 'announce.workshop_no_container');
    expect(lines.map((l) => lineText(l))).toEqual([`${BARREL} (2 days)`]);
  });
});
