import { expect } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { ForagingReader } from '@systems/foraging';
import type { Scenario } from './runner';

/** A source fed channel with an outflow at the fisher's bank. */
const scenario: Scenario = {
  id: 'fo_fish', milestone: 4, seed: 'fo-fish', world: 'flat-test', embark: 'none',
  run: (w) => {
    const bank = w.index(9, 11, 32);
    for (let y = 9; y <= 13; y += 1) for (let x = 9; x <= 13; x += 1) {
      if (x === 9 || x === 13 || y === 9 || y === 13) {
        if (x !== 9 || y !== 11) w.carve(w.index(x, y, 32), TileKind.Wall);
      }
    }
    const water: number[] = [];
    for (let y = 10; y < 13; y += 1) for (let x = 10; x < 13; x += 1) {
      const tile = w.index(x, y, 32); water.push(tile); w.setFluid(tile, 7, 'water', x === 10);
    }
    w.fluids.sim.sinks.push(bank);
    w.zone('fishing', [bank]);
    w.spawnDwarf({ at: w.index(8, 11, 32), skills: { fishing: 5 } });
    const reader = w.readers.of<ForagingReader>('09');
    w.step(5);
    const body = reader.waterBodyAt(water[0] as number);
    expect(body?.kind).toBe('river');
    w.step(7 * TICKS_PER_DAY);
    expect(w.events('FishCaught').length).toBeGreaterThanOrEqual(2);
    expect(reader.waterBodyAt(water[0] as number)?.id).toBe(body?.id);
    expect(reader.fishPool(body?.id ?? 0) + w.events('FishCaught').length).toBeGreaterThan(body?.fishPool ?? 0);
  },
};
export default scenario;
