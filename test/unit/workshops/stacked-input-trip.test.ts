import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { gameHeader, gameSections, inMemorySave, restoreGame } from '@app/game-save';
import { SAVE_FORMAT_VERSION } from '@app/save-manager';
import type { ItemsReader } from '@systems/items';
import type { JobsSystem } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M4-17 stacked craft input trip', () => {
  it('fetches four brew plants from one stack in one pickup and drop cycle', () => {
    const w = new TestWorld({ seed: 'stacked-brew-trip', world: 'flat-test', embark: 'none' });
    const still = w.build('still', w.index(12, 12, 32));
    const dwarf = w.spawnDwarf({ at: w.index(16, 14, 32) });
    const plants = w.spawnItem('plant_food', 'dimcap', w.index(23, 14, 32), 6);
    w.spawnItem('barrel', 'oak', w.index(17, 14, 32));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: still,
      order: { recipeId: 'brew', remaining: 1, mode: 'once' } })).toEqual({ ok: true });
    const items = w.readers.of<ItemsReader>('13');
    const jobs = w.game.world.scheduler.byId('11') as JobsSystem;
    let pickups = 0;
    let drops = 0;
    let carryingPlant = false;
    let deliveredPlant = false;
    let reservedUnits = 0;
    for (let tick = 0; tick < 3000 && w.events('ItemCrafted').length === 0; tick += 1) {
      w.step(1);
      const job = [...jobs.board.jobs.values()].find((j) => j.target.ref === still);
      if (reservedUnits === 0 && job?.inputs[0]?.reserved.length === 1) {
        reservedUnits = items.get(job.inputs[0].reserved[0]!)?.count ?? 0;
      }
      const carryingId = w.game.world.entities.get(dwarf, C.Worker)?.carrying ?? 0;
      const carryingNow = carryingId !== 0 && items.get(carryingId)?.type === items.get(plants)?.type;
      if (carryingNow && !carryingPlant) pickups += 1;
      if (!carryingNow && carryingPlant) drops += 1;
      carryingPlant = carryingNow;
      if (job?.inputs[0]?.delivered.length === 1) deliveredPlant = true;
    }
    expect(deliveredPlant).toBe(true);
    expect(pickups).toBe(1);
    expect(drops).toBe(1);
    expect(reservedUnits).toBe(4);
    expect(w.events('ItemCrafted').some((e) => e['recipeId'] === 'brew')).toBe(true);
  });

  it('continues a partially fetched stacked brew identically after save and load', () => {
    const w = new TestWorld({ seed: 'stacked-brew-save', world: 'flat-test', embark: 'none' });
    const still = w.build('still', w.index(12, 12, 32));
    w.spawnDwarf({ at: w.index(16, 14, 32) });
    w.spawnItem('plant_food', 'dimcap', w.index(23, 14, 32), 4);
    w.spawnItem('barrel', 'oak', w.index(18, 14, 32));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: still,
      order: { recipeId: 'brew', remaining: 1, mode: 'once' } })).toEqual({ ok: true });
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    w.until(() => [...board.jobs.values()].some((job) => job.target.ref === still &&
      job.inputs[0]?.delivered.length === 1 && job.inputs[1]?.delivered.length === 0), 3000);
    const header = { ...gameHeader(w.game, 'manual'), formatVersion: SAVE_FORMAT_VERSION, compressed: false };
    const loaded = restoreGame(inMemorySave(header, gameSections(w.game)));
    expect(loaded.game.hash()).toBe(w.hash());
    w.step(600);
    loaded.game.step(600);
    expect(loaded.game.hash()).toBe(w.hash());
  });
});
