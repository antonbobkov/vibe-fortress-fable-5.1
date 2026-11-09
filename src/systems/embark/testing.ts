/**
 * The testing start: `02-systems/02-embark-and-loadout.md` § Testing mode (T-532).
 *
 * A testing embark has no budget, any number of dwarves, any skill at any level and any item in
 * any quantity and material, late ones included (cut gems, bars, staffs and wands with a stone set,
 * rune vials, enchanted gear). The items the catalog does not sell are free lines
 * ({@link TestingItemLine}) spawned into the wagon beside the catalog's. The fortress is marked
 * (`FortressState.testing`), and the save header and the legend say so.
 */

import { C } from '@core/components';
import type { Registry } from '@core/registry';
import type { World } from '@core/world';
import type { EntityId, Quality, TileIndex } from '@core/types';
import type { SupplyLine } from './party';

/** One free item line of a testing loadout: `count` items of one type, material, quality, stone and enchantment. */
export interface TestingItemLine {
  /** `items` id. */
  readonly item: string;
  /** `materials` id. */
  readonly material: string;
  readonly count: number;
  /** 0 poor … 5 masterwork; absent is common (1). An enchantment's tier is this quality. */
  readonly quality?: number;
  /** `materials` id of the stone set in a wand or a staff (`Item.stone`, 25 § Channels). */
  readonly stone?: string;
  /** `enchants` id set in a weapon, armor piece or ammunition (`Item.enchant`, 25 § Setting stones). */
  readonly enchant?: string;
}

/** What an item can carry: a channel takes a spell's stone, the rest an enchantment of their slot. */
export type TestingItemSlot = 'channel' | 'weapon' | 'armor' | 'ammo' | null;

/** The preset id of the testing fortress (`02` § Testing mode). */
export const TESTING_PRESET_ID = 'testing_fortress';

export interface TestingPreset {
  readonly id: string;
  readonly name: string;
  readonly dwarves: number;
  readonly skills: readonly { readonly dwarf: number; readonly skill: string; readonly level: number }[];
  readonly supplies: readonly SupplyLine[];
  readonly items: readonly TestingItemLine[];
}

/** The level of every skill the testing preset sets (`02` § Testing mode: "a high level"). */
export const TESTING_PRESET_LEVEL = 15;

/** Each dwarf's skills, in party order: every labour is covered, runecraft included. */
const PRESET_PARTY: readonly (readonly string[])[] = [
  ['mining', 'building', 'masonry', 'pick'],
  ['mining', 'engraving', 'mechanics', 'building'],
  ['woodcutting', 'carpentry', 'crafting', 'axe'],
  ['farming', 'herbalism', 'brewing', 'fishing'],
  ['cooking', 'butchery', 'tanning', 'trading'],
  ['smelting', 'weaponsmithing', 'armorsmithing', 'metalcrafting'],
  ['runecraft', 'runesmithing', 'gem_cutting', 'crafting'],
  ['runecraft', 'alchemy', 'medicine', 'herbalism'],
  ['axe', 'shield', 'armor_use', 'dodge', 'mace', 'hammer', 'unarmed'],
  ['sword', 'shield', 'armor_use', 'dodge', 'spear', 'dagger'],
  ['crossbow', 'hunting', 'dodge', 'bow', 'sling', 'animal_training'],
  ['medicine', 'animal_care', 'leatherworking', 'weaving', 'clothesmaking'],
];

/**
 * "A broad test fortress at once": a dozen dwarves covering every labour at level 15, runecraft
 * included; plenty of food, drink, logs, stone, bars, gems and vials; a squad's kit; glowstone and
 * glowcap seed; staffs and wands with stones and enchanted gear, so that runecraft, smithing,
 * farming and combat can be tried straight away.
 */
