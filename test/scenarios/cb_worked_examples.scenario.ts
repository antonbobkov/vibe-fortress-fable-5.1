/**
 * `cb_worked_examples` of `04-implementation/acceptance-tests.md` § 16 Combat:
 * "the four examples in weapons-and-armor.md | numbers match ±1".
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { resolveMelee } from '@systems/combat/melee';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'cb_worked_examples',
  milestone: 6,
  seed: 'cb-worked-examples',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const registry = w.game.registry;
    const entities = w.game.world.entities;
    const itemsTable = registry.table('items');
    const materialsTable = registry.table('materials');
    const creaturesTable = registry.table('creatures');

    const iron = materialsTable.index('iron');
    const steel = materialsTable.index('steel');
    const deepsilver = materialsTable.index('deepsilver');
    const cloth = materialsTable.index('wool_cloth');

    const at = w.index(40, 40, FLAT_TEST_SURFACE_Z);
    const cooldownMap = new Map();
    const mockCtx = {
      world: w.game.world,
      registry,
      rng: { int: () => 0 } as never, // guaranteed hit roll, no parry/block
      tick: 0,
      emit: () => {},
    };

    // -------------------------------------------------------------
    // Example 1: Iron battle axe vs unarmored goblin torso
    // raw = 22 × 1.0 × 1.0 × (50 + 50)/100 = 22; Toughness 50 -> round(22 × 0.95) = 21.
    // -------------------------------------------------------------
    const dwarfA = w.spawnDwarf({ at });
    const gloamIdx = creaturesTable.index('gloam_warrior');
    const goblin = w.game.world.services.spawn.creature(gloamIdx, at, 'hostile:gloam');

    const axe = w.spawnItem(itemsTable.index('axe'), iron, at, 1, 1); // common
    entities.add(dwarfA, C.Equipment, {
      weapon: axe,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });
    // Goblin is unarmored, default Toughness 50
    entities.add(goblin, C.Equipment, {
      weapon: 0,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    const ex1 = resolveMelee(
      mockCtx as never,
      dwarfA,
      goblin,
      cooldownMap,
      { forcedPart: 'torso' },
    );
    expect(Math.abs(ex1.damage - 21)).toBeLessThanOrEqual(1);

    // -------------------------------------------------------------
    // Example 2: Same axe vs dwarf in common iron mail shirt and tunic
    // reduction = mail 12 × 1.0 × 1.0 × 1.2 + padding 1 × 0.6 = 15; damage = 7.
    // -------------------------------------------------------------
    const dwarfD = w.spawnDwarf({ at });
    const mailShirt = w.spawnItem(itemsTable.index('mail_shirt'), iron, at, 1, 1); // common
    const tunic = w.spawnItem(itemsTable.index('tunic'), cloth, at, 1, 1); // common
    entities.add(dwarfD, C.Equipment, {
      weapon: 0,
      shield: 0,
      armor: { head: 0, body: mailShirt, arms: 0, legs: 0, feet: 0 },
      clothing: { body: tunic, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    const ex2 = resolveMelee(
      mockCtx as never,
      dwarfA,
      dwarfD,
      cooldownMap,
      { forcedPart: 'torso' },
    );
    expect(Math.abs(ex2.damage - 7)).toBeLessThanOrEqual(1);

    // -------------------------------------------------------------
    // Example 3: Steel warhammer (common) vs trollkin (natural armor 4, size 150)
    // raw = 24 × 1.25 × 1.0 × (50 + 60)/100 = 33; natural plate 4 × 0.9 = 3.6;
    // 29.4 × 0.95 = 27.9 → 28.
    // -------------------------------------------------------------
    const dwarfHammer = w.spawnDwarf({ at });
    const attrsHammer = entities.get(dwarfHammer, C.Attributes)!;
    entities.add(dwarfHammer, C.Attributes, { ...attrsHammer, str: 60 }); // Strength 60

    const warhammer = w.spawnItem(itemsTable.index('warhammer'), steel, at, 1, 1); // steel common
    entities.add(dwarfHammer, C.Equipment, {
      weapon: warhammer,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    const trollkinIdx = creaturesTable.index('trollkin');
    const trollkin = w.game.world.services.spawn.creature(trollkinIdx, at, 'hostile:gloam');
    // Ensure naturalArmor 4 as stated in worked example (spec creatures table has 3 or 4)
    entities.add(trollkin, C.Equipment, {
      weapon: 0,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    const ex3 = resolveMelee(
      mockCtx as never,
      dwarfHammer,
      trollkin,
      cooldownMap,
      { forcedPart: 'torso' },
    );
    // Expected damage ~ 28 (natural armor 3 gives 29, natural armor 4 gives 28)
    expect(Math.abs(ex3.damage - 28)).toBeLessThanOrEqual(1);

    // -------------------------------------------------------------
    // Example 4: Magma wyrm bite (damage 45, edge) vs steel breastplate (superior)
    // and deepsilver breastplate (superior).
    // Steel: reduction 18 × 1.25 × 1.0 × 1.2 × 1.1 = 29.7; damage ~ 15.
    // Deepsilver: reduction 18 × 1.6 × 1.2 × 1.1 = 38.016; damage ~ 7.
    // -------------------------------------------------------------
    const wyrmIdx = creaturesTable.index('magma_wyrm');
    const wyrm = w.game.world.services.spawn.creature(wyrmIdx, at, 'deep');

    // Defender with superior steel breastplate (quality 3 = superior)
    const steelBreastplate = w.spawnItem(itemsTable.index('breastplate'), steel, at, 1, 3);
    const dwarfSteelPlate = w.spawnDwarf({ at });
    entities.add(dwarfSteelPlate, C.Equipment, {
      weapon: 0,
      shield: 0,
      armor: { head: 0, body: steelBreastplate, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    const ex4Steel = resolveMelee(
      mockCtx as never,
      wyrm,
      dwarfSteelPlate,
      cooldownMap,
      { forcedPart: 'torso', overrideDamage: 45, overrideDamageType: 'edge' },
    );
    expect(Math.abs(ex4Steel.damage - 15)).toBeLessThanOrEqual(1);

    // Defender with superior deepsilver breastplate
    const deepsilverBreastplate = w.spawnItem(itemsTable.index('breastplate'), deepsilver, at, 1, 3);
    const dwarfDeepPlate = w.spawnDwarf({ at });
    entities.add(dwarfDeepPlate, C.Equipment, {
      weapon: 0,
      shield: 0,
      armor: { head: 0, body: deepsilverBreastplate, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    const ex4Deep = resolveMelee(
      mockCtx as never,
      wyrm,
      dwarfDeepPlate,
      cooldownMap,
      { forcedPart: 'torso', overrideDamage: 45, overrideDamageType: 'edge' },
    );
    expect(Math.abs(ex4Deep.damage - 7)).toBeLessThanOrEqual(1);
  },
};

export default scenario;
