import { expect } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';
import { buildFlatTestMap } from '@app/headless';
import { TestWorld } from './test-world';

const scenario: Scenario = {
  id: 'it_rot', milestone: 4, seed: 'it-rot', world: 'flat-test', embark: 'none',
  run: (outer) => {
    const registry = outer.game.registry;
    const w = new TestWorld({ seed: 'it-rot', registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });
    const floor = w.index(12, 12, 32);
    const stored = w.index(14, 12, 32);
    w.forceTemperature(floor, 20);
    w.forceTemperature(stored, 20);
    w.zone('stockpile', [stored]);
    w.step(1);
    const barrel = w.spawnItem('barrel', 'oak', stored);
    const loose = w.spawnItem('raw_meat', 'cow_meat', floor);
    const packed = w.spawnItem('raw_meat', 'cow_meat', { containerId: barrel });
    const items = w.readers.of<ItemsReader>('13');
    w.step(6 * TICKS_PER_DAY + 51);
    expect(items.rotStage(loose)).toBe(2);
    expect(items.rotStage(packed)).toBe(0);
    w.step(18 * TICKS_PER_DAY);
    expect(items.rotStage(packed)).toBe(2);
    expect(w.events('ItemRotted').some((e) => e['id'] === packed)).toBe(true);
  },
};
export default scenario;



