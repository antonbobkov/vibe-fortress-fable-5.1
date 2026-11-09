/**
 * T-534: in `three-years-p0-3` (master a9a24607) the smelter, placed at the routine build priority,
 * stood half built from day 63 to about day 160: its builder took the nearer smoothing and hauling of
 * the same priority first (11 § Assignment: priority is strict and a job does not age), smelting
 * began 80 days late, and year 3 never held the iron bars for one steel. The three-year script now
 * builds the wood furnace and the smelter one step ahead of the routine backlog, as a player raises
 * a build left waiting.
 */
import { describe, expect, it } from 'vitest';
import { Designation, TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { BUILD, METAL_BUILD } from '../scenarios/three_years_economy';
import { Z } from '../scenarios/three_years_fortress';
import { TestWorld } from '../scenarios/test-world';

/** Smooth designations left on the floor when the smelter, placed at `priority`, is finished. */
function smoothLeftWhenBuilt(priority: number): number {
  const w = new TestWorld({ seed: 't534-smelter', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let y = 16; y <= 24; y += 1) for (let x = 4; x <= 38; x += 1) {
    const t = w.index(x, y, Z);
    w.carve(t, TileKind.Floor, granite);
    w.map.setFlag(t, TileFlag.Grass, false);
  }
  const builder = w.spawnDwarf({ at: w.index(6, 20, Z), skills: { masonry: 3 } });
  w.setLabor(builder, 'hauling', false);
  w.setLabor(builder, 'masonry', true);
  // A routine backlog beside the builder: forty-two floor tiles to smooth.
  const floor: number[] = [];
  for (let y = 17; y <= 23; y += 1) for (let x = 5; x <= 10; x += 1) floor.push(w.index(x, y, Z));
  expect(w.game.world.applyCommand({ type: 'Designate', kind: 'smooth', priority: BUILD, tiles: floor }).ok).toBe(true);
  // The smelter's site far off, its stone beside it.
  w.spawnItem('stone_block', 'granite', w.index(30, 17, Z), 3);
  expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'smelter', origin: w.index(32, 20, Z), orientation: 0, materialChoice: 0, priority }).ok).toBe(true);
  const smelter = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding;
  const buildings = w.readers.of<BuildingsReader>('14');
  w.until(() => buildings.get(smelter)?.state === 'built', 60_000);
  expect(buildings.get(smelter)?.state, 'the smelter is finished').toBe('built');
  return floor.filter((t) => w.map.designationAt(t) !== Designation.None).length;
}

describe('T-534 the three-year script builds its smelter ahead of the routine backlog', () => {
  it('at the routine priority the smelter waits for the nearer smoothing; one step ahead it is built first', () => {
    expect(METAL_BUILD).toBeLessThan(BUILD);
    expect(smoothLeftWhenBuilt(BUILD), 'at BUILD every nearer smoothing job goes first').toBe(0);
    expect(smoothLeftWhenBuilt(METAL_BUILD), 'at METAL_BUILD the smelter comes before the backlog').toBeGreaterThan(30);
  });
});
