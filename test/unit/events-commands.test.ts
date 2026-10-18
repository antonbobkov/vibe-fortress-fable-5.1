import { describe, it, expect } from 'vitest';
import { EventDispatchTable, EventListeners, EventQueue } from '@core/events';
import { CommandLog, CommandQueue, OK, ownerOf, reject } from '@core/commands';
import {
  COMMAND_FIELDS,
  COMMAND_OWNERS,
  COMMAND_TYPES,
  APP_COMMAND_TYPES,
  REJECT_REASONS,
  isCommandType,
  rejectStringKey,
} from '@core/command-types';
import { EVENT_FIELDS, EVENT_TYPES, isEventType } from '@core/event-types';
import type { EventType } from '@core/event-types';
// The catalogs are the authority; the generated modules are compared against a fresh parse.
// @ts-expect-error -- a plain .mjs script without type declarations
import { parseAppCommands, parseCommands, parseEvents, parseRejectReasons } from '../../scripts/parse-catalogs.mjs';

describe('T-M0-07 events: the queue is FIFO, one batch per tick', () => {
  it('drains in emission order', () => {
    const q = new EventQueue();
    q.emit({ type: 'HourPassed', hour: 1 });
    q.emit({ type: 'DayPassed', dayOfSeason: 1, season: 0, year: 1 });
    q.emit({ type: 'YearPassed', year: 2 });
    expect(q.size).toBe(3);
    expect(q.drain().map((e) => e.type)).toEqual(['HourPassed', 'DayPassed', 'YearPassed']);
    expect(q.size).toBe(0);
    expect(q.drain()).toEqual([]);
  });

  it('events emitted during dispatch land in the next tick', () => {
    const q = new EventQueue();
    q.emit({ type: 'HourPassed', hour: 1 });
    const batch = q.drain();
    // A handler reacting to the batch emits; that must not be delivered in this batch.
    for (const event of batch) {
      if (event.type === 'HourPassed') q.emit({ type: 'DwarfIdle', id: 1 });
    }
    expect(batch.map((e) => e.type)).toEqual(['HourPassed']);
    expect(q.drain().map((e) => e.type)).toEqual(['DwarfIdle']);
  });

  it('peek does not remove', () => {
    const q = new EventQueue();
    q.emit({ type: 'DwarfIdle', id: 1 });
    expect(q.peek()).toHaveLength(1);
    expect(q.size).toBe(1);
  });

  it('a sealed queue refuses emissions, which is how listeners are kept read-only', () => {
    const q = new EventQueue();
    q.seal();
    expect(q.isSealed).toBe(true);
    expect(() => q.emit({ type: 'DwarfIdle', id: 1 })).toThrow(/presentation listener/);
    q.unseal();
    q.emit({ type: 'DwarfIdle', id: 1 });
    expect(q.size).toBe(1);
    q.clear();
    expect(q.size).toBe(0);
  });
});

describe('T-M0-07 events: listeners and the dispatch table', () => {
  it('listeners receive whole batches in registration order and can unsubscribe', () => {
    const listeners = new EventListeners();
    const seen: string[] = [];
    const off = listeners.add((events) => seen.push(`a:${events.length}`));
    listeners.add((events) => seen.push(`b:${events.length}`));
    listeners.deliver([{ type: 'DwarfIdle', id: 1 }]);
    expect(seen).toEqual(['a:1', 'b:1']);
    off();
    listeners.deliver([{ type: 'DwarfIdle', id: 2 }]);
    expect(seen).toEqual(['a:1', 'b:1', 'b:1']);
    expect(listeners.count).toBe(1);
  });

  it('an empty batch is not delivered', () => {
    const listeners = new EventListeners();
    let calls = 0;
    listeners.add(() => {
      calls += 1;
    });
    listeners.deliver([]);
    expect(calls).toBe(0);
  });

  it('the dispatch table keeps subscribers in system order', () => {
    const systems = [
      { id: 'a', subscribes: ['HourPassed', 'DayPassed'] as EventType[] },
      { id: 'b', subscribes: ['HourPassed'] as EventType[] },
      { id: 'c', subscribes: [] as EventType[] },
    ];
    const table = new EventDispatchTable(systems);
    expect(table.subscribersTo('HourPassed').map((s) => s.id)).toEqual(['a', 'b']);
    expect(table.subscribersTo('DayPassed').map((s) => s.id)).toEqual(['a']);
    expect(table.subscribersTo('YearPassed')).toEqual([]);
    expect(table.types()).toEqual(['DayPassed', 'HourPassed']);
  });
});

describe('T-M0-07 commands: the queue is FIFO', () => {
  it('drains in submission order', () => {
    const q = new CommandQueue();
    q.submit({ type: 'SetAlert', level: 'watchful' });
    q.submit({ type: 'RenameFortress', name: 'Ironvein' });
    expect(q.size).toBe(2);
    expect(q.drain().map((c) => c.type)).toEqual(['SetAlert', 'RenameFortress']);
    expect(q.size).toBe(0);
  });

  it('rejects an unknown command type', () => {
    const q = new CommandQueue();
    expect(() => q.submit({ type: 'Nonsense' as never })).toThrow(RangeError);
  });

  it('routes by the catalog owner table', () => {
    expect(ownerOf('Designate')).toBe('03');
    expect(ownerOf('SetPopulationCap')).toBe('21');
    expect(ownerOf('RenameFortress')).toBe('core');
  });
});

