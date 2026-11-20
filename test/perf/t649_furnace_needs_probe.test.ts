import { describe, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { ActivityPlan } from '@systems/dwarves/state';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { JobsReader } from '@systems/jobs';
import {
  checkFortressCaveFarm, checkFortressDefense, checkFortressRooms, checkFortressWorkOrders, playThreeYears, setupThreeYearsFortress, threeYearsWorld,
} from '../scenarios/three_years_fortress';

/**
 * T-649: where the furnace workers' day goes. Plays one three-year seed at a sweep shift on the sweep's
 * cadence (three_years_seeds.test.ts) to `T649_DAYS` and, from `T649_FROM`, samples every fortress
 * dwarf every 20 ticks, grouped by the workshop it is assigned to (`smelter` for either
 * smelter, `forge`, `wood_furnace`, `shop` for any other workshop, `none`): the share of its time
 * at its own workshop's job (at the bench or fetching for it), at other work, and on each need errand
 * split into travel and use. Every need errand is journalled: ticks in travel and in use, and how far
 * (horizontal Chebyshev plus levels) from its own workshop it began and ended. A measurement, not a
 * gate: it runs only with `T649_PROBE=1`, e.g.
 *   T649_PROBE=1 T649_SEED=three-years-p2-1 T649_PERIL=2 T649_SHIFT=0 T649_DAYS=336 T649_FROM=70 npx vitest run -c vitest.perf.config.ts test/perf/t649_furnace_needs_probe.test.ts
 */
const RUN = process.env['T649_PROBE'] === '1';
const SEED = process.env['T649_SEED'] ?? 'three-years-p2-1';
const PERIL = Number(process.env['T649_PERIL'] ?? '2');
const SHIFT = Number(process.env['T649_SHIFT'] ?? '0');
const DAYS = Number(process.env['T649_DAYS'] ?? '336');
const FROM = Number(process.env['T649_FROM'] ?? '70');
const EVERY = 20; // playThreeYears watches every 20 ticks
const REPORT = Number(process.env['T649_REPORT'] ?? '56');

interface Errand { need: string; start: number; travel: number; use: number; from: number }
interface Group { samples: number; buckets: Record<string, number>; errands: Record<string, { n: number; travel: number; use: number; from: number; to: number }>; dwarves: Set<number>; fetch: Record<string, number> }

describe.skipIf(!RUN)('T-649 furnace needs probe', () => {
  it(`plays ${SEED} at shift ${SHIFT} to day ${DAYS} and prints where the workers' day goes`, () => {
    const w = threeYearsWorld(SEED, PERIL);
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const buildings = w.readers.of<BuildingsReader>('14');
    const jobs = w.readers.of<JobsReader>('11');
    const itemTypes = w.game.registry.table<{ id: string }>('items');
    const plans = (w.game.world.scheduler.byId('10') as unknown as { activities: { plans: Map<number, ActivityPlan> } }).activities.plans;
    // Each worker's workshop (the first assigned), its role and its centre tile; rebuilt every 300 ticks.
    let shopOf = new Map<number, { id: number; role: string; at: number }>();
    const rebuild = (): void => {
      shopOf = new Map();
      for (const id of ent.with(C.Workshop)) {
        const ws = ent.get(id, C.Workshop)!;
        const b = buildings.get(id);
        if (ws.assignedWorker === 0 || b === undefined || b.state !== 'built') continue;
        const role = b.typeId === 'smelter' ? 'smelter' : b.typeId === 'forge' ? 'forge' : b.typeId === 'wood_furnace' ? 'wood_furnace' : 'shop';
        const prev = shopOf.get(ws.assignedWorker);
        const rank = (r: string): number => ['smelter', 'forge', 'wood_furnace', 'shop'].indexOf(r);
        if (prev === undefined || rank(role) < rank(prev.role)) shopOf.set(ws.assignedWorker, { id, role, at: b.footprint[Math.floor(b.footprint.length / 2)]! });
      }
    };
    const groups = new Map<string, Group>();
    const group = (role: string): Group => {
      let g = groups.get(role);
      if (g === undefined) { g = { samples: 0, buckets: {}, errands: {}, dwarves: new Set(), fetch: {} }; groups.set(role, g); }
      return g;
    };
    const steps = (a: number, b: number): number => a < 0 || b < 0 ? -1
      : Math.max(Math.abs(w.map.xOf(a) - w.map.xOf(b)), Math.abs(w.map.yOf(a) - w.map.yOf(b))) + Math.abs(w.map.zOf(a) - w.map.zOf(b));
    const tileOf = (id: number): number => { const p = ent.get(id, C.Position); return p === undefined ? -1 : w.index(p.x, p.y, p.z); };
    const open = new Map<number, Errand>();
    const close = (id: number, e: Errand, role: string, at: number): void => {
      const g = group(role);
      const r = (g.errands[e.need] ??= { n: 0, travel: 0, use: 0, from: 0, to: 0 });
      r.n += 1; r.travel += e.travel; r.use += e.use; r.from += Math.max(0, e.from); r.to += Math.max(0, steps(tileOf(id), at));
    };
    const sample = (): void => {
      if (w.tick < FROM * TICKS_PER_DAY) return;
      for (const id of ent.with(C.Labors)) {
        if (ent.get(id, C.Creature)?.faction !== 'fortress') continue;
        const shop = shopOf.get(id);
        const role = shop?.role ?? 'none';
        const g = group(role);
        g.samples += 1; g.dwarves.add(id);
        const brain = ent.get(id, C.Brain);
        const plan = plans.get(id);
        let b: string;
        if (plan !== undefined) {
          const need = plan.hall ? 'hall' : plan.need;
          b = `${need}:${plan.phase === 'use' ? 'use' : 'travel'}`;
          let e = open.get(id);
          if (e !== undefined && e.need !== need) { close(id, e, role, shop?.at ?? -1); e = undefined; }
          if (e === undefined) { e = { need, start: w.tick, travel: 0, use: 0, from: steps(tileOf(id), shop?.at ?? -1) }; open.set(id, e); }
          if (plan.phase === 'use') e.use += EVERY; else e.travel += EVERY;
        } else {
          const e = open.get(id);
          if (e !== undefined) { close(id, e, role, shop?.at ?? -1); open.delete(id); }
          const jobId = ent.get(id, C.Worker)?.jobId ?? 0;
          if (brain?.behavior === 'work' && jobId !== 0) {
            const own = shop !== undefined && ent.get(shop.id, C.Workshop)?.currentJobId === jobId;
            const state = own ? jobs.get(jobId)?.state ?? '' : '';
            b = own ? (state === 'working' ? 'own:work' : 'own:fetch') : 'other job';
            if (own && state !== 'working') {
              // What the fetch carries and how far from the workshop it is (steps, in tens).
              const carried = ent.get(ent.get(id, C.Worker)?.carrying ?? 0, C.Item);
              const what = carried === undefined ? '-' : `${itemTypes.byIndex(carried.type)?.id ?? '?'}`;
              const k = `${state}:${what}:${Math.floor(steps(tileOf(id), shop.at) / 10) * 10}`;
              g.fetch[k] = (g.fetch[k] ?? 0) + 1;
            }
          } else b = brain === undefined ? 'none' : brain.behavior === 'work' ? 'work:waiting' : brain.behavior;
        }
        g.buckets[b] = (g.buckets[b] ?? 0) + 1;
      }
    };
    const print = (label: string): void => {
      for (const [role, g] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (g.samples === 0) continue;
        const frac = Object.fromEntries(Object.entries(g.buckets).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round((1000 * v) / g.samples) / 10]));
        const days = (g.samples * EVERY) / TICKS_PER_DAY;
        const errands = Object.fromEntries(Object.entries(g.errands).sort((a, b) => a[0].localeCompare(b[0])).map(([k, r]) => [k, {
          perDay: Math.round((100 * r.n) / days) / 100, travel: Math.round(r.travel / r.n), use: Math.round(r.use / r.n), from: Math.round(r.from / r.n), to: Math.round(r.to / r.n) }]));
        console.log(`[t649] ${SEED}@${SHIFT} ${label} ${role} ${JSON.stringify({ dwarfDays: Math.round(days), dwarves: g.dwarves.size, frac, errands })}`);
        const fetch = Object.entries(g.fetch).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${Math.round((1000 * v) / g.samples) / 10}%`).join(', ');
        if (fetch) console.log(`[t649fetch] ${SEED}@${SHIFT} ${label} ${role} ${fetch}`);
      }
    };
    rebuild();
    let lastReport = Math.floor(w.tick / TICKS_PER_DAY);
    while (w.tick < DAYS * TICKS_PER_DAY) {
      playThreeYears(w, state, Math.min(300, DAYS * TICKS_PER_DAY - w.tick), sample);
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
      rebuild();
      const day = Math.floor(w.tick / TICKS_PER_DAY);
      if (day >= FROM && day - lastReport >= REPORT) { lastReport = day; print(`day ${day}`); }
    }
    print('ALL');
  }, 7_200_000);
});
