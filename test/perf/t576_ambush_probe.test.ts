/**
 * T-576's replay of T-575's ambush saves (`T575_SAVES`, saved the tick each ambush arrived): plays
 * each on for `REPLAY_DAYS` days with the sweep's loop, as `t575_ambush_probe` does, and prints one
 * row per save with the census row of its ambush and, for each dwarf it killed, where and when: the
 * ticks after the spring, the tiles from the gate stair, and whether the dwarf was in the squad.
 * Local diagnosis only; not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import { TICKS_PER_DAY } from '@core/constants';
import { loadGame } from '@app/game-save';
import { threeYearsMeasurements } from '../scenarios/three_years_measurements';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  playThreeYears,
  threeYearsWorld,
  type FortressState,
} from '../scenarios/three_years_fortress';
import { setReviver } from './t574_save';
import type { BuildingsReader } from '@systems/buildings';
import type { HealthReader } from '@systems/health';
import type { JobsReader } from '@systems/jobs';

const REPLAY_DAYS = Number(process.env['REPLAY_DAYS'] ?? '4');
const DIR = process.env['T575_SAVES'] ?? '.vite/t576/saves';
const OUT = process.env['T576_OUT'] ?? `${DIR}/../replay.txt`;
const ONLY = process.env['T576_ONLY'];
const TRACE = process.env['T576_TRACE'] === '1';
const peril = (seed: string): number => Number(/-p(\d)-/.exec(seed)?.[1] ?? '4');

describe('T-576 probe: sprung ambushes, where the dwarves die', () => {
  it.runIf(existsSync(DIR))('plays every saved ambush on', async () => {
    const names = readdirSync(DIR).filter((f) => f.endsWith('.bin')).map((f) => f.slice(0, -4)).filter((n) => ONLY === undefined || n.includes(ONLY)).sort();
    const rows: string[] = [];
    for (const name of names) {
      const saved = JSON.parse(readFileSync(`${DIR}/${name}.json`, 'utf8'), setReviver) as { seed: string; state: FortressState; arrival: unknown };
      const w = threeYearsWorld(saved.seed, peril(saved.seed));
      const loaded = (await loadGame(new Uint8Array(readFileSync(`${DIR}/${name}.bin`)), { registry: w.game.registry })).game;
      w.replaceGame(loaded);
      threeYearsMeasurements(w).connect();
      (loaded as unknown as { arrival: unknown }).arrival = saved.arrival;
      const state = saved.state;
      state.eventsRead = 0;
      state.ambushes = [];
      const lines: string[] = [];
      const log = console.log;
      console.log = (...a: unknown[]): void => { const s = a.map(String).join(' '); if (s.startsWith('[three_years_ambush]')) lines.push(s); };
      const from = w.tick;
      const to = w.tick + REPLAY_DAYS * TICKS_PER_DAY;
      const ent = w.game.world.entities;
      const gate = { x: state.cx + 6, y: state.cy + 6, z: state.z };
      let sprung = -1;
      let spotDist = -1;
      let alertAt = -1;
      let inside = -1;
      const atSpring = new Map<number, string>();
      let sampled = false;
      const outside: string[] = [];
      const deaths: string[] = [];
      let read = w.allEvents().length;
      const watch = (): void => {
        const ev = w.allEvents();
        for (let i = read; i < ev.length; i += 1) {
          const e = ev[i]!;
          if (e.type === 'AmbushSprung' && sprung < 0) {
            sprung = w.tick;
            const p = ent.get(Number(e['partyId']), C.Party);
            const dwarves = ent.with(C.Labors).filter((id) => ent.alive(id)).map((id) => ent.get(id, C.Position)).filter((q) => q !== undefined);
            let best = Infinity;
            for (const m of p?.members ?? []) {
              const mp = ent.get(m, C.Position);
              if (!mp) continue;
              for (const q of dwarves) if (Math.abs(q.z - mp.z) <= 1) best = Math.min(best, Math.max(Math.abs(q.x - mp.x), Math.abs(q.y - mp.y)));
            }
            spotDist = best;
            for (const did of ent.with(C.Labors)) {
              const q = ent.get(did, C.Position);
              if (!ent.alive(did) || !q) continue;
              let near = Infinity;
              for (const m of p?.members ?? []) {
                const mp = ent.get(m, C.Position);
                if (mp && Math.abs(q.z - mp.z) <= 1) near = Math.min(near, Math.max(Math.abs(q.x - mp.x), Math.abs(q.y - mp.y)));
              }
              if (w.map.hasFlag(w.index(q.x, q.y, q.z), TileFlag.Outdoor)) {
                const jid = ent.get(did, C.Worker)?.jobId ?? 0;
                const jt = jid !== 0 ? w.readers.of<JobsReader>('11').typeOf(jid) : null;
                outside.push(`${Math.max(Math.abs(q.x - gate.x), Math.abs(q.y - gate.y))}:${jt ?? ent.get(did, C.Brain)?.activity ?? '?'}:${ent.get(did, C.Brain)?.behavior ?? '?'}`);
              }
              atSpring.set(did, `${Math.max(Math.abs(q.x - gate.x), Math.abs(q.y - gate.y))}${q.z === gate.z ? '' : `z${q.z - gate.z}`}a${near === Infinity ? '-' : near}`);
            }
          } else if (e.type === 'AlertChanged' && e['to'] === 'hearth' && alertAt < 0 && sprung >= 0) {
            alertAt = w.tick;
          } else if (e.type === 'CreatureDied' && e['faction'] === 'fortress' && e['species'] === w.game.registry.table('creatures').index('dwarf')) {
            const t = Number(e['tile']);
            const x = w.map.xOf(t);
            const y = w.map.yOf(t);
            const z = w.map.zOf(t);
            const squad = state.stoodDown?.includes(Number(e['id'])) === true ? 'S' : '';
            const kp = ent.get(Number(e['killerId'] ?? 0), C.Position);
            const killer = kp ? `${String(e['cause'])}:k${Math.max(Math.abs(kp.x - gate.x), Math.abs(kp.y - gate.y))}z${kp.z - gate.z}` : `${String(e['cause'])}:k?`;
            const b = w.readers.of<BuildingsReader>('14');
            const locks = [state.gateDoorId, state.gateDoorId2, ...(state.innerDoorIds ?? [])].map((id) => (b.get(id) === undefined ? '-' : b.mechanismState(id) === 'locked' ? 'L' : 'o')).join('');
            deaths.push(`[${atSpring.get(Number(e['id'])) ?? '?'}]${sprung < 0 ? '?' : w.tick - sprung}t/${Math.max(Math.abs(x - gate.x), Math.abs(y - gate.y))}${z === gate.z ? '' : `z${z - gate.z}`}${squad}/${killer}/${locks}`);
          }
        }
        read = ev.length;
        if (sprung >= 0 && !sampled && w.tick - sprung >= 40) {
          sampled = true;
          for (const did of ent.with(C.Labors)) {
            if (!ent.alive(did) || !atSpring.has(did)) continue;
            const carry = ent.get(did, C.Worker)?.carrying ?? 0;
            const kind = carry !== 0 ? w.game.registry.table<{ id: string }>('items').byIndex(ent.get(carry, C.Item)?.type ?? -1)?.id ?? 'item' : '';
            atSpring.set(did, `${atSpring.get(did)}s${ent.get(did, C.Motion)?.speed ?? '?'}${kind ? `c:${kind}` : ''}:${ent.get(did, C.Brain)?.behavior ?? ''}`);
          }
        }
        if (TRACE && sprung >= 0) {
          const health = w.readers.of<HealthReader>('17');
          const jobs = w.readers.of<JobsReader>('11');
          const where = (e: number): string => {
            const it = ent.get(e, C.Item);
            const holder = it?.carriedBy ? it.carriedBy : it?.containerId ? it.containerId : e;
            const q = ent.get(holder, C.Position);
            return q ? `${q.x - gate.x},${q.y - gate.y},${q.z - gate.z}${it?.carriedBy ? 'c' : ''}` : '?';
          };
          for (const id of ent.with(C.Labors)) {
            if (!ent.alive(id) || !health.isWounded(id) || health.bloodPercent(id) >= 99) continue;
            const q = ent.get(id, C.Position);
            const js = jobs.list().filter((j) => j.target.ref === id && jobs.typeOf(j.id) !== null).map((j) => `${jobs.typeOf(j.id)}:${j.state}${j.blockedReason ? `(${j.blockedReason})` : ''}${j.workerId ? `w${j.workerId}@${where(j.workerId)}:${ent.get(j.workerId, C.Brain)?.behavior ?? ''}:${ent.get(j.workerId, C.Brain)?.activity ?? ''}:r${Math.round(ent.get(j.workerId, C.Needs)?.rest ?? -1)}h${Math.round(ent.get(j.workerId, C.Needs)?.hunger ?? -1)}t${Math.round(ent.get(j.workerId, C.Needs)?.thirst ?? -1)}>${(() => { const t = ent.get(j.workerId, C.Brain)?.targetTile ?? -1; return t < 0 ? '' : `${w.map.xOf(t) - gate.x},${w.map.yOf(t) - gate.y},${w.map.zOf(t) - gate.z}`; })()}` : ''}${j.state === 'fetching' ? `<${j.inputs.flatMap((i) => i.reserved).map((it) => where(it)).join(';')}` : ''}`);
            const own = jobs.forWorker(id);
            console.warn(`[trace] +${w.tick - sprung} d${id} blood ${health.bloodPercent(id)} ${health.isConscious(id) ? 'c' : 'U'} at ${q ? `${q.x - gate.x},${q.y - gate.y},${q.z - gate.z}` : '?'} ${health.summaryText(id)} jobs [${js.join(' ')}] own ${own ? jobs.typeOf(own.id) : '-'} alert ${w.game.world.fortress.alert}`);
          }
        }
        if (sprung >= 0 && inside < 0) {
          for (const pId of ent.with(C.Party)) {
            const p = ent.get(pId, C.Party);
            if (p?.purpose !== 'ambush') continue;
            if (p.members.some((m) => ent.alive(m) && (ent.get(m, C.Position)?.z ?? state.z) < state.z)) inside = w.tick - sprung;
          }
        }
      };
      try {
        while (w.tick < to && (state.ambushes.length > 0 || lines.length === 0)) {
          playThreeYears(w, state, Math.min(300, to - w.tick), watch);
          checkFortressWorkOrders(w, state);
          checkFortressRooms(w, state);
          checkFortressCaveFarm(w, state);
          checkFortressDefense(w, state);
          watch();
        }
      } finally {
        console.log = log;
      }
      const census = lines.map((l) => l.replace(/^\[three_years_ambush\] \S+ /, ''));
      const open = state.ambushes.map((c) => `[open] ${JSON.stringify(c)}`);
      rows.push(`${name} sprang+${sprung < 0 ? '-' : sprung - from} spot ${spotDist} alert+${alertAt < 0 ? '-' : alertAt - sprung} in+${inside} out[${outside.join(',')}] deaths [${deaths.join(' ')}] ${[...census, ...open].join(' | ')}`);
    }
    writeFileSync(OUT, rows.join('\n') + '\n');
    console.log(rows.join('\n'));
    expect(rows.length).toBe(names.length);
  }, 3_600_000);
});
