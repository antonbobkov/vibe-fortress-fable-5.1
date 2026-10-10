/** T-157 follow-up: clearing a blocked order returns the workshop to idle once. */
import { expect } from 'vitest';
import { C } from '@core/components';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'ws_idle', milestone: 8, seed: 'ws-idle', world: 'flat-test', embark: 'none',
  run: (w) => {
    const workshop = w.build('carpenter', w.index(15, 15, 32));
    w.step(5);
    const events = (type: 'WorkshopBlocked' | 'WorkshopIdle') =>
      w.events(type).filter((event) => event['workshopId'] === workshop);
    expect(events('WorkshopIdle')).toHaveLength(0);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: workshop,
      order: { recipeId: 'make_bed', mode: 'once', remaining: 1 } })).toEqual({ ok: true });
    w.step(10);
    expect(events('WorkshopBlocked')).toHaveLength(1);
    expect(events('WorkshopBlocked')[0]?.['reason']).toBe('missing_input');
    expect(events('WorkshopIdle')).toHaveLength(0);
    expect(w.game.world.applyCommand({ type: 'RemoveWorkOrder', workshopId: workshop, index: 0 })).toEqual({ ok: true });
    w.step(1);
    expect(events('WorkshopIdle')).toHaveLength(1);
    expect(w.game.world.entities.get(workshop, C.Workshop)?.lastBlockedReason).toBeNull();
    w.step(10);
    expect(events('WorkshopIdle')).toHaveLength(1);
    expect(events('WorkshopBlocked')).toHaveLength(1);
    expect(w.events('JobCreated')).toHaveLength(0);
  },
};

export default scenario;
