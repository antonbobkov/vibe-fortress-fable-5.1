/** T-M6-18: the autonomous fortress must demonstrate the M6 behavior gate. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { ItemsReader } from '@systems/items';
import { buildPlayedReference } from './played-reference';
import { deathCounts } from '../scenarios/death-counts';

describe('T-M6-18 perf: played behavior', () => {
  it('keeps dwarves alive, settles the disturbed lake, and runs orders and hauling into both stockpiles', () => {
    const { world: w, naturalWaterTiles, settledAt } = buildPlayedReference();
    const entities = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const stockpiles = entities.with(C.Stockpile);
    const pileCounts = stockpiles.map((id) => entities.with(C.Item)
      .filter((itemId) => items.stockpileAt(items.tileOf(itemId)) === id).length);
    const craftedItems = w.events('ItemCrafted').length;
    const hauledItems = w.events('JobCompleted').filter((e) => e['jobType'] === 'haul_to_stockpile')
      .map((e) => e['target'] as number);
    const completedHauls = hauledItems.length;
    const hauledIntoPiles = stockpiles.map((id) => hauledItems.filter((itemId) =>
      items.get(itemId) !== undefined && items.stockpileAt(items.tileOf(itemId)) === id).length);
    const lakeActive = naturalWaterTiles.filter((tile) => w.fluids.sim.isActive[tile] === 1).length;
    const deaths = deathCounts(w);
    console.log(`played_behavior: ${JSON.stringify({ deaths,
      craftedItems, completedHauls, hauledIntoPiles, pileCounts, lakeActive, settledAt, stockpiles: stockpiles.length })}`);
    expect(entities.with(C.Brain).filter((id) => entities.get(id, C.Creature)?.faction === 'fortress')).toHaveLength(20);
    expect(deaths.dwarf).toBe(0);
    expect(stockpiles).toHaveLength(2);
    expect(entities.with(C.Workshop).filter((id) => entities.get(id, C.Workshop)?.orders.some((o) => o.mode === 'maintain')).length).toBeGreaterThanOrEqual(6);
    expect(entities.with(C.Squad)).toHaveLength(1);
    expect(entities.with(C.Zone).some((id) => w.game.registry.table('zoneTypes').byIndex(entities.get(id, C.Zone)?.type ?? -1)?.id === 'farm_plot')).toBe(true);
    expect(lakeActive).toBe(0);
    expect(settledAt).toBeGreaterThan(0);
    expect(settledAt).toBeLessThanOrEqual(4_200);
    expect(craftedItems).toBeGreaterThan(0);
    expect(completedHauls).toBeGreaterThan(0);
    expect(hauledIntoPiles.every((count) => count > 0)).toBe(true);
    expect(pileCounts.every((count) => count > 0)).toBe(true);
  }, 600_000);
});
