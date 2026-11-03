/**
 * T-476: rare materials, deepsilver pressure, their draughts and the legend (`25-runecraft.md`
 * § Rare materials, § Deepsilver, § Draughts, § Enchantments in combat; `13` § Corpses, § Value;
 * `18` § The Deep; `creatures.md` § Remains).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C, ItemFlag } from '@core/components';
import { effectValue } from '@core/effects';
import type { EntityId, Quality, TileIndex } from '@core/types';
import { contentRegistry } from '@content/loader';
import type { CombatReader, SquadWithId } from '@systems/combat';
import type { ItemsReader } from '@systems/items';
import { wornSpotRadius } from '@systems/magic/enchant';
import { soldierTrigger } from '@systems/magic/draughts';
import { SPOT_RADIUS } from '@systems/threats/constants';
import { findEmergenceBaseTile, triggerDeepEmergence } from '@systems/threats/deep';
import type { ThreatsReader } from '@systems/threats';
import { enchantLine } from '@ui/panels/look';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const strings = new Strings(registry);
const enchants = registry.table<{ id: string; slot: string; stone: string; vials: number; only?: string; effects: { kind: string; value: number }[] }>('enchants');
const recipes = registry.table<{ id: string; workshop: string; inputs: { match: string; count: number; material?: string }[]; outputs: { item: string; count: number }[]; spoilable?: boolean }>('recipes');

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

const items = (w: TestWorld): ItemsReader => w.readers.of<ItemsReader>('13');
const typeId = (w: TestWorld, id: EntityId): string => registry.table('items').idOf(w.game.world.entities.get(id, C.Item)!.type) ?? '';

/** Kill a creature as 17 does, and return its corpse. */
function corpseOf(w: TestWorld, id: EntityId): EntityId {
  w.game.world.emit({ type: 'Starvation', id });
  w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === id), 60);
  return w.events('CorpseCreated').find((e) => e['creatureId'] === id)!['id'] as EntityId;
}

/** Run one order at a workshop of `type` by a worker with `skill`, with `stock` on the floor. */
function work(w: TestWorld, type: string, recipeId: string, skill: string, stock: [string, string, number][]): EntityId {
  const ws = w.build(type, w.index(12, 12, Z), 'granite');
  w.spawnDwarf({ at: w.index(16, 16, Z), skills: { [skill]: 5 } });
  for (const [item, material, count] of stock) w.spawnItem(item, material, w.index(16, 14, Z), count);
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: ws, order: { recipeId, mode: 'once', remaining: 1, priority: 5 } }).ok).toBe(true);
  w.until((x) => x.events('WorkOrderCompleted').some((e) => e['recipeId'] === recipeId), 4000);
  w.step(2);
  return ws;
}

function squad(w: TestWorld, members: EntityId[], station: TileIndex, draughts: string[]): SquadWithId {
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
  const all = w.readers.of<CombatReader>('16').squads();
  const s = all[all.length - 1] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: station });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
  expect(w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { draughts } }).ok).toBe(true);
  w.step(1);
  return s;
}

function drunk(w: TestWorld, id: EntityId): string[] {
  return w.events('DraughtDrunk').filter((e) => e['id'] === id).map((e) => e['draughtId'] as string);
}

