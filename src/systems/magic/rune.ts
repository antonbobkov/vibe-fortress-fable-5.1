/**
 * A runecaster's own rune and the sanctum's arithmetic: `02-systems/25-runecraft.md` § Rune of one's
 * own and § The sanctum. Integers throughout: rune is held in milli-rune.
 *
 * ```
 * max   = level × RUNE_PER_LEVEL
 * regen = level × RUNE_REGEN_PER_LEVEL × metal percent           // per hour
 * metal percent = max(METAL_RUNE_FLOOR_PERCENT, 100 − METAL_RUNE_PENALTY_PERCENT × n)
 * ```
 */

import { C } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import type { EntityId } from '@core/types';
import { jobXp } from '@systems/dwarves/rules/skills';
import {
  ATTUNE_XP,
  METAL_RUNE_FLOOR_PERCENT,
  METAL_RUNE_PENALTY_PERCENT,
  MISHAP_BASE,
  MISHAP_FLOOR,
  RUNE_PER_LEVEL,
  RUNE_REGEN_PER_LEVEL,
} from './constants';

/** Milli-rune in one rune. */
export const MILLI = 1000;

interface ArmorRow {
  readonly id: string;
  readonly layer: string;
}

interface MaterialRow {
  readonly id: string;
  readonly class: string;
}

/** A dwarf's level in a skill, read from its `Skills` (0 when it has none). */
export function skillLevel(entities: EntityStore, registry: Registry, id: EntityId, skill: string): number {
  const s = registry.table('skills').index(skill);
  if (s <= 0) return 0;
  return (entities.get(id, C.Skills)?.level[s] ?? 0) as number;
}

/** The worn pieces that drink the rune: layer mail or plate, of a metal. Ascending slot order. */
export function metalPieces(entities: EntityStore, registry: Registry, id: EntityId): EntityId[] {
  const equip = entities.get(id, C.Equipment);
  if (equip === undefined) return [];
  const items = registry.table<{ id: string }>('items');
  const armor = registry.table<ArmorRow>('armor');
  const materials = registry.table<MaterialRow>('materials');
  const out: EntityId[] = [];
  for (const slot of ['head', 'body', 'arms', 'legs', 'feet'] as const) {
    const itemId = equip.armor[slot];
    if (itemId === 0 || !entities.alive(itemId)) continue;
    const item = entities.get(itemId, C.Item);
    if (item === undefined) continue;
    const row = armor.byId(items.byIndex(item.type)?.id ?? '');
    if (row === undefined || (row.layer !== 'mail' && row.layer !== 'plate')) continue;
    if (materials.byIndex(item.material)?.class !== 'metal') continue;
    out.push(itemId);
  }
  return out;
}

/** `max(METAL_RUNE_FLOOR_PERCENT, 100 − METAL_RUNE_PENALTY_PERCENT × n)`. */
export function metalPercent(pieces: number): number {
  return Math.max(METAL_RUNE_FLOOR_PERCENT, 100 - METAL_RUNE_PENALTY_PERCENT * pieces);
}

/** The rune maximum at a level, in milli-rune. */
export function runeMaxMilli(level: number): number {
  return level * RUNE_PER_LEVEL * MILLI;
}

/** Milli-rune regained per hour at a level with a metal percent, truncated. */
export function runeRegenMilli(level: number, metal: number): number {
  return Math.floor((level * Math.round(RUNE_REGEN_PER_LEVEL * MILLI) * metal) / 100);
}

/** Whole hours from `current` to `max` at `regen` a hour; 0 when full, -1 when it never fills. */
export function hoursToFull(current: number, max: number, regen: number): number {
  if (current >= max) return 0;
  if (regen <= 0) return -1;
  return Math.ceil((max - current) / regen);
}

/** A mishap chance per mille: `max(MISHAP_FLOOR, MISHAP_BASE − 2 × level − tier)`. */
export function mishapPermille(level: number, tier: number): number {
  return Math.max(MISHAP_FLOOR, MISHAP_BASE - 2 * level - tier);
}

/** A session's xp: `jobXp(ATTUNE_XP × (100 + 5 × tier) / 100, wits)`. */
export function sessionXp(tier: number, wits: number): number {
  return jobXp(Math.floor((ATTUNE_XP * (100 + 5 * tier)) / 100), wits);
}

/** The mishaps that have landed, with their weights (§ The sanctum, Mishaps). */
export const MISHAP_WEIGHTS: readonly { readonly kind: MishapKind; readonly weight: number }[] = [
  { kind: 'singed', weight: 40 },
  { kind: 'blackout', weight: 25 },
  { kind: 'scorched_circle', weight: 15 },
  { kind: 'fire', weight: 7 },
  { kind: 'surge', weight: 3 },
];

export type MishapKind = 'singed' | 'blackout' | 'scorched_circle' | 'fire' | 'surge';

/** One roll per session on stream 25; on a mishap, a second draw picks the kind by weight. */
export function rollMishap(rng: RngStream, level: number, tier: number): MishapKind | null {
  if (rng.int(0, 999) >= mishapPermille(level, tier)) return null;
  const total = MISHAP_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
  let pick = rng.int(0, total - 1);
  for (const w of MISHAP_WEIGHTS) {
    if (pick < w.weight) return w.kind;
    pick -= w.weight;
  }
  return null;
}
