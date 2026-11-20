/**
 * Why nobody has taken an open job (`panels.md` § Jobs, `11` § Assignment): the line the Jobs panel
 * writes under the list for a job open more than a day, and the words any panel can give for a job
 * that waits (the Add order panel's placed workshop whose build nobody starts).
 *
 * It reads the dwarves who could take the job, as 11's assignment offers it: those with its labor
 * (or the one dwarf it is for), less the soldiers on duty, the hurt and those sheltering under the
 * Hearth alert. When none of the rest holds the tool the job needs, no tool of that kind is free, and
 * one who cannot use it now holds it, the job waits for that tool (11 § Assignment: a dwarf without
 * the tool leaves the job to one who carries it). Of the rest, priority is strict and a job does not age, so a job waits while more
 * urgent jobs are open to them, or while every one of them is at another job. A free dwarf who has
 * not taken it is out of reach of it, at a need, or kept from it by something the panel does not see.
 *
 * Presentation only: every function reads, none writes.
 */

import { C } from '@core/components';
import { PRIORITY_DEFAULT } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import type { CombatReader } from '@systems/combat';
import type { DwarvesReader } from '@systems/dwarves';
import type { HealthReader } from '@systems/health';
import type { ItemsReader } from '@systems/items';
import type { Job, JobsReader } from '@systems/jobs';
import { jobBlockText, type MessageEnv } from './messages';

/** Why an open job waits, most decisive first. */
export type JobWaitReason = 'no_labor' | 'on_duty' | 'hurt' | 'sheltering' | 'away' | 'tool_held' | 'ahead' | 'busy' | 'unreachable' | 'needs' | 'not_taken';

export interface JobWait {
  readonly reason: JobWaitReason;
  readonly text: string;
}

/** The labor a job needs: its own `labor` (a build names its building's), else its type's; '' for none. */
export function jobLabor(env: Omit<MessageEnv, 'strings' | 'readers'>, job: Pick<Job, 'type' | 'data'>): string {
  const own = job.data['labor'];
  if (typeof own === 'string') return own;
  return env.registry.table<{ id: string; labor?: string }>('jobTypes').byIndex(job.type)?.labor ?? '';
}

/**
 * Why a job waits, in words: an open job's {@link jobWait}, a blocked job's reason as the Jobs panel
 * gives it under the list; null for a job someone holds, or an open job with no labor.
 */
export function jobWaitText(env: MessageEnv, job: Job): string | null {
  if (job.state === 'open') return jobWait(env, job)?.text ?? null;
  if (job.state === 'blocked' && job.blockedReason !== null) return jobBlockText(env, job).long;
  return null;
}

/** The tile a job is done at or beside: its target tile, its anchor, its building's origin, or its creature's or item's tile. */
function jobTile(env: MessageEnv, job: Job): TileIndex {
  if (job.target.kind === 'tile') return job.target.ref;
  const anchor = job.data['anchorTile'];
  if (typeof anchor === 'number') return anchor;
  const building = env.readers.entities.get(job.target.ref, C.Building);
  if (building) return building.origin;
  const p = env.readers.entities.get(job.target.ref, C.Position);
  return p === undefined ? -1 : env.readers.map.index(p.x, p.y, p.z);
}

/** Whether a dwarf can walk to the job's tile or beside it (a dig's rock, a build's footprint). */
function canReach(env: MessageEnv, from: EntityId, tile: TileIndex): boolean {
  if (!env.readers.has('pathing') || tile < 0) return true;
  const pos = env.readers.entities.get(from, C.Position);
  if (pos === undefined) return false;
  const map = env.readers.map;
  const start = map.index(pos.x, pos.y, pos.z);
  const tx = tile % map.w;
  const ty = Math.floor(tile / map.w) % map.h;
  const tz = Math.floor(tile / (map.w * map.h));
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = tx + dx; const y = ty + dy; const z = tz + dz;
        if (x < 0 || y < 0 || z < 0 || x >= map.w || y >= map.h || z >= map.d) continue;
        if (dz !== 0 && (dx !== 0 || dy !== 0)) continue;
        if (env.readers.pathing.reachable(start, map.index(x, y, z), 'walker')) return true;
      }
    }
  }
  return false;
}

