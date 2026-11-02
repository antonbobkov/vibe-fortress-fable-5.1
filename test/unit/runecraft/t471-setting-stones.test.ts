/**
 * T-471: setting stones, enchanted items and their value, the runed robe and the circlet, and the
 * rune vials of the Mountainhome (`25-runecraft.md` § Setting stones, § Enchantments in combat (the
 * rows), § Trade and value; `12` § Work orders; `13` § Value).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { loadGame, roundTrip } from '@app/game-save';
import { C, type Equipment, type ItemEnchant } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import type { TickContext } from '@core/system';
import type { EntityId, Quality, TileIndex } from '@core/types';
import { contentRegistry } from '@content/loader';
import { withSuffix, type EnchantDef, type RecipeDef } from '@content/generate';
import { scoreArmorPiece, scoreWeapon, type CombatReader, type SquadWithId } from '@systems/combat';
import type { ItemsReader } from '@systems/items';
import type { Job } from '@systems/jobs';
import type { MagicReader } from '@systems/magic';
import { ENCHANT_CLAIM_BONUS } from '@systems/magic/constants';
import { generateGoods, preferencePercent, type PlannedGood } from '@systems/trade';
import { RngStream } from '@core/rng';
import type { WorkshopsReader, WorkshopsSystem } from '@systems/workshops';
import { enchantLine } from '@ui/panels/look';
import { enchantedName } from '@ui/messages';
import { OrdersPanel } from '@ui/panels/orders';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
const strings = new Strings(registry);
const enchants = registry.table<EnchantDef>('enchants');
const recipes = registry.table<RecipeDef>('recipes');

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

const enchantOf = (id: string, tier: Quality = 1): ItemEnchant => ({ id: enchants.index(id), tier });
const magic = (w: TestWorld): MagicReader => w.readers.of<MagicReader>('25');
const items = (w: TestWorld): ItemsReader => w.readers.of<ItemsReader>('13');

function squad(w: TestWorld, members: EntityId[], station: TileIndex, armor: 'metal' | 'leather' | 'any' = 'any'): SquadWithId {
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
  const all = w.readers.of<CombatReader>('16').squads();
  const s = all[all.length - 1] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members });
  w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { weaponClass: 'any', armor, ranged: false } });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: station });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
  return s;
}

/** A runeforge with a runesmith, the stone and the vials of an enchantment in stock. */
function forge(seed: string, enchant: string): { w: TestWorld; forge: EntityId; smith: EntityId } {
  const w = arena(seed);
  const id = w.build('runeforge', w.index(12, 12, Z), 'granite');
  const smith = w.spawnDwarf({ at: w.index(16, 16, Z), skills: { runesmithing: 5 } });
  const row = enchants.byId(enchant)!;
  w.spawnItem('cut_gem', row.stone, w.index(16, 15, Z));
  w.spawnItem('rune_vial', 'rune', w.index(17, 15, Z), row.vials);
  w.step(1);
  return { w, forge: id, smith };
}

function order(w: TestWorld, workshopId: EntityId, recipeId: string, extra: Record<string, unknown> = {}): { ok: boolean; reason?: string } {
  return w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId, order: { recipeId, mode: 'once', remaining: 1, priority: 5, ...extra } }) as { ok: boolean; reason?: string };
}

