/**
 * T-562 (Making Do): scale armour, the horn bow and fletching. `16-combat.md` § Concepts (the scale
 * layer), § Equipment; `weapons-and-armor.md` § Armor, § Launchers, § Damage type versus layer,
 * § Enchantments; `25-runecraft.md` § Setting stones (a setting at another workshop);
 * `workshops-and-recipes.md` § Leatherworks, § Bowyer.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import { contentRegistry } from '@content/loader';
import type { EnchantDef, RecipeDef } from '@content/generate';
import { armorReduction, DAMAGE_VS_LAYER, getLauncherPower, scoreArmorPiece, type WieldedWeapon } from '@systems/combat';
import { metalPieces } from '@systems/magic/rune';
import type { WorkshopsReader } from '@systems/workshops';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const recipes = registry.table<RecipeDef>('recipes');
const enchants = registry.table<EnchantDef>('enchants');
const armor = registry.table<{ id: string; armorSlot: string; layer: string; armor: number; weight: number; materials: unknown }>('armor');

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

/** A dwarf wearing one piece of `type` in `material` on its body; nothing else. */
function wearing(w: TestWorld, type: string, material: string): EntityId {
  const at = w.index(20, 20, Z);
  const dwarf = w.spawnDwarf({ at });
  const piece = w.spawnItem(type, material, at);
  const ent = w.game.world.entities;
  const equip = ent.get(dwarf, C.Equipment)!;
  const slot = armor.byId(type)!.armorSlot as 'body' | 'legs';
  ent.add(dwarf, C.Equipment, { ...equip, armor: { ...equip.armor, [slot]: piece }, clothing: { ...equip.clothing, body: 0, legs: 0, feet: 0, over: 0 } });
  return dwarf;
}

describe('T-562 the scale layer', () => {
  it('scale sits between leather and mail in the layer table: edge 1.0, pierce 0.7, blunt 0.8, ember 0.6, frost 0.7', () => {
    expect([DAMAGE_VS_LAYER.edge.scale, DAMAGE_VS_LAYER.pierce.scale, DAMAGE_VS_LAYER.blunt.scale, DAMAGE_VS_LAYER.ember.scale, DAMAGE_VS_LAYER.frost.scale])
      .toEqual([1.0, 0.7, 0.8, 0.6, 0.7]);
    expect(armor.byId('scale_shirt')).toMatchObject({ armorSlot: 'body', layer: 'scale', armor: 8, weight: 7, materials: ['shell', 'bone'] });
    expect(armor.byId('scale_skirt')).toMatchObject({ armorSlot: 'legs', layer: 'scale', armor: 6, weight: 5 });
  });

  it('a shell scale shirt stops an edge better than a leather jerkin and worse than iron mail (the worked example: 8, 4, 14.4)', () => {
    const torso = (type: string, material: string, kind: 'edge' | 'pierce'): number => {
      const w = arena(`t562-red-${type}-${kind}`);
      const dwarf = wearing(w, type, material);
      return armorReduction(w.game.world.entities, registry, dwarf, 'torso', kind, 0);
    };
    const [leather, scale, mail] = [torso('leather_jerkin', 'leather', 'edge'), torso('scale_shirt', 'shell', 'edge'), torso('mail_shirt', 'iron', 'edge')];
    // A dwarf's own natural armour (none) adds nothing; each piece is common.
    expect(leather).toBeCloseTo(4, 6);
    expect(scale).toBeCloseTo(8, 6);
    expect(mail).toBeCloseTo(14.4, 6);
    // Against a point too.
    expect(torso('leather_jerkin', 'leather', 'pierce')).toBeLessThan(torso('scale_shirt', 'chitin', 'pierce'));
    expect(torso('scale_shirt', 'horn', 'pierce')).toBeLessThan(torso('mail_shirt', 'iron', 'pierce'));
  });

  it('a scale piece uses armorMult 1.0 whatever its plates, and is not metal: no rune penalty', () => {
    for (const material of ['shell', 'chitin', 'bone', 'horn']) {
      const w = arena(`t562-mult-${material}`);
      const dwarf = wearing(w, 'scale_shirt', material);
      expect(armorReduction(w.game.world.entities, registry, dwarf, 'torso', 'edge', 0), material).toBeCloseTo(8, 6);
      expect(metalPieces(w.game.world.entities, registry, dwarf)).toEqual([]);
    }
  });

  it('16 § Equipment: the leather preference takes scale (the line with no metal), the metal preference does not; any takes it over a jerkin', () => {
    const w = arena('t562-claim');
    const at = w.index(20, 20, Z);
    const scale = w.spawnItem('scale_shirt', 'shell', at);
    const jerkin = w.spawnItem('leather_jerkin', 'leather', at);
    const ent = w.game.world.entities;
    expect(scoreArmorPiece(registry, ent, scale, 'body', 'leather')).toBeGreaterThan(scoreArmorPiece(registry, ent, jerkin, 'body', 'leather'));
    expect(scoreArmorPiece(registry, ent, scale, 'body', 'any')).toBe(8);
    expect(scoreArmorPiece(registry, ent, scale, 'body', 'metal')).toBe(-1);
  });

  it('the leatherworks makes scale from 3 (or 2) plates of one material and 1 leather or cloth; the piece takes the plates\' material', () => {
    expect(recipes.byId('make_scale_shirt')).toMatchObject({ workshop: 'leatherworks', skill: 'leatherworking', baseTicks: 330, quality: true, xp: 12,
      inputs: [{ match: 'shell_piece|bone_pile|horn', count: 3, sameMaterial: true }, { match: 'leather_piece|cloth', count: 1 }],
      outputs: [{ item: 'scale_shirt', count: 1, material: { from: 'input', index: 0 } }] });
    expect(recipes.byId('make_scale_skirt')).toMatchObject({ workshop: 'leatherworks', baseTicks: 270, xp: 10,
      inputs: [{ match: 'shell_piece|bone_pile|horn', count: 2, sameMaterial: true }, { match: 'leather_piece|cloth', count: 1 }] });
  });

  it('a leatherworker makes a scale shirt of horn', () => {
    const w = arena('t562-make-scale');
    const ws = w.build('leatherworks', w.index(12, 12, Z), 'oak');
    w.spawnDwarf({ at: w.index(16, 16, Z), skills: { leatherworking: 3 } });
    w.spawnItem('horn', 'horn', w.index(16, 15, Z), 3);
    w.spawnItem('leather_piece', 'leather', w.index(17, 15, Z));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: ws, order: { recipeId: 'make_scale_shirt', mode: 'once', remaining: 1, priority: 5 } })).toMatchObject({ ok: true });
    w.until((world) => world.events('ItemCrafted').length > 0, 5000);
    const made = w.events('ItemCrafted')[0]!;
    const item = w.game.world.entities.get(made['itemId'] as EntityId, C.Item)!;
    expect(registry.table('items').idOf(item.type)).toBe('scale_shirt');
    expect(registry.table('materials').idOf(item.material)).toBe('horn');
  });
});

