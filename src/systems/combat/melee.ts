/**
 * Melee combat resolution: `02-systems/16-combat.md` § Melee resolution,
 * `04-implementation/algorithms/combat-and-health.md` § Melee.
 */

import { C, type Attributes, type Body } from '@core/components';
import { BODY_SLOTS } from '@core/types';
import type { BodySlot, DamageType, EntityId, Quality } from '@core/types';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import type { TickContext } from '@core/system';
import { grantXp } from '@systems/dwarves';
import {
  BLUNT_THROUGH_PERCENT,
  CREATURE_ATTRIBUTE_DEFAULT,
  CREATURE_BASE_SKILL,
  MIN_ATTACK_COOLDOWN,
  QUALITY_COMBAT_MULT,
} from './constants';

export type MeleeOutcome = 'hit' | 'miss' | 'parried' | 'blocked';

export interface MeleeResult {
  outcome: MeleeOutcome;
  damage: number;
  part: BodySlot | null;
  damageType: DamageType | string;
}

export interface ArmorPiece {
  id: EntityId;
  layer: 'plate' | 'mail' | 'leather' | 'padding';
  armor: number;
  armorMult: number;
  coverage: number;
  qualityArmorMult: number;
}

interface WeaponRow {
  readonly id: string;
  readonly name: string;
  readonly weaponClass: string;
  readonly skill: string;
  readonly damageType: DamageType | null;
  readonly damage: number;
  readonly size: number;
  readonly hands: number;
  readonly launcher?: {
    range: number;
    power: number;
    ammo: string;
  };
}

interface ArmorRow {
  readonly id: string;
  readonly name: string;
  readonly armorSlot: 'head' | 'body' | 'arms' | 'legs' | 'feet' | 'shield';
  readonly covers: readonly { part: BodySlot; coverage: number }[];
  readonly layer: 'plate' | 'mail' | 'leather' | 'padding' | 'none';
  readonly armor: number;
  readonly weight: number;
}

interface MetalRow {
  readonly id: string;
  readonly weaponMult: number;
  readonly armorMult: number;
  readonly bluntBonus: number;
}

interface MaterialRow {
  readonly id: string;
  readonly class: string;
  readonly sharpness?: number;
}

interface ItemRow {
  readonly id: string;
  readonly category: string;
}

interface AttackDef {
  readonly name: string;
  readonly type: DamageType | string;
  readonly damage: number;
  readonly size: number;
}

interface SpeciesRow {
  readonly id: string;
  readonly plan: string;
  readonly naturalArmor: number;
  readonly attacks: readonly AttackDef[];
}

interface BodyPlanRow {
  readonly id: string;
  readonly parts: Record<BodySlot, { hit: number; hpFactor: number }>;
}

const LAYER_RANK: Record<string, number> = {
  plate: 4,
  mail: 3,
  leather: 2,
  padding: 1,
};

const DAMAGE_VS_LAYER: Record<DamageType, Record<'padding' | 'leather' | 'mail' | 'plate', number>> = {
  edge: { padding: 0.6, leather: 0.8, mail: 1.2, plate: 1.1 },
  pierce: { padding: 0.4, leather: 0.6, mail: 0.8, plate: 1.2 },
  blunt: { padding: 1.2, leather: 1.0, mail: 0.5, plate: 0.9 },
};

export function getDamageVsLayer(type: DamageType, layer: 'padding' | 'leather' | 'mail' | 'plate'): number {
  return DAMAGE_VS_LAYER[type]?.[layer] ?? 1.0;
}

export function getSkill(entities: EntityStore, registry: Registry, id: EntityId, skillId: string): number {
  const skills = entities.get(id, C.Skills);
  if (skills === undefined) return CREATURE_BASE_SKILL;
  const s = registry.table('skills').index(skillId);
  if (s < 0) return CREATURE_BASE_SKILL;
  return skills.level[s] ?? CREATURE_BASE_SKILL;
}

export function getAttribute(entities: EntityStore, id: EntityId, attr: keyof Attributes): number {
  const attrs = entities.get(id, C.Attributes);
  return attrs !== undefined ? attrs[attr] : CREATURE_ATTRIBUTE_DEFAULT;
}

export function isWarTrained(entities: EntityStore, id: EntityId): boolean {
  const tame = entities.get(id, C.Tame);
  return tame?.trained === 'war';
}

export function isConscious(entities: EntityStore, id: EntityId): boolean {
  const body = entities.get(id, C.Body);
  return body !== undefined ? body.conscious : true;
}