describe('T-471 content: enchantments, settings, the robe and the circlet', () => {
  it('fifteen enchantments, each a row with a slot, a stone, vials, a suffix and effects; numbered last', () => {
    expect(enchants.size).toBe(15);
    expect(enchants.byId('ember')).toEqual({ id: 'ember', slot: 'weapon', stone: 'garnet', vials: 6, suffix: 'of embers',
      effects: [{ kind: 'extra_damage', value: 8, type: 'ember', scales: 'value' }] });
    expect(enchants.byId('fearsome')?.effects).toEqual([{ kind: 'flee', value: 1, chance: 25, ticks: 200, scales: 'none' }]);
    expect(enchants.byId('rime')?.effects).toEqual([{ kind: 'slow', value: 30, ticks: 200, scales: 'ticks' }]);
    // A row, never an id: the rimeward's "never slowed" is a kind of its own.
    expect(enchants.byId('rimeward')?.effects.map((e) => e.kind)).toEqual(['frost_percent', 'slow_immune']);
    expect(enchants.ids().filter((id) => enchants.byId(id)?.slot === 'ammo')).toEqual(['ember_ammo', 'rime_ammo', 'seeking']);
    // Rows added after version 1 number after every older row (row-order.md).
    const order = registry.table<{ table: string; id: string }>('items');
    expect(order.index('circlet')).toBeGreaterThan(order.index('rune_vial'));
  });

  it('one transform recipe per enchantment at the runeforge: no outputs, input 0 kept, the stone, the vials', () => {
    const weapon = recipes.byId('set_weapon_ember')!;
    expect(weapon).toMatchObject({ workshop: 'runeforge', skill: 'runesmithing', outputs: [], baseTicks: 300, fuel: false,
      quality: true, xp: 15, generated: true, transform: true, enchant: 'ember', name: 'Weapon of embers' });
    expect(weapon.inputs[0]!.match.split('|')).toEqual(['axe', 'club', 'dagger', 'great_axe', 'mace', 'maul', 'pick', 'pike', 'short_sword', 'spear', 'warhammer']);
    expect(weapon.inputs.slice(1)).toEqual([{ match: 'cut_gem', count: 1, material: 'garnet' }, { match: 'rune_vial', count: 6 }]);
    const armor = recipes.byId('set_armor_stout')!;
    expect(armor.name).toBe('Stout armor');
    expect(armor.inputs[0]!.match.split('|')).toContain('rune_robe');
    expect(armor.inputs[0]!.match.split('|')).not.toContain('shield');
    const ammo = recipes.byId('set_ammo_seeking')!;
    expect(ammo).toMatchObject({ baseTicks: 200, xp: 10, name: 'Seeking ammunition' });
    expect(ammo.inputs[0]).toEqual({ match: 'bolt|arrow', count: 25 });
    expect(recipes.where('t471-transform', (r) => r.transform === true).length).toBe(15);
    expect(withSuffix('iron axe', 'keen')).toBe('keen iron axe');
    expect(withSuffix('iron axe', 'of embers')).toBe('iron axe of embers');
  });

  it('the robe and the circlet: armor with a rune property, made at the runeforge', () => {
    const armor = registry.table<{ id: string; layer: string; armor: number; weight: number; rune?: unknown }>('armor');
    expect(armor.byId('rune_robe')).toMatchObject({ layer: 'padding', armor: 3, weight: 2, rune: { regenPercent: 150 } });
    expect(armor.byId('circlet')).toMatchObject({ layer: 'plate', armor: 2, weight: 1, rune: { maxBonus: 10 } });
    expect(recipes.byId('make_rune_robe')).toMatchObject({ workshop: 'runeforge', skill: 'runesmithing', baseTicks: 250, xp: 12, quality: true,
      inputs: [{ match: 'cloth', count: 3, material: 'sporecloth_cloth' }, { match: 'rune_vial', count: 2 }] });
    expect(recipes.byId('make_circlet')).toMatchObject({ workshop: 'runeforge', baseTicks: 220, xp: 10, quality: true,
      inputs: [{ match: 'bar', count: 1, materials: ['silver', 'gold', 'electrum', 'platinum', 'deepsilver'] }, { match: 'cut_gem', count: 1 }, { match: 'rune_vial', count: 2 }] });
  });
});

