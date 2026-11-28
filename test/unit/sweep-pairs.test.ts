// T-819: the paired comparison of two sweeps (scripts/lib/sweep-pairs.mjs), on fixture rows: a hand-worked
// set, a directory of seed files as a downloaded artifact holds them, and T-814's two real sweeps, whose
// figures this must reproduce (docs/archive/tasks/T-814-master-drift-t795-t798.md).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Row { seed: string; shift: number; peril: number; living: number; deaths: number; needDeaths: number; fp: string }
interface Group {
  pairs: number; moved: number; deathsRose: number; deathsFell: number; deathsEqual: number;
  base: { deaths: number; living: number }; change: { deaths: number; living: number };
  deaths: number; deathsNoise: number; living: number; livingNoise: number;
}
interface Verdict { verdict: 'pass' | 'trace' | 'cost'; deathsZ: number; livingZ: number; signZ: number; reasons: string[] }
interface Comparison {
  shifts: number[]; byShift: (Group & { shift: number })[]; byPeril: (Group & { peril: number })[]; pooled: Group; verdict: Verdict;
  movers: { seed: string; shift: number; deathsDiff: number; livingDiff: number }[]; onlyBase: string[]; onlyChange: string[];
}
const lib = await import(new URL('../../scripts/lib/sweep-pairs.mjs', import.meta.url).href) as {
  compareSweeps(base: Row[], change: Row[], o?: { top?: number }): Comparison;
  comparisonMarkdown(c: Comparison, o?: Record<string, string>): string;
  loadSweepDir(dir: string): { rows: Row[]; commits: string[]; fingerprint: string };
  loadSweepJson(json: unknown): { rows: Row[]; commits: string[]; fingerprint: string };
  pairedVerdict(g: Group): Verdict;
  sampleSd(xs: number[]): number;
};

const row = (seed: string, shift: number, deaths: number, living = 50, fp = 'same'): Row =>
  ({ seed, shift, peril: Number(/-p(\d)-/.exec(seed)![1]), living, deaths, needDeaths: 0, fp: `${fp},${deaths},${living}` });
const seeds = ['three-years-p0-1', 'three-years-p2-1', 'three-years-p4-1'];

