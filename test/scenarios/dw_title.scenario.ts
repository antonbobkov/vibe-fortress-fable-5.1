import { expect } from 'vitest';
import type { Scenario } from './runner';

/** T-M4-13 extends this with the Thane bedroom thought. */
const scenario: Scenario = {
  id: 'dw_title', milestone: 4, seed: 'dw-title', world: 'flat-test', embark: 'none',
  run: (w) => {
    const a = w.spawnDwarf({ at: w.index(12, 12, 32) });
    const b = w.spawnDwarf({ at: w.index(13, 12, 32) });
    expect(w.game.world.applyCommand({ type: 'AssignTitle', dwarfId: a, title: 'thane' })).toEqual({ ok: true });
    expect(w.dwarves.reader().holder('thane')).toBe(a);
    expect(w.game.world.applyCommand({ type: 'AssignTitle', dwarfId: b, title: 'thane' })).toEqual({ ok: true });
    expect(w.dwarves.reader().holder('thane')).toBe(b);
    expect(w.dwarves.reader().title(a)).toBe('none');
  },
};
export default scenario;