describe('T-476 content', () => {
  it('wyrmscale and hollow ichor are items made of the material of their own id, worth 80 and 60', () => {
    const itemRows = registry.table<{ id: string; category: string; stack: number; container: string }>('items');
    expect(itemRows.byId('wyrmscale')).toMatchObject({ category: 'medical/wyrmscale', stack: 10, container: 'bag' });
    expect(itemRows.byId('hollow_ichor')).toMatchObject({ category: 'medical/ichor', stack: 5, container: 'bag' });
    const w = arena('t476-values');
    expect(items(w).value(w.spawnItem('wyrmscale', 'wyrmscale', w.index(10, 10, Z), 1))).toBe(80);
    expect(items(w).value(w.spawnItem('hollow_ichor', 'hollow_ichor', w.index(10, 11, Z), 1))).toBe(60);
    const creatures = registry.table<{ id: string; remains?: { item: string; count: number }[] }>('creatures');
    expect(creatures.byId('magma_wyrm')?.remains).toEqual([{ item: 'wyrmscale', count: 4 }]);
    expect(creatures.byId('hollow_stalker')?.remains).toEqual([{ item: 'hollow_ichor', count: 1 }]);
    expect(creatures.byId('hollow_maw')?.remains).toEqual([{ item: 'hollow_ichor', count: 1 }]);
    expect(creatures.byId('hollow_crawler')?.remains).toBeUndefined();
    // New rows number last.
    expect(registry.table('items').index('wyrmscale')).toBeGreaterThan(registry.table('items').index('murky_draught'));
    expect(registry.table('materials').index('hollow_ichor')).toBeGreaterThan(registry.table('materials').index('rune'));
  });

  it('the four enchantments: a deepsilver bar, an ichor and a wyrmscale as stones; hollowsight on the head only', () => {
    expect(enchants.byId('deep')).toMatchObject({ slot: 'weapon', stone: 'deepsilver', vials: 12,
      effects: [{ kind: 'damage_percent', value: 25 }, { kind: 'vs_deep_percent', value: 50 }] });
    expect(enchants.byId('hollowbane')).toMatchObject({ slot: 'weapon', stone: 'hollow_ichor', vials: 8, effects: [{ kind: 'vs_deep_percent', value: 100 }] });
    expect(enchants.byId('wyrmhide')).toMatchObject({ slot: 'armor', stone: 'wyrmscale', vials: 8, effects: [{ kind: 'fire_percent', value: 0 }] });
    // One rule for the helm and the draught: spots within 10.
    expect(enchants.byId('hollowsight')).toMatchObject({ slot: 'armor', stone: 'hollow_ichor', vials: 8, only: 'head', effects: [{ kind: 'spot_radius', value: 4 }] });
    expect(SPOT_RADIUS + 4).toBe(10);
    expect(recipes.byId('set_weapon_deep')?.inputs.slice(1)).toEqual([{ match: 'bar', count: 1, material: 'deepsilver' }, { match: 'rune_vial', count: 12 }]);
    expect(recipes.byId('set_weapon_hollowbane')?.inputs.slice(1)).toEqual([{ match: 'hollow_ichor', count: 1 }, { match: 'rune_vial', count: 8 }]);
    expect(recipes.byId('set_armor_wyrmhide')?.inputs[1]).toEqual({ match: 'wyrmscale', count: 1 });
    const heads = recipes.byId('set_armor_hollowsight')!.inputs[0]!.match.split('|');
    const armor = registry.table<{ id: string; armorSlot: string }>('armor');
    expect(heads.length).toBeGreaterThan(0);
    for (const id of heads) expect(armor.byId(id)?.armorSlot, id).toBe('head');
  });

  it('an item stone is valued as one unit of its item: hollowbane adds 60 × 3 + 8 × 15, deep 250 × 3 + 12 × 15', () => {
    const w = arena('t476-stone-value');
    const value = (enchant: string, tier: Quality = 1): number => {
      const axe = w.spawnItem('axe', 'iron', w.index(10, 10, Z), 1);
      const before = items(w).value(axe);
      w.items.setEnchant!(axe, { id: enchants.index(enchant), tier });
      return items(w).value(axe) - before;
    };
    expect(value('hollowbane')).toBe(300);
    expect(value('deep')).toBe(930);
    expect(value('wyrmhide')).toBe(360);
    const axe = w.spawnItem('axe', 'iron', w.index(11, 10, Z), 1);
    w.items.setEnchant!(axe, { id: enchants.index('deep'), tier: 1 });
    expect(enchantLine(w.readers, strings, axe)).toBe('+25% damage. +50% damage against the Hollow-born.');
  });

  it('the laboratory quenches a bar, renders an ichor and brews the two draughts', () => {
    expect(recipes.byId('quench_deepsilver')).toMatchObject({ workshop: 'alchemist', inputs: [{ match: 'bar', count: 1, material: 'deepsilver' }], outputs: [{ item: 'rune_vial', count: 12 }] });
    expect(recipes.byId('render_ichor')).toMatchObject({ workshop: 'alchemist', inputs: [{ match: 'hollow_ichor', count: 1 }], outputs: [{ item: 'rune_vial', count: 6 }] });
    expect(recipes.byId('brew_hollowsight_draught')).toMatchObject({ spoilable: true, outputs: [{ item: 'hollowsight_draught', count: 2 }] });
    expect(recipes.byId('brew_wyrmblood_draught')).toMatchObject({ spoilable: true, outputs: [{ item: 'wyrmblood_draught', count: 2 }] });
    const draughts = registry.table<{ id: string; effects: { kind: string; value: number }[]; trigger: string }>('draughts');
    expect(draughts.byId('hollowsight_draught')).toEqual({ id: 'hollowsight_draught', effects: [{ kind: 'spot_radius', value: 10 }], trigger: 'deep' });
    expect(draughts.byId('wyrmblood_draught')).toEqual({ id: 'wyrmblood_draught', effects: [{ kind: 'fire_immune', value: 1 }], trigger: 'fire' });
    expect(soldierTrigger('deep') && soldierTrigger('fire')).toBe(true);
    expect(soldierTrigger('miserable') || soldierTrigger('never')).toBe(false);
  });

  it('the deepsilver confirmation says that working it wakes the Hollow too', () => {
    expect(strings.get('confirm.c_deepsilver')).toContain('where it was mined. Working it at the runeforge or the laboratory wakes the Hollow too. Mine it?');
  });
});