describe('T-562 the horn bow', () => {
  const weapons = registry.table<WieldedWeapon['weaponDef']>('weapons');
  const power = (type: string, wood: string): number =>
    getLauncherPower(registry, { item: 0, weaponDef: weapons.byId(type)!, material: registry.table('materials').index(wood), quality: 1 });

  it('a horn bow of pine shoots as a yew bow (1.10); a yew horn bow is no better', () => {
    expect(power('bow', 'pine')).toBe(1);
    expect(power('bow', 'yew')).toBe(1.1);
    expect(power('horn_bow', 'pine')).toBe(1.1);
    expect(power('horn_bow', 'yew')).toBe(1.1);
    expect(weapons.byId('horn_bow')).toMatchObject({ weaponClass: 'bow', skill: 'bow', hands: 2, launcher: { range: 14, power: 1100, ammo: 'arrow' } });
    expect(recipes.byId('make_horn_bow')).toMatchObject({ workshop: 'bowyer', skill: 'carpentry', baseTicks: 220, xp: 9, quality: true,
      inputs: [{ match: 'log', count: 1 }, { match: 'horn', count: 1 }], outputs: [{ item: 'horn_bow', count: 1, material: { from: 'input', index: 0 } }] });
  });
});

describe('T-562 fletching at the bowyer', () => {
  it('the fletched row names the bowyer; its setting is made there with carpentry, 25 bolts or arrows + 1 feather, no vials', () => {
    expect(enchants.byId('fletched')).toEqual({ id: 'fletched', slot: 'ammo', stone: 'feather', vials: 0, suffix: 'fletched',
      effects: [{ kind: 'to_hit', value: 5, scales: 'value' }], workshop: 'bowyer' });
    expect(recipes.byId('set_ammo_fletched')).toMatchObject({ name: 'Fletched ammunition', workshop: 'bowyer', skill: 'carpentry', transform: true,
      enchant: 'fletched', outputs: [], baseTicks: 200, xp: 10, quality: true,
      inputs: [{ match: 'bolt|arrow', count: 25 }, { match: 'feather', count: 1 }] });
    // Seeking stays the rune version.
    expect(recipes.byId('set_ammo_seeking')).toMatchObject({ workshop: 'runeforge', skill: 'runesmithing' });
  });

  it('a bowyer fletches 25 bolts with a feather; the fletched set takes no stone after, and no deepsilver pressure is raised', () => {
    const w = arena('t562-fletch');
    const ws = w.build('bowyer', w.index(12, 12, Z), 'oak');
    const fletcher = w.spawnDwarf({ at: w.index(16, 16, Z), skills: { carpentry: 3 } });
    const bolts = w.spawnItem('bolt', 'bone', w.index(16, 15, Z), 25);
    w.spawnItem('feather', 'feather', w.index(17, 15, Z));
    w.step(1);
    const once = { mode: 'once', remaining: 1, priority: 5 };
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: ws, order: { recipeId: 'set_ammo_fletched', ...once } })).toMatchObject({ ok: true });
    w.until((world) => world.events('StoneSet').length > 0, 5000);
    expect(w.events('StoneSet')[0]).toMatchObject({ itemId: bolts, enchantId: 'fletched', smithId: fletcher });
    expect(w.game.world.entities.get(bolts, C.Item)?.enchant?.id).toBe(enchants.index('fletched'));
    expect(w.events('DeepsilverWorked')).toEqual([]);
    // A second feather, and an order to fletch again: the set is enchanted, so nothing runs.
    w.spawnItem('feather', 'feather', w.index(17, 15, Z));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: ws, order: { recipeId: 'set_ammo_fletched', ...once } })).toMatchObject({ ok: true });
    expect(w.readers.of<WorkshopsReader>('12').isRunnable('set_ammo_fletched', ws).runnable).toBe(false);
  });
});
