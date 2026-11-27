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
  SWEEP_SEEDS, SWEEP_SHIFTS, SWEEP_TOLERANCE, SWEEP_TRACE, sweepTrace, type SweepFigures, type SweepSeedRow,
} from './three_years_sweep';

interface SeedFile {
  shift?: number;
  runtimeCommit?: string;
  needDeaths?: number;
  invariants?: string[];
  result: { seed: string; peril: number; y1Pop: number; y3Pop: number; dwarfDeaths: number; extinctDay: number | null; squad?: SquadFile; crafts?: CraftsFile };
}
/** T-803: the best craft skills among the living at year 3, the masterworks, and the stone and items lying about (three_years_seeds.test.ts). */
interface CraftsFile { crafting: number; masonry: number; carpentry: number; engraving: number; masterworks: number; firstMasterworkDay: number | null; rawStone: number; items: number }
/** T-601: the strongest squad a fortress fielded and how its sprung ambushes were answered (three_years_seeds.test.ts). */
interface SquadFile {
  best: { day: number; inMetal: number; metals: string[]; skills: number[]; steel: number; marks: number; bar: string } | null;
  answers: Record<string, number>;
  /** T-603: the first day each bar was cleared, and each answer's toll. */
  barDays?: Record<string, number>;
  toll?: Record<string, { ambushes: number; deaths: number; soldiers: number; fell: number }>;
}
interface Sample { shift: number; commits: string[]; rows: SweepSeedRow[]; figures: SweepFigures; invariants: string[]; squads: Map<string, SquadFile>; crafts: CraftsFile[] }

const dir = process.env['THREE_YEARS_SWEEP_SAMPLES'] ?? '.vite/three-years-sweep';
const shiftDirs = existsSync(dir) ? readdirSync(dir).filter((name) => /^shift-\d+$/.test(name)) : [];
const samples: Sample[] = shiftDirs.map((name) => {
  const files = readdirSync(join(dir, name)).filter((f) => /^three-years-p\d-\d+\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, name, f), 'utf8')) as SeedFile);
  const rows = files.map(({ result, needDeaths }) => ({
    seed: result.seed, peril: result.peril, y1: result.y1Pop, y3: result.y3Pop, deaths: result.dwarfDeaths,
    needDeaths: needDeaths ?? 0, extinctDay: result.extinctDay ?? null,
  })).sort((a, b) => a.seed.localeCompare(b.seed, 'en', { numeric: true }));
  const invariants = files.flatMap((f) => (f.invariants ?? []).map((text) => `${f.result.seed}: ${text}`));
  const squads = new Map(files.filter((f) => f.result.squad !== undefined).map((f) => [f.result.seed, f.result.squad!] as const));
  const crafts = files.filter((f) => f.result.crafts !== undefined && f.result.y3Pop > 0).map((f) => f.result.crafts!);
  return { shift: Number(name.slice('shift-'.length)), commits: [...new Set(files.map((f) => f.runtimeCommit ?? '?'))], rows, figures: sweepFigures(rows), invariants, squads, crafts };
}).sort((a, b) => a.shift - b.shift);

/**
 * T-601: the squad against ambushes, pooled over the sweeps: how many fortress-timelines cleared each
 * ambush bar, how their sprung ambushes were answered, and the strongest squads they fielded.
 */
function squadLines(samples: readonly Sample[]): string[] {
  const all = samples.flatMap((s) => [...s.squads.values()]);
  if (all.length === 0) return [];
  // T-603: by peril, the fortress-timelines that cleared each bar and the days they first did; the ambushes' toll by answer.
  const perilOf = (seed: string): number => Number(/-p(\d)-/.exec(seed)?.[1] ?? -1);
  const reach = [2, 4].map((peril) => {
    const fortresses = samples.flatMap((s) => [...s.squads.entries()].filter(([seed]) => perilOf(seed) === peril).map(([, q]) => q));
    const days = (bar: string): number[] => fortresses.map((q) => q.barDays?.[bar]).filter((d): d is number => d !== undefined).sort((a, b) => a - b);
    const span = (d: number[]): string => (d.length ? `${d.length} (day ${d[Math.floor(d.length / 2)]} median, ${d[0]} to ${d[d.length - 1]})` : '0');
    return `peril ${peril}, ${fortresses.length} fortress-timelines: the soldiers' bar ${span(days('soldiers alone'))}, the full squad's ${span(days('full squad'))}`;
  });
  const toll: Record<string, { ambushes: number; deaths: number; soldiers: number; fell: number }> = {};
  for (const q of all) for (const [k, v] of Object.entries(q.toll ?? {})) {
    const t = (toll[k] ??= { ambushes: 0, deaths: 0, soldiers: 0, fell: 0 });
    t.ambushes += v.ambushes; t.deaths += v.deaths; t.soldiers += v.soldiers; t.fell += v.fell;
  }
  const tollLine = Object.entries(toll).map(([k, t]) => `${k}: ${t.ambushes} ambushes, ${t.deaths} dwarves dead (${t.soldiers} of the squad), ${t.fell} of the ambush felled`).join('; ') || 'none';
  const bars = (bar: string): number => all.filter((q) => q.best?.bar === bar).length;
  const answers: Record<string, number> = {};
  for (const q of all) for (const [k, n] of Object.entries(q.answers)) answers[k] = (answers[k] ?? 0) + n;
  const inMetal: Record<number, number> = {};
  for (const q of all) inMetal[q.best?.inMetal ?? 0] = (inMetal[q.best?.inMetal ?? 0] ?? 0) + 1;
  const metals: Record<string, number> = {};
  for (const q of all) for (const m of q.best?.metals ?? []) metals[m] = (metals[m] ?? 0) + 1;
  const skills = all.flatMap((q) => q.best?.skills ?? []).sort((a, b) => a - b);
  const steel = Math.max(0, ...all.map((q) => q.best?.steel ?? 0));
  const marks = Math.max(0, ...all.map((q) => q.best?.marks ?? 0));
  const list = (r: Record<string | number, number>): string => Object.entries(r).map(([k, n]) => `${k}: ${n}`).join(', ') || 'none';
  return [
    `**Squad against ambushes (T-601)**, over ${all.length} fortress-timelines: cleared the full squad's bar ${bars('full squad')}, the soldiers' bar ${bars('soldiers alone')}; most soldiers in steel at Proficient in one fortress ${steel}, marksdwarves ${marks}.`,
    `Sprung ambushes by the script's first answer: ${list(answers)}.`,
    `Bars cleared (T-603), by peril: ${reach.join('; ')}.`,
    `Ambushes ended, by first answer, and their toll from the spring until the party was gone: ${tollLine}.`,
    `Strongest squad by day 336, members armed in metal (fortress-timelines): ${list(inMetal)}; their body armour's metal (soldiers): ${list(metals)}; their weapon skill: ${skills.length ? `median ${skills[Math.floor(skills.length / 2)]}, best ${skills[skills.length - 1]}` : 'none'}.`,
    '',
  ];
}

