/**
 * T-734: a raid's danger line says what the alert does while it is Calm, with the player's keys,
 * and names the squads while none with members is Active; the alert hint shows again for a raid at
 * a Calm fortress, a season after it last showed (playtest 2026-11-25, finding 1).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { ReaderSet } from '@core/readers';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { CombatReader } from '@systems/combat';
import { AnnouncementLog } from '@ui/announcements';
import { HINT_ALERT_REPEAT_DAYS } from '@ui/constants';
import { HintEngine } from '@ui/hints';
import type { Speed } from '@ui/status';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState, fromSaved, toSaved } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const RAID = 'A Gloam raid has come from the north!';
const ALERT_TAIL = 'The alert is Calm: [m] [3] sends the civilians to shelter.';
const SQUADS_TAIL = 'The alert is Calm: [m] [3] sends the civilians to shelter; Active [v] sends the squads.';
const NO_SQUAD_TAIL = 'The alert is Calm: [m] [3] sends the civilians to shelter; [m] [+] makes a squad.';
const HINT = '☼ Click a door and choose Lock on alert.';

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ids: EntityId[] = [];
  for (let k = 0; k < 3; k += 1) ids.push(w.spawnDwarf({ at: w.index(10 + k, 10, z), name: `Dwarf${String(k).padStart(2, '0')} Stone` }));
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return { w, ids, log };
}

/** A squad of the given dwarves in the given mode. */
function squad(w: TestWorld, members: EntityId[], mode: 'off' | 'train' | 'active'): void {
  w.submit({ type: 'CreateSquad', name: 'The Gate Guard' });
  w.step(1);
  const squads = w.readers.of<CombatReader>('16').squads();
  const id = squads[squads.length - 1]!.id;
  if (members.length > 0) w.submit({ type: 'SetSquadMembers', squadId: id, members });
  w.submit({ type: 'SetSquadMode', squadId: id, mode });
  w.step(1);
}

function alert(w: TestWorld, level: 'calm' | 'watchful' | 'hearth'): void {
  w.submit({ type: 'SetAlert', level });
  w.step(1);
}

const raid = (partyId = 1): GameEvent => ({ type: 'RaidArrived', partyId, kind: 'raid', size: 17, tile: 0, edge: 'n' } as unknown as GameEvent);
const ambush = (partyId = 2): GameEvent => ({ type: 'AmbushSprung', partyId } as unknown as GameEvent);

/** The readers as they are, at another tick. */
function at(readers: ReaderSet, tick: number): ReaderSet {
  const calendar = Object.create(readers.calendar, { tick: { value: tick } }) as ReaderSet['calendar'];
  return Object.create(readers, { calendar: { value: calendar } }) as ReaderSet;
}

describe('T-734 a raid on a Calm fortress names the alert and its keys', () => {
  it('under Calm with every squad off, the line names the alert and the squads', () => {
    const { w, ids, log } = setup('t734-calm');
    squad(w, ids.slice(0, 2), 'off');
    const said = log.announce(raid(), w.readers, w.readers.calendar.tick);
    expect(said?.severity).toBe('danger');
    expect(said?.line.text).toBe(`${RAID} ${SQUADS_TAIL}`);
    // The line keeps the key of its first sentence.
    expect(said?.line.key).toBe('announce.raid_arrived.raid');
  });

  it('under Hearth with a squad Active, the line reads as before', () => {
    const { w, ids, log } = setup('t734-hearth');
    squad(w, ids.slice(0, 2), 'active');
    alert(w, 'hearth');
    expect(log.announce(raid(), w.readers, w.readers.calendar.tick)?.line.text).toBe(RAID);
  });

  it('under Watch, with every squad off, the line is plain too (every squad stands to)', () => {
    const { w, ids, log } = setup('t734-watch');
    squad(w, ids.slice(0, 2), 'off');
    alert(w, 'watchful');
    expect(log.announce(raid(), w.readers, w.readers.calendar.tick)?.line.text).toBe(RAID);
  });

  it('an ambush sprung under Calm with an Active squad gives only the alert tail', () => {
    const { w, ids, log } = setup('t734-ambush');
    squad(w, ids.slice(0, 2), 'active');
    expect(log.announce(ambush(), w.readers, w.readers.calendar.tick)?.line.text).toBe(`An ambush has been sprung! ${ALERT_TAIL}`);
  });

  it('with no squad, or none with members, the tail says [+] makes one', () => {
    const { w, log } = setup('t734-nosquad');
    expect(log.announce(raid(1), w.readers, 10)?.line.text).toBe(`${RAID} ${NO_SQUAD_TAIL}`);
    squad(w, [], 'active');
    expect(log.announce(raid(3), w.readers, 5000)?.line.text).toBe(`${RAID} ${NO_SQUAD_TAIL}`);
  });

  it('a squad on Train is not Active: the squads tail', () => {
    const { w, ids, log } = setup('t734-train');
    squad(w, ids.slice(0, 1), 'train');
    expect(log.announce(raid(), w.readers, w.readers.calendar.tick)?.line.text).toBe(`${RAID} ${SQUADS_TAIL}`);
  });

  it('a thief is not announced, and bandits and a siege take the tail', () => {
    const { w, log } = setup('t734-kinds');
    const arrived = (kind: string, tick: number) =>
      log.announce({ type: 'RaidArrived', partyId: tick, kind, size: 5, tile: 0, edge: 'w' } as unknown as GameEvent, w.readers, tick);
    expect(arrived('bandits', 10)?.line.text).toBe(`Hillfolk bandits have come from the west! ${NO_SQUAD_TAIL}`);
    expect(arrived('siege', 5000)?.line.text).toBe(`A Gloam siege has come from the west! ${NO_SQUAD_TAIL}`);
    expect(arrived('thief', 10000)).toBeNull();
  });
});

