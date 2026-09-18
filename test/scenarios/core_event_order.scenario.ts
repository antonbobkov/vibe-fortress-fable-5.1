/**
 * `core_event_order` of `04-implementation/acceptance-tests.md` § Core:
 * "two systems emit in the same tick | dispatched in emission order; handlers run in system order".
 *
 * M0 has no real systems, so stand-ins with real system ids do the emitting and the handling
 * (T-M0-08: "with no real systems"; DECISIONS.md D-036). 03 and 04 each emit two events at tick 0;
 * 10 and 16 subscribe to all of them and are registered in reverse order.
 */

import { expect } from 'vitest';
import type { Scenario } from './runner';
import { StandInSystem } from './stand-in-systems';

const scenario: Scenario = {
  id: 'core_event_order',
  milestone: 0,
  seed: 'core-event-order',
  world: 'flat-test',
  embark: 'none',
  systems: () => {
    const log: string[] = [];
    const subscribes = ['DwarfIdle', 'NeedCritical', 'JobCreated'] as const;
    return [
      new StandInSystem('16', 16, { subscribes }, log),
      new StandInSystem('10', 10, { subscribes }, log),
      new StandInSystem('04', 4, {
        onTick: (ctx) => {
          if (ctx.tick !== 0) return;
          ctx.emit({ type: 'NeedCritical', id: 2, need: 'thirst' });
          ctx.emit({ type: 'JobCreated', jobId: 1 });
        },
      }),
      new StandInSystem('03', 3, {
        onTick: (ctx) => {
          if (ctx.tick !== 0) return;
          ctx.emit({ type: 'DwarfIdle', id: 1 });
          ctx.emit({ type: 'NeedCritical', id: 1, need: 'hunger' });
        },
      }),
    ];
  },
  run: 2,
  expect: (w) => {
    const ten = w.game.world.scheduler.byId('10') as StandInSystem;
    const sixteen = w.game.world.scheduler.byId('16') as StandInSystem;
    // Emission order is system order within the tick (03 before 04), then call order within a
    // system; every event reaches 10 before 16.
    expect(ten.sharedLog).toEqual([
      '10:DwarfIdle',
      '16:DwarfIdle',
      '10:NeedCritical',
      '16:NeedCritical',
      '10:NeedCritical',
      '16:NeedCritical',
      '10:JobCreated',
      '16:JobCreated',
    ]);
    expect(sixteen.sharedLog).toBe(ten.sharedLog);
    // All four were dispatched in the tick that emitted them.
    expect(ten.handled.every((h) => h.startsWith('0:'))).toBe(true);
    // The presentation listener saw the same batch in the same order.
    const payload = w
      .allEvents()
      .filter((e) => e.type === 'DwarfIdle' || e.type === 'NeedCritical' || e.type === 'JobCreated')
      .map((e) => `${e.type}:${String(e['id'] ?? e['jobId'])}`);
    expect(payload).toEqual(['DwarfIdle:1', 'NeedCritical:1', 'NeedCritical:2', 'JobCreated:1']);
  },
};

export default scenario;
