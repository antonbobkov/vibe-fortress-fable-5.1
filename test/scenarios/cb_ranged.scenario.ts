/**
 * `cb_ranged` of `04-implementation/acceptance-tests.md` § 16 Combat:
 * "crossbow, skill 6, range 8, at a deer (a fresh deer replaces a dead one) |
 * hit 33% ± 3% over 2,000 shots; 17–23% of the bolts break, the rest drop".
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import type { EntityId, TileIndex } from '@core/types';
import { advanceProjectiles, fireRanged } from '@systems/combat/ranged';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'cb_ranged',
  milestone: 6,
  seed: 'cb-ranged-2000',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const z = FLAT_TEST_SURFACE_Z;
    const shooterTile = w.index(20, 20, z);
    const targetTile = w.index(28, 20, z); // Range 8 along x

    const registry = w.game.registry;
    const entities = w.game.world.entities;
    const itemsTable = registry.table('items');
    const materialsTable = registry.table('materials');
    const creaturesTable = registry.table('creatures');

    const iron = materialsTable.index('iron');
    const deerSpecies = creaturesTable.index('deer');

    // Spawn shooter dwarf
    const shooter = w.spawnDwarf({ at: shooterTile });
    const attrsS = entities.get(shooter, C.Attributes);
    if (attrsS) entities.add(shooter, C.Attributes, { ...attrsS, agi: 50 });

    const crossbow = w.spawnItem(itemsTable.index('crossbow'), iron, shooterTile);
    entities.add(shooter, C.Equipment, {
      weapon: crossbow,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });
    w.setSkill(shooter, 'crossbow', 6);

    const spawnFreshDeer = (at: TileIndex): EntityId => {
      return w.game.world.services.spawn.creature(deerSpecies, at, 'wild');
    };

    let target = spawnFreshDeer(targetTile);

    let hits = 0;
    let broken = 0;
    let dropped = 0;
    const cooldownMap = new Map();

    const TOTAL_SHOTS = 2000;

    for (let shot = 0; shot < TOTAL_SHOTS; shot += 1) {
      if (!entities.alive(target)) {
        target = spawnFreshDeer(targetTile);
      }

      // Spawn a fresh bolt in shooter's quiver
      const bolt = w.spawnItem(itemsTable.index('bolt'), iron, shooterTile, 1);
      const equip = entities.get(shooter, C.Equipment);
      if (equip) equip.quiver = bolt;

      cooldownMap.clear();

      const events: GameEvent[] = [];
      const ctx = {
        world: w.game.world,
        registry,
        rng: w.game.world.rngFor('16'),
        tick: shot * 10,
        emit: (e: GameEvent) => events.push(e),
        readers: w.game.world.readers,
        register: {} as never,
      };

      const fired = fireRanged(ctx as never, shooter, target, cooldownMap, { skipXp: true });
      expect(fired).toBe(true);

      // Advance until no projectiles are active
      while (entities.with(C.Projectile).length > 0) {
        advanceProjectiles(ctx as never, ctx.rng);
      }

      for (const e of events) {
        if (e.type === 'AttackResolved' && (e as { outcome?: string }).outcome === 'hit') {
          hits += 1;
        }
      }

      if (entities.alive(bolt)) {
        dropped += 1;
      } else {
        broken += 1;
      }
    }

    const hitRate = hits / TOTAL_SHOTS;
    const breakRate = broken / TOTAL_SHOTS;
    
    // hit 33% ± 3% over 2,000 shots (0.30 to 0.36)
    expect(hitRate).toBeGreaterThanOrEqual(0.30);
    expect(hitRate).toBeLessThanOrEqual(0.36);

    // 17–23% of the bolts break, the rest drop
    expect(breakRate).toBeGreaterThanOrEqual(0.17);
    expect(breakRate).toBeLessThanOrEqual(0.23);
    expect(dropped + broken).toBe(TOTAL_SHOTS);
  },
};

export default scenario;
