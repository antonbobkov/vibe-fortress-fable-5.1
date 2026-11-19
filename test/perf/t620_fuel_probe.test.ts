import { describe, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { BuildingsReader } from '@systems/buildings/reader';
import {
  checkFortressCaveFarm, checkFortressDefense, checkFortressRooms, checkFortressWorkOrders, playThreeYears, setupThreeYearsFortress, threeYearsWorld,
} from '../scenarios/three_years_fortress';

/**
 * T-620: where the charcoal goes. Plays one three-year seed at a sweep shift on the sweep's own
 * cadence (three_years_seeds.test.ts) to `T620_DAYS` and prints, every `T620_EVERY` days from
 * `T620_FROM`, the wood furnace and the smelter: their orders, the job in hand and its state, the
 * worker and what it is doing, and the logs, charcoal and coal in stock. A measurement, not a gate:
 * it runs only with `T620_PROBE=1`, e.g.
 *   T620_PROBE=1 T620_SEED=three-years-p4-6 T620_PERIL=4 T620_SHIFT=50 T620_DAYS=250 npx vitest run -c vitest.perf.config.ts test/perf/t620_fuel_probe.test.ts
 */
const RUN = process.env['T620_PROBE'] === '1';
const SEED = process.env['T620_SEED'] ?? 'three-years-p4-6';
const PERIL = Number(process.env['T620_PERIL'] ?? '4');
const SHIFT = Number(process.env['T620_SHIFT'] ?? '0');
const DAYS = Number(process.env['T620_DAYS'] ?? '250');
const FROM = Number(process.env['T620_FROM'] ?? '100');
const EVERY = Number(process.env['T620_EVERY'] ?? '2');

describe.skipIf(!RUN)('T-620 fuel probe', () => {
  it(`plays ${SEED} at shift ${SHIFT} to day ${DAYS} and prints the furnaces`, () => {
    const w = threeYearsWorld(SEED, PERIL);
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    while (w.tick < 20 * TICKS_PER_DAY) {
      playThreeYears(w, state, Math.min(100, 20 * TICKS_PER_DAY - w.tick));
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    const ent = w.game.world.entities;
    const reg = w.game.registry;
    const recipes = reg.table<{ id: string }>('recipes');
    const items = w.readers.of<ItemsReader>('13');
    const jobs = w.readers.of<JobsReader>('11');
    const buildings = w.readers.of<BuildingsReader>('14');
    let lastDay = -1;
    const furnace = (type: string): unknown => {
      const id = state.placedIds[type] ?? 0;
      const ws = ent.get(id, C.Workshop);
      if (ws === undefined) return { type, state: buildings.get(id)?.state ?? 'gone' };
      const job = ws.currentJobId ? jobs.get(ws.currentJobId) : undefined;
      const worker = ws.assignedWorker ?? 0;
      return {
        type, orders: ws.orders.map((o) => `${recipes.byIndex(o.recipe)?.id}:${o.mode}:${o.mode === 'maintain' ? o.threshold : o.remaining}`),
        job: job ? `${String(job.data['recipe'] ?? job.key)}:${job.state}${job.blockedReason ? `:${job.blockedReason}` : ''}` : null, blocked: ws.lastBlockedReason ?? null,
        worker, alive: worker !== 0 && ent.alive(worker), doing: worker ? ent.get(worker, C.Brain)?.activity ?? '' : '',
      };
    };
    // Every 20 ticks: what each furnace's worker is doing, and whether the alert is up; and the charcoal and smelts made.
    const hist: Record<string, Record<string, number>> = { wood_furnace: {}, smelter: {} };
    const made: Record<string, number> = {};
    w.game.world.onEvents((batch) => {
      for (const e of batch) if (e.type === 'ItemCrafted') { const r = String(e['recipeId']); if (r === 'make_charcoal' || r.startsWith('smelt_') || r.startsWith('alloy_')) made[r] = (made[r] ?? 0) + 1; }
    });
    const sample = (): void => {
      if (w.tick < FROM * TICKS_PER_DAY) return;
      const alert = w.game.world.fortress.alert !== 'calm';
      for (const type of ['wood_furnace', 'smelter']) {
        const worker = ent.get(state.placedIds[type] ?? 0, C.Workshop)?.assignedWorker ?? 0;
        const brain = worker ? ent.get(worker, C.Brain) : undefined;
        const a = brain === undefined ? 'none' : brain.behavior === 'need' ? `need:${brain.activity.split(' ')[0]}` : `${brain.behavior}:${brain.activity.split(' ')[0]}`;
        const k = `${alert ? 'A ' : ''}${a}`;
        hist[type]![k] = (hist[type]![k] ?? 0) + 1;
      }
    };
    while (w.tick < DAYS * TICKS_PER_DAY) {
      playThreeYears(w, state, Math.min(300, DAYS * TICKS_PER_DAY - w.tick), sample);
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
      const day = Math.floor(w.tick / TICKS_PER_DAY);
      if (day < FROM || day === lastDay || day % EVERY !== 0) continue;
      lastDay = day;
      console.log(`[t620] ${JSON.stringify({ day, logs: items.available('log'), logsAll: items.count('log'), charcoal: items.available('charcoal_bar'), charcoalAll: items.count('charcoal_bar'),
        coal: items.available('coal_bar'), iron: items.countAvailable({ type: reg.table('items').index('bar'), materialId: reg.table('materials').index('iron') }), specialists: state.economy.specialists, steelOwed: state.strong?.steelOwed ?? null,
        furnace: furnace('wood_furnace'), smelter: furnace('smelter') })}`);
      if (day % 10 === 0) {
        const top = (h: Record<string, number>): string => { const n = Object.values(h).reduce((a, b) => a + b, 0); return Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${Math.round((100 * v) / n)}%`).join(', '); };
        console.log(`[t620sum] day ${day} made ${JSON.stringify(made)} burner: ${top(hist['wood_furnace']!)} | smelter: ${top(hist['smelter']!)}`);
        hist['wood_furnace'] = {}; hist['smelter'] = {};
        for (const k of Object.keys(made)) delete made[k];
      }
    }
  }, 3_600_000);
});
