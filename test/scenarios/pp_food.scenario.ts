/**
 * Player path: food (T-330; `docs/process/player-paths.md`).
 *
 * From the Balanced embark on a compact generated forest region, by commands only: a stockpile,
 * a stair down to the soil level and a room dug there, a cave farm plot sown with cavewheat, a
 * kitchen, and an order to cook easy meals of cavewheat. Cavewheat is the one cookable crop the
 * wagon carries seed of and no food of, so a cavewheat meal can only come from the harvest.
 *
 * Asserted, as a player sees it: the plot was planted and harvested, cavewheat meals were cooked,
 * and a dwarf ate one, within a season. Wild animals stay on.
 */

import { expect } from 'vitest';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import { C } from '@core/components';
import type { Scenario } from './runner';
import { built, cmd, day, dug, expectNoInvariantFindings, pathWorld, placeNear, playUntil, rect, stairToRock, surfaceZ, trace, wagon, zoneRect } from './player-path';
import type { TestWorld } from './test-world';

const CROP = 'cavewheat';

/** Units of cavewheat easy meals in the world now. */
function mealUnits(w: TestWorld): number {
  const ent = w.game.world.entities;
  const type = w.game.registry.table('items').index('easy_meal');
  const material = w.game.registry.table('materials').index(CROP);
  let units = 0;
  for (const id of ent.with(C.Item)) {
    const it = ent.get(id, C.Item)!;
    if (it.type === type && it.material === material) units += it.count;
  }
  return units;
}

/** Units of cavewheat easy meals ever made. */
function mealsMade(w: TestWorld): number {
  return w.events('ItemCreated')
    .filter((e) => e['itemType'] === 'easy_meal' && e['material'] === CROP)
    .reduce((sum, e) => sum + Number(e['count'] ?? 0), 0);
}

const scenario: Scenario = {
  id: 'pp_food',
  milestone: 8,
  seed: 'pp-food',
  world: 'flat-test',
  timeoutMs: 300_000,
  run: () => {
    const w = pathWorld('pp-food');
    const { x: cx, y: cy } = wagon(w);
    const z = surfaceZ(w, cx, cy);

    zoneRect(w, 'stockpile', cx - 4, cy + 3, z, 6, 4);
    // A stair down to the first rock; beside it a 4 × 4 room on the soil level below the surface,
    // for a farm in the dark, and a 3 × 3 room in the rock for the stone a kitchen is built of.
    const { sx, sy, below, rockZ } = stairToRock(w, cx + 4, cy + 8);
    const room = rect(w, sx + 1, sy - 1, below, 4, 4);
    cmd(w, { type: 'Designate', kind: 'dig', priority: 4, tiles: room });
    cmd(w, { type: 'Designate', kind: 'dig', priority: 4, tiles: rect(w, sx - 3, sy - 1, rockZ, 3, 3) });
    const kitchen = placeNear(w, 'kitchen', cx - 6, cy + 12);

    let plot = 0;
    let ordered = false;
    const done = (): boolean => mealsMade(w) - mealUnits(w) > 0 && w.events('MealEaten').some((e) => e['mealType'] === 'easy_meal');
    const finished = playUntil(w, done, DAYS_PER_SEASON * TICKS_PER_DAY, () => {
      if (plot === 0 && dug(w, room)) {
        plot = zoneRect(w, 'farm_plot', w.map.xOf(room[0]!), w.map.yOf(room[0]!), below, 4, 4);
        for (const season of [0, 1, 2, 3]) cmd(w, { type: 'SetPlotCrop', zoneId: plot, season, speciesId: CROP });
      }
      if (!ordered && built(w, kitchen)) {
        ordered = true;
        cmd(w, { type: 'AddWorkOrder', workshopId: kitchen, order: { recipeId: 'cook_easy_meal', mode: 'maintain', threshold: 8, materialFilter: CROP } });
      }
    }, 100);

    const planted = w.events('CropPlanted').filter((e) => e['species'] === CROP).length;
    const harvested = w.events('CropHarvested').filter((e) => e['species'] === CROP && e['count'] !== undefined).length;
    const summary = `${trace(w, 'pp_food')}; plot ${plot}; kitchen built ${built(w, kitchen)}; planted ${planted}; harvested ${harvested}; ` +
      `meals made ${mealsMade(w)}, left ${mealUnits(w)}`;
    console.log(summary);
    expect(planted, `cavewheat sown; ${summary}`).toBeGreaterThan(0);
    expect(harvested, `cavewheat harvested; ${summary}`).toBeGreaterThan(0);
    expect(mealsMade(w), `cavewheat meals cooked; ${summary}`).toBeGreaterThan(0);
    expect(finished, `a cavewheat meal eaten by day ${DAYS_PER_SEASON}; ${summary}`).toBe(true);
    // T-350: which dwarf a boar or a badger meets turns on the job timeline (testing-strategy.md
    // § What may be a gate): the deaths are in the trace, and the chain's own outcome is that
    // nobody dies of hunger or thirst.
    const dwarf = w.game.registry.table('creatures').index('dwarf');
    expect(w.events('CreatureDied').filter((e) => e['species'] === dwarf && e['cause'] === 'starvation').length, 'no dwarf died of hunger or thirst').toBe(0);
    expectNoInvariantFindings(w, `pp_food day ${day(w)}`);
  },
};

export default scenario;