describe('T-M0-07 commands: the log', () => {
  const tiles = (...t: number[]): { type: 'Designate'; tiles: number[]; kind: number; priority: number } => ({
    type: 'Designate',
    tiles: t,
    kind: 1,
    priority: 5,
  });

  it('records the tick, the command and the result', () => {
    const log = new CommandLog();
    log.append(10, { type: 'SetAlert', level: 'watchful' }, OK);
    log.append(11, { type: 'SetPopulationCap', n: 5 }, reject('out_of_range'));
    expect(log.length).toBe(2);
    const entries = log.all();
    expect(entries[0]).toEqual({
      tick: 10,
      command: { type: 'SetAlert', level: 'watchful' },
      result: { ok: true },
      count: 1,
    });
    expect(entries[1]?.result).toEqual({ ok: false, reason: 'out_of_range' });
    expect(log.atTick(11)).toHaveLength(1);
  });

  it('coalesces consecutive designation commands with identical parameters', () => {
    const log = new CommandLog();
    log.append(5, tiles(1), OK);
    log.append(5, tiles(2), OK);
    log.append(5, tiles(3, 4), OK);
    expect(log.length).toBe(1);
    const entry = log.all()[0];
    expect(entry?.command['tiles']).toEqual([1, 2, 3, 4]);
    expect(entry?.count).toBe(3);
  });

  it('does not coalesce across ticks, priorities or results', () => {
    const log = new CommandLog();
    log.append(5, tiles(1), OK);
    log.append(6, tiles(2), OK);
    expect(log.length).toBe(2);

    const log2 = new CommandLog();
    log2.append(5, tiles(1), OK);
    log2.append(5, { ...tiles(2), priority: 9 }, OK);
    expect(log2.length).toBe(2);

    const log3 = new CommandLog();
    log3.append(5, tiles(1), OK);
    log3.append(5, tiles(2), reject('out_of_bounds'));
    expect(log3.length).toBe(2);

    const log4 = new CommandLog();
    log4.append(5, tiles(1), reject('out_of_bounds'));
    log4.append(5, tiles(2), reject('not_discovered'));
    expect(log4.length).toBe(2);
  });

  it('does not coalesce commands without a tiles field', () => {
    const log = new CommandLog();
    log.append(5, { type: 'SetAlert', level: 'calm' }, OK);
    log.append(5, { type: 'SetAlert', level: 'calm' }, OK);
    expect(log.length).toBe(2);
  });

  it('round-trips through serialize and starts a new season empty', () => {
    const log = new CommandLog();
    log.append(5, tiles(1, 2), OK);
    log.append(7, { type: 'SetAlert', level: 'hearth' }, OK);
    const saved = log.serialize();
    const restored = new CommandLog();
    restored.deserialize(saved);
    expect(restored.all()).toEqual(log.all());
    log.startSeason();
    expect(log.length).toBe(0);
    expect(restored.length).toBe(2);
  });
});

describe('T-M0-07 catalogs: the type unions contain every catalog name', () => {
  interface EventRow {
    name: string;
    fields: string;
  }
  interface CommandRow {
    name: string;
    fields: string;
    owner: string;
  }
  const events: EventRow[] = parseEvents();
  const commands: CommandRow[] = parseCommands();
  const appCommands: string[] = parseAppCommands();
  const reasons: string[] = parseRejectReasons();

  it('every event of the catalog is an EventType, in document order', () => {
    expect([...EVENT_TYPES]).toEqual(events.map((e) => e.name));
    expect(EVENT_TYPES.length).toBe(168);
  });

  it('every event keeps its documented field list', () => {
    for (const row of events) {
      expect(EVENT_FIELDS[row.name as EventType], row.name).toBe(row.fields);
    }
  });

  it('isEventType accepts catalog names and rejects others', () => {
    expect(isEventType('HourPassed')).toBe(true);
    expect(isEventType('NotAnEvent')).toBe(false);
  });

  it('every command of the catalog is a CommandType with its owner', () => {
    expect([...COMMAND_TYPES]).toEqual(commands.map((c) => c.name));
    for (const row of commands) {
      expect(COMMAND_OWNERS[row.name as (typeof COMMAND_TYPES)[number]], row.name).toBe(row.owner);
      expect(COMMAND_FIELDS[row.name as (typeof COMMAND_TYPES)[number]], row.name).toBe(row.fields);
    }
    expect(isCommandType('Designate')).toBe(true);
    expect(isCommandType('NotACommand')).toBe(false);
  });

  it('the app-level commands are listed apart and are not simulation commands', () => {
    expect([...APP_COMMAND_TYPES]).toEqual(appCommands);
    for (const name of appCommands) {
      if (name === 'RenameDwarf') continue; // 02's embark-session command shares the name
      expect(isCommandType(name)).toBe(false);
    }
  });

  it('every rejection reason of the catalog exists with its strings key', () => {
    expect([...REJECT_REASONS]).toEqual(reasons);
    expect(REJECT_REASONS.length).toBe(42);
    expect(rejectStringKey('out_of_bounds')).toBe('reject.out_of_bounds');
  });

  it('every command owner is a system number, "core" or "app"', () => {
    for (const owner of Object.values(COMMAND_OWNERS)) {
      expect(/^(\d\d|core)$/.test(owner), owner).toBe(true);
    }
  });
});
