/** `acceptance-tests.md` ws_masterwork; `12` § Quality and `15` § Thoughts. */
import { expect } from 'vitest';
import type { MoraleReader } from '@systems/morale';
import type { TileIndex } from '@core/types';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'ws_masterwork', milestone: 5, seed: 'ws-masterwork', world: 'flat-test', embark: 'none',
  run: (w) => {
    const at = w.index(15, 15, 32);
    const carpenter = w.build('carpenter', at);
    const maker = w.spawnDwarf({ at: w.index(18, 16, 32), skills: { carpentry: 20 } });
    for (const labor of w.game.registry.table<{ id: string }>('labors').ids()) {
      if (labor !== 'carpentry') {
        w.game.world.applyCommand({ type: 'SetLabor', dwarfId: maker, labor, on: false });
      }
    }

    const pileTiles: TileIndex[] = [];
    for (let dy = 0; dy < 10; dy += 1) {
      for (let dx = 0; dx < 10; dx += 1) {
        const tile = w.index(19 + dx, 15 + dy, 32);
        pileTiles.push(tile);
        w.spawnItem('log', 'oak', tile, 1);
      }
    }
    const pile = w.zone('stockpile', pileTiles);
    w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'wood' });
    w.spawnItem('drink', 'ale', w.index(18, 17, 32), 200);
    w.spawnItem('easy_meal', 'dimcap', w.index(18, 18, 32), 100);

    w.step(1);
    w.game.world.applyCommand({
      type: 'AddWorkOrder',
      workshopId: carpenter,
      order: { recipeId: 'make_bed', mode: 'once', remaining: 100, priority: 5 },
    });

    w.until(() => w.events('ItemCrafted').filter((e) => e['recipeId'] === 'make_bed').length >= 100, 35000);

    const crafted = w.events('ItemCrafted').filter((e) => e['recipeId'] === 'make_bed');
    expect(crafted).toHaveLength(100);
    const masterworks = w.events('MasterworkCreated').filter((e) => e['crafterId'] === maker);
    expect(masterworks.length).toBeGreaterThanOrEqual(40);
    expect(w.readers.of<MoraleReader>('15').thoughts(maker).some((t) => t.id === 'made_masterwork')).toBe(true);
  },
};

export default scenario;