export function isAsleep(entities: EntityStore, id: EntityId): boolean {
  const brain = entities.get(id, C.Brain);
  return brain?.activity === 'sleep';
}

export function isFleeing(entities: EntityStore, id: EntityId): boolean {
  const brain = entities.get(id, C.Brain);
  if (brain?.behavior === 'flee') return true;
  const wild = entities.get(id, C.Wild);
  if (wild?.state === 'flee') return true;
  return false;
}

export function getMetalWeaponMult(registry: Registry, materialIndex: number): number {
  const matRow = registry.table<MaterialRow>('materials').byIndex(materialIndex);
  if (matRow === undefined) return 1.0;
  if (matRow.class === 'metal') {
    const metalRow = registry.table<MetalRow>('metals').byId(matRow.id);
    if (metalRow !== undefined) return metalRow.weaponMult / 1000;
  } else if (matRow.sharpness !== undefined) {
    return matRow.sharpness / 1000;
  }
  return 1.0;
}

export function getMetalArmorMult(registry: Registry, materialIndex: number): number {
  const matRow = registry.table<MaterialRow>('materials').byIndex(materialIndex);
  if (matRow === undefined) return 1.0;
  if (matRow.class === 'metal') {
    const metalRow = registry.table<MetalRow>('metals').byId(matRow.id);
    if (metalRow !== undefined) return metalRow.armorMult / 1000;
  }
  return 1.0;
}

export function getBluntBonus(registry: Registry, materialIndex: number): number {
  const matRow = registry.table<MaterialRow>('materials').byIndex(materialIndex);
  if (matRow === undefined) return 0;
  if (matRow.class === 'metal') {
    const metalRow = registry.table<MetalRow>('metals').byId(matRow.id);
    return metalRow?.bluntBonus ?? 0;
  }
  return 0;
}

export interface WieldedWeapon {
  item: EntityId;
  weaponDef: WeaponRow;
  material: number;
  quality: Quality;
}

export function getWeaponDef(entities: EntityStore, registry: Registry, itemId: EntityId): WieldedWeapon | null {
  if (itemId === 0 || !entities.alive(itemId)) return null;
  const item = entities.get(itemId, C.Item);
  if (item === undefined) return null;
  const itemRow = registry.table<ItemRow>('items').byIndex(item.type);
  if (itemRow === undefined) return null;
  const weaponRow = registry.table<WeaponRow>('weapons').byId(itemRow.id);
  if (weaponRow === undefined) return null;
  return {
    item: itemId,
    weaponDef: weaponRow,
    material: item.material,
    quality: item.quality,
  };
}

/**
 * Returns the weapon wielded by creature `id`.
 * Checks `Equipment.weapon` first, then worker tool (`Worker.toolId` for picks/axes).
 */
export function weaponOf(entities: EntityStore, registry: Registry, id: EntityId): WieldedWeapon | null {
  const equip = entities.get(id, C.Equipment);
  if (equip && equip.weapon !== 0) {
    const w = getWeaponDef(entities, registry, equip.weapon);
    if (w !== null) return w;
  }
  const worker = entities.get(id, C.Worker);
  if (worker && worker.toolId !== 0) {
    const w = getWeaponDef(entities, registry, worker.toolId);
    if (w !== null) return w;
  }
  return null;
}

export function shieldOf(entities: EntityStore, id: EntityId): EntityId {
  const equip = entities.get(id, C.Equipment);
  if (equip && equip.shield !== 0 && entities.alive(equip.shield)) {
    return equip.shield;
  }
  return 0;
}

export function shieldIsBuckler(registry: Registry, entities: EntityStore, shieldId: EntityId): boolean {
  if (shieldId === 0 || !entities.alive(shieldId)) return false;
  const item = entities.get(shieldId, C.Item);
  if (!item) return false;
  const itemRow = registry.table<ItemRow>('items').byIndex(item.type);
  return itemRow?.id === 'buckler';
}

/**
 * Collects all armor and clothing pieces covering `part` on defender `d`,
 * sorted outer layer first (plate > mail > leather > padding).
 */
