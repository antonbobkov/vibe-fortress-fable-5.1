import { expect } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { ItemsReader } from '@systems/items';
import type { MoraleReader } from '@systems/morale';
import type { Scenario } from './runner';
import { buildFlatTestMap } from '@app/headless';
import { TestWorld } from './test-world';

const scenario: Scenario = {
  id: 'it_miasma', milestone: 4, seed: 'it-miasma', world: 'flat-test', embark: 'none',
  run: (outer) => {
    const registry = outer.game.registry;
    const w = new TestWorld({ seed: 'it-miasma', registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });
    const tile = w.index(12, 12, 32);
    w.map.setFlag(tile, TileFlag.Outdoor, false);
    w.forceTemperature(tile, 20);
    const dwarf = w.spawnDwarf({ at: tile });
    const corpse = w.spawnItem('corpse', 'cow_meat', tile);
    w.game.world.entities.add(corpse, C.Corpse, {
      species: w.game.registry.table('creatures').index('cow'), diedTick: w.tick, wornItems: [], dwarfName: null,
    });
    w.step(14 * TICKS_PER_DAY + TICKS_PER_HOUR);
    const items = w.readers.of<ItemsReader>('13');
    expect(items.rotStage(corpse)).toBe(2);
    expect(items.isMiasma(tile)).toBe(true);
    expect(w.events('MiasmaSpread').length).toBeGreaterThan(0);
    w.step(TICKS_PER_HOUR);
    expect(w.readers.of<MoraleReader>('15').thoughts(dwarf).some((t) => t.id === 'in_miasma')).toBe(true);
  },
};
export default scenario;
