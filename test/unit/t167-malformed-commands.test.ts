import { describe, expect, it, vi } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import type { Command } from '@core/commands';
import { TestWorld } from '../scenarios/test-world';

function world(): TestWorld {
  return new TestWorld({ seed: 't115-commands', map: buildFlatTestMap(contentRegistry(), 48, 48) });
}

describe('T-167 malformed commands reject without losing a tick or the rest of the queue', () => {
  it.each([
    { command: { type: 'SetHuntable', species: 'no_such_species', on: true }, reason: 'not_found' },
    { command: { type: 'AddWorkOrder', workshopId: 0, order: null }, reason: 'precondition_failed' },
    { command: { type: 'EditWorkOrder', workshopId: 0, index: 0, patch: null }, reason: 'precondition_failed' },
    { command: { type: 'DesignateStairwell', x: 1.5, y: 30, zTop: 32, zBottom: 30 }, reason: 'out_of_bounds' },
  ])('$command.type', ({ command, reason }) => {
    const w = world();
    const worldState = w.game.world;
    if (command.type === 'EditWorkOrder') {
      expect(worldState.applyCommand({ type: 'AddWorkOrder', workshopId: 0,
        order: { recipeId: 'make_bed', mode: 'once', remaining: 1, threshold: 0, priority: 5 } })).toEqual({ ok: true });
    }
    const tick = w.tick;
    const malformed = command as Command;
    worldState.submit(malformed);
    worldState.submit({ type: 'RenameFortress', name: 'Queue survived' });
    expect(() => w.step(1)).not.toThrow();
    expect(w.tick).toBe(tick + 1);
    expect(worldState.fortress.name).toBe('Queue survived');
    expect(worldState.commandLog.atTick(tick).map((entry) => entry.result)).toEqual([
      { ok: false, reason }, { ok: true },
    ]);
    expect(w.events('CommandRejected')).toEqual([{ type: 'CommandRejected', command: malformed, reason }]);
    // Validate the owning handler itself too: the core fallback must not hide a handler bug.
    expect(worldState.applyCommand(malformed)).toEqual({ ok: false, reason });
  });

  it('a thrown paused command rejects immediately without advancing or replaying the queue', () => {
    const w = world();
    const worldState = w.game.world;
    const handler = worldState.scheduler.byId('09')!;
    const stub = vi.spyOn(handler, 'applyCommand').mockImplementation(() => { throw new Error('defective handler'); });
    const tick = w.tick;
    try {
      worldState.submit({ type: 'SetHuntable', species: 'deer', on: true });
      worldState.submit({ type: 'RenameFortress', name: 'Paused queue survived' });
      expect(() => worldState.commandPhase(true)).not.toThrow();
      expect(w.tick).toBe(tick);
      expect(worldState.fortress.name).toBe('Paused queue survived');
      expect(w.events('CommandRejected')).toHaveLength(1);
      expect(worldState.commandLog.atTick(tick).map((entry) => entry.result)).toEqual([
        { ok: false, reason: 'precondition_failed' }, { ok: true },
      ]);
      expect(worldState.commands.size).toBe(0);
    } finally { stub.mockRestore(); }
    w.step(1);
    expect(w.tick).toBe(tick + 1);
    expect(w.events('CommandRejected')).toHaveLength(1);
    expect(worldState.commandLog.length).toBe(2);
  });

  it('an unforeseen handler throw is logged as precondition_failed and the queue continues', () => {
    const w = world();
    const worldState = w.game.world;
    const handler = worldState.scheduler.byId('09')!;
    const stub = vi.spyOn(handler, 'applyCommand').mockImplementation(() => { throw new Error('defective handler'); });
    try {
      const tick = w.tick;
      worldState.submit({ type: 'SetHuntable', species: 'deer', on: true });
      worldState.submit({ type: 'RenameFortress', name: 'Still running' });
      expect(() => w.step(1)).not.toThrow();
      expect(w.tick).toBe(tick + 1);
      expect(worldState.fortress.name).toBe('Still running');
      expect(worldState.commandLog.atTick(tick).map((entry) => entry.result)).toEqual([
        { ok: false, reason: 'precondition_failed' }, { ok: true },
      ]);
      expect(w.events('CommandRejected')).toHaveLength(1);
      expect(worldState.commands.size).toBe(0);
    } finally { stub.mockRestore(); }
  });
});
