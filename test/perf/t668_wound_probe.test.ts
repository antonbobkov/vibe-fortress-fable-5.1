/**
 * T-668: where a three-year fortress's infected wounds came from. Plays one seed at a sweep shift on
 * the sweep's cadence (as `t660_smith_steel_probe.test.ts` does) and, from `T668_FROM`, writes a line a
 * day: the wounds inflicted that day by type and by what dealt them, the infections started, the fires,
 * the dwarf deaths by cause, the patients, and the health jobs by kind and state (with blocked reasons).
 * A measurement, not a gate: it runs only with `T668_PROBE=1`, e.g.
 *   T668_PROBE=1 T668_SEED=three-years-p4-1 T668_PERIL=4 T668_SHIFT=0 T668_DAYS=300 T668_FROM=215 npx vitest run -c vitest.perf.config.ts test/perf/t668_wound_probe.test.ts
 */
import { describe, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { JobsReader } from '@systems/jobs';
import { watchInvariants } from '../scenarios/invariants';
import {
  checkFortressCaveFarm, checkFortressDefense, checkFortressRooms, checkFortressWorkOrders, playThreeYears, setupThreeYearsFortress, threeYearsWorld,
} from '../scenarios/three_years_fortress';

const RUN = process.env['T668_PROBE'] === '1';
const SEED = process.env['T668_SEED'] ?? 'three-years-p4-1';
const PERIL = Number(process.env['T668_PERIL'] ?? '4');
const SHIFT = Number(process.env['T668_SHIFT'] ?? '0');
const DAYS = Number(process.env['T668_DAYS'] ?? '300');
const FROM = Number(process.env['T668_FROM'] ?? '215');

describe.skipIf(!RUN)('T-668 wound probe', () => {
  it(`plays ${SEED} at shift ${SHIFT} to day ${DAYS} and journals the wounds`, () => {
    // As the sweep plays it (t664_farm_probe.test.ts): the invariants watched, and the first 20 days in steps of 100.
    const w = threeYearsWorld(SEED, PERIL);
    const stop = PERIL === 2 || PERIL === 4 ? watchInvariants(w.game, () => {}) : () => {};
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const jobs = w.readers.of<JobsReader>('11');
    const creatures = w.game.registry.table<{ id: string }>('creatures');
    const speciesOf = (id: number): string => { const sp = ent.get(id, C.Creature)?.species; return sp === undefined ? (id === 0 ? 'none' : `#${id}`) : creatures.byIndex(sp)?.id ?? '?'; };
    const isDwarf = (id: number): boolean => speciesOf(id) === 'dwarf';
    let day: Record<string, Record<string, number>> = {};
    const bump = (k: string, v: string): void => { (day[k] ??= {})[v] = (day[k]![v] ?? 0) + 1; };
    const lastHit = new Map<number, string>();
    w.game.world.onEvents((batch) => {
      if (w.tick < FROM * TICKS_PER_DAY) return;
      for (const e of batch) {
        if (e.type === 'DamageDealt' && isDwarf(Number(e['defenderId'] ?? 0))) {
          lastHit.set(Number(e['defenderId']), speciesOf(Number(e['attackerId'] ?? 0)));
        } else if (e.type === 'WoundInflicted' && isDwarf(Number(e['id']))) {
          bump('wounds', `${String(e['woundType'])}/${String(e['severity'])}<-${lastHit.get(Number(e['id'])) ?? '?'}`);
        } else if (e.type === 'InfectionStarted' && isDwarf(Number(e['id']))) bump('infected', 'n');
        else if (e.type === 'FireStarted' || e.type === 'BurnDamage' || e.type === 'LightningStrike' || e.type === 'Mishap' || e.type === 'TileIgnited' || e.type === 'MagmaContact') {
          const t = Number(e['tile'] ?? -1);
          bump('fire', t >= 0 ? `${e.type}@${w.map.xOf(t)},${w.map.yOf(t)},${w.map.zOf(t)}${w.map.hasFlag(t, TileFlag.Outdoor) ? ' out' : ''}${e['kind'] !== undefined ? ` ${String(e['kind'])}` : ''}` : e.type);
        }
        else if (e.type === 'CreatureDied' && Number(e['id']) > 0 && isDwarf(Number(e['id']))) bump('died', String(e['cause']));
        else if (e.type === 'TreatmentDone') bump('treated', String(e['kind']));
      }
    });
    let last = -1;
    const boot = 20 * TICKS_PER_DAY;
    while (w.tick < boot) {
      playThreeYears(w, state, Math.min(100, boot - w.tick));
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    while (w.tick < DAYS * TICKS_PER_DAY) {
      playThreeYears(w, state, Math.min(300, DAYS * TICKS_PER_DAY - w.tick));
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
      const d = Math.floor(w.tick / TICKS_PER_DAY);
      if (d < FROM || d === last) continue;
      last = d;
      const health: Record<string, number> = {};
      for (const j of jobs.list()) {
        const kind = j.key.split(':')[0] ?? '';
        if (!['clean_wound', 'stop_bleeding', 'suture', 'dress_burn', 'feed_patient', 'water_patient', 'carry_patient', 'diagnose', 'wash_patient', 'set_bone'].includes(kind)) continue;
        const k = `${kind}:${j.state}${j.blockedReason ? `:${j.blockedReason}` : ''}`;
        health[k] = (health[k] ?? 0) + 1;
      }
      const patients = ent.with(C.Brain).filter((id) => isDwarf(id) && ent.get(id, C.Brain)?.behavior === 'patient').length;
      console.log(`[t668day] ${SEED}@${SHIFT} ${d} ${JSON.stringify({ patients, ...day, health })}`);
      day = {};
    }
    stop();
  }, 7_200_000);
});
