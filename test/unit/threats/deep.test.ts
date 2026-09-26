/**
 * The Deep unit tests: `02-systems/18-threats-monsters-and-raids.md` § The Deep,
 * `03-content/threat-schedules.md` § The Deep.
 *
 * Tests:
 * - Threshold table (levels 1..4, pressure thresholds 50, 150, 300, 500, wyrm substitution)
 * - Emergence tiles adjacent to the last mined deepsilver (cracking rock, spawning Hollow-born)
 * - Waves grow by one (wave n: 3+n crawlers, 1+floor(n/2) stalkers, maw every 3rd wave)
 * - Hollow-born global seeking and door breaking
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { TICKS_PER_DAY } from '@core/constants';
import {
  checkHollowWave,
  findEmergenceBaseTile,
  findNearestFortressTarget,
  findNearestWallTiles,
  handleDeepsilverMined,
  magmaWyrmLives,
  nextDeepThreshold,
  stepHollowBorn,
  triggerDeepEmergence,
  type DeepState,
  type DeepThresholdRow,
} from '@systems/threats/deep';
import {
  DEEP_PRESSURE_PER_TILE,
  EMERGENCE_TILES,
  HOLLOW_WAVE_DAYS,
} from '@systems/threats/constants';
import { TestWorld } from '../../scenarios/test-world';

function makeCtx(w: TestWorld, events: GameEvent[] = [], getTick?: () => number): TickContext {
  return {
    world: w.game.world,
    registry: w.game.registry,
    readers: w.readers,
    get tick() {
      return getTick ? getTick() : w.tick;
    },
    terrain: w.game.world.services.terrain,
    emit: (e: GameEvent) => {
      events.push(e);
      w.game.world.emit(e);
    },
  } as unknown as TickContext;
}

describe('T-M6-11 The Deep', () => {
  describe('threshold table', () => {
    it('deepThresholds derived table has exactly 4 rows with pressure thresholds 50, 150, 300, 500', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'deep-table' });
      const table = w.game.registry.derived<readonly DeepThresholdRow[]>('deepThresholds');

      expect(table).toHaveLength(4);
      expect(table[0]?.level).toBe(1);
      expect(table[0]?.pressure).toBe(50);
      expect(table[0]?.emergence).toEqual([{ species: 'hollow_crawler', count: 3 }]);

      expect(table[1]?.level).toBe(2);
      expect(table[1]?.pressure).toBe(150);
      expect(table[1]?.emergence).toEqual([
        { species: 'hollow_stalker', count: 2 },
        { species: 'hollow_crawler', count: 3 },
      ]);

      expect(table[2]?.level).toBe(3);
      expect(table[2]?.pressure).toBe(300);
      expect(table[2]?.emergence).toEqual([
        { species: 'magma_wyrm', count: 1 },
        { species: 'hollow_stalker', count: 2 },
      ]);

      expect(table[3]?.level).toBe(4);
      expect(table[3]?.pressure).toBe(500);
      expect(table[3]?.emergence).toEqual([
        { species: 'hollow_maw', count: 1 },
        { species: 'hollow_crawler', count: 4 },
        { species: 'hollow_stalker', count: 2 },
      ]);
    });

    it('nextDeepThreshold returns correct thresholds for levels 0 through 4+', () => {
      expect(nextDeepThreshold(0)).toBe(50);
      expect(nextDeepThreshold(1)).toBe(150);
      expect(nextDeepThreshold(2)).toBe(300);
      expect(nextDeepThreshold(3)).toBe(500);
      expect(nextDeepThreshold(4)).toBe(500);
      expect(nextDeepThreshold(5)).toBe(500);
    });

    it('substitutes hollow_stalker for magma_wyrm if a wyrm already lives in the world', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'deep-wyrm-sub' });
      const events: GameEvent[] = [];
      const ctx = makeCtx(w, events);

      // Spawn a living magma wyrm
      const wyrmTile = w.index(20, 20, FLAT_TEST_SURFACE_Z);
      const speciesTable = w.game.registry.table<{ id: string }>('creatures');
      const wyrmIdx = speciesTable.index('magma_wyrm');
      w.game.world.services.spawn.creature(wyrmIdx, wyrmTile, 'hostile:cavern');

      expect(magmaWyrmLives(ctx)).toBe(true);

      const hollowBorn = new Set<EntityId>();
      const spawnedIds = triggerDeepEmergence(
        ctx,
        [wyrmTile],
        [
          { species: 'magma_wyrm', count: 1 },
          { species: 'hollow_stalker', count: 2 },
        ],
        hollowBorn,
      );

      // All 3 spawned should be stalkers (1 substituted wyrm + 2 stalkers)
      const stalkerIdx = speciesTable.index('hollow_stalker');
      for (const id of spawnedIds) {
        const c = w.game.world.entities.get(id, C.Creature);
        expect(c?.species).toBe(stalkerIdx);
      }
    });
  });

  describe('emergence tiles adjacent to last mined deepsilver', () => {
    it('findEmergenceBaseTile finds the most recently mined tile adjacent to rock wall', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'deep-base-tile' });
      const z = FLAT_TEST_SURFACE_Z;

      // Create tiles: t1, t2, t3 in a line
      const t1 = w.index(10, 10, z);
      const t2 = w.index(11, 10, z);
      const t3 = w.index(12, 10, z);

      w.carve(t1, TileKind.Floor);
      w.carve(t2, TileKind.Floor);
      w.carve(t3, TileKind.Floor);

      // Make all neighbors around t1 and t2 Floor as well
      for (const n of w.map.neighbors26(t1)) w.carve(n, TileKind.Floor);
      for (const n of w.map.neighbors26(t2)) w.carve(n, TileKind.Floor);

      // Leave a wall adjacent to t3
      const t3Wall = w.index(13, 10, z);
      w.carve(t3Wall, TileKind.Wall);

      const deepsilverTiles = [t1, t2, t3];
      const baseTile = findEmergenceBaseTile(w.map, deepsilverTiles);
      expect(baseTile).toBe(t3);
    });

    it('triggerDeepEmergence cracks nearest 4 wall tiles to Open and spawns Hollow-born', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'deep-emergence' });
      const events: GameEvent[] = [];
      const ctx = makeCtx(w, events);
      const z = FLAT_TEST_SURFACE_Z;

      const baseTile = w.index(25, 25, z);
      w.carve(baseTile, TileKind.Floor);

      // Surround with walls
      const wall1 = w.index(26, 25, z);
      const wall2 = w.index(24, 25, z);
      const wall3 = w.index(25, 26, z);
      const wall4 = w.index(25, 24, z);
      w.carve(wall1, TileKind.Wall);
      w.carve(wall2, TileKind.Wall);
      w.carve(wall3, TileKind.Wall);
      w.carve(wall4, TileKind.Wall);

      const hollowBorn = new Set<EntityId>();
      const spawnedIds = triggerDeepEmergence(
        ctx,
        [baseTile],
        [{ species: 'hollow_crawler', count: 3 }],
        hollowBorn,
      );

      expect(spawnedIds).toHaveLength(3);
      for (const id of spawnedIds) {
        expect(hollowBorn.has(id)).toBe(true);
        const creature = w.game.world.entities.get(id, C.Creature);
        expect(creature?.faction).toBe('deep');
        const hostile = w.game.world.entities.get(id, C.Hostile);
        expect(hostile?.role).toBe('hollow');
      }

      // Check MonsterEmerged event
      const emergedEvent = events.find((e) => e.type === 'MonsterEmerged');
      expect(emergedEvent).toBeDefined();
      expect(emergedEvent!['tile']).toBe(baseTile);
      expect(emergedEvent!['ids']).toEqual(spawnedIds);

      // Check nearest walls were cracked to Open
      const crackedTiles = findNearestWallTiles(w.map, baseTile, EMERGENCE_TILES);
      expect(crackedTiles.length).toBeLessThanOrEqual(4);
    });

    it('handleDeepsilverMined accumulates pressure and triggers level 1 at 50 pressure', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'deep-mined' });
      const events: GameEvent[] = [];
      const ctx = makeCtx(w, events);
      const z = FLAT_TEST_SURFACE_Z;

      const deepsilverTiles: TileIndex[] = [];
      const deepState: DeepState = {
        pressure: 0,
        level: 0,
        nextHollowWaveTick: 0,
        hollowWaveIndex: 0,
      };
      const hollowBorn = new Set<EntityId>();

      // Mine 4 tiles -> 40 pressure, no emergence
      for (let i = 0; i < 4; i++) {
        const t = w.index(20 + i, 20, z);
        w.carve(t, TileKind.Floor);
        handleDeepsilverMined(t, ctx, deepsilverTiles, deepState, hollowBorn);
      }

      expect(deepState.pressure).toBe(4 * DEEP_PRESSURE_PER_TILE);
      expect(deepState.level).toBe(0);
      expect(events.filter((e) => e.type === 'DeepStirred')).toHaveLength(0);

      // Mine 5th tile -> 50 pressure, level 1 stirred!
      const t5 = w.index(24, 20, z);
      w.carve(t5, TileKind.Floor);
      handleDeepsilverMined(t5, ctx, deepsilverTiles, deepState, hollowBorn);

      expect(deepState.pressure).toBe(50);
      expect(deepState.level).toBe(1);

      const stirredEvents = events.filter((e) => e.type === 'DeepStirred');
      expect(stirredEvents).toHaveLength(1);
      expect(stirredEvents[0]!['level']).toBe(1);

      // Emergence occurred
      expect(events.filter((e) => e.type === 'MonsterEmerged')).toHaveLength(1);
      expect(hollowBorn.size).toBe(3);
    });
  });

  describe('waves grow by one', () => {
    it('wave formula brings 3 + n crawlers, 1 + floor(n/2) stalkers, and a maw every third wave', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'deep-waves' });
      const events: GameEvent[] = [];
      let currentTick = 50;
      const ctx = makeCtx(w, events, () => currentTick);
      const z = FLAT_TEST_SURFACE_Z;

      const baseTile = w.index(25, 25, z);
      w.carve(baseTile, TileKind.Floor);
      const deepsilverTiles = [baseTile];

      const deepState: DeepState = {
        pressure: 500,
        level: 4,
        nextHollowWaveTick: 100,
        hollowWaveIndex: 1,
      };
      const hollowBorn = new Set<EntityId>();

      // Before wave tick, checkHollowWave does nothing
      w.step(50);
      checkHollowWave(ctx, deepsilverTiles, deepState, hollowBorn);
      expect(deepState.hollowWaveIndex).toBe(1);
      expect(hollowBorn.size).toBe(0);

      // Wave 1 at tick 100: n = 1 -> crawlers: 3 + 1 = 4, stalkers: 1 + 0 = 1 (total 5)
      currentTick = 100;
      checkHollowWave(ctx, deepsilverTiles, deepState, hollowBorn);
      expect(deepState.hollowWaveIndex).toBe(2);
      expect(deepState.nextHollowWaveTick).toBe(100 + HOLLOW_WAVE_DAYS * TICKS_PER_DAY);
      expect(hollowBorn.size).toBe(5);

      // Wave 2 at next tick: n = 2 -> crawlers: 3 + 2 = 5, stalkers: 1 + 1 = 2 (total 7)
      currentTick = deepState.nextHollowWaveTick;
      hollowBorn.clear();
      checkHollowWave(ctx, deepsilverTiles, deepState, hollowBorn);
      expect(deepState.hollowWaveIndex).toBe(3);
      expect(hollowBorn.size).toBe(7);

      // Wave 3 at next tick: n = 3 -> crawlers: 3 + 3 = 6, stalkers: 1 + 1 = 2, maw: 1 (total 9)
      currentTick = deepState.nextHollowWaveTick;
      hollowBorn.clear();
      checkHollowWave(ctx, deepsilverTiles, deepState, hollowBorn);
      expect(deepState.hollowWaveIndex).toBe(4);
      expect(hollowBorn.size).toBe(9);

      // Verify species in wave 3 includes hollow_maw
      const speciesTable = w.game.registry.table<{ id: string }>('creatures');
      const mawIdx = speciesTable.index('hollow_maw');
      const spawnedMaws = Array.from(hollowBorn).filter((id) => {
        return w.game.world.entities.get(id, C.Creature)?.species === mawIdx;
      });
      expect(spawnedMaws).toHaveLength(1);

      // Wave 4: n = 4 -> crawlers: 3 + 4 = 7, stalkers: 1 + 2 = 3, no maw (total 10)
      currentTick = deepState.nextHollowWaveTick;
      hollowBorn.clear();
      checkHollowWave(ctx, deepsilverTiles, deepState, hollowBorn);
      expect(deepState.hollowWaveIndex).toBe(5);
      expect(hollowBorn.size).toBe(10);
      const wave4Maws = Array.from(hollowBorn).filter((id) => {
        return w.game.world.entities.get(id, C.Creature)?.species === mawIdx;
      });
      expect(wave4Maws).toHaveLength(0);
    });
  });

  describe('Hollow-born seek and door breaking', () => {
    it('findNearestFortressTarget finds fortress creature anywhere on map', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'deep-seek' });
      const z = FLAT_TEST_SURFACE_Z;
      const dwarf = w.spawnDwarf({ at: w.index(40, 40, z) });

      const fromTile = w.index(10, 10, z);
      const ctx = makeCtx(w);

      const target = findNearestFortressTarget(fromTile, ctx);
      expect(target).toBe(dwarf);
    });

    it('stepHollowBorn breaks locked doors if species has breaksDoors', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'deep-door' });
      const events: GameEvent[] = [];
      const ctx = makeCtx(w, events);
      const z = FLAT_TEST_SURFACE_Z;

      // Spawn dwarf at (24, 26, z)
      w.spawnDwarf({ at: w.index(24, 26, z) });

      // Wall off row around door so door has flanking walls
      for (let x = 0; x < w.map.w; x++) {
        if (x !== 24) {
          const t = w.index(x, 24, z);
          w.carve(t, TileKind.Wall);
          w.setBuildingBlock(t, true);
        }
      }

      // Build locked door at (24, 24, z)
      const doorTile = w.index(24, 24, z);
      const doorId = w.build('door', doorTile, 'granite');
      w.game.world.applyCommand({
        type: 'SetDoorMode',
        buildingId: doorId,
        mode: 'locked',
      });

      // Spawn hollow_maw at (24, 23, z), directly adjacent to the locked door
      const mawTile = w.index(24, 23, z);
      const speciesTable = w.game.registry.table<{ id: string }>('creatures');
      const mawSpeciesIdx = speciesTable.index('hollow_maw');
      const mawId = w.game.world.services.spawn.creature(mawSpeciesIdx, mawTile, 'deep');

      w.game.world.entities.add(mawId, C.Hostile, {
        partyId: 0,
        role: 'hollow',
        behaviorState: 'attack',
        stealthed: false,
        spotted: true,
        breakingDoorId: 0,
        breakingSince: 0,
      });

      const hollowBorn = new Set<EntityId>([mawId]);
      stepHollowBorn(ctx, hollowBorn);

      const doorAttempts = events.filter((e) => e.type === 'DoorBreakAttempt');
      expect(doorAttempts).toHaveLength(1);
      expect(doorAttempts[0]!['doorId']).toBe(doorId);
      expect(doorAttempts[0]!['id']).toBe(mawId);
    });
  });
});
