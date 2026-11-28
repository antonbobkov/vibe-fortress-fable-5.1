// T-819: a sweep against another, paired by seed and shift (testing-strategy.md § The twenty-seed sweep,
// § Judging a change by its paired seed-shifts). Pure maths and loading; scripts/sweep-compare.mjs is the CLI,
// test/unit/sweep-pairs.test.ts checks the maths on fixture rows.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * One seed at one shift: the figures the verdict pools, and a fingerprint of the run's other figures, so a
 * seed-shift whose deaths and living stayed equal still counts as moved when its timeline parted.
 * @typedef {{ seed: string; shift: number; peril: number; living: number; deaths: number; needDeaths: number; fp: string }} SeedShift
 */

/** The result fields that make the fingerprint (three_years_seeds.test.ts's result), when the file has them. */
export const FINGERPRINT_FIELDS = ['y1Pop', 'y2Pop', 'y3Pop', 'y1Wealth', 'y2Wealth', 'y3Wealth', 'dwarfDeaths', 'tameDeaths',
  'wavesCount', 'totalImmigrants', 'raidsCount', 'mealsEaten', 'drinksDrunk'];

/** The verdict's bars, in noises (T-819). */
export const PAIRED_COST_NOISES = 2;
export const PAIRED_TRACE_NOISES = 1.5;

const perilOf = (seed) => Number(/-p(\d)-/.exec(seed)?.[1] ?? -1);
const keyOf = (r) => `${r.seed}@${r.shift}`;
const round2 = (x) => Math.round(x * 100) / 100;
const bySeedShift = (a, b) => a.shift - b.shift || a.seed.localeCompare(b.seed, 'en', { numeric: true });

/**
 * A seed-shift from one seed's result file (`shift-<n>/three-years-<seed>.json`).
 * @returns {SeedShift}
 */
export function rowFromSeedFile(file, shiftFromPath) {
  const r = file.result;
  return {
    seed: r.seed, shift: file.shift ?? shiftFromPath, peril: r.peril ?? perilOf(r.seed), living: r.y3Pop, deaths: r.dwarfDeaths,
    needDeaths: file.needDeaths ?? 0, fp: FINGERPRINT_FIELDS.map((k) => String(r[k] ?? '')).join(','),
  };
}

/**
 * The seed-shifts of a sweep held in a directory: every `shift-<n>/three-years-<seed>.json` below it (a downloaded
 * `sweep` artifact, or a whole run's artifacts, one folder each), else a `verdict.json` in it.
 * @returns {{ rows: SeedShift[]; commits: string[]; fingerprint: 'full' | 'rows' }}
 */
export function loadSweepDir(dir) {
  const found = new Map();
  const commits = new Set();
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      const shiftDir = /shift-(\d+)$/.exec(d);
      if (!shiftDir || !/^three-years-p\d-\d+\.json$/.test(name)) continue;
      const file = JSON.parse(readFileSync(path, 'utf8'));
      const row = rowFromSeedFile(file, Number(shiftDir[1]));
      found.set(keyOf(row), row);
      if (file.runtimeCommit) commits.add(file.runtimeCommit);
    }
  };
  walk(dir);
  if (found.size > 0) return { rows: [...found.values()].sort(bySeedShift), commits: [...commits], fingerprint: 'full' };
  const verdict = join(dir, 'verdict.json');
  if (existsSync(verdict)) return loadSweepJson(JSON.parse(readFileSync(verdict, 'utf8')));
  throw new Error(`${dir}: no shift-<n>/three-years-<seed>.json and no verdict.json`);
}

/**
 * The seed-shifts of a verdict.json (rows only, so the fingerprint is the verdict's figures) or of a saved
 * reference (scripts/sweep-compare.mjs --set-reference).
 */
export function loadSweepJson(json) {
  if (Array.isArray(json.rows)) return { rows: [...json.rows].sort(bySeedShift), commits: json.commit ? [json.commit] : [], fingerprint: json.fingerprint ?? 'full' };
  if (!Array.isArray(json.samples)) throw new Error('not a sweep: neither rows nor samples');
  const rows = json.samples.flatMap((s) => s.rows.map((r) => ({
    seed: r.seed, shift: s.shift, peril: r.peril, living: r.y3, deaths: r.deaths, needDeaths: r.needDeaths ?? 0,
    fp: [r.y1, r.y3, r.deaths, r.needDeaths, r.extinctDay].join(','),
  })));
  return { rows: rows.sort(bySeedShift), commits: [...new Set(json.samples.flatMap((s) => s.commits ?? []))], fingerprint: 'rows' };
}

