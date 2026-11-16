/**
 * T-575's replay: T-574's save of `three-years-p4-1` (shift 0) at tick 355,200, the hour the day-297
 * ambush arrives, played on with the sweep's loop and traced every `REPLAY_EVERY` ticks: the alert,
 * the gate, the squad and the party, where the dwarves are, and every death. Make the save with
 * `T574_PROBE=1 PROBE_SAVE_AT=355200` (`t574_raid_probe.test.ts`). Local diagnosis only; not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { loadGame } from '@app/game-save';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
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

const SEED = process.env['PROBE_SEED'] ?? 'three-years-p4-1';
const PERIL = Number(/-p(\d)-/.exec(SEED)?.[1] ?? '4');
const AT = Number(process.env['PROBE_SAVE_AT'] ?? '355200');
const TO = Number(process.env['REPLAY_TO'] ?? String(AT + 3 * TICKS_PER_DAY));
const EVERY = Number(process.env['REPLAY_EVERY'] ?? '100');
const DIR = '.vite/t574';

describe('T-575 replay', () => {
  it.runIf(existsSync(`${DIR}/save-${AT}.bin`))(`plays ${SEED} on from tick ${AT}, traced`, async () => {
    const w = threeYearsWorld(SEED, PERIL);
    const loaded = (await loadGame(new Uint8Array(readFileSync(`${DIR}/save-${AT}.bin`)), { registry: w.game.registry })).game;
    w.replaceGame(loaded);
    threeYearsMeasurements(w).connect();
    const saved = JSON.parse(readFileSync(`${DIR}/state-${AT}.json`, 'utf8'), setReviver) as { state: FortressState; arrival: unknown };
    (loaded as unknown as { arrival: unknown }).arrival = saved.arrival;
    const state = saved.state;
    state.eventsRead = 0;
    const ent = w.game.world.entities;
    const buildings = w.readers.of<BuildingsReader>('14');
    const combat = w.readers.of<CombatReader>('16');
    const species = (id: number): string =>
      w.game.registry.table<{ id: string }>('creatures').byIndex(ent.get(id, C.Creature)?.species ?? -1)?.id ?? '?';
    const lines: string[] = [];
    const out = (o: unknown): void => { lines.push(JSON.stringify(o)); };
    let deaths = 0;
    let soldiersDead = 0;
    let gloamDead = 0;
    const squadMembers = (): number[] => combat.squads().find((s) => s.id === state.squadId)?.members ?? [];
    let lastSquad: number[] = [];
    w.game.world.onEvents((events) => {
      for (const e of events) {
        if (e.type === 'AmbushSprung' || e.type === 'RaidEnded' || e.type === 'FortressShutOut' || e.type === 'HostileFled') out({ t: w.tick, event: e.type, ...e });
        else if (e.type === 'BuildingStateChanged' && [state.gateDoorId, state.gateDoorId2].includes(Number(e['id'] ?? e['buildingId']))) {
          out({ t: w.tick, event: 'gate', ...e, outdoors: ent.with(C.Labors).filter((id) => (ent.get(id, C.Position)?.z ?? -1) >= state.z).length });
        } else if (e.type === 'CreatureDied') {
          const id = Number(e['id']);
          const killer = Number(e['killerId'] ?? 0);
          if (e['faction'] === 'fortress') {
            deaths += 1;
            if (lastSquad.includes(id)) soldiersDead += 1;
          } else gloamDead += 1;
          out({ t: w.tick, event: 'died', id, faction: e['faction'], cause: e['cause'], soldier: lastSquad.includes(id), killer: killer ? species(killer) : '' });
        }
      }
    });
    let last = -1;
    const trace = (): void => {
      lastSquad = [...squadMembers()];
      if (w.tick - last < EVERY) return;
      last = w.tick;
      const parties = ent.with(C.Party).map((pid) => ent.get(pid, C.Party)!)
        .filter((p) => p.purpose !== 'caravan' && p.state !== 'gone')
        .map((p) => {
          const alive = p.members.filter((m) => ent.alive(m));
          return { purpose: p.purpose, state: p.state, alive: alive.length, morale: p.morale,
            at: alive.slice(0, 3).map((m) => { const q = ent.get(m, C.Position); return q ? `${q.x},${q.y},${q.z}` : ''; }) };
        });
      const squad = squadMembers().map((id) => {
        const p = ent.get(id, C.Position);
        return `${p ? `${p.x},${p.y},${p.z}` : '-'}${combat.weaponOf(id) !== 0 ? '' : ':unarmed'}${combat.targetOf(id) !== 0 ? ':fighting' : ''}`;
      });
      const outdoors = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress' && !squadMembers().includes(id) &&
        (ent.get(id, C.Position)?.z ?? -1) >= state.z).length;
      const door = (id: number): string => (id === 0 ? 'none' : `${buildings.get(id)?.state ?? 'gone'}/${buildings.mechanismState(id)}`);
      out({ t: w.tick, alert: w.game.world.fortress.alert, answered: state.answered, gate: [door(state.gateDoorId), door(state.gateDoorId2)],
        outdoors, squad, parties });
    };
    while (w.tick < TO) {
      playThreeYears(w, state, Math.min(300, TO - w.tick), trace);
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    const living = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length;
    writeFileSync(`${DIR}/t575-replay.jsonl`, lines.join('\n') + '\n');
    console.log(`[t575_replay] ${SEED} from ${AT} to ${TO}: fortress deaths ${deaths} (soldiers ${soldiersDead}), others dead ${gloamDead}, living ${living}`);
    expect(living).toBeGreaterThanOrEqual(0);
  });
});
