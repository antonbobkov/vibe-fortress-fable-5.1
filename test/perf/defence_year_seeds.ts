/**
 * `defence_year` on a set of seeds: one seed's row (defence_year_seeds.test.ts plays them, and
 * defence_year_seeds_verdict.test.ts judges the pooled rows of measure.yml's `defence_seeds` suite).
 *
 * Each seed plays the scenario's own script (`defence_year_fortress.ts`) for its two years and
 * records, for every party that arrived with an announcement, its kind, size and ending, and for
 * the raid what became of its captain and how many of it died. One seed's raid can go either way
 * on the job timeline (testing-strategy.md § What may be a gate), so the rule is over the set: at
 * least DEFENCE_SET_RULE of the seeds end every announced raid `repelled` or `wiped`, and on at least
 * DEFENCE_KILL_RULE a soldier kills a hostile; T-522 judges both on the mean over several cadences.
 */

import { execFileSync } from 'node:child_process';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { CombatReader } from '@systems/combat/reader';
import { playDefenceYear } from '../scenarios/defence_year_fortress';
import { innerLineBuilt } from '../scenarios/three_years_fortress';

export const DEFENCE_YEAR_SEEDS: readonly string[] = [
  'defence-year', 'defence-year-2', 'defence-year-3', 'defence-year-4',
  'defence-year-5', 'defence-year-6', 'defence-year-7', 'defence-year-8',
];
/** Seeds of the eight whose every announced raid must end `repelled` or `wiped` (T-522: the mean over the cadences). */
export const DEFENCE_SET_RULE = 5;
/**
 * T-512: seeds of the eight on which a soldier kills a hostile. Measured: 8, 7 of 7, 5 and 7 seeds on
 * master and with T-512's sowing rule at two timelines each, and 7 or 8 in T-466's, T-486's and
 * T-504's rows (reports/data/2026-11-06-t512-measurements.md).
 */
export const DEFENCE_KILL_RULE = 4;

export interface DefenceSeedRow {
  seed: string;
  /** The script's cadence (DEFENCE_WATCH_EVERY) and the commit played; absent in rows before T-522. */
  watch?: number;
  runtimeCommit?: string;
  day: number;
  raids: { size: number; members: number; outcome: string; dead: number; captain: string }[];
  others: string[];
  soldierKills: number;
  trapTriggers: number;
  caged: number;
  trial: string;
  /**
   * T-506: dwarves of the fortress killed by a member of an announced raid, and how many of them were
   * soldiers; the second line (T-518) standing when each raid arrived; and the times the script opened
   * the north door to its squad on a raid. Absent in rows before T-506.
   */
  raidKilled?: number;
  raidKilledSoldiers?: number;
  lineAtRaid?: boolean[];
  raidSallies?: number;
}

/** Whether a seed ended every announced raid `repelled` or `wiped`. */
export function turnedBack(row: DefenceSeedRow): boolean {
  return row.raids.length > 0 && row.raids.every((r) => r.outcome === 'repelled' || r.outcome === 'wiped');
}

export function playDefenceSeed(seed: string, watchEvery: number): DefenceSeedRow {
  const soldiers = new Set<number>();
  let soldierKills = 0;
  const members = new Map<number, number[]>();
  const fate = new Map<number, string>();
  const raidMembers = new Set<number>();
  const lineAtRaid: boolean[] = [];
  let raidKilled = 0;
  let raidKilledSoldiers = 0;
  const { w, state } = playDefenceYear({
    seed,
    watchEvery,
    observe: (tw, st) => {
      tw.game.world.onEvents((batch) => {
        const ent = tw.game.world.entities;
        for (const e of batch) {
          if (e.type === 'RaidArrived' && e['kind'] === 'raid') lineAtRaid.push(innerLineBuilt(tw, st.fortress));
          if (e.type === 'CreatureDied' && e['faction'] === 'fortress' && e['species'] === 'dwarf' && raidMembers.has(e['killerId'] as number)) {
            raidKilled += 1;
            if (soldiers.has(e['id'] as number)) raidKilledSoldiers += 1;
          }
          if (e.type === 'HostileSpawned') {
            const party = ent.get(e['partyId'] as number, C.Party);
            if (party?.purpose === 'raid') raidMembers.add(e['id'] as number);
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
  return { seed, watch: watchEvery, runtimeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    day: Math.floor(w.tick / TICKS_PER_DAY) + 1, raids, others, soldierKills,
    trapTriggers: w.events('TrapTriggered').length, caged: w.events('CreatureCaged').length, trial: state.trial,
    raidKilled, raidKilledSoldiers, lineAtRaid, raidSallies: state.raidSallies };
}
