/**
 * T-492: remains and venom (`25-runecraft.md` § Rare materials, § Effects, § Enchantments in
 * combat; `17` § Bleeding, pain, consciousness; `creatures.md` § Remains; `workshops-and-recipes.md`
 * § Craftsdwarf, § Runeforge). Three fun features (`docs/fun-features.md`): a giant cave spider
 * leaves its venom, set in a `venomed` blade that pains what it hits; an ember newt leaves its
 * gland, a cheaper stone of embers; and obsidian and bone are knapped into daggers and short swords.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C, ItemFlag, type Equipment } from '@core/components';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import type { TickContext } from '@core/system';
import type { EntityId, Quality } from '@core/types';
import { contentRegistry } from '@content/loader';
import { getMetalWeaponMult, resolveMelee, scoreWeapon } from '@systems/combat';
import type { ItemsReader } from '@systems/items';
import { addEffect } from '@systems/magic/cast';
import { effectsLine, enchantLine } from '@ui/panels/look';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const strings = new Strings(registry);
const enchants = registry.table<{ id: string; slot: string; stone: string; vials: number; suffix: string; effects: { kind: string; value: number; ticks?: number; scales: string }[] }>('enchants');
const recipes = registry.table<{ id: string; name: string; workshop: string; skill: string; inputs: { match: string; count: number; material?: string }[]; outputs: { item: string; count: number }[] }>('recipes');

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

const items = (w: TestWorld): ItemsReader => w.readers.of<ItemsReader>('13');
const typeId = (w: TestWorld, id: EntityId): string => registry.table('items').idOf(w.game.world.entities.get(id, C.Item)!.type) ?? '';
const materialId = (w: TestWorld, id: EntityId): string => registry.table('materials').idOf(w.game.world.entities.get(id, C.Item)!.material) ?? '';

/** Every hit roll (0..99) gives `roll`; every other draw its lowest value. */
function fixedRng(roll = 0): RngStream {
  return { int: (lo: number, hi: number) => (lo === 0 && hi === 99 ? roll : lo), chance: () => false } as unknown as RngStream;
}

function ctxOf(w: TestWorld, events: GameEvent[] = []): TickContext {
  return {
    world: w.game.world, registry, rng: fixedRng(0), tick: w.tick, readers: w.readers,
    emit: (e: GameEvent) => { events.push(e); },
  } as unknown as TickContext;
}

/** Kill a creature as 17 does, and return its corpse. */
function corpseOf(w: TestWorld, id: EntityId): EntityId {
  w.game.world.emit({ type: 'Starvation', id });
  w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === id), 60);
  return w.events('CorpseCreated').find((e) => e['creatureId'] === id)!['id'] as EntityId;
}

/** A weapon of `type` in `material` held by a dwarf of Strength 50 with the skill, a gloam warrior beside it. */
function duel(seed: string, type: string, material: string, skill: string, enchant = '', tier: Quality = 1): { w: TestWorld; dwarf: EntityId; foe: EntityId; weapon: EntityId } {
  const w = arena(seed);
  const at = w.index(30, 30, Z);
  const dwarf = w.spawnDwarf({ at, skills: { [skill]: 2 } });
  const ent = w.game.world.entities;
  ent.add(dwarf, C.Attributes, { ...ent.get(dwarf, C.Attributes)!, str: 50, agi: 50 });
  const weapon = w.spawnItem(type, material, at, 1, 1);
  if (enchant !== '') ent.add(weapon, C.Item, { ...ent.get(weapon, C.Item)!, enchant: { id: enchants.index(enchant), tier } });
  w.game.world.services.items?.attachToCarrier(weapon, dwarf);
  w.game.world.services.items?.setOwner(weapon, dwarf);
  const old = ent.get(dwarf, C.Equipment);
  ent.add<Equipment>(dwarf, C.Equipment, {
    weapon, shield: 0, armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
    clothing: old?.clothing ?? { body: 0, legs: 0, feet: 0, over: 0 }, quiver: 0,
  });
  const foe = w.spawnCreature('gloam_warrior', w.index(31, 30, Z), 'hostile:gloam');
  return { w, dwarf, foe, weapon };
}

