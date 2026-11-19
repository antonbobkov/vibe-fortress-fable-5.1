import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings/reader';
import { COAL_STOCK, FUEL_SHORT, keepCoal, keepOreStore, ORE_STORE_TILES } from '../scenarios/three_years_economy';
import { setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';

/**
 * T-642: with the coal smelted, the strong squad's steel waited on iron bars while the iron ore lay
 * unsmelted: the smelter's one worker fetched each ore from the drift it was dug in, and its coal
 * smelts came before the iron with the fuel already in stock. A player stores the ore by the smelter
 * and smelts the coal ahead of the iron only while the fuel is short.
 */
describe('T-642 the three-year script keeps the iron coming to the smelter', () => {
  const setup = () => {
    const w = threeYearsWorld('three-years-p2-1', 2);
    const state = setupThreeYearsFortress(w);
    // A small workshop hall below the halls: two sites side by side, a lane around them.
    const z = state.hallZ - 1;
    const x0 = state.cx - 8, y0 = state.cy + 2;
    const tiles: number[] = [];
    for (let y = y0; y < y0 + 5; y += 1) for (let x = x0; x < x0 + 8; x += 1) {
      const t = w.index(x, y, z);
      w.carve(t, TileKind.Floor);
      w.discover(t);
      tiles.push(t);
    }
    const slots = [w.index(x0 + 1, y0 + 1, z), w.index(x0 + 4, y0 + 1, z)];
    state.economy.workHall = { stair: w.index(x0, y0, state.hallZ), tiles, slots };
    const smelter = w.build('smelter', slots[0]!);
    state.placedIds['smelter'] = smelter;
    w.step(1);
    for (const order of [{ recipeId: 'alloy_steel', mode: 'once', remaining: 30 }, { recipeId: 'smelt_hematite', mode: 'maintain', threshold: 40 }]) {
      const result = w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter, order: { ...order, priority: 4 } });
      expect(result.ok, result.ok ? '' : result.reason).toBe(true);
    }
    return { w, state, smelter, x0, y0, z, slots };
  };

  it('smelts the coal after the iron while the fuel is in stock, and ahead of it while it is short', () => {
    const { w, state, smelter, x0, y0, z } = setup();
    const recipes = w.game.registry.table<{ id: string }>('recipes');
    const orders = (): string[] => w.game.world.entities.get(smelter, C.Workshop)!.orders.map((o) => `${recipes.byIndex(o.recipe)?.id}:${o.mode === 'once' ? o.remaining : o.threshold}`);
    keepCoal(w, state, smelter, 120);
    expect(orders(), 'no fuel: the coal first').toEqual(['alloy_steel:30', `smelt_bituminous_coal:${COAL_STOCK}`, `smelt_lignite:${COAL_STOCK}`, 'smelt_hematite:40']);
    w.spawnItem('charcoal_bar', 'charcoal', w.index(x0 + 7, y0 + 4, z), FUEL_SHORT);
    keepCoal(w, state, smelter, 121);
    expect(orders(), 'fuel in stock: the iron first').toEqual(['alloy_steel:30', 'smelt_hematite:40', `smelt_bituminous_coal:${COAL_STOCK}`, `smelt_lignite:${COAL_STOCK}`]);
    keepCoal(w, state, smelter, 122);
    expect(orders(), 'unchanged while the fuel lasts').toEqual(['alloy_steel:30', 'smelt_hematite:40', `smelt_bituminous_coal:${COAL_STOCK}`, `smelt_lignite:${COAL_STOCK}`]);
  }, 120_000);

  it('stores the ore on the lanes nearest the smelter, leaving the free site free', () => {
    const { w, state, slots } = setup();
    const buildings = w.readers.of<BuildingsReader>('14');
    keepOreStore(w, state);
    expect(state.economy.phases.has('ore store')).toBe(true);
    const site = new Set(buildings.ghost('smelter', slots[1]!, 0).tiles);
    expect(site.size).toBe(9);
    const zones = new Set(state.economy.workHall!.tiles.map((t) => buildings.zoneAt(t)).filter((id) => id !== 0));
    expect(zones.size).toBe(1);
    const zone = [...zones][0]!;
    const zoned = state.economy.workHall!.tiles.filter((t) => buildings.zoneAt(t) === zone);
    expect(zoned.length).toBe(Math.min(ORE_STORE_TILES, 40 - 18));
    for (const t of zoned) {
      expect(site.has(t), 'not on the free site').toBe(false);
      expect(buildings.at(t), 'not under the smelter').toBe(0);
    }
    expect(buildings.zone(zone)?.type).toBe('stockpile');
    // Once only.
    keepOreStore(w, state);
    expect(new Set(state.economy.workHall!.tiles.map((t) => buildings.zoneAt(t)).filter((id) => id !== 0)).size).toBe(1);
  }, 120_000);
});
