/**
 * 11's commands: `04-implementation/command-catalog.md` rows `SetLabor`, `SetLaborPriority`,
 * `CancelJob`, `SetJobPriority`, `SetStandingOrder`.
 */

import { C } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import { PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import type { EntityId, Priority } from '@core/types';
import type { JobBoard } from './board';

function laborIndex(board: JobBoard, raw: unknown): number {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0 && raw < board.laborPriorities.length) return raw;
  if (typeof raw === 'string') return board.laborOf(raw);
  return 0;
}

function priorityOf(raw: unknown): Priority | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < PRIORITY_MIN || raw > PRIORITY_MAX) return null;
  return raw as Priority;
}

/**
 * `SetLabor { dwarfId, labor, on }`: "adult (children: `child_labor`); `hauling` cannot be turned
 * off for children"; retries jobs blocked on `no_worker` (`JobUnblocked retries`).
 */
export function applySetLabor(board: JobBoard, cmd: Command): CommandResult {
  const id = cmd['dwarfId'] as EntityId;
  const entities = board.world.entities;
  if (typeof id !== 'number' || !entities.alive(id) || !entities.has(id, C.Labors)) return reject('not_found');
  const labor = laborIndex(board, cmd['labor']);
  if (labor === 0) return reject('not_found');
  if (board.isChild(id)) return reject('child_labor');
  const on = cmd['on'] === true;
  const labors = entities.get(id, C.Labors);
  if (labors === undefined) return reject('not_found');
  const enabled = labors.enabled.slice();
  const byte = labor >> 3;
  const bit = 1 << (labor & 7);
  enabled[byte] = on ? ((enabled[byte] ?? 0) as number) | bit : ((enabled[byte] ?? 0) as number) & ~bit;
  entities.add(id, C.Labors, { enabled });
  board.trigger('no_worker');
  board.trigger('unreachable');
  return OK;
}

/** `SetLaborPriority { labor, priority }`: 1–9. */
export function applySetLaborPriority(board: JobBoard, cmd: Command): CommandResult {
  const labor = laborIndex(board, cmd['labor']);
  if (labor === 0) return reject('not_found');
  const priority = priorityOf(cmd['priority']);
  if (priority === null) return reject('out_of_range');
  board.laborPriorities[labor] = priority;
  return OK;
}

/** `CancelJob { jobId }`: "job exists and is cancellable (not `completing`)". */
export function applyCancelJob(board: JobBoard, cmd: Command): CommandResult {
  const job = board.jobs.get(cmd['jobId'] as number);
  if (job === undefined) return reject('not_found');
  if (job.state === 'completing' || job.state === 'done' || job.state === 'cancelled') return reject('not_cancellable');
  board.cancel(job.id, 'player');
  return OK;
}

/** `SetJobPriority { jobId, priority }`: "job open or claimed". */
export function applySetJobPriority(board: JobBoard, cmd: Command): CommandResult {
  const job = board.jobs.get(cmd['jobId'] as number);
  if (job === undefined) return reject('not_found');
  const priority = priorityOf(cmd['priority']);
  if (priority === null) return reject('out_of_range');
  if (job.state !== 'open' && job.state !== 'claimed') return reject('precondition_failed');
  job.priority = priority;
  return OK;
}

/** `SetStandingOrder { name, on }`: "known name". */
export function applySetStandingOrder(board: JobBoard, cmd: Command): CommandResult {
  const name = cmd['name'];
  if (typeof name !== 'string' || !(name in board.standingOrders)) return reject('not_found');
  board.standingOrders[name] = cmd['on'] === true;
  return OK;
}
