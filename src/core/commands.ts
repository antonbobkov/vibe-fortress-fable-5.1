/**
 * The command queue and the command log.
 *
 * Implements `01-architecture/simulation-core.md` § Commands: commands are applied at the start of
 * a tick in submission order; a command is never applied partially; the log keeps every command of
 * the current season with its tick and its result and is saved and replayable; consecutive
 * designation commands with identical parameters are coalesced into one log entry but applied
 * individually.
 */

import { COMMAND_OWNERS, isCommandType, type CommandType, type RejectReason } from './command-types';
import type { Tick } from './types';

/** A plain record with a `type` and typed fields. */
export interface Command {
  readonly type: CommandType;
  readonly [field: string]: unknown;
}

export type CommandResult = { readonly ok: true } | { readonly ok: false; readonly reason: RejectReason };

export const OK: CommandResult = Object.freeze({ ok: true as const });

export function reject(reason: RejectReason): CommandResult {
  return Object.freeze({ ok: false as const, reason });
}

/** The owning system of a command, from the command table. */
export function ownerOf(type: CommandType): string {
  const owner = COMMAND_OWNERS[type];
  if (owner === undefined) throw new RangeError(`no owner for command ${type}`);
  return owner;
}

/** FIFO. Drained by the tick's command phase, or immediately by the paused host. */
export class CommandQueue {
  private pending: Command[] = [];

  get size(): number {
    return this.pending.length;
  }

  submit(command: Command): void {
    if (!isCommandType(command.type)) {
      throw new RangeError(`unknown command type: ${String(command.type)}`);
    }
    this.pending.push(command);
  }

  /** Take the whole queue in submission order, leaving it empty. */
  drain(): Command[] {
    const batch = this.pending;
    this.pending = [];
    return batch;
  }

  peek(): readonly Command[] {
    return this.pending;
  }

  clear(): void {
    this.pending = [];
  }
}

export interface CommandLogEntry {
  tick: Tick;
  command: Command;
  result: CommandResult;
  /** How many submitted commands this entry stands for after coalescing. */
  count: number;
}

/** Every field but `tiles` equal, so two designation commands differ only in their tiles. */
function sameExceptTiles(a: Command, b: Command): boolean {
  if (a.type !== b.type) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete('tiles');
  for (const key of Array.from(keys).sort()) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return false;
  }
  return Array.isArray(a['tiles']) && Array.isArray(b['tiles']);
}

function sameResult(a: CommandResult, b: CommandResult): boolean {
  if (a.ok !== b.ok) return false;
  return a.ok || b.ok || a.reason === b.reason;
}

/**
 * The command log of the current season. Small enough to save; `scripts/replay.mjs` replays it.
 */
export class CommandLog {
  private entries: CommandLogEntry[] = [];

  get length(): number {
    return this.entries.length;
  }

  /** Append, coalescing consecutive tile commands that differ only in their tiles. */
  append(tick: Tick, command: Command, result: CommandResult): void {
    const last = this.entries[this.entries.length - 1];
    if (
      last !== undefined &&
      last.tick === tick &&
      sameResult(last.result, result) &&
      sameExceptTiles(last.command, command)
    ) {
      const merged = [
        ...(last.command['tiles'] as number[]),
        ...(command['tiles'] as number[]),
      ];
      last.command = { ...last.command, tiles: merged };
      last.count += 1;
      return;
    }
    this.entries.push({ tick, command, result, count: 1 });
  }

  all(): readonly CommandLogEntry[] {
    return this.entries;
  }

  /** The entries of one tick, in submission order. */
  atTick(tick: Tick): readonly CommandLogEntry[] {
    return this.entries.filter((e) => e.tick === tick);
  }

  /** Called at `SeasonChanged`: the log keeps only the current season. */
  startSeason(): void {
    this.entries = [];
  }

  serialize(): CommandLogEntry[] {
    return this.entries.map((e) => ({ ...e, command: { ...e.command } }));
  }

  deserialize(entries: readonly CommandLogEntry[]): void {
    this.entries = entries.map((e) => ({ ...e, command: { ...e.command } }));
  }

  clear(): void {
    this.entries = [];
  }
}
