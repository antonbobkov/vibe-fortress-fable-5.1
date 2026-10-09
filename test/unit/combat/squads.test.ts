/**
 * Unit tests for squads, duty, orders, and alerts: T-M6-05.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z, HeadlessGame } from '@app/headless';
import { C, ItemFlag } from '@core/components';
import { SQUAD_MAX_COUNT, SQUAD_MAX_SIZE, TICKS_PER_YEAR } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { BuildingsSystem } from '@systems/buildings';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import { dwarfComponents } from '@systems/dwarves/rules/components';
import { makeDwarf } from '@systems/dwarves/rules/make-dwarf';
import { TestWorld } from '../../scenarios/test-world';

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

    // T-175: a leader must first belong to the squad.
    expect(game.world.applyCommand({ type: 'SetSquadMembers', squadId: allSquads[1]!.id, members: [dwarfRegular] })).toEqual({ ok: true });
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
    const w = new TestWorld({ seed: 'squad-alerts', world: 'flat-test', embark: 'none' });
    const game = w.game;
    // F-16: the retreat assertion requires an actual reachable shelter.
    w.build('hearth', w.index(12, 10, FLAT_TEST_SURFACE_Z), 'granite');
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

  describe('T-M6-06: Training and equipment', () => {
    it('best-item selection by metalTier * qualityMult', () => {
      const game = new HeadlessGame({ seed: 'equip-best', world: 'flat-test', embark: 'none' });
      const entities = game.world.entities;
      const registry = game.registry;
      const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);

      const itemsTable = registry.table('items');
      const materialsTable = registry.table('materials');
      const axeType = itemsTable.index('axe');
      const copperMat = materialsTable.index('copper'); // tier 1
      const ironMat = materialsTable.index('iron');     // tier 2
      const steelMat = materialsTable.index('steel');   // tier 3

      // Spawn axes of different metal tiers and qualities
      game.world.services.spawn.item(axeType, copperMat, at, 1, 1); // 1 * 1.0 = 1.0
      game.world.services.spawn.item(axeType, ironMat, at, 1, 1);     // 2 * 1.0 = 2.0
      const steelAxe = game.world.services.spawn.item(axeType, steelMat, at, 1, 1);   // 3 * 1.0 = 3.0

      const soldier = spawnAdultDwarf(game, at);
      // T-161: isolate weapon ranking/shield exclusion from civilian tool demand.
      for (const labor of ['mining', 'woodcutting']) {
        expect(game.world.applyCommand({ type: 'SetLabor', dwarfId: soldier, labor, on: false })).toEqual({ ok: true });
      }
      game.world.applyCommand({ type: 'CreateSquad', name: 'Elite Guard' });
      const combatReader = game.world.readers.of<CombatReader>('16');
      const squad = combatReader.squads()[0] as SquadWithId;

      game.world.applyCommand({
        type: 'SetSquadEquipment',
        squadId: squad.id,
        equipment: { weaponClass: 'axe' },
      });

      // Adding member triggers reequip
      game.world.applyCommand({
        type: 'SetSquadMembers',
        squadId: squad.id,
        members: [soldier],
      });

      const equip = entities.get(soldier, C.Equipment);
      // Steel axe (highest metalTier * qualityMult) should be claimed
      expect(equip?.weapon).toBe(steelAxe);

      // Now spawn an exceptional iron axe (tier 2 * 1.35 = 2.7) and masterwork steel axe (tier 3 * 1.5 = 4.5)
      const mwSteelAxe = game.world.services.spawn.item(axeType, steelMat, at, 1, 5);
      game.step(1); // Triggers re-equip on ItemCreated

      const equipAfter = entities.get(soldier, C.Equipment);
      expect(equipAfter?.weapon).toBe(mwSteelAxe);
    });

    it('two-handed/shield exclusion', () => {
      const game = new HeadlessGame({ seed: 'two-handed-shield', world: 'flat-test', embark: 'none' });
      const entities = game.world.entities;
      const registry = game.registry;
      const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);

      const itemsTable = registry.table('items');
      const materialsTable = registry.table('materials');
      const iron = materialsTable.index('iron');

      const bucklerType = itemsTable.index('buckler');
      const oneHandedAxeType = itemsTable.index('axe');       // hands = 1
      const twoHandedMaulType = itemsTable.index('maul');     // hands = 2

      const buckler = game.world.services.spawn.item(bucklerType, iron, at, 1, 1);
      const maul = game.world.services.spawn.item(twoHandedMaulType, iron, at, 1, 1);

      const soldier = spawnAdultDwarf(game, at);
      // T-161: isolate weapon ranking/shield exclusion from civilian tool demand.
      for (const labor of ['mining', 'woodcutting']) {
        expect(game.world.applyCommand({ type: 'SetLabor', dwarfId: soldier, labor, on: false })).toEqual({ ok: true });
      }
      game.world.applyCommand({ type: 'CreateSquad', name: 'Hammer Squad' });
      const combatReader = game.world.readers.of<CombatReader>('16');
      const squad = combatReader.squads()[0] as SquadWithId;

      // Equip two-handed maul
      game.world.applyCommand({
        type: 'SetSquadEquipment',
        squadId: squad.id,
        equipment: { weaponClass: 'hammer' },
      });
      game.world.applyCommand({
        type: 'SetSquadMembers',
        squadId: squad.id,
        members: [soldier],
      });

      const equip = entities.get(soldier, C.Equipment);
      expect(equip?.weapon).toBe(maul);
      // Two-handed weapon excludes shield
      expect(equip?.shield).toBe(0);

      // Now switch squad preference to one-handed axe
      const oneHandedAxe = game.world.services.spawn.item(oneHandedAxeType, iron, at, 1, 5); // masterwork so it replaces maul
      game.world.applyCommand({
        type: 'SetSquadEquipment',
        squadId: squad.id,
        equipment: { weaponClass: 'axe' },
      });

      const equipAfter = entities.get(soldier, C.Equipment);
      expect(equipAfter?.weapon).toBe(oneHandedAxe);
      // One-handed weapon allows shield claiming!
      expect(equipAfter?.shield).toBe(buckler);
    });

    it('speed penalty floor: clamped at ARMOR_MIN_SPEED_PERCENT (60)', () => {
      const game = new HeadlessGame({ seed: 'armor-speed', world: 'flat-test', embark: 'none' });
      const entities = game.world.entities;
      const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);
      const soldier = spawnAdultDwarf(game, at);

      const itemsTable = game.registry.table('items');
      const materialsTable = game.registry.table('materials');
      const iron = materialsTable.index('iron');

      // Create heavy armor pieces: breastplate (16), greaves (10), helm (6), boots (4), gauntlets (4)
      // Total weight: 16 + 10 + 6 + 4 + 4 = 40.
      // To test the floor of 60%, total weight must exceed 160 (160 / 4 = 40% penalty -> 60% speed).
      // We can create multiple heavy pieces or high weight pieces
      const bp = game.world.services.spawn.item(itemsTable.index('breastplate'), iron, at, 1, 1);
      const greaves = game.world.services.spawn.item(itemsTable.index('greaves'), iron, at, 1, 1);
      const helm = game.world.services.spawn.item(itemsTable.index('helm'), iron, at, 1, 1);
      const boots = game.world.services.spawn.item(itemsTable.index('metal_boots'), iron, at, 1, 1);
      const gauntlets = game.world.services.spawn.item(itemsTable.index('gauntlets'), iron, at, 1, 1);

      entities.add(soldier, C.Equipment, {
        weapon: 0,
        shield: 0,
        armor: { head: helm, body: bp, arms: gauntlets, legs: greaves, feet: boots },
        clothing: { body: 0, legs: 0, feet: 0, over: 0 },
        quiver: 0,
      });

      const skillsTable = game.registry.table('skills');
      const armorUseIdx = skillsTable.index('armor_use');
      const skills = entities.get(soldier, C.Skills);
      if (skills) {
        skills.level[armorUseIdx] = 0;
      }

      const combatReader = game.world.readers.of<CombatReader>('16');
      // Weight 40 -> 40 / 4 = 10% penalty -> 90%
      expect(combatReader.armorSpeedModifier(soldier)).toBe(90);

      // Now set item weight heavily on breastplate so total weight is 200 (176 + 24 = 200)
      interface ModifiableArmorTable {
        byId(id: string): { id: string; weight: number } | undefined;
        byIdMap: Map<string, { id: string; weight: number }>;
        indexMap: Map<string, number>;
        rows: { id: string; weight: number }[];
      }
      const armorTable = game.registry.table<{ id: string; weight: number }>('armor') as unknown as ModifiableArmorTable;
      const bpDef = armorTable.byId('breastplate');
      if (!bpDef) throw new Error('breastplate not found');
      const heavyBpDef = { ...bpDef, weight: 176 };
      armorTable.byIdMap.set('breastplate', heavyBpDef);
      const bpIdx = armorTable.indexMap.get('breastplate');
      if (bpIdx !== undefined) armorTable.rows[bpIdx] = heavyBpDef;

      // 200 / 4 = 50% penalty -> 100 - 50 = 50% < 60% floor -> clamped to 60!
      expect(combatReader.armorSpeedModifier(soldier)).toBe(60);

      // With armor_use skill 20: penalty = 50 - 20 = 30 -> 100 - 30 = 70 > 60
      if (skills) {
        skills.level[armorUseIdx] = 20;
      }
      expect(combatReader.armorSpeedModifier(soldier)).toBe(70);

      // Restore original
      armorTable.byIdMap.set('breastplate', bpDef);
      if (bpIdx !== undefined) armorTable.rows[bpIdx] = bpDef;
    });

    it('archery bolts recovered by hauling', () => {
      const game = new HeadlessGame({ seed: 'archery-recover', world: 'flat-test', embark: 'none' });
      const entities = game.world.entities;
      const registry = game.registry;
      const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);

      // Setup barracks zone
      const barracksTiles = [at, at + 1, at + 2];
      game.world.applyCommand({
        type: 'CreateZone',
        zoneType: 'barracks',
        tiles: barracksTiles,
      });
      const buildingsReader = game.world.readers.of<BuildingsReader>('14');
      const bZones = buildingsReader.zonesOfType('barracks');
      const barracksZoneId = bZones[0] as number;

      // Build archery target in barracks
      const oak = registry.table('materials').index('oak');
      game.world.applyCommand({
        type: 'PlaceBuilding',
        buildingType: 'archery_target',
        origin: at + 2,
        orientation: 0,
        materialChoice: 'oak',
      });
      const bSystem = game.world.scheduler.byId('14') as BuildingsSystem;
      bSystem.completeNow(bSystem.lastPlacedBuilding, oak, 0);

      // Spawn ranged soldier with crossbow and bolts
      const soldier = spawnAdultDwarf(game, at);
      const itemsTable = registry.table('items');
      const materialsTable = registry.table('materials');
      const iron = materialsTable.index('iron');

      const xbowType = itemsTable.index('crossbow');
      const boltType = itemsTable.index('bolt');
      const quiverType = itemsTable.index('quiver');

      const xbow = game.world.services.spawn.item(xbowType, oak, at, 1, 1);
      const quiver = game.world.services.spawn.item(quiverType, materialsTable.index('leather'), at, 1, 1);
      const bolts = game.world.services.spawn.item(boltType, iron, at, 25, 1);

      entities.add(soldier, C.Equipment, {
        weapon: xbow,
        shield: 0,
        armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
        clothing: { body: 0, legs: 0, feet: 0, over: 0 },
        quiver,
      });

      const boltItem = entities.get(bolts, C.Item)!;
      boltItem.carriedBy = soldier;
      boltItem.containerId = quiver;
      boltItem.flags |= ItemFlag.Owned;
      boltItem.ownerId = soldier;

      game.world.applyCommand({ type: 'CreateSquad', name: 'Archers' });
      const combatReader = game.world.readers.of<CombatReader>('16');
      const squad = combatReader.squads()[0] as SquadWithId;

      game.world.applyCommand({
        type: 'SetSquadMembers',
        squadId: squad.id,
        members: [soldier],
      });
      game.world.applyCommand({
        type: 'SetSquadMode',
        squadId: squad.id,
        mode: 'train',
      });
      const squadComp = entities.get(squad.id, C.Squad);
      if (squadComp) squadComp.barracksZoneId = barracksZoneId;

      // Step simulation for a training session (300 ticks)
      game.step(305);

      // Verify that bolts were shot at archery target and dropped unowned for hauling
      let unownedBoltsCount = 0;
      for (const itId of entities.with(C.Item)) {
        if (itId === bolts) continue;
        const it = entities.get(itId, C.Item);
        if (it && it.type === boltType && (it.flags & ItemFlag.Owned) === 0 && it.ownerId === 0) {
          unownedBoltsCount += it.count;
        }
      }
      expect(unownedBoltsCount).toBeGreaterThan(0);
    });
  });
});
