import { describe, expect, it } from 'vitest';
import { Designation, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import { setupThreeYearsFortress, threeYearsWorld, type FortressState } from '../scenarios/three_years_fortress';
import { ambushFromDay, keepWorkBelow, placeEconomyBuilding } from '../scenarios/three_years_economy';
import type { TestWorld } from '../scenarios/test-world';

/** The hall level as the script plans it, dug at once: every tile designated for digging there. */
function digHallLevel(w: TestWorld, z: number): void {
  const map = w.map;
  for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) {
    const t = w.index(x, y, z);
    if (map.designationAt(t) === Designation.Dig) { w.carve(t, TileKind.Floor); w.discover(t); map.setDesignation(t, Designation.None, 0); }
  }
}

function setUp(seed: string, peril: number): { w: TestWorld; state: FortressState } {
  const w = threeYearsWorld(seed, peril);
  const state = setupThreeYearsFortress(w);
  digHallLevel(w, state.hallZ);
  w.step(1);
  return { w, state };
}

/**
 * T-580: an ambush springs on the dwarves at work outdoors and Gloam outrun a dwarf, so where the
 * schedule preview says ambushes are possible the three-year script digs a workshop hall one level
 * below the halls, down a stair from the west corridor, and builds its workshops there.
 */
describe('T-580 the three-year script works below ground where ambushes are possible', () => {
  it('three-years-p0-1: no ambush at peril 0, so no workshop hall', () => {
    const { w, state } = setUp('three-years-p0-1', 0);
    expect(ambushFromDay(w)).toBeNull();
    keepWorkBelow(w, state, 0);
    expect(state.economy.workHall).toBeUndefined();
  });

  it('three-years-p4-1: the hall goes down from the west corridor on day 0, and a workshop placed once it is dug stands in it', () => {
    const { w, state } = setUp('three-years-p4-1', 4);
    const map = w.map;
    // 18 § Schedule: ambushes at peril 4 from year 1 autumn, day 56.
    expect(ambushFromDay(w)).toBe(56);
    keepWorkBelow(w, state, 0);
    const hall = state.economy.workHall!;
    expect(hall).toBeDefined();
    // The stair: a west corridor tile, no bedroom's door, designated down to the level below.
    expect(map.zOf(hall.stair)).toBe(state.hallZ);
    expect(map.yOf(hall.stair)).toBe(state.cy + 6);
    expect(map.xOf(hall.stair)).toBeLessThan(state.cx);
    expect(state.bedroomPlans.some((bp) => w.index(bp.doorX, bp.doorY, state.hallZ) === hall.stair)).toBe(false);
    expect(map.designationAt(hall.stair)).not.toBe(Designation.None);
    // The hall: one level below, designated for digging; twelve sites, apart, inside it, clear of the stair's foot.
    const tiles = new Set(hall.tiles);
    for (const t of hall.tiles) {
      expect(map.zOf(t)).toBe(state.hallZ - 1);
      expect(map.designationAt(t)).toBe(Designation.Dig);
    }
    expect(hall.slots.length).toBe(12);
    const used = new Set<number>();
    const foot = w.index(map.xOf(hall.stair), map.yOf(hall.stair), state.hallZ - 1);
    for (const origin of hall.slots) for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) {
      const t = map.offset(origin, dx, dy, 0);
      expect(tiles.has(t), `site tile ${map.xOf(t)},${map.yOf(t)} is in the hall`).toBe(true);
      expect(used.has(t)).toBe(false);
      expect(t).not.toBe(foot);
      used.add(t);
    }

    // Dug: a workshop the script places now goes up below ground, on a site of the hall.
    w.carve(foot, TileKind.StairsUp);
    w.discover(foot);
    digHallLevel(w, state.hallZ - 1);
    w.step(1);
    placeEconomyBuilding(w, state, 'carpenter', -8, 10);
    const b = w.readers.of<BuildingsReader>('14').get(state.placedIds['carpenter']!);
    expect(b).toBeDefined();
    expect(hall.slots).toContain(b!.footprint[0]);
  });
});
