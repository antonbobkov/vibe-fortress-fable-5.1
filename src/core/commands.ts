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
import { isTypedArray } from './serialize';
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

/** Diagnostic history may contain bad payloads; simulation state must remain plain data. */
function diagnosticCommand(command: Command): Command {
  let changed = false;
  const ancestors = new Set<object>();
  const invalid = (kind: string, value?: string): Record<string, string> => {
    changed = true;
    return value === undefined ? { $invalid: kind } : { $invalid: kind, value };
  };
  const visit = (value: unknown): unknown => {
    if (typeof value === 'number' && !Number.isFinite(value)) return invalid(String(value));
    if (typeof value === 'bigint') return invalid('bigint', value.toString());
    if (typeof value === 'function' || typeof value === 'symbol') return invalid(typeof value);
    if (value === null || typeof value !== 'object') return value;
    if (ancestors.has(value)) return invalid('circular');
    ancestors.add(value);
    try {
      if (isTypedArray(value)) return value;
      if (Array.isArray(value)) return value.map(visit);
      if (value instanceof Map) return new Map([...value].map(([key, field]) => [visit(key), visit(field)]));
      if (value instanceof Set) return new Set([...value].map(visit));
      const prototype = Object.getPrototypeOf(value) as unknown;
      if (prototype !== Object.prototype && prototype !== null) return invalid('object');
      const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const key of Object.keys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        out[key] = descriptor !== undefined && 'value' in descriptor
          ? visit(descriptor.value) : invalid('accessor');
      }
      return out;
    } catch {
      return invalid('unreadable');
    } finally {
      ancestors.delete(value);
    }
  };
  const data = visit(command) as Command;
  // Keep ordinary commands and their existing canonical representation untouched.
  return changed ? { ...data, type: command.type } : command;
}

/** Every field but `tiles` equal, so two designation commands differ only in their tiles. */
function sameExceptTiles(a: Command, b: Command): boolean {
  if (a.type !== b.type || !Array.isArray(a['tiles']) || !Array.isArray(b['tiles'])) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete('tiles');
  for (const key of Array.from(keys).sort()) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return false;
  }
  return true;
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
  append(tick: Tick, command: Command, result: CommandResult): Command {
    const recorded = diagnosticCommand(command);
    const last = this.entries[this.entries.length - 1];
    if (
      last !== undefined &&
      last.tick === tick &&
      sameResult(last.result, result) &&
      sameExceptTiles(last.command, recorded)
    ) {
      const merged = [
        ...(last.command['tiles'] as number[]),
        ...(recorded['tiles'] as number[]),
      ];
      last.command = { ...last.command, tiles: merged };
      last.count += 1;
      return recorded;
    }
    this.entries.push({ tick, command: recorded, result, count: 1 });
    return recorded;
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
    return this.entries.map((e) => ({ ...e, command: { ...diagnosticCommand(e.command) } }));
  }

  deserialize(entries: readonly CommandLogEntry[]): void {
    this.entries = entries.map((e) => ({ ...e, command: { ...e.command } }));
  }

  clear(): void {
    this.entries = [];
  }
}
