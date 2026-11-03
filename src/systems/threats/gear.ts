/**
 * Hostile equipment and skills generation per gear tier.
 * `02-systems/18-threats-monsters-and-raids.md` § Party composition,
 * `03-content/threat-schedules.md` § Hostile gear by tier.
 */

import { C, ItemFlag, type Equipment } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import type { ItemsApi } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { HOSTILE_SKILL_PER_TIER } from './constants';

export interface GearKitItem {
  item: string;
  chance: number; // permille 1..1000
  count?: number;
  /** The stone set in the item after spawn (a hexer's wand): a material id. */
  stone?: string;
}

export interface GearTierRow {
  tier: number;
  metal: string | null;
  kits: {
    warrior: GearKitItem[];
    archer: GearKitItem[];
    captain: GearKitItem[];
    hexer?: GearKitItem[];
  };
}

/**
 * Calculates effective gear tier:
 * `tier = min(peril, 3)` for warriors and archers; sieges `+1`; captains `+1`;
 * tier 0 exists only for restless dead and bandits.
 */
export function calculateGearTier(
  peril: number,
  kind: string,
  isCaptain: boolean,
): number {
  if (kind === 'bandits' || kind === 'restless_dead') {
    return 0;
  }
  let tier = Math.min(peril, 3);
  if (kind === 'siege') tier += 1;
  if (isCaptain) tier += 1;
  return Math.min(4, Math.max(0, tier));
}

/**
 * Assigns Skills to a hostile creature:
 * `2 + HOSTILE_SKILL_PER_TIER × gear tier` (captains + 2).
 */
export function assignHostileSkills(
  entities: EntityStore,
  registry: Registry,
  creatureId: EntityId,
  gearTier: number,
  isCaptain: boolean,
): void {
  const skillsCount = registry.table('skills').size;
  const level = new Uint8Array(skillsCount + 1);
  const xp = new Uint16Array(skillsCount + 1);
  const skillVal = 2 + HOSTILE_SKILL_PER_TIER * gearTier + (isCaptain ? 2 : 0);

  for (let s = 1; s <= skillsCount; s++) {
    level[s] = skillVal;
  }

  entities.add(creatureId, C.Skills, { level, xp, lastRaised: 0 });
}

/**
 * Equips a hostile creature with weapons and armor according to gear tier.
 */
export function equipHostileCreature(
  world: { entities: EntityStore; services: { items?: ItemsApi | null; spawn: { item(type: number, material: number, at: number, count?: number, quality?: number): EntityId } } },
  registry: Registry,
  rng: RngStream,
  creatureId: EntityId,
  tile: TileIndex,
  role: string,
  gearTier: number,
  isCaptain: boolean,
): void {
  const entities = world.entities;
  const itemsTable = registry.table<{ id: string; category?: string }>('items');
  const materialsTable = registry.table<{ id: string }>('materials');
  const weaponsTable = registry.table<{ id: string; weaponClass?: string }>('weapons');
  const armorTable = registry.table<{ id: string; armorSlot?: 'head' | 'body' | 'arms' | 'legs' | 'feet' | 'shield' }>('armor');

  const gearTiersList = registry.derived<readonly GearTierRow[]>('gearTiers');
  const tierRow = gearTiersList.find((r) => r.tier === gearTier);
  if (!tierRow) return;

  const equip: Equipment = {
    weapon: 0,
    shield: 0,
    armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
    clothing: { body: 0, legs: 0, feet: 0, over: 0 },
    quiver: 0,
  };

  const metalId = tierRow.metal ?? 'iron';
  const metalMat = materialsTable.index(metalId) > 0 ? materialsTable.index(metalId) : materialsTable.index('iron');
  const leatherMat = materialsTable.index('leather') > 0 ? materialsTable.index('leather') : metalMat;
  const woodMat = materialsTable.index('oak') > 0 ? materialsTable.index('oak') : metalMat;

  // Quality: Captain Fine (2), Tier 0 Poor (0), Common (1)
  const quality = isCaptain ? 2 : gearTier === 0 ? 0 : 1;

  const kitItemsToRoll: GearKitItem[] = [];
  if (role === 'archers') {
    kitItemsToRoll.push(...tierRow.kits.archer);
  } else if (role === 'hexer') {
    kitItemsToRoll.push(...(tierRow.kits.hexer ?? []));
  } else {
    kitItemsToRoll.push(...tierRow.kits.warrior);
  }
  if (isCaptain) {
    kitItemsToRoll.push(...tierRow.kits.captain);
  }

  // 25 § Hexers: a hexer's kit is fixed and draws nothing, so 18's stream runs as it would without hexers.
  const fixedKit = role === 'hexer';
  for (const kitItem of kitItemsToRoll) {
    if (!fixedKit && rng.int(1, 1000) > kitItem.chance) continue;

    const itemType = itemsTable.index(kitItem.item);
    if (itemType <= 0) continue;

    // Pick appropriate material
    let matIdx = metalMat;
    const wDef = weaponsTable.byId(kitItem.item);
    const aDef = armorTable.byId(kitItem.item);

    if (kitItem.item === 'bow' || kitItem.item === 'club' || kitItem.item === 'wand') {
      matIdx = woodMat;
    } else if (
      kitItem.item === 'cap' ||
      kitItem.item === 'leather_jerkin' ||
      kitItem.item === 'leggings' ||
      kitItem.item === 'leather_boots' ||
      kitItem.item === 'quiver'
    ) {
      matIdx = leatherMat;
    } else if (kitItem.item === 'arrow') {
      matIdx = metalMat;
    }

    const count = kitItem.count ?? 1;
    const spawnedId = world.services.spawn.item(itemType, matIdx, tile, count, quality);
    if (spawnedId === 0) continue;
    // 25 § Hexers: a kit row's stone is written after spawn, as a runeforge writes a channel's.
    const stone = kitItem.stone === undefined ? 0 : materialsTable.index(kitItem.stone);
    if (stone > 0) {
      const item = entities.get(spawnedId, C.Item);
      if (item !== undefined) entities.add(spawnedId, C.Item, { ...item, stone });
    }

    // Foreign equipment belongs to its carrier and uses 13 for every mutation.
    world.services.items?.setFlag(spawnedId, ItemFlag.Foreign, true);
    world.services.items?.attachToCarrier(spawnedId, creatureId);
    world.services.items?.setOwner(spawnedId, creatureId);

    if (wDef) {
      // If weapon slot is empty, equip it
      if (equip.weapon === 0) {
        equip.weapon = spawnedId;
      }
    } else if (aDef) {
      if (aDef.armorSlot === 'shield') {
        if (equip.shield === 0) {
          equip.shield = spawnedId;
        }
      } else if (aDef.armorSlot) {
        if (equip.armor[aDef.armorSlot] === 0) {
          equip.armor[aDef.armorSlot] = spawnedId;
        }
      }
    } else if (kitItem.item === 'quiver') {
      equip.quiver = spawnedId;
    }
  }

  entities.add(creatureId, C.Equipment, equip);
}
