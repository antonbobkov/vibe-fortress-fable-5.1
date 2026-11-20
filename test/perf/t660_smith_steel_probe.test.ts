import { describe, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { Worker } from '@core/components';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { JobBoard } from '@systems/jobs/board';
import type { Job } from '@systems/jobs/state';
import type { GameEvent } from '@core/events';
import {
  checkFortressCaveFarm, checkFortressDefense, checkFortressRooms, checkFortressWorkOrders, playThreeYears, setupThreeYearsFortress, threeYearsWorld,
} from '../scenarios/three_years_fortress';

/**
 * T-659, T-660: the steel jobs' trips and why the smith's are fetched again. Plays one three-year
 * seed at a sweep shift on the sweep's cadence (three_years_seeds.test.ts) to `T660_DAYS` and, from
 * `T660_FROM`, for every furnace job (the two smelters', the forge's, the wood furnace's):
 *
 * - counts its claims, its reservations (`ItemReserved`, T-655's "trips"), its pickups (the worker
 *   taking an item in hand for it: the trips walked) and the units of each;
 * - journals each interruption of a job at the second smelter, and of the first smelter's steel: who
 *   called it (the hold of an absent worker, a critical need, a threat, an alert, a soldier's duty, a
 *   call to a patient, a worker gone down), the worker's behaviour and activity, the job's state and
 *   what was delivered, carried (and dropped) or still to fetch; each lapse of its reservations
 *   (`RESERVE_KEEP_TICKS`) and the units it let go; and where the worker went in between: the next job
 *   it claimed and after how long;
 * - samples every furnace worker every 20 ticks as T-649's and T-655's probes do: at its own
 *   workshop's job working, walking empty or carrying, and what each furnace's job is doing.
 *
 * Distances are steps: horizontal Chebyshev plus levels. A measurement, not a gate: it runs only
 * with `T660_PROBE=1`, e.g.
 *   T660_PROBE=1 T660_SEED=three-years-p4-6 T660_PERIL=4 T660_SHIFT=50 T660_DAYS=336 T660_FROM=126 npx vitest run -c vitest.perf.config.ts test/perf/t660_smith_steel_probe.test.ts
 */
const RUN = process.env['T660_PROBE'] === '1';
const SEED = process.env['T660_SEED'] ?? 'three-years-p4-6';
const PERIL = Number(process.env['T660_PERIL'] ?? '4');
const SHIFT = Number(process.env['T660_SHIFT'] ?? '50');
const DAYS = Number(process.env['T660_DAYS'] ?? '336');
const FROM = Number(process.env['T660_FROM'] ?? '126');
const REPORT = Number(process.env['T660_REPORT'] ?? '70');
/** How many interruptions of the journalled jobs to print one by one. */
const JOURNAL = Number(process.env['T660_JOURNAL'] ?? '40');
const EVERY = 20;

const FURNACES = ['smelter', 'forge', 'wood_furnace'];

interface JobLog {
  group: string; role: string; claims: number; reserved: number; reservedUnits: number; pickups: number; pickedUnits: number;
  interrupts: number; lapses: number; lapsedUnits: number; dropped: number; byType: Record<string, { pickups: number; units: number; fromShop: number }>;
}
interface Agg { jobs: number; claims: number; reserved: number; pickups: number; pickedUnits: number; interrupts: number; lapses: number; lapsedUnits: number; dropped: number; once: number; byType: Record<string, { pickups: number; units: number; fromShop: number }> }

function groupOf(recipe: string): string {
  if (recipe === 'make_charcoal') return 'charcoal';
  if (recipe.startsWith('smelt_')) return recipe === 'smelt_bituminous_coal' || recipe === 'smelt_lignite' ? 'smelt coal' : 'smelt ore';
  if (recipe.startsWith('alloy_') || recipe.startsWith('make_steel')) return 'alloy';
  if (recipe.startsWith('melt_')) return 'melt';
  if (recipe.startsWith('forge_')) return 'forge';
  return recipe;
}

/** Who called an interruption, from the call's stack. */
function causeOf(stack: string): string {
  if (stack.includes('releaseAbsentHolders')) return 'hold timeout (worker away)';
  if (stack.includes('summonForPatients')) return 'call to a patient';
  if (stack.includes('releaseDown')) return 'worker down';
  if (stack.includes('fleeFire') || stack.includes('fleeWater')) return 'fled fire or water';
  if (stack.includes('fleeDread')) return 'fled dread';
  const frame = stack.split('\n').slice(1).filter((l) => !l.includes('t660_smith_steel_probe')).map((l) => l.trim().replace(/^at /, '').replace(/ \(.*\)$/, ''))[0];
  return `other: ${frame ?? '?'}`;
}

describe.skipIf(!RUN)('T-660 smith steel probe', () => {
  it(`plays ${SEED} at shift ${SHIFT} to day ${DAYS} and journals the steel jobs`, () => {
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
    const roleOf = (shopId: number): string | null => {
      const b = buildings.get(shopId);
      if (b === undefined || !FURNACES.includes(b.typeId)) return null;
      return shopId === state.placedIds['smelter_2'] ? 'smelter_2' : b.typeId;
    };
    const furnaceJob = (job: Job | undefined): string | null =>
      job === undefined || job.producer !== 'workshops' || job.target.kind !== 'building' ? null : roleOf(job.target.ref);
    const on = (): boolean => w.tick >= FROM * TICKS_PER_DAY;
    const typeName = (item: number): string => { const it = items.get(item); return it === undefined ? '?' : itemTypes.byIndex(it.type)?.id ?? '?'; };

    const logs = new Map<number, JobLog>();
    const logOf = (job: Job): JobLog | undefined => {
      if (!on()) return undefined;
      const role = furnaceJob(job);
      if (role === null) return undefined;
      let log = logs.get(job.id);
      if (log === undefined) {
        log = { group: groupOf(String(job.data['recipe'])), role, claims: 0, reserved: 0, reservedUnits: 0, pickups: 0, pickedUnits: 0,
          interrupts: 0, lapses: 0, lapsedUnits: 0, dropped: 0, byType: {} };
        logs.set(job.id, log);
      }
      return log;
    };
    /** The jobs whose interruptions are journalled: the second smelter's, and the steel at the first. */
    const journalled = (log: JobLog): boolean => log.role === 'smelter_2' || log.group === 'alloy';
    const agg = new Map<string, Agg>();
    const aggOf = (k: string): Agg => {
      let a = agg.get(k);
      if (a === undefined) { a = { jobs: 0, claims: 0, reserved: 0, pickups: 0, pickedUnits: 0, interrupts: 0, lapses: 0, lapsedUnits: 0, dropped: 0, once: 0, byType: {} }; agg.set(k, a); }
      return a;
    };
    const causes = new Map<string, Record<string, number>>();
    const countCause = (role: string, k: string): void => { const r = causes.get(role) ?? causes.set(role, {}).get(role)!; r[k] = (r[k] ?? 0) + 1; };
    const journal: string[] = [];
    /** A worker whose journalled job was interrupted: when, and the job, until it claims another. */
    const away = new Map<number, { tick: number; jobId: number; role: string }>();

    // The event 11 is handling, so an interruption in its handler is told by the event (a critical need, a threat, an alert).
    const jobsSystem = w.game.world.scheduler.byId('11') as unknown as { handle(event: GameEvent, ctx: unknown): void };
    const handle = jobsSystem.handle.bind(jobsSystem);
    let handling = '';
    jobsSystem.handle = (event: GameEvent, ctx: unknown): void => {
      handling = event.type === 'NeedCritical' ? `NeedCritical ${String(event['need'])}` : event.type === 'AlertChanged' ? `AlertChanged to ${String(event['to'])}` : event.type;
      try { handle(event, ctx); } finally { handling = ''; }
    };
    // The interruptions, wrapped: the board calls `this.interrupt`, the brain `ctx.jobs.interrupt`, both the board.
    const interrupt = board.interrupt.bind(board);
    board.interrupt = (workerId: number, keepProgress: boolean): void => {
      const jobId = board.workerOf(workerId).jobId;
      const job = jobId === 0 ? undefined : board.jobs.get(jobId);
      const log = job === undefined ? undefined : logOf(job);
      if (job !== undefined && log !== undefined) {
        log.interrupts += 1;
        const stack = new Error().stack ?? '';
        const brain = ent.get(workerId, C.Brain);
        const carrying = board.workerOf(workerId).carrying;
        if (carrying !== 0) log.dropped += 1;
        const cause = handling !== '' ? handling : causeOf(stack);
        const why = `${cause}: ${brain?.behavior}/${brain?.activity}`;
        if (journalled(log)) {
          countCause(`${log.role} ${log.group}`, `${cause} [${brain?.behavior}]`);
          countCause(`${log.role} ${log.group} activity`, String(brain?.activity ?? '?'));
          countCause(`${log.role} ${log.group} state`, `${job.state}${carrying !== 0 ? ' carrying' : ''}`);
          away.set(workerId, { tick: w.tick, jobId: job.id, role: `${log.role} ${log.group}` });
          if (journal.length < JOURNAL) {
            const inputs = job.inputs.map((i) => {
              const units = (ids: number[]): number => ids.reduce((s, id) => s + (items.get(id)?.count ?? 0), 0);
              const todo = i.reserved.filter((id) => !i.delivered.includes(id));
              return `${JSON.stringify(i.filter)}x${i.count}: delivered ${units(i.delivered)}, to fetch ${units(todo)}`;
            }).join('; ');
            const frames = stack.split('\n').slice(2, 7).map((l) => l.trim().replace(/^at /, '').replace(/ \(.*\)$/, '')).join(' < ');
            journal.push(`day ${Math.floor(w.tick / TICKS_PER_DAY)} t${w.tick} job ${job.id} ${log.role} ${log.group} claim #${log.claims} ${job.state} p${job.progress} ${why}${carrying !== 0 ? ` (dropped ${typeName(carrying)})` : ''} | ${inputs} | ${frames}`);
          }
        }
      }
      interrupt(workerId, keepProgress);
    };
    // The reservations that lapse (and the others the board lets go), wrapped.
    const release = board.releaseReservations.bind(board);
    board.releaseReservations = (job: Job, keepDelivered = false): void => {
      const log = logOf(job);
      if (log !== undefined && keepDelivered) {
        let units = 0;
        for (const input of job.inputs) for (const id of input.reserved) if (!input.delivered.includes(id)) units += items.get(id)?.count ?? 0;
        if (units > 0) {
          log.lapses += 1; log.lapsedUnits += units;
          if (journalled(log)) countCause(`${log.role} ${log.group} lapse`, job.state === 'open' ? 'lapsed while open' : `released ${job.state}`);
        }
      }
      release(job, keepDelivered);
    };
    // The pickups: a worker taking an item in hand for its job.
    const setWorker = board.setWorker.bind(board);
    board.setWorker = (workerId: number, patch: Partial<Worker>): void => {
      const carrying = patch.carrying;
      if (carrying !== undefined && carrying !== 0 && board.workerOf(workerId).carrying !== carrying) {
        const job = board.jobs.get(patch.jobId ?? board.workerOf(workerId).jobId);
        const log = job === undefined ? undefined : logOf(job);
        if (job !== undefined && log !== undefined) {
          log.pickups += 1;
          const units = items.get(carrying)?.count ?? 0;
          log.pickedUnits += units;
          const t = typeName(carrying);
          const bt = (log.byType[t] ??= { pickups: 0, units: 0, fromShop: 0 });
          bt.pickups += 1; bt.units += units;
          bt.fromShop += Math.max(0, steps(items.tileOf(carrying), typeof job.workTile === 'number' ? job.workTile : -1));
        }
      }
      setWorker(workerId, patch);
    };

    const gaps = new Map<string, { n: number; ticks: number; next: Record<string, number> }>();
    w.game.world.onEvents((batch) => {
      if (!on()) return;
      for (const e of batch) {
        if (e.type === 'ItemReserved') {
          const job = board.jobs.get(Number(e['jobId']));
          const log = job === undefined ? undefined : logOf(job);
          if (log === undefined) continue;
          log.reserved += 1; log.reservedUnits += items.get(Number(e['itemId']))?.count ?? 0;
        } else if (e.type === 'JobClaimed') {
          const job = board.jobs.get(Number(e['jobId']));
          const log = job === undefined ? undefined : logOf(job);
          if (log !== undefined) log.claims += 1;
          const workerId = Number(e['workerId']);
          const was = away.get(workerId);
          if (was !== undefined) {
            away.delete(workerId);
            const g = gaps.get(was.role) ?? gaps.set(was.role, { n: 0, ticks: 0, next: {} }).get(was.role)!;
            g.n += 1; g.ticks += w.tick - was.tick;
            const role = furnaceJob(job);
            const k = job?.id === was.jobId ? 'the same job' : role !== null ? `${role} ${groupOf(String(job?.data['recipe']))}` : String(e['jobType']);
            g.next[k] = (g.next[k] ?? 0) + 1;
          }
        } else if (e.type === 'JobCompleted' || e.type === 'JobCancelled') {
          const id = Number(e['jobId']);
          const log = logs.get(id);
          if (log === undefined) continue;
          logs.delete(id);
          if (e.type === 'JobCancelled') { countCause(`${log.role} ${log.group} cancelled`, String(e['reason'])); continue; }
          for (const k of [`${log.role} ${log.group}`, `all ${log.group}`]) {
            const a = aggOf(k);
            a.jobs += 1; a.claims += log.claims; a.reserved += log.reserved; a.pickups += log.pickups; a.pickedUnits += log.pickedUnits;
            a.interrupts += log.interrupts; a.lapses += log.lapses; a.lapsedUnits += log.lapsedUnits; a.dropped += log.dropped;
            if (log.claims === 1) a.once += 1;
            for (const [t, b] of Object.entries(log.byType)) {
              const x = (a.byType[t] ??= { pickups: 0, units: 0, fromShop: 0 });
              x.pickups += b.pickups; x.units += b.units; x.fromShop += b.fromShop;
            }
          }
        }
      }
    });

    // T-649's and T-655's sampling of the furnace workers.
    let shopOf = new Map<number, { id: number; role: string }>();
    const rebuild = (): void => {
      shopOf = new Map();
      for (const id of ent.with(C.Workshop)) {
        const ws = ent.get(id, C.Workshop)!;
        const role = roleOf(id);
        if (ws.assignedWorker === 0 || role === null || buildings.get(id)?.state !== 'built') continue;
        if (!shopOf.has(ws.assignedWorker) || role === 'smelter') shopOf.set(ws.assignedWorker, { id, role: role === 'smelter_2' ? 'forge' : role });
      }
    };
    const shares = new Map<string, Record<string, number>>();
    const shopStates = new Map<string, Record<string, number>>();
    const openDoing = new Map<string, Record<string, number>>();
    const sample = (): void => {
      if (!on()) return;
      for (const sid of ent.with(C.Workshop)) {
        const role = roleOf(sid);
        if (role === null || buildings.get(sid)?.state !== 'built') continue;
        const ws = ent.get(sid, C.Workshop)!;
        const job = ws.currentJobId === 0 ? undefined : jobsReader.get(ws.currentJobId);
        const k = job === undefined ? `none:${ws.lastBlockedReason ?? 'idle'}` : `${job.state}${job.state === 'blocked' ? `:${job.blockedReason}` : ''}`;
        const r = (shopStates.get(role) ?? shopStates.set(role, {}).get(role)!);
        r[k] = (r[k] ?? 0) + 1;
        // While the job stands open (or the workshop waits), what its named worker is doing.
        if (ws.assignedWorker !== 0 && ent.alive(ws.assignedWorker) && (job === undefined || job.state === 'open')) {
          const brain = ent.get(ws.assignedWorker, C.Brain);
          const held = ent.get(ws.assignedWorker, C.Worker)?.jobId ?? 0;
          const heldJob = held === 0 ? undefined : board.jobs.get(held);
          const heldRole = furnaceJob(heldJob);
          const doing = heldJob !== undefined ? `job ${heldRole !== null ? `${heldRole} ${groupOf(String(heldJob.data['recipe']))}` : board.typeId(heldJob)}` : `${brain?.behavior}/${brain?.activity}`;
          const o = (openDoing.get(`${role} ${job === undefined ? 'none' : 'open'}`) ?? openDoing.set(`${role} ${job === undefined ? 'none' : 'open'}`, {}).get(`${role} ${job === undefined ? 'none' : 'open'}`)!);
          o[doing] = (o[doing] ?? 0) + 1;
        }
      }
      for (const [dwarf, shop] of shopOf) {
        if (!ent.alive(dwarf)) continue;
        const s = (shares.get(shop.role) ?? shares.set(shop.role, {}).get(shop.role)!);
        s['samples'] = (s['samples'] ?? 0) + 1;
        const jobId = ent.get(dwarf, C.Worker)?.jobId ?? 0;
        const brain = ent.get(dwarf, C.Brain);
        const at = [...ent.with(C.Workshop)].find((sid) => ent.get(sid, C.Workshop)?.assignedWorker === dwarf && ent.get(sid, C.Workshop)?.currentJobId === jobId);
        if (jobId === 0 || brain?.behavior !== 'work' || at === undefined) continue;
        const st = jobsReader.get(jobId)?.state ?? '';
        const carrying = ent.get(dwarf, C.Worker)?.carrying ?? 0;
        const k = st === 'working' ? 'work' : carrying !== 0 ? 'carry' : 'walk';
        s[k] = (s[k] ?? 0) + 1;
        // The smith's two workshops apart.
        if (shop.role === 'forge') { const own = roleOf(at) ?? '?'; s[`${own} ${k}`] = (s[`${own} ${k}`] ?? 0) + 1; }
      }
    };
    const print = (label: string): void => {
      const r = (x: number, d: number): number => d === 0 ? 0 : Math.round((10 * x) / d) / 10;
      for (const [k, a] of [...agg].sort((x, y) => x[0].localeCompare(y[0]))) {
        const types = Object.entries(a.byType).map(([t, b]) => `${t} ${r(b.pickups, a.jobs)}/job ${r(b.units, b.pickups)}u ${r(b.fromShop, b.pickups)} steps`).join('; ');
        console.log(`[t660jobs] ${SEED}@${SHIFT} ${label} ${k}: ${a.jobs} jobs, claims ${r(a.claims, a.jobs)}/job (once ${a.once}), reserved ${r(a.reserved, a.jobs)}/job, trips ${r(a.pickups, a.jobs)}/job (${r(a.pickedUnits, a.pickups)}u), interrupts ${r(a.interrupts, a.jobs)}/job, lapses ${r(a.lapses, a.jobs)}/job (${r(a.lapsedUnits, a.jobs)}u), dropped ${a.dropped} | ${types}`);
      }
      for (const [role, s] of [...shares].sort((x, y) => x[0].localeCompare(y[0]))) {
        const n = s['samples'] ?? 0;
        const p = (k: string): number => n === 0 ? 0 : Math.round((1000 * (s[k] ?? 0)) / n) / 10;
        const extra = role === 'forge' ? `; forge ${p('forge work')}/${p('forge walk')}/${p('forge carry')}, smelter_2 ${p('smelter_2 work')}/${p('smelter_2 walk')}/${p('smelter_2 carry')}` : '';
        console.log(`[t660share] ${SEED}@${SHIFT} ${label} ${role}: ${Math.round((n * EVERY) / TICKS_PER_DAY)} dwarf-days, working ${p('work')}%, walking empty ${p('walk')}%, carrying ${p('carry')}%${extra}`);
      }
      for (const [role, rr] of [...shopStates].sort((x, y) => x[0].localeCompare(y[0]))) {
        const n = Object.values(rr).reduce((a, b) => a + b, 0);
        console.log(`[t660shop] ${SEED}@${SHIFT} ${label} ${role}: ${Object.entries(rr).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((1000 * v) / n) / 10}%`).join(', ')}`);
      }
      for (const [k, c] of [...openDoing].sort((x, y) => x[0].localeCompare(y[0]))) {
        const n = Object.values(c).reduce((a, b) => a + b, 0);
        console.log(`[t660open] ${SEED}@${SHIFT} ${label} ${k} (${n} samples), its worker: ${Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([x, v]) => `${x} ${Math.round((1000 * v) / n) / 10}%`).join(', ')}`);
      }
      for (const [k, c] of [...causes].sort((x, y) => x[0].localeCompare(y[0]))) {
        console.log(`[t660why] ${SEED}@${SHIFT} ${label} ${k}: ${Object.entries(c).sort((a, b) => b[1] - a[1]).map(([x, v]) => `${x} ${v}`).join(', ')}`);
      }
      for (const [k, g] of [...gaps].sort((x, y) => x[0].localeCompare(y[0]))) {
        console.log(`[t660next] ${SEED}@${SHIFT} ${label} ${k}: ${g.n} interruptions, next claim after ${r(g.ticks, g.n)} ticks: ${Object.entries(g.next).sort((a, b) => b[1] - a[1]).map(([x, v]) => `${x} ${v}`).join(', ')}`);
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
    for (const line of journal) console.log(`[t660journal] ${SEED}@${SHIFT} ${line}`);
    print('ALL');
  }, 7_200_000);
});