/** Run one order at a workshop of `type` by a worker with `skill`, with `stock` on the floor. */
function work(w: TestWorld, type: string, recipeId: string, skill: string, stock: [string, string, number][]): void {
  const ws = w.build(type, w.index(12, 12, Z), 'granite');
  w.spawnDwarf({ at: w.index(16, 16, Z), skills: { [skill]: 5 } });
  for (const [item, material, count] of stock) w.spawnItem(item, material, w.index(16, 14, Z), count);
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: ws, order: { recipeId, mode: 'once', remaining: 1, priority: 5 } }).ok).toBe(true);
  w.until((x) => x.events('WorkOrderCompleted').some((e) => e['recipeId'] === recipeId), 4000);
  w.step(2);
}

describe('T-492 content', () => {
  it('spider venom and the ember gland are items of their own material, worth 20 and 25, numbered last', () => {
    const itemRows = registry.table<{ id: string; category: string; stack: number; container: string }>('items');
    expect(itemRows.byId('spider_venom')).toMatchObject({ category: 'medical/venom', stack: 5, container: 'bag' });
    expect(itemRows.byId('ember_gland')).toMatchObject({ category: 'medical/gland', stack: 10, container: 'bag' });
    const w = arena('t492-values');
    expect(items(w).value(w.spawnItem('spider_venom', 'spider_venom', w.index(10, 10, Z), 1))).toBe(20);
    expect(items(w).value(w.spawnItem('ember_gland', 'ember_gland', w.index(10, 11, Z), 1))).toBe(25);
    const creatures = registry.table<{ id: string; remains?: { item: string; count: number }[] }>('creatures');
    expect(creatures.byId('giant_cave_spider')?.remains).toEqual([{ item: 'spider_venom', count: 1 }]);
    expect(creatures.byId('ember_newt')?.remains).toEqual([{ item: 'ember_gland', count: 1 }]);
    expect(itemRows.index('spider_venom')).toBeGreaterThan(itemRows.index('hollow_ichor'));
    expect(registry.table('materials').index('ember_gland')).toBeGreaterThan(registry.table('materials').index('hollow_ichor'));
    expect(enchants.index('venomed')).toBeGreaterThan(enchants.index('hollowsight'));
  });

  it('venomed: a spider venom and 4 vials; the gland is a second stone of embers at 4 vials, named apart at the runeforge', () => {
    expect(enchants.byId('venomed')).toMatchObject({ slot: 'weapon', stone: 'spider_venom', vials: 4, suffix: 'venomed',
      effects: [{ kind: 'pain', value: 20, ticks: 300, scales: 'ticks' }] });
    const ember = enchants.byId('ember')!;
    expect(enchants.byId('ember_gland')).toMatchObject({ slot: 'weapon', stone: 'ember_gland', vials: 4, suffix: ember.suffix, effects: ember.effects });
    expect(ember.vials).toBe(6);
    expect(recipes.byId('set_weapon_venomed')).toMatchObject({ name: 'Venomed weapon', workshop: 'runeforge' });
    expect(recipes.byId('set_weapon_venomed')?.inputs.slice(1)).toEqual([{ match: 'spider_venom', count: 1 }, { match: 'rune_vial', count: 4 }]);
    expect(recipes.byId('set_weapon_ember_gland')?.inputs.slice(1)).toEqual([{ match: 'ember_gland', count: 1 }, { match: 'rune_vial', count: 4 }]);
    // The garnet's recipe keeps its name; the gland's names its stone.
    expect(recipes.byId('set_weapon_ember')?.name).toBe('Weapon of embers');
    expect(recipes.byId('set_weapon_ember_gland')?.name).toBe('Weapon of embers (ember gland)');
    // An item stone is valued as one unit of its item: venom 20 × 3 + 4 × 15.
    const w = arena('t492-stone-value');
    const value = (enchant: string): number => {
      const axe = w.spawnItem('axe', 'iron', w.index(10, 10, Z), 1);
      const before = items(w).value(axe);
      w.items.setEnchant!(axe, { id: enchants.index(enchant), tier: 1 });
      return items(w).value(axe) - before;
    };
    expect(value('venomed')).toBe(120);
    expect(value('ember_gland')).toBe(135);
  });

  it('the knapping recipes: obsidian stone or bone piles at the craftsdwarf, a dagger from one and a short sword from two', () => {
    for (const [id, match, count, item] of [
      ['knap_dagger_obsidian', 'raw_stone', 1, 'dagger'], ['knap_short_sword_obsidian', 'raw_stone', 2, 'short_sword'],
      ['knap_dagger_bone', 'bone_pile', 1, 'dagger'], ['knap_short_sword_bone', 'bone_pile', 2, 'short_sword'],
    ] as const) {
      const r = recipes.byId(id)!;
      expect(r, id).toMatchObject({ workshop: 'craftdwarf', skill: 'crafting', outputs: [{ item, count: 1 }] });
      expect(r.inputs).toEqual([{ match, count, ...(match === 'raw_stone' ? { material: 'obsidian' } : {}) }]);
    }
    const weapons = registry.table<{ id: string; materials: string[] }>('weapons');
    expect(weapons.byId('dagger')?.materials).toEqual(['metal', 'obsidian', 'bone']);
    expect(weapons.byId('short_sword')?.materials).toEqual(['metal', 'obsidian', 'bone']);
  });
});

