/**
 * T-575's probe of sprung ambushes. `T575_PROBE=save` plays `PROBE_SEED` at `THREE_YEARS_SHIFT` as the
 * sweep plays it and saves the game and the script's state the moment each ambush arrives, before it
 * springs (to `.vite/t575/saves`). `T575_PROBE=replay` plays every save there on for `REPLAY_DAYS`
 * days with the sweep's loop and prints one row per save: the census row of its ambush. Local
 * diagnosis only; not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { loadGame, saveGame } from '@app/game-save';
import { stepThreeYears, threeYearsMeasurements } from '../scenarios/three_years_measurements';
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
const SHIFT = Number(process.env['THREE_YEARS_SHIFT'] ?? '0');
const FROM_DAY = Number(process.env['PROBE_FROM_DAY'] ?? '1');
const TO_DAY = Number(process.env['PROBE_TO_DAY'] ?? '336');
const REPLAY_DAYS = Number(process.env['REPLAY_DAYS'] ?? '4');
const DIR = process.env['T575_SAVES'] ?? '.vite/t575/saves';
const peril = (seed: string): number => Number(/-p(\d)-/.exec(seed)?.[1] ?? '4');

describe('T-575 probe: sprung ambushes', () => {
  it.runIf(process.env['T575_PROBE'] === 'save')(`saves ${SEED} at shift ${SHIFT} as each ambush arrives`, async () => {
    mkdirSync(DIR, { recursive: true });
    const w = threeYearsWorld(SEED, peril(SEED));
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
    const saved = new Set<number>();
    const end = TO_DAY * TICKS_PER_DAY;
    let n = 0;
    while (w.tick < end) {
      // playThreeYears, with a look for a new ambush after every step.
      const chunk = w.tick + Math.min(300, end - w.tick);
      while (w.tick < chunk) {
        stepThreeYears(w, Math.min(20, chunk - w.tick));
        for (const pId of ent.with(C.Party)) {
          const p = ent.get(pId, C.Party);
          if (p?.purpose !== 'ambush' || p.state === 'gone' || saved.has(pId)) continue;
          saved.add(pId);
          if (w.tick < FROM_DAY * TICKS_PER_DAY) continue;
          const name = `${SEED}-s${SHIFT}-${w.tick}`;
          writeFileSync(`${DIR}/${name}.bin`, await saveGame(w.game, { kind: 'manual' }));
          writeFileSync(`${DIR}/${name}.json`, JSON.stringify({ seed: SEED, state, arrival: w.game.arrival, sprung: p.ambushSprung === true, size: p.size }, setReplacer));
          n += 1;
        }
        checkFortressDefense(w, state);
      }
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    console.log(`[t575_probe] ${SEED} shift ${SHIFT}: ${n} ambushes saved`);
    expect(n).toBeGreaterThanOrEqual(0);
  }, 3_600_000);

  it.runIf(process.env['T575_PROBE'] === 'replay' && existsSync(DIR))('plays every saved ambush on', async () => {
    const names = readdirSync(DIR).filter((f) => f.endsWith('.bin')).map((f) => f.slice(0, -4)).sort();
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
      const to = w.tick + REPLAY_DAYS * TICKS_PER_DAY;
      try {
        while (w.tick < to && (state.ambushes.length > 0 || lines.length === 0)) {
          playThreeYears(w, state, Math.min(300, to - w.tick));
          checkFortressWorkOrders(w, state);
          checkFortressRooms(w, state);
          checkFortressCaveFarm(w, state);
          checkFortressDefense(w, state);
        }
      } finally {
        console.log = log;
      }
      const open = state.ambushes.map((c) => `[open] ${JSON.stringify(c)}`);
      rows.push(`${name} ${[...lines.map((l) => l.replace(/^\[three_years_ambush\] \S+ /, '')), ...open].join(' | ')}`);
    }
    const out = `${DIR}/../replay-${process.env['T575'] ?? 'A'}${process.env['T575_HONEST'] === '1' ? '1' : '0'}-${DIR.split('/').pop() ?? ''}.txt`;
    writeFileSync(out, rows.join('\n') + '\n');
    console.log(rows.join('\n'));
    expect(rows.length).toBe(names.length);
  }, 3_600_000);
});