/** The sample standard deviation (n − 1); 0 for fewer than two values. */
export function sampleSd(xs) {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((t, x) => t + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((t, x) => t + (x - mean) ** 2, 0) / (xs.length - 1));
}

/**
 * A group of paired seed-shifts summed and divided by `per` (the shifts a pooled figure is a mean over, or 1 for
 * one shift's sum), with its noise: the standard deviation of the differences × √n / per, T-814's measure.
 */
function groupFigures(pairs, per) {
  const d = (f) => pairs.map((p) => p.change[f] - p.base[f]);
  const deaths = d('deaths');
  const living = d('living');
  const noise = (xs) => round2((sampleSd(xs) * Math.sqrt(xs.length)) / per);
  return {
    pairs: pairs.length,
    moved: pairs.filter((p) => p.base.fp !== p.change.fp).length,
    deathsRose: deaths.filter((x) => x > 0).length,
    deathsFell: deaths.filter((x) => x < 0).length,
    deathsEqual: deaths.filter((x) => x === 0).length,
    livingRose: living.filter((x) => x > 0).length,
    livingFell: living.filter((x) => x < 0).length,
    base: { deaths: round2(pairs.reduce((t, p) => t + p.base.deaths, 0) / per), living: round2(pairs.reduce((t, p) => t + p.base.living, 0) / per) },
    change: { deaths: round2(pairs.reduce((t, p) => t + p.change.deaths, 0) / per), living: round2(pairs.reduce((t, p) => t + p.change.living, 0) / per) },
    deaths: round2(deaths.reduce((t, x) => t + x, 0) / per),
    deathsNoise: noise(deaths),
    living: round2(living.reduce((t, x) => t + x, 0) / per),
    livingNoise: noise(living),
  };
}

/**
 * The verdict on a paired comparison (testing-strategy.md § Judging a change by its paired seed-shifts):
 * `cost` when the deaths rise or the living fall by twice their noise or more, or the moved seed-shifts' deaths
 * rise more often than they fall by twice the square root of their count (a sign test); `trace` when one of
 * those is 1.5 noises or more; `pass` otherwise.
 */
export function pairedVerdict(pooled) {
  const z = (x, noise) => (noise > 0 ? x / noise : x === 0 ? 0 : Math.sign(x) * Infinity);
  const deathsZ = z(pooled.deaths, pooled.deathsNoise);
  const livingZ = z(-pooled.living, pooled.livingNoise);
  const split = pooled.deathsRose + pooled.deathsFell;
  const signZ = split > 0 ? (pooled.deathsRose - pooled.deathsFell) / Math.sqrt(split) : 0;
  const reasons = [];
  const level = (zv, what) => {
    if (zv >= PAIRED_COST_NOISES) { reasons.push(`${what} ${round2(zv)} noises`); return 2; }
    if (zv >= PAIRED_TRACE_NOISES) { reasons.push(`${what} ${round2(zv)} noises`); return 1; }
    return 0;
  };
  const worst = Math.max(level(deathsZ, 'deaths up'), level(livingZ, 'living down'), level(signZ, 'more seed-shifts rose than fell,'));
  return { verdict: ['pass', 'trace', 'cost'][worst], deathsZ: round2(deathsZ), livingZ: round2(livingZ), signZ: round2(signZ), reasons };
}

/**
 * The paired comparison of two sweeps: by shift, by peril and pooled, over the seed-shifts both hold.
 * @param {SeedShift[]} baseRows
 * @param {SeedShift[]} changeRows
 */
