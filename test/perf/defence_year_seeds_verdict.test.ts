/**
 * T-522: the verdict of `defence_year_seeds` over its pooled cadences. measure.yml's `defence_seeds`
 * suite plays the eight seeds at each of its cadences (input `watch`, 20 to 55 by fives by default) in
 * parallel, one job a seed and cadence, and runs this file over their rows; locally, run
 * `defence_year_seeds.test.ts` once per cadence (`DEFENCE_WATCH_EVERY`) with `DEFENCE_SEEDS_OUT` under
 * one folder, and point `DEFENCE_SEEDS_SAMPLES` at it. Every `rows.jsonl` below that folder is read.
 * With no rows the file skips.
 *
 * One seed's raid can go either way on the job timeline, and so can one set of eight (T-522 measured
 * 1 to 4 of 8 over six cadences of one commit), so the set rules are judged on the mean over the
 * cadences: at least DEFENCE_SET_RULE of the eight seeds end every announced raid `repelled` or
 * `wiped`, and on at least DEFENCE_KILL_RULE a soldier kills a hostile.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFENCE_KILL_RULE, DEFENCE_SET_RULE, DEFENCE_YEAR_SEEDS, turnedBack, type DefenceSeedRow } from './defence_year_seeds';

const dir = process.env['DEFENCE_SEEDS_SAMPLES'] ?? '.vite/defence-year-seeds';

function rowFiles(d: string): string[] {
  if (!existsSync(d)) return [];
  return readdirSync(d).flatMap((name) => {
    const p = join(d, name);
    return statSync(p).isDirectory() ? rowFiles(p) : name === 'rows.jsonl' ? [p] : [];
  });
}

const rows: DefenceSeedRow[] = rowFiles(dir).flatMap((f) => readFileSync(f, 'utf8').split('\n').filter((l) => l.trim() !== '')
  .map((l) => JSON.parse(l) as DefenceSeedRow));
const cadences = [...new Set(rows.map((r) => r.watch ?? 20))].sort((a, b) => a - b);

describe.skipIf(rows.length === 0)('T-522 defence_year seeds judged over their pooled cadences', () => {
  it(`at least ${DEFENCE_SET_RULE} of ${DEFENCE_YEAR_SEEDS.length} seeds turn every announced raid back, on the mean over the cadences`, () => {
    const at = (watch: number, seed: string): DefenceSeedRow | undefined => rows.find((r) => (r.watch ?? 20) === watch && r.seed === seed);
    const commits = [...new Set(rows.map((r) => r.runtimeCommit ?? '?'))];
    const missing = cadences.flatMap((c) => DEFENCE_YEAR_SEEDS.filter((s) => at(c, s) === undefined).map((s) => `${s} at ${c}`));
    const turned = cadences.map((c) => DEFENCE_YEAR_SEEDS.filter((s) => { const r = at(c, s); return r !== undefined && turnedBack(r); }).length);
    const killed = cadences.map((c) => DEFENCE_YEAR_SEEDS.filter((s) => (at(c, s)?.soldierKills ?? 0) > 0).length);
    const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
    // T-506: the dwarves the raids killed, and the seeds where a raider died.
    const raidKilled = cadences.map((c) => sum(DEFENCE_YEAR_SEEDS.map((s) => at(c, s)?.raidKilled ?? 0)));
    const raidersDied = cadences.map((c) => DEFENCE_YEAR_SEEDS.filter((s) => (at(c, s)?.raids ?? []).some((r) => r.dead > 0)).length);
    const meanTurned = sum(turned) / cadences.length;
    const meanKilled = sum(killed) / cadences.length;
    const raidCell = (r: DefenceSeedRow | undefined): string => r === undefined ? '–'
      : r.raids.map((x) => `${x.size} ${x.outcome}, ${x.captain}${x.dead > 0 ? `, ${x.dead} dead` : ''}`).join('; ') || 'no raid';
    const judged = commits.length === 1 && missing.length === 0;
    const pass = meanTurned >= DEFENCE_SET_RULE && meanKilled >= DEFENCE_KILL_RULE;
    const lines = [
      `## defence_year seeds: cadences ${cadences.join(', ')} of ${commits.map((c) => c.slice(0, 8)).join(', ')}`,
      '',
      '| Cadence | Raids turned back (of 8) | A soldier killed (of 8) | A raider died (of 8) | Dwarves killed by raids |',
      '|---|---|---|---|---|',
      ...cadences.map((c, k) => `| ${c} | ${turned[k]} | ${killed[k]} | ${raidersDied[k]} | ${raidKilled[k]} |`),
      `| **Mean** | **${meanTurned.toFixed(2)}** | **${meanKilled.toFixed(2)}** | ${(sum(raidersDied) / cadences.length).toFixed(2)} | ${(sum(raidKilled) / cadences.length).toFixed(2)} |`,
      `| Set rule | ≥ ${DEFENCE_SET_RULE} | ≥ ${DEFENCE_KILL_RULE} | | |`,
      '',
      `**Verdict: ${!judged ? `not judged (one commit, all eight seeds at every cadence${missing.length ? `; missing: ${missing.join(', ')}` : ''})` : pass ? 'pass' : 'blocked'}.**`,
      '',
      `| Seed | ${cadences.map((c) => `Raid at ${c} (size, ending, captain)`).join(' | ')} | Soldier kills | Dwarves killed by the raid | Second line at the raid | Traps triggered | Caged | Bridge trial |`,
      `|---|${cadences.map(() => '---').join('|')}|---|---|---|---|---|---|`,
      ...DEFENCE_YEAR_SEEDS.map((s) => {
        const per = cadences.map((c) => at(c, s));
        const by = (f: (r: DefenceSeedRow) => string | number): string => per.map((r) => (r === undefined ? '–' : String(f(r)))).join(', ');
        const line = (r: DefenceSeedRow): string => r.lineAtRaid === undefined ? '?' : r.lineAtRaid.map((b) => (b ? 'y' : 'n')).join('') || '–';
        return `| ${s} | ${per.map(raidCell).join(' | ')} | ${by((r) => r.soldierKills)} | ${by((r) => r.raidKilled ?? '?')} | ${by(line)} | ${by((r) => r.trapTriggers)} | ${by((r) => r.caged)} | ${by((r) => r.trial)} |`;
      }),
      '',
    ];
    writeFileSync(join(dir, 'verdict.md'), lines.join('\n'));
    writeFileSync(join(dir, 'verdict.json'), JSON.stringify({ cadences, commits, turned, killed, raidersDied, raidKilled, meanTurned, meanKilled, setRule: DEFENCE_SET_RULE, killRule: DEFENCE_KILL_RULE, rows }, null, 2) + '\n');
    console.log(lines.join('\n'));
    expect(commits, 'one commit').toHaveLength(1);
    expect(missing, 'seeds without a row').toEqual([]);
    expect(meanTurned, `raids turned back, mean over cadences ${cadences.join(', ')}: ${turned.join(', ')}`).toBeGreaterThanOrEqual(DEFENCE_SET_RULE);
    expect(meanKilled, `a soldier killed, mean over cadences ${cadences.join(', ')}: ${killed.join(', ')}`).toBeGreaterThanOrEqual(DEFENCE_KILL_RULE);
  });
});