describe('T-492 remains', () => {
  it('a dead giant cave spider leaves 1 venom on its corpse, foreign until strip_corpse recovers it', () => {
    const w = arena('t492-spider');
    const spider = w.spawnCreature('giant_cave_spider', w.index(20, 20, Z), 'wild');
    const corpse = corpseOf(w, spider);
    const worn = w.game.world.entities.get(corpse, C.Corpse)!.wornItems;
    expect(worn.map((id) => `${typeId(w, id)} ${materialId(w, id)} ${w.game.world.entities.get(id, C.Item)!.count}`)).toEqual(['spider_venom spider_venom 1']);
    const venom = worn[0]!;
    expect(w.game.world.entities.get(venom, C.Item)!.flags & ItemFlag.Foreign).not.toBe(0);
    expect(roundTrip(w.game).game.hash()).toBe(w.hash());
    const hauler = w.spawnDwarf({ at: w.index(18, 18, Z) });
    w.setLabor(hauler, 'hauling', true);
    const before = items(w).wealth();
    w.until(() => w.events('JobCompleted').some((e) => e['jobType'] === 'strip_corpse'), 3000);
    expect(w.game.world.entities.get(venom, C.Item)!.flags & ItemFlag.Foreign).toBe(0);
    expect(items(w).wealth() - before).toBe(20);
  });

  it('a dead ember newt leaves 1 gland', () => {
    const w = arena('t492-newt');
    const newt = w.spawnCreature('ember_newt', w.index(20, 20, Z), 'wild');
    const worn = w.game.world.entities.get(corpseOf(w, newt), C.Corpse)!.wornItems;
    expect(worn.map((id) => `${typeId(w, id)} ${w.game.world.entities.get(id, C.Item)!.count}`)).toEqual(['ember_gland 1']);
  });
});

describe('T-492 venomed', () => {
  it('a hit adds a pain of 20 for 300 ticks, the ticks scaled by tier; nothing is drawn; a plain blade adds nothing', () => {
    const { w, dwarf, foe } = duel('t492-venom', 'dagger', 'iron', 'dagger', 'venomed');
    const before = w.game.world.rngState();
    const res = resolveMelee(ctxOf(w), dwarf, foe, new Map());
    expect(res.outcome).toBe('hit');
    expect(w.game.world.entities.get(foe, C.Spellbound)?.effects).toEqual([{ kind: 'pain', value: 20, until: w.tick + 300, sourceId: dwarf }]);
    expect(w.game.world.rngState()).toEqual(before);
    const mw = duel('t492-venom-mw', 'dagger', 'iron', 'dagger', 'venomed', 5);
    resolveMelee(ctxOf(mw.w), mw.dwarf, mw.foe, new Map());
    expect(mw.w.game.world.entities.get(mw.foe, C.Spellbound)?.effects[0]?.until).toBe(mw.w.tick + 450);
    const plain = duel('t492-venom-plain', 'dagger', 'iron', 'dagger');
    resolveMelee(ctxOf(plain.w), plain.dwarf, plain.foe, new Map());
    expect(plain.w.game.world.entities.has(plain.foe, C.Spellbound)).toBe(false);
    // The look lines.
    expect(enchantLine(w.readers, strings, w.game.world.entities.get(dwarf, C.Equipment)!.weapon)).toBe('A hit stings for 20 pain for 300 ticks.');
    expect(effectsLine(w.readers, strings, foe)).toBe('Under: venom, pain +20 (300 ticks).');
  });

  it('17 adds the pain to the wounds\' sum while it lasts, stoutness halves the whole, and it ends', () => {
    const w = arena('t492-pain');
    const [a, b, c] = [10, 12, 14].map((y) => w.spawnDwarf({ at: w.index(10, y, Z) })) as [EntityId, EntityId, EntityId];
    const ent = w.game.world.entities;
    for (const id of [a, b, c]) {
      ent.add(id, C.Attributes, { ...ent.get(id, C.Attributes)!, wil: 0 });
      w.game.world.emit({ type: 'DamageDealt', defenderId: id, part: 'left_arm', damageType: 'blunt', amount: 3, attackerId: 0, weaponId: 0 });
    }
    w.step(1);
    addEffect(ent, a, { kind: 'pain', value: 20, until: w.tick + 300, sourceId: 0 });
    addEffect(ent, b, { kind: 'pain', value: 20, until: w.tick + 300, sourceId: 0 });
    addEffect(ent, b, { kind: 'pain_half', value: 1, until: w.tick + 300, sourceId: 0 });
    w.step(10);
    const pain = (id: EntityId): number => ent.get(id, C.Body)!.pain;
    const wounds = pain(c);
    expect(pain(a)).toBe(wounds + 20);
    expect(pain(b)).toBe(Math.floor((wounds + 20) / 2));
    w.step(300);
    expect(pain(a)).toBe(pain(c));
  });

  it('a creature whose wounds heal while the venom lasts keeps its pain until it ends, then leaves the wounded list at 0', () => {
    const w = arena('t492-pain-heal');
    const d = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const ent = w.game.world.entities;
    ent.add(d, C.Attributes, { ...ent.get(d, C.Attributes)!, wil: 0 });
    w.game.world.emit({ type: 'DamageDealt', defenderId: d, part: 'left_arm', damageType: 'blunt', amount: 1, attackerId: 0, weaponId: 0 });
    w.step(1);
    addEffect(ent, d, { kind: 'pain', value: 20, until: w.tick + 300, sourceId: 0 });
    // The wound heals at the next health tick.
    for (const p of ent.get(d, C.Body)!.parts) for (const wound of p.wounds) wound.healRemaining = 1;
    w.step(20);
    const body = ent.get(d, C.Body)!;
    expect(body.parts.flatMap((p) => p.wounds)).toEqual([]);
    expect(body.pain).toBe(20);
    w.step(300);
    expect(ent.get(d, C.Body)!.pain).toBe(0);
  });
});

