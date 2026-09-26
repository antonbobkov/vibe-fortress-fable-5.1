/**
 * `cb_hit_table` of `04-implementation/acceptance-tests.md` § 16 Combat:
 * "10,000 attacks, skill 5 vs dodge 5, equal agility, defender without weapon or shield |
 * hit rate 50% ± 2%".
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { resolveMelee } from '@systems/combat/melee';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'cb_hit_table',
  milestone: 6,
  seed: 'cb-hit-table',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const at = w.index(40, 40, FLAT_TEST_SURFACE_Z);
    const attacker = w.spawnDwarf({ at });
    const defender = w.spawnDwarf({ at });

    const registry = w.game.registry;
    const entities = w.game.world.entities;

    // Equal agility (50)
    const attrsA = entities.get(attacker, C.Attributes);
    if (attrsA) entities.add(attacker, C.Attributes, { ...attrsA, agi: 50 });
    const attrsD = entities.get(defender, C.Attributes);
    if (attrsD) entities.add(defender, C.Attributes, { ...attrsD, agi: 50 });

    // Attacker wields axe with skill 5
    const itemsTable = registry.table('items');
    const materialsTable = registry.table('materials');
    const iron = materialsTable.index('iron');
    const axe = w.spawnItem(itemsTable.index('axe'), iron, at);
    entities.add(attacker, C.Equipment, {
      weapon: axe,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });
    w.setSkill(attacker, 'axe', 5);

    // Defender has dodge 5, without weapon or shield
    entities.add(defender, C.Equipment, {
      weapon: 0,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });
    w.setSkill(defender, 'dodge', 5);

    // Run 10,000 attacks
    const cooldownMap = new Map();
    let hits = 0;
    const TOTAL_ATTACKS = 10000;
    for (let i = 0; i < TOTAL_ATTACKS; i += 1) {
      const res = resolveMelee(
        {
          world: w.game.world,
          registry,
          rng: w.game.world.rngFor('16'),
          tick: i,
          emit: () => {},
        } as never,
        attacker,
        defender,
        cooldownMap,
        { skipXp: true },
      );
      if (res.outcome === 'hit') hits += 1;
    }

    const hitRate = hits / TOTAL_ATTACKS;
    // Expected: 50% ± 2% (0.48 to 0.52)
    expect(hitRate).toBeGreaterThanOrEqual(0.48);
    expect(hitRate).toBeLessThanOrEqual(0.52);
  },
};

export default scenario;
