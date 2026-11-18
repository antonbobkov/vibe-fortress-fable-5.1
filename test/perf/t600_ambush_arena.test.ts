/**
 * T-600: the owner's squad (five Proficient soldiers, three marksdwarves and a runecaster, all in
 * steel) against a sprung peril-4 Gloam ambush of 6, 8 and 10, in the open by the gate and in a hall
 * (`test/scenarios/ambush-arena.ts`). A measurement, not a gate: it runs only with `T600_ARENA=1`
 * and writes one JSON row a fight to `T600_OUT` (default `.vite/t600-ambush-arena.jsonl`).
 *
 * `T600_N` fights a row (default 24, seeds 0 to N-1); `T600_KINDS` the rows, as
 * `squad:site:size[:archerShare[:medics]]` (default the owner's squad at both sites and three sizes, at the
 * rule's 0.4 archers).
 *
 *   T600_ARENA=1 npx vitest run -c vitest.perf.config.ts test/perf/t600_ambush_arena.test.ts
 */
import { describe, it } from 'vitest';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ambushArenaTrial, type AmbushSite } from '../scenarios/ambush-arena';
import type { ArenaSquad } from '../scenarios/wild-squad-arena';

const RUN = process.env['T600_ARENA'] === '1';
const OUT = process.env['T600_OUT'] ?? '.vite/t600-ambush-arena.jsonl';
const N = Number(process.env['T600_N'] ?? 24);
const FIRST = Number(process.env['T600_FIRST'] ?? 0);
const KINDS = (process.env['T600_KINDS'] ??
  'steel:gate:6,steel:gate:8,steel:gate:10,steel:hall:6,steel:hall:8,steel:hall:10').split(',');

describe.skipIf(!RUN)('T-600 the owner\'s squad against a sprung peril-4 ambush', () => {
  it('runs the arena', () => {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, '');
    for (const k of KINDS) {
      const [squad, site, size, share, medics] = k.split(':') as [ArenaSquad, AmbushSite, string, string | undefined, string | undefined];
      for (let i = FIRST; i < FIRST + N; i += 1) {
        const t0 = Date.now();
        const r = ambushArenaTrial(squad, site, Number(size), i, share === undefined ? 0.4 : Number(share), Number(medics ?? 0));
        appendFileSync(OUT, JSON.stringify({ ...r, ms: Date.now() - t0 }) + '\n');
      }
    }
  }, 14_400_000);
});
