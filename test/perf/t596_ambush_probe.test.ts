/**
 * T-596's probe of an ambush that stays engaged in the fortress: plays a three-year seed
 * (`T596_SEED`, default `three-years-p2-3`) at `THREE_YEARS_SHIFT` (default 50) with the sweep's
 * loop (`three_years_seeds.test.ts`: the shift, the bootstrap in steps of 100 ticks, then 300) to day
 * `T596_DAYS` (default 334), and from day `T596_FROM` (default 320) prints, every `T596_EVERY`
 * ticks, each ambush on the map (state, morale, members with their place against the gate stair),
 * the alert, the squad and the soldiers stood down, and the dwarves within 12 tiles of a member
 * with what they are doing; and each fortress death with its cause and killer. Local diagnosis
 * only (set `T596_PROBE=1`); not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import { TICKS_PER_DAY } from '@core/constants';
import type { CombatReader } from '@systems/combat/reader';
import type { JobsReader } from '@systems/jobs';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  playThreeYears,
  setupThreeYearsFortress,
  threeYearsWorld,
} from '../scenarios/three_years_fortress';

const SEED = process.env['T596_SEED'] ?? 'three-years-p2-3';
const SHIFT = Number(process.env['THREE_YEARS_SHIFT'] ?? '50');
const DAYS = Number(process.env['T596_DAYS'] ?? '334');
const FROM = Number(process.env['T596_FROM'] ?? '320');
const EVERY = Number(process.env['T596_EVERY'] ?? '100');
const peril = (seed: string): number => Number(/-p(\d)-/.exec(seed)?.[1] ?? '4');

describe('T-596 probe: an ambush engaged in the fortress', () => {
  it.runIf(process.env['T596_PROBE'] === '1')(SEED, () => {
    const w = threeYearsWorld(SEED, peril(SEED));
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const jobs = w.readers.of<JobsReader>('11');
    const combat = w.readers.of<CombatReader>('16');
    const gate = { x: state.cx + 6, y: state.cy + 6, z: state.z };
    const rel = (q: { x: number; y: number; z: number }): string => `${q.x - gate.x},${q.y - gate.y},${q.z - gate.z}${w.map.hasFlag(w.index(q.x, q.y, q.z), TileFlag.Outdoor) ? 'o' : ''}`;
    const out: string[] = [];
    const day = (): string => `d${Math.floor(w.tick / TICKS_PER_DAY)}t${w.tick}`;
    const doing = (id: number): string => {
      const b = ent.get(id, C.Brain);
      const jid = ent.get(id, C.Worker)?.jobId ?? 0;
      const job = jid !== 0 ? jobs.typeOf(jid) : '';
      const sq = ent.get(id, C.Soldier);
      return `${b?.behavior ?? '?'}:${b?.activity ?? '?'}${job ? `/${job}` : ''}${sq && sq.squadId !== 0 ? `[sq${sq.squadId}${sq.onDuty ? ' duty' : ''}]` : ''}`;
    };
    w.game.world.onEvents((events) => {
      if (w.tick < FROM * TICKS_PER_DAY) return;
      for (const e of events) {
        if (e.type === 'CreatureDied' && e['faction'] === 'fortress') {
          out.push(`${day()} DIED ${Number(e['id'])} ${String(e['cause'])} killer ${String(e['killerId'])}`);
        } else if (['AmbushSprung', 'AlertChanged', 'RaidEnded', 'HostileFled', 'CreatureUnconscious'].includes(e.type)) {
          out.push(`${day()} ${e.type} ${JSON.stringify(e)}`);
        }
      }
    });
    const sample = (): void => {
      if (w.tick < FROM * TICKS_PER_DAY || w.tick % EVERY !== 0) return;
      for (const pId of ent.with(C.Party)) {
        const p = ent.get(pId, C.Party);
        if (!p || p.purpose === 'caravan' || p.state === 'gone') continue;
        const ms = p.members.filter((m) => ent.alive(m)).map((m) => {
          const q = ent.get(m, C.Position);
          const h = ent.get(m, C.Hostile);
          const t = combat.targetOf(m);
          return `${m}@${q ? rel(q) : '-'}${h?.stealthed ? 'h' : ''}${t ? `>${t}` : ''}`;
        });
        out.push(`${day()} party ${pId} ${p.purpose} ${p.state} since ${p.stateSince} morale ${p.morale} sprung ${p.ambushSprung} stalled ${p.stalled} blowSince ${p.blowSince} goal ${rel({ x: w.map.xOf(p.goalTile), y: w.map.yOf(p.goalTile), z: w.map.zOf(p.goalTile) })} members ${ms.join(' ')}`);
        const near = new Set<number>();
        for (const m of p.members) {
          const q = ent.get(m, C.Position);
          if (!q || !ent.alive(m)) continue;
          for (const id of ent.with(C.Labors)) {
            const r = ent.get(id, C.Position);
            if (r && ent.alive(id) && Math.abs(r.z - q.z) <= 1 && Math.max(Math.abs(r.x - q.x), Math.abs(r.y - q.y)) <= 12) near.add(id);
          }
        }
        out.push(`   alert ${w.game.world.fortress.alert} squad ${JSON.stringify(combat.squads().map((s) => s.members))} stoodDown ${JSON.stringify(state.stoodDown ?? [])} answered ${state.answered} near: ${[...near].map((id) => `${id}@${rel(ent.get(id, C.Position)!)} ${doing(id)}`).join('; ')}`);
      }
    };
    const total = DAYS * TICKS_PER_DAY;
    while (w.tick < 20 * TICKS_PER_DAY) {
      playThreeYears(w, state, Math.min(100, 20 * TICKS_PER_DAY - w.tick));
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    while (w.tick < total) {
      playThreeYears(w, state, Math.min(300, total - w.tick), sample);
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    console.log(`[t596] ${SEED} shift ${SHIFT} hallZ ${state.hallZ - state.z}\n${out.join('\n')}`);
    expect(w.tick).toBe(total);
  }, 7_200_000);
});
