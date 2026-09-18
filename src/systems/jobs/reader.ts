/**
 * `readers.of('11')`: `02-systems/11-jobs-and-labor.md` § Interfaces › Reader. Arrays and jobs
 * returned are fresh copies.
 */

import type { EntityId } from '@core/types';
import type { JobBoard } from './board';
import type { Job, JobState } from './state';

export interface JobCounts {
  readonly open: number;
  readonly claimed: number;
  readonly blocked: number;
  /** Blocked jobs by reason, for the summary line ("6 blocked (4 unreachable, 2 missing materials)"). */
  readonly byReason: Readonly<Record<string, number>>;
}

export interface JobsReader {
  list(state?: JobState): Job[];
  get(id: number): Job | undefined;
  byKey(key: string): Job | undefined;
  forWorker(dwarfId: EntityId): Job | undefined;
  blockedReason(id: number): string | null;
  counts(): JobCounts;
  /** `labor` is a labor id or registry index. */
  laborEnabled(dwarfId: EntityId, labor: string | number): boolean;
  laborPriority(labor: string | number): number;
  workersWithLabor(labor: string | number): EntityId[];
  standingOrder(name: string): boolean;
  /** 13's "wants hauling" set size (M2); 0 until items exist. */
  wantsHaulingCount(): number;
  /** The job type id of a job. */
  typeOf(id: number): string | null;
  /** True while a worker waits in the assignment queue. */
  isQueued(dwarfId: EntityId): boolean;
  /** `jobs.hasUrgent(id, priority)` of the dwarf brain. */
  hasUrgent(dwarfId: EntityId, priority: number): boolean;
}

function copy(job: Job | undefined): Job | undefined {
  if (job === undefined) return undefined;
  return {
    ...job,
    target: { ...job.target },
    inputs: job.inputs.map((i) => ({ ...i, filter: { ...i.filter }, reserved: i.reserved.slice(), delivered: i.delivered.slice() })),
    data: { ...job.data },
  };
}

export function makeReader(board: JobBoard): JobsReader {
  const laborIdx = (labor: string | number): number => (typeof labor === 'number' ? labor : board.laborOf(labor));
  const claimedStates: readonly JobState[] = ['claimed', 'fetching', 'travelling', 'working', 'completing'];
  return {
    list: (state) =>
      board.ids
        .map((id) => board.jobs.get(id) as Job)
        .filter((j) => state === undefined || j.state === state)
        .map((j) => copy(j) as Job),
    get: (id) => copy(board.jobs.get(id)),
    byKey: (key) => copy(board.byKey(key) as Job | undefined),
    forWorker: (dwarfId) => {
      const jobId = board.workerOf(dwarfId).jobId;
      return jobId === 0 ? undefined : copy(board.jobs.get(jobId));
    },
    blockedReason: (id) => board.jobs.get(id)?.blockedReason ?? null,
    counts: () => {
      let open = 0;
      let claimed = 0;
      let blocked = 0;
      const byReason: Record<string, number> = {};
      for (const id of board.ids) {
        const j = board.jobs.get(id) as Job;
        if (j.state === 'open') open += 1;
        else if (claimedStates.includes(j.state)) claimed += 1;
        else if (j.state === 'blocked') {
          blocked += 1;
          const r = j.blockedReason ?? 'unknown';
          byReason[r] = (byReason[r] ?? 0) + 1;
        }
      }
      return { open, claimed, blocked, byReason };
    },
    laborEnabled: (dwarfId, labor) => board.laborEnabled(dwarfId, laborIdx(labor)),
    laborPriority: (labor) => board.laborPriorities[laborIdx(labor)] ?? 0,
    workersWithLabor: (labor) => board.workers().filter((w) => board.laborEnabled(w, laborIdx(labor))),
    standingOrder: (name) => board.standingOrders[name] === true,
    wantsHaulingCount: () => 0,
    typeOf: (id) => {
      const j = board.jobs.get(id);
      return j === undefined ? null : board.typeId(j);
    },
    isQueued: (dwarfId) => board.isQueued(dwarfId),
    hasUrgent: (dwarfId, priority) => board.hasUrgent(dwarfId, priority),
  };
}
