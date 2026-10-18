import type { Command, CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import type { TestWorld } from './test-world';

/**
 * T-156: the commands of a long script and what became of them. A script sends every command
 * through `command`, which throws on a rejection the script did not name, so a step that stops
 * happening fails the run instead of passing unseen. The record is kept per `TestWorld` (it
 * survives a load, which replaces the world's game), with no prototype patching.
 */
export interface ScriptRecord {
  /** Accepted commands by type. */
  readonly accepted: Map<CommandType, number>;
  /** Rejected commands by `type:reason`, the expected ones only (an unexpected one throws). */
  readonly rejected: Map<string, number>;
}

const records = new WeakMap<TestWorld, ScriptRecord>();

/** The record of a world's script commands, created on first use. */
export function scriptRecord(w: TestWorld): ScriptRecord {
  let record = records.get(w);
  if (record === undefined) {
    record = { accepted: new Map(), rejected: new Map() };
    records.set(w, record);
  }
  return record;
}

/** Thrown for a command rejected for a reason its script did not expect. */
export class UnexpectedRejection extends Error {}

/**
 * Apply a script command. `expected` names the rejection reasons the script allows at this step
 * (an order already at its target, a site taken since the script looked); any other rejection
 * throws `UnexpectedRejection` with the command and the reason.
 */
export function command(w: TestWorld, cmd: Command, expected: readonly string[] = []): CommandResult {
  const result = w.game.world.applyCommand(cmd);
  const record = scriptRecord(w);
  if (result.ok) {
    record.accepted.set(cmd.type, (record.accepted.get(cmd.type) ?? 0) + 1);
    return result;
  }
  if (!expected.includes(result.reason)) {
    throw new UnexpectedRejection(`tick ${w.tick}: ${cmd.type} rejected (${result.reason}): ${JSON.stringify(cmd).slice(0, 300)}`);
  }
  const key = `${cmd.type}:${result.reason}`;
  record.rejected.set(key, (record.rejected.get(key) ?? 0) + 1);
  return result;
}

/** Events seen by the world since tick 0, counted by type. */
export function eventCounts(w: TestWorld): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of w.allEvents()) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  return counts;
}