/** T-803: the craft skills at year 3 and the masterworks, pooled over the living fortress-timelines. */
function craftLines(samples: readonly Sample[]): string[] {
  const all = samples.flatMap((s) => s.crafts);
  if (all.length === 0) return [];
  const spread = (k: 'crafting' | 'masonry' | 'carpentry' | 'engraving' | 'rawStone' | 'items'): string => {
    const v = all.map((c) => c[k]).sort((a, b) => a - b);
    return `median ${v[Math.floor(v.length / 2)]}, ${v[0]} to ${v[v.length - 1]}`;
  };
  const days = all.map((c) => c.firstMasterworkDay).filter((d): d is number => d !== null).sort((a, b) => a - b);
  return [
    `**Crafts at year 3 (T-803)**, over ${all.length} living fortress-timelines: best crafting ${spread('crafting')}; masonry ${spread('masonry')}; carpentry ${spread('carpentry')}; engraving ${spread('engraving')}.`,
    `Masterworks: ${all.reduce((n, c) => n + c.masterworks, 0)} in all; fortress-timelines with one ${days.length}${days.length ? ` (first on day ${days[Math.floor(days.length / 2)]} median, ${days[0]} to ${days[days.length - 1]})` : ''}. Raw stone to be had: ${spread('rawStone')}; items: ${spread('items')}.`,
    '',
  ];
}

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
    const squadCell = (seed: string): string => samples.map((s) => {
      const best = s.squads.get(seed)?.best;
      return best ? `${best.inMetal} ${best.metals[0] ?? ''} ${best.skills[0] ?? ''}`.replace(/\s+/g, ' ').trim() : '–';
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
      `Worth tracing by seed (further from the best figures than ${JSON.stringify(SWEEP_TRACE)}, about twice the noise): ${sweepTrace(pooled).join('; ') || 'none'}.`,
      '',
      `If accepted: \`SWEEP_REFERENCE\` = \`${JSON.stringify(pooled)}\`; \`SWEEP_MEASURED\` = \`${JSON.stringify(improvedSweep(MEASURED, pooled))}\`.`,
      '',
      '| Seed | Year 1 by shift | Year 3 by shift | Deaths by shift | Need deaths by shift | Extinct (shift: day) | Strongest squad by shift (in metal, best skill) |',
      '|---|---|---|---|---|---|---|',
      ...seeds.map((seed) => `| ${seed} | ${cell(seed, (r) => String(r.y1))} | ${cell(seed, (r) => String(r.y3))} | ${cell(seed, (r) => String(r.deaths))} | ${cell(seed, (r) => String(r.needDeaths))} | ${extinct(seed)} | ${squadCell(seed)} |`),
      '',
      `Invariant findings (each fails its seed's job, not the verdict): ${samples.flatMap((s) => s.invariants.map((text) => `shift ${s.shift}, ${text}`)).join('; ') || 'none'}.`,
      '',
      ...squadLines(samples),
      ...craftLines(samples),
    ];
    writeFileSync(join(dir, 'verdict.md'), lines.join('\n'));
    writeFileSync(join(dir, 'verdict.json'), JSON.stringify({ pooled, reference: REFERENCE, measured: MEASURED, check, improved: improvedSweep(MEASURED, pooled),
      samples: samples.map((s) => ({ shift: s.shift, commits: s.commits, figures: s.figures, rows: s.rows, invariants: s.invariants, squads: Object.fromEntries(s.squads) })) }, null, 2) + '\n');
    console.log(lines.join('\n'));
    // The sweeps are one commit's, shifted 0 to N-1, every seed in each, so two verdicts compare like with like.
    expect(commits, 'one commit').toHaveLength(1);
    expect(incomplete, 'sweeps without every seed').toEqual([]);
    expect(samples.map((s) => s.shift), 'the shifts').toEqual(SWEEP_SHIFTS);
    expect(check.allowed, `sweep regression: ${JSON.stringify(check)}`).toBe(true);
  });
});
