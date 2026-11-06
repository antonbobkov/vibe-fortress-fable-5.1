/** T-136: deterministic distribution, not a survivor floor on one chaotic browser sample. */
import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { distribution } from './wildlife_year_measurements';
import { WILDLIFE_TARGET as TARGET } from './wildlife_year_constants';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { playWildlifeYear, WILDLIFE_CASES, type WildlifeYear } from './wildlife_year_fixture';

const rows: WildlifeYear[] = [];
const output = process.env['WILDLIFE_YEAR_OUT'] ?? '.vite/wildlife-year.json';
/**
 * T-509: the ticks played before the opening; measure.yml runs one job per shift, and
 * `wildlife_year_verdict.test.ts` judges the pooled samples. One sample is not judged.
 */
const shift = Number(process.env['WILDLIFE_YEAR_SHIFT'] ?? '0');

describe('T-136 wildlife survival over twelve generated years', () => {
  it.each(WILDLIFE_CASES)('$biome / $seed', ({ seed, biome }) => {
    const row = playWildlifeYear(seed, biome, { shift });
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
    const byBiome = Object.fromEntries([...new Set(WILDLIFE_CASES.map((row) => row.biome))]
      .map((biome) => [biome, distribution(rows.filter((row) => row.biome === biome))]));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify({ shift, runtimeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), target: TARGET, summary, byBiome, rows }, null, 2) + '\n');
    console.log(`T-136 wildlife distribution: ${JSON.stringify({ summary, byBiome })}`);
    // The guarded figures are judged over the pooled samples (wildlife_year_verdict.test.ts).
    expect(rows).toHaveLength(WILDLIFE_CASES.length);
  });
});
