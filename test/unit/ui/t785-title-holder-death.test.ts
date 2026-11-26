/**
 * T-785: a title holder's death vacates its titles with the event, and the log says so: the death
 * line names the titles and an alert says they are vacant and how to fill them
 * (`reports/data/2026-11-26-playtest-7.md`, finding 2).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { GameEvent } from '@core/events';
import type { EntityId } from '@core/types';
import type { DwarvesReader } from '@systems/dwarves';
import { AnnouncementLog, lineText } from '@ui/announcements';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const Z = FLAT_TEST_SURFACE_Z;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

/** Kill a dwarf by a blow from nowhere ("has died of wounds"). */
function kill(w: TestWorld, id: EntityId): void {
  w.game.world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'edge', amount: 999 });
  w.step(5);
}

describe('T-785 a title holder dies', () => {
  it('10 vacates every title the dead dwarf held, with the event', () => {
    const w = world('t785-vacate');
    const thane = w.spawnDwarf({ at: w.index(20, 20, Z), name: 'Jorund Saltvein' });
    const other = w.spawnDwarf({ at: w.index(24, 20, Z) });
    w.submit({ type: 'AssignTitle', dwarfId: thane, title: 'thane' });
    w.submit({ type: 'AssignTitle', dwarfId: thane, title: 'broker' });
    w.submit({ type: 'AssignTitle', dwarfId: other, title: 'warden' });
    w.step(1);
    const before = w.events('TitleAssigned').length;
    kill(w, thane);
    expect(w.game.world.entities.alive(thane)).toBe(false);
    const vacated = w.events('TitleAssigned').slice(before);
    expect(vacated.map((e) => [e['dwarfId'], e['title'], e['previousId']])).toEqual([[0, 'thane', thane], [0, 'broker', thane]]);
    const dwarves = w.readers.of<DwarvesReader>('10');
    expect(dwarves.holder('thane')).toBe(0);
    expect(dwarves.holder('broker')).toBe(0);
    expect(dwarves.holder('warden')).toBe(other);
  });

  it('the death line names the titles, and one alert says they are vacant and how to fill them', () => {
    const w = world('t785-lines');
    const log = announcer(w);
    const thane = w.spawnDwarf({ at: w.index(20, 20, Z), name: 'Jorund Saltvein' });
    w.submit({ type: 'AssignTitle', dwarfId: thane, title: 'thane' });
    w.submit({ type: 'AssignTitle', dwarfId: thane, title: 'broker' });
    w.step(1);
    const from = w.allEvents().length;
    kill(w, thane);
    const events = w.allEvents().slice(from).filter((e) => e.type === 'CreatureDied' || e.type === 'TitleAssigned');
    const said = events.map((e) => log.announce(e as GameEvent, w.readers, w.tick));
    // The death, then the first title's alert; the second title changes both lines in place.
    expect(said.map((d) => d?.severity ?? null)).toEqual(['danger', 'alert', null]);
    const texts = log.lines.map((l) => lineText(l, strings));
    expect(texts).toEqual([
      '!! Jorund Saltvein, Thane and Broker, has died of wounds.',
      '! Jorund Saltvein was the Thane and the Broker. The titles are vacant: [u] [t] names others.',
    ]);
    expect(log.lines[1]?.key).toBe('announce.title_vacated_died_many');
    expect(log.lines[1]?.focus).toBe(log.lines[0]?.focus);
  });

  it('one title reads in the singular; a vacate by command stays the note it was', () => {
    const w = world('t785-one');
    const log = announcer(w);
    const thane = w.spawnDwarf({ at: w.index(20, 20, Z), name: 'Liv Bronzestair' });
    const medic = w.spawnDwarf({ at: w.index(24, 20, Z), name: 'Ketil Ironvein' });
    w.submit({ type: 'AssignTitle', dwarfId: thane, title: 'warden' });
    w.submit({ type: 'AssignTitle', dwarfId: medic, title: 'chief_medic' });
    w.step(1);
    const from = w.allEvents().length;
    w.submit({ type: 'AssignTitle', dwarfId: 0, title: 'chief_medic' });
    w.step(1);
    kill(w, thane);
    for (const e of w.allEvents().slice(from)) {
      if (e.type === 'CreatureDied' || e.type === 'TitleAssigned') log.announce(e as GameEvent, w.readers, w.tick);
    }
    expect(log.lines.map((l) => lineText(l, strings))).toEqual([
      'Ketil Ironvein is no longer the Chief medic.',
      '!! Liv Bronzestair, Warden, has died of wounds.',
      '! Liv Bronzestair was the Warden. The title is vacant: [u] [t] names another.',
    ]);
  });
});