export function armorCovering(
  entities: EntityStore,
  registry: Registry,
  defenderId: EntityId,
  part: BodySlot,
): ArmorPiece[] {
  const equip = entities.get(defenderId, C.Equipment);
  if (equip === undefined) return [];

  const pieces: ArmorPiece[] = [];
  const itemsTable = registry.table<ItemRow>('items');
  const armorTable = registry.table<ArmorRow>('armor');

  // Armor slots
  for (const slot of ['head', 'body', 'arms', 'legs', 'feet'] as const) {
    const itemId = equip.armor[slot];
    if (itemId === 0 || !entities.alive(itemId)) continue;
    const item = entities.get(itemId, C.Item);
    if (item === undefined) continue;
    const itemRow = itemsTable.byIndex(item.type);
    if (itemRow === undefined) continue;
    const armorRow = armorTable.byId(itemRow.id);
    if (armorRow === undefined || armorRow.layer === 'none') continue;

    const cover = armorRow.covers.find((c) => c.part === part);
    if (cover !== undefined && cover.coverage > 0) {
      pieces.push({
        id: itemId,
        layer: armorRow.layer,
        armor: armorRow.armor,
        armorMult: getMetalArmorMult(registry, item.material),
        coverage: cover.coverage,
        qualityArmorMult: QUALITY_COMBAT_MULT[item.quality] ?? 1.0,
      });
    }
  }

  // Clothing pieces (`weapons-and-armor.md` line 69)
  // tunic: torso 100, arms 50; trousers: legs 100; boots: legs 10; cloak: torso 50
  for (const slot of ['body', 'legs', 'feet', 'over'] as const) {
    const itemId = equip.clothing[slot];
    if (itemId === 0 || !entities.alive(itemId)) continue;
    const item = entities.get(itemId, C.Item);
    if (item === undefined) continue;
    const itemRow = itemsTable.byIndex(item.type);
    if (itemRow === undefined) continue;

    let coverage = 0;
    if (itemRow.id === 'tunic') {
      if (part === 'torso') coverage = 100;
      else if (part === 'left_arm' || part === 'right_arm') coverage = 50;
    } else if (itemRow.id === 'trousers') {
      if (part === 'left_leg' || part === 'right_leg') coverage = 100;
    } else if (itemRow.id === 'boots') {
      if (part === 'left_leg' || part === 'right_leg') coverage = 10;
    } else if (itemRow.id === 'cloak') {
      if (part === 'torso') coverage = 50;
    }

    if (coverage > 0) {
      pieces.push({
        id: itemId,
        layer: 'padding',
        armor: 1,
        armorMult: 1.0,
        coverage,
        qualityArmorMult: QUALITY_COMBAT_MULT[item.quality] ?? 1.0,
      });
    }
  }

  // Order outer layer first: plate > mail > leather > padding
  pieces.sort((a, b) => (LAYER_RANK[b.layer] ?? 0) - (LAYER_RANK[a.layer] ?? 0));
  return pieces;
}

export function weightedPickPart(
  rng: RngStream,
  plan: BodyPlanRow,
  body: Body | undefined,
  headDoubled: boolean,
): BodySlot {
  let totalWeight = 0;
  const weights: number[] = [];

  for (let i = 0; i < BODY_SLOTS.length; i += 1) {
    const slot = BODY_SLOTS[i] as BodySlot;
    if (body?.parts[i]?.destroyed) {
      weights.push(0);
      continue;
    }
    let w = plan.parts[slot]?.hit ?? 0;
    if (slot === 'head' && headDoubled) w *= 2;
    weights.push(w);
    totalWeight += w;
  }

  if (totalWeight <= 0) return 'torso';

  let roll = rng.int(0, totalWeight - 1);
  for (let i = 0; i < BODY_SLOTS.length; i += 1) {
    const w = weights[i] as number;
    if (roll < w) return BODY_SLOTS[i] as BodySlot;
    roll -= w;
  }
  return 'torso';
}

export interface MeleeOptions {
  forcedPart?: BodySlot;
  overrideDamage?: number;
  overrideDamageType?: DamageType;
  skipXp?: boolean;
  /** 19's installed trap weapon, resolved by the same melee rules. */
  weaponId?: EntityId;
  overrideSkill?: number;
  surprised?: boolean;
}

/**
 * Resolves a melee attack from creature `attackerId` against `defenderId`.
 */
