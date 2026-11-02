import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat/reader';
import { blockChance } from '@systems/combat/melee';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

function camp(seed: string): { w: TestWorld; soldier: EntityId; squadId: EntityId; at: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const at = w.index(20, 20, Z);
  const soldier = w.spawnDwarf({ at });
  for (const labor of ['mining', 'woodcutting']) w.game.world.applyCommand({ type: 'SetLabor', dwarfId: soldier, labor, on: false });
  expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' }).ok).toBe(true);
  const squadId = w.game.world.readers.of<CombatReader>('16').squads()[0]!.id;
  expect(w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId, equipment: { weaponClass: 'any', armor: 'any' } }).ok).toBe(true);
  return { w, soldier, squadId, at };
}

function join(w: TestWorld, squadId: EntityId, soldier: EntityId): void {
  expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: [soldier] }).ok).toBe(true);
  w.step(1);
}

function loseArm(w: TestWorld, id: EntityId, part: 'left_arm' | 'right_arm'): void {
  w.game.world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part, damageType: 'edge', amount: 10_000 });
  w.step(3);
}

function typeOf(w: TestWorld, item: EntityId): string | undefined {
  const row = w.game.registry.table<{ id: string }>('items').byIndex(w.game.world.entities.get(item, C.Item)?.type ?? -1);
  return row?.id;
}

describe('T-460 a lost arm blocks two-handed weapons and shields', () => {
  it('a soldier who loses an arm lays down the shield and keeps a one-handed weapon', () => {
    const { w, soldier, squadId, at } = camp('t460-shield');
    w.spawnItem('mace', 'iron', at + 1, 1);
    const shield = w.spawnItem('shield', 'iron', at + 2, 1);
    join(w, squadId, soldier);
    const equip = (): { weapon: EntityId; shield: EntityId } => w.game.world.entities.get(soldier, C.Equipment)!;
    expect(equip().shield, 'holds the shield with both arms').toBe(shield);
    const weapon = equip().weapon;
    expect(typeOf(w, weapon)).toBe('mace');

    loseArm(w, soldier, 'left_arm');
    expect(equip().shield, 'the shield is off').toBe(0);
    expect(equip().weapon, 'the mace stays').toBe(weapon);
    const item = w.game.world.entities.get(shield, C.Item)!;
    expect(item.ownerId, 'nobody owns the shield now').toBe(0);
    expect(item.carriedBy ?? 0, 'nobody carries the shield now').toBe(0);
  });

  it('a soldier who loses an arm lays down a two-handed weapon and takes a one-handed one', () => {
    const { w, soldier, squadId, at } = camp('t460-great');
    const great = w.spawnItem('great_axe', 'steel', at + 1, 1);
    join(w, squadId, soldier);
    const equip = (): { weapon: EntityId } => w.game.world.entities.get(soldier, C.Equipment)!;
    expect(equip().weapon).toBe(great);
    w.spawnItem('mace', 'copper', at + 2, 1);

    loseArm(w, soldier, 'right_arm');
    expect(equip().weapon, 'the great axe is off').not.toBe(great);
    expect(typeOf(w, equip().weapon)).toBe('mace');
  });

  it('a soldier with one arm claims neither a two-handed weapon nor a shield', () => {
    const { w, soldier, squadId, at } = camp('t460-claim');
    loseArm(w, soldier, 'left_arm');
    w.spawnItem('great_axe', 'steel', at + 1, 1);
    w.spawnItem('shield', 'steel', at + 2, 1);
    const mace = w.spawnItem('mace', 'copper', at + 3, 1);
    join(w, squadId, soldier);
    const equip = w.game.world.entities.get(soldier, C.Equipment)!;
    expect(equip.weapon).toBe(mace);
    expect(equip.shield).toBe(0);
  });

  it('a soldier with no arms holds no weapon', () => {
    const { w, soldier, squadId, at } = camp('t460-none');
    w.spawnItem('mace', 'iron', at + 1, 1);
    join(w, squadId, soldier);
    loseArm(w, soldier, 'left_arm');
    loseArm(w, soldier, 'right_arm');
    expect(w.game.world.entities.get(soldier, C.Equipment)!.weapon).toBe(0);
  });

  it('losing a leg changes nothing', () => {
    const { w, soldier, squadId, at } = camp('t460-leg');
    const shield = w.spawnItem('shield', 'iron', at + 1, 1);
    join(w, squadId, soldier);
    w.game.world.emit({ type: 'DamageDealt', defenderId: soldier, attackerId: 0, part: 'left_leg', damageType: 'edge', amount: 10_000 });
    w.step(3);
    expect(w.game.world.entities.get(soldier, C.Equipment)!.shield).toBe(shield);
  });
});

describe('T-460 a buckler blocks an arrow as it blocks a blow', () => {
  it('one formula for both: min(30, 5 + 2 x skill), and min(40, 10 + 2 x skill) for a shield', () => {
    expect(blockChance(true, 0)).toBe(5);
    expect(blockChance(true, 10)).toBe(25);
    expect(blockChance(true, 20)).toBe(30);
    expect(blockChance(false, 10)).toBe(30);
    expect(blockChance(false, 20)).toBe(40);
  });
});

describe('T-460 deepsilver armor weighs half', () => {
  it('slows the wearer half as much as the same piece in steel', () => {
    const speed = (material: string): number => {
      const { w, soldier, squadId, at } = camp(`t460-weight-${material}`);
      w.spawnItem('breastplate', material, at + 1, 1);
      join(w, squadId, soldier);
      expect(w.game.world.entities.get(soldier, C.Equipment)!.armor.body).not.toBe(0);
      return w.game.world.readers.of<CombatReader>('16').armorSpeedModifier(soldier);
    };
    const steel = 100 - speed('steel');
    const deepsilver = 100 - speed('deepsilver');
    expect(steel).toBeGreaterThan(1);
    const weight = new TestWorld({ seed: 't460-table', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' }).game.registry.table<{ id: string; weight: number }>('armor').byId('breastplate')!.weight;
    expect(steel).toBe(Math.floor(weight / 4));
    expect(deepsilver).toBe(Math.floor(weight / 2 / 4));
  });
});
