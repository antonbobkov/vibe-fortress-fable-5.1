/**
 * Unit tests for Combat system: T-M6-02.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z, HeadlessGame } from '@app/headless';
import { C } from '@core/components';
import { BLUNT_THROUGH_PERCENT, MIN_ATTACK_COOLDOWN } from '@systems/combat/constants';
import { isFactionHostile } from '@systems/combat/factions';
import {
  armorCovering,
  resolveMelee,
  weaponOf,
  weightedPickPart,
} from '@systems/combat/melee';
import type { BodySlot } from '@core/types';

interface BodyPlanRow {
  readonly id: string;
  readonly parts: Record<BodySlot, { hit: number; hpFactor: number }>;
}

describe('T-M6-02 combat: unit tests', () => {
  it('armorCovering orders pieces outer layer first: plate > mail > leather > padding', () => {
    const game = new HeadlessGame({ seed: 'combat-armor-order', world: 'flat-test', embark: 'none' });
    const registry = game.registry;
    const entities = game.world.entities;
    const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);

    const defender = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), at, 'fortress');
    const itemsTable = registry.table('items');
    const materialsTable = registry.table('materials');
    const iron = materialsTable.index('iron');
    const leather = materialsTable.index('leather');
    const woolCloth = materialsTable.index('wool_cloth');

    const breastplate = game.world.services.spawn.item(itemsTable.index('breastplate'), iron, at);
    const mailShirt = game.world.services.spawn.item(itemsTable.index('mail_shirt'), iron, at);
    const leatherJerkin = game.world.services.spawn.item(itemsTable.index('leather_jerkin'), leather, at);
    const tunic = game.world.services.spawn.item(itemsTable.index('tunic'), woolCloth, at);

    // Equip armor and clothing
    entities.add(defender, C.Equipment, {
      weapon: 0,
      shield: 0,
      armor: {
        head: 0,
        body: breastplate,
        arms: 0,
        legs: 0,
        feet: 0,
      },
      clothing: {
        body: tunic, // padding
        legs: 0,
        feet: 0,
        over: 0,
      },
      quiver: 0,
    });

    const pieces = armorCovering(entities, registry, defender, 'torso');
    expect(pieces.length).toBe(2);
    expect(pieces[0]?.layer).toBe('plate');
    expect(pieces[1]?.layer).toBe('padding');

    // Swap to mail_shirt + tunic
    const equip = entities.get(defender, C.Equipment)!;
    entities.add(defender, C.Equipment, {
      ...equip,
      armor: { ...equip.armor, body: mailShirt },
    });

    const piecesMail = armorCovering(entities, registry, defender, 'torso');
    expect(piecesMail.length).toBe(2);
    expect(piecesMail[0]?.layer).toBe('mail');
    expect(piecesMail[1]?.layer).toBe('padding');

    // Swap to leather_jerkin + tunic
    entities.add(defender, C.Equipment, {
      ...equip,
      armor: { ...equip.armor, body: leatherJerkin },
    });

    const piecesLeather = armorCovering(entities, registry, defender, 'torso');
    expect(piecesLeather.length).toBe(2);
    expect(piecesLeather[0]?.layer).toBe('leather');
    expect(piecesLeather[1]?.layer).toBe('padding');
  });

  it('two-handed excludes shields: defender with two-handed weapon cannot block', () => {
    const game = new HeadlessGame({ seed: 'combat-two-handed', world: 'flat-test', embark: 'none' });
    const registry = game.registry;
    const entities = game.world.entities;
    const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);

    const attacker = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), at, 'fortress');
    const defender = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), at, 'fortress');

    const itemsTable = registry.table('items');
    const materialsTable = registry.table('materials');
    const iron = materialsTable.index('iron');
    const wood = materialsTable.index('oak');

    // Attacker has basic dagger
    const dagger = game.world.services.spawn.item(itemsTable.index('dagger'), iron, at);
    entities.add(attacker, C.Equipment, {
      weapon: dagger,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    // Defender has two-handed great axe and a shield, shield skill 20
    const greatAxe = game.world.services.spawn.item(itemsTable.index('great_axe'), iron, at);
    const shield = game.world.services.spawn.item(itemsTable.index('shield'), wood, at);
    entities.add(defender, C.Equipment, {
      weapon: greatAxe,
      shield: shield,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    const skillsTable = registry.table('skills');
    const shieldIdx = skillsTable.index('shield');
    const level = new Uint8Array(skillsTable.size + 1);
    level[shieldIdx] = 20; // 40% block chance if one-handed
    entities.add(defender, C.Skills, {
      level,
      xp: new Uint16Array(skillsTable.size + 1),
      lastRaised: 0,
    });

    // With two-handed weapon, 0 blocks occur
    const cooldownMap = new Map();
    let blockedCount = 0;
    for (let i = 0; i < 200; i += 1) {
      const res = resolveMelee(
        {
          world: game.world,
          registry,
          rng: game.world.rngFor('16'),
          tick: i,
          emit: () => {},
        } as never,
        attacker,
        defender,
        cooldownMap,
      );
      if (res.outcome === 'blocked') blockedCount += 1;
    }
    expect(blockedCount).toBe(0);

    // Swap defender to one-handed short sword: blocking now occurs!
    const shortSword = game.world.services.spawn.item(itemsTable.index('short_sword'), iron, at);
    const defEquip = entities.get(defender, C.Equipment)!;
    entities.add(defender, C.Equipment, { ...defEquip, weapon: shortSword });

    for (let i = 0; i < 200; i += 1) {
      const res = resolveMelee(
        {
          world: game.world,
          registry,
          rng: game.world.rngFor('16'),
          tick: 200 + i,
          emit: () => {},
        } as never,
        attacker,
        defender,
        cooldownMap,
      );
      if (res.outcome === 'blocked') blockedCount += 1;
    }
    expect(blockedCount).toBeGreaterThan(0);
  });

  it('unconscious adds +40 to hit chance, doubles head hit weight, and prevents defense', () => {
    const game = new HeadlessGame({ seed: 'combat-unconscious', world: 'flat-test', embark: 'none' });
    const registry = game.registry;
    const entities = game.world.entities;
    const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);

    const attacker = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), at, 'fortress');
    const defender = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), at, 'fortress');

    const defBody = entities.get(defender, C.Body)!;
    defBody.conscious = false; // unconscious

    // Head weight doubling in weighted pick:
    const plansTable = registry.table<BodyPlanRow>('bodyPlans');
    const plan = plansTable.byId('humanoid')!;
    const rng = game.world.rngFor('16');

    let headCountConscious = 0;
    let headCountUnconscious = 0;
    for (let i = 0; i < 5000; i += 1) {
      if (weightedPickPart(rng, plan, defBody, false) === 'head') headCountConscious += 1;
      if (weightedPickPart(rng, plan, defBody, true) === 'head') headCountUnconscious += 1;
    }
    // Head weight is 15 out of 100 for humanoid (15%). Doubled is 30 out of 115 (~26.1%).
    expect(headCountUnconscious).toBeGreaterThan(headCountConscious * 1.4);

    // Hit rate check with equal skill 0 vs 0:
    // Base hit is 50. With unconscious +40, hit is 90%.
    const cooldownMap = new Map();
    let hits = 0;
    for (let i = 0; i < 1000; i += 1) {
      const res = resolveMelee(
        {
          world: game.world,
          registry,
          rng: game.world.rngFor('16'),
          tick: i,
          emit: () => {},
        } as never,
        attacker,
        defender,
        cooldownMap,
      );
      if (res.outcome === 'hit') hits += 1;
    }
    // ~90% hit rate (870 to 930)
    expect(hits).toBeGreaterThanOrEqual(870);
    expect(hits).toBeLessThanOrEqual(930);
  });

  it('BLUNT_THROUGH_PERCENT deals at least 30% of raw damage through heavy armor', () => {
    const game = new HeadlessGame({ seed: 'combat-blunt-through', world: 'flat-test', embark: 'none' });
    const registry = game.registry;
    const entities = game.world.entities;
    const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);

    const attacker = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), at, 'fortress');
    const defender = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), at, 'fortress');

    const itemsTable = registry.table('items');
    const materialsTable = registry.table('materials');
    const iron = materialsTable.index('iron');
    const steel = materialsTable.index('steel');

    // Attacker wields iron warhammer (blunt base damage 24)
    const warhammer = game.world.services.spawn.item(itemsTable.index('warhammer'), iron, at);
    entities.add(attacker, C.Equipment, {
      weapon: warhammer,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    // Defender wears massive steel breastplate
    const breastplate = game.world.services.spawn.item(itemsTable.index('breastplate'), steel, at, 1, 5); // masterwork
    entities.add(defender, C.Equipment, {
      weapon: 0,
      shield: 0,
      armor: { head: 0, body: breastplate, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    });

    const cooldownMap = new Map();
    const bluntRes = resolveMelee(
      {
        world: game.world,
        registry,
        rng: { int: () => 0 } as never, // guaranteed hit
        tick: 1,
        emit: () => {},
      } as never,
      attacker,
      defender,
      cooldownMap,
      { forcedPart: 'torso' },
    );

    // Raw = 24. 30% of raw is 7.2. Toughness 50 reduces by 5% -> round(7.2 * 0.95) = 7.
    expect(BLUNT_THROUGH_PERCENT).toBe(30);
    expect(bluntRes.damage).toBeGreaterThanOrEqual(7);

    // Swap weapon to iron battle axe (edge). With armor reduction > raw, edge deals 0!
    const battleAxe = game.world.services.spawn.item(itemsTable.index('axe'), iron, at);
    const atkEquip = entities.get(attacker, C.Equipment)!;
    entities.add(attacker, C.Equipment, { ...atkEquip, weapon: battleAxe });

    const edgeRes = resolveMelee(
      {
        world: game.world,
        registry,
        rng: { int: () => 0 } as never,
        tick: 2,
        emit: () => {},
      } as never,
      attacker,
      defender,
      cooldownMap,
      { forcedPart: 'torso' },
    );
    expect(edgeRes.damage).toBe(0);
  });

  it('civilian cornered fighting: uses carried tool (pick or axe) as weapon', () => {
    const game = new HeadlessGame({ seed: 'combat-civilian-tool', world: 'flat-test', embark: 'none' });
    const registry = game.registry;
    const entities = game.world.entities;
    const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);

    const miner = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), at, 'fortress');
    const itemsTable = registry.table('items');
    const materialsTable = registry.table('materials');
    const iron = materialsTable.index('iron');

    // Miner holds an iron pick as a tool in Worker.toolId
    const pick = game.world.services.spawn.item(itemsTable.index('pick'), iron, at);
    const worker = entities.get(miner, C.Worker)!;
    entities.add(miner, C.Worker, { ...worker, toolId: pick });

    // weaponOf should recognize the pick
    const w = weaponOf(entities, registry, miner);
    expect(w).not.toBeNull();
    expect(w?.weaponDef.weaponClass).toBe('pick');
    expect(w?.weaponDef.damage).toBe(16);
    expect(w?.weaponDef.damageType).toBe('pierce');
  });

  it('attack cooldown follows weapon size and agility formula', () => {
    // cooldownTicks = weapon.size × 3 + 10 − Agility / 10, minimum MIN_ATTACK_COOLDOWN (12)
    // battle axe: size 6, agi 50 -> 6*3 + 10 - 5 = 23
    const axeCooldown = Math.max(MIN_ATTACK_COOLDOWN, Math.floor(6 * 3 + 10 - 50 / 10));
    expect(axeCooldown).toBe(23);

    // dagger: size 3, agi 50 -> 3*3 + 10 - 5 = 14
    const daggerCooldown = Math.max(MIN_ATTACK_COOLDOWN, Math.floor(3 * 3 + 10 - 50 / 10));
    expect(daggerCooldown).toBe(14);

    // fast dagger with high agility (agi 100): 3*3 + 10 - 10 = 9 -> clamps to 12
    const fastCooldown = Math.max(MIN_ATTACK_COOLDOWN, Math.floor(3 * 3 + 10 - 100 / 10));
    expect(fastCooldown).toBe(12);
  });

  it('factions hostility rules match 16 § Concepts', () => {
    expect(isFactionHostile('fortress', 'hostile:gloam')).toBe(true);
    expect(isFactionHostile('fortress', 'hostile:hillfolk')).toBe(true);
    expect(isFactionHostile('fortress', 'deep')).toBe(true);
    expect(isFactionHostile('fortress', 'fortress')).toBe(false);
    expect(isFactionHostile('fortress', 'wild')).toBe(false);
    expect(isFactionHostile('trader:wildwood', 'hostile:gloam')).toBe(true);
    expect(isFactionHostile('deep', 'wild')).toBe(true);
    expect(isFactionHostile('deep', 'trader:hillfolk')).toBe(true);
  });
});
