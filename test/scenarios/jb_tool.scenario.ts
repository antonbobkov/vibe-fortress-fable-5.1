/**
 * `jb_tool` of `04-implementation/acceptance-tests.md` § 11 Jobs: "miner without a pick, pick in a
 * stockpile | fetches the pick first; keeps it after the job". The real tool fetch through 13
 * (D-054, D-070): one miner, a tool stockpile holding a pick, a wall to dig.
 */

import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';
import { onlyMiner, rect } from './m1-helpers';

const Z = 32;

const scenario: Scenario = {
  id: 'jb_tool',
  milestone: 2,
  seed: 'jb-tool',
  world: 'flat-test',
  embark: 'default',
  run: (w) => {
    const miner = onlyMiner(w);
    const items = w.readers.of<ItemsReader>('13');
    const pile = w.zone('stockpile', rect(w, 36, 20, Z, 3, 3));
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: { categories: ['tool'] } })).toEqual({ ok: true });
    const pick = w.spawnItem('pick', 'iron', w.index(37, 21, Z));
    expect(items.stockpileAt(items.tileOf(pick))).toBe(pile);
    expect(w.game.world.entities.get(miner, C.Worker)?.toolId).toBe(0);
    const target = w.index(56, 14, Z);
    w.game.world.services.terrain.setKind(target, TileKind.Wall, w.game.registry.table('materials').index('granite'));
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [target], kind: 'dig' })).toEqual({ ok: true });
    w.until((x) => x.map.kindAt(target) === TileKind.Floor, 3000);
    const equipped = w.events('ToolEquipped');
    expect(equipped).toEqual([expect.objectContaining({ dwarfId: miner, itemId: pick })]);
    // The pick was fetched before the dig started.
    const all = w.allEvents();
    const equippedAt = all.findIndex((e) => e.type === 'ToolEquipped');
    const startedAt = all.findIndex((e) => e.type === 'JobStarted' && e['jobType'] === 'dig');
    expect(equippedAt).toBeGreaterThanOrEqual(0);
    expect(equippedAt).toBeLessThan(startedAt);
    // Kept after the job.
    w.step(100);
    expect(w.game.world.entities.get(miner, C.Worker)?.toolId).toBe(pick);
    expect(items.get(pick)).toMatchObject({ carriedBy: miner, reservedBy: 0 });
  },
};

export default scenario;
