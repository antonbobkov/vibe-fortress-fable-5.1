import type { Registry } from '@core/registry';
import type { Civ } from '@core/types';
import { GIFT_REPUTATION_CAP, GIFT_REPUTATION_VALUE, MARGIN_BASE, MARGIN_MIN, MARGIN_PER_SKILL, MARGIN_REP_DIVISOR, MERCHANT_MARKUP, TRADE_REPUTATION_VALUE } from './constants';

interface Preference { civ: Civ; key: string; percent: number }

/** Authored preference rows, with the W4 specificity order. */
export function preferencePercent(registry: Registry, civ: Civ, category: string, material: string, materialClass: string, caged = false): number {
  const rows = registry.derived<readonly Preference[]>('preferences').filter((row) => row.civ === civ);
  const exact = (key: string): number | undefined => rows.find((row) => row.key === key)?.percent;
  if (material === 'deepsilver') return exact('bar deepsilver, deepsilver items') ?? 100;
  if (caged) return exact('creatures (caged)') ?? 100;
  // `caravan-goods.md` § Preferences: "A `material <id>` row applies to every item of that
  // material, before the category and class rows".
  const byMaterial = exact(`material ${material}`);
  if (byMaterial !== undefined) return byMaterial;
  if (materialClass === 'wood' && civ === 'wildwood') return exact('any item with material class wood') ?? 100;
  for (const row of rows) {
    if (row.key === category || row.key.split(', ').includes(category)) return row.percent;
  }
  for (const row of rows) {
    if (row.key === `${category.split('/')[0]}/*`) return row.percent;
    if (row.key.split(', ').some((key) => key === `${category.split('/')[0]}/* (${materialClass})` || (key === `${category.split('/')[0]}/*` && row.key.includes(`(${materialClass})`)))) return row.percent;
  }
  if (materialClass === 'wood') return exact('any item with material class wood') ?? 100;
  return exact('default') ?? 100;
}

/**
 * The material class 20 judges an item by. For the Wildwood a channel (a weapon row with a launcher
 * and no ammunition: 25's wand or staff) is a wooden item whatever its shoe, as a wand's wood already
 * is: they take offence at it and pay little for it.
 */
export function tradeClass(registry: Registry, civ: Civ, itemType: number, materialClass: string): string {
  if (civ !== 'wildwood' || materialClass === 'wood') return materialClass;
  const typeId = registry.table<{ id: string }>('items').byIndex(itemType)?.id;
  const row = typeId === undefined ? undefined : registry.table<{ id: string; launcher?: { ammo?: string } }>('weapons').byId(typeId);
  return row?.launcher !== undefined && row.launcher.ammo === undefined ? 'wood' : materialClass;
}

export function marginPercent(skill: number, reputation: number): number {
  return Math.max(MARGIN_MIN, MARGIN_BASE - skill * MARGIN_PER_SKILL - reputation / MARGIN_REP_DIVISOR);
}

export function merchantPrice(value: number): number { return value * MERCHANT_MARKUP / 100; }

export function requiredValue(receivedPrice: number, margin: number): number {
  return Math.ceil(receivedPrice * (100 + margin) / 100);
}

export function tradeReputation(receivedPrice: number): number {
  return Math.max(1, Math.min(5, Math.floor(receivedPrice / TRADE_REPUTATION_VALUE)));
}

export function giftReputation(value: number, alreadyGifted: number): number {
  return Math.max(0, Math.min(GIFT_REPUTATION_CAP - alreadyGifted, value / GIFT_REPUTATION_VALUE));
}
