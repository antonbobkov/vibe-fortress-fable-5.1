import { expect } from 'vitest';
import type { DefenseReader } from '@systems/defense';
import type { JobsReader } from '@systems/jobs';
import type { Scenario } from './runner';

let trap = 0;
let goblin = 0;
const scenario: Scenario = {
  id: 'df_stone_fall', milestone: 6, seed: 'df-stone-fall', world: 'flat-test', embark: 'none',
  setup: (w) => {
    const tile = w.index(40, 40, 32);
    trap = w.build('stone_fall_trap', tile, 'granite');
    goblin = w.spawnCreature('gloam_warrior', w.index(39, 40, 32), 'hostile:gloam');
  },
  run: (w) => {
    w.step(1);
    w.game.world.services.movement?.teleport(goblin, w.index(40, 40, 32));
    w.step(2);
    expect(w.events('TrapTriggered')).toContainEqual(expect.objectContaining({ trapId: trap, creatureId: goblin, kind: 'stone_fall' }));
    expect(w.events('DamageDealt').some((event) => event['defenderId'] === goblin && typeof event['part'] === 'string')).toBe(true);
    expect(w.readers.of<DefenseReader>('19').trapState(trap)).toBe('spent');
    expect(w.readers.of<JobsReader>('11').byKey(`rearm_trap:${trap}`)).toBeDefined();
  },
};
export default scenario;
