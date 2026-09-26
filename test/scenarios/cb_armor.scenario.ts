/**
 * `cb_armor` of `04-implementation/acceptance-tests.md` § 16 Combat:
 * "a common iron axe (attacker Strength 50) vs a common iron mail shirt and tunic
 * (defender Toughness 50), 1,000 torso hits | damage 7 on every hit; every wound light".
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { resolveMelee } from '@systems/combat/melee';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'cb_armor',
  milestone: 6,
  seed: 'cb-armor',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const at = w.index(40, 40, FLAT_TEST_SURFACE_Z);
    const attacker = w.spawnDwarf({ at });
    const defender = w.spawnDwarf({ at });

    const registry = w.game.registry;
    const entities = w.game.world.entities;

    // Attacker Strength 50
    const attrsA = entities.get(attacker, C.Attributes);
    if (attrsA) entities.add(attacker, C.Attributes, { ...attrsA, str: 50 });

    // Defender Toughness 50
    const attrsD = entities.get(defender, C.Attributes);
    if (attrsD) entities.add(defender, C.Attributes, { ...attrsD, tou: 50 });

    // Attacker wields common iron axe (battle axe)
    const itemsTable = registry.table('items');
    const materialsTable = registry.table('materials');
    const iron = materialsTable.index('iron');
    const cloth = materialsTable.index('wool_cloth');

    const axe = w.spawnItem(itemsTable.index('axe'), iron, at, 1, 1); // common quality
    entities.add(attacker, C.Equipment, {
      weapon: axe,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    // Defender wears common iron mail shirt and common tunic
    const mailShirt = w.spawnItem(itemsTable.index('mail_shirt'), iron, at, 1, 1); // common quality
    const tunic = w.spawnItem(itemsTable.index('tunic'), cloth, at, 1, 1); // common quality
    entities.add(defender, C.Equipment, {
      weapon: 0,
      shield: 0,
      armor: { head: 0, body: mailShirt, arms: 0, legs: 0, feet: 0 },
      clothing: { body: tunic, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    // 1,000 torso hits
    const cooldownMap = new Map();
    const TOTAL_HITS = 1000;
    const dealtEvents: { amount: number; part: string }[] = [];

    const mockCtx = {
      world: w.game.world,
      registry,
      rng: { int: () => 0 } as never, // hit succeeds (roll 0 < hit)
      tick: 0,
      emit: (e: Record<string, unknown>) => {
        if (e['type'] === 'DamageDealt') {
          dealtEvents.push({
            amount: e['amount'] as number,
            part: e['part'] as string,
          });
        }
      },
    };

    for (let i = 0; i < TOTAL_HITS; i += 1) {
      mockCtx.tick = i;
      const res = resolveMelee(
        mockCtx as never,
        attacker,
        defender,
        cooldownMap,
        { forcedPart: 'torso', skipXp: true },
      );
      expect(res.outcome).toBe('hit');
      expect(res.damage).toBe(7);
      expect(res.part).toBe('torso');
    }

    expect(dealtEvents.length).toBe(TOTAL_HITS);
    for (const evt of dealtEvents) {
      expect(evt.amount).toBe(7);
      expect(evt.part).toBe('torso');
      // Torso maxHp = 60. Ratio = 7 / 60 = 0.1167 (< 0.25 LIGHT_MAX) -> light wound
      const ratio = evt.amount / 60;
      expect(ratio).toBeLessThan(0.25);
    }
  },
};

export default scenario;