describe('T-471 setting a stone', () => {
  it('a runesmith sets a garnet in an iron axe: the axe is kept, enchanted, at the output tile; no ItemCrafted', () => {
    const { w, forge: ws, smith } = forge('t471-set', 'ember');
    const axe = w.spawnItem('axe', 'iron', w.index(18, 15, Z));
    w.step(1);
    const wealth = items(w).wealth();
    const plainValue = items(w).value(axe);
    expect(order(w, ws, 'set_weapon_ember').ok).toBe(true);
    w.until((world) => world.events('StoneSet').length > 0, 4000);
    const set = w.events('StoneSet')[0]!;
    expect(set).toMatchObject({ itemId: axe, enchantId: 'ember', smithId: smith });
    const item = w.game.world.entities.get(axe, C.Item)!;
    expect(item.enchant).toEqual({ id: enchants.index('ember'), tier: set['tier'] });
    expect(registry.table('items').idOf(item.type)).toBe('axe');
    expect(registry.table('materials').idOf(item.material)).toBe('iron');
    expect(item.reservedBy).toBe(0);
    expect(w.events('ItemCrafted')).toEqual([]);
    expect(w.events('WorkOrderCompleted').some((e) => e['recipeId'] === 'set_weapon_ember')).toBe(true);
    // The gem and the six vials are gone.
    const left = w.game.world.entities.with(C.Item).map((id) => registry.table('items').idOf(w.game.world.entities.get(id, C.Item)!.type));
    expect(left.filter((type) => type === 'cut_gem' || type === 'rune_vial')).toEqual([]);
    // Wealth follows: the axe gains garnet 12 × 3 + 6 × 15 = 126, and the common garnet (36) and
    // the six vials (90) are spent.
    expect(items(w).value(axe) - plainValue).toBe(126);
    expect(items(w).wealth() - wealth).toBe(126 - 36 - 90);
  });

  it('a second setting is refused: an enchanted axe is never the input of another', () => {
    const { w, forge: ws } = forge('t471-twice', 'keen');
    const axe = w.spawnItem('axe', 'iron', w.index(18, 15, Z));
    w.game.world.services.items!.setEnchant!(axe, enchantOf('ember', 2));
    w.step(1);
    expect(order(w, ws, 'set_weapon_keen').ok).toBe(true);
    w.step(1500);
    expect(w.events('StoneSet')).toEqual([]);
    expect(w.game.world.entities.get(axe, C.Item)?.enchant).toEqual(enchantOf('ember', 2));
    expect(w.readers.of<WorkshopsReader>('12').isRunnable('set_weapon_keen', ws).runnable).toBe(false);
  });

  it('an order is once only; its target type is one of input 0\'s alternatives, and narrows the search', () => {
    const { w, forge: ws } = forge('t471-target', 'ember');
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: ws,
      order: { recipeId: 'set_weapon_ember', mode: 'maintain', threshold: 2, priority: 5 } })).toMatchObject({ ok: false });
    expect(order(w, ws, 'set_weapon_ember', { targetType: 'helm' })).toMatchObject({ ok: false, reason: 'bad_setting' });
    expect(order(w, ws, 'make_rune_robe', { targetType: 'axe' })).toMatchObject({ ok: false, reason: 'bad_setting' });
    // The axe lies nearer the forge; the order names the dagger.
    w.spawnItem('axe', 'iron', w.index(14, 15, Z));
    const dagger = w.spawnItem('dagger', 'iron', w.index(25, 25, Z));
    w.step(1);
    expect(order(w, ws, 'set_weapon_ember', { targetType: 'dagger' }).ok).toBe(true);
    const saved = w.readers.of<WorkshopsReader>('12').ordersOf(ws)[0]!;
    expect(saved.targetType).toBe(registry.table('items').index('dagger'));
    w.until((world) => world.events('StoneSet').length > 0, 4000);
    expect(w.events('StoneSet')[0]!['itemId']).toBe(dagger);
  });

  it('a set of ammunition is exactly 25 units: 30 bolts give 25 enchanted and 5 plain, and they never merge', () => {
    const { w, forge: ws } = forge('t471-bolts', 'ember_ammo');
    const bolts = w.spawnItem('bolt', 'iron', w.index(18, 15, Z), 30);
    w.step(1);
    expect(order(w, ws, 'set_ammo_ember_ammo').ok).toBe(true);
    w.until((world) => world.events('StoneSet').length > 0, 4000);
    const ent = w.game.world.entities;
    const all = ent.with(C.Item).filter((id) => registry.table('items').idOf(ent.get(id, C.Item)!.type) === 'bolt');
    const enchanted = all.filter((id) => ent.get(id, C.Item)?.enchant !== undefined);
    const plain = all.filter((id) => ent.get(id, C.Item)?.enchant === undefined);
    expect(enchanted.reduce((n, id) => n + ent.get(id, C.Item)!.count, 0)).toBe(25);
    expect(plain.reduce((n, id) => n + ent.get(id, C.Item)!.count, 0)).toBe(5);
    expect(all).toContain(bolts);
    const api = w.game.world.services.items as unknown as { canMerge(a: EntityId, b: EntityId): boolean; split(id: EntityId, n: number): EntityId };
    expect(api.canMerge(enchanted[0]!, plain[0]!)).toBe(false);
    // A split keeps the stone, and the two halves of a set merge back.
    const part = api.split(enchanted[0]!, 10);
    expect(ent.get(part, C.Item)?.enchant).toEqual(ent.get(enchanted[0]!, C.Item)?.enchant);
    expect(api.canMerge(enchanted[0]!, part)).toBe(true);
  });
});