export const TESTING_PRESET: TestingPreset = Object.freeze({
  id: TESTING_PRESET_ID,
  name: 'Testing fortress',
  dwarves: PRESET_PARTY.length,
  skills: PRESET_PARTY.flatMap((skills, dwarf) => skills.map((skill) => ({ dwarf, skill, level: TESTING_PRESET_LEVEL }))),
  supplies: [
    // Tools and the squad's kit.
    { entry: 'e_pick_iron', count: 4 },
    { entry: 'e_axe_iron', count: 4 },
    { entry: 'e_anvil', count: 2 },
    { entry: 'e_crossbow', count: 2 },
    { entry: 'e_bolts_iron', count: 4 },
    { entry: 'e_quiver', count: 2 },
    { entry: 'e_short_sword_iron', count: 2 },
    { entry: 'e_spear_iron', count: 2 },
    { entry: 'e_shield_wood', count: 4 },
    { entry: 'e_helm_iron', count: 4 },
    { entry: 'e_mail_iron', count: 4 },
    { entry: 'e_bucket', count: 4 },
    { entry: 'e_splints', count: 3 },
    { entry: 'e_crutch', count: 1 },
    // Food and drink for a dozen through a season.
    { entry: 'e_meals', count: 20 },
    { entry: 'e_meat', count: 6 },
    { entry: 'e_fish', count: 6 },
    { entry: 'e_turnips', count: 6 },
    { entry: 'e_dimcaps', count: 6 },
    { entry: 'e_cheese', count: 4 },
    { entry: 'e_flour', count: 4 },
    { entry: 'e_ale', count: 12 },
    { entry: 'e_dimcap_ale', count: 12 },
    { entry: 'e_empty_barrel', count: 8 },
    // Seeds of every kind.
    { entry: 'e_seed_dimcap', count: 2 },
    { entry: 'e_seed_cavewheat', count: 2 },
    { entry: 'e_seed_sweetroot', count: 2 },
    { entry: 'e_seed_pale_bell', count: 2 },
    { entry: 'e_seed_sporecloth', count: 2 },
    { entry: 'e_seed_barley', count: 2 },
    { entry: 'e_seed_turnip', count: 2 },
    { entry: 'e_seed_cabbage', count: 1 },
    { entry: 'e_seed_strawberry', count: 1 },
    { entry: 'e_seed_flax', count: 2 },
    { entry: 'e_seed_pumpkin', count: 1 },
    { entry: 'e_seed_hops', count: 1 },
    // Materials.
    { entry: 'e_logs', count: 20 },
    { entry: 'e_blocks', count: 20 },
    { entry: 'e_bars_iron', count: 10 },
    { entry: 'e_bars_copper', count: 4 },
    { entry: 'e_charcoal', count: 10 },
    { entry: 'e_leather', count: 4 },
    { entry: 'e_cloth', count: 4 },
    { entry: 'e_thread', count: 4 },
    { entry: 'e_rope', count: 2 },
    { entry: 'e_mechanism', count: 6 },
    { entry: 'e_brightleaf', count: 4 },
    // Furniture.
    { entry: 'e_bed', count: 12 },
    { entry: 'e_table', count: 4 },
    { entry: 'e_chair', count: 8 },
    { entry: 'e_door', count: 4 },
    { entry: 'e_chest', count: 2 },
    { entry: 'e_bin', count: 6 },
    { entry: 'e_bag', count: 6 },
    // Animals.
    { entry: 'e_dog', count: 2 },
    { entry: 'e_war_dog', count: 2 },
    { entry: 'e_cat', count: 1 },
    { entry: 'e_chickens', count: 1 },
  ],
  items: [
    // Runecraft: glowcap to attune on and seed to grow more, glowstone and two ready lamps, vials.
    { item: 'glowcap', material: 'glowcap', count: 40 },
    { item: 'seed', material: 'glowcap', count: 20 },
    { item: 'rough_gem', material: 'glowstone', count: 4 },
    { item: 'statue', material: 'glowstone', count: 2 },
    { item: 'rune_vial', material: 'rune', count: 60 },
    // A cut gem of every spell's stone, and rough garnets for the jeweler.
    { item: 'cut_gem', material: 'garnet', count: 6 },
    { item: 'cut_gem', material: 'ruby', count: 3 },
    { item: 'cut_gem', material: 'diamond', count: 3 },
    { item: 'cut_gem', material: 'sapphire', count: 3 },
    { item: 'cut_gem', material: 'emerald', count: 3 },
    { item: 'cut_gem', material: 'quartz', count: 4 },
    { item: 'cut_gem', material: 'amethyst', count: 3 },
    { item: 'rough_gem', material: 'garnet', count: 5 },
    // Smithing: better bars than the catalog sells.
    { item: 'bar', material: 'steel', count: 20 },
    { item: 'bar', material: 'silver', count: 5 },
    { item: 'bar', material: 'gold', count: 5 },
    // Channels with their stones set.
    { item: 'staff', material: 'steel', count: 2, quality: 3, stone: 'garnet' },
    { item: 'staff', material: 'iron', count: 1, quality: 3, stone: 'quartz' },
    { item: 'staff', material: 'iron', count: 1, quality: 3, stone: 'emerald' },
    { item: 'wand', material: 'oak', count: 1, quality: 3, stone: 'diamond' },
    { item: 'wand', material: 'oak', count: 1, quality: 3, stone: 'glowstone' },
    // Enchanted gear and rune wear.
    { item: 'axe', material: 'steel', count: 1, quality: 5, enchant: 'blaze' },
    { item: 'short_sword', material: 'steel', count: 1, quality: 5, enchant: 'keen' },
    { item: 'mail_shirt', material: 'steel', count: 1, quality: 5, enchant: 'stout' },
    { item: 'bolt', material: 'iron', count: 25, quality: 3, enchant: 'ember_ammo' },
    { item: 'rune_robe', material: 'sporecloth_cloth', count: 2 },
    { item: 'circlet', material: 'silver', count: 2 },
    // Draughts.
    { item: 'mending_draught', material: 'brightleaf', count: 5 },
    { item: 'stout_draught', material: 'pale_bell', count: 5 },
  ],
});

