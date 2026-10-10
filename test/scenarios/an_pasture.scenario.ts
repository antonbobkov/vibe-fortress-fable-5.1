import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'an_pasture', milestone: 4, seed: 'an-pasture', world: 'flat-test', embark: 'none',
  // T-192: this tests domestic feeding/breeding on its fixed grass patch without wild competitors.
  surfaceWildlife: 'none',
  run: (w) => {
    const tiles = Array.from({ length: 20 }, (_, n) => w.index(8 + n % 5, 8 + Math.floor(n / 5), FLAT_TEST_SURFACE_Z));
    for (const tile of tiles) w.map.setFlag(tile, TileFlag.Grass, true);
    const pasture = w.zone('pasture', tiles);
    const a = w.spawnTame('cow', tiles[0] as number, { sex: 0 });
    const b = w.spawnTame('cow', tiles[1] as number, { sex: 1 });
    for (const animalId of [a, b]) expect(w.game.world.applyCommand({ type: 'AssignPasture', animalId, zoneId: pasture }).ok).toBe(true);
    w.step(28 * TICKS_PER_DAY);
    for (const id of [a, b]) {
      expect(w.game.world.entities.get(id, C.Tame)?.condition).toBeLessThan(60);
      expect(w.readers.of<{ pastureOf(id: number): number }>('08').pastureOf(id)).toBe(pasture);
    }
    expect(tiles.some((tile) => w.map.hasFlag(tile, TileFlag.Grass))).toBe(true);
  },
};
export default scenario;