describe('T-471 an enchanted item keeps its stone; value, wealth and names', () => {
  it('through a drop, a haul, a claim and a save; a soldier takes the enchanted sword of two', () => {
    const w = arena('t471-keep');
    const plain = w.spawnItem('short_sword', 'iron', w.index(30, 31, Z));
    const axe = w.spawnItem('short_sword', 'iron', w.index(30, 32, Z));
    w.game.world.services.items!.setEnchant!(axe, enchantOf('keen'));
    expect(scoreWeapon(registry, w.game.world.entities, axe, 'any', false) - scoreWeapon(registry, w.game.world.entities, plain, 'any', false))
      .toBe(ENCHANT_CLAIM_BONUS);
    const soldier = w.spawnDwarf({ at: w.index(30, 30, Z) });
    squad(w, [soldier], w.index(30, 30, Z));
    w.step(2);
    expect(w.game.world.entities.get(soldier, C.Equipment)?.weapon).toBe(axe);
    const kept = enchantOf('keen');
    const api = w.game.world.services.items!;
    api.setOwner(axe, 0);
    api.dropAt(axe, w.index(33, 33, Z));
    expect(w.game.world.entities.get(axe, C.Item)?.enchant).toEqual(kept);
    api.attachToCarrier(axe, soldier);
    api.dropAt(axe, w.index(35, 35, Z));
    expect(w.game.world.entities.get(axe, C.Item)?.enchant).toEqual(kept);
    const { game } = roundTrip(w.game);
    expect(game.world.entities.get(axe, C.Item)?.enchant).toEqual(kept);
    expect(game.hash()).toBe(w.game.hash());
  });

  it('an enchanted two-bar axe melts by the ordinary formula to one bar, and never gives its stone back', () => {
    const w = arena('t471-melt');
    const smelter = w.build('smelter', w.index(16, 16, Z));
    const worker = w.spawnDwarf({ at: w.index(20, 16, Z), skills: { smelting: 20 } });
    w.step(1);
    const op = (w.game.world.scheduler.byId('12') as WorkshopsSystem).operator;
    const axe = w.spawnItem('axe', 'iron', w.index(20, 17, Z));
    w.game.world.services.items!.setEnchant!(axe, enchantOf('blaze'));
    const fuel = w.spawnItem('charcoal_bar', 'charcoal', w.index(20, 18, Z));
    expect(w.game.world.applyCommand({ type: 'MeltItem', itemId: axe, on: true })).toEqual({ ok: true });
    const before = new Set(w.game.world.entities.with(C.Item));
    const ctx = { world: w.game.world, registry: w.game.registry, spawn: w.game.world.services.spawn,
      emit: (event: Parameters<typeof w.game.world.emit>[0]) => w.game.world.emit(event) } as unknown as TickContext;
    op.producer().onComplete?.({ id: 0, workerId: worker, target: { kind: 'building', ref: smelter },
      inputs: [{ filter: {}, count: 1, reserved: [axe], delivered: [axe] },
        { filter: {}, count: 1, reserved: [fuel], delivered: [fuel] }],
      data: { recipe: 'melt_metal_item', orderIndex: -1, globalOrder: false } } as unknown as Job, ctx);
    const made = w.game.world.entities.with(C.Item).filter((id) => !before.has(id)).map((id) => w.game.world.entities.get(id, C.Item)!);
    expect(made.map((it) => [registry.table('items').idOf(it.type), it.count, it.enchant])).toEqual([['bar', 1, undefined]]);
  });

  it('value adds stone × 3 + vials × 15, and wealth follows: a masterwork steel breastplate of adamant is 4,450', () => {
    const w = arena('t471-value');
    const plate = w.spawnItem('breastplate', 'steel', w.index(30, 30, Z), 1, 5);
    w.step(1);
    expect(items(w).value(plate)).toBe(4000);
    const wealth = items(w).wealth();
    w.game.world.services.items!.setEnchant!(plate, enchantOf('adamant', 5));
    expect(items(w).value(plate)).toBe(4450);
    expect(items(w).wealth() - wealth).toBe(450);
    // A set of 25 bolts carries garnet 12 × 3 + 4 × 15 = 96; a stack carries its share of the set.
    const bolts = w.spawnItem('bolt', 'iron', w.index(31, 30, Z), 25);
    const plainValue = items(w).value(bolts);
    w.game.world.services.items!.setEnchant!(bolts, enchantOf('ember_ammo'));
    expect(items(w).value(bolts) - plainValue).toBe(96);
    const part = w.game.world.services.items!.split(bolts, 10);
    expect(items(w).value(part) - Math.floor(plainValue * 10 / 25)).toBeLessThanOrEqual(Math.floor(96 * 10 / 25) + 1);
  });

  it('names: a suffix with "of" follows, any other goes first; the look line gives the effect at the tier', () => {
    const w = arena('t471-names');
    const axe = w.spawnItem('axe', 'steel', w.index(30, 30, Z));
    const sword = w.spawnItem('short_sword', 'iron', w.index(30, 31, Z));
    const api = w.game.world.services.items!;
    api.setEnchant!(axe, enchantOf('ember', 2));
    api.setEnchant!(sword, enchantOf('keen', 5));
    expect(enchantedName(w.readers, axe, 'steel axe')).toBe('steel axe of embers');
    expect(enchantedName(w.readers, sword, 'iron short sword')).toBe('keen iron short sword');
    // Fine: 8 × 1.1 = 8.8, 9 ember. Masterwork keen: 10 × 1.5 = 15%.
    expect(enchantLine(w.readers, strings, axe)).toBe('+9 ember on a hit.');
    expect(enchantLine(w.readers, strings, sword)).toBe('+15% damage.');
    expect(magic(w).enchantOf(axe)).toMatchObject({ id: 'ember', slot: 'weapon', suffix: 'of embers', tier: 2,
      effects: [{ kind: 'extra_damage', value: 9, type: 'ember', chance: 0, ticks: 0 }] });
    const rime = w.spawnItem('dagger', 'iron', w.index(30, 32, Z));
    api.setEnchant!(rime, enchantOf('rime', 5));
    // Rime scales its ticks, not its percent.
    expect(magic(w).enchantOf(rime)?.effects).toEqual([{ kind: 'slow', value: 30, type: '', chance: 0, ticks: 300 }]);
    expect(magic(w).enchantOf(w.spawnItem('dagger', 'iron', w.index(30, 33, Z)))).toBeUndefined();
  });

  it('an older save loads with no enchantment on any item and plays on', async () => {
    const fixture = new Uint8Array(readFileSync(fileURLToPath(new URL('../../fixtures/played-fortress.deepholm', import.meta.url))));
    const old = await loadGame(fixture);
    const ent = old.game.world.entities;
    expect(ent.with(C.Item).every((id) => ent.get(id, C.Item)?.enchant === undefined)).toBe(true);
    old.game.step(TICKS_PER_HOUR);
    expect(ent.with(C.Item).every((id) => ent.get(id, C.Item)?.enchant === undefined)).toBe(true);
  });
});

