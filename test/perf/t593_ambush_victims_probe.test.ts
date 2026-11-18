/**
 * T-593's probe of who peril-4 ambushes kill and where: plays three-year seeds (`T593_SEEDS`,
 * comma-separated; the probe runs only when it is set) at `THREE_YEARS_SHIFT` with the sweep's loop
 * (`three_years_seeds`: a 20-day bootstrap in steps of 100 ticks, then steps of 300), so a seed's
 * timeline is the sweep's. It prints, for each sprung ambush, where its members stood and what
 * spotted them, and for each fortress creature wounded by its members: where the first wound found
 * it (tiles from the gate stair, levels from the surface, outdoors or not, what it was doing, in the
 * squad or the watch or not) and how it ended. Then each dwarf death by the purpose of its
 * killer's party. Local diagnosis only; not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
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

const SEEDS = (process.env['T593_SEEDS'] ?? '').split(',').filter((s) => s !== '');
const SHIFT = Number(process.env['THREE_YEARS_SHIFT'] ?? '0');
const DAYS = Number(process.env['T593_DAYS'] ?? String(3 * DAYS_PER_YEAR));
const peril = (seed: string): number => Number(/-p(\d)-/.exec(seed)?.[1] ?? '4');

interface Spot { d: number; z: number; out: boolean }
interface Victim { id: number; species: string; role: string; hit: Spot & { dt: number; doing: string }; end?: Spot & { dt: number; cause: string } }
interface Ambush { party: number; day: number; size: number; sprungAt: number; members: Spot[]; spotter: string; outdoors: number; victims: Victim[]; fell: number; ended?: number }

describe('T-593 probe: who peril-4 ambushes kill, and where', () => {
  it.runIf(SEEDS.length > 0).each(SEEDS.length > 0 ? SEEDS : ['none'])('%s', (seed) => {
    const w = threeYearsWorld(seed, peril(seed));
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const jobs = w.readers.of<JobsReader>('11');
    const combat = w.readers.of<CombatReader>('16');
    const gate = { x: state.cx + 6, y: state.cy + 6 };
    const dwarf = w.game.registry.table('creatures').index('dwarf');
    const speciesName = (s: unknown): string => (typeof s === 'number' ? w.game.registry.table('creatures').byIndex(s)?.id : undefined) ?? String(s);
    const spotOf = (x: number, y: number, z: number): Spot => ({ d: Math.max(Math.abs(x - gate.x), Math.abs(y - gate.y)), z: z - state.z, out: w.map.hasFlag(w.index(x, y, z), TileFlag.Outdoor) });
    const spotTile = (t: number): Spot => spotOf(w.map.xOf(t), w.map.yOf(t), w.map.zOf(t));
    const roleOf = (id: number): string => {
      if ((state.watch ?? []).some((wt) => wt.dwarfId === id)) return 'watch';
      const sq = combat.squads().find((s) => s.id === state.squadId);
      if (sq?.members.includes(id) === true || (state.stoodDown ?? []).includes(id)) return 'squad';
      return ent.get(id, C.Tame) !== undefined ? 'tame' : 'civilian';
    };
    const doing = (id: number): string => {
      const jid = ent.get(id, C.Worker)?.jobId ?? 0;
      return (jid !== 0 ? jobs.typeOf(jid) : null) ?? `${ent.get(id, C.Brain)?.behavior ?? '?'}:${ent.get(id, C.Brain)?.activity ?? '?'}`;
    };
    // Every hostile's party and its purpose, kept after it dies or leaves.
    const purposeOf = new Map<number, { party: number; purpose: string }>();
    const notePurposes = (): void => {
      for (const p of ent.with(C.Party)) {
        const party = ent.get(p, C.Party);
        if (party) for (const m of party.members) if (!purposeOf.has(m)) purposeOf.set(m, { party: p, purpose: party.purpose });
      }
    };
    const ambushes: Ambush[] = [];
    const byParty = new Map<number, Ambush>();
    const deathsBy = new Map<string, number>();
    w.game.world.onEvents((events) => {
      notePurposes();
      for (const e of events) {
        if (e.type === 'AmbushSprung') {
          const party = Number(e['partyId']);
          const p = ent.get(party, C.Party);
          if (!p || byParty.has(party)) continue;
          const members = p.members.map((m) => ent.get(m, C.Position)).filter((q) => q !== undefined).map((q) => spotOf(q.x, q.y, q.z));
          // The fortress creature nearest any member: most likely the one that spotted it.
          let best = '';
          let bestD = Infinity;
          for (const id of ent.with(C.Creature)) {
            if (!ent.alive(id) || ent.get(id, C.Creature)?.faction !== 'fortress') continue;
            const q = ent.get(id, C.Position);
            if (!q) continue;
            for (const m of p.members) {
              const mq = ent.get(m, C.Position);
              if (!mq || mq.z !== q.z) continue;
              const dd = Math.max(Math.abs(mq.x - q.x), Math.abs(mq.y - q.y));
              if (dd < bestD) { bestD = dd; const s = spotOf(q.x, q.y, q.z); best = `${speciesName(ent.get(id, C.Creature)?.species)}/${roleOf(id)} ${dd} away, ${s.d} from gate z${s.z}${s.out ? '' : ' in'}`; }
            }
          }
          const outdoors = ent.with(C.Labors).filter((id) => { const q = ent.get(id, C.Position); return ent.alive(id) && q !== undefined && w.map.hasFlag(w.index(q.x, q.y, q.z), TileFlag.Outdoor); }).length;
          const a: Ambush = { party, day: Math.floor(w.tick / TICKS_PER_DAY) + 1, size: p.size, sprungAt: w.tick, members, spotter: best, outdoors, victims: [], fell: 0 };
          ambushes.push(a);
          byParty.set(party, a);
        } else if (e.type === 'AttackResolved' && Number(e['amount'] ?? 0) > 0) {
          const by = purposeOf.get(Number(e['attackerId']));
          const a = by === undefined ? undefined : byParty.get(by.party);
          const id = Number(e['defenderId']);
          if (a === undefined || a.victims.some((v) => v.id === id) || ent.get(id, C.Creature)?.faction !== 'fortress') continue;
          const q = ent.get(id, C.Position);
          if (!q) continue;
          a.victims.push({ id, species: speciesName(ent.get(id, C.Creature)?.species), role: roleOf(id), hit: { ...spotOf(q.x, q.y, q.z), dt: w.tick - a.sprungAt, doing: doing(id) } });
        } else if (e.type === 'CreatureDied') {
          const id = Number(e['id']);
          const by = purposeOf.get(id);
          if (by !== undefined) { const a = byParty.get(by.party); if (a) a.fell += 1; continue; }
          for (const a of ambushes) {
            const v = a.victims.find((x) => x.id === id);
            if (v) v.end = { ...spotTile(Number(e['tile'] ?? -1)), dt: w.tick - a.sprungAt, cause: String(e['cause']) };
          }
          if (e['species'] === dwarf && e['faction'] === 'fortress') {
            const k = purposeOf.get(Number(e['killerId'] ?? 0));
            const key = k !== undefined ? k.purpose : Number(e['killerId'] ?? 0) !== 0 ? `other:${String(e['cause'])}` : `none:${String(e['cause'])}`;
            deathsBy.set(key, (deathsBy.get(key) ?? 0) + 1);
          }
        }
      }
      for (const a of ambushes) if (a.ended === undefined && ent.get(a.party, C.Party)?.state === 'gone') a.ended = Math.floor(w.tick / TICKS_PER_DAY) + 1;
    });
    const loop = (until: number, step: number): void => {
      while (w.tick < until) {
        playThreeYears(w, state, Math.min(step, until - w.tick));
        checkFortressWorkOrders(w, state);
        checkFortressRooms(w, state);
        checkFortressCaveFarm(w, state);
        checkFortressDefense(w, state);
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
    const sp = (s: Spot): string => `${s.d}${s.z !== 0 ? `z${s.z}` : ''}${s.out ? '' : 'in'}`;
    const out = [`[t593] ${seed} shift ${SHIFT} day ${DAYS} living ${living} ambushes ${ambushes.length} dwarf deaths by killer's party ${JSON.stringify(Object.fromEntries(deathsBy))}`];
    for (const a of ambushes) {
      out.push(`  day ${a.day}-${a.ended ?? '?'} size ${a.size} fell ${a.fell} outdoors ${a.outdoors} members at [${a.members.map(sp).join(' ')}] nearest ${a.spotter}`);
      for (const v of a.victims) {
        out.push(`    ${v.species}/${v.role} hit +${v.hit.dt} at ${sp(v.hit)} ${v.hit.doing}${v.end ? ` -> ${v.end.cause} +${v.end.dt} at ${sp(v.end)}` : ' -> lived'}`);
      }
    }
    log(out.join('\n'));
    expect(w.tick).toBe(DAYS * TICKS_PER_DAY);
  }, 7_200_000);
});
