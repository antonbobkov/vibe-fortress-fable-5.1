/**
 * T-390: a re-equip pass scores the items a kit can name, once per pass, and not every item of the
 * fortress once per slot of every soldier. The equipment it picks is the equipment the full scan picked.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat/reader';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

/** A small deterministic generator, so that the test world is the same on every run. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
}

const KIT_TYPES: readonly string[] = [
  'axe', 'great_axe', 'mace', 'maul', 'dagger', 'short_sword', 'spear', 'club', 'bow', 'crossbow', 'sling',
  'buckler', 'shield', 'cap', 'helm', 'breastplate', 'mail_shirt', 'gambeson', 'leather_jerkin', 'bracers',
  'gauntlets', 'greaves', 'leggings', 'leather_boots', 'metal_boots', 'quiver', 'arrow', 'bolt',
];
const MATERIALS: readonly string[] = ['copper', 'bronze', 'iron', 'steel', 'leather', 'oak'];

/** Twelve soldiers in three squads over a mixed stock: about 700 kit items among 4,000 other items. */
function staged(seed: string, others: number): { w: TestWorld; soldiers: EntityId[] } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const next = lcg(7);
  const registry = w.game.registry;
  const kit = KIT_TYPES.filter((t) => registry.table('items').has(t));
  for (let k = 0; k < 700; k += 1) {
    const type = kit[Math.floor(next() * kit.length)] as string;
    const material = MATERIALS[Math.floor(next() * MATERIALS.length)] as string;
    w.spawnItem(type, material, w.index(10 + (k % 20), 10 + Math.floor(k / 20) % 20, Z), 1 + Math.floor(next() * 3), 1 + Math.floor(next() * 5));
  }
  for (let k = 0; k < others; k += 1) w.spawnItem(k % 2 === 0 ? 'bar' : 'cheese', k % 2 === 0 ? 'iron' : 'dimcap', w.index(40 + (k % 20), 10 + Math.floor(k / 20) % 20, Z), 1);
  const soldiers: EntityId[] = [];
  for (let k = 0; k < 12; k += 1) {
    const d = w.spawnDwarf({ at: w.index(30, 30, Z) });
    for (const labor of ['mining', 'woodcutting']) w.game.world.applyCommand({ type: 'SetLabor', dwarfId: d, labor, on: false });
    soldiers.push(d);
  }
  const plans: { name: string; equipment: Record<string, unknown> }[] = [
    { name: 'Axes', equipment: { weaponClass: 'axe', armor: 'metal' } },
    { name: 'Bows', equipment: { weaponClass: 'bow', armor: 'leather', ranged: true } },
    { name: 'Any', equipment: { weaponClass: 'any', armor: 'any' } },
  ];
  plans.forEach((plan, k) => {
    w.game.world.applyCommand({ type: 'CreateSquad', name: plan.name });
    const squad = w.game.world.readers.of<CombatReader>('16').squads()[k]!;
    w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: squad.id, equipment: plan.equipment });
    w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: soldiers.slice(k * 4, k * 4 + 4) });
  });
  return { w, soldiers };
}

/** What the soldiers hold: weapon, shield, armor by slot, quiver and the ammunition they carry. */
function equipmentDigest(w: TestWorld, soldiers: readonly EntityId[]): string {
  const entities = w.game.world.entities;
  const rows: string[] = [];
  for (const id of soldiers) {
    const e = entities.get(id, C.Equipment);
    const carried = entities.with(C.Item).filter((i) => entities.get(i, C.Item)?.carriedBy === id);
    rows.push(`${id}:${e?.weapon},${e?.shield},${e?.armor.head},${e?.armor.body},${e?.armor.arms},${e?.armor.legs},${e?.armor.feet},${e?.quiver}|${carried.join(',')}`);
  }
  return rows.join(';');
}

describe('T-390 kit pool', () => {
  it('a pass over the squads scans the item table once, however many soldiers and slots there are', () => {
    const { w } = staged('t390-scans', 4000);
    const entities = w.game.world.entities;
    const original = entities.with.bind(entities);
    let itemScans = 0;
    entities.with = ((a: Parameters<typeof original>[0], b?: Parameters<typeof original>[1], c?: Parameters<typeof original>[2]) => {
      if (a === C.Item && b === undefined) itemScans += 1;
      return original(a, b, c);
    }) as typeof entities.with;
    // An item created on a tick re-equips every squad (16 § Equipment).
    w.spawnItem('cheese', 'dimcap', w.index(60, 60, Z), 1);
    itemScans = 0;
    w.step(1);
    entities.with = original;
    // 12 soldiers x (weapon, shield, 5 armor slots, quiver, ammunition) scans before; now the pool, and little more.
    expect(itemScans).toBeLessThanOrEqual(3);
  });

  it('the equipment after a day of created items is what the full scan chose (digest from before the pool)', () => {
    const { w, soldiers } = staged('t390-digest', 400);
    const digests: string[] = [equipmentDigest(w, soldiers)];
    const next = lcg(99);
    for (let day = 0; day < 6; day += 1) {
      for (let k = 0; k < 40; k += 1) {
        const type = KIT_TYPES[Math.floor(next() * KIT_TYPES.length)] as string;
        const material = MATERIALS[Math.floor(next() * MATERIALS.length)] as string;
        w.spawnItem(type, material, w.index(12 + k, 12 + day, Z), 1 + Math.floor(next() * 3), 1 + Math.floor(next() * 5));
        if (k % 8 === 7) w.step(1);
      }
      w.step(1);
      digests.push(equipmentDigest(w, soldiers));
    }
    expect(fnv(digests.join('\n'))).toBe('cec200a2');
  });
});