/**
 * Why nobody has taken an open job (`panels.md` § Jobs): no dwarf has its labor; every one who has it
 * is on duty, hurt or in shelter; more urgent jobs are open to them; every one is at another job;
 * no free one can reach it; the free ones are eating, drinking or asleep; or none of those (a skill,
 * a tool another holds, a danger near it). Null for a job that is not open or needs no labor.
 */
export function jobWait(env: MessageEnv, job: Job): JobWait | null {
  if (job.state !== 'open' || !env.readers.has('11')) return null;
  const s = env.strings;
  const jobs = env.readers.of<JobsReader>('11');
  const laborId = jobLabor(env, job);
  const laborRow = laborId === '' ? undefined : env.registry.table<{ id: string; name: string }>('labors').byId(laborId);
  if (laborRow === undefined) return null;
  const labor = laborRow.name.toLowerCase();
  const name = (id: EntityId): string => env.readers.entities.get(id, C.Creature)?.name ?? '';
  const assigned = typeof job.data['assignedWorker'] === 'number' ? job.data['assignedWorker'] : 0;
  const withLabor = jobs.workersWithLabor(laborId).filter((id) => env.readers.entities.alive(id));
  const workers = assigned !== 0 ? withLabor.filter((id) => id === assigned) : withLabor;
  if (workers.length === 0) {
    return assigned !== 0 && env.readers.entities.alive(assigned)
      ? { reason: 'no_labor', text: s.get('ui.job_wait.no_labor_for', { name: name(assigned), labor }) }
      : { reason: 'no_labor', text: s.get('ui.job_wait.no_labor', { labor }) };
  }
  const one = workers.length === 1;
  const first = workers[0] as EntityId;
  const form = assigned !== 0 ? 'for' : one ? 'one' : 'many';
  const who = s.get(`ui.job_wait.who.${form}`, { name: name(first), n: workers.length, labor });
  const whom = s.get(`ui.job_wait.whom.${form}`, { name: name(first), n: workers.length, labor });
  const number = one ? 'one' : 'many';
  const say = (reason: JobWaitReason, params: Readonly<Record<string, string | number>> = {}): JobWait =>
    ({ reason, text: s.get(`ui.job_wait.${reason}.${number}`, { who, whom, labor, ...params }) });

  const combat = env.readers.has('16') ? env.readers.of<CombatReader>('16') : null;
  const health = env.readers.has('17') ? env.readers.of<HealthReader>('17') : null;
  const dwarves = env.readers.has('10') ? env.readers.of<DwarvesReader>('10') : null;
  let duty = 0; let hurt = 0; let sheltering = 0;
  const available: EntityId[] = [];
  for (const id of workers) {
    const behavior = dwarves?.behavior(id) ?? '';
    if (combat?.onDuty(id) === true) duty += 1;
    else if ((health !== null && (!health.isConscious(id) || health.isPatient(id))) || behavior === 'patient') hurt += 1;
    else if (behavior === 'retreat') sheltering += 1;
    else available.push(id);
  }
  if (available.length === 0) {
    if (duty === workers.length) return say('on_duty');
    if (hurt === workers.length) return say('hurt');
    if (sheltering === workers.length) return say('sheltering');
    return { reason: 'away', text: s.get('ui.job_wait.away', { whom, labor }) };
  }

  const held = toolHeld(env, job, workers, available);
  if (held !== null) return held;

  // Priority is strict (11 § Assignment): a job more urgent than this one, open to any of them, comes first.
  const effective = (j: Pick<Job, 'priority' | 'type' | 'data'>): number => {
    const l = jobLabor(env, j);
    return j.priority + (l === '' ? PRIORITY_DEFAULT : jobs.laborPriority(l)) - PRIORITY_DEFAULT;
  };
  const mine = effective(job);
  const openTo = new Map<string, boolean>();
  let ahead = 0;
  for (const other of jobs.list('open')) {
    if (other.id === job.id || effective(other) >= mine) continue;
    const l = jobLabor(env, other);
    if (l === '') continue;
    const only = typeof other.data['assignedWorker'] === 'number' ? other.data['assignedWorker'] : 0;
    if (only !== 0) { if (available.includes(only) && jobs.laborEnabled(only, l)) ahead += 1; continue; }
    let open = openTo.get(l);
    if (open === undefined) { open = available.some((id) => jobs.laborEnabled(id, l)); openTo.set(l, open); }
    if (open) ahead += 1;
  }
  if (ahead > 0) {
    const count = s.get(ahead === 1 ? 'ui.job_wait.jobs.one' : 'ui.job_wait.jobs.many', { n: ahead });
    return { reason: 'ahead', text: s.get('ui.job_wait.ahead', { jobs: count, whom }) };
  }
  const free = available.filter((id) => jobs.forWorker(id) === undefined);
  if (free.length === 0) return say('busy');
  const tile = jobTile(env, job);
  if (!free.some((id) => canReach(env, id, tile))) return { reason: 'unreachable', text: s.get('ui.job_wait.unreachable', { labor }) };
  if (free.every((id) => { const b = dwarves?.behavior(id) ?? ''; return b === 'need' || b === 'social'; })) {
    return { reason: 'needs', text: s.get(`ui.job_wait.needs.${free.length === available.length ? number : 'many'}`, { who, whom, labor }) };
  }
  const idle = free.length === 1 ? 'one' : 'many';
  return { reason: 'not_taken', text: s.get(`ui.job_wait.not_taken.${idle}`, { name: name(free[0] as EntityId), n: free.length, labor }) };
}

