/**
 * T-664: the three-year script answers a famine as a player does. In fortresses raids had cut to a
 * dozen the farm was left to the founding farmer and the immigrants: with the farmer dead or in the
 * hospital the ripe crops waited with no worker, or with soldiers at drill as the only farmers, or
 * behind the craft and build jobs T-570 raises when they wait, and the fortress starved with its
 * harvest standing in the field. With food for under FAMINE_DAYS and a ripe crop left a day, every
 * adult is given farming and farming goes a step ahead of the squad's kit; both are taken back once
 * the stores are full again. And nobody outside the hospital is left without the hauling labor,
 * which feeds the patients; and `keepAMiner` gives the pick to the founding farmer last.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import type { JobsReader } from '@systems/jobs';
import type { PlantsReader } from '@systems/plants';
import { stageLength } from '@systems/plants/growth';
import {
  FAMINE_FARMING_PRIORITY, FOUNDING_FARMER, keepAHauler, keepAMiner, keepFoodFirst, type EconomyState,
} from '../scenarios/three_years_economy';
import { setupThreeYearsFortress, threeYearsWorld, type FortressState } from '../scenarios/three_years_fortress';
import { TestWorld } from '../scenarios/test-world';

function fortress(): FortressState {
  return { cx: 20, cy: 20, z: Z, hallZ: Z - 5, placedIds: {}, economy: { phases: new Set<string>(), specialists: {} } as unknown as EconomyState,
    gateDoorId: 0, gateDoorId2: 0, gateWallLostTick: 0, squadId: 0 } as unknown as FortressState;
}

describe('T-664 the three-year script answers a famine', () => {
  it('gives every adult farming and puts it ahead of the kit while ripe crops wait and food is short, and takes both back after', () => {
    const w = new TestWorld({ seed: 't664-famine', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const jobs = w.readers.of<JobsReader>('11');
    const tiles = [0, 1, 2].map((dx) => w.index(40 + dx, 60, Z));
    w.zone('farm_plot', tiles);
    const barley = w.plants.facts.row(w.plants.facts.indexOf('barley'))!;
    for (const t of tiles) {
      const id = w.plantCrop(t, 'barley', 3);
      w.game.world.entities.add(id, C.Crop, { ...w.game.world.entities.get(id, C.Crop)!, growth: stageLength(barley) });
    }
    expect(tiles.every((t) => w.readers.of<PlantsReader>('07').cropReady(t))).toBe(true);
    const miner = w.spawnDwarf({ at: w.index(30, 60, Z) });
    const smith = w.spawnDwarf({ at: w.index(31, 60, Z) });
    for (const id of [miner, smith]) w.setLabor(id, 'farming', false);
    const state = fortress();

    // The crops are ripe but have not waited a day: no famine yet.
    w.step(300);
    keepFoodFirst(w, state);
    expect(state.economy.famine).toBeUndefined();
    w.step(1200);
    keepFoodFirst(w, state);
    expect(state.economy.famine?.hands.slice().sort()).toEqual([miner, smith].sort());
    expect(jobs.laborEnabled(miner, 'farming')).toBe(true);
    expect(jobs.laborPriority('farming')).toBe(FAMINE_FARMING_PRIORITY);
    w.until(() => w.readers.of<PlantsReader>('07').crops().length === 0, 2400);
    expect(w.readers.of<PlantsReader>('07').crops(), 'the crops are harvested').toEqual([]);

    // Stores for twenty days end it: the labor and its priority go back.
    w.spawnItem('plant_food', 'turnip', w.index(30, 62, Z), 40);
    keepFoodFirst(w, state);
    expect(state.economy.famine).toBeUndefined();
    expect(jobs.laborEnabled(miner, 'farming')).toBe(false);
    expect(jobs.laborEnabled(smith, 'farming')).toBe(false);
    expect(jobs.laborPriority('farming')).toBe(4);
  });

  it('gives hauling to everyone out of the hospital when none of them hauls', () => {
    const w = new TestWorld({ seed: 't664-hauler', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const jobs = w.readers.of<JobsReader>('11');
    const a = w.spawnDwarf({ at: w.index(30, 60, Z) });
    const b = w.spawnDwarf({ at: w.index(31, 60, Z) });
    w.setLabor(a, 'hauling', false);
    keepAHauler(w);
    expect(jobs.laborEnabled(a, 'hauling'), 'one still hauls').toBe(false);
    w.setLabor(b, 'hauling', false);
    keepAHauler(w);
    expect([a, b].every((id) => jobs.laborEnabled(id, 'hauling'))).toBe(true);
  });

  it('gives the pick to the founding farmer last', () => {
    const w = threeYearsWorld('three-years-p4-2', 4);
    const state = setupThreeYearsFortress(w);
    const jobs = w.readers.of<JobsReader>('11');
    const founders = w.game.arrival!.dwarves;
    for (const id of founders) w.setLabor(id, 'mining', false);
    w.setSkill(founders[FOUNDING_FARMER]!, 'mining', 15);
    keepAMiner(w, state);
    const miners = founders.filter((id) => jobs.laborEnabled(id, 'mining'));
    expect(miners).toHaveLength(1);
    expect(miners[0]).not.toBe(founders[FOUNDING_FARMER]);
  });
});
