/** `readers.of('25')`: `02-systems/25-runecraft.md` § Interfaces › Reader. */

import type { ActiveEffect } from '@core/components';
import type { EntityId } from '@core/types';
import type { MishapRecord } from './state';
import type { EnchantView } from './enchant';

/** The spell in a channel item, with the numbers its power gives it. */
export interface SpellView {
  /** The spell's id (`emberbolt`). */
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  /** Whole rune a cast spends. */
  readonly cost: number;
  /** Tiles. */
  readonly range: number;
  /** `round(base × power)`; 0 for a spell that deals none. */
  readonly damage: number;
  /** The damage type, or '' for none. */
  readonly type: string;
  /** `round(ticks × power)`; 0 for a spell with no duration. */
  readonly ticks: number;
  /** The channel's power. */
  readonly power: number;
  /** The channel's name suffix ("of embers"). */
  readonly suffix: string;
}

/** A runecaster's rune, in milli-rune, with what its regen is made of. */
export interface RuneView {
  readonly current: number;
  readonly max: number;
  /** Milli-rune a hour. */
  readonly regen: number;
  /** The metal percent of the regen (100 with no metal worn). */
  readonly metalPercent: number;
  /** The worn pieces that lower it, each by `METAL_RUNE_PENALTY_PERCENT`. */
  readonly metalPieces: readonly EntityId[];
  /** The regen percent of the worn pieces with a `rune` property (a robe's 150; 100 with none). */
  readonly robePercent: number;
  /** Whole rune the worn pieces add to the maximum (a circlet's 10). */
  readonly maxBonus: number;
  /** Whole hours to full; 0 when full, -1 when it never fills. */
  readonly hoursToFull: number;
  /** Rune vials carried (§ Vials). */
  readonly vials: number;
  /** Vials drunk today. */
  readonly vialsToday: number;
}

export interface MagicReader {
  /** `magic.rune(id)`: current, max, regen with its breakdown and time to full; undefined without a `Rune`. */
  rune(id: EntityId): RuneView | undefined;
  /** Sanctum zones, ascending. */
  sanctums(): EntityId[];
  /** A sanctum's living apprentices, ascending. */
  apprentices(zoneId: EntityId): EntityId[];
  /** Attune sessions a dwarf has sat today. */
  sessionsToday(id: EntityId): number;
  /** The mishap chance per mille of a session by this dwarf in this sanctum. */
  mishapPermille(zoneId: EntityId, id: EntityId): number;
  /** A sanctum's last mishap, or undefined. */
  lastMishap(zoneId: EntityId): MishapRecord | undefined;
  /** `magic.canCast(id)`: the creature holds a channel whose spell its rune can pay for now. */
  canCast(id: EntityId): boolean;
  /** `magic.spellOf(itemId)`: the spell set in a channel and its numbers; undefined for anything else. */
  spellOf(itemId: EntityId): SpellView | undefined;
  /** `magic.enchantOf(itemId)`: the item's enchantment row, its suffix and its effects at the item's tier; undefined for none. */
  enchantOf(itemId: EntityId): EnchantView | undefined;
  /** `magic.effects(id)`: the creature's unexpired timed effects, in the order they were added. */
  effects(id: EntityId): readonly ActiveEffect[];
  /** `magic.draughtRest(id)`: ticks until the creature may take a draught again (§ Draughts); 0 when it may now. */
  draughtRest(id: EntityId): number;
}