describe('T-734 the alert hint shows again for a raid at a Calm fortress', () => {
  /** How many times the hint was said (two on one day merge into one line with a count). */
  const hintLines = (log: AnnouncementLog): number => log.lines.filter((l) => l.text.startsWith(HINT)).reduce((n, l) => n + l.count, 0);

  it('after the warning, the raid next day does not repeat it; a raid a season later on Calm does', () => {
    const { w, log } = setup('t734-hint');
    const ui = defaultUiState(z);
    const hints = new HintEngine(w.game.registry, ui, log);
    const t0 = w.readers.calendar.tick;
    hints.onEvents([{ type: 'ThreatWarning', kind: 'raid', civ: 'gloam', sizeBand: 'a band', edge: 'n' } as unknown as GameEvent, { type: 'HourPassed', hour: 0 } as unknown as GameEvent], w.readers);
    expect(hintLines(log)).toBe(1);
    expect(ui.hintAlertTick).toBe(t0);
    hints.onEvents([raid(1)], at(w.readers, t0 + TICKS_PER_DAY));
    expect(hintLines(log)).toBe(1);
    const later = t0 + HINT_ALERT_REPEAT_DAYS * TICKS_PER_DAY;
    hints.onEvents([raid(2)], at(w.readers, later));
    expect(hintLines(log)).toBe(2);
    expect(ui.hintAlertTick).toBe(later);
    expect(ui.hintsShown.filter((id) => id === 'hint_alert')).toHaveLength(1);
    // An ambush the same season does not repeat it again.
    hints.onEvents([ambush(3)], at(w.readers, later + 5 * TICKS_PER_DAY));
    expect(hintLines(log)).toBe(2);
  });

  it('does not repeat under Hearth, nor for a thief', () => {
    const { w, log } = setup('t734-hint-hearth');
    const ui = defaultUiState(z);
    const hints = new HintEngine(w.game.registry, ui, log);
    ui.hintsShown = ['hint_alert'];
    ui.hintAlertTick = 0;
    const later = (HINT_ALERT_REPEAT_DAYS + 1) * TICKS_PER_DAY;
    hints.onEvents([{ type: 'RaidArrived', partyId: 1, kind: 'thief', size: 1, tile: 0, edge: 'n' } as unknown as GameEvent], at(w.readers, later));
    expect(hintLines(log)).toBe(0);
    alert(w, 'hearth');
    hints.onEvents([raid(2)], at(w.readers, later));
    expect(hintLines(log)).toBe(0);
  });

  it('a first raid with no warning before it shows it; a save of before the tick was kept shows it at the next raid', () => {
    const { w, log } = setup('t734-hint-first');
    const ui = defaultUiState(z);
    const hints = new HintEngine(w.game.registry, ui, log);
    hints.onEvents([ambush(1)], w.readers);
    expect(hintLines(log)).toBe(1);
    // An older save: the hint shown, its tick not known.
    const old = defaultUiState(z);
    old.hintsShown = ['hint_alert'];
    const loaded = defaultUiState(z);
    fromSaved(loaded, toSaved(old, []));
    expect(loaded.hintAlertTick).toBe(-1);
    const again = new HintEngine(w.game.registry, loaded, log);
    again.onEvents([raid(2)], w.readers);
    expect(hintLines(log)).toBe(2);
    // The tick is saved.
    const restored = defaultUiState(z);
    fromSaved(restored, toSaved(loaded, []));
    expect(restored.hintAlertTick).toBe(loaded.hintAlertTick);
    expect(restored.hintAlertTick).toBeGreaterThanOrEqual(0);
  });

  it('on the fortress screen the danger line is pinned with its tail and the hint follows it', () => {
    const { w } = setup('t734-screen');
    const layout = computeLayout(80, 42, true);
    const state = { speed: 1 as Speed };
    const host: FortressHost = {
      readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c),
      speed: () => state.speed, setSpeed: (s) => { state.speed = s; },
      pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
      registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
      prompt: () => {}, laborManager: () => {},
    };
    const screen = new FortressScreen(host, keymap, strings);
    screen.onEvents([raid()]);
    const texts = screen.log.lines.map((l) => l.text);
    const danger = texts.indexOf(`${RAID} ${NO_SQUAD_TAIL}`);
    expect(danger).toBeGreaterThanOrEqual(0);
    expect(texts.findIndex((t) => t.startsWith(HINT))).toBeGreaterThan(danger);
    expect(state.speed).toBe(0);
    // The strip keeps the pinned danger line in view: the long hint wraps under it, not over it.
    const s = surface(80, 42);
    screen.draw(s);
    const strip = s.lines().slice(layout.log.row, layout.log.row + layout.log.rows);
    expect(strip.some((row) => row.includes('!! A Gloam raid has come from the north!'))).toBe(true);
    expect(strip.some((row) => row.includes('☼ Click a door'))).toBe(true);
  });
});