interface ItemRow {
  readonly id: string;
  readonly stack?: number;
  readonly container?: string;
  readonly category?: string;
  readonly materials?: string | readonly string[];
}

interface WeaponRow {
  readonly id: string;
  readonly launcher?: { readonly ammo?: string };
}

/** What an item takes: `channel` (a wand or a staff: a launcher with no ammunition), a weapon, armor, ammunition, or nothing. */
export function testingItemSlot(registry: Registry, itemId: string): TestingItemSlot {
  const weapon = registry.hasTable('weapons') ? registry.table<WeaponRow>('weapons').byId(itemId) : undefined;
  if (weapon !== undefined) return weapon.launcher !== undefined && weapon.launcher.ammo === undefined ? 'channel' : 'weapon';
  if (registry.hasTable('armor') && registry.table('armor').has(itemId)) return 'armor';
  if (registry.hasTable('ammo') && registry.table('ammo').has(itemId)) return 'ammo';
  return null;
}

/** The stones a channel takes: each spell's stone, in spell order (25 § Channels). */
export function channelStones(registry: Registry): string[] {
  if (!registry.hasTable('spells')) return [];
  const spells = registry.table<{ id: string; stone: string }>('spells');
  return spells.ids().map((id) => (spells.byId(id) as { stone: string }).stone);
}

/** The enchantments an item of a slot takes (25 § Setting stones). */
export function slotEnchants(registry: Registry, slot: TestingItemSlot): string[] {
  if (slot === null || slot === 'channel' || !registry.hasTable('enchants')) return [];
  const enchants = registry.table<{ id: string; slot: string }>('enchants');
  return enchants.ids().filter((id) => enchants.byId(id)?.slot === slot);
}

