// Combines the per-seed files of the on-demand twenty-seed sweep (.github/workflows/measure.yml)
// into one row and the file's set rule, as test/perf/three_years_seeds.test.ts states it.
// usage: node scripts/ci/sweep-summary.mjs <dir with three-years-*.json>
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'seeds';
const EMBARK_SIZE = 7;
const SET = { alive: 18, grown: 6, hungry: 1 }; // mirrors SET_* in three_years_seeds.test.ts
const SEEDS = 20;

const rows = readdirSync(dir)
  .filter((f) => /^three-years-p\d-\d+\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
  .map(({ figures, result, needDeaths }) => ({
    seed: result.seed,
    peril: result.peril,
    y1: result.y1Pop,
    y3: result.y3Pop,
    deaths: result.dwarfDeaths,
    needDeaths: needDeaths ?? null,
    extinctDay: result.extinctDay ?? null,
    byCause: figures.byCause,
  }))
  .sort((a, b) => a.seed.localeCompare(b.seed, 'en', { numeric: true }));

const missing = SEEDS - rows.length;
const byPeril = {};
for (const r of rows) {
  const p = (byPeril[r.peril] ??= { seeds: 0, deaths: 0, living: 0 });
  p.seeds += 1;
  p.deaths += r.deaths;
  p.living += r.y3;
}
const total = rows.reduce((t, r) => ({ deaths: t.deaths + r.deaths, living: t.living + r.y3 }), { deaths: 0, living: 0 });
const alive = rows.filter((r) => r.y1 > 0).length;
const peril0 = rows.filter((r) => r.peril === 0);
const grown = peril0.filter((r) => r.y3 > EMBARK_SIZE).length;
const hungry = peril0.filter((r) => (r.needDeaths ?? 0) > 0).length;
const ok = missing === 0 && alive >= SET.alive && grown >= SET.grown && hungry <= SET.hungry;

const out = [];
out.push(`## Twenty-seed sweep`);
out.push('');
out.push(`**Total:** ${total.deaths} dwarf deaths, ${total.living} living, over ${rows.length} of ${SEEDS} seeds${missing ? ` (${missing} produced no result)` : ''}.`);
out.push('');
out.push(`**Set rule:** ${ok ? 'holds' : 'BROKEN'}. Alive at year 1 ${alive}/${rows.length} (need ${SET.alive}); peril-0 grown ${grown}/${peril0.length} (need ${SET.grown}); peril-0 with need deaths ${hungry} (at most ${SET.hungry}).`);
out.push('');
out.push('| Peril | Seeds | Deaths | Living |');
out.push('|---|---|---|---|');
for (const [p, v] of Object.entries(byPeril)) out.push(`| ${p} | ${v.seeds} | ${v.deaths} | ${v.living} |`);
out.push('');
out.push('| Seed | Year 1 | Year 3 | Deaths | Need deaths | Extinct day |');
out.push('|---|---|---|---|---|---|');
for (const r of rows) out.push(`| ${r.seed} | ${r.y1} | ${r.y3} | ${r.deaths} | ${r.needDeaths ?? '?'} | ${r.extinctDay ?? ''} |`);
console.log(out.join('\n'));
