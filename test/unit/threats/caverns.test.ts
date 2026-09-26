/**
 * Cavern monsters, webs, and restless dead unit tests (T-M6-10).
 * Tests:
 * - Monsters do not leave the band without a target
 * - Web entanglement for WEB_TICKS
 * - Magma wyrm fire breath applies burn damage at range 6
 * - Sleeping cavern monsters wake on CavernBreached
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import { CAVERN_BANDS } from '@systems/terrain/api';
import {
  CAVE_RETURN_TICKS,
  WEB_TICKS,
} from '@systems/threats/constants';
import {
  handleWebEntangle,
  stepCavernMonsters,
  wakeCavernMonsters,
  type CavernMonsterInfo,
} from '@systems/threats/caverns';
import { TestWorld } from '../../scenarios/test-world';

function makeCtx(w: TestWorld): TickContext {
  return {
    world: w.game.world,
    registry: w.game.registry,
    readers: w.readers,
    tick: w.tick,
    emit: (e: GameEvent) => w.game.world.emit(e),
  } as unknown as TickContext;
}

describe('T-M6-10 Cavern monsters and webs', () => {
  describe('monsters do not leave the band without a target', () => {
    it('wander target stays within the cavern band when inside band', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'cavern-band-wander' });
      const tier = 1;
      const band = CAVERN_BANDS[tier]!;
      const z = band[0] + 2;

      // Make a floor tile in band
      const tile = w.index(20, 20, z);
      w.carve(tile, TileKind.Floor);

      // Carve some neighbors in band
      for (const n of w.map.neighbors8(tile)) {
        w.carve(n, TileKind.Floor);
      }

      const crawler = w.spawnCreature('cave_crawler', tile, 'hostile:cavern');
      w.game.world.entities.add(crawler, C.Hostile, {
        partyId: 0,
        role: 'cavern_monster',
        behaviorState: 'wander',
        stealthed: false,
        spotted: false,
        breakingDoorId: 0,
        breakingSince: 0,
      });

      const monsterInfo = new Map<number, CavernMonsterInfo>();
      monsterInfo.set(crawler, { tier, species: 'cave_crawler', lairTile: tile, noTargetTicks: 0 });

      const ctx = makeCtx(w);
      const rng = w.game.world.rngFor('18');

      // Step cavern monsters
      stepCavernMonsters(ctx, rng, monsterInfo);

      const target = w.game.world.services.movement?.walkTarget(crawler) ?? -1;
      if (target >= 0) {
        const targetZ = w.map.zOf(target);
        expect(targetZ).toBeGreaterThanOrEqual(band[0]);
        expect(targetZ).toBeLessThanOrEqual(band[1]);
      }
      const H = w.game.world.entities.get(crawler, C.Hostile);
      expect(H?.behaviorState).toBe('wander');
    });

    it('returns to cavern band after CAVE_RETURN_TICKS when outside band', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'cavern-band-return' });
      const tier = 1;
      const band = CAVERN_BANDS[tier]!;
      // Place creature outside band (e.g. at surface z)
      const zOutside = FLAT_TEST_SURFACE_Z;
      const tileOutside = w.index(20, 20, zOutside);

      // Make floor tile inside band
      const tileInside = w.index(20, 20, band[0]);
      w.carve(tileInside, TileKind.Floor);

      const crawler = w.spawnCreature('cave_crawler', tileOutside, 'hostile:cavern');
      w.game.world.entities.add(crawler, C.Hostile, {
        partyId: 0,
        role: 'cavern_monster',
        behaviorState: 'wander',
        stealthed: false,
        spotted: false,
        breakingDoorId: 0,
        breakingSince: 0,
      });

      const monsterInfo = new Map<number, CavernMonsterInfo>();
      monsterInfo.set(crawler, {
        tier,
        species: 'cave_crawler',
        lairTile: tileInside,
        noTargetTicks: CAVE_RETURN_TICKS,
      });

      const ctx = makeCtx(w);
      const rng = w.game.world.rngFor('18');

      stepCavernMonsters(ctx, rng, monsterInfo);

      const H = w.game.world.entities.get(crawler, C.Hostile);
      expect(H?.behaviorState).toBe('return');
    });
  });

  describe('webs entangle for WEB_TICKS', () => {
    it('entangles non-spider creatures stepping on web', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'web-entangle' });
      const z = FLAT_TEST_SURFACE_Z;
      const from = w.index(20, 20, z);
      const to = w.index(21, 20, z);

      // Mark destination tile with Web flag
      w.map.setFlag(to, TileFlag.Web, true);

      const dwarf = w.spawnDwarf({ at: from });
      const motion = w.game.world.entities.get(dwarf, C.Motion);
      expect(motion).toBeDefined();

      const ctx = makeCtx(w);
      handleWebEntangle(ctx, [[dwarf, from, to]]);

      expect(w.game.world.entities.get(dwarf, C.Motion)?.waitUntil).toBe(w.tick + WEB_TICKS);
    });

    it('does not entangle giant cave spiders stepping on web', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'web-spider-immune' });
      const z = FLAT_TEST_SURFACE_Z;
      const from = w.index(20, 20, z);
      const to = w.index(21, 20, z);

      w.map.setFlag(to, TileFlag.Web, true);

      const spider = w.spawnCreature('giant_cave_spider', from, 'hostile:cavern');
      const motion = w.game.world.entities.get(spider, C.Motion);
      expect(motion).toBeDefined();

      const ctx = makeCtx(w);
      handleWebEntangle(ctx, [[spider, from, to]]);

      expect(w.game.world.entities.get(spider, C.Motion)?.waitUntil).toBe(0);
    });
  });

  describe('magma wyrm fire breath', () => {
    it('applies burn damage at range 6', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'wyrm-fire-breath' });
      const z = FLAT_TEST_SURFACE_Z;
      const wyrmTile = w.index(20, 20, z);
      const dwarfTile = w.index(26, 20, z); // distance = 6

      const wyrm = w.spawnCreature('magma_wyrm', wyrmTile, 'hostile:cavern');
      const dwarf = w.spawnDwarf({ at: dwarfTile });

      // Target dwarf
      w.game.world.services.combat?.setTarget(wyrm, dwarf);

      // Target cannot fire if distance > 6
      const tooFarDwarf = w.spawnDwarf({ at: w.index(27, 20, z) }); // distance = 7
      expect(w.game.world.services.combat?.fireAt(wyrm, tooFarDwarf)).toBe(false);

      // Unconscious target gives +40 hit chance
      const body = w.game.world.entities.get(dwarf, C.Body);
      if (body) {
        w.game.world.entities.add(dwarf, C.Body, { ...body, conscious: false });
      }

      // Fire ranged attack at range 6
      const fired = w.game.world.services.combat?.fireAt(wyrm, dwarf);
      expect(fired).toBe(true);

      // Advance projectiles
      w.step(50);

      const dmgEvents = w.events('DamageDealt').filter((e) => e['defenderId'] === dwarf);
      expect(dmgEvents.length).toBeGreaterThanOrEqual(1);
      const burnEvent = dmgEvents.find((e) => e['damageType'] === 'burn');
      expect(burnEvent).toBeDefined();
      expect(burnEvent?.['damageType']).toBe('burn');
      expect(burnEvent?.['amount']).toBeGreaterThan(0);
    });
  });

  describe('wake on breach', () => {
    it('wakes sleeping cavern monsters of the breached tier', () => {
      const w = new TestWorld({ world: 'flat-test', seed: 'cavern-wake' });
      const z = FLAT_TEST_SURFACE_Z;
      const tile = w.index(20, 20, z);

      const monster1 = w.spawnCreature('cave_crawler', tile, 'hostile:cavern');
      w.game.world.entities.add(monster1, C.Hostile, {
        partyId: 0,
        role: 'cavern_monster',
        behaviorState: 'asleep',
        stealthed: false,
        spotted: false,
        breakingDoorId: 0,
        breakingSince: 0,
      });

      const monster2 = w.spawnCreature('troll', tile, 'hostile:cavern');
      w.game.world.entities.add(monster2, C.Hostile, {
        partyId: 0,
        role: 'cavern_monster',
        behaviorState: 'asleep',
        stealthed: false,
        spotted: false,
        breakingDoorId: 0,
        breakingSince: 0,
      });

      const monsterInfo = new Map<number, CavernMonsterInfo>();
      monsterInfo.set(monster1, { tier: 1, species: 'cave_crawler', lairTile: tile, noTargetTicks: 0 });
      monsterInfo.set(monster2, { tier: 2, species: 'troll', lairTile: tile, noTargetTicks: 0 });

      // Breaching tier 1 wakes monster1 but leaves monster2 asleep
      wakeCavernMonsters(w.game.world, 1, monsterInfo);

      expect(w.game.world.entities.get(monster1, C.Hostile)?.behaviorState).toBe('wander');
      expect(w.game.world.entities.get(monster2, C.Hostile)?.behaviorState).toBe('asleep');
    });
  });
});
