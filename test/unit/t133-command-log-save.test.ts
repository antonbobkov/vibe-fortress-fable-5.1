import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { roundTrip, saveGame } from '@app/game-save';
import { readLog, replay } from '@app/replay';
import { CommandLog, OK, reject } from '@core/commands';
import { serializeJson, SerializationError } from '@core/serialize';

function game(): HeadlessGame {
  const original = new HeadlessGame({ seed: 't133-save', world: 'flat-test', embark: 'default' });
  // Drain embark's bootstrap reactions; fresh-save mood continuation is tracked by T-136.
  original.step(1);
  return original;
}

function continues(original: HeadlessGame): void {
  const loaded = roundTrip(original).game;
  expect(loaded.hash()).toBe(original.hash());
  expect(loaded.world.commandLog.all()).toEqual(original.world.commandLog.all());
  for (let tick = 0; tick < 50; tick += 1) {
    original.step(1);
    loaded.step(1);
    expect(loaded.hash(), `tick ${original.tick}`).toBe(original.hash());
  }
}

describe('T-133 malformed command history stays saveable', () => {
  it('saves the exact fresh embarked, paused NaN refusal reproduction', () => {
    const original = new HeadlessGame({ seed: 'malformed-log-save', world: 'flat-test', embark: 'default' });
    original.world.submit({ type: 'SetPopulationCap', n: NaN });
    original.world.commandPhase(true);
    const loaded = roundTrip(original).game;
    expect(loaded.hash()).toBe(original.hash());
    expect(loaded.world.commandLog.all()).toEqual(original.world.commandLog.all());
    expect(loaded.world.commandLog.all()[0]?.result).toEqual({ ok: false, reason: 'bad_setting' });
  });
  for (const immediate of [true, false]) {
    it.each([NaN, Infinity, -Infinity])('persists a %s refusal (immediate=' + immediate + ')', (n) => {
      const original = game();
      original.world.submit({ type: 'SetPopulationCap', n });
      original.world.commandPhase(immediate);
      const entry = original.world.commandLog.all()[0]!;
      expect(entry.result).toEqual({ ok: false, reason: 'bad_setting' });
      continues(original);
      expect(entry.command['n']).toEqual({ $invalid: String(n) });
    });
  }

  const circular: Record<string, unknown> = {};
  circular['self'] = circular;
  const cyclicMap = new Map<string, unknown>();
  cyclicMap.set('self', cyclicMap);
  const accessor = Object.defineProperty({}, 'bad', { enumerable: true, get() { throw new Error('do not evaluate'); } });
  const unreadable = new Proxy({}, { getPrototypeOf() { throw new Error('cannot inspect'); } });
  const extras = [
    { label: 'function', value: () => 1, marker: { $invalid: 'function' } },
    { label: 'symbol', value: Symbol('probe'), marker: { $invalid: 'symbol' } },
    { label: 'bigint', value: 12n, marker: { $invalid: 'bigint', value: '12' } },
    { label: 'class', value: new Date(0), marker: { $invalid: 'object' } },
    { label: 'cycle', value: circular, marker: { self: { $invalid: 'circular' } } },
    { label: 'map cycle', value: cyclicMap, marker: new Map([['self', { $invalid: 'circular' }]]) },
    { label: 'accessor', value: accessor, marker: { bad: { $invalid: 'accessor' } } },
    { label: 'unreadable object', value: unreadable, marker: { $invalid: 'unreadable' } },
  ];
  it.each(extras)('retains unsupported $label extras and the refusal without throwing on repeated logging', ({ value, marker }) => {
    const original = game();
    for (let count = 0; count < 2; count += 1) {
      original.world.submit({ type: 'SetPopulationCap', n: NaN, extra: { nested: [value] } });
      original.world.commandPhase(true);
    }
    expect(original.world.commandLog.length).toBe(2);
    const loaded = roundTrip(original).game;
    for (const entry of original.world.commandLog.all()) {
      expect(entry.result).toEqual({ ok: false, reason: 'bad_setting' });
      expect(entry.command['extra']).toEqual({ nested: [marker] });
    }
    // Canonical Map persistence has always restored sorted entry arrays.
    expect(loaded.hash()).toBe(original.hash());
    expect(serializeJson(loaded.world.commandLog.all())).toBe(serializeJson(original.world.commandLog.all()));
    for (let tick = 0; tick < 50; tick += 1) {
      original.step(1);
      loaded.step(1);
      expect(loaded.hash()).toBe(original.hash());
    }
  });

  it('does not let ignored unsupported extras poison an accepted command or its replay', async () => {
    const original = game();
    const start = roundTrip(original).game;
    original.world.submit({ type: 'SetPopulationCap', n: NaN });
    original.world.submit({ type: 'RenameFortress', name: 'Safe history', extra: () => 1 });
    original.world.commandPhase(true);
    expect(original.world.commandLog.all().map((entry) => entry.result)).toEqual([
      { ok: false, reason: 'bad_setting' }, { ok: true },
    ]);
    expect(original.world.fortress.name).toBe('Safe history');
    const persisted = await readLog(await saveGame(original, { kind: 'manual' }));
    expect(persisted[0]?.command['n']).toEqual({ $invalid: 'NaN' });
    expect(persisted[1]?.command['extra']).toEqual({ $invalid: 'function' });
    original.step(50);
    replay(start, persisted, { until: original.tick });
    expect(start.hash()).toBe(original.hash());
    expect(start.world.commandLog.all().map((entry) => entry.result)).toEqual(persisted.map((entry) => entry.result));
  });

  it('keeps valid log bytes, designation coalescing and supported serialization forms unchanged', () => {
    const log = new CommandLog();
    const first = { type: 'Designate' as const, kind: 'dig', priority: 4, tiles: [1, 2] };
    log.append(0, first, OK);
    log.append(0, { ...first, tiles: [3] }, OK);
    const command = { type: 'RenameFortress' as const, name: 'Valid', extra: {
      typed: new Uint16Array([3, 4]), map: new Map([['b', 2], ['a', 1]]), set: new Set([2, 1]),
    } };
    log.append(1, command, OK);
    log.append(2, { type: 'SetPopulationCap', n: -1 }, reject('bad_setting'));
    expect(serializeJson(log.serialize())).toBe(serializeJson([
      { tick: 0, command: { ...first, tiles: [1, 2, 3] }, result: OK, count: 2 },
      { tick: 1, command, result: OK, count: 1 },
      { tick: 2, command: { type: 'SetPopulationCap', n: -1 }, result: reject('bad_setting'), count: 1 },
    ]));
    expect(() => serializeJson({ simulationState: NaN })).toThrow(SerializationError);
  });
});
