/**
 * T-509: the annual instrument's verdict over its pooled samples. measure.yml's `instrument` suite
 * plays shifts 0 to N-1 in parallel and runs this file over their result files; locally, run
 * `wildlife_year.test.ts` once per shift (`WILDLIFE_YEAR_SHIFT`, `WILDLIFE_YEAR_OUT`) into one folder
 * and point `WILDLIFE_SAMPLES` at it. With no samples the file skips.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { improvedMeasurements, pool, regressionCheck, type Sample, type WildlifeFigures } from './wildlife_year_measurements';
import { WILDLIFE_MEASURED as MEASURED, WILDLIFE_REFERENCE as REFERENCE, WILDLIFE_SAMPLES, WILDLIFE_TOLERANCE } from './wildlife_year_constants';

interface SampleFile { shift: number; runtimeCommit: string; summary: Sample; rows: { seed: string; living: number }[] }

const dir = process.env['WILDLIFE_SAMPLES'] ?? '.vite/wildlife-samples';
const names = existsSync(dir) ? readdirSync(dir).filter((name) => /^wildlife-year-shift-\d+\.json$/.test(name)) : [];
const files: SampleFile[] = names.map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as SampleFile)
  .sort((a, b) => a.shift - b.shift);

const row = (f: Pick<WildlifeFigures, 'median' | 'worst' | 'secondWorst' | 'living' | 'wildlifeFree' | 'extinct' | 'starvedYears' | 'hungerThirstDeaths'>): string =>
  [f.median, f.worst, f.secondWorst, f.living, f.wildlifeFree, f.extinct, f.starvedYears, f.hungerThirstDeaths].join(' | ');

describe.skipIf(files.length === 0)('T-509 the annual instrument judged over its pooled samples', () => {
  it(`pools shifts 0 to ${WILDLIFE_SAMPLES - 1} of one commit and keeps the guarded bounds`, () => {
    const pooled = pool(files.map((f) => f.summary));
    const check = regressionCheck(REFERENCE, pooled, MEASURED);
    const lines = [
      `## Annual instrument: ${files.length} samples of ${[...new Set(files.map((f) => f.runtimeCommit.slice(0, 8)))].join(', ')}`,
      '',
      '| Shift | Median | Worst | Second-worst | Sum of the living | Wildlife-free | Extinct | Starved years | Need deaths | Living by seed |',
      '|---|---|---|---|---|---|---|---|---|---|',
      ...files.map((f) => `| ${f.shift} | ${row(f.summary)} | ${f.rows.map((r) => r.living).join(', ')} |`),
      `| **Pooled** | ${row(pooled)} | |`,
      `| Reference | ${row(REFERENCE)} | |`,
      `| Bounds | ≥ ${check.floors.median} | | | ≥ ${check.floors.living} | ≥ ${check.floors.wildlifeFree} | ≤ ${check.floors.extinct} | ≤ ${check.floors.starvedYears} | | |`,
      '',
      `Median, worst, second-worst, sum and wildlife-free are means over the samples; extinct, starved years and need deaths are counted over all of them. Tolerances: ${JSON.stringify(WILDLIFE_TOLERANCE)}.`,
      '',
      `**Verdict: ${check.allowed ? 'pass' : 'blocked'}.** Bounds exceeded: ${check.exceeded.join(', ') || 'none'}. Worsened together (by more than half a tolerance against the reference): ${check.worsened.join(', ') || 'none'}.`,
      '',
      `If accepted: \`WILDLIFE_REFERENCE\` = \`${JSON.stringify({ ...pooled, samples: undefined })}\`; \`WILDLIFE_MEASURED\` = \`${JSON.stringify(improvedMeasurements(MEASURED, pooled))}\`.`,
      '',
    ];
    writeFileSync(join(dir, 'verdict.md'), lines.join('\n'));
    writeFileSync(join(dir, 'verdict.json'), JSON.stringify({ pooled, reference: REFERENCE, measured: MEASURED, check, improved: improvedMeasurements(MEASURED, pooled),
      samples: files.map((f) => ({ shift: f.shift, runtimeCommit: f.runtimeCommit, summary: f.summary, living: f.rows.map((r) => r.living) })) }, null, 2) + '\n');
    console.log(lines.join('\n'));
    // The samples are one commit's, shifted 0 to N-1, so two verdicts compare like with like.
    expect(new Set(files.map((f) => f.runtimeCommit)).size, 'one commit').toBe(1);
    expect(files.map((f) => f.shift), 'the shifts').toEqual([...Array(WILDLIFE_SAMPLES).keys()]);
    expect(check.allowed, `annual regression: ${JSON.stringify(check)}`).toBe(true);
  });
});
