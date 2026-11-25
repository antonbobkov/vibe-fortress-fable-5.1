/**
 * T-734: a raid's danger line says what the alert does while it is Calm, with the player's keys,
 * and names the squads while none with members is Active (playtest 2026-11-25, finding 1).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { GameEvent } from '@core/events';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat';
import { AnnouncementLog } from '@ui/announcements';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const RAID = 'A Gloam raid has come from the north!';
const ALERT_TAIL = 'The alert is Calm: [m] [3] sends the civilians to shelter.';
const SQUADS_TAIL = 'The alert is Calm: [m] [3] sends the civilians to shelter; Active [v] sends the squads.';
const NO_SQUAD_TAIL = 'The alert is Calm: [m] [3] sends the civilians to shelter; [m] [+] makes a squad.';

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
