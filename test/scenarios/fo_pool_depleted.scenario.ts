import { expect } from 'vitest';
import { TileKind } from '@core/map3d';
import type { ForagingReader } from '@systems/foraging';
import type { Scenario } from './runner';

/** T-157: four real fishers deplete a six-tile lake, rather than mutating its fish pool. */
const scenario: Scenario = {
  id: 'fo_pool_depleted', milestone: 8, seed: 'fo-pool-depleted', world: 'flat-test',
  embark: 'none', surfaceWildlife: 'none',
  run: (w) => {
    for (let y = 9; y <= 13; y++) for (let x = 9; x <= 12; x++) {
      const water = x >= 10 && x <= 11 && y >= 10 && y <= 12;
      w.carve(w.index(x, y, 32), water ? TileKind.Floor : TileKind.Wall, w.game.registry.table('materials').index('granite'));
      if (water) w.setFluid(w.index(x, y, 32), 7, 'water');
    }
    const banks = [[9, 10], [9, 12], [12, 10], [12, 12]] as const;
    for (const [x, y] of banks) {
      const tile = w.index(x, y, 33);
      w.carve(tile, TileKind.Floor, w.game.registry.table('materials').index('granite'));
      w.zone('fishing', [tile]);
      w.spawnDwarf({ at: tile, skills: { fishing: 20 } });
    }
    const reader = w.readers.of<ForagingReader>('09');
    w.step(1);
    const body = reader.waterBodyAt(w.index(10, 10, 32))!;
    expect(body.tileCount).toBe(6);
    expect(body.kind).toBe('lake');
    expect(body.fishPool).toBe(12);
    w.until((v) => v.events('FishPoolDepleted').length > 0, 2400);
    expect(w.events('FishPoolDepleted')[0]).toMatchObject({ bodyId: body.id });
    expect(reader.fishPool(body.id)).toBeLessThan(1);
    expect(w.events('FishCaught').length).toBeGreaterThanOrEqual(12);
  },
};
export default scenario;