export function resolveMelee(
  ctx: TickContext,
  attackerId: EntityId,
  defenderId: EntityId,
  cooldownUntilMap: Map<EntityId, number>,
  options?: MeleeOptions,
): MeleeResult {
  const entities = ctx.world.entities;
  const registry = ctx.registry;
  const rng = ctx.rng;
  const tick = ctx.tick;

  const w = options?.weaponId === undefined ? weaponOf(entities, registry, attackerId) : getWeaponDef(entities, registry, options.weaponId);
  const creatureA = entities.get(attackerId, C.Creature);
  const creatureD = entities.get(defenderId, C.Creature);
  const speciesTable = registry.table<SpeciesRow>('creatures');

  // Determine attack profile
  let atkDamage = 0;
  let atkSize = 3;
  let atkType: DamageType = 'blunt';
  let atkSkill = 'unarmed';
  let isLauncherMelee = false;

  if (w !== null) {
    const def = w.weaponDef;
    if (def.damageType === null && def.launcher !== undefined) {
      // Launcher in melee attacks as club at half damage (damage 6, size 5, hammer skill, blunt)
      atkDamage = 6;
      atkSize = 5;
      atkType = 'blunt';
      atkSkill = 'hammer';
      isLauncherMelee = true;
    } else {
      atkDamage = def.damage;
      atkSize = def.size;
      atkType = def.damageType ?? 'blunt';
      atkSkill = def.skill;
    }
  } else {
    // Natural attack
    const sp = creatureA ? speciesTable.byIndex(creatureA.species) : undefined;
    if (sp && sp.attacks.length > 0) {
      const idx = rng.int(0, sp.attacks.length - 1);
      const attack = sp.attacks[idx] as AttackDef;
      atkDamage = attack.damage;
      atkSize = attack.size;
      atkType = (attack.type === 'edge' || attack.type === 'pierce' || attack.type === 'blunt') ? attack.type : 'blunt';
      atkSkill = 'unarmed';
    } else {
      atkDamage = 4;
      atkSize = 3;
      atkType = 'blunt';
      atkSkill = 'unarmed';
    }
  }

  if (options?.overrideDamage !== undefined) atkDamage = options.overrideDamage;
  if (options?.overrideDamageType !== undefined) atkType = options.overrideDamageType;

  const skillA = options?.overrideSkill ?? getSkill(entities, registry, attackerId, atkSkill);
  const dodgeSkill = options?.surprised ? 0 : getSkill(entities, registry, defenderId, 'dodge');
  const agiA = getAttribute(entities, attackerId, 'agi');
  const agiD = getAttribute(entities, defenderId, 'agi');

  const unconOrAsleep = !isConscious(entities, defenderId) || isAsleep(entities, defenderId);
  const fleeing = isFleeing(entities, defenderId);
  const posD = entities.get(defenderId, C.Position);
  const inDeepWater = posD !== undefined &&
    ctx.world.map.fluidLevelAt(ctx.world.map.index(posD.x, posD.y, posD.z)) >= 4 &&
    ctx.world.map.fluidTypeAt(ctx.world.map.index(posD.x, posD.y, posD.z)) === 0 &&
    !ctx.world.map.fluidFrozenAt(ctx.world.map.index(posD.x, posD.y, posD.z));

  let hit = 50 + (skillA - dodgeSkill) * 3 + Math.floor((agiA - agiD) / 4) +
    (unconOrAsleep ? 40 : 0) + (fleeing ? 10 : 0) + (inDeepWater ? 20 : 0);
  hit = Math.max(5, Math.min(95, hit));

  // Cooldown
  const cooldownTicks = Math.max(MIN_ATTACK_COOLDOWN, Math.floor(atkSize * 3 + 10 - agiA / 10));
  cooldownUntilMap.set(attackerId, tick + cooldownTicks);

  // Roll hit
  if (rng.int(0, 99) >= hit) {
    ctx.emit({
      type: 'AttackResolved',
      attackerId,
      defenderId,
      targetId: defenderId,
      part: null,
      damageType: atkType,
      amount: 0,
      outcome: 'miss',
    });
    if (!options?.skipXp) {
      grantXp(entities, registry, defenderId, 'dodge', 2, (e) => ctx.emit(e));
      grantXp(entities, registry, attackerId, atkSkill, 1, (e) => ctx.emit(e));
    }
    return { outcome: 'miss', damage: 0, part: null, damageType: atkType };
  }

  // Parry and block (conscious and not fleeing)
  const canAct = !unconOrAsleep && !fleeing;
  if (canAct) {
    // Parry
    const defW = weaponOf(entities, registry, defenderId);
    if (defW && defW.weaponDef.damageType !== null) {
      const defSkill = getSkill(entities, registry, defenderId, defW.weaponDef.skill);
      const parryChance = Math.min(30, defSkill * 2);
      if (rng.int(0, 99) < parryChance) {
        ctx.emit({
          type: 'AttackResolved',
          attackerId,
          defenderId,
          targetId: defenderId,
          part: null,
          damageType: atkType,
          amount: 0,
          outcome: 'parried',
        });
        if (!options?.skipXp) {
          grantXp(entities, registry, defenderId, defW.weaponDef.skill, 2, (e) => ctx.emit(e));
        }
        return { outcome: 'parried', damage: 0, part: null, damageType: atkType };
      }
    }

    // Block: two-handed excludes shields
    const isTwoHanded = defW !== null && defW.weaponDef.hands === 2;
    const defShield = isTwoHanded ? 0 : shieldOf(entities, defenderId);
    if (defShield !== 0) {
      const isBuckler = shieldIsBuckler(registry, entities, defShield);
      const shieldSkill = getSkill(entities, registry, defenderId, 'shield');
      const blockChance = isBuckler ? Math.min(30, 5 + shieldSkill * 2) : Math.min(40, 10 + shieldSkill * 2);
      if (rng.int(0, 99) < blockChance) {
        ctx.emit({
          type: 'AttackResolved',
          attackerId,
          defenderId,
          targetId: defenderId,
          part: null,
          damageType: atkType,
          amount: 0,
          outcome: 'blocked',
        });
        if (!options?.skipXp) {
          grantXp(entities, registry, defenderId, 'shield', 2, (e) => ctx.emit(e));
        }
        return { outcome: 'blocked', damage: 0, part: null, damageType: atkType };
      }
    }
  }

  // Part pick
  let part: BodySlot = options?.forcedPart ?? 'torso';
  if (options?.forcedPart === undefined) {
    const plansTable = registry.table<BodyPlanRow>('bodyPlans');
    const spD = creatureD ? speciesTable.byIndex(creatureD.species) : undefined;
    const plan = spD ? plansTable.byId(spD.plan) : undefined;
    const bodyD = entities.get(defenderId, C.Body);
    if (plan !== undefined) {
      part = weightedPickPart(rng, plan, bodyD, unconOrAsleep);
    }
  }

  // Raw damage calculation
  const strA = getAttribute(entities, attackerId, 'str');
  const strengthFactor = (50 + strA) / 100;
  let raw = 0;

  if (w !== null && !isLauncherMelee) {
    const metalMult = getMetalWeaponMult(registry, w.material);
    const qualMult = QUALITY_COMBAT_MULT[w.quality] ?? 1.0;
    raw = atkDamage * metalMult * qualMult * strengthFactor;
    if (atkType === 'blunt') {
      const bluntBonus = getBluntBonus(registry, w.material);
      if (bluntBonus > 0) {
        raw *= (100 + bluntBonus) / 100;
      }
    }
  } else {
    // Natural attack or launcher in melee
    const warBonus = isWarTrained(entities, attackerId) ? 1.5 : 1.0;
    raw = atkDamage * strengthFactor * warBonus;
  }

  // Armor reduction
  let red = 0;
  const pieces = armorCovering(entities, registry, defenderId, part);
  for (const piece of pieces) {
    const layerMult = getDamageVsLayer(atkType, piece.layer);
    red += piece.armor * piece.armorMult * (piece.coverage / 100) * piece.qualityArmorMult * layerMult;
  }
  const spD = creatureD ? speciesTable.byIndex(creatureD.species) : undefined;
  const naturalArmor = spD?.naturalArmor ?? 0;
  red += naturalArmor * getDamageVsLayer(atkType, 'plate');

  let damage = Math.max(0, raw - red);
  if (atkType === 'blunt' && red > 0) {
    damage = Math.max(damage, (raw * BLUNT_THROUGH_PERCENT) / 100);
  }

  // Toughness reduction
  const touD = getAttribute(entities, defenderId, 'tou');
  const touReduction = Math.min(10, touD / 10);
  damage = Math.round((damage * (100 - touReduction)) / 100);

  // Emit DamageDealt and AttackResolved
  ctx.emit({
    type: 'DamageDealt',
    defenderId,
    part,
    damageType: atkType,
    amount: damage,
    attackerId,
    weaponId: w?.item ?? 0,
  });
  ctx.emit({
    type: 'AttackResolved',
    attackerId,
    defenderId,
    targetId: defenderId,
    part,
    damageType: atkType,
    amount: damage,
    outcome: 'hit',
  });

  // XP grants
  if (!options?.skipXp) {
    grantXp(entities, registry, attackerId, atkSkill, 3, (e) => ctx.emit(e));
    if (red > 0) {
      grantXp(entities, registry, defenderId, 'armor_use', 1, (e) => ctx.emit(e));
    }
  }

  return { outcome: 'hit', damage, part, damageType: atkType };
}
