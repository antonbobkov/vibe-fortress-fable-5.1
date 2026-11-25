import { describe, expect, it } from 'vitest';
import { TileKind } from '@core/map3d';
import { setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';
import { HALL_TUNNEL_MAX, keepWaterInside } from '../scenarios/three_years_cistern';
import { cisternKeepOff } from '../scenarios/cistern-well';
import { command, isKeptOff } from '../scenarios/script-commands';

/**
 * T-663: the three-year script plans its cistern on its first look, where the brook's water can
 * reach it, and from then on keeps every other dig of the script off the rock about its water.
 */
describe('T-663 the three-year script plans water inside the gate', () => {
  it('plans a well room by the brook and keeps the rock about the cistern undug', () => {
    const w = threeYearsWorld('three-years-p2-2', 2);
    const state = setupThreeYearsFortress(w);
    state.waterInside = true;
    keepWaterInside(w, state);
    const work = state.cistern;
    expect(work, 'a plan').toBeTruthy();
    const plan = work!.plan;
    // No corner of the hearth hall suits on this map: a well room near the brook, with a short tunnel.
    expect(work!.room.length).toBeGreaterThan(9);
    expect(plan.tunnel.length).toBeLessThanOrEqual(10);
    // The floodgate stands midway on a straight stretch of the tunnel.
    const [a, f, c] = [plan.tunnel[plan.gate - 1]!, plan.f, plan.tunnel[plan.gate + 1] ?? plan.w];
    expect(a.x === f.x || a.y === f.y).toBe(true);
    expect(Math.abs(a.x - c.x) + Math.abs(a.y - c.y)).toBeGreaterThanOrEqual(2);
    // A dig the script sends beside the cistern's water is left out of the designation.
    const kept = [...cisternKeepOff(w, plan)].find((t) => w.map.kindAt(t) === TileKind.Wall && w.map.zOf(t) === plan.cisternZ);
    expect(kept).toBeDefined();
    expect(isKeptOff(w, kept!)).toBe(true);
    expect(command(w, { type: 'Designate', kind: 'dig', priority: 5, tiles: [kept!] }).ok).toBe(true);
    expect(w.map.designationAt(kept!)).toBe(0);
  });

  it('T-694 plans the cistern under the hearth hall where the tunnel is as long as the twenty maps take', () => {
    const w = threeYearsWorld('three-years-p4-5', 4);
    const state = setupThreeYearsFortress(w);
    state.waterInside = true;
    keepWaterInside(w, state);
    const work = state.cistern;
    expect(work, 'a plan').toBeTruthy();
    expect(work!.room, 'under the hall, no well room').toHaveLength(0);
    expect(work!.plan.tunnel.length).toBeGreaterThan(30);
    expect(work!.plan.tunnel.length).toBeLessThanOrEqual(HALL_TUNNEL_MAX);
    expect(work!.plan.hallZ).toBe(state.hallZ);
  });
});