describe('T-476 remains', () => {
  it('a dead wyrm leaves 4 wyrmscale on its corpse, foreign and worth nothing until strip_corpse recovers them', () => {
    const w = arena('t476-wyrm');
    const wyrm = w.spawnCreature('magma_wyrm', w.index(20, 20, Z), 'wild');
    const corpse = corpseOf(w, wyrm);
    const worn = w.game.world.entities.get(corpse, C.Corpse)!.wornItems;
    expect(worn.map((id) => typeId(w, id))).toEqual(['wyrmscale']);
    const scale = worn[0]!;
    const item = w.game.world.entities.get(scale, C.Item)!;
    expect(item.count).toBe(4);
    expect(registry.table('materials').idOf(item.material)).toBe('wyrmscale');
    expect(item.flags & ItemFlag.Foreign).not.toBe(0);
    expect(items(w).count(item.type)).toBe(0);
    // A save keeps them on the corpse.
    expect(roundTrip(w.game).game.hash()).toBe(w.hash());
    const hauler = w.spawnDwarf({ at: w.index(18, 18, Z) });
    w.setLabor(hauler, 'hauling', true);
    const before = items(w).wealth();
    w.until(() => w.events('JobCompleted').some((e) => e['jobType'] === 'strip_corpse'), 3000);
    expect(w.game.world.entities.get(corpse, C.Corpse)?.wornItems).toEqual([]);
    expect(w.game.world.entities.get(scale, C.Item)!.flags & ItemFlag.Foreign).toBe(0);
    expect(items(w).count(item.type)).toBe(4);
    expect(items(w).wealth() - before).toBe(320);
  });

  it('a stalker and the Maw leave one ichor each; a crawler leaves none', () => {
    const w = arena('t476-hollow');
    const leaves = (species: string, x: number): string[] => {
      const id = w.spawnCreature(species, w.index(x, 20, Z), 'deep');
      return w.game.world.entities.get(corpseOf(w, id), C.Corpse)!.wornItems.map((i) => `${typeId(w, i)} ${w.game.world.entities.get(i, C.Item)!.count}`);
    };
    expect(leaves('hollow_stalker', 10)).toEqual(['hollow_ichor 1']);
    expect(leaves('hollow_maw', 20)).toEqual(['hollow_ichor 1']);
    expect(leaves('hollow_crawler', 30)).toEqual([]);
  });
});

