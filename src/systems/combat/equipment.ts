/**
 * Military equipment claiming and armor speed modifiers.
 * `02-systems/16-combat.md` § Equipment.
 */

import { C, ItemFlag, type Squad } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { ItemsApi, TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs/reader';
import {
  ARMOR_MIN_SPEED_PERCENT,
  QUALITY_COMBAT_MULT,
  SOLDIER_AMMO,
} from './constants';
import { getSkill } from './melee';

export interface WeaponDefRow {
  readonly id: string;
  readonly name: string;
  readonly weaponClass: string;
  readonly skill: string;
  readonly hands: number;
  readonly launcher?: {
    range: number;
    power: number;
    ammo: string;
  };
  readonly training?: boolean;
}

export interface ArmorDefRow {
  readonly id: string;
  readonly name: string;
  readonly armorSlot: 'head' | 'body' | 'arms' | 'legs' | 'feet' | 'shield';
  readonly armor: number;
  readonly weight: number;
  readonly layer: string;
}

export interface MetalDefRow {
  readonly id: string;
  readonly tier: number;
  readonly weaponMult: number;
  readonly armorMult: number;
}

export interface MaterialDefRow {
  readonly id: string;
  readonly class: string;
}

export interface ItemDefRow {
  readonly id: string;
  readonly category: string;
}

/**
 * Calculates armor movement speed modifier:
 * Armor slows: movement * (100 - sum(armor.weight) / 4)% minimum ARMOR_MIN_SPEED_PERCENT,
 * reduced by armor_use skill (each level restores 1%).
 */
export function armorSpeedModifier(
  entities: EntityStore,
  registry: Registry,
  id: EntityId,
): number {
  const equip = entities.get(id, C.Equipment);
  if (!equip) return 100;

  const itemsTable = registry.table<ItemDefRow>('items');
  const armorTable = registry.table<ArmorDefRow>('armor');
  let totalWeight = 0;

  for (const slot of ['head', 'body', 'arms', 'legs', 'feet'] as const) {
    const itemId = equip.armor[slot];
    if (itemId !== 0 && entities.alive(itemId)) {
      const item = entities.get(itemId, C.Item);
      if (item) {
        const itemRow = itemsTable.byIndex(item.type);
        const row = itemRow ? armorTable.byId(itemRow.id) : undefined;
        if (row && typeof row.weight === 'number') {
          totalWeight += row.weight;
        }
      }
    }
  }

  if (equip.shield !== 0 && entities.alive(equip.shield)) {
    const item = entities.get(equip.shield, C.Item);
    if (item) {
      const itemRow = itemsTable.byIndex(item.type);
      const row = itemRow ? armorTable.byId(itemRow.id) : undefined;
      if (row && typeof row.weight === 'number') {
        totalWeight += row.weight;
      }
    }
  }

  const basePenalty = Math.floor(totalWeight / 4);
  const armorUseSkill = getSkill(entities, registry, id, 'armor_use');
  const penalty = Math.max(0, basePenalty - armorUseSkill);
  return Math.max(ARMOR_MIN_SPEED_PERCENT, 100 - penalty);
}

/**
 * Check if an item is available in stockpiles or ground to be claimed.
 */
export function isAvailableItem(entities: EntityStore, itemId: EntityId): boolean {
  if (!entities.alive(itemId)) return false;
  const item = entities.get(itemId, C.Item);
  if (!item) return false;
  if ((item.flags & (ItemFlag.Forbidden | ItemFlag.Merchant | ItemFlag.AtDepot | ItemFlag.Foreign)) !== 0) return false;
  if ((item.flags & ItemFlag.Installed) !== 0) return false;
  if ((item.flags & ItemFlag.Reserved) !== 0 && item.reservedBy !== 0) return false;
  if ((item.flags & ItemFlag.Owned) !== 0 && item.ownerId !== 0) return false;
  if (item.carriedBy !== 0) return false;
  return true;
}

/**
 * Score a weapon for claiming: highest metalTier * qualityMult.
 */
export function scoreWeapon(
  registry: Registry,
  entities: EntityStore,
  itemId: EntityId,
  preferredClass: string,
  isRanged: boolean,
): number {
  const item = entities.get(itemId, C.Item);
  if (!item) return -1;

  const itemsTable = registry.table<ItemDefRow>('items');
  const itemRow = itemsTable.byIndex(item.type);
  if (!itemRow) return -1;

  const weaponsTable = registry.table<WeaponDefRow>('weapons');
  const wRow = weaponsTable.byId(itemRow.id);
  if (!wRow) return -1;

  if (isRanged) {
    if (!wRow.launcher) return -1;
  } else {
    if (wRow.launcher) return -1;
  }

  const qualityMult = QUALITY_COMBAT_MULT[item.quality] ?? 1.0;
  const materialsTable = registry.table<MaterialDefRow>('materials');
  const matRow = materialsTable.byIndex(item.material);
  let metalTier = 0;
  if (matRow && matRow.class === 'metal') {
    const metalsTable = registry.table<MetalDefRow>('metals');
    const metalRow = metalsTable.byId(matRow.id);
    metalTier = metalRow?.tier ?? 0;
  }

  let baseScore = metalTier * qualityMult;
  if (baseScore === 0) {
    baseScore = 0.1 * qualityMult;
  }

  if (preferredClass !== 'any' && wRow.weaponClass === preferredClass) {
    baseScore += 1000;
  }

  return baseScore;
}

/**
 * Score a shield for claiming.
 */
export function scoreShield(
  registry: Registry,
  entities: EntityStore,
  itemId: EntityId,
): number {
  const item = entities.get(itemId, C.Item);
  if (!item) return -1;

  const itemsTable = registry.table<ItemDefRow>('items');
  const itemRow = itemsTable.byIndex(item.type);
  if (!itemRow) return -1;

  const armorTable = registry.table<ArmorDefRow>('armor');
  const aRow = armorTable.byId(itemRow.id);
  if (!aRow || aRow.armorSlot !== 'shield') return -1;

  const materialsTable = registry.table<MaterialDefRow>('materials');
  const matRow = materialsTable.byIndex(item.material);
  let metalTier = 0;
  if (matRow && matRow.class === 'metal') {
    const metalsTable = registry.table<MetalDefRow>('metals');
    const metalRow = metalsTable.byId(matRow.id);
    metalTier = metalRow?.tier ?? 0;
  }
  const qualityMult = QUALITY_COMBAT_MULT[item.quality] ?? 1.0;

  return (metalTier + 1) * qualityMult;
}

/**
 * Score an armor piece for claiming.
 */
export function scoreArmorPiece(
  registry: Registry,
  entities: EntityStore,
  itemId: EntityId,
  slot: 'head' | 'body' | 'arms' | 'legs' | 'feet',
  preference: 'metal' | 'leather' | 'any',
): number {
  const item = entities.get(itemId, C.Item);
  if (!item) return -1;

  const itemsTable = registry.table<ItemDefRow>('items');
  const itemRow = itemsTable.byIndex(item.type);
  if (!itemRow) return -1;

  const armorTable = registry.table<ArmorDefRow>('armor');
  const aRow = armorTable.byId(itemRow.id);
  if (!aRow || aRow.armorSlot !== slot) return -1;

  const materialsTable = registry.table<MaterialDefRow>('materials');
  const matRow = materialsTable.byIndex(item.material);
  const matClass = matRow?.class ?? '';

  if (preference === 'metal' && matClass !== 'metal') return -1;
  if (preference === 'leather' && matClass !== 'leather') return -1;

  let armorMult = 1.0;
  if (matRow && matRow.class === 'metal') {
    const metalsTable = registry.table<MetalDefRow>('metals');
    const metalRow = metalsTable.byId(matRow.id);
    armorMult = (metalRow?.armorMult ?? 1000) / 1000;
  }
  const qualityMult = QUALITY_COMBAT_MULT[item.quality] ?? 1.0;

  return aRow.armor * armorMult * qualityMult;
}

/**
 * Drop an unequipped item at the barracks (or current position).
 */
export function dropItemAtBarracks(
  ctx: TickContext,
  itemId: EntityId,
  barracksZoneId: EntityId,
  soldierId: EntityId,
): void {
  const entities = ctx.world.entities;
  const item = entities.get(itemId, C.Item);
  if (!item) return;

  const items = ctx.world.services.items;
  if (items === null) return;
  items.setOwner(itemId, 0);

  let dropTile: TileIndex = -1;
  if (barracksZoneId !== 0 && ctx.readers.has('14')) {
    const zone = ctx.readers.of<BuildingsReader>('14').zone(barracksZoneId);
    if (zone && zone.tiles.length > 0) {
      dropTile = zone.tiles[0] ?? -1;
    }
  }
  if (dropTile < 0) {
    const pos = entities.get(soldierId, C.Position);
    if (pos) dropTile = ctx.world.map.index(pos.x, pos.y, pos.z);
  }

  if (dropTile >= 0) items.dropAt(itemId, dropTile);
}

/**
 * Claim an item for a soldier.
 */
export function claimItemForSoldier(
  entities: EntityStore,
  itemId: EntityId,
  soldierId: EntityId,
  items?: ItemsApi | null,
): void {
  const item = entities.get(itemId, C.Item);
  if (item === undefined || items === undefined || items === null) return;
  if (item.containerId !== 0) items.takeOut(itemId);
  items.attachToCarrier(itemId, soldierId);
  items.setOwner(itemId, soldierId);
}

/** An enabled civilian without this tool has first claim on picks and axes. */
function neededCivilianTool(ctx: TickContext, itemId: EntityId): boolean {
  if (!ctx.readers.has('11')) return false;
  const entities = ctx.world.entities;
  const table = ctx.registry.table<ItemDefRow>('items');
  const item = entities.get(itemId, C.Item);
  const category = item === undefined ? '' : table.byIndex(item.type)?.category;
  const labor = category === 'tool/pick' ? 'mining' : category === 'tool/axe' ? 'woodcutting' : null;
  if (labor === null) return false;
  return ctx.readers.of<JobsReader>('11').workersWithLabor(labor).some((workerId) => {
    return ![entities.get(workerId, C.Worker)?.toolId ?? 0, entities.get(workerId, C.Equipment)?.weapon ?? 0]
      .some((toolId) => {
        const tool = entities.get(toolId, C.Item);
        return tool?.carriedBy === workerId && table.byIndex(tool.type)?.category === category;
      });
  });
}

/**
 * Re-equip an individual soldier according to squad preferences.
 */
export function reequipSoldier(
  ctx: TickContext,
  squad: Squad,
  soldierId: EntityId,
): void {
  const entities = ctx.world.entities;
  const registry = ctx.registry;
  if (!entities.alive(soldierId)) return;

  let equip = entities.get(soldierId, C.Equipment);
  if (!equip) {
    equip = {
      weapon: 0,
      shield: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      quiver: 0,
    };
    entities.add(soldierId, C.Equipment, equip);
  }

  const isRanged = squad.equipment.ranged;
  const preferredWeaponClass = squad.equipment.weaponClass;
  const armorPreference = squad.equipment.armor;

  // 1. Weapon selection
  const currentWeaponScore = equip.weapon !== 0 && entities.alive(equip.weapon)
    ? scoreWeapon(registry, entities, equip.weapon, preferredWeaponClass, isRanged)
    : -1;
  let bestWeaponId = equip.weapon;
  let bestWeaponScore = currentWeaponScore;

  for (const itemId of entities.with(C.Item)) {
    if (!isAvailableItem(entities, itemId) || neededCivilianTool(ctx, itemId)) continue;
    const sc = scoreWeapon(registry, entities, itemId, preferredWeaponClass, isRanged);
    if (sc > bestWeaponScore) {
      bestWeaponScore = sc;
      bestWeaponId = itemId;
    }
  }

  if (bestWeaponId !== equip.weapon && bestWeaponId !== 0) {
    if (equip.weapon !== 0 && entities.alive(equip.weapon)) {
      dropItemAtBarracks(ctx, equip.weapon, squad.barracksZoneId, soldierId);
    }
    claimItemForSoldier(entities, bestWeaponId, soldierId, ctx.world.services.items);
    equip.weapon = bestWeaponId;
  }

  // 2. Shield selection (two-handed/shield exclusion)
  const itemsTable = registry.table<ItemDefRow>('items');
  const weaponsTable = registry.table<WeaponDefRow>('weapons');
  let isTwoHanded = false;
  if (equip.weapon !== 0 && entities.alive(equip.weapon)) {
    const wItem = entities.get(equip.weapon, C.Item);
    if (wItem) {
      const itemRow = itemsTable.byIndex(wItem.type);
      const wRow = itemRow ? weaponsTable.byId(itemRow.id) : undefined;
      if (wRow && wRow.hands === 2) {
        isTwoHanded = true;
      }
    }
  }

  if (isTwoHanded) {
    if (equip.shield !== 0 && entities.alive(equip.shield)) {
      dropItemAtBarracks(ctx, equip.shield, squad.barracksZoneId, soldierId);
      equip.shield = 0;
    }
  } else {
    const currentShieldScore = equip.shield !== 0 && entities.alive(equip.shield)
      ? scoreShield(registry, entities, equip.shield)
      : -1;
    let bestShieldId = equip.shield;
    let bestShieldScore = currentShieldScore;

    for (const itemId of entities.with(C.Item)) {
      if (!isAvailableItem(entities, itemId)) continue;
      const sc = scoreShield(registry, entities, itemId);
      if (sc > bestShieldScore) {
        bestShieldScore = sc;
        bestShieldId = itemId;
      }
    }

    if (bestShieldId !== equip.shield && bestShieldId !== 0) {
      if (equip.shield !== 0 && entities.alive(equip.shield)) {
        dropItemAtBarracks(ctx, equip.shield, squad.barracksZoneId, soldierId);
      }
      claimItemForSoldier(entities, bestShieldId, soldierId, ctx.world.services.items);
      equip.shield = bestShieldId;
    }
  }

  // 3. Armor selection per slot
  const slots: readonly ('head' | 'body' | 'arms' | 'legs' | 'feet')[] = [
    'head',
    'body',
    'arms',
    'legs',
    'feet',
  ];

  for (const slot of slots) {
    const currentPieceId = equip.armor[slot];
    const currentScore = currentPieceId !== 0 && entities.alive(currentPieceId)
      ? scoreArmorPiece(registry, entities, currentPieceId, slot, armorPreference)
      : -1;
    let bestPieceId = currentPieceId;
    let bestScore = currentScore;

    for (const itemId of entities.with(C.Item)) {
      if (!isAvailableItem(entities, itemId)) continue;
      const sc = scoreArmorPiece(registry, entities, itemId, slot, armorPreference);
      if (sc > bestScore) {
        bestScore = sc;
        bestPieceId = itemId;
      }
    }

    if (bestPieceId !== currentPieceId && bestPieceId !== 0) {
      if (currentPieceId !== 0 && entities.alive(currentPieceId)) {
        dropItemAtBarracks(ctx, currentPieceId, squad.barracksZoneId, soldierId);
      }
      claimItemForSoldier(entities, bestPieceId, soldierId, ctx.world.services.items);
      equip.armor[slot] = bestPieceId;
    }
  }

  // 4. Ranged specific: quiver and SOLDIER_AMMO
  if (isRanged) {
    // Quiver
    if (equip.quiver === 0 || !entities.alive(equip.quiver)) {
      for (const itemId of entities.with(C.Item)) {
        if (!isAvailableItem(entities, itemId)) continue;
        const item = entities.get(itemId, C.Item);
        if (item) {
          const row = itemsTable.byIndex(item.type);
          if (row?.id === 'quiver' || row?.category === 'container/quiver') {
            claimItemForSoldier(entities, itemId, soldierId, ctx.world.services.items);
            equip.quiver = itemId;
            break;
          }
        }
      }
    }

    // Ammunition claiming
    if (equip.weapon !== 0 && entities.alive(equip.weapon)) {
      const wItem = entities.get(equip.weapon, C.Item);
      const itemRow = wItem ? itemsTable.byIndex(wItem.type) : undefined;
      const wRow = itemRow ? weaponsTable.byId(itemRow.id) : undefined;
      const wantedAmmo = wRow?.launcher?.ammo;
      if (wantedAmmo) {
        let currentAmmoCount = 0;
        for (const itemId of entities.with(C.Item)) {
          const it = entities.get(itemId, C.Item);
          if (it && it.carriedBy === soldierId && it.count > 0) {
            const row = itemsTable.byIndex(it.type);
            if (row?.id === wantedAmmo) {
              currentAmmoCount += it.count;
            }
          }
        }

        const needed = SOLDIER_AMMO - currentAmmoCount;
        if (needed > 0) {
          let toClaim = needed;
          for (const itemId of entities.with(C.Item)) {
            if (toClaim <= 0) break;
            if (!isAvailableItem(entities, itemId)) continue;
            const it = entities.get(itemId, C.Item);
            if (!it) continue;
            const row = itemsTable.byIndex(it.type);
            if (row?.id === wantedAmmo && it.count > 0) {
              claimItemForSoldier(entities, itemId, soldierId, ctx.world.services.items);
              toClaim -= it.count;
            }
          }
        }
      }
    }
  }
}

/**
 * Re-equip all members of a squad.
 */
export function reequipSquad(ctx: TickContext, squadId: EntityId): void {
  const squad = ctx.world.entities.get(squadId, C.Squad);
  if (!squad) return;
  for (const m of squad.members) {
    reequipSoldier(ctx, squad, m);
  }
}

/**
 * Re-equip all squads in the fortress.
 */
export function reequipAllSquads(ctx: TickContext): void {
  for (const squadId of ctx.world.entities.with(C.Squad)) {
    reequipSquad(ctx, squadId);
  }
}

/** Item destruction clears references before another tick or a save can observe stale gear. */
export function clearDestroyedEquipment(entities: EntityStore, itemId: EntityId): void {
  for (const id of entities.with(C.Equipment)) {
    const equip = entities.get(id, C.Equipment);
    if (equip === undefined) continue;
    if (equip.weapon === itemId) equip.weapon = 0;
    if (equip.shield === itemId) equip.shield = 0;
    if (equip.quiver === itemId) equip.quiver = 0;
    for (const slot of ['head', 'body', 'arms', 'legs', 'feet'] as const) {
      if (equip.armor[slot] === itemId) equip.armor[slot] = 0;
    }
    for (const slot of ['body', 'legs', 'feet', 'over'] as const) {
      if (equip.clothing[slot] === itemId) equip.clothing[slot] = 0;
    }
  }
}
