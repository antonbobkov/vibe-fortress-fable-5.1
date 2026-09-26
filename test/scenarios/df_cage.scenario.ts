import { expect } from 'vitest';
import { C } from '@core/components';
import type { DefenseReader } from '@systems/defense';
import type { Scenario } from './runner';

let trap = 0;
let troll = 0;
let wyrm = 0;
const scenario: Scenario = {
  id: 'df_cage', milestone: 6, seed: 'df-cage', world: 'flat-test', embark: 'none',
  setup: (w) => {
    trap = w.build('cage_trap', w.index(40, 40, 32), 'iron');
    troll = w.spawnCreature('trollkin', w.index(39, 40, 32), 'hostile:gloam');
    wyrm = w.spawnCreature('magma_wyrm', w.index(41, 40, 32), 'wild');
  },
  run: (w) => {
    w.step(1);
    expect(w.game.world.entities.get(trap, C.Building)?.settings['trapLoaded']).toBeDefined();
    w.game.world.services.movement?.teleport(wyrm, w.index(40, 40, 32));
    w.step(1);
    expect(w.readers.of<DefenseReader>('19').trapState(trap)).toBe('armed');
    expect(w.events('CreatureCaged')).toHaveLength(0);
    w.game.world.services.movement?.teleport(troll, w.index(40, 40, 32));
    w.step(2);
    const event = w.events('CreatureCaged')[0];
    expect(event).toMatchObject({ creatureId: troll });
    expect(w.game.world.entities.get(troll, C.Position)).toBeUndefined();
    expect(w.game.world.entities.get(event?.['cageItemId'] as number, C.Item)?.occupantId).toBe(troll);
    expect(w.readers.of<DefenseReader>('19').trapState(trap)).toBe('spent');
  },
};
export default scenario;
