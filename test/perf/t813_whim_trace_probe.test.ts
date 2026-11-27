/**
 * T-813's trace of the Thane's whims: plays three-year seeds (`T813_SEEDS`, comma-separated; the probe
 * runs only when it is set) at `THREE_YEARS_SHIFT` with the sweep's loop (`three_years_seeds`: a
 * 20-day bootstrap in steps of 100 ticks, then steps of 300), so a seed's timeline is the sweep's. It
 * writes to `T813_OUT` (default `.vite/t813`) one file per seed: the world hash after every step,
 * each whim set and judged, and each dwarf death with what the dwarf was doing when first wounded in
 * the day before it and the purpose of the killer's party. Two commits' files are compared by the
 * first step whose hash differs. Local diagnosis only; not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { C } from '@core/components';
import { TICKS_PER_DAY, DAYS_PER_YEAR } from '@core/constants';
import type { JobsReader } from '@systems/jobs';
import type { CombatReader } from '@systems/combat/reader';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  playThreeYears,
  setupThreeYearsFortress,
  threeYearsWorld,
} from '../scenarios/three_years_fortress';

const SEEDS = (process.env['T813_SEEDS'] ?? '').split(',').filter((s) => s !== '');
const SHIFT = Number(process.env['THREE_YEARS_SHIFT'] ?? '0');
const DAYS = Number(process.env['T813_DAYS'] ?? String(3 * DAYS_PER_YEAR));
const OUT = process.env['T813_OUT'] ?? '.vite/t813';
const peril = (seed: string): number => Number(/-p(\d)-/.exec(seed)?.[1] ?? '4');

describe('T-813 probe: where a whim parts the timeline, and who dies after', () => {
  it.runIf(SEEDS.length > 0).each(SEEDS.length > 0 ? SEEDS : ['none'])('%s', (seed) => {
    const w = threeYearsWorld(seed, peril(seed));
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const jobs = w.readers.of<JobsReader>('11');
    const combat = w.readers.of<CombatReader>('16');
    const dwarf = w.game.registry.table('creatures').index('dwarf');
    const roleOf = (id: number): string => {
      if ((state.watch ?? []).some((wt) => wt.dwarfId === id)) return 'watch';
      const sq = combat.squads().find((s) => s.id === state.squadId);
      if (sq?.members.includes(id) === true || (state.stoodDown ?? []).includes(id)) return 'squad';
      return 'civilian';
    };
    const doing = (id: number): string => {
      const jid = ent.get(id, C.Worker)?.jobId ?? 0;
      return (jid !== 0 ? jobs.typeOf(jid) : null) ?? `${ent.get(id, C.Brain)?.behavior ?? '?'}:${ent.get(id, C.Brain)?.activity ?? '?'}`;
    };
    const purposeOf = new Map<number, string>();
    const firstWound = new Map<number, { tick: number; doing: string; role: string; by: string }>();
    const day = (): number => Math.floor(w.tick / TICKS_PER_DAY) + 1;
    const whims: string[] = [];
    const deaths: string[] = [];
    const pleased: number[] = [];
    w.game.world.onEvents((events) => {
      for (const p of ent.with(C.Party)) {
        const party = ent.get(p, C.Party);
        if (party) for (const m of party.members) if (!purposeOf.has(m)) purposeOf.set(m, party.purpose);
      }
      for (const e of events) {
        if (e.type === 'WhimSet') whims.push(`d${day()} set ${String(e['whimId'])}`);
        else if (e.type === 'WhimJudged') {
          whims.push(`d${day()} judged ${String(e['whimId'])} ${e['met'] === true ? 'MET' : 'missed'}`);
          if (e['met'] === true) pleased.push(day());
        } else if (e.type === 'AttackResolved' && Number(e['amount'] ?? 0) > 0) {
          const id = Number(e['defenderId']);
          if (ent.get(id, C.Creature)?.species !== dwarf || ent.get(id, C.Creature)?.faction !== 'fortress') continue;
          const prev = firstWound.get(id);
          if (prev !== undefined && w.tick - prev.tick < TICKS_PER_DAY) continue;
          firstWound.set(id, { tick: w.tick, doing: doing(id), role: roleOf(id), by: purposeOf.get(Number(e['attackerId'])) ?? `creature ${String(e['attackerId'])}` });
        } else if (e.type === 'CreatureDied' && e['species'] === dwarf && e['faction'] === 'fortress') {
          const id = Number(e['id']);
          const fw = firstWound.get(id);
          const wound = fw === undefined ? 'no wound seen' : `wounded d${Math.floor(fw.tick / TICKS_PER_DAY) + 1} as ${fw.role} doing ${fw.doing} by ${fw.by}`;
          deaths.push(`d${day()} ${id} ${String(e['cause'])}; ${wound}`);
        }
      }
    });
    const hashes: [number, string][] = [];
    const loop = (until: number, step: number): void => {
      while (w.tick < until) {
        playThreeYears(w, state, Math.min(step, until - w.tick));
        checkFortressWorkOrders(w, state);
        checkFortressRooms(w, state);
        checkFortressCaveFarm(w, state);
        checkFortressDefense(w, state);
        hashes.push([w.tick, w.hash()]);
      }
    };
    const log = console.log;
    console.log = (): void => {};
    try {
      loop(20 * TICKS_PER_DAY, 100);
      loop(DAYS * TICKS_PER_DAY, 300);
    } finally {
      console.log = log;
    }
    const living = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length;
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/${seed}-shift-${SHIFT}.json`, JSON.stringify({ seed, shift: SHIFT, living, deaths, whims, pleased, hashes }, null, 1));
    console.log(`[t813] ${seed} shift ${SHIFT}: living ${living}, deaths ${deaths.length}, pleased ${pleased.length}`);
    expect(hashes.length).toBeGreaterThan(0);
  });
});
