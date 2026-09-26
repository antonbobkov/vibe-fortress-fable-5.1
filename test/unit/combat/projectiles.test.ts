/**
 * Unit tests for T-M6-03: Projectiles, line of sight through fortifications, bystander hits.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z, HeadlessGame } from '@app/headless';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import { lineOfSightRanged, advanceProjectiles, fireRanged } from '@systems/combat/ranged';

describe('T-M6-03 projectiles unit tests', () => {
  it('projectile stops at walls without damaging target behind it', () => {
    const game = new HeadlessGame({ seed: 'proj-wall', world: 'flat-test', embark: 'none' });
    const registry = game.registry;
    const z = FLAT_TEST_SURFACE_Z;

    const shooterTile = game.map.index(10, 10, z);
    const wallTile = game.map.index(12, 10, z);
    const targetTile = game.map.index(15, 10, z);

    // Place a wall between shooter and target
    game.world.map.kind[wallTile] = TileKind.Wall;

    const shooter = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), shooterTile, 'fortress');
    const target = game.world.services.spawn.creature(registry.table('creatures').index('deer'), targetTile, 'wild');

    // Equip shooter with crossbow and bolts
    const iron = registry.table('materials').index('iron');
    const crossbow = game.world.services.spawn.item(registry.table('items').index('crossbow'), iron, shooterTile);
    const bolts = game.world.services.spawn.item(registry.table('items').index('bolt'), iron, shooterTile, 20);

    game.world.entities.add(shooter, C.Equipment, {
      weapon: crossbow,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: bolts,
    });

    const events: GameEvent[] = [];
    const cooldownUntil = new Map();
    const ctx = {
      world: game.world,
      registry,
      rng: game.world.rngFor('16'),
      tick: 1,
      emit: (e: GameEvent) => events.push(e),
      readers: game.world.readers,
      register: {} as never,
    };

    // Firing should be blocked by line of sight
    const bReader = game.world.readers.has('14') ? game.world.readers.of('14') : undefined;
    expect(lineOfSightRanged(game.world.map, shooterTile, targetTile, 12, bReader as never)).toBe(false);

    const fired = fireRanged(ctx as never, shooter, target, cooldownUntil);
    expect(fired).toBe(false);
  });

  it('bystander on projectile path can be hit with half chance', () => {
    const game = new HeadlessGame({ seed: 'proj-bystander', world: 'flat-test', embark: 'none' });
    const registry = game.registry;
    const z = FLAT_TEST_SURFACE_Z;

    const shooterTile = game.map.index(10, 10, z);
    const bystanderTile = game.map.index(13, 10, z);
    const targetTile = game.map.index(16, 10, z);

    const shooter = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), shooterTile, 'fortress');
    const bystander = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), bystanderTile, 'fortress');
    const target = game.world.services.spawn.creature(registry.table('creatures').index('deer'), targetTile, 'wild');

    // Equip shooter
    const iron = registry.table('materials').index('iron');
    const crossbow = game.world.services.spawn.item(registry.table('items').index('crossbow'), iron, shooterTile);
    const bolts = game.world.services.spawn.item(registry.table('items').index('bolt'), iron, shooterTile, 100);

    game.world.entities.add(shooter, C.Equipment, {
      weapon: crossbow,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: bolts,
    });

    const cooldownUntil = new Map();
    let bystanderHits = 0;
    const TOTAL_TESTS = 200;

    for (let i = 0; i < TOTAL_TESTS; i += 1) {
      const events: GameEvent[] = [];
      const ctx = {
        world: game.world,
        registry,
        rng: game.world.rngFor('16'),
        tick: i * 10,
        emit: (e: GameEvent) => events.push(e),
        readers: game.world.readers,
        register: {} as never,
      };

      // Ensure shooter has bolts in quiver
      const bItem = game.world.entities.get(bolts, C.Item);
      if (bItem) bItem.count = 100;
      cooldownUntil.clear();

      const fired = fireRanged(ctx as never, shooter, target, cooldownUntil, { skipXp: true });
      if (!fired) continue;

      // Advance until projectile finishes (at most 10 ticks)
      for (let t = 0; t < 10; t += 1) {
        advanceProjectiles(ctx as never, game.world.rngFor('16'));
      }

      if (events.some((e) => e.type === 'AttackResolved' && (e as { defenderId?: number }).defenderId === bystander)) {
        bystanderHits += 1;
      }
    }

    // Bystander should be hit sometimes (approx half chance of base hit rate)
    expect(bystanderHits).toBeGreaterThan(10);
    expect(bystanderHits).toBeLessThan(TOTAL_TESTS);
  });

  it('overlook rule and fortification adjacency line of sight rules', () => {
    const game = new HeadlessGame({ seed: 'proj-los', world: 'flat-test', embark: 'none' });
    const z = FLAT_TEST_SURFACE_Z;
    const map = game.world.map;

    const shooterTile = map.index(10, 10, z);
    const targetTile = map.index(15, 10, z);

    // 1. Same level with fortification in between (not adjacent to shooter or target)
    const midFort = map.index(12, 10, z);
    map.kind[midFort] = TileKind.Fortification;
    expect(lineOfSightRanged(map, shooterTile, targetTile, 12)).toBe(false);

    // 2. Same level with fortification adjacent to shooter -> passes
    const adjFort = map.index(11, 10, z);
    map.kind[midFort] = TileKind.Floor;
    map.kind[adjFort] = TileKind.Fortification;
    expect(lineOfSightRanged(map, shooterTile, targetTile, 12)).toBe(true);

    // 3. Same level with fortification adjacent to target -> passes
    const adjTargetFort = map.index(14, 10, z);
    map.kind[adjFort] = TileKind.Floor;
    map.kind[adjTargetFort] = TileKind.Fortification;
    expect(lineOfSightRanged(map, shooterTile, targetTile, 12)).toBe(true);

    // 4. Overlook rule: shooter at z+1 overlooking target at z
    map.kind[adjTargetFort] = TileKind.Floor;
    const shooterAbove = map.index(10, 10, z + 1);
    const overlookFort = map.index(11, 10, z + 1);

    // Without fortification on shooter's level -> false
    expect(lineOfSightRanged(map, shooterAbove, targetTile, 12)).toBe(false);

    // With fortification on shooter's level overlooking -> true
    map.kind[overlookFort] = TileKind.Fortification;
    expect(lineOfSightRanged(map, shooterAbove, targetTile, 12)).toBe(true);

    // Shooting up from z to z+1 is always false
    expect(lineOfSightRanged(map, targetTile, shooterAbove, 12)).toBe(false);
  });
});
