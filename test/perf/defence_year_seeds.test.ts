/**
 * `defence_year` on a set of seeds: whether the hand-laid defence turns the announced raid back
 * (defence_year_seeds.ts). Plays the eight seeds at one cadence (DEFENCE_WATCH_EVERY, the script's 20
 * by default), or those in DEFENCE_SEEDS, and appends each row to `<DEFENCE_SEEDS_OUT>/rows.jsonl`.
 * Over all eight it asserts the set rules at this one cadence; measure.yml's `defence_seeds` suite
 * plays one seed a job at several cadences and judges the pooled rows instead
 * (defence_year_seeds_verdict.test.ts, T-522). Its noise is measured in
 * reports/audits/2026-11-05-t466-defence-repels-a-raid.md and T-522's report.
 */

import { describe, it, expect } from 'vitest';
import { appendFileSync, mkdirSync } from 'node:fs';
import { DEFENCE_KILL_RULE, DEFENCE_SET_RULE, DEFENCE_YEAR_SEEDS, playDefenceSeed, turnedBack } from './defence_year_seeds';

const ONLY = (process.env['DEFENCE_SEEDS'] ?? '').split(',').filter((s) => s !== '');
const SEEDS = ONLY.length > 0 ? ONLY : DEFENCE_YEAR_SEEDS;
const WATCH = Number(process.env['DEFENCE_WATCH_EVERY'] ?? 20);

describe('T-466 defence_year seeds', () => {
  const turned: string[] = [];
  const killed: string[] = [];
  for (const seed of SEEDS) {
    it(`defence_year on ${seed}`, () => {
      const row = playDefenceSeed(seed, WATCH);
      const out = process.env['DEFENCE_SEEDS_OUT'] ?? '.vite/defence-year-seeds';
      mkdirSync(out, { recursive: true });
      appendFileSync(`${out}/rows.jsonl`, JSON.stringify(row) + '\n');
      console.log(`defence_year_seeds: ${JSON.stringify(row)}`);
      if (turnedBack(row)) turned.push(seed);
      if (row.soldierKills > 0) killed.push(seed);
    }, 1_800_000);
  }
  it('turns the announced raid back on most seeds', () => {
    console.log(`defence_year_seeds: raid turned back on ${turned.length} of ${SEEDS.length}: ${turned.join(', ')}`);
    if (ONLY.length === 0) expect(turned.length).toBeGreaterThanOrEqual(DEFENCE_SET_RULE);
  });
  it('a soldier kills a hostile on most seeds', () => {
    console.log(`defence_year_seeds: a soldier killed a hostile on ${killed.length} of ${SEEDS.length}: ${killed.join(', ')}`);
    if (ONLY.length === 0) expect(killed.length).toBeGreaterThanOrEqual(DEFENCE_KILL_RULE);
  });
});
