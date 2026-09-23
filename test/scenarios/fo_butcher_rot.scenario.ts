import { expect } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';

/** `13` § Rot reaches gone at 150% of 14 days: day 21 (C-008 records the 20-day table row). */
const scenario: Scenario = {
  id: 'fo_butcher_rot', milestone: 4, seed: 'fo-butcher-rot', world: 'flat-test', embark: 'none',
  run: (outer) => {
    const registry = outer.game.registry;
    const w = new TestWorld({ seed: 'fo-butcher-rot', registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });
    const tile = w.index(15, 15, 32);
    w.forceTemperature(tile, 20);
    const corpse = w.spawnItem('corpse', 'cow_meat', tile);
    w.game.world.entities.add(corpse, C.Corpse, {
      species: registry.table('creatures').index('cow'), diedTick: w.tick, wornItems: [], dwarfName: null,
    });
    w.step(20 * TICKS_PER_DAY);
    const items = w.readers.of<ItemsReader>('13');
    expect(items.rotStage(corpse)).toBe(2);
    w.step(TICKS_PER_DAY + TICKS_PER_HOUR);
    expect(items.def(items.get(corpse)?.type ?? 0)?.id).toBe('skeleton');
    const workshop = w.build('butcher', w.index(16, 15, 32));
    w.spawnDwarf({ at: w.index(17, 15, 32), skills: { butchery: 5 } });
    w.until((v) => v.events('ButcheryDone').length > 0, 1600);
    const done = w.events('ButcheryDone')[0];
    expect(done?.['workshopId']).toBe(workshop);
    expect(done?.['yields']).toMatchObject({ meat: 0, hide: 0, fat: 0, skull: 0 });
    expect(items.count('bone_pile')).toBeGreaterThan(0);
  },
};
export default scenario;