describe('T-819 a sweep paired with another by seed and shift', () => {
  // Deaths differences 0, +2, +4 at shift 0 and 0, −1, +3 at shift 50; p0-1 at shift 50 moved with equal figures.
  const base = [...seeds.map((s, i) => row(s, 0, 5 + i)), ...seeds.map((s, i) => row(s, 50, 5 + i))];
  const change = [
    row(seeds[0]!, 0, 5), row(seeds[1]!, 0, 8), row(seeds[2]!, 0, 11),
    row(seeds[0]!, 50, 5, 50, 'moved'), row(seeds[1]!, 50, 5), row(seeds[2]!, 50, 10),
  ];

  it('sums each shift, means the pool over the shifts, and gives each the noise sd × √n / shifts', () => {
    const c = lib.compareSweeps(base, change);
    expect(c.shifts).toEqual([0, 50]);
    expect(lib.sampleSd([0, 2, 4])).toBe(2);
    expect(c.byShift.map((g) => [g.shift, g.deaths, g.deathsNoise])).toEqual([[0, 6, 3.46], [50, 2, 3.61]]);
    // sd(0, 2, 4, 0, −1, 3) = 1.966; × √6 / 2 = 2.41.
    expect(c.pooled).toMatchObject({ pairs: 6, moved: 5, deathsRose: 3, deathsFell: 1, deathsEqual: 2, deaths: 4, deathsNoise: 2.41, living: 0, livingNoise: 0 });
    expect(c.pooled.base.deaths).toBe(18);
    expect(c.pooled.change.deaths).toBe(22);
    expect(c.byPeril.map((g) => [g.peril, g.deaths, g.moved])).toEqual([[0, 0, 1], [2, 0.5, 2], [4, 3.5, 2]]);
    expect(c.movers.map((m) => [m.seed, m.shift, m.deathsDiff])).toEqual([
      [seeds[2], 0, 4], [seeds[2], 50, 3], [seeds[1], 0, 2], [seeds[1], 50, -1], [seeds[0], 50, 0],
    ]);
    // 4 deaths is 1.66 noises: traced, not a cost; 3 rises against 1 fall is 1 noise of the count.
    expect(c.verdict).toMatchObject({ verdict: 'trace', deathsZ: 1.66, signZ: 1 });
    expect(lib.comparisonMarkdown(c)).toContain('| **Pooled** | 5 of 6 | 3 / 1 / 2 | 18 → 22 | **+4** (± 2.41) |');
  });

  it('pairs only the seed-shifts both sweeps hold and names the rest', () => {
    const c = lib.compareSweeps(base, change.slice(1));
    expect(c.pooled.pairs).toBe(5);
    expect(c.onlyBase).toEqual(['three-years-p0-1@0']);
    expect(c.onlyChange).toEqual([]);
  });

  it('calls a cost at two noises on deaths, on a living loss, or on the rise count', () => {
    const g = (o: Partial<Group>): Group => ({
      pairs: 80, moved: 80, deathsRose: 20, deathsFell: 20, deathsEqual: 40, base: { deaths: 0, living: 0 }, change: { deaths: 0, living: 0 },
      deaths: 0, deathsNoise: 10, living: 0, livingNoise: 20, ...o,
    });
    expect(lib.pairedVerdict(g({ deaths: 14 })).verdict).toBe('pass');
    expect(lib.pairedVerdict(g({ deaths: 15 })).verdict).toBe('trace');
    expect(lib.pairedVerdict(g({ deaths: 20 })).verdict).toBe('cost');
    expect(lib.pairedVerdict(g({ deaths: -40 })).verdict).toBe('pass');
    expect(lib.pairedVerdict(g({ living: -40 })).verdict).toBe('cost');
    expect(lib.pairedVerdict(g({ living: 80 })).verdict).toBe('pass');
    // 30 rises against 14 falls: 16 over √44 = 2.41 noises of the count, with the pooled deaths still small.
    expect(lib.pairedVerdict(g({ deathsRose: 30, deathsFell: 14, deaths: 5 }))).toMatchObject({ verdict: 'cost', signZ: 2.41 });
    // Every seed-shift one death up: no spread, so no noise, and a cost.
    expect(lib.pairedVerdict(g({ deaths: 20, deathsNoise: 0 })).verdict).toBe('cost');
    expect(lib.pairedVerdict(g({})).verdict).toBe('pass');
  });

  it('reads a downloaded artifact: shift-<n>/three-years-<seed>.json at any depth, the result fields its fingerprint', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sweep-pairs-'));
    try {
      for (const [shift, seed, deaths, meals] of [[0, 'p0-1', 1, 100], [50, 'p4-2', 3, 200]] as const) {
        const d = join(dir, `seed-${seed}-shift-${shift}`, `shift-${shift}`);
        mkdirSync(d, { recursive: true });
        writeFileSync(join(d, `three-years-${seed}.json`), JSON.stringify({
          shift, runtimeCommit: 'abc123', needDeaths: 0,
          result: { seed: `three-years-${seed}`, peril: Number(seed[1]), y1Pop: 17, y3Pop: 40, dwarfDeaths: deaths, mealsEaten: meals },
        }));
      }
      writeFileSync(join(dir, 'verdict.md'), 'not read');
      const s = lib.loadSweepDir(dir);
      expect(s.commits).toEqual(['abc123']);
      expect(s.fingerprint).toBe('full');
      expect(s.rows.map((r) => [r.seed, r.shift, r.peril, r.deaths, r.living])).toEqual([['three-years-p0-1', 0, 0, 1, 40], ['three-years-p4-2', 50, 4, 3, 40]]);
      expect(s.rows[0]!.fp).not.toBe(s.rows[1]!.fp);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads a verdict.json's rows when no seed file is there", () => {
    const s = lib.loadSweepJson({ samples: [{ shift: 50, commits: ['abc'], rows: [{ seed: 'three-years-p2-3', peril: 2, y1: 18, y3: 60, deaths: 4, needDeaths: 0, extinctDay: null }] }] });
    expect(s.fingerprint).toBe('rows');
    expect(s.rows).toMatchObject([{ seed: 'three-years-p2-3', shift: 50, peril: 2, living: 60, deaths: 4 }]);
  });

  it("reproduces T-814's pairing of 9a13599a (run 45911220303) and 7f37335f (run 46103268570)", () => {
    const fixture = (name: string): Row[] => lib.loadSweepJson(JSON.parse(readFileSync(new URL(`../fixtures/sweep-pairs/${name}.json`, import.meta.url), 'utf8'))).rows;
    const c = lib.compareSweeps(fixture('9a13599a'), fixture('7f37335f'));
    // T-814: 34 of 80 moved, deaths 13 / 11 / 56, +1.0 (± 5.6) deaths, +17.5 (± 9.1) living.
    expect(c.pooled).toMatchObject({ pairs: 80, moved: 34, deathsRose: 13, deathsFell: 11, deathsEqual: 56, deaths: 1, deathsNoise: 5.64, living: 17.5, livingNoise: 9.05 });
    expect(c.pooled.base).toEqual({ deaths: 108.5, living: 1139.75 });
    expect(c.pooled.change).toEqual({ deaths: 109.5, living: 1157.25 });
    expect(c.verdict.verdict).toBe('pass');
  });
});