describe('T-471 the runed robe and the circlet', () => {
  function caster(w: TestWorld, level: number): EntityId {
    const id = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { runecraft: level } });
    w.game.world.entities.add(id, C.Rune, { current: 0 });
    return id;
  }
  function wear(w: TestWorld, id: EntityId, slot: 'head' | 'body', itemId: EntityId): void {
    w.game.world.services.items!.attachToCarrier(itemId, id);
    const eq = w.game.world.entities.get(id, C.Equipment) as Equipment;
    w.game.world.entities.add(id, C.Equipment, { ...eq, armor: { ...eq.armor, [slot]: itemId } });
  }

  it('a Proficient runecaster in a robe fills from 0 in 34 hours (1.5 rune an hour)', () => {
    const w = arena('t471-robe');
    const id = caster(w, 10);
    wear(w, id, 'body', w.spawnItem('rune_robe', 'sporecloth_cloth', w.index(30, 30, Z)));
    expect(magic(w).rune(id)).toMatchObject({ max: 50_000, regen: 1500, robePercent: 150, metalPercent: 100, hoursToFull: 34 });
    // Count the hours of regen it takes: each raises the rune once.
    let hours = 0;
    let last = 0;
    for (let n = 0; n < 60 * TICKS_PER_HOUR && last < 50_000; n += 1) {
      w.step(1);
      const now = w.game.world.entities.get(id, C.Rune)?.current ?? 0;
      if (now > last) hours += 1;
      last = now;
    }
    expect(last).toBe(50_000);
    expect(hours).toBe(34);
  });

  it('a silver circlet adds 10 to the maximum and never counts as metal', () => {
    const w = arena('t471-circlet');
    const id = caster(w, 10);
    wear(w, id, 'head', w.spawnItem('circlet', 'silver', w.index(30, 30, Z)));
    expect(magic(w).rune(id)).toMatchObject({ max: 60_000, regen: 1000, maxBonus: 10, metalPercent: 100, metalPieces: [] });
    // An iron helm in its place drinks the rune.
    const helm = w.spawnItem('helm', 'iron', w.index(30, 30, Z));
    wear(w, id, 'head', helm);
    expect(magic(w).rune(id)).toMatchObject({ max: 50_000, regen: 800, metalPieces: [helm] });
  });

  it('a soldier holding a channel claims the robe and circlet first, past a metal preference; another soldier does not', () => {
    const w = arena('t471-claim');
    const staff = w.spawnItem('staff', 'iron', w.index(31, 31, Z));
    const st = w.game.world.entities.get(staff, C.Item)!;
    w.game.world.entities.add(staff, C.Item, { ...st, stone: registry.table('materials').index('garnet') });
    const robe = w.spawnItem('rune_robe', 'sporecloth_cloth', w.index(31, 32, Z));
    const circlet = w.spawnItem('circlet', 'silver', w.index(31, 33, Z));
    const mail = w.spawnItem('mail_shirt', 'iron', w.index(32, 31, Z));
    const helm = w.spawnItem('helm', 'iron', w.index(32, 32, Z));
    const runecaster = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { runecraft: 2 } });
    const fighter = w.spawnDwarf({ at: w.index(30, 31, Z) });
    squad(w, [runecaster, fighter], w.index(30, 30, Z), 'metal');
    w.step(2);
    const caster = w.game.world.entities.get(runecaster, C.Equipment)!;
    expect(caster.weapon).toBe(staff);
    expect(caster.armor.body).toBe(robe);
    expect(caster.armor.head).toBe(circlet);
    const other = w.game.world.entities.get(fighter, C.Equipment)!;
    expect(other.armor.body).toBe(mail);
    expect(other.armor.head).toBe(helm);
    // A metal preference scores neither piece for an ordinary soldier.
    expect(scoreArmorPiece(registry, w.game.world.entities, robe, 'body', 'metal')).toBe(-1);
  });
});