describe('T-476 deepsilver pressure', () => {
  const pressure = (w: TestWorld): number => w.game.world.fortress.deepPressure;
  const worked = (w: TestWorld): number[] => w.events('DeepsilverWorked').map((e) => e['amount'] as number);

  it('a quench at the laboratory raises the pressure by 10 from the workshop\'s tile, and makes 12 vials', () => {
    const w = arena('t476-quench');
    const lab = work(w, 'alchemist', 'quench_deepsilver', 'alchemy', [['bar', 'deepsilver', 1]]);
    expect(worked(w)).toEqual([10]);
    expect(w.events('DeepsilverWorked')[0]!['tile']).toBe(w.game.world.entities.get(lab, C.Building)!.origin);
    expect(pressure(w)).toBe(10);
    expect(w.readers.of<ThreatsReader>('18').deepPressure()).toBe(10);
    const vials = w.game.world.entities.with(C.Item).filter((id) => typeId(w, id) === 'rune_vial');
    expect(vials.reduce((n, id) => n + w.game.world.entities.get(id, C.Item)!.count, 0)).toBe(12);
  });

  it('a deepsilver staff and a deep setting at the runeforge raise it by 10 each; an iron staff raises nothing', () => {
    const staff = arena('t476-staff');
    work(staff, 'runeforge', 'make_staff_garnet', 'runesmithing', [['log', 'oak', 1], ['cut_gem', 'garnet', 1], ['bar', 'deepsilver', 1]]);
    expect(worked(staff)).toEqual([10]);
    expect(pressure(staff)).toBe(10);
    const setting = arena('t476-setting');
    work(setting, 'runeforge', 'set_weapon_deep', 'runesmithing', [['axe', 'iron', 1], ['bar', 'deepsilver', 1], ['rune_vial', 'rune', 12]]);
    expect(worked(setting)).toEqual([10]);
    expect(pressure(setting)).toBe(10);
    const iron = arena('t476-iron-staff');
    work(iron, 'runeforge', 'make_staff_garnet', 'runesmithing', [['log', 'oak', 1], ['cut_gem', 'garnet', 1], ['bar', 'iron', 1]]);
    expect(worked(iron)).toEqual([]);
    expect(pressure(iron)).toBe(0);
  });

  it('a forge working a deepsilver bar raises nothing', () => {
    const w = arena('t476-forge');
    work(w, 'forge', 'forge_dagger', 'weaponsmithing', [['bar', 'deepsilver', 1], ['charcoal_bar', 'charcoal', 1]]);
    expect(w.events('ItemCrafted').some((e) => e['recipeId'] === 'forge_dagger')).toBe(true);
    expect(worked(w)).toEqual([]);
    expect(pressure(w)).toBe(0);
  });

  it('a bought bar crosses a threshold: the Deep stirs and the Hollow comes up beside the workshop, once', () => {
    const w = arena('t476-threshold');
    w.game.world.fortress.deepPressure = 0;
    // 40 already raised by four earlier quenches; the fifth crosses 50.
    w.game.world.emit({ type: 'DeepsilverWorked', amount: 40, tile: w.index(12, 12, Z) });
    w.step(1);
    expect(pressure(w)).toBe(40);
    expect(w.events('DeepStirred')).toEqual([]);
    const lab = work(w, 'alchemist', 'quench_deepsilver', 'alchemy', [['bar', 'deepsilver', 1]]);
    expect(pressure(w)).toBe(50);
    expect(w.events('DeepStirred').map((e) => e['level'])).toEqual([1]);
    const emerged = w.events('MonsterEmerged');
    expect(emerged).toHaveLength(1);
    // No tile was mined: the base is the tile the first worked bar came from.
    expect(emerged[0]!['tile']).toBe(w.index(12, 12, Z));
    expect((emerged[0]!['ids'] as number[]).length).toBe(3);
    expect(w.game.world.entities.get(lab, C.Building)).toBeDefined();
  });

  it('with no base at all there is no emergence, and the base finder says so', () => {
    const w = arena('t476-no-base');
    expect(findEmergenceBaseTile(w.game.world.map, [])).toBe(-1);
    const ctx = { world: w.game.world, registry, tick: w.tick, readers: w.readers, emit: (e: never) => w.game.world.emit(e), terrain: w.game.world.services.terrain } as never;
    expect(triggerDeepEmergence(ctx, [], [{ species: 'hollow_crawler', count: 3 }], new Set())).toEqual([]);
    w.step(1);
    expect(w.events('MonsterEmerged')).toEqual([]);
  });
});

