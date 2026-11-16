/**
 * T-574's probe: one three-year seed at one shift, played as the sweep plays it, with the raid
 * window traced (alert, gate and second line, the squad, where every dwarf is, each death).
 * Runs with `T574_PROBE=1`; `PROBE_SEED`, `THREE_YEARS_SHIFT`, `PROBE_FROM_DAY`, `PROBE_TO_DAY`, `PROBE_OUT`. Not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
import type { DwarvesReader } from '@systems/dwarves';
import type { ThreatsReader } from '@systems/threats/reader';
import { saveGame } from '@app/game-save';
import { setReplacer } from './t574_save';
import { watchInvariants } from '../scenarios/invariants';
import { PartyWatch } from '../scenarios/party-watch';
import { CrowdWatch } from '../scenarios/crowd-watch';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  gateWallTiles,
  innerDoorTiles,
  playThreeYears,
  setupThreeYearsFortress,
  threeYearsWorld,
} from '../scenarios/three_years_fortress';

const SEED = process.env['PROBE_SEED'] ?? 'three-years-p4-1';
const PERIL = Number(/-p(\d)-/.exec(SEED)?.[1] ?? '4');
const SHIFT = Number(process.env['THREE_YEARS_SHIFT'] ?? '0');
const FROM_DAY = Number(process.env['PROBE_FROM_DAY'] ?? '295');
const TO_DAY = Number(process.env['PROBE_TO_DAY'] ?? '301');
const OUT = process.env['PROBE_OUT'] ?? '.vite/t574/probe.jsonl';
const SAVE_AT = Number(process.env['PROBE_SAVE_AT'] ?? '0');
const SAMPLE_EVERY = Number(process.env['PROBE_EVERY'] ?? '100');

describe('T-574 probe: a raid traced', () => {
  it.runIf(process.env['T574_PROBE'] === '1')(`plays ${SEED} at shift ${SHIFT} and traces days ${FROM_DAY} to ${TO_DAY}`, async () => {
    const lines: string[] = [];
    const out = (o: unknown): void => { lines.push(JSON.stringify(o)); };
    const w = threeYearsWorld(SEED, PERIL);
    const stop = watchInvariants(w.game, () => {});
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const boot = 20 * TICKS_PER_DAY;
    while (w.tick < boot) {
      playThreeYears(w, state, Math.min(100, boot - w.tick));
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    const ent = w.game.world.entities;
    const buildings = w.readers.of<BuildingsReader>('14');
    const combat = w.readers.of<CombatReader>('16');
    const dwarves = w.readers.of<DwarvesReader>('10');
    const threats = w.readers.of<ThreatsReader>('18');
    const species = (id: number): string =>
      w.game.registry.table<{ id: string }>('creatures').byIndex(ent.get(id, C.Creature)?.species ?? -1)?.id ?? '?';
    const lastPos = new Map<number, { x: number; y: number; z: number }>();
    const fortress = (): number[] => ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress');
    const day = (): number => Math.floor(w.tick / TICKS_PER_DAY) + 1;
    const tracing = (): boolean => day() >= FROM_DAY && day() <= TO_DAY;
    const squadMembers = (): number[] => combat.squads().find((s) => s.id === state.squadId)?.members ?? [];
    const insideLabel = (): number => w.readers.pathing.labelOf(w.index(state.cx + 6, state.cy + 8, state.hallZ), 'walker');
    const hallLabel = (): number => w.readers.pathing.labelOf(w.index(state.cx + 6, state.cy + 6, state.hallZ), 'walker');
    const where = (p: { x: number; y: number; z: number }): string => {
      const label = w.readers.pathing.labelOf(w.index(p.x, p.y, p.z), 'walker');
      if (p.z >= state.z) return 'surface';
      if (label === insideLabel()) return 'inside';
      if (label === hallLabel()) return 'hall-unlined';
      return `below:${p.z}`;
    };
    const unsub = w.game.world.onEvents((events) => {
      for (const e of events) {
        if (e.type === 'ThreatWarning' || e.type === 'RaidArrived' || e.type === 'AmbushSprung' || e.type === 'RaidEnded') {
          if (day() >= FROM_DAY - 3 && day() <= TO_DAY) out({ tick: w.tick, day: day(), event: e.type, ...e, renown: threats.renown() });
        } else if (e.type === 'CreatureDied' && tracing()) {
          const id = Number(e['id']);
          const p = lastPos.get(id);
          const killer = Number(e['killerId'] ?? 0);
          const kp = ent.get(killer, C.Position);
          out({ tick: w.tick, day: day(), event: 'died', id, species: e['species'] === undefined ? '' : species(id), faction: e['faction'], cause: e['cause'],
            pos: p, where: p ? where(p) : '', soldier: squadMembers().includes(id) || (state as { lastSquad?: number[] }).lastSquad?.includes(id) === true,
            killer: killer ? species(killer) : '', killerPos: kp ? { x: kp.x, y: kp.y, z: kp.z } : undefined });
        }
      }
    });
    const partyWatch = new PartyWatch(w);
    const crowdWatch = new CrowdWatch(w);
    void partyWatch;
    let lastSample = -1;
    let mapDumped = false;
    const MAP_AT = Number(process.env['PROBE_MAP_AT'] ?? '355300');
    const sample = (): void => {
      if (!tracing()) return;
      for (const id of ent.with(C.Position)) {
        const p = ent.get(id, C.Position);
        if (p && ent.get(id, C.Creature) !== undefined) lastPos.set(id, { x: p.x, y: p.y, z: p.z });
      }
      (state as { lastSquad?: number[] }).lastSquad = [...squadMembers()];
      if (w.tick - lastSample < SAMPLE_EVERY) return;
      lastSample = w.tick;
      const door = (id: number): string => (id === 0 ? 'none' : `${buildings.get(id)?.state ?? 'gone'}/${buildings.mechanismState(id)}`);
      const parties = ent.with(C.Party).map((pid) => ({ pid, p: ent.get(pid, C.Party)! }))
        .filter(({ p }) => p.purpose !== 'caravan' && p.state !== 'gone')
        .map(({ pid, p }) => {
          const alive = p.members.filter((m) => ent.alive(m));
          const pos = alive.map((m) => ent.get(m, C.Position)).filter((q) => q !== undefined);
          const byWhere: Record<string, number> = {};
          for (const q of pos) byWhere[where(q)] = (byWhere[where(q)] ?? 0) + 1;
          return { pid, purpose: p.purpose, state: p.state, size: p.size, alive: alive.length, morale: p.morale, byWhere,
            species: [...new Set(alive.map(species))].join(','), sample: pos.slice(0, 4).map((q) => `${q.x},${q.y},${q.z}`) };
        });
      const squad = squadMembers().map((id) => {
        const p = ent.get(id, C.Position);
        return { id, at: p ? `${p.x},${p.y},${p.z}` : '', where: p ? where(p) : '', weapon: combat.weaponOf(id) !== 0, doing: dwarves.activityText(id) };
      });
      const civ: Record<string, number> = {};
      const outside: string[] = [];
      for (const id of fortress()) {
        if (squadMembers().includes(id)) continue;
        const p = ent.get(id, C.Position);
        if (!p) continue;
        const k = where(p);
        civ[k] = (civ[k] ?? 0) + 1;
        const br = ent.get(id, C.Brain);
        const tt = br?.targetTile ?? -1;
        const goal = tt >= 0 ? `${w.map.xOf(tt)},${w.map.yOf(tt)},${w.map.zOf(tt)}` : '-';
        if (k !== 'inside') outside.push(`${id}@${p.x},${p.y},${p.z}:${dwarves.activityText(id)}:${br?.behavior ?? ''}->${goal}`);
      }
      if (!mapDumped && w.tick >= MAP_AT) {
        mapDumped = true;
        const hall = new Set(buildings.hearthHallTiles());
        const hz = [...hall].map((t) => w.map.zOf(t));
        out({ hearthHall: { n: hall.size, zs: [...new Set(hz)] }, cx: state.cx, cy: state.cy, z: state.z, hallZ: state.hallZ });
        for (const z of [state.z + 1, state.z, state.z - 1, state.z - 2]) {
          const rows: string[] = [];
          for (let y = 0; y < 24; y += 1) {
            let row = '';
            for (let x = 0; x < 48; x += 1) {
              const t = w.index(x, y, z);
              const b = buildings.get(buildings.at(t));
              const kind = w.map.kindAt(t);
              let c = '?';
              if (hall.has(t)) c = 'H';
              else if (b && buildings.doorAt(t)) c = 'D';
              else if (b && b.state === 'built' && !w.readers.pathing.passable(t, 'walker')) c = 'W';
              else if (b) c = 'b';
              else if (kind === TileKind.Wall) c = '#';
              else if (kind === TileKind.Floor) c = w.map.hasFlag(t, TileFlag.Outdoor) ? '.' : ',';
              else if (kind === TileKind.Open) c = ' ';
              else if (kind === TileKind.Tree) c = 'T';
              else c = String(kind).slice(0, 1);
              if (w.map.fluidLevelAt(t) > 0) c = '~';
              row += c;
            }
            rows.push(row);
          }
          out({ mapZ: z, rows });
        }
      }
      const walls = gateWallTiles(w, state).map((t) => buildings.get(buildings.at(t))?.state ?? 'none');
      out({
        tick: w.tick, day: day(), hour: Math.floor((w.tick % TICKS_PER_DAY) / (TICKS_PER_DAY / 24)), alert: w.game.world.fortress.alert,
        renown: Math.round(threats.renown() * 10) / 10, pop: fortress().length,
        mustered: state.mustered, answered: state.answered, warnedUntil: state.warnedUntil, shutOut: state.shutOut,
        gate: [door(state.gateDoorId), door(state.gateDoorId2)], walls: walls.join(','),
        inner: (state.innerDoorIds ?? []).map(door), innerTiles: innerDoorTiles(w, state).length,
        parties, squad, civ, outside: outside.slice(0, 40),
      });
    };
    const end = SAVE_AT > 0 ? SAVE_AT : TO_DAY * TICKS_PER_DAY;
    while (w.tick < end) {
      playThreeYears(w, state, Math.min(300, end - w.tick), () => { crowdWatch.sample(); sample(); });
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    unsub();
    stop();
    if (SAVE_AT > 0) {
      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(`${dirname(OUT)}/save-${SAVE_AT}.bin`, await saveGame(w.game, { kind: 'manual' }));
      writeFileSync(`${dirname(OUT)}/state-${SAVE_AT}.json`, JSON.stringify({ state, arrival: w.game.arrival }, setReplacer));
      out({ saved: SAVE_AT, hash: w.hash() });
    }
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, lines.join('\n') + '\n');
    console.log(`[t574_probe] ${SEED} shift ${SHIFT}: ${lines.length} lines to ${OUT}`);
    expect(lines.length).toBeGreaterThan(0);
  });
});
