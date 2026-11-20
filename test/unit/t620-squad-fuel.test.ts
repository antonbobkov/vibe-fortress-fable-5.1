import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { Designation, TileKind } from '@core/map3d';
import { COAL_STOCK, keepCoal } from '../scenarios/three_years_economy';
import { opensToHillside, setupThreeYearsFortress, threeYearsWorld } from '../scenarios/three_years_fortress';

/**
 * T-620: charcoal bound the strong squad's steel, while every peril-2 and peril-4 map of the sweep
 * holds 200 to 550 tiles of coal between the halls and the soil that no mine reached. A player digs
 * and smelts it: once the smelter makes steel, the miners drift to the nearest coal off the gate's
 * stair above the halls, and the smelter keeps bars of coal after the steel, before the iron.
 */
describe('T-620 the three-year script digs and smelts the coal for the steel', () => {
  it('three-years-p2-1: smelts coal (first, with no fuel), and drifts to coal above the halls, shut from the hillside', () => {
    const w = threeYearsWorld('three-years-p2-1', 2);
    const state = setupThreeYearsFortress(w);
    const map = w.map;
    const recipes = w.game.registry.table<{ id: string }>('recipes');
    const materials = w.game.registry.table<{ id: string }>('materials');
    const site = w.index(state.cx - 4, state.cy + 2, state.hallZ);
    for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) { w.carve(map.offset(site, dx, dy, 0), TileKind.Floor); w.discover(map.offset(site, dx, dy, 0)); }
    const smelter = w.build('smelter', site);
    w.step(1);
    for (const order of [{ recipeId: 'alloy_steel', mode: 'once', remaining: 30 }, { recipeId: 'smelt_hematite', mode: 'maintain', threshold: 40 }]) {
      const result = w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter, order: { ...order, priority: 4 } });
      expect(result.ok, result.ok ? '' : result.reason).toBe(true);
    }
    const before = new Set<number>();
    for (let z = 0; z < map.d; z += 1) for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) {
      const t = w.index(x, y, z);
      if (map.designationAt(t) === Designation.Dig) before.add(t);
    }

    keepCoal(w, state, smelter, 120);
    const orders = w.game.world.entities.get(smelter, C.Workshop)!.orders.map((o) => `${recipes.byIndex(o.recipe)?.id}:${o.mode === 'once' ? o.remaining : o.threshold}`);
    // T-642: with no fuel in stock the coal goes first, ahead of the alloy too.
    expect(orders).toEqual([`smelt_bituminous_coal:${COAL_STOCK}`, `smelt_lignite:${COAL_STOCK}`, 'alloy_steel:30', 'smelt_hematite:40']);
    const dug: number[] = [];
    for (let z = 0; z < map.d; z += 1) for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) {
      const t = w.index(x, y, z);
      if (map.designationAt(t) === Designation.Dig && !before.has(t)) dug.push(t);
    }
    const coal = dug.filter((t) => ['bituminous_coal', 'lignite'].includes(materials.byIndex(map.materialAt(t))?.id ?? ''));
    expect(coal.length, 'coal faces designated').toBeGreaterThan(0);
    for (const t of dug) {
      expect(map.zOf(t), 'above the halls, below the soil').toBeGreaterThan(state.hallZ);
      expect(map.zOf(t)).toBeLessThan(state.z - 1);
      expect(opensToHillside(w, t), `${map.xOf(t)},${map.yOf(t)},${map.zOf(t)} opens to no hillside`).toBe(false);
    }
    // The same season, with the faces still to dig, nothing more is asked for.
    keepCoal(w, state, smelter, 121);
    let after = 0;
    for (let z = 0; z < map.d; z += 1) for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) if (map.designationAt(w.index(x, y, z)) === Designation.Dig) after += 1;
    expect(after).toBe(before.size + dug.length);
  }, 120_000);
});
