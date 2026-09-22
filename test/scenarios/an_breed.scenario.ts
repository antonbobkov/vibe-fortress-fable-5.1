import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'an_breed', milestone: 4, seed: 'an-breed', world: 'flat-test', embark: 'none',
  todo: 'C-003',
  run: (w) => {
    const tiles = Array.from({ length: 20 }, (_, n) => w.index(8 + n % 5, 8 + Math.floor(n / 5), FLAT_TEST_SURFACE_Z));
    for (const tile of tiles) w.map.setFlag(tile, TileFlag.Grass, true);
    const pasture = w.zone('pasture', tiles);
    for (const sex of [0, 1] as const) {
      const animalId = w.spawnTame('cow', tiles[sex] as number, { sex });
      expect(w.game.world.applyCommand({ type: 'AssignPasture', animalId, zoneId: pasture }).ok).toBe(true);
    }
    w.until((v) => v.events('AnimalBorn').length > 0, 2 * 28 * TICKS_PER_DAY);
    expect(w.events('AnimalBorn').length).toBeGreaterThanOrEqual(1);
  },
};
export default scenario;
