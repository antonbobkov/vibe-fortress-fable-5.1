/**
 * T-588: the three-year script plays a small strand of Making Do from its second year (T-583's audit:
 * it ordered nothing of Making Do but the straw bed). Before the strand's day it sends nothing; on it,
 * it asks the Hillfolk for clay and tallow candles and the Wildwood for honey, places the kiln, the loom and the clothier, zones a
 * compost heap and fertilizes every farm plot, and the trade wants the candles. Once the fortress has
 * the spirits or mead an answered whim asks for, it sets them aside until the whim is about to be judged.
 */
import { describe, expect, it } from 'vitest';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { PlantsReader } from '@systems/plants';
import type { TradeReader } from '@systems/trade/reader';
import { setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';
import { checkMakingDo, keepThanesShare, makingDo, makingDoPurchases, MAKING_DO_FROM_DAY } from '../scenarios/three_years_making_do';

describe('T-588 the three-year fortress makes do', () => {
  it('starts on the first day of year 2 and not before', () => {
    const w = threeYearsWorld('three-years-p2-1', 2);
    const state = setupThreeYearsFortress(w);
    const buildings = w.readers.of<BuildingsReader>('14');
    const trade = w.readers.of<TradeReader>('20');
    const requests = trade.requests('hillfolk').length;

    checkMakingDo(w, state, MAKING_DO_FROM_DAY - 1);
    expect(makingDo(state)).toBe(false);
    expect(buildings.zonesOfType('compost')).toEqual([]);
    expect(makingDoPurchases(w, state).size).toBe(0);

    checkMakingDo(w, state, MAKING_DO_FROM_DAY);
    expect(makingDo(state)).toBe(true);
    const asked = trade.requests('hillfolk');
    expect(asked.length).toBe(requests + 2);
    expect(asked).toContainEqual({ itemType: 'soil_load', material: 'clay', priority: 1 });
    expect(asked).toContainEqual({ itemType: 'candle', material: 'tallow', priority: 1 });
    expect(trade.requests('wildwood')).toContainEqual({ itemType: 'honey', material: 'honey', priority: 1 });
    for (const type of ['kiln', 'loom', 'clothier']) expect(buildings.get(state.placedIds[type] ?? 0)?.typeId, type).toBe(type);
    expect(buildings.zonesOfType('compost').length).toBe(1);
    const plots = buildings.zonesOfType('farm_plot');
    expect(plots.length).toBeGreaterThan(0);
    for (const plot of plots) expect(w.readers.of<PlantsReader>('07').plotFertilize(plot)).toBe(true);
    expect(makingDoPurchases(w, state).get('candle')).toBe(5);
  });

  it('sets the spirits the Thane wished for aside, and gives them back when the whim is gone; fine meals rot, and are not set aside', () => {
    const w = threeYearsWorld('three-years-p0-1', 0);
    const state = setupThreeYearsFortress(w);
    const items = w.readers.of<ItemsReader>('13');
    const dwarves = w.game.world.scheduler.byId('10') as unknown as { whim: { id: string; setTick: number } | null };
    const wagon = w.game.arrival!.wagon;
    const deepfire = { type: w.game.registry.table('items').index('drink'), materialId: w.game.registry.table('materials').index('deepfire') };
    w.spawnItem('drink', 'deepfire', w.index(wagon.x, wagon.y + 1, wagon.z), 10);
    w.spawnItem('drink', 'deepfire', w.index(wagon.x + 1, wagon.y + 1, wagon.z), 5);
    w.spawnItem('fine_meal', 'meal', w.index(wagon.x + 2, wagon.y + 1, wagon.z), 10);
    w.spawnItem('fine_meal', 'meal', w.index(wagon.x + 3, wagon.y + 1, wagon.z), 10);
    const before = items.countAvailable(deepfire);
    dwarves.whim = { id: 'whim_spirits', setTick: w.tick };

    // Before the strand nothing is set aside.
    keepThanesShare(w, state);
    expect(state.economy.thaneShare).toBeUndefined();

    state.economy.phases.add('making do');
    keepThanesShare(w, state);
    expect(state.economy.thaneShare?.whim).toBe('whim_spirits');
    expect(before - items.countAvailable(deepfire)).toBeGreaterThanOrEqual(10);

    dwarves.whim = null;
    keepThanesShare(w, state);
    expect(state.economy.thaneShare).toBeUndefined();
    expect(items.countAvailable(deepfire)).toBe(before);

    const meals = items.available('fine_meal');
    dwarves.whim = { id: 'whim_fine_meal', setTick: w.tick };
    keepThanesShare(w, state);
    expect(state.economy.thaneShare).toBeUndefined();
    expect(items.available('fine_meal')).toBe(meals);
  });
});