describe('T-471 trade: rune vials and preferences', () => {
  const vials = (goods: readonly PlannedGood[]): PlannedGood[] => goods.filter((g) => g.type === registry.table('items').index('rune_vial'));

  it('the Mountainhome brings 5 rune vials outside the pool, only at reputation 50 or more', () => {
    let brought = 0;
    const runs = 400;
    for (let n = 0; n < runs; n += 1) {
      expect(vials(generateGoods(registry, 'mountainhome', 0, 49, [], new RngStream(n + 1), new RngStream(7000 + n)))).toEqual([]);
      const goods = generateGoods(registry, 'mountainhome', 0, 60, [], new RngStream(n + 1), new RngStream(7000 + n));
      for (const g of vials(goods)) {
        expect(g.extra).toBe(true);
        expect(g.count).toBe(5);
        expect(g.material).toBe(registry.table('materials').index('rune'));
      }
      expect(goods.filter((g) => !g.extra).some((g) => g.type === registry.table('items').index('rune_vial'))).toBe(false);
      brought += vials(goods).length;
    }
    expect(brought / runs).toBeGreaterThan(0.3);
    expect(brought / runs).toBeLessThan(0.5);
  });

  it('a request finds the rune-vial row only at the reputation it needs', () => {
    const request = [{ itemType: 'rune_vial', priority: 3 as const }];
    expect(vials(generateGoods(registry, 'mountainhome', 0, 40, request, new RngStream(5), new RngStream(6)))).toEqual([]);
    expect(vials(generateGoods(registry, 'mountainhome', 0, 60, request, new RngStream(5), new RngStream(6))).filter((g) => !g.extra).length).toBeGreaterThan(0);
  });

  it('the Mountainhome values vials and draughts at 150', () => {
    expect(preferencePercent(registry, 'mountainhome', 'medical/vial', 'rune', 'liquid')).toBe(150);
    expect(preferencePercent(registry, 'mountainhome', 'medical/draught', 'rune', 'liquid')).toBe(150);
    expect(preferencePercent(registry, 'hillfolk', 'medical/vial', 'rune', 'liquid')).toBe(100);
  });
});

describe('T-471 the orders panel offers a transform recipe\'s target type', () => {
  it('any, then each of input 0\'s alternatives', () => {
    const panel = new OrdersPanel();
    expect(panel.targetOptions(recipes.byId('set_ammo_seeking') as never)).toEqual(['', 'bolt', 'arrow']);
    expect(panel.targetOptions(recipes.byId('make_rune_robe') as never)).toEqual([]);
  });
});
