import { expect } from 'vitest';
import { C } from '@core/components';
import type { Scenario } from './runner';

/** T-157: losing ammunition during an actual hunt releases the hunter. */
const scenario: Scenario = {
  id: 'fo_hunt_abandoned', milestone: 8, seed: 'fo-hunt-abandoned', world: 'flat-test',
  embark: 'none', surfaceWildlife: 'none',
  run: (w) => {
    const at = w.index(20, 20, 32);
    const hunter = w.spawnDwarf({ at, skills: { hunting: 10, crossbow: 10 } });
    const weapon = w.spawnItem('crossbow', 'iron', at);
    const bolts = w.spawnItem('bolt', 'iron', at, 20);
    w.game.world.entities.add(hunter, C.Equipment, { weapon, shield: 0, quiver: bolts,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 } });
    const target = w.spawnCreature('deer', w.index(35, 20, 32), 'wild');
    w.until((v) => v.events('HuntStarted').some((e) => e['hunterId'] === hunter), 300);
    // Model loss of the ammo item after the hunt starts, not an impossible no-ammo claim.
    w.items.destroy(bolts, 'lost');
    w.until((v) => v.events('HuntAbandoned').length > 0, 50);
    expect(w.events('HuntAbandoned')[0]).toMatchObject({ hunterId: hunter, targetId: target, reason: 'no_ammo' });
    expect(w.game.world.entities.get(hunter, C.Worker)?.jobId).toBe(0);
  },
};
export default scenario;