export function compareSweeps(baseRows, changeRows, { top = 8 } = {}) {
  const base = new Map(baseRows.map((r) => [keyOf(r), r]));
  const change = new Map(changeRows.map((r) => [keyOf(r), r]));
  const pairs = [...base.keys()].filter((k) => change.has(k)).map((k) => ({ base: base.get(k), change: change.get(k) }))
    .sort((a, b) => bySeedShift(a.base, b.base));
  const onlyBase = [...base.keys()].filter((k) => !change.has(k));
  const onlyChange = [...change.keys()].filter((k) => !base.has(k));
  const shifts = [...new Set(pairs.map((p) => p.base.shift))].sort((a, b) => a - b);
  const perils = [...new Set(pairs.map((p) => p.base.peril))].sort((a, b) => a - b);
  const per = Math.max(1, shifts.length);
  const pooled = groupFigures(pairs, per);
  return {
    shifts,
    byShift: shifts.map((shift) => ({ shift, ...groupFigures(pairs.filter((p) => p.base.shift === shift), 1) })),
    byPeril: perils.map((peril) => ({ peril, ...groupFigures(pairs.filter((p) => p.base.peril === peril), per) })),
    pooled,
    verdict: pairedVerdict(pooled),
    movers: pairs.filter((p) => p.base.fp !== p.change.fp)
      .map((p) => ({ seed: p.base.seed, shift: p.base.shift, deaths: [p.base.deaths, p.change.deaths], living: [p.base.living, p.change.living],
        deathsDiff: p.change.deaths - p.base.deaths, livingDiff: p.change.living - p.base.living }))
      .sort((a, b) => Math.abs(b.deathsDiff) - Math.abs(a.deathsDiff) || Math.abs(b.livingDiff) - Math.abs(a.livingDiff) || a.shift - b.shift)
      .slice(0, top),
    onlyBase,
    onlyChange,
  };
}

const signed = (x) => (x > 0 ? `+${x}` : String(x));

/** The comparison as Markdown, for a terminal, a commit body or a step summary. */
export function comparisonMarkdown(c, { title = 'Paired sweep', baseName = 'base', changeName = 'change', fingerprint = 'full' } = {}) {
  const row = (label, g) => `| ${label} | ${g.moved} of ${g.pairs} | ${g.deathsRose} / ${g.deathsFell} / ${g.deathsEqual} | ${g.base.deaths} → ${g.change.deaths} | **${signed(g.deaths)}** (± ${g.deathsNoise}) | ${g.base.living} → ${g.change.living} | **${signed(g.living)}** (± ${g.livingNoise}) |`;
  const v = c.verdict;
  return [
    `## ${title}: ${changeName} against ${baseName}`,
    '',
    '| Group | Timelines moved | Deaths up / down / equal | Deaths | Paired deaths | Living | Paired living |',
    '|---|---|---|---|---|---|---|',
    ...c.byShift.map((g) => row(`shift ${g.shift}`, g)),
    ...c.byPeril.map((g) => row(`peril ${g.peril} (pooled)`, g)),
    row('**Pooled**', c.pooled),
    '',
    `Pooled figures are means over the ${c.shifts.length} shifts; a shift's row is its sum over the seeds. The noise (±) is the standard deviation of the seed-shift differences × √n / shifts (one shift: × √n).${fingerprint === 'rows' ? ' One side was read from a verdict.json, so a timeline counts as moved only when its year-1 or year-3 figures moved.' : ''}`,
    '',
    `**Paired verdict: ${v.verdict}.** Deaths ${signed(c.pooled.deaths)} (${signed(v.deathsZ)} noises), living ${signed(c.pooled.living)} (${signed(round2(-v.livingZ))} noises); deaths rose in ${c.pooled.deathsRose} seed-shifts and fell in ${c.pooled.deathsFell} (${signed(v.signZ)} noises, the noise of the count being √${c.pooled.deathsRose + c.pooled.deathsFell}). ${v.reasons.length ? `At or over ${PAIRED_TRACE_NOISES} noises: ${v.reasons.join('; ')}.` : `Nothing at ${PAIRED_TRACE_NOISES} noises or over.`} A cost is a deaths rise, a living loss or a rise count ${PAIRED_COST_NOISES} noises or more; from ${PAIRED_TRACE_NOISES} it is adopted after its largest movers are traced (testing-strategy.md § Judging a change by its paired seed-shifts).`,
    '',
    'Largest movers:',
    '',
    '| Seed | Shift | Deaths | Living |',
    '|---|---|---|---|',
    ...c.movers.map((m) => `| ${m.seed} | ${m.shift} | ${m.deaths[0]} → ${m.deaths[1]} (${signed(m.deathsDiff)}) | ${m.living[0]} → ${m.living[1]} (${signed(m.livingDiff)}) |`),
    ...(c.onlyBase.length || c.onlyChange.length
      ? ['', `Not paired (missing on one side): ${[...c.onlyBase.map((k) => `${k} only in ${baseName}`), ...c.onlyChange.map((k) => `${k} only in ${changeName}`)].join('; ')}.`]
      : []),
    '',
  ].join('\n');
}
