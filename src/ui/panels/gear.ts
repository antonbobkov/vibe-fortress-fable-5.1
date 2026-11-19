/**
 * What a soldier carries and what the fortress has free for one: the military panel's armed line
 * and gear lists (`ui-screens/panels.md` § Military) and the creature inspector's equipment lines
 * (`ui-screens/fortress-screen.md` § Inspection panel). Read-only over 16's `Equipment`, 11's
 * `Worker` tool and 13's stock counts (16 § Equipment).
 */

import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import { enchantedName, materialItemName, whereMade } from '../messages';

export interface WeaponRow {
  readonly id: string;
  readonly weaponClass: string;
  readonly launcher?: { readonly ammo?: string };
  readonly training?: boolean;
}

interface ItemRow {
  readonly id: string;
  readonly name: string;
  readonly plural?: string;
  readonly category?: string;
  readonly quality?: boolean;
}

interface ArmorRow {
  readonly id: string;
  readonly armorSlot: string;
  readonly layer?: string;
}

const QUALITY_WORDS = ['poor', 'common', 'fine', 'superior', 'exceptional', 'masterwork'];
/** The quality every made item has unless its maker rolled better or worse: not written after a name. */
const COMMON_QUALITY = 1;

/** A channel (25 § Channels): a launcher with no ammunition. */
export function isChannel(row: WeaponRow): boolean {
  return row.launcher !== undefined && row.launcher.ammo === undefined;
}

/** The weapon row of an item, or undefined for an item that is no weapon. */
export function weaponRowOf(readers: ReaderSet, registry: Registry, itemId: EntityId): WeaponRow | undefined {
  const item = readers.entities.get(itemId, C.Item);
  const id = item === undefined ? undefined : registry.table<ItemRow>('items').byIndex(item.type)?.id;
  return id === undefined ? undefined : registry.table<WeaponRow>('weapons').byId(id);
}

/**
 * The weapon a creature fights with (16 § Equipment): the weapon it holds, or else the tool it
 * works with when that is a weapon of a class (a miner fights with the pick); 0 for none.
 */
export function heldWeapon(readers: ReaderSet, registry: Registry, id: EntityId): EntityId {
  const weapon = readers.entities.get(id, C.Equipment)?.weapon ?? 0;
  if (weapon !== 0 && readers.entities.alive(weapon)) return weapon;
  const tool = readers.entities.get(id, C.Worker)?.toolId ?? 0;
  return tool !== 0 && readers.entities.alive(tool) && weaponRowOf(readers, registry, tool) !== undefined ? tool : 0;
}

/** The weapon rows a soldier can claim (no channel), of a class or of every class (`any`). */
function claimableRows(registry: Registry, weaponClass: string, ranged?: boolean): WeaponRow[] {
  return registry.table<WeaponRow>('weapons').rows.filter((row): row is WeaponRow => row !== undefined && !isChannel(row)
    && (weaponClass === 'any' ? ranged === undefined || (row.launcher !== undefined) === ranged : row.weaponClass === weaponClass));
}

/** Free weapons of a class: units in stock that no one owns, holds or has reserved, and how many of them are tools. */
export interface WeaponStock {
  readonly free: number;
  readonly tools: number;
}

/**
 * The weapons of a class in stock and free (13's available count: not forbidden, reserved, owned,
 * carried or at the depot), with the tools among them (a pick or an axe, which a worker who lacks
 * one takes first, 16 § Equipment). `any` counts every class; with `ranged` given, only launchers
 * (true) or only weapons that are not (false).
 */
export function weaponStock(readers: ReaderSet, registry: Registry, weaponClass: string, ranged?: boolean): WeaponStock {
  if (!readers.has('13')) return { free: 0, tools: 0 };
  const items = readers.of<ItemsReader>('13');
  const table = registry.table<ItemRow>('items');
  let free = 0;
  let tools = 0;
  for (const row of claimableRows(registry, weaponClass, ranged)) {
    const n = items.available(row.id);
    free += n;
    if (table.byId(row.id)?.category?.startsWith('tool/') === true) tools += n;
  }
  return { free, tools };
}

/**
 * Armor pieces in stock and free for a squad's armor preference (16 § Equipment): `metal` the
 * pieces of a metal, `leather` the pieces of leather and the scale pieces, `any` every piece.
 * Shields are claimed whatever the preference and are not counted.
 */
export function armorStock(readers: ReaderSet, registry: Registry, preference: string): number {
  if (!readers.has('13')) return 0;
  const items = readers.of<ItemsReader>('13');
  const table = registry.table<ItemRow>('items');
  const pieces = registry.table<ArmorRow>('armor').rows.filter((row): row is ArmorRow => row !== undefined && row.armorSlot !== 'shield');
  const types = (rows: readonly ArmorRow[]): number[] => rows.map((row) => table.index(row.id)).filter((index) => index >= 0);
  const count = (rows: readonly ArmorRow[], materialClass?: string): number => {
    const of = types(rows);
    if (of.length === 0) return 0;
    return items.countAvailable(materialClass === undefined ? { types: of } : { types: of, materialClass });
  };
  if (preference === 'metal') return count(pieces, 'metal');
  if (preference === 'leather') return count(pieces.filter((row) => row.layer !== 'scale'), 'leather') + count(pieces.filter((row) => row.layer === 'scale'));
  return count(pieces);
}

/** Where a weapon of the class is made, training weapons aside: "a forge", "a bowyer's workshop or a forge"; '' for more than three places or none. */
export function whereWeaponMade(registry: Registry, weaponClass: string): string {
  return whereMade(registry, claimableRows(registry, weaponClass).filter((row) => row.training !== true).map((row) => row.id));
}

/**
 * An item a creature carries, by name: "iron spear", "iron spear (fine)", "24 iron bolts". The
 * quality is written when it is not common; an enchantment's suffix is part of the name.
 */
export function gearName(readers: ReaderSet, registry: Registry, itemId: EntityId): string {
  const item = readers.entities.get(itemId, C.Item);
  if (item === undefined) return '';
  const type = registry.table<ItemRow>('items').byIndex(item.type);
  const material = registry.table<{ id: string; name: string }>('materials').byIndex(item.material)?.name ?? '';
  const name = enchantedName(readers, itemId, materialItemName(material, type ?? { name: '' }, item.count));
  const counted = item.count > 1 ? `${item.count} ${name}` : name;
  return type?.quality === true && item.quality !== COMMON_QUALITY ? `${counted} (${QUALITY_WORDS[item.quality] ?? ''})` : counted;
}
