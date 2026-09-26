/**
 * Wound creation and tables: `02-systems/17-health-and-medicine.md` § Wound creation,
 * and `04-implementation/algorithms/combat-and-health.md` § Health tick.
 */

import type { Wound } from '@core/components';
import type { Fixed, Severity, Tick, WoundType } from '@core/types';
import { FRACTURE_PERCENT, HEAL_BASE_TICKS, LIGHT_MAX, SERIOUS_MAX } from './constants';

export const BLEED_TABLE: Readonly<Record<WoundType, Readonly<Record<Severity, Fixed>>>> = {
  cut: { light: 1, serious: 3, grievous: 6 },
  puncture: { light: 2, serious: 4, grievous: 8 },
  bruise: { light: 0, serious: 0, grievous: 0 },
  fracture: { light: 0, serious: 1, grievous: 2 },
  burn: { light: 0, serious: 1, grievous: 3 },
  frost: { light: 0, serious: 0, grievous: 1 },
  wasting: { light: 0, serious: 0, grievous: 0 },
};

export const PAIN_TABLE: Readonly<Record<WoundType, Readonly<Record<Severity, number>>>> = {
  cut: { light: 5, serious: 15, grievous: 30 },
  puncture: { light: 4, serious: 12, grievous: 25 },
  bruise: { light: 4, serious: 10, grievous: 20 },
  fracture: { light: 15, serious: 30, grievous: 45 },
  burn: { light: 8, serious: 20, grievous: 40 },
  frost: { light: 5, serious: 12, grievous: 25 },
  wasting: { light: 5, serious: 10, grievous: 15 },
};

export const SEVERITY_MULTIPLIER: Readonly<Record<Severity, number>> = {
  light: 1,
  serious: 3,
  grievous: 6,
};

/**
 * Determine wound severity from damage amount and maximum hp of the part.
 * `ratio = amount / maxHp`. `light` if `< LIGHT_MAX` (0.2), `serious` if `< SERIOUS_MAX` (0.5), else `grievous`.
 */
export function severityFor(amount: number, maxHp: number): Severity {
  if (maxHp <= 0) return 'grievous';
  const ratio = amount / maxHp;
  if (ratio < LIGHT_MAX) return 'light';
  if (ratio < SERIOUS_MAX) return 'serious';
  return 'grievous';
}

/**
 * Map damage type string to a WoundType.
 * edge -> cut, pierce -> puncture, blunt -> (amount >= maxHp * 30% ? fracture : bruise).
 * If already a recognized WoundType, return it.
 */
export function woundTypeFor(damageType: string, amount: number, maxHp: number): WoundType {
  if (damageType === 'edge') return 'cut';
  if (damageType === 'pierce') return 'puncture';
  if (damageType === 'blunt') {
    return amount >= (maxHp * FRACTURE_PERCENT) / 100 ? 'fracture' : 'bruise';
  }
  if (
    damageType === 'cut' ||
    damageType === 'puncture' ||
    damageType === 'bruise' ||
    damageType === 'fracture' ||
    damageType === 'burn' ||
    damageType === 'frost' ||
    damageType === 'wasting'
  ) {
    return damageType;
  }
  return 'bruise';
}

/**
 * Construct a new Wound object.
 */
export function createWound(
  type: WoundType,
  severity: Severity,
  damage: number,
  createdTick: Tick,
): Wound {
  return {
    type,
    severity,
    bleed: BLEED_TABLE[type][severity],
    pain: PAIN_TABLE[type][severity],
    healRemaining: HEAL_BASE_TICKS * SEVERITY_MULTIPLIER[severity],
    damage,
    bandaged: false,
    sutured: false,
    splinted: false,
    cleaned: false,
    dressed: false,
    infected: false,
    infectedSince: 0,
    createdTick,
  };
}