/** The item category of a job's tool, as 11 searches for it; absent for no tool or one the panel does not name. */
const TOOL_CATEGORY: Readonly<Record<string, string>> = { pick: 'tool/pick', axe: 'tool/axe', ranged: 'weapon/ranged' };

/** Whether a dwarf holds a tool of that category: its `Worker.toolId` or its weapon slot, in its hands. */
function holdsTool(env: MessageEnv, items: ItemsReader, id: EntityId, category: string): boolean {
  for (const itemId of [env.readers.entities.get(id, C.Worker)?.toolId ?? 0, env.readers.entities.get(id, C.Equipment)?.weapon ?? 0]) {
    const item = itemId === 0 ? undefined : items.get(itemId);
    if (item !== undefined && item.carriedBy === id && items.categoryOf(item.type) === category) return true;
  }
  return false;
}

/**
 * T-661: a job that needs a tool waits on it when none of the dwarves who could take it holds one, none
 * is free in stock, and a dwarf with its labor who cannot use it now (in the hospital, hurt, on duty, in
 * shelter) holds one: "the only axe is with Urist, in the hospital". 11 puts such a tool down for the
 * fortress after a while (§ Assignment), except a soldier's only weapon.
 */
function toolHeld(env: MessageEnv, job: Job, workers: readonly EntityId[], available: readonly EntityId[]): JobWait | null {
  const category = job.tool === null ? undefined : TOOL_CATEGORY[job.tool];
  if (category === undefined || job.tool === null || !env.readers.has('13')) return null;
  const items = env.readers.of<ItemsReader>('13');
  if (available.some((id) => holdsTool(env, items, id, category))) return null;
  if (items.countAvailable({ category }) > 0) return null;
  const holders = workers.filter((id) => !available.includes(id) && holdsTool(env, items, id, category));
  const first = holders[0];
  if (first === undefined) return null;
  const s = env.strings;
  const combat = env.readers.has('16') ? env.readers.of<CombatReader>('16') : null;
  const health = env.readers.has('17') ? env.readers.of<HealthReader>('17') : null;
  const patient = env.readers.entities.get(first, C.Patient);
  const where = combat?.onDuty(first) === true ? 'duty'
    : patient !== undefined && patient.hospitalZoneId !== 0 ? 'hospital'
      : patient !== undefined || (health !== null && !health.isConscious(first)) ? 'hurt' : 'shelter';
  const params = {
    name: env.readers.entities.get(first, C.Creature)?.name ?? '',
    where: s.get(`ui.job_wait.tool_where.${where}`),
    tool: s.get(`ui.job_wait.tool.${job.tool}.one`),
    tools: s.get(`ui.job_wait.tool.${job.tool}.many`),
    n: holders.length,
  };
  return { reason: 'tool_held', text: s.get(`ui.job_wait.tool_held.${holders.length === 1 ? 'one' : 'many'}`, params) };
}