describe('T-476 the draughts of the rare materials', () => {
  it('the Deep at level 2 makes soldiers drink hollowsight: they spot within 10; level 1 does not', () => {
    const w = arena('t476-deep-draught');
    const post = w.index(10, 10, Z);
    w.spawnItem('hollowsight_draught', 'rune', w.index(12, 12, Z), 2, 1);
    const id = w.spawnDwarf({ at: post });
    squad(w, [id], post, ['hollowsight_draught']);
    w.game.world.fortress.deepLevel = 1;
    w.game.world.emit({ type: 'DeepStirred', level: 1 });
    w.step(2);
    expect(drunk(w, id)).toEqual([]);
    w.game.world.fortress.deepLevel = 2;
    w.game.world.emit({ type: 'DeepStirred', level: 2 });
    w.game.world.emit({ type: 'MonsterEmerged', ids: [], tile: post });
    w.step(2);
    expect(drunk(w, id)).toEqual(['hollowsight_draught']);
    expect(effectValue(w.game.world.entities, id, 'spot_radius', w.tick)).toBe(10);
  });

  it('a fire-breathing creature near a soldier draws its wyrmblood; a crawler does not', () => {
    const w = arena('t476-fire-draught');
    const post = w.index(10, 10, Z);
    w.spawnItem('wyrmblood_draught', 'rune', w.index(12, 12, Z), 2, 1);
    const id = w.spawnDwarf({ at: post });
    squad(w, [id], post, ['wyrmblood_draught']);
    const crawler = w.spawnCreature('cave_crawler', w.index(30, 30, Z), 'wild');
    w.game.world.emit({ type: 'ThreatNearby', id, hostileId: crawler });
    w.step(2);
    expect(drunk(w, id)).toEqual([]);
    const wyrm = w.spawnCreature('magma_wyrm', w.index(30, 20, Z), 'wild');
    w.game.world.emit({ type: 'ThreatNearby', id, hostileId: wyrm });
    w.step(2);
    expect(drunk(w, id)).toEqual(['wyrmblood_draught']);
    expect(effectValue(w.game.world.entities, id, 'fire_immune', w.tick)).toBe(1);
  });

  it('a hollowsight helm gives a dwarf the same 10 tiles', () => {
    const w = arena('t476-helm');
    const id = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const helm = w.spawnItem('helm', 'iron', w.index(10, 10, Z), 1);
    w.items.setEnchant!(helm, { id: enchants.index('hollowsight'), tier: 1 });
    const equip = w.game.world.entities.get(id, C.Equipment)!;
    w.game.world.entities.add(id, C.Equipment, { ...equip, armor: { ...equip.armor, head: helm } });
    expect(SPOT_RADIUS + wornSpotRadius(w.game.world.entities, registry, id)).toBe(10);
  });
});

describe('T-476 legend', () => {
  it('the first stone set and the first runecaster are milestones, each once', () => {
    const w = arena('t476-legend');
    for (let k = 0; k < 2; k += 1) {
      w.game.world.emit({ type: 'StoneSet', itemId: 1, enchantId: 'keen', tier: 1, smithId: 1 });
      w.game.world.emit({ type: 'FirstRunecaster', id: 1 });
      w.step(1);
    }
    const ids = w.game.world.fortress.milestones.map((m) => m.id);
    expect(ids.filter((id) => id === 'm_stone_set')).toHaveLength(1);
    expect(ids.filter((id) => id === 'm_runecaster')).toHaveLength(1);
  });
});
