/**
 * Renown and threat schedule calculations.
 * `02-systems/18-threats-monsters-and-raids.md` § Renown, § Schedule,
 * `03-content/threat-schedules.md`.
 */

import { DAYS_PER_SEASON, DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import { RENOWN_POP_WEIGHT, RENOWN_WEALTH_DIVISOR } from './constants';

export interface ThreatScheduleRow {
  kind: string;
  peril: number;
  earliest: { year: number; season: number; day?: number } | null;
  intervalDays: [number, number];
  base: number;
  perRenown: number;
  max: number;
  warningDays: number;
  extra?: Record<string, unknown>;
}

export interface ThreatScheduleEntry {
  kind: string;
  peril: number;
  earliestTick: number; // -1 if disabled
  nextTick: number;
  intervalMin: number;
  intervalMax: number;
  base: number;
  perRenown: number;
  max: number;
  warningDays: number;
  pendingSpawnTick: number;
}

/**
 * Calculates fortress renown score:
 * `renown = wealth / RENOWN_WEALTH_DIVISOR + population × RENOWN_POP_WEIGHT`
 */
export function calculateRenown(wealth: number, population: number): number {
  return wealth / RENOWN_WEALTH_DIVISOR + population * RENOWN_POP_WEIGHT;
}

/**
 * Converts a content earliest-date object to a tick timestamp.
 */
export function earliestTickFromRow(
  earliest: { year: number; season: number; day?: number } | null,
): number {
  if (earliest === null) return -1;
  const day = earliest.day ?? 1;
  const dayIndex = (earliest.year - 1) * DAYS_PER_YEAR + earliest.season * DAYS_PER_SEASON + (day - 1);
  return dayIndex * TICKS_PER_DAY;
}

/**
 * Calculates party size:
 * `size = min(max, base + renown × perRenown)` rounded.
 * `perRenownFixed` is stored in content multiplied by 1000.
 */
export function calculatePartySize(
  base: number,
  perRenownFixed: number,
  max: number,
  renown: number,
): number {
  const calculated = Math.round(base + (renown * perRenownFixed) / 1000);
  return Math.max(1, Math.min(max, calculated));
}

/**
 * Initializes threat schedule entries at embark or world setup.
 */
export function initScheduleAtEmbark(
  registry: Registry,
  peril: number,
  traits: readonly string[],
  rng: RngStream,
): Map<string, ThreatScheduleEntry> {
  const schedule = new Map<string, ThreatScheduleEntry>();
  const rows = registry.derived<readonly ThreatScheduleRow[]>('threatSchedules');
  const allKinds = ['thief', 'bandits', 'ambush', 'raid', 'siege'] as const;

  const isSereneVale = traits.includes('serene_vale');
  const isTwilightPass = traits.includes('twilight_pass');

  for (const kind of allKinds) {
    // `serene_vale` disables everything but thieves
    if (isSereneVale && kind !== 'thief') {
      schedule.set(kind, {
        kind,
        peril,
        earliestTick: -1,
        nextTick: -1,
        intervalMin: 0,
        intervalMax: 0,
        base: 0,
        perRenown: 0,
        max: 0,
        warningDays: 0,
        pendingSpawnTick: 0,
      });
      continue;
    }

    // Find row in threatSchedules table for (kind, effectivePeril)
    const effectivePeril = isSereneVale ? 0 : peril;
    const row = rows.find((r) => r.kind === kind && r.peril === effectivePeril);

    if (!row || row.earliest === null) {
      schedule.set(kind, {
        kind,
        peril,
        earliestTick: -1,
        nextTick: -1,
        intervalMin: 0,
        intervalMax: 0,
        base: 0,
        perRenown: 0,
        max: 0,
        warningDays: 0,
        pendingSpawnTick: 0,
      });
      continue;
    }

    let intervalMin = row.intervalDays[0];
    let intervalMax = row.intervalDays[1];

    // `twilight_pass`: all Gloam intervals × 0.5
    if (isTwilightPass && kind !== 'bandits') {
      intervalMin = Math.max(1, Math.round(intervalMin * 0.5));
      intervalMax = Math.max(1, Math.round(intervalMax * 0.5));
    }

    const earliestTick = earliestTickFromRow(row.earliest);
    const firstOffsetDays = rng.int(1, Math.min(intervalMin, 20));
    const nextTick = earliestTick + firstOffsetDays * TICKS_PER_DAY;

    schedule.set(kind, {
      kind,
      peril,
      earliestTick,
      nextTick,
      intervalMin,
      intervalMax,
      base: row.base,
      perRenown: row.perRenown,
      max: row.max,
      warningDays: row.warningDays,
      pendingSpawnTick: 0,
    });
  }

  return schedule;
}
