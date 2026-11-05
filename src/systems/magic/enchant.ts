/**
 * An item's enchantment and its numbers at the item's tier: `02-systems/25-runecraft.md` § Setting
 * stones and § Enchantments in combat. The rows are `03-content/weapons-and-armor.md` § Enchantments;
 * code reads their kinds, never their ids.
 */

import { C } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { Map3D } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { EnchantDef, EnchantEffect } from '@content/generate';
import { QUALITY_COMBAT_MULT } from '@systems/combat/constants';

/** One effect of an enchantment at the item's tier. */
export interface EnchantEffectView {
  readonly kind: string;
  readonly value: number;
  /** A damage type, or ''. */
  readonly type: string;
  /** Percent; 0 when the effect always applies. */
  readonly chance: number;
  /** 0 for an effect with no duration. */
  readonly ticks: number;
}

/** `magic.enchantOf(itemId)`: the row, the suffix and the effects at the item's tier. */
export interface EnchantView {
  readonly id: string;
  readonly slot: EnchantDef['slot'];
  readonly suffix: string;
  /** The setting's quality roll. */
  readonly tier: number;
  readonly effects: readonly EnchantEffectView[];
}

/** An effect at a tier: what `scales` names is multiplied by `QUALITY_COMBAT_MULT[tier]` and rounded. */
export function effectAtTier(effect: EnchantEffect, tier: number): EnchantEffectView {
  const mult = QUALITY_COMBAT_MULT[tier] ?? 1;
  const ticks = effect.ticks ?? 0;
  return {
    kind: effect.kind,
    value: effect.scales === 'value' ? Math.round(effect.value * mult) : effect.value,
    type: effect.type ?? '',
    chance: effect.chance ?? 0,
    ticks: effect.scales === 'ticks' ? Math.round(ticks * mult) : ticks,
  };
}

/** The enchantment of an item, or undefined for an item with none (or no `enchants` table). */
export function enchantOfItem(entities: EntityGet, registry: Registry, itemId: EntityId): EnchantView | undefined {
  const enchant = entities.get(itemId, C.Item)?.enchant;
  if (enchant === undefined || !registry.hasTable('enchants')) return undefined;
  const row = registry.table<EnchantDef>('enchants').byIndex(enchant.id);
  if (row === undefined) return undefined;
  return {
    id: row.id,
    slot: row.slot,
    suffix: row.suffix,
    tier: enchant.tier,
    effects: row.effects.map((effect) => effectAtTier(effect, enchant.tier)),
  };
}

/** What the item lookups need of an entity store: get, so a frame's `readers.entities` serves too. */
export type EntityGet = Pick<EntityStore, 'get'>;

const NO_EFFECTS: readonly EnchantEffectView[] = Object.freeze([]);

/**
 * The effects of an item's enchantment at its tier, for combat (§ Enchantments in combat); empty
 * for item 0 and for an item with none. That is decided by `Item.enchant` alone, so an unenchanted
 * fight looks nothing more up.
 */
export function itemEnchantEffects(entities: EntityGet, registry: Registry, itemId: EntityId): readonly EnchantEffectView[] {
  if (itemId === 0 || entities.get(itemId, C.Item)?.enchant === undefined) return NO_EFFECTS;
  return enchantOfItem(entities, registry, itemId)?.effects ?? NO_EFFECTS;
}

/** The sum of the values of every effect of `kind`; 0 for none. */
export function effectSum(effects: readonly EnchantEffectView[], kind: string): number {
  let sum = 0;
  for (const e of effects) if (e.kind === kind) sum += e.value;
  return sum;
}

const WORN_SLOTS = ['head', 'body', 'arms', 'legs', 'feet'] as const;

/** The effects of every enchanted piece in the creature's armor slots, head to feet; empty with none. */
export function wornEnchantEffects(entities: EntityGet, registry: Registry, id: EntityId): readonly EnchantEffectView[] {
  const equip = entities.get(id, C.Equipment);
  if (equip === undefined) return NO_EFFECTS;
  let out: EnchantEffectView[] | undefined;
  for (const slot of WORN_SLOTS) {
    const effects = itemEnchantEffects(entities, registry, equip.armor[slot]);
    if (effects.length > 0) (out ??= []).push(...effects);
  }
  return out ?? NO_EFFECTS;
}

/** A worn piece keeps its wearer from being slowed (`slow_immune`). */
export function wearsSlowImmune(entities: EntityStore, registry: Registry, id: EntityId): boolean {
  return wornEnchantEffects(entities, registry, id).some((e) => e.kind === 'slow_immune' && e.value > 0);
}

/** A worn piece keeps its wearer from being put to flight, by Dread or a fearsome blow (`flee_immune`). */
export function wearsFleeImmune(entities: EntityGet, registry: Registry, id: EntityId): boolean {
  return wornEnchantEffects(entities, registry, id).some((e) => e.kind === 'flee_immune' && e.value > 0);
}

/** The percent the wearer's pieces add to its resist roll against Daze (`daze_resist`), summed; 0 for none. */
export function wornDazeResist(entities: EntityGet, registry: Registry, id: EntityId): number {
  return effectSum(wornEnchantEffects(entities, registry, id), 'daze_resist');
}

/** A worn piece lights its wearer's 3×3 (`light`). */
export function wearsLight(entities: EntityGet, registry: Registry, id: EntityId): boolean {
  return wornEnchantEffects(entities, registry, id).some((e) => e.kind === 'light' && e.value > 0);
}

/**
 * A creature on `tile` or on one of its eight neighbours on the same level wears a `light` piece, so
 * the tile lies in a worn light's 3×3 (07's `glow` rule reads it beside the lamps). `at` is the
 * spatial index's `readers.entities.at`; nothing is kept between calls.
 */
export function wornLightAt(map: Map3D, at: (i: TileIndex) => readonly EntityId[], entities: EntityGet, registry: Registry,
  tile: TileIndex): boolean {
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    const t = map.offset(tile, dx, dy, 0);
    if (t < 0) continue;
    for (const id of at(t)) if (wearsLight(entities, registry, id)) return true;
  }
  return false;
}

/** Tiles worn pieces add to how far the wearer spots a hidden creature: the largest `spot_radius`, 0 for none. */
export function wornSpotRadius(entities: EntityStore, registry: Registry, id: EntityId): number {
  let best = 0;
  for (const e of wornEnchantEffects(entities, registry, id)) if (e.kind === 'spot_radius' && e.value > best) best = e.value;
  return best;
}
