/**
 * Renown and threat schedule calculations.
 * `02-systems/18-threats-monsters-and-raids.md` § Renown, § Schedule, § Schedule peril,
 * `03-content/threat-schedules.md`.
 */

import { DAYS_PER_SEASON, DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import { PERIL_MAX, RENOWN_PERIL_FALL, RENOWN_PERIL_STEP, RENOWN_POP_WEIGHT, RENOWN_WEALTH_DIVISOR } from './constants';

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
  /** The schedule peril whose row the entry reads (§ Schedule peril). */
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

/** The fields one kind takes from its row. */
interface RowFields {
  earliestTick: number;
  intervalMin: number;
  intervalMax: number;
  base: number;
  perRenown: number;
  max: number;
  warningDays: number;
}

const ALL_KINDS = ['thief', 'bandits', 'ambush', 'raid', 'siege'] as const;

/**
 * The row of `kind` at the schedule peril with the trait modifiers applied, or `null` where the
 * kind never comes: `serene_vale` keeps only thieves, at the peril 0 row; `twilight_pass` halves
 * every Gloam interval.
 */
function rowFields(
  rows: readonly ThreatScheduleRow[],
  kind: string,
  schedulePeril: number,
  traits: readonly string[],
): RowFields | null {
  const isSereneVale = traits.includes('serene_vale');
  if (isSereneVale && kind !== 'thief') return null;
  const effectivePeril = isSereneVale ? 0 : schedulePeril;
  const row = rows.find((r) => r.kind === kind && r.peril === effectivePeril);
  if (!row || row.earliest === null) return null;
  let intervalMin = row.intervalDays[0];
  let intervalMax = row.intervalDays[1];
  if (traits.includes('twilight_pass') && kind !== 'bandits') {
    intervalMin = Math.max(1, Math.round(intervalMin * 0.5));
    intervalMax = Math.max(1, Math.round(intervalMax * 0.5));
  }
  return {
    earliestTick: earliestTickFromRow(row.earliest),
    intervalMin,
    intervalMax,
    base: row.base,
    perRenown: row.perRenown,
    max: row.max,
    warningDays: row.warningDays,
  };
}

function disabledEntry(kind: string, peril: number): ThreatScheduleEntry {
  return {
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
  };
}

/** The first roll of a kind: 1 to `min(intervalMin, 20)` days after `from`. */
function firstRoll(from: number, intervalMin: number, rng: RngStream): number {
  return from + rng.int(1, Math.min(intervalMin, 20)) * TICKS_PER_DAY;
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

  for (const kind of ALL_KINDS) {
    const f = rowFields(rows, kind, peril, traits);
    if (f === null) {
      schedule.set(kind, disabledEntry(kind, peril));
      continue;
    }
    schedule.set(kind, { kind, peril, ...f, nextTick: firstRoll(f.earliestTick, f.intervalMin, rng), pendingSpawnTick: 0 });
  }

  return schedule;
}

/**
 * 18 § Schedule peril: how many perils renown lifts the schedule above the region's. A step is
 * gained at each multiple of `RENOWN_PERIL_STEP` and lost only `RENOWN_PERIL_FALL` below it, so a
 * renown that wavers about a threshold does not turn the schedule back and forth. Peril 4 has no
 * row above it, and `serene_vale` (peril fixed at 0) never steps.
 */
export function nextRenownStep(
  peril: number,
  traits: readonly string[],
  renown: number,
  current: number,
): number {
  const cap = maxRenownStep(peril, traits);
  let step = Math.max(0, Math.min(current, cap));
  while (step < cap && renown >= (step + 1) * RENOWN_PERIL_STEP) step += 1;
  while (step > 0 && renown < step * RENOWN_PERIL_STEP - RENOWN_PERIL_FALL) step -= 1;
  return step;
}

/** The most steps renown can lift a region's schedule (§ Schedule peril). */
export function maxRenownStep(peril: number, traits: readonly string[]): number {
  if (traits.includes('serene_vale')) return 0;
  return Math.max(0, PERIL_MAX - peril);
}

/** The renown at which the schedule next steps up, or `null` where it cannot step again. */
export function renownForNextStep(peril: number, traits: readonly string[], step: number): number | null {
  if (step >= maxRenownStep(peril, traits)) return null;
  return (step + 1) * RENOWN_PERIL_STEP;
}

function setFields(e: ThreatScheduleEntry, f: RowFields): void {
  e.intervalMin = f.intervalMin;
  e.intervalMax = f.intervalMax;
  e.base = f.base;
  e.perRenown = f.perRenown;
  e.max = f.max;
  e.warningDays = f.warningDays;
}

/**
 * Sets every entry's interval, size and warning to the schedule peril's rows, leaving its ticks as
 * they are: what a load does before it restores the saved ticks.
 */
export function setScheduleRows(
  schedule: Map<string, ThreatScheduleEntry>,
  registry: Registry,
  schedulePeril: number,
  traits: readonly string[],
): void {
  const rows = registry.derived<readonly ThreatScheduleRow[]>('threatSchedules');
  for (const kind of ALL_KINDS) {
    const e = schedule.get(kind);
    if (!e) continue;
    e.peril = schedulePeril;
    const f = rowFields(rows, kind, schedulePeril, traits);
    if (f !== null) setFields(e, f);
  }
}

/**
 * 18 § Schedule peril: moves the schedule to the rows of `schedulePeril` on the day renown steps.
 * A kind already possible keeps its first date and its next roll; the roll after it uses the new
 * interval. A kind that becomes possible is first possible from the later of its row's `earliest`
 * and today, and its first roll is drawn as at embark; one a fall had stopped keeps a next roll
 * still to come. A kind the new rows do not have stops (`earliestTick` -1) and keeps its next roll
 * for a later rise.
 */
export function applyScheduleStep(
  schedule: Map<string, ThreatScheduleEntry>,
  registry: Registry,
  schedulePeril: number,
  traits: readonly string[],
  tick: number,
  rng: RngStream,
): void {
  const rows = registry.derived<readonly ThreatScheduleRow[]>('threatSchedules');
  const today = Math.floor(tick / TICKS_PER_DAY) * TICKS_PER_DAY;
  for (const kind of ALL_KINDS) {
    const e = schedule.get(kind);
    if (!e) continue;
    e.peril = schedulePeril;
    const f = rowFields(rows, kind, schedulePeril, traits);
    if (f === null) {
      e.earliestTick = -1;
      continue;
    }
    const wasOff = e.earliestTick < 0;
    const wasPossible = !wasOff && e.earliestTick <= tick;
    setFields(e, f);
    if (wasPossible) continue;
    const earliest = Math.max(f.earliestTick, today);
    if (!wasOff && earliest === e.earliestTick) continue;
    const first = firstRoll(earliest, f.intervalMin, rng);
    e.nextTick = wasOff ? Math.max(first, e.nextTick) : first;
    e.earliestTick = earliest;
  }
}
