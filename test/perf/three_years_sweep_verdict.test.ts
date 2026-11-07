/**
 * T-513: the twenty-seed sweep's verdict over its pooled shifted sweeps. measure.yml's `sweep` suite
 * plays every seed at shifts 0, 50, 100 and 150 in parallel and runs this file over their result files; locally,
 * run `three_years_seeds.test.ts` once per shift (`THREE_YEARS_SHIFT`, with `THREE_YEARS_SEEDS_OUT`
 * set to `<dir>/shift-<n>`) and point `THREE_YEARS_SWEEP_SAMPLES` at `<dir>`. With no samples the file skips.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  improvedSweep, poolSweeps, sweepCheck, sweepFigures, SWEEP_MEASURED as MEASURED, SWEEP_REFERENCE as REFERENCE,
  SWEEP_SEEDS, SWEEP_SHIFTS, SWEEP_TOLERANCE, type SweepFigures, type SweepSeedRow,
} from './three_years_sweep';

interface SeedFile {
  shift?: number;
  runtimeCommit?: string;
  needDeaths?: number;
  result: { seed: string; peril: number; y1Pop: number; y3Pop: number; dwarfDeaths: number; extinctDay: number | null };
}
interface Sample { shift: number; commits: string[]; rows: SweepSeedRow[]; figures: SweepFigures }

const dir = process.env['THREE_YEARS_SWEEP_SAMPLES'] ?? '.vite/three-years-sweep';
const shiftDirs = existsSync(dir) ? readdirSync(dir).filter((name) => /^shift-\d+$/.test(name)) : [];
const samples: Sample[] = shiftDirs.map((name) => {
  const files = readdirSync(join(dir, name)).filter((f) => /^three-years-p\d-\d+\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, name, f), 'utf8')) as SeedFile);
  const rows = files.map(({ result, needDeaths }) => ({
    seed: result.seed, peril: result.peril, y1: result.y1Pop, y3: result.y3Pop, deaths: result.dwarfDeaths,
    needDeaths: needDeaths ?? 0, extinctDay: result.extinctDay ?? null,
  })).sort((a, b) => a.seed.localeCompare(b.seed, 'en', { numeric: true }));
  return { shift: Number(name.slice('shift-'.length)), commits: [...new Set(files.map((f) => f.runtimeCommit ?? '?'))], rows, figures: sweepFigures(rows) };
}).sort((a, b) => a.shift - b.shift);

const row = (f: SweepFigures): string => [f.alive, f.grown, f.hungry, f.living, f.deaths, f.extinct, f.needDeaths].join(' | ');

describe.skipIf(samples.length === 0)('T-513 the twenty-seed sweep judged over its pooled shifted sweeps', () => {
  it(`pools shifts ${SWEEP_SHIFTS.join(', ')} of one commit and keeps the set rule and the guarded bounds`, () => {
    const pooled = poolSweeps(samples.map((s) => s.figures));
    const check = sweepCheck(pooled);
    const commits = [...new Set(samples.flatMap((s) => s.commits))];
    const incomplete = samples.filter((s) => s.rows.length !== SWEEP_SEEDS).map((s) => `shift ${s.shift}: ${s.rows.length} of ${SWEEP_SEEDS}`);
    const judged = commits.length === 1 && incomplete.length === 0
      && samples.map((s) => s.shift).join() === SWEEP_SHIFTS.join();
    const seeds = [...new Set(samples.flatMap((s) => s.rows.map((r) => r.seed)))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const cell = (seed: string, f: (r: SweepSeedRow) => string): string => samples.map((s) => {
      const r = s.rows.find((x) => x.seed === seed);
      return r ? f(r) : '–';
    }).join(', ');
    const extinct = (seed: string): string => samples.flatMap((s) => s.rows.filter((r) => r.seed === seed && r.extinctDay !== null)
      .map((r) => `${s.shift}: ${r.extinctDay}`)).join('; ');
    const lines = [
      `## Twenty-seed sweep: ${samples.length} sweeps of ${commits.map((c) => c.slice(0, 8)).join(', ')}`,
      '',
      '| Shift | Alive at year 1 | Peril-0 grown | Peril-0 with need deaths | Living at year 3 | Dwarf deaths | Extinct | Need deaths |',
      '|---|---|---|---|---|---|---|---|',
      ...samples.map((s) => `| ${s.shift} | ${row(s.figures)} |`),
      `| **Pooled** | ${row(pooled)} |`,
      `| Reference | ${row(REFERENCE)} |`,
      `| Bounds | ≥ ${check.bounds.alive} | ≥ ${check.bounds.grown} | ≤ ${check.bounds.hungry} | ≥ ${check.bounds.living} | ≤ ${check.bounds.deaths} | | |`,
      '',
      `Pooled figures are means over the sweeps. Alive, grown and need-death fortresses are bounded by the set rule; living and deaths by the best accepted pooled figures and tolerances ${JSON.stringify(SWEEP_TOLERANCE)}.`,
      '',
      `**Verdict: ${!judged ? `not judged (a verdict pools shifts ${SWEEP_SHIFTS.join(', ')} of one commit, all ${SWEEP_SEEDS} seeds each${incomplete.length ? `; missing: ${incomplete.join('; ')}` : ''})` : check.allowed ? 'pass' : 'blocked'}.** Bounds exceeded: ${check.exceeded.join(', ') || 'none'}.`,
      '',
      `If accepted: \`SWEEP_REFERENCE\` = \`${JSON.stringify(pooled)}\`; \`SWEEP_MEASURED\` = \`${JSON.stringify(improvedSweep(MEASURED, pooled))}\`.`,
      '',
      '| Seed | Year 1 by shift | Year 3 by shift | Deaths by shift | Need deaths by shift | Extinct (shift: day) |',
      '|---|---|---|---|---|---|',
      ...seeds.map((seed) => `| ${seed} | ${cell(seed, (r) => String(r.y1))} | ${cell(seed, (r) => String(r.y3))} | ${cell(seed, (r) => String(r.deaths))} | ${cell(seed, (r) => String(r.needDeaths))} | ${extinct(seed)} |`),
      '',
    ];
    writeFileSync(join(dir, 'verdict.md'), lines.join('\n'));
    writeFileSync(join(dir, 'verdict.json'), JSON.stringify({ pooled, reference: REFERENCE, measured: MEASURED, check, improved: improvedSweep(MEASURED, pooled),
      samples: samples.map((s) => ({ shift: s.shift, commits: s.commits, figures: s.figures, rows: s.rows })) }, null, 2) + '\n');
    console.log(lines.join('\n'));
    // The sweeps are one commit's, shifted 0 to N-1, every seed in each, so two verdicts compare like with like.
    expect(commits, 'one commit').toHaveLength(1);
    expect(incomplete, 'sweeps without every seed').toEqual([]);
    expect(samples.map((s) => s.shift), 'the shifts').toEqual(SWEEP_SHIFTS);
    expect(check.allowed, `sweep regression: ${JSON.stringify(check)}`).toBe(true);
  });
});
