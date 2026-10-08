/**
 * Assignment arithmetic: `02-systems/11-jobs-and-labor.md` § Assignment and
 * `algorithms/jobs-and-hauling.md` § Assignment. Pure functions, so the scoring formula is tested
 * on constructed cases.
 *
 * Candidates are sorted "by `(priority + laborPriorityShift)`, then by estimated distance …, then
 * by the worker's skill descending" and the first `CANDIDATE_LIMIT` are scored (the 11 wording;
 * docs/02-systems/11-jobs-and-labor.md § Assignment).
 */

import { PRIORITY_DEFAULT } from '@core/constants';
import { CANDIDATE_LIMIT, Z_DISTANCE_WEIGHT } from './constants';

/** A tile's coordinates, as the map unpacks it. */
export interface Xyz {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** `estDistance = max(|dx|,|dy|) + |dz| * Z_DISTANCE_WEIGHT`. */
export function estDistance(a: Xyz, b: Xyz): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) + Math.abs(a.z - b.z) * Z_DISTANCE_WEIGHT;
}

/**
 * `effPriority(job) = job.priority + laborPriority[job.type.labor] - PRIORITY_DEFAULT`
 * (`laborPriorityShift = laborPriority − PRIORITY_DEFAULT`).
 */
export function effectivePriority(jobPriority: number, laborPriority: number): number {
  return jobPriority + laborPriority - PRIORITY_DEFAULT;
}

/**
 * `score = effectivePriority × 1000 + distance × 10 − skillLevel × 15 − (worker is the workshop's
 * assigned worker ? 500 : 0)`; the minimum wins.
 */
export function score(effPriority: number, distance: number, skillLevel: number, workshopWorker: boolean): number {
  return effPriority * 1000 + distance * 10 - skillLevel * 15 - (workshopWorker ? 500 : 0);
}

export interface Candidate {
  readonly jobId: number;
  readonly eff: number;
  readonly distance: number;
  readonly skill: number;
  readonly workshopWorker: boolean;
}

/**
 * Steps 2 and 3: sort, keep the first `CANDIDATE_LIMIT`, and choose the minimum score, ties by job
 * id. Returns the chosen job id, or 0.
 */
export function choose(candidates: readonly Candidate[], limit: number = CANDIDATE_LIMIT): number {
  if (candidates.length === 0) return 0;
  const sorted = candidates
    .slice()
    .sort((a, b) => a.eff - b.eff || a.distance - b.distance || b.skill - a.skill || a.jobId - b.jobId)
    .slice(0, limit);
  let best = sorted[0] as Candidate;
  let bestScore = score(best.eff, best.distance, best.skill, best.workshopWorker);
  for (let k = 1; k < sorted.length; k += 1) {
    const c = sorted[k] as Candidate;
    const s = score(c.eff, c.distance, c.skill, c.workshopWorker);
    if (s < bestScore || (s === bestScore && c.jobId < best.jobId)) {
      best = c;
      bestScore = s;
    }
  }
  return best.jobId;
}

/**
 * The work done per tick, in hundredths of a tick times percent (D-055): `(100 +
 * SKILL_TIME_BONUS_PERCENT × skill) × productivity`. A job of `baseTicks` needs `baseTicks × 100 ×
 * 100` of it, which is `workRate` of `11` § Job steps without its per-tick rounding.
 */
export function effortPerTick(skillBonusPercent: number, skill: number, productivityPercent: number): number {
  return (100 + skillBonusPercent * skill) * productivityPercent;
}

/** The effort a job of `centiTicks` hundredths of a tick needs. */
export function effortRequired(centiTicks: number): number {
  return centiTicks * 100;
}

/** `progress` (0 … 1000) from the effort done. */
export function progressOf(effort: number, required: number): number {
  if (required <= 0) return 1000;
  return Math.min(1000, Math.floor((effort * 1000) / required));
}
