/**
 * An item's enchantment and its numbers at the item's tier: `02-systems/25-runecraft.md` § Setting
 * stones and § Enchantments in combat. The rows are `03-content/weapons-and-armor.md` § Enchantments;
 * code reads their kinds, never their ids.
 */

import { C } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { EntityId } from '@core/types';
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
export function enchantOfItem(entities: EntityStore, registry: Registry, itemId: EntityId): EnchantView | undefined {
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
