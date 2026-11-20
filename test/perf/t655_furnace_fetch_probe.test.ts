import { describe, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { JobBoard } from '@systems/jobs/board';
import {
  checkFortressCaveFarm, checkFortressDefense, checkFortressRooms, checkFortressWorkOrders, playThreeYears, setupThreeYearsFortress, threeYearsWorld,
} from '../scenarios/three_years_fortress';

/**
 * T-655: the furnace jobs' trips. Plays one three-year seed at a sweep shift on the sweep's cadence
 * (three_years_seeds.test.ts) to `T655_DAYS` and, from `T655_FROM`:
 *
 * - journals every input a furnace job (the smelters', the forge's, the wood furnace's) reserves: its
 *   type and units, how far it lies from the workshop and from the worker at the claim, and how far
 *   the nearest other free item the input would take lies from the workshop; and per completed job,
 *   by recipe group, the trips (items fetched), the units, the ticks from the claim to the work and
 *   from the work to completion for a job claimed once;
 * - samples every furnace worker every 20 ticks as T-649's probe does: at its own workshop's job
 *   working, or fetching and walking for it;
 * - prints, every `T655_REPORT` days, what lies in the stockpiles below by category, and where the
 *   free logs lie (the fuel store, another stockpile, loose).
 *
 * Distances are steps: horizontal Chebyshev plus levels. A measurement, not a gate: it runs only
 * with `T655_PROBE=1`, e.g.
 *   T655_PROBE=1 T655_SEED=three-years-p4-6 T655_PERIL=4 T655_SHIFT=50 T655_DAYS=336 T655_FROM=126 npx vitest run -c vitest.perf.config.ts test/perf/t655_furnace_fetch_probe.test.ts
 */
const RUN = process.env['T655_PROBE'] === '1';
const SEED = process.env['T655_SEED'] ?? 'three-years-p4-6';
const PERIL = Number(process.env['T655_PERIL'] ?? '4');
const SHIFT = Number(process.env['T655_SHIFT'] ?? '50');
const DAYS = Number(process.env['T655_DAYS'] ?? '336');
const FROM = Number(process.env['T655_FROM'] ?? '126');
const REPORT = Number(process.env['T655_REPORT'] ?? '42');
const EVERY = 20;

const FURNACES = ['smelter', 'forge', 'wood_furnace'];

interface Trip { type: string; units: number; need: number; fromShop: number; fromWorker: number; altFromShop: number }
interface JobLog { group: string; role: string; claims: Set<number>; trips: Trip[]; started: number; claimTick: number; fetchTicks: number }
interface Agg { jobs: number; trips: number; units: number; once: number; fetchTicks: number; workTicks: number; fromShop: number; fromWorker: number; nearer: number; byType: Record<string, { trips: number; units: number; fromShop: number; need: number }> }

function groupOf(recipe: string): string {
  if (recipe === 'make_charcoal') return 'charcoal';
  if (recipe.startsWith('smelt_')) return recipe === 'smelt_bituminous_coal' || recipe === 'smelt_lignite' ? 'smelt coal' : 'smelt ore';
  if (recipe.startsWith('alloy_') || recipe.startsWith('make_steel')) return 'alloy';
  if (recipe.startsWith('melt_')) return 'melt';
  if (recipe.startsWith('forge_')) return 'forge';
  return recipe;
}

describe.skipIf(!RUN)('T-655 furnace fetch probe', () => {
  it(`plays ${SEED} at shift ${SHIFT} to day ${DAYS} and prints the furnace jobs' trips`, () => {
    const w = threeYearsWorld(SEED, PERIL);
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const buildings = w.readers.of<BuildingsReader>('14');
    const items = w.readers.of<ItemsReader>('13');
    const jobsReader = w.readers.of<JobsReader>('11');
    const board = w.game.world.services.jobs as unknown as JobBoard;
    const itemTypes = w.game.registry.table<{ id: string }>('items');
    const steps = (a: number, b: number): number => a < 0 || b < 0 ? -1
      : Math.max(Math.abs(w.map.xOf(a) - w.map.xOf(b)), Math.abs(w.map.yOf(a) - w.map.yOf(b))) + Math.abs(w.map.zOf(a) - w.map.zOf(b));
    const tileOf = (id: number): number => { const p = ent.get(id, C.Position); return p === undefined ? -1 : w.index(p.x, p.y, p.z); };
    const roleOf = (shopId: number): string | null => {
      const b = buildings.get(shopId);
      if (b === undefined || !FURNACES.includes(b.typeId)) return null;
      return shopId === state.placedIds['smelter_2'] ? 'smelter_2' : b.typeId;
    };

    const logs = new Map<number, JobLog>();
    const agg = new Map<string, Agg>();
    const aggOf = (k: string): Agg => {
      let a = agg.get(k);
      if (a === undefined) { a = { jobs: 0, trips: 0, units: 0, once: 0, fetchTicks: 0, workTicks: 0, fromShop: 0, fromWorker: 0, nearer: 0, byType: {} }; agg.set(k, a); }
      return a;
    };
    w.game.world.onEvents((batch) => {
      if (w.tick < FROM * TICKS_PER_DAY) return;
      for (const e of batch) {
        if (e.type === 'ItemReserved') {
          const job = board.jobs.get(Number(e['jobId']));
          if (job === undefined || job.producer !== 'workshops' || job.target.kind !== 'building') continue;
          const role = roleOf(job.target.ref);
          if (role === null) continue;
          const shop = typeof job.workTile === 'number' ? job.workTile : -1;
          let log = logs.get(job.id);
          if (log === undefined) {
            log = { group: groupOf(String(job.data['recipe'])), role, claims: new Set(), trips: [], started: -1, claimTick: job.claimedTick, fetchTicks: -1 };
            logs.set(job.id, log);
          }
          log.claims.add(job.claimedTick);
          const itemId = Number(e['itemId']);
          const it = items.get(itemId);
          const input = job.inputs.find((i) => i.reserved.includes(itemId));
          const at = items.tileOf(itemId);
          let alt = -1;
          if (input !== undefined && shop >= 0) {
            const other = items.findItems({ ...input.filter }, 1, shop, 'walker', { reservable: true })[0] ?? 0;
            if (other !== 0) alt = steps(items.tileOf(other), shop);
          }
          log.trips.push({ type: it === undefined ? '?' : itemTypes.byIndex(it.type)?.id ?? '?', units: it?.count ?? 0, need: input?.count ?? 0,
            fromShop: steps(at, shop), fromWorker: steps(at, tileOf(job.workerId)), altFromShop: alt });
        } else if (e.type === 'JobStarted') {
          const log = logs.get(Number(e['jobId']));
          if (log !== undefined) { log.started = w.tick; if (log.fetchTicks < 0) log.fetchTicks = w.tick - log.claimTick; }
        } else if (e.type === 'JobCompleted') {
          const id = Number(e['jobId']);
          const log = logs.get(id);
          if (log === undefined) continue;
          logs.delete(id);
          for (const k of [`${log.role} ${log.group}`, `all ${log.group}`]) {
            const a = aggOf(k);
            a.jobs += 1;
            a.trips += log.trips.length;
            for (const t of log.trips) {
              a.units += t.units; a.fromShop += Math.max(0, t.fromShop); a.fromWorker += Math.max(0, t.fromWorker);
              if (t.altFromShop >= 0 && t.altFromShop < t.fromShop) a.nearer += 1;
              const bt = (a.byType[t.type] ??= { trips: 0, units: 0, fromShop: 0, need: 0 });
              bt.trips += 1; bt.units += t.units; bt.fromShop += Math.max(0, t.fromShop); bt.need += t.need;
            }
            if (log.claims.size === 1 && log.started >= 0) { a.once += 1; a.fetchTicks += log.fetchTicks; a.workTicks += w.tick - log.started; }
          }
        }
      }
    });

    // T-649's sampling of the furnace workers.
    let shopOf = new Map<number, { id: number; role: string }>();
    const rebuild = (): void => {
      shopOf = new Map();
      for (const id of ent.with(C.Workshop)) {
        const ws = ent.get(id, C.Workshop)!;
        const role = roleOf(id);
        if (ws.assignedWorker === 0 || role === null || buildings.get(id)?.state !== 'built') continue;
        if (!shopOf.has(ws.assignedWorker) || role === 'smelter') shopOf.set(ws.assignedWorker, { id, role });
      }
    };
    const shares = new Map<string, Record<string, number>>();
    const sample = (): void => {
      if (w.tick < FROM * TICKS_PER_DAY) return;
      for (const [dwarf, shop] of shopOf) {
        if (!ent.alive(dwarf)) continue;
        const s = (shares.get(shop.role) ?? shares.set(shop.role, {}).get(shop.role)!);
        s['samples'] = (s['samples'] ?? 0) + 1;
        const jobId = ent.get(dwarf, C.Worker)?.jobId ?? 0;
        const brain = ent.get(dwarf, C.Brain);
        // Either of the smith's workshops counts as its own.
        const own = jobId !== 0 && brain?.behavior === 'work' && [...ent.with(C.Workshop)].some((sid) => ent.get(sid, C.Workshop)?.assignedWorker === dwarf && ent.get(sid, C.Workshop)?.currentJobId === jobId);
        if (!own) continue;
        const st = jobsReader.get(jobId)?.state ?? '';
        const carrying = ent.get(dwarf, C.Worker)?.carrying ?? 0;
        const k = st === 'working' ? 'work' : carrying !== 0 ? 'carry' : 'walk';
        s[k] = (s[k] ?? 0) + 1;
      }
    };
    const stores = (): string => {
      // What lies in each stockpile below the surface (by category), and where the free logs lie.
      const out: string[] = [];
      for (const zid of buildings.zonesOfType('stockpile')) {
        const z = buildings.zone(zid);
        if (z === undefined || z.tiles.length === 0 || w.map.zOf(z.tiles[0]!) === state.z) continue;
        const by: Record<string, number> = {};
        for (const t of z.tiles) for (const id of items.at(t)) {
          const it = items.get(id);
          if (it === undefined) continue;
          const inside = items.inContainer(id);
          const list = inside.length > 0 ? inside : [id];
          for (const c of list) { const ci = items.get(c); if (ci !== undefined) { const k = items.categoryOf(ci.type).split('/')[0]!; by[k] = (by[k] ?? 0) + ci.count; } }
        }
        out.push(`zone${zid}(${z.tiles.length}t z${w.map.zOf(z.tiles[0]!)}): ${JSON.stringify(by)}`);
      }
      const logType = itemTypes.index('log');
      const furnace = buildings.get(state.placedIds['wood_furnace'] ?? 0);
      const fAt = furnace?.footprint[4] ?? -1;
      const where: Record<string, number> = {};
      let near = 0, sum = 0, n = 0;
      for (const id of items.findItems({ type: logType }, 400, fAt >= 0 ? fAt : 0, 'walker', { reservable: true })) {
        const t = items.tileOf(id);
        const sp = items.stockpileAt(t);
        const k = sp === 0 ? (w.map.zOf(t) === state.z ? 'loose surface' : 'loose below') : `zone${buildings.zoneAt(t)}`;
        where[k] = (where[k] ?? 0) + 1;
        const d = steps(t, fAt);
        if (d <= 10) near += 1;
        sum += d; n += 1;
      }
      return `${out.join(' | ')} || free logs ${n} (within 10 of the furnace ${near}, mean ${n ? Math.round(sum / n) : 0} steps): ${JSON.stringify(where)}`;
    };
    const print = (label: string): void => {
      for (const [k, a] of [...agg].sort((x, y) => x[0].localeCompare(y[0]))) {
        const r = (x: number, d: number): number => d === 0 ? 0 : Math.round((10 * x) / d) / 10;
        const types = Object.entries(a.byType).map(([t, b]) => `${t} ${b.trips} trips ${r(b.units, b.trips)}u/trip of ${r(b.need, b.trips)} needed, ${r(b.fromShop, b.trips)} from shop`).join('; ');
        console.log(`[t655jobs] ${SEED}@${SHIFT} ${label} ${k}: ${a.jobs} jobs, ${r(a.trips, a.jobs)} trips/job, ${r(a.units, a.trips)} units/trip, item ${r(a.fromShop, a.trips)} from shop, ${r(a.fromWorker, a.trips)} from worker, ${a.nearer} trips with a nearer free match; claimed once ${a.once}: fetch ${r(a.fetchTicks, a.once)} ticks, work ${r(a.workTicks, a.once)} ticks | ${types}`);
      }
      for (const [role, s] of [...shares].sort((x, y) => x[0].localeCompare(y[0]))) {
        const n = s['samples'] ?? 0;
        const p = (k: string): number => n === 0 ? 0 : Math.round((1000 * (s[k] ?? 0)) / n) / 10;
        console.log(`[t655share] ${SEED}@${SHIFT} ${label} ${role}: ${Math.round((n * EVERY) / TICKS_PER_DAY)} dwarf-days, working ${p('work')}%, walking empty ${p('walk')}%, carrying ${p('carry')}%`);
      }
      console.log(`[t655stores] ${SEED}@${SHIFT} ${label} ${stores()}`);
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
