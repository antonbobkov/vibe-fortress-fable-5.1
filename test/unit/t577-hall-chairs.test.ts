/**
 * T-577: the three-year script's halls do not wait for stone. In `three-years-p4-4` at shift 100 the
 * dining hall's four chairs were planned on day 28 and never built: only the mason made chairs, and
 * the stone was cut into tables, then traded, then went to blocks and crafts; the carpenter's tables
 * stood behind its barrels. The carpenter now keeps two wooden chairs and two wooden tables in stock
 * ahead of its barrels.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { CARPENTER_ORDERS, MASON_ORDERS, standingOrders, Z } from '../scenarios/three_years_fortress';
import { TestWorld } from '../scenarios/test-world';

const index = (orders: readonly { recipeId: string }[], id: string): number => orders.findIndex((o) => o.recipeId === id);

describe('T-577 the halls\' tables and chairs', () => {
  it('the carpenter keeps wooden chairs and tables ahead of its barrels; the mason makes both', () => {
    for (const id of ['make_chair_wood', 'make_table_wood']) {
      expect(index(CARPENTER_ORDERS, id), id).toBeGreaterThanOrEqual(0);
      expect(index(CARPENTER_ORDERS, id), id).toBeLessThan(index(CARPENTER_ORDERS, 'make_barrel'));
    }
    for (const id of ['make_chair_stone', 'make_table_stone']) expect(index(MASON_ORDERS, id), id).toBeGreaterThanOrEqual(0);
  });

  it('with no stone in the fortress, the carpenter\'s table and chair finish a dining hall', () => {
    const w = new TestWorld({ seed: 't577-hall-chairs', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const granite = w.game.registry.table('materials').index('granite');
    for (let y = 10; y <= 30; y += 1) for (let x = 10; x <= 30; x += 1) {
      const t = w.index(x, y, Z);
      w.carve(t, TileKind.Floor, granite);
      w.map.setFlag(t, TileFlag.Grass, false);
    }
    const carpenter = w.build('carpenter', w.index(14, 14, Z), 'granite');
    w.build('mason', w.index(14, 20, Z), 'granite');
    const dwarf = w.spawnDwarf({ at: w.index(18, 18, Z) });
    for (const labor of ['carpentry', 'masonry', 'construction', 'hauling']) w.setLabor(dwarf, labor);
    w.spawnItem('log', 'oak', w.index(17, 14, Z), 10);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'table', origin: w.index(24, 24, Z), orientation: 0, materialChoice: 0 }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'chair', origin: w.index(23, 24, Z), orientation: 0, materialChoice: 0 }).ok).toBe(true);
    const hall = w.zone('dining_hall', [w.index(23, 23, Z), w.index(24, 23, Z), w.index(23, 24, Z), w.index(24, 24, Z), w.index(23, 25, Z), w.index(24, 25, Z)]);
    w.step(1); // the workshop takes orders once its Workshop component is added
    standingOrders(w, carpenter, CARPENTER_ORDERS);
    expect(w.readers.of<ItemsReader>('13').count('raw_stone')).toBe(0);

    const buildings = w.readers.of<BuildingsReader>('14');
    w.until(() => buildings.roomScore(hall)?.requirementsMet === true, 3 * TICKS_PER_DAY);
    expect(buildings.roomScore(hall)?.requirementsMet).toBe(true);
  });
});
