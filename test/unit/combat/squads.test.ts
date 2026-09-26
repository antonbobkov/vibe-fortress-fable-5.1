/**
 * Unit tests for squads, duty, orders, and alerts: T-M6-05.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z, HeadlessGame } from '@app/headless';
import { C } from '@core/components';
import { SQUAD_MAX_COUNT, SQUAD_MAX_SIZE, TICKS_PER_YEAR } from '@core/constants';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import { dwarfComponents } from '@systems/dwarves/rules/components';
import { makeDwarf } from '@systems/dwarves/rules/make-dwarf';

function spawnAdultDwarf(game: HeadlessGame, at: number): number {
  const record = makeDwarf(game.world.rngFor('testworld'), game.registry);
  record.ageYears = 25;
  return game.world.services.spawn.creature(
    game.registry.table('creatures').index('dwarf'),
    at,
    'fortress',
    {
      name: record.name,
      ageTicks: record.ageYears * TICKS_PER_YEAR,
      child: false,
      dwarf: dwarfComponents(record, game.registry, game.world.rngFor('10'), 'none'),
    },
  );
}

describe('T-M6-05: Squads, orders, duty, stations, patrols, alerts', () => {
  it('T-M6-05: SQUAD_MAX_COUNT and SQUAD_MAX_SIZE limits', () => {
    const game = new HeadlessGame({ seed: 'squad-limits', world: 'flat-test', embark: 'none' });
    const entities = game.world.entities;
    const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);
    const dwarfIndex = game.registry.table('creatures').index('dwarf');

    // Reject empty squad name
    const emptyNameRes = game.world.applyCommand({ type: 'CreateSquad', name: '' });
    expect(emptyNameRes).toEqual({ ok: false, reason: 'bad_name' });

    // Create SQUAD_MAX_COUNT squads (6)
    for (let i = 0; i < SQUAD_MAX_COUNT; i++) {
      const res = game.world.applyCommand({ type: 'CreateSquad', name: `Squad ${i + 1}` });
      expect(res).toEqual({ ok: true });
    }

    // 7th squad rejected with squad_limit
    const overLimitRes = game.world.applyCommand({ type: 'CreateSquad', name: 'Squad 7' });
    expect(overLimitRes).toEqual({ ok: false, reason: 'squad_limit' });

    const combatReader = game.world.readers.of<CombatReader>('16');
    const squads = combatReader.squads();
    expect(squads.length).toBe(SQUAD_MAX_COUNT);
    const firstSquad = squads[0] as SquadWithId;

    // Spawn 8 adult dwarves and 1 child dwarf
    const adultIds: number[] = [];
    for (let i = 0; i < 8; i++) {
      adultIds.push(spawnAdultDwarf(game, at));
    }
    const childId = game.world.services.spawn.creature(dwarfIndex, at, 'fortress', {
      ageTicks: 5 * TICKS_PER_YEAR,
    });

    // Attempt to add child to squad
    const childRes = game.world.applyCommand({
      type: 'SetSquadMembers',
      squadId: firstSquad.id,
      members: [childId],
    });
    expect(childRes).toEqual({ ok: false, reason: 'not_adult' });

    // Attempt to add > SQUAD_MAX_SIZE members (7 members)
    const overSizeRes = game.world.applyCommand({
      type: 'SetSquadMembers',
      squadId: firstSquad.id,
      members: adultIds.slice(0, SQUAD_MAX_SIZE + 1),
    });
    expect(overSizeRes).toEqual({ ok: false, reason: 'member_limit' });

    // Successfully add SQUAD_MAX_SIZE (6) members
    const validMembers = adultIds.slice(0, SQUAD_MAX_SIZE);
    const setRes = game.world.applyCommand({
      type: 'SetSquadMembers',
      squadId: firstSquad.id,
      members: validMembers,
    });
    expect(setRes).toEqual({ ok: true });

    // Verify Soldier component added
    for (const id of validMembers) {
      expect(entities.has(id, C.Soldier)).toBe(true);
      expect(combatReader.squadOf(id)?.id).toBe(firstSquad.id);
    }

    // Attempt to add a member who is already in firstSquad to secondSquad
    const secondSquad = squads[1] as SquadWithId;
    const duplicateRes = game.world.applyCommand({
      type: 'SetSquadMembers',
      squadId: secondSquad.id,
      members: [validMembers[0]],
    });
    expect(duplicateRes).toEqual({ ok: false, reason: 'already_in_squad' });

    // Disband firstSquad
    const disbandRes = game.world.applyCommand({
      type: 'DisbandSquad',
      squadId: firstSquad.id,
    });
    expect(disbandRes).toEqual({ ok: true });
    expect(combatReader.squad(firstSquad.id)).toBeUndefined();
    // Members no longer have Soldier component
    for (const id of validMembers) {
      expect(entities.has(id, C.Soldier)).toBe(false);
    }
  });

  it('T-M6-05: leader default is the Warden', () => {
    const game = new HeadlessGame({ seed: 'squad-warden', world: 'flat-test', embark: 'none' });
    const entities = game.world.entities;
    const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);

    const dwarfWarden = spawnAdultDwarf(game, at);
    const dwarfRegular = spawnAdultDwarf(game, at);

    // Assign Warden title to dwarfWarden
    entities.add(dwarfWarden, C.Title, { title: 'warden' });

    // Create first squad: default leader is the Warden
    game.world.applyCommand({ type: 'CreateSquad', name: 'First Guard' });
    const combatReader = game.world.readers.of<CombatReader>('16');
    const squads = combatReader.squads();
    expect(squads.length).toBe(1);
    expect(squads[0]?.leaderId).toBe(dwarfWarden);

    // Create second squad: default leader is 0
    game.world.applyCommand({ type: 'CreateSquad', name: 'Second Guard' });
    const allSquads = combatReader.squads();
    expect(allSquads.length).toBe(2);
    expect(allSquads[1]?.leaderId).toBe(0);

    // Set leader of second squad
    const setLeaderRes = game.world.applyCommand({
      type: 'SetSquadLeader',
      squadId: allSquads[1]!.id,
      leaderId: dwarfRegular,
    });
    expect(setLeaderRes).toEqual({ ok: true });
    expect(combatReader.squad(allSquads[1]!.id)?.leaderId).toBe(dwarfRegular);
  });

  it('T-M6-05: mode transitions under alert', () => {
    const game = new HeadlessGame({ seed: 'squad-alerts', world: 'flat-test', embark: 'none' });
    const entities = game.world.entities;
    const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);

    const d1 = spawnAdultDwarf(game, at);
    const d2 = spawnAdultDwarf(game, at);
    const civDwarf = spawnAdultDwarf(game, at);

    // Create Squad in 'off' mode with d1
    game.world.applyCommand({ type: 'CreateSquad', name: 'Reserve Squad' });
    const combatReader = game.world.readers.of<CombatReader>('16');
    const squadOff = combatReader.squads()[0] as SquadWithId;
    game.world.applyCommand({
      type: 'SetSquadMembers',
      squadId: squadOff.id,
      members: [d1],
    });

    // Create Squad in 'active' mode with d2
    game.world.applyCommand({ type: 'CreateSquad', name: 'Active Squad' });
    const squadActive = combatReader.squads()[1] as SquadWithId;
    game.world.applyCommand({
      type: 'SetSquadMode',
      squadId: squadActive.id,
      mode: 'active',
    });
    game.world.applyCommand({
      type: 'SetSquadMembers',
      squadId: squadActive.id,
      members: [d2],
    });

    // Under alert 'calm':
    // d1 is in squadOff ('off' mode) -> onDuty is false
    // d2 is in squadActive ('active' mode) -> onDuty is true
    // civDwarf is not in any squad -> onDuty is false
    expect(combatReader.alert()).toBe('calm');
    expect(combatReader.onDuty(d1)).toBe(false);
    expect(combatReader.onDuty(d2)).toBe(true);
    expect(combatReader.onDuty(civDwarf)).toBe(false);

    // Switch alert to 'watchful'
    const alertWatchfulRes = game.world.applyCommand({ type: 'SetAlert', level: 'watchful' });
    expect(alertWatchfulRes).toEqual({ ok: true });
    expect(combatReader.alert()).toBe('watchful');
    // On watchful, every squad is treated as active!
    expect(combatReader.onDuty(d1)).toBe(true);
    expect(combatReader.onDuty(d2)).toBe(true);
    expect(combatReader.onDuty(civDwarf)).toBe(false);

    // Switch alert to 'hearth'
    const alertHearthRes = game.world.applyCommand({ type: 'SetAlert', level: 'hearth' });
    expect(alertHearthRes).toEqual({ ok: true });
    expect(combatReader.alert()).toBe('hearth');
    expect(game.world.fortress.alert).toBe('hearth');
    expect(combatReader.onDuty(d1)).toBe(true);
    expect(combatReader.onDuty(d2)).toBe(true);
    expect(combatReader.onDuty(civDwarf)).toBe(false);

    // Step a tick to verify civilian dwarf retreats
    game.step(1);
    const civBrain = entities.get(civDwarf, C.Brain);
    expect(civBrain?.behavior).toBe('retreat');

    // Switch alert back to 'calm'
    game.world.applyCommand({ type: 'SetAlert', level: 'calm' });
    expect(combatReader.alert()).toBe('calm');
    expect(game.world.fortress.alert).toBe('calm');
    expect(combatReader.onDuty(d1)).toBe(false);
    expect(combatReader.onDuty(d2)).toBe(true);
    expect(combatReader.onDuty(civDwarf)).toBe(false);
  });

  it('T-M6-05: order queue semantics', () => {
    const game = new HeadlessGame({ seed: 'squad-orders', world: 'flat-test', embark: 'none' });
    const entities = game.world.entities;
    const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);
    const stationTile = game.map.index(15, 15, FLAT_TEST_SURFACE_Z);
    const wolfIndex = game.registry.table('creatures').index('wolf');

    const soldier = spawnAdultDwarf(game, at);
    const targetCreature = game.world.services.spawn.creature(wolfIndex, at, 'wild');

    game.world.applyCommand({ type: 'CreateSquad', name: 'Vanguard' });
    const combatReader = game.world.readers.of<CombatReader>('16');
    const squad = combatReader.squads()[0] as SquadWithId;

    game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' });
    game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [soldier] });

    // Enqueue order 1: kill targetCreature
    const killRes = game.world.applyCommand({
      type: 'SquadOrder',
      squadId: squad.id,
      order: { kind: 'kill', targetId: targetCreature },
    });
    expect(killRes).toEqual({ ok: true });

    // Enqueue order 2: station at stationTile
    const stationRes = game.world.applyCommand({
      type: 'SquadOrder',
      squadId: squad.id,
      order: { kind: 'station', tile: stationTile },
    });
    expect(stationRes).toEqual({ ok: true });

    // Verify orders queue has 2 orders
    const sqObj = combatReader.squad(squad.id);
    expect(sqObj?.orders.length).toBe(2);
    expect(sqObj?.orders[0]?.kind).toBe('kill');
    expect(sqObj?.orders[1]?.kind).toBe('station');

    // Soldier has acquired kill target
    expect(combatReader.targetOf(soldier)).toBe(targetCreature);

    // Simulate target death
    entities.destroy(targetCreature);

    // Step simulation so squad cleans up completed kill order
    game.step(1);

    // Order 1 was pruned; Order 2 (station) is now active
    const sqAfter = combatReader.squad(squad.id);
    expect(sqAfter?.orders.length).toBe(1);
    expect(sqAfter?.orders[0]?.kind).toBe('station');

    // Cancel order
    const cancelRes = game.world.applyCommand({
      type: 'SquadOrder',
      squadId: squad.id,
      order: { kind: 'cancel' },
    });
    expect(cancelRes).toEqual({ ok: true });
    expect(combatReader.squad(squad.id)?.orders.length).toBe(0);
  });
});
