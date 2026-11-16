import { describe, expect, it } from 'vitest';
import { Designation, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import { DORMITORY_H, DORMITORY_W, dormitorySite, keepDormitories, setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';

/**
 * T-571: since T-551 a dwarf on the floor sleeps twice as long as one in a bed, and the three-year
 * script's bedroom plans (16 to 20 rooms) are spent long before its fortress stops growing: by the
 * third year two dwarves in five slept on the floor. A player digs a dormitory and fills it with
 * beds; the script now does, beside a corridor of the hall level, once the bedroom plans are spent.
 */
describe('T-571 the three-year script digs a dormitory of free beds once its bedrooms are spent', () => {
  it('three-years-p0-1: a block of rock beside a corridor, then a bed on each tile while a dwarf has none', () => {
    const w = threeYearsWorld('three-years-p0-1', 0);
    const state = setupThreeYearsFortress(w);
    const map = w.map, z = state.hallZ;
    // The hall level as the script plans it, dug at once: every tile designated for digging there,
    // and every bedroom plan.
    for (const bp of state.bedroomPlans) {
      bp.designated = true;
      for (const t of [...bp.tiles, w.index(bp.doorX, bp.doorY, z)]) map.setDesignation(t, Designation.Dig, 4);
    }
    for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) {
      const t = w.index(x, y, z);
      if (map.designationAt(t) === Designation.Dig) { w.carve(t, TileKind.Floor); w.discover(t); map.setDesignation(t, Designation.None, 0); }
    }
    w.step(1);

    const site = dormitorySite(w, state);
    expect(site).not.toBeNull();
    const tiles = site!;
    expect(tiles.length).toBe(DORMITORY_W * DORMITORY_H);
    const planned = new Set(state.bedroomPlans.flatMap((bp) => bp.tiles));
    for (const t of tiles) {
      expect(map.kindAt(t), `tile ${map.xOf(t)},${map.yOf(t)} is rock`).toBe(TileKind.Wall);
      expect(planned.has(t), `tile ${map.xOf(t)},${map.yOf(t)} is no bedroom's`).toBe(false);
    }
    // Reached from the halls: a side of the block lies on a dug tile the stair's foot walks to.
    const hall = w.readers.pathing.labelOf(w.index(state.cx + 6, state.cy + 8, z), 'walker');
    const inside = new Set(tiles);
    const beside = tiles.flatMap((t) => [map.offset(t, 1, 0, 0), map.offset(t, -1, 0, 0), map.offset(t, 0, 1, 0), map.offset(t, 0, -1, 0)])
      .filter((t) => t >= 0 && !inside.has(t) && map.kindAt(t) === TileKind.Floor && w.readers.pathing.labelOf(t, 'walker') === hall);
    expect(beside.length).toBeGreaterThan(0);

    // Fewer dwarves than bedrooms: no dormitory.
    keepDormitories(w, state, state.bedroomPlans.length - 2);
    expect(state.dormitories).toEqual([]);
    // More: one is dug.
    const buildings = w.readers.of<BuildingsReader>('14');
    const before = buildings.byTag('sleep').length;
    const population = state.bedroomPlans.length + 6;
    keepDormitories(w, state, population);
    expect(state.dormitories?.length).toBe(1);
    const dorm = state.dormitories![0]!;
    expect(dorm.tiles).toEqual(tiles);
    for (const t of dorm.tiles) expect(map.designationAt(t)).toBe(Designation.Dig);
    expect(dorm.beds).toEqual([]);
    // Dug: a bed on a tile for each dwarf (and the hospital) without one, in no bedroom.
    for (const t of dorm.tiles) { w.carve(t, TileKind.Floor); w.discover(t); map.setDesignation(t, Designation.None, 0); }
    w.step(1);
    keepDormitories(w, state, population);
    const wanted = population + 1 - before;
    expect(dorm.beds.length).toBe(Math.min(wanted, dorm.tiles.length));
    expect(buildings.byTag('sleep').length).toBe(before + dorm.beds.length);
    for (const t of dorm.beds) expect(buildings.zoneAt(t)).toBe(0);
    // Called again, it places no more.
    keepDormitories(w, state, population);
    expect(buildings.byTag('sleep').length).toBe(before + dorm.beds.length);
  }, 120_000);
});
