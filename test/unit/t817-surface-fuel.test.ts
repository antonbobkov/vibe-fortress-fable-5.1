import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings/reader';
import { COAL_STOCK, FUEL_SHORT, fuelToHand, keepCoal } from '../scenarios/three_years_economy';
import { setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';
import type { TestWorld } from '../scenarios/test-world';

/**
 * T-817: the coal comes ahead of the iron only while the fuel the smelter can reach is short. A
 * smelter below counts the fuel under a roof (the charcoal on the surface is behind the gate when it
 * is locked); a smelter on the surface counts every bar. The peril-0 main fortress never works below:
 * its smelter, wood furnace and 40 charcoal stood on the surface, the fuel under a roof read 0 all of
 * year 3, its lignite was smelted ahead of the iron the whole year, and it made no steel.
 */
describe('T-817 the three-year script counts the fuel on the smelter\'s side of the gate', () => {
  const COAL_FIRST = [`smelt_bituminous_coal:${COAL_STOCK}`, `smelt_lignite:${COAL_STOCK}`, 'alloy_steel:30', 'smelt_hematite:40'];
  const IRON_FIRST = ['alloy_steel:30', 'smelt_hematite:40', `smelt_bituminous_coal:${COAL_STOCK}`, `smelt_lignite:${COAL_STOCK}`];

  /** The first open surface floor tiles in tile order, top level down, that `ok` accepts. */
  const surface = (w: TestWorld, ok: (t: number) => boolean): number => {
    for (let z = w.map.d - 1; z >= 0; z -= 1) for (let y = 3; y < w.map.h - 3; y += 1) for (let x = 3; x < w.map.w - 3; x += 1) {
      const t = w.index(x, y, z);
      if (w.map.kindAt(t) === TileKind.Floor && w.map.hasFlag(t, TileFlag.Outdoor) && ok(t)) return t;
    }
    return -1;
  };

  const withOrders = (w: TestWorld, smelter: number): (() => string[]) => {
    for (const order of [{ recipeId: 'alloy_steel', mode: 'once', remaining: 30 }, { recipeId: 'smelt_hematite', mode: 'maintain', threshold: 40 }]) {
      const result = w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter, order: { ...order, priority: 4 } });
      expect(result.ok, result.ok ? '' : result.reason).toBe(true);
    }
    const recipes = w.game.registry.table<{ id: string }>('recipes');
    return () => w.game.world.entities.get(smelter, C.Workshop)!.orders.map((o) => `${recipes.byIndex(o.recipe)?.id}:${o.mode === 'once' ? o.remaining : o.threshold}`);
  };

  it('a smelter on the surface counts the charcoal on the surface, and smelts the iron ahead of the coal', () => {
    const w = threeYearsWorld('three-years-p0-3', 0);
    const state = setupThreeYearsFortress(w);
    const buildings = w.readers.of<BuildingsReader>('14');
    const site = surface(w, (t) => buildings.ghost('smelter', t, 0).tiles.every((u) => w.map.kindAt(u) === TileKind.Floor && w.map.hasFlag(u, TileFlag.Outdoor) && buildings.at(u) === 0));
    expect(site, 'a bare surface site').toBeGreaterThanOrEqual(0);
    const smelter = w.build('smelter', site);
    state.placedIds['smelter'] = smelter;
    w.step(1);
    const orders = withOrders(w, smelter);
    expect(fuelToHand(w, smelter), 'no fuel yet').toBe(0);
    keepCoal(w, state, smelter, 224);
    expect(orders(), 'no fuel: the coal first').toEqual(COAL_FIRST);
    const footprint = new Set(buildings.get(smelter)!.footprint);
    const pile = surface(w, (t) => !footprint.has(t) && buildings.at(t) === 0);
    w.spawnItem('charcoal_bar', 'charcoal', pile, FUEL_SHORT);
    expect(fuelToHand(w, smelter), 'the surface charcoal is to hand').toBe(FUEL_SHORT);
    keepCoal(w, state, smelter, 225);
    expect(orders(), 'fuel to hand: the steel and the iron first').toEqual(IRON_FIRST);
  }, 120_000);

  it('a smelter below counts only the fuel under a roof', () => {
    const w = threeYearsWorld('three-years-p0-3', 0);
    const state = setupThreeYearsFortress(w);
    const z = state.hallZ - 1;
    const x0 = state.cx - 8, y0 = state.cy + 2;
    for (let y = y0; y < y0 + 5; y += 1) for (let x = x0; x < x0 + 8; x += 1) {
      const t = w.index(x, y, z);
      w.carve(t, TileKind.Floor);
      w.discover(t);
    }
    const smelter = w.build('smelter', w.index(x0 + 1, y0 + 1, z));
    state.placedIds['smelter'] = smelter;
    w.step(1);
    const orders = withOrders(w, smelter);
    const buildings = w.readers.of<BuildingsReader>('14');
    w.spawnItem('charcoal_bar', 'charcoal', surface(w, (t) => buildings.at(t) === 0), FUEL_SHORT);
    expect(fuelToHand(w, smelter), 'the surface charcoal is behind the gate').toBe(0);
    keepCoal(w, state, smelter, 224);
    expect(orders(), 'the coal first').toEqual(COAL_FIRST);
    w.spawnItem('charcoal_bar', 'charcoal', w.index(x0 + 7, y0 + 4, z), FUEL_SHORT);
    expect(fuelToHand(w, smelter)).toBe(FUEL_SHORT);
    keepCoal(w, state, smelter, 225);
    expect(orders(), 'fuel below: the steel and the iron first').toEqual(IRON_FIRST);
  }, 120_000);
});
