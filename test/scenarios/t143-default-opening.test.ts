import { describe, expect, it } from 'vitest';
import { PRIORITY_DEFAULT, TICKS_PER_DAY } from '@core/constants';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';
import { threeYearsWorld, setupThreeYearsFortress, checkFortressWorkOrders,
  checkFortressRooms, checkFortressCaveFarm, checkFortressDefense } from './three_years_fortress';
import { stepThreeYears } from './three_years_measurements';

/** Days from placing the carpenter to its completion at default priorities. */
const CARPENTER_DAYS = 10;

describe('T-143 three-year fixture opening at default priorities', () => {
  // T-551 relaxed this to 25 days with the floor at 50 (22 measured); T-572's floor at 85 brings it back
  // to its old bound: 4,400 ticks (under four days) on 'three-years'.
  it('builds the carpenter within ten days of placement through ordinary jobs', () => {
    const w = threeYearsWorld('three-years');
    const apply = w.game.world.applyCommand.bind(w.game.world);
    let placedTick: number | undefined;
    let carpenter = 0;
    // Keep the old fixture's layout and player actions; qualify its opening at defaults.
    // This is local to the regression, not a replacement of the long balance fixture.
    w.game.world.applyCommand = (command) => {
      const cmd = { ...command };
      if (typeof cmd['priority'] === 'number') cmd['priority'] = PRIORITY_DEFAULT;
      if (cmd['order'] && typeof cmd['order'] === 'object')
        cmd['order'] = { ...cmd['order'] as Record<string, unknown>, priority: PRIORITY_DEFAULT };
      if (cmd['patch'] && typeof cmd['patch'] === 'object' && 'priority' in cmd['patch'])
        cmd['patch'] = { ...cmd['patch'] as Record<string, unknown>, priority: PRIORITY_DEFAULT };
      const result = apply(cmd);
      if (result.ok && cmd.type === 'PlaceBuilding' && cmd['buildingType'] === 'carpenter') {
        placedTick = w.tick;
        carpenter = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding;
      }
      return result;
    };
    const state = setupThreeYearsFortress(w);
    const buildings = w.readers.of<BuildingsReader>('14');
    const jobs = w.readers.of<JobsReader>('11');
    const initialTick = w.tick;
    const advance = () => {
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
      stepThreeYears(w, 100);
    };
    while (placedTick === undefined && w.tick < initialTick + TICKS_PER_DAY) advance();
    expect(carpenter, 'carpenter is placed by the ordinary opening driver').not.toBe(0);
    const deadline = placedTick! + CARPENTER_DAYS * TICKS_PER_DAY;
    while (buildings.get(carpenter)?.state !== 'built' && w.tick < deadline) advance();
    expect(buildings.get(carpenter)?.settings['priority']).toBe(PRIORITY_DEFAULT);
    for (const row of w.game.registry.table('labors').rows.slice(1))
      expect(jobs.laborPriority(row.id), row.id).toBe(PRIORITY_DEFAULT);
    expect(buildings.get(carpenter)?.state, 'carpenter built within ten days of placement at defaults').toBe('built');
    expect(w.tick - placedTick!).toBeLessThanOrEqual(CARPENTER_DAYS * TICKS_PER_DAY);
    console.log(`T-143 default-priority carpenter: ${w.tick - placedTick!} ticks after placement`);
  });
});
