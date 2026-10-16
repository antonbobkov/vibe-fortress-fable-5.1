/** T-136: deterministic distribution, not a survivor floor on one chaotic browser sample. */
import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { distribution, improvedMeasurements, regressionCheck } from './wildlife_year_measurements';
import { WILDLIFE_TARGET as TARGET, WILDLIFE_MEASURED as MEASURED, WILDLIFE_REFERENCE as REFERENCE } from './wildlife_year_constants';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { playWildlifeYear, WILDLIFE_CASES, type WildlifeYear } from './wildlife_year_fixture';

const rows: WildlifeYear[] = [];
const output = process.env['WILDLIFE_YEAR_OUT'] ?? '.vite/wildlife-year.json';

describe('T-136 wildlife survival over twelve generated years', () => {
  it.each(WILDLIFE_CASES)('$biome / $seed', ({ seed, biome }) => {
    const row = playWildlifeYear(seed, biome);
    rows.push(row);
    mkdirSync(output + '.rows', { recursive: true });
    writeFileSync(output + '.rows/' + seed + '.json', JSON.stringify(row, null, 2) + '\n');
    console.log(`T-136 wildlife year: ${JSON.stringify(row)}`);
    // Kept (T-334): accounting and setup, which no order of jobs moves. A living fortress really
    // reaches the year's end; an extinct one records its last tick.
    if (row.living > 0) expect(row.tick).toBe(DAYS_PER_YEAR * TICKS_PER_DAY);
    expect(row.arrivals - row.deaths.filter((death) => death.kind === 'dwarf').length).toBe(row.living);
    expect(row.setup.surfacePlots).toHaveLength(2);
    expect(row.setup.caveTiles).toBeGreaterThan(0);
    expect(row.setup.buildings).toHaveLength(6);
  }, 600_000);

  afterAll(() => {
    const summary = distribution(rows);
    const check = regressionCheck(REFERENCE, summary, MEASURED);
    const FLOOR = check.floors;
    const byBiome = Object.fromEntries([...new Set(WILDLIFE_CASES.map((row) => row.biome))]
      .map((biome) => [biome, distribution(rows.filter((row) => row.biome === biome))]));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify({ runtimeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), target: TARGET, measured: MEASURED, reference: REFERENCE, floor: FLOOR, regression: check, improved: improvedMeasurements(MEASURED, summary), summary, byBiome, rows }, null, 2) + '\n');
    console.log(`T-136 wildlife distribution: ${JSON.stringify({ summary, byBiome })}`);
    expect(rows).toHaveLength(WILDLIFE_CASES.length);
    // Kept (T-334): the guarded figures of testing-strategy.md § Annual wildlife survival, each with
    // its bound wider than its measured spread. Single seeds are printed, never guarded.
    expect(summary.median, 'measured median; target >= 11').toBeGreaterThanOrEqual(FLOOR.median);
    expect(summary.living, 'sum of the living over the cohort').toBeGreaterThanOrEqual(FLOOR.living);
    expect(summary.wildlifeFree, 'measured share with no wildlife dwarf death').toBeGreaterThanOrEqual(FLOOR.wildlifeFree);
    expect(summary.extinct, 'measured extinctions; target zero').toBeLessThanOrEqual(FLOOR.extinct);
    expect(summary.hungerThirstDeaths, 'measured deaths; target zero').toBeLessThanOrEqual(FLOOR.hungerThirstDeaths);
    expect(check.allowed, `annual regression: ${JSON.stringify(check)}`).toBe(true);
  });
});
