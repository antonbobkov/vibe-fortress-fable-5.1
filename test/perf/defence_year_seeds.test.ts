/**
 * `defence_year` on a set of seeds: whether the hand-laid defence turns the announced raid back.
 *
 * Each seed plays the scenario's own script (`defence_year_fortress.ts`) for its two years and
 * prints, for every party that arrived with an announcement, its kind, size and ending, and for
 * the raid what became of its captain and how many of it died. One seed's raid can go either way
 * on the job timeline (testing-strategy.md § What may be a gate), so the rule is over the set: at
 * least DEFENCE_SET_RULE of the seeds end every announced raid `repelled` or `wiped`. Its noise is
 * measured in reports/audits/2026-11-05-t466-defence-repels-a-raid.md.
 */

import { describe, it, expect } from 'vitest';
import { appendFileSync, mkdirSync } from 'node:fs';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { CombatReader } from '@systems/combat/reader';
import { playDefenceYear } from '../scenarios/defence_year_fortress';

export const DEFENCE_YEAR_SEEDS: readonly string[] = [
  'defence-year', 'defence-year-2', 'defence-year-3', 'defence-year-4',
  'defence-year-5', 'defence-year-6', 'defence-year-7', 'defence-year-8',
];
/** Seeds of the eight whose every announced raid must end `repelled` or `wiped`. */
export const DEFENCE_SET_RULE = 5;

interface SeedRow {
  seed: string;
  day: number;
  raids: { size: number; members: number; outcome: string; dead: number; captain: string }[];
  others: string[];
  soldierKills: number;
  trapTriggers: number;
  caged: number;
  trial: string;
}

function playSeed(seed: string): SeedRow {
  const soldiers = new Set<number>();
  let soldierKills = 0;
  const members = new Map<number, number[]>();
  const fate = new Map<number, string>();
  const { w, state } = playDefenceYear({
    seed,
    observe: (tw) => {
      tw.game.world.onEvents((batch) => {
        const ent = tw.game.world.entities;
        for (const e of batch) {
          if (e.type === 'HostileSpawned') {
            const party = ent.get(e['partyId'] as number, C.Party);
            if (party?.purpose === 'raid') members.set(e['partyId'] as number, [...(members.get(e['partyId'] as number) ?? []), e['id'] as number]);
            if (ent.get(e['id'] as number, C.Hostile)?.role === 'captain') fate.set(e['id'] as number, 'left');
          } else if (e.type === 'CreatureCaged' && fate.has(e['creatureId'] as number)) fate.set(e['creatureId'] as number, 'caged');
          else if (e.type === 'CreatureDied' && fate.has(e['id'] as number)) fate.set(e['id'] as number, `died (${String(e['cause'])})`);
          else if (e.type === 'KillRecorded' && e['hostile'] === true && soldiers.has(e['killerId'] as number)) soldierKills += 1;
        }
      });
    },
    watch: (tw, st) => {
      const squad = tw.readers.of<CombatReader>('16').squads().find((s) => s.id === st.fortress.squadId);
      soldiers.clear();
      for (const id of squad?.members ?? []) soldiers.add(id);
    },
  });
  const died = new Set(w.events('CreatureDied').map((e) => e['id'] as number));
  const ended = (partyId: unknown): string => String(w.events('RaidEnded').find((x) => x['partyId'] === partyId)?.['outcome'] ?? 'active');
  const raids = w.events('RaidArrived').filter((e) => e['kind'] === 'raid').map((e) => {
    const ids = members.get(e['partyId'] as number) ?? [];
    const captain = ids.find((id) => fate.has(id));
    return { size: Number(e['size']), members: ids.length, outcome: ended(e['partyId']), dead: ids.filter((id) => died.has(id)).length,
      captain: captain === undefined ? 'none' : fate.get(captain)! };
  });
  const others = w.events('RaidArrived').filter((e) => e['kind'] !== 'raid').map((e) => `${String(e['kind'])}:${Number(e['size'])}:${ended(e['partyId'])}`);
  return { seed, day: Math.floor(w.tick / TICKS_PER_DAY) + 1, raids, others, soldierKills,
    trapTriggers: w.events('TrapTriggered').length, caged: w.events('CreatureCaged').length, trial: state.trial };
}

const ONLY = (process.env['DEFENCE_SEEDS'] ?? '').split(',').filter((s) => s !== '');
const SEEDS = ONLY.length > 0 ? ONLY : DEFENCE_YEAR_SEEDS;

describe('T-466 defence_year seeds', () => {
  const turned: string[] = [];
  for (const seed of SEEDS) {
    it(`defence_year on ${seed}`, () => {
      const row = playSeed(seed);
      const out = process.env['DEFENCE_SEEDS_OUT'] ?? '.vite/defence-year-seeds';
      mkdirSync(out, { recursive: true });
      appendFileSync(`${out}/rows.jsonl`, JSON.stringify(row) + '\n');
      console.log(`defence_year_seeds: ${JSON.stringify(row)}`);
      if (row.raids.length > 0 && row.raids.every((r) => r.outcome === 'repelled' || r.outcome === 'wiped')) turned.push(seed);
    }, 1_800_000);
  }
  it('turns the announced raid back on most seeds', () => {
    console.log(`defence_year_seeds: raid turned back on ${turned.length} of ${SEEDS.length}: ${turned.join(', ')}`);
    if (ONLY.length === 0) expect(turned.length).toBeGreaterThanOrEqual(DEFENCE_SET_RULE);
  });
});
