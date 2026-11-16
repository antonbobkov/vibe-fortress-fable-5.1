/**
 * T-574's replay: a game saved by `t574_raid_probe.test.ts` (`PROBE_SAVE_AT`) with the script's
 * state, played on from there with the sweep's loop and traced. Local diagnosis only; not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { loadGame } from '@app/game-save';
import type { DwarvesReader } from '@systems/dwarves';
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
const WATCH = (process.env['REPLAY_WATCH'] ?? '').split(',').filter(Boolean).map(Number);
const DIR = '.vite/t574';

describe('T-574 replay', () => {
  it.runIf(existsSync(`${DIR}/save-${AT}.bin`))(`plays ${SEED} on from tick ${AT}`, async () => {
    const w = threeYearsWorld(SEED, PERIL);
    const loaded = (await loadGame(new Uint8Array(readFileSync(`${DIR}/save-${AT}.bin`)), { registry: w.game.registry })).game;
    w.replaceGame(loaded);
    threeYearsMeasurements(w).connect();
    const saved = JSON.parse(readFileSync(`${DIR}/state-${AT}.json`, 'utf8'), setReviver) as { state: FortressState; arrival: unknown };
    (loaded as unknown as { arrival: unknown }).arrival = saved.arrival;
    const state = saved.state;
    state.eventsRead = 0;
    const ent = w.game.world.entities;
    const dwarves = w.readers.of<DwarvesReader>('10');
    const lines: string[] = [];
    let deaths = 0;
    w.game.world.onEvents((events) => {
      for (const e of events) {
        if (e.type === 'CreatureDied' && e['faction'] === 'fortress') deaths += 1;
      }
    });
    const watch = (): void => {
      for (const id of WATCH) {
        const p = ent.get(id, C.Position);
        const m = ent.get(id, C.Motion);
        const b = ent.get(id, C.Brain);
        if (!p) continue;
        const tt = b?.targetTile ?? -1;
        const path = m && m.pathId !== 0 ? w.pathing.pathfinder.path(m.pathId) : null;
        const nxt = path?.[m!.stepIndex];
        lines.push(JSON.stringify({ t: w.tick, id, at: `${p.x},${p.y},${p.z}`, act: dwarves.activityText(id), beh: b?.behavior,
          goal: tt >= 0 ? `${w.map.xOf(tt)},${w.map.yOf(tt)},${w.map.zOf(tt)}` : '-', walk: w.movement.walkTarget(id),
          path: path?.length ?? 0, step: m?.stepIndex, next: nxt === undefined ? '' : `${w.map.xOf(nxt)},${w.map.yOf(nxt)},${w.map.zOf(nxt)}`,
          route: (path ?? []).map((t) => `${w.map.xOf(t)},${w.map.yOf(t)},${w.map.zOf(t)}`).join(' '),
          crowd: nxt === undefined ? 0 : w.movement.crowdPercentAt(nxt, 1), here: w.movement.crowdPercentAt(w.index(p.x, p.y, p.z)) }));
      }
    };
    while (w.tick < TO) {
      playThreeYears(w, state, Math.min(300, TO - w.tick), watch);
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    const living = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length;
    writeFileSync(`${DIR}/replay.jsonl`, lines.join('\n') + '\n');
    console.log(`[t574_replay] ${SEED} from ${AT} to ${TO}: fortress deaths ${deaths}, living ${living}`);
    expect(living).toBeGreaterThanOrEqual(0);
  });
});
