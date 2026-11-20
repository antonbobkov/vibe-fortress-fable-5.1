/**
 * T-653's probe of an ambush that springs as the alert comes down: plays a three-year seed
 * (`PROBE_SEED`, default `three-years-p4-1`) at `THREE_YEARS_SHIFT` (default 100) as the sweep plays
 * it to tick `PROBE_AT` (saved under `.vite/t653/` and loaded from there on a second run), then
 * traces it to tick `PROBE_TO`, every `PROBE_EVERY` ticks: the alert and the gate's doors, every
 * threat party on the map (state, hidden members, where they stand against the gate stair), the war
 * dogs and the watchmen at their posts, and the dwarves on the surface; and the events between (the
 * alerts, the springs and who stood nearest, the deaths). Local diagnosis only (set `T653_PROBE=1`);
 * not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag } from '@core/map3d';
import { loadGame, saveGame } from '@app/game-save';
import type { AnimalsReader } from '@systems/animals/reader';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { FluidsReader } from '@systems/fluids/reader';
import type { CombatReader } from '@systems/combat/reader';
import type { DwarvesReader } from '@systems/dwarves';
import type { JobsReader } from '@systems/jobs';
import { watchInvariants } from '../scenarios/invariants';
import { CrowdWatch } from '../scenarios/crowd-watch';
import { threeYearsMeasurements } from '../scenarios/three_years_measurements';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  playThreeYears,
  setupThreeYearsFortress,
  threeYearsWorld,
  type FortressState,
} from '../scenarios/three_years_fortress';
import { setReplacer, setReviver } from './t574_save';

const SEED = process.env['PROBE_SEED'] ?? 'three-years-p4-1';
const PERIL = Number(/-p(\d)-/.exec(SEED)?.[1] ?? '4');
const SHIFT = Number(process.env['THREE_YEARS_SHIFT'] ?? '100');
const AT = Number(process.env['PROBE_AT'] ?? '352000');
const TO = Number(process.env['PROBE_TO'] ?? String(AT + 3 * TICKS_PER_DAY));
const EVERY = Number(process.env['PROBE_EVERY'] ?? '40');
const DIR = '.vite/t653';
const SAVE = `${DIR}/${SEED}-${SHIFT}-${AT}`;

describe('T-653 probe: an ambush at the all-clear', () => {
  it.runIf(process.env['T653_PROBE'] === '1')(`${SEED} shift ${SHIFT} from ${AT} to ${TO}`, async () => {
    let w = threeYearsWorld(SEED, PERIL);
    let state: FortressState;
    if (existsSync(`${SAVE}.bin`)) {
      const loaded = (await loadGame(new Uint8Array(readFileSync(`${SAVE}.bin`)), { registry: w.game.registry })).game;
      w.replaceGame(loaded);
      threeYearsMeasurements(w).connect();
      const saved = JSON.parse(readFileSync(`${SAVE}.json`, 'utf8'), setReviver) as { state: FortressState; arrival: unknown };
      (loaded as unknown as { arrival: unknown }).arrival = saved.arrival;
      state = saved.state;
      state.eventsRead = 0;
    } else {
      const stop = watchInvariants(w.game, () => {});
      if (SHIFT > 0) w.step(SHIFT);
      state = setupThreeYearsFortress(w);
      const boot = 20 * TICKS_PER_DAY;
      while (w.tick < boot) {
        playThreeYears(w, state, Math.min(100, boot - w.tick));
        checkFortressWorkOrders(w, state);
        checkFortressRooms(w, state);
        checkFortressCaveFarm(w, state);
        checkFortressDefense(w, state);
      }
      const crowd = new CrowdWatch(w);
      while (w.tick < AT) {
        playThreeYears(w, state, Math.min(300, AT - w.tick), () => crowd.sample());
        checkFortressWorkOrders(w, state);
        checkFortressRooms(w, state);
        checkFortressCaveFarm(w, state);
        checkFortressDefense(w, state);
      }
      stop();
      mkdirSync(DIR, { recursive: true });
      writeFileSync(`${SAVE}.bin`, await saveGame(w.game, { kind: 'manual' }));
      writeFileSync(`${SAVE}.json`, JSON.stringify({ state, arrival: w.game.arrival }, setReplacer));
      // Played on from its own save, as every later run is.
      const fresh = threeYearsWorld(SEED, PERIL);
      const loaded = (await loadGame(new Uint8Array(readFileSync(`${SAVE}.bin`)), { registry: fresh.game.registry })).game;
      fresh.replaceGame(loaded);
      threeYearsMeasurements(fresh).connect();
      const saved = JSON.parse(readFileSync(`${SAVE}.json`, 'utf8'), setReviver) as { state: FortressState; arrival: unknown };
      (loaded as unknown as { arrival: unknown }).arrival = saved.arrival;
      state = saved.state;
      state.eventsRead = 0;
      w = fresh;
    }
    const ent = w.game.world.entities;
    const buildings = w.readers.of<BuildingsReader>('14');
    const combat = w.readers.of<CombatReader>('16');
    const animals = w.readers.of<AnimalsReader>('08');
    const dwarvesR = w.readers.of<DwarvesReader>('10');
    const jobs = w.readers.of<JobsReader>('11');
    const targets = new Set<number>();
    const doing = (id: number): string => {
      const b = ent.get(id, C.Brain);
      const jid = ent.get(id, C.Worker)?.jobId ?? 0;
      const job = jid !== 0 ? jobs.typeOf(jid) : '';
      const sq = ent.get(id, C.Soldier);
      if (b && b.behavior === 'need' && b.targetTile >= 0) targets.add(b.targetTile);
      const tt = b && b.behavior === 'need' && b.targetTile >= 0 ? `(${b.activity}>${rel({ x: w.map.xOf(b.targetTile), y: w.map.yOf(b.targetTile), z: w.map.zOf(b.targetTile) })})` : '';
      return `${b?.behavior ?? '?'}${tt}${job ? `/${job}` : ''}${sq && sq.squadId !== 0 ? `[sq${sq.squadId}]` : ''}${dwarvesR.isUnsheltered(id) ? '!u' : ''}`;
    };
    const gate = { x: state.cx + 6, y: state.cy + 6, z: state.z };
    const species = (id: number): string =>
      w.game.registry.table<{ id: string }>('creatures').byIndex(ent.get(id, C.Creature)?.species ?? -1)?.id ?? '?';
    const rel = (q: { x: number; y: number; z: number }): string =>
      `${q.x - gate.x},${q.y - gate.y},${q.z - gate.z}${w.map.hasFlag(w.index(q.x, q.y, q.z), TileFlag.Outdoor) ? 'o' : ''}`;
    const fortress = (): number[] => ent.with(C.Labors).filter((id) => ent.alive(id) && ent.get(id, C.Creature)?.faction === 'fortress');
    const lines: string[] = [];
    const out = (s: string): void => { lines.push(`t${w.tick} d${Math.floor(w.tick / TICKS_PER_DAY) + 1} ${s}`); };
    const nearest = (pos: { x: number; y: number; z: number }): string => {
      let best = '';
      let bd = 99;
      for (const id of ent.with(C.Position)) {
        if (ent.get(id, C.Creature)?.faction !== 'fortress' || !ent.alive(id)) continue;
        const q = ent.get(id, C.Position)!;
        if (Math.abs(q.z - pos.z) > 1) continue;
        const d = Math.max(Math.abs(q.x - pos.x), Math.abs(q.y - pos.y));
        if (d < bd) { bd = d; best = `${species(id)} ${id}@${rel(q)} d${d}`; }
      }
      return best;
    };
    w.game.world.onEvents((events) => {
      for (const e of events) {
        if (e.type === 'AlertChanged' || e.type === 'RaidArrived' || e.type === 'RaidEnded' || e.type === 'FortressShutOut') out(`${e.type} ${JSON.stringify(e)}`);
        else if (e.type === 'AmbushSprung') {
          const p = ent.get(Number(e['partyId']), C.Party);
          const lead = p ? ent.get(p.leaderId, C.Position) : undefined;
          out(`AmbushSprung party ${String(e['partyId'])} leader@${lead ? rel(lead) : '-'} nearest ${lead ? nearest(lead) : '-'}`);
        } else if (e.type === 'HostileSpawned') {
          const p = ent.get(Number(e['partyId']), C.Party);
          if (p?.members[0] === Number(e['id'])) out(`party ${String(e['partyId'])} ${p.purpose} arrives (size ${p.size})`);
        } else if (e.type === 'BuildingStateChanged' && [state.gateDoorId, state.gateDoorId2].includes(Number(e['id']))) {
          out(`gate door ${String(e['id'])} ${String(e['state'])} surface ${fortress().filter((id) => (ent.get(id, C.Position)?.z ?? -1) >= state.z).length}`);
        } else if (e.type === 'CreatureDied' && (e['faction'] === 'fortress' || species(Number(e['id'])) === 'dog')) {
          out(`DIED ${species(Number(e['id']))} ${String(e['id'])} ${String(e['cause'])} by ${Number(e['killerId'] ?? 0) ? species(Number(e['killerId'])) : '-'}`);
        }
      }
    });
    const dogSpecies = w.game.registry.table('creatures').index('dog');
    let last = -1;
    const trace = (): void => {
      if (w.tick - last < EVERY) return;
      last = w.tick;
      const door = (id: number): string => (id === 0 ? 'none' : `${buildings.get(id)?.state ?? 'gone'}/${buildings.mechanismState(id)}`);
      const parties = ent.with(C.Party).map((pid) => ({ pid, p: ent.get(pid, C.Party)! }))
        .filter(({ p }) => p.purpose !== 'caravan' && p.state !== 'gone')
        .map(({ pid, p }) => {
          const alive = p.members.filter((m) => ent.alive(m));
          const hidden = alive.filter((m) => ent.get(m, C.Hostile)?.stealthed === true).length;
          const pos = alive.map((m) => ent.get(m, C.Position)).filter((q) => q !== undefined).slice(0, 3).map(rel);
          const g = p.goalTile;
          return `${pid}:${p.purpose}/${p.state} ${alive.length}${hidden ? ` (${hidden} hidden)` : ''} goal ${rel({ x: w.map.xOf(g), y: w.map.yOf(g), z: w.map.zOf(g) })} at ${pos.join(' ')}`;
        });
      const dogs = animals.tameList().filter((id) => ent.get(id, C.Creature)?.species === dogSpecies)
        .map((id) => { const q = ent.get(id, C.Position); return `${id}${ent.get(id, C.Tame)?.trained === 'war' ? 'w' : ''}@${q ? rel(q) : '-'}>${animals.assignedTo(id)}`; });
      const watch = (state.watch ?? []).map((wt) => {
        const m = combat.squads().find((sq) => sq.id === wt.squadId)?.members ?? [];
        return `${wt.squadId}[${m.map((id) => { const q = ent.get(id, C.Position); return `${id}@${q ? rel(q) : '-'}`; }).join(',')}]`;
      });
      const surface = fortress().filter((id) => (ent.get(id, C.Position)?.z ?? -1) >= state.z);
      out(`alert ${w.game.world.fortress.alert} gate ${door(state.gateDoorId)} ${door(state.gateDoorId2)} answered '${state.answered}' surface ${surface.length} ` +
        `[${surface.slice(0, 14).map((id) => `${rel(ent.get(id, C.Position)!)}:${doing(id)}`).join(' ')}] dogs ${dogs.join(' ')} watch ${watch.join(' ')} | ${parties.join(' | ')}`);
    };
    while (w.tick < TO) {
      playThreeYears(w, state, Math.min(300, TO - w.tick), trace);
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    const itemsR = w.readers.of<ItemsReader>('13');
    const fluids = w.readers.of<FluidsReader>('04');
    for (const t of targets) {
      const its = itemsR.at(t).map((id) => { const it = itemsR.get(id) as unknown as Record<string, unknown> | undefined; return `${String(it?.['type'] ?? it?.['itemType'] ?? '?')}`; });
      out(`target ${rel({ x: w.map.xOf(t), y: w.map.yOf(t), z: w.map.zOf(t) })} kind ${w.map.kindAt(t)} fluid ${fluids.levelAt(t)} building ${buildings.at(t)} ${buildings.get(buildings.at(t))?.type ?? ''} items ${its.join(',')}`);
    }
    mkdirSync(DIR, { recursive: true });
    writeFileSync(`${SAVE}-trace.txt`, lines.join('\n') + '\n');
    console.log(`[t653] ${SEED} shift ${SHIFT} ${AT}..${TO}: living ${fortress().length}; trace in ${SAVE}-trace.txt`);
    expect(w.tick).toBe(TO);
  }, 7_200_000);
});
