/**
 * Wound creation and tables: `02-systems/17-health-and-medicine.md` § Wound creation,
 * and `04-implementation/algorithms/combat-and-health.md` § Health tick.
 */

import { C, type Wound } from '@core/components';
import type { ReaderSetLike } from '@core/system';
import type { EntityId, Fixed, Severity, Tick, WoundType } from '@core/types';
import type { JobsReader } from '@systems/jobs';
import { RESERVE_KEEP_TICKS } from '@systems/jobs/constants';
import { FRACTURE_PERCENT, HEAL_BASE_TICKS, LIGHT_MAX, SERIOUS_MAX } from './constants';

/** A pending infection cure needs rest, not another cleaning. */
export function needsCleaning(wound: Wound): boolean {
  return wound.infected ? wound.curedAt === undefined : !wound.cleaned;
}

/** Wound-driven care is independent of whether a dwarf is still admitted. */
export function woundTreatmentNeeds(wounds: readonly Wound[]): string[] {
  const needs: string[] = [];
  if (wounds.some(w => w.bleed > 0 && !w.bandaged)) needs.push('stop_bleeding');
  if (wounds.some(w => w.type === 'fracture' && !w.splinted)) needs.push('set_bone');
  if (wounds.some(w => (w.type === 'cut' || w.type === 'puncture') &&
      (w.severity === 'serious' || w.severity === 'grievous') && !w.sutured)) needs.push('suture');
  if (wounds.some(needsCleaning)) needs.push('clean_wound');
  if (wounds.some(w => w.type === 'burn' && !w.dressed)) needs.push('dress_burn');
  return needs;
}

/**
 * A bleeding patient is bandaged where it lies (§ Patients and hospitals): while a wound made less
 * than `RESERVE_KEEP_TICKS` ago bleeds without a bandage, another dwarf has the medicine labor and
 * the patient's `stop_bleeding` job is not blocked (no cloth, no medic who can reach it), a conscious
 * patient does not walk to its bed and an unconscious one is not carried.
 */
export function awaitsBandage(readers: ReaderSetLike, id: EntityId, tick: Tick): boolean {
  const body = readers.entities.get(id, C.Body);
  if (body === undefined || !body.parts.some(p => p.wounds.some(w =>
    w.bleed > 0 && !w.bandaged && tick - w.createdTick < RESERVE_KEEP_TICKS))) return false;
  if (!readers.has('11')) return false;
  const jobs = readers.of<JobsReader>('11');
  return jobs.byKey(`stop_bleeding:${id}`)?.state !== 'blocked' && jobs.workersWithLabor('medicine').some(w => w !== id);
}

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