describe('T-492 knapped blades', () => {
  it('obsidian cuts at 0.70 and bone at 0.50: a short sword deals 12.6 and 9 raw, below copper\'s 14.4', () => {
    const mats = registry.table('materials');
    expect(getMetalWeaponMult(registry, mats.index('obsidian'))).toBeCloseTo(0.7, 9);
    expect(getMetalWeaponMult(registry, mats.index('bone'))).toBeCloseTo(0.5, 9);
    const blow = (material: string, type = 'short_sword', skill = 'sword'): number => {
      const { w, dwarf, foe } = duel(`t492-knap-${material}-${type}`, type, material, skill);
      return resolveMelee(ctxOf(w), dwarf, foe, new Map(), { forcedPart: 'torso' }).damage;
    };
    // Toughness 50 takes 5%.
    expect(blow('obsidian')).toBe(Math.round(18 * 0.7 * 0.95));
    expect(blow('bone')).toBe(Math.round(18 * 0.5 * 0.95));
    expect(blow('copper')).toBe(Math.round(18 * 0.8 * 0.95));
    expect(blow('bone', 'dagger', 'dagger')).toBe(Math.round(12 * 0.5 * 0.95));
  });

  it('a soldier takes a knapped blade over nothing, and any metal blade of its class over it', () => {
    const w = arena('t492-claim');
    const at = w.index(10, 10, Z);
    const score = (type: string, material: string): number =>
      scoreWeapon(registry, w.game.world.entities, w.spawnItem(type, material, at, 1, 1), 'sword', false);
    const obsidian = score('short_sword', 'obsidian');
    expect(obsidian).toBeGreaterThan(0);
    expect(score('short_sword', 'copper')).toBeGreaterThan(obsidian);
  });

  it('a crafter knaps 2 obsidian stones into an obsidian short sword, and a bone pile into a bone dagger', () => {
    const blades = (w: TestWorld, type: string): EntityId[] => w.game.world.entities.with(C.Item).filter((id) => typeId(w, id) === type);
    const stone = arena('t492-knap-obsidian');
    work(stone, 'craftdwarf', 'knap_short_sword_obsidian', 'crafting', [['raw_stone', 'obsidian', 2]]);
    expect(blades(stone, 'short_sword').map((id) => materialId(stone, id))).toEqual(['obsidian']);
    const bone = arena('t492-knap-bone');
    work(bone, 'craftdwarf', 'knap_dagger_bone', 'crafting', [['bone_pile', 'bone', 1]]);
    expect(blades(bone, 'dagger').map((id) => materialId(bone, id))).toEqual(['bone']);
  });
});
