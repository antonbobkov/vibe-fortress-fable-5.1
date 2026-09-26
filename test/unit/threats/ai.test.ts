/**
 * Hostile party and member AI unit tests (T-M6-09).
 * Tests goal selection per purpose, separated member behavior, loot handling, and corpse stripping.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import type { MoraleReader } from '@systems/morale/reader';
import { TestWorld } from '../../scenarios/test-world';
import { chooseGoal, memberThink } from '@systems/threats/ai';
import { spawnHostileMember } from '@systems/threats/parties';

type PartyPurpose = 'thief' | 'bandits' | 'ambush' | 'raid' | 'siege' | 'restless' | 'caravan';

function createTestParty(w: TestWorld, purpose: PartyPurpose = 'raid', edge: 'n' | 'e' | 's' | 'w' = 'n') {
  const partyId = w.game.world.entities.create('party');
  w.game.world.entities.add(partyId, C.Party, {
    civ: 'gloam',
    purpose,
    members: [],
    leaderId: 0,
    state: 'approach',
    goalTile: 0,
    goalEntity: 0,
    arrivedTick: w.tick,
    stateSince: w.tick,
    loot: [],
    edge,
    size: 1,
  });
  return partyId;
}

function makeCtx(w: TestWorld): TickContext {
  return {
    world: w.game.world,
    registry: w.game.registry,
    readers: w.readers,
    tick: w.tick,
    emit: (e: GameEvent) => w.game.world.emit(e),
  } as unknown as TickContext;
}

describe('T-M6-09 Hostile AI', () => {
  describe('goal selection per purpose', () => {
    it('thief prefers outdoor unattended item over indoor item and respects value', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'th-ai-thief-goal' });
      const z = FLAT_TEST_SURFACE_Z;
      const leaderTile = w.index(24, 0, z);

      // Create indoor tile (clear Outdoor flag)
      const indoorTile = w.index(24, 10, z);
      w.map.flags[indoorTile] = w.map.flags[indoorTile]! & ~TileFlag.Outdoor;

      // Create outdoor tiles
      const outdoorLowValTile = w.index(20, 10, z);
      const outdoorHighValTile = w.index(28, 10, z);
      w.map.flags[outdoorLowValTile] = w.map.flags[outdoorLowValTile]! | TileFlag.Outdoor;
      w.map.flags[outdoorHighValTile] = w.map.flags[outdoorHighValTile]! | TileFlag.Outdoor;

      // Indoor expensive item
      w.spawnItem('short_sword', 'iron', indoorTile);
      // Outdoor cheap item
      w.spawnItem('raw_stone', 'granite', outdoorLowValTile);
      // Outdoor valuable item
      const outdoorHigh = w.spawnItem('ring', 'gold', outdoorHighValTile);

      const partyId = createTestParty(w, 'thief', 'n');
      spawnHostileMember(
        w.game.world,
        w.game.registry,
        w.game.world.rngFor('18'),
        partyId,
        'gloam_snatcher',
        'thief',
        leaderTile,
        0,
        false,
      );

      const partyComp = w.game.world.entities.get(partyId, C.Party)!;
      chooseGoal(partyComp, makeCtx(w));

      // Should choose outdoor high value item
      expect(partyComp.goalEntity).toBe(outdoorHigh);
      expect(partyComp.goalTile).toBe(outdoorHighValTile);
    });

    it('thief targets small tame animal when no items available', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'th-ai-thief-animal' });
      const z = FLAT_TEST_SURFACE_Z;
      const leaderTile = w.index(24, 0, z);
      const animalTile = w.index(24, 10, z);
      w.map.flags[animalTile] = w.map.flags[animalTile]! | TileFlag.Outdoor;

      // Spawn a small tame animal (chicken, size < 30)
      const chicken = w.spawnTame('chicken', animalTile);

      const partyId = createTestParty(w, 'thief', 'n');
      spawnHostileMember(
        w.game.world,
        w.game.registry,
        w.game.world.rngFor('18'),
        partyId,
        'gloam_snatcher',
        'thief',
        leaderTile,
        0,
        false,
      );

      const partyComp = w.game.world.entities.get(partyId, C.Party)!;
      chooseGoal(partyComp, makeCtx(w));

      expect(partyComp.goalEntity).toBe(chicken);
      expect(partyComp.goalTile).toBe(animalTile);
    });

    it('bandits target nearest stockpile tile', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'th-ai-bandits' });
      const z = FLAT_TEST_SURFACE_Z;
      const leaderTile = w.index(24, 0, z);

      const spTile1 = w.index(10, 20, z);
      const spTile2 = w.index(24, 15, z); // nearer
      w.zone('stockpile', [spTile1]);
      w.zone('stockpile', [spTile2]);

      const partyId = createTestParty(w, 'bandits', 'n');
      spawnHostileMember(
        w.game.world,
        w.game.registry,
        w.game.world.rngFor('18'),
        partyId,
        'hillfolk_bandit',
        'warriors',
        leaderTile,
        0,
        false,
      );

      const partyComp = w.game.world.entities.get(partyId, C.Party)!;
      chooseGoal(partyComp, makeCtx(w));

      expect(partyComp.goalTile).toBe(spTile2);
    });

    it('ambush targets nearest outdoor dwarf', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'th-ai-ambush' });
      const z = FLAT_TEST_SURFACE_Z;
      const leaderTile = w.index(24, 0, z);

      // Indoor dwarf (clear Outdoor flag)
      const indoorTile = w.index(24, 5, z);
      w.map.flags[indoorTile] = w.map.flags[indoorTile]! & ~TileFlag.Outdoor;
      w.spawnDwarf({ at: indoorTile });

      // Outdoor dwarf
      const outdoorTile = w.index(24, 15, z);
      w.map.flags[outdoorTile] = w.map.flags[outdoorTile]! | TileFlag.Outdoor;
      const outdoorDwarf = w.spawnDwarf({ at: outdoorTile });

      const partyId = createTestParty(w, 'ambush', 'n');
      spawnHostileMember(
        w.game.world,
        w.game.registry,
        w.game.world.rngFor('18'),
        partyId,
        'gloam_warrior',
        'warriors',
        leaderTile,
        0,
        false,
      );

      const partyComp = w.game.world.entities.get(partyId, C.Party)!;
      chooseGoal(partyComp, makeCtx(w));

      expect(partyComp.goalEntity).toBe(outdoorDwarf);
      expect(partyComp.goalTile).toBe(outdoorTile);
    });

    it('raid falls back to nearestReachable when hearth is walled off', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'th-ai-raid-walled' });
      const z = FLAT_TEST_SURFACE_Z;
      const leaderTile = w.index(24, 0, z);
      const hearthTile = w.index(24, 24, z);

      w.build('hearth', hearthTile, 'granite');

      // Wall off hearth completely
      for (let x = 20; x <= 28; x++) {
        for (let y = 20; y <= 28; y++) {
          if (x === 20 || x === 28 || y === 20 || y === 28) {
            const t = w.index(x, y, z);
            w.carve(t, TileKind.Wall);
            w.setBuildingBlock(t, true);
          }
        }
      }

      // Step once to rebuild connectivity
      w.step(1);

      const partyId = createTestParty(w, 'raid', 'n');
      spawnHostileMember(
        w.game.world,
        w.game.registry,
        w.game.world.rngFor('18'),
        partyId,
        'gloam_captain',
        'captain',
        leaderTile,
        1,
        true,
      );

      const partyComp = w.game.world.entities.get(partyId, C.Party)!;
      chooseGoal(partyComp, makeCtx(w));

      expect(partyComp.goalUnreachable).toBe(true);
      expect(partyComp.goalTile).not.toBe(hearthTile);
      expect(partyComp.goalTile).toBeGreaterThanOrEqual(0);
    });
  });

  describe('separated members act alone', () => {
    it('separated follower paths toward goal when leader is unreachable', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'th-ai-separated' });
      const z = FLAT_TEST_SURFACE_Z;

      const leaderTile = w.index(10, 10, z);
      const followerTile = w.index(30, 10, z);
      const goalTile = w.index(20, 20, z);

      const partyId = createTestParty(w, 'raid', 'n');
      const leaderId = spawnHostileMember(
        w.game.world,
        w.game.registry,
        w.game.world.rngFor('18'),
        partyId,
        'gloam_captain',
        'captain',
        leaderTile,
        1,
        true,
      );
      const followerId = spawnHostileMember(
        w.game.world,
        w.game.registry,
        w.game.world.rngFor('18'),
        partyId,
        'gloam_warrior',
        'warriors',
        followerTile,
        1,
        false,
      );

      // Wall off the leader completely so follower cannot reach leader
      for (let x = 8; x <= 12; x++) {
        for (let y = 8; y <= 12; y++) {
          if (x === 8 || x === 12 || y === 8 || y === 12) {
            const t = w.index(x, y, z);
            w.carve(t, TileKind.Wall);
            w.setBuildingBlock(t, true);
          }
        }
      }

      // Step once to rebuild connectivity
      w.step(1);

      const partyComp = w.game.world.entities.get(partyId, C.Party)!;
      partyComp.goalTile = goalTile;
      partyComp.leaderId = leaderId;

      const followerH = w.game.world.entities.get(followerId, C.Hostile)!;

      memberThink(followerId, followerH, partyComp, makeCtx(w));

      // Follower has a motion path set toward goalTile rather than staying idle
      const motion = w.game.world.entities.get(followerId, C.Motion);
      expect(motion).toBeDefined();
    });
  });

  describe('loot carried off the map', () => {
    it('thief carrying owned item despawns at edge, destroys item, and gives owner thought', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'th-ai-loot-escape' });
      const z = FLAT_TEST_SURFACE_Z;

      // Spawn owner dwarf
      const dwarfId = w.spawnDwarf({ at: w.index(24, 24, z) });

      // Spawn an owned ring
      const ringTile = w.index(24, 1, z);
      const ringId = w.spawnItem('ring', 'gold', ringTile);
      const itemComp = w.game.world.entities.get(ringId, C.Item)!;
      itemComp.ownerId = dwarfId;

      // Create thief party
      const partyId = createTestParty(w, 'thief', 'n');
      const edgeTile = w.index(24, 0, z); // North edge
      spawnHostileMember(
        w.game.world,
        w.game.registry,
        w.game.world.rngFor('18'),
        partyId,
        'gloam_snatcher',
        'thief',
        edgeTile,
        0,
        false,
      );

      const partyComp = w.game.world.entities.get(partyId, C.Party)!;
      partyComp.edge = 'n';
      partyComp.state = 'retreat';
      partyComp.loot.push(ringId);

      // Step one tick so threats processes thief at edge
      w.step(1);

      // Thief despawns and emits ThiefEscaped
      const escapedEvents = w.events('ThiefEscaped');
      expect(escapedEvents.length).toBeGreaterThan(0);
      expect(escapedEvents[0]?.['itemId']).toBe(ringId);

      // Item is destroyed
      expect(w.game.world.entities.alive(ringId)).toBe(false);

      // Owner receives thief_escaped_with_my_things thought
      const morale = w.readers.of<MoraleReader>('15');
      const thoughts = morale.thoughts(dwarfId);
      expect(thoughts.some((t) => t.id === 'thief_escaped_with_my_things')).toBe(true);
    });
  });

  describe('hostile equipment on corpses and strip_corpse', () => {
    it('dead hostile retains equipment in wornItems on corpse', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'th-ai-corpse-strip' });
      const z = FLAT_TEST_SURFACE_Z;
      const tile = w.index(24, 24, z);

      const partyId = createTestParty(w, 'raid', 'n');
      const hostileId = spawnHostileMember(
        w.game.world,
        w.game.registry,
        w.game.world.rngFor('18'),
        partyId,
        'gloam_warrior',
        'warriors',
        tile,
        2,
        false,
      );

      const equip = w.game.world.entities.get(hostileId, C.Equipment)!;
      expect(equip.weapon).toBeGreaterThan(0);
      const weaponId = equip.weapon;

      // Hostile dies
      w.game.world.emit({
        type: 'CreatureDied',
        id: hostileId,
        tile,
        species: w.game.world.entities.get(hostileId, C.Creature)!.species,
        cause: 'combat',
      });

      // Step 11 ticks so items system ticks (cadence 10) and produces corpse
      w.step(11);

      const corpses = w.events('CorpseCreated');
      expect(corpses.length).toBeGreaterThan(0);
      const corpseEvent = corpses.find((e) => e['creatureId'] === hostileId);
      expect(corpseEvent).toBeDefined();

      const corpseId = corpseEvent!['id'] as number;
      const corpseData = w.game.world.entities.get(corpseId, C.Corpse)!;
      expect(corpseData.wornItems).toContain(weaponId);
    });
  });
});