/** Whether a material suits an item by its `materials` column (`any`, or a list of classes and ids). */
export function materialFits(registry: Registry, itemId: string, materialId: string): boolean {
  const row = registry.table<ItemRow>('items').byId(itemId);
  const material = registry.table<{ id: string; class: string }>('materials').byId(materialId);
  if (row === undefined || material === undefined) return false;
  const allowed = row.materials;
  if (allowed === undefined || allowed === 'any') return true;
  return Array.isArray(allowed) && (allowed.includes(material.class) || allowed.includes(material.id));
}

/**
 * Why a free line is refused, or `null`: an item or a material that does not exist, a count out of
 * `1..maxCount`, a quality out of 0–5, a stone on anything but a channel or one that carries no
 * spell, an enchantment of another slot. Any material is allowed for any item: testing mode trusts
 * the player (`02` § Testing mode).
 */
export function testingItemProblem(registry: Registry, line: TestingItemLine, maxCount: number): string | null {
  if (!registry.table('items').has(line.item)) return 'not_found';
  const materials = registry.table('materials');
  if (!materials.has(line.material)) return 'not_found';
  if (!Number.isInteger(line.count) || line.count < 1 || line.count > maxCount) return 'invalid';
  if (line.quality !== undefined && (!Number.isInteger(line.quality) || line.quality < 0 || line.quality > 5)) return 'invalid';
  const slot = testingItemSlot(registry, line.item);
  if (line.stone !== undefined && (slot !== 'channel' || !channelStones(registry).includes(line.stone) || !materials.has(line.stone))) return 'invalid';
  if (line.enchant !== undefined && !slotEnchants(registry, slot).includes(line.enchant)) return 'invalid';
  return null;
}

/**
 * Arrival step 4 for the free lines: every item into the wagon's container (or onto `tile` without
 * a wagon), in stacks of the item's `stack`; a drink in a pine barrel per stack, as the catalog
 * sells it (`barrelWood`, the arrival's `SUPPLY_CONTAINER_MATERIAL.barrel`). The stone and the
 * enchantment are set on every item of the line.
 */
export function spawnTestingItems(
  world: World,
  lines: readonly TestingItemLine[],
  wagonId: EntityId,
  tile: TileIndex,
  barrelWood: string,
): EntityId[] {
  const registry = world.registry;
  const items = registry.table<ItemRow>('items');
  const materials = registry.table('materials');
  const enchants = registry.hasTable('enchants') ? registry.table('enchants') : null;
  const spawn = world.services.spawn;
  const into = (holder: EntityId): TileIndex | { containerId: EntityId } => (holder === 0 ? tile : { containerId: holder });
  const made: EntityId[] = [];
  for (const line of lines) {
    const row = items.byId(line.item);
    if (row === undefined || !materials.has(line.material)) throw new RangeError(`arrival: unknown testing item ${line.item} of ${line.material}`);
    const type = items.index(line.item);
    const material = materials.index(line.material);
    const quality = (line.quality ?? 1) as Quality;
    const stack = Math.max(1, row.stack ?? 1);
    const barrel = row.category === 'drink' ? barrelWood : undefined;
    for (let remaining = line.count; remaining > 0; ) {
      const n = Math.min(stack, remaining);
      remaining -= n;
      let holder = wagonId;
      if (barrel !== undefined) {
        holder = spawn.item(items.index('barrel'), materials.index(barrel), into(wagonId), 1);
        made.push(holder);
      }
      const id = spawn.item(type, material, into(holder), n, quality);
      made.push(id);
      const item = world.entities.get(id, C.Item);
      if (item === undefined) continue;
      if (line.stone !== undefined) world.entities.add(id, C.Item, { ...item, stone: materials.index(line.stone) });
      if (line.enchant !== undefined && enchants !== null) {
        const current = world.entities.get(id, C.Item) ?? item;
        world.entities.add(id, C.Item, { ...current, enchant: { id: enchants.index(line.enchant), tier: quality } });
      }
    }
  }
  return made;
}
