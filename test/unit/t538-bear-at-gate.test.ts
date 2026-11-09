/**
 * T-538: the three-year script answers a bear, an aggressive animal that is no carnivore and hunts no
 * dwarf, only at its gate, as it does a territorial one (T-529). A bear near a dwarf out on the
 * surface, far from the gate, is left alone; a wolf there is still answered, and a bear by the gate
 * is too. A struck bear fights back since T-538, and hunted wherever a dwarf met one it cost the
 * twenty-seed sweep about ten dwarves a sweep.
 */
import { describe, expect, it } from 'vitest';
import { dangerousWildlife, setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';

describe('T-538 a bear is answered only at the gate', () => {
  it('leaves a bear near a far surface dwarf alone, and answers a wolf there and a bear by the gate', () => {
    const w = threeYearsWorld('three-years', 0, 'none', 1);
    const state = setupThreeYearsFortress(w);
    const gate = { x: state.cx + 6, y: state.cy + 6 };
    const gateLabel = w.readers.pathing.labelOf(w.index(gate.x, gate.y + 2, state.z), 'walker');
    const ground = (x: number, y: number): number => {
      for (let z = state.z - 2; z <= state.z + 2; z += 1) {
        const t = w.index(x, y, z);
        if (w.readers.pathing.labelOf(t, 'walker') === gateLabel) return t;
      }
      return -1;
    };
    const dist = (x: number, y: number): number => Math.max(Math.abs(x - gate.x), Math.abs(y - gate.y));
    let far: number[] | undefined;
    for (let y = 2; y < w.map.h - 2 && far === undefined; y += 1) {
      for (let x = 2; x < w.map.w - 6 && far === undefined; x += 1) {
        if (dist(x, y) < 22) continue;
        const row = [ground(x, y), ground(x + 2, y), ground(x + 4, y)];
        if (row.every((t) => t >= 0)) far = row;
      }
    }
    let near = -1;
    for (let d = 4; d < 12 && near < 0; d += 1) near = ground(gate.x, gate.y + d) >= 0 ? ground(gate.x, gate.y + d) : ground(gate.x + d, gate.y);
    expect(far).toBeDefined();
    expect(near).toBeGreaterThanOrEqual(0);

    const dwarf = w.spawnCreature('dwarf', far![0]!, 'fortress');
    const bear = w.spawnCreature('bear', far![1]!, 'wild');
    expect(bear).toBeGreaterThan(0);
    const wolf = w.spawnCreature('wolf', far![2]!, 'wild');
    expect(dangerousWildlife(w, state, [dwarf])).toEqual([wolf]);

    const gateBear = w.spawnCreature('bear', near, 'wild');
    expect(dangerousWildlife(w, state, [dwarf])).toEqual([gateBear, wolf]);
  }, 120_000);
});
