/**
 * T-529: the three-year script answers a territorial animal (a boar) only at its gate. A boar near a
 * dwarf out on the surface, far from the gate, is left alone; a wolf there is still answered, and a
 * boar by the gate is too. Sent after every boar near a surface dwarf, the squad went far out behind
 * the gate the hearth alert had locked and lost a dwarf to most awake boars it met.
 */
import { describe, expect, it } from 'vitest';
import { dangerousWildlife, setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';

describe('T-529 a territorial animal is answered only at the gate', () => {
  it('leaves a boar near a far surface dwarf alone, and answers a wolf there and a boar by the gate', () => {
    const w = threeYearsWorld('three-years', 0, 'none', 1);
    const state = setupThreeYearsFortress(w);
    const gate = { x: state.cx + 6, y: state.cy + 6 };
    const gateLabel = w.readers.pathing.labelOf(w.index(gate.x, gate.y + 2, state.z), 'walker');
    // Three tiles in a row on the gate's ground: a far one for a dwarf and two beside it.
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
    const boar = w.spawnCreature('boar', far![1]!, 'wild');
    expect(boar).toBeGreaterThan(0);
    const wolf = w.spawnCreature('wolf', far![2]!, 'wild');
    expect(dangerousWildlife(w, state, [dwarf])).toEqual([wolf]);

    const gateBoar = w.spawnCreature('boar', near, 'wild');
    expect(dangerousWildlife(w, state, [dwarf])).toEqual([gateBoar, wolf]);
  }, 120_000);
});
