import { expect } from 'vitest';
import type { DefenseReader } from '@systems/defense';
import type { Scenario } from './runner';

let trap = 0;
let dwarf = 0;
const scenario: Scenario = {
  id: 'df_dwarf_safe', milestone: 6, seed: 'df-dwarf-safe', world: 'flat-test', embark: 'none',
  setup: (w) => {
    trap = w.build('stone_fall_trap', w.index(40, 40, 32), 'granite');
    dwarf = w.spawnDwarf({ at: w.index(39, 40, 32) });
  },
  run: (w) => {
    w.step(1);
    w.game.world.services.movement?.teleport(dwarf, w.index(40, 40, 32));
    w.step(1);
    expect(w.events('TrapTriggered')).toHaveLength(0);
    expect(w.readers.of<DefenseReader>('19').trapState(trap)).toBe('armed');
  },
};
export default scenario;
