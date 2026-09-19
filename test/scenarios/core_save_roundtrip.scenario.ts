/**
 * `core_save_roundtrip` of `04-implementation/acceptance-tests.md` § Core: "run 5,000 ticks, save,
 * load, run 5,000 more; compare to an uninterrupted 10,000 | identical hash".
 *
 * `M2-things.md` T-M2-11: "now with dwarves, jobs, items, buildings": the default party on the
 * `flat-test` map, with stones and logs to haul, a stone stockpile, walls and a workshop to build
 * and channels to dig, so that every system has work in flight when the save is taken. The save
 * goes through the real container (compressed when the platform can) and the full load procedure.
 */

import { expect } from 'vitest';
import type { Command } from '@core/commands';
import { gameHeader, gameSections, inMemorySave, restoreGame } from '@app/game-save';
import { SAVE_FORMAT_VERSION } from '@app/save-manager';
import type { Scenario } from './runner';
import { TestWorld } from './test-world';
import { rect } from './m1-helpers';

const SEED = 'core-save-roundtrip';
const HALF = 5_000;
const Z = 32;

/** The same busy start for the saved run and the uninterrupted one. */
export function prepareBusyFortress(w: TestWorld): void {
  for (let k = 0; k < 30; k += 1) w.spawnItem('raw_stone', 'granite', w.index(40 + (k % 10), 18 + Math.floor(k / 10), Z));
  for (let k = 0; k < 6; k += 1) w.spawnItem('log', 'pine', w.index(30 + k, 30, Z));
  const commands: Command[] = [
    { type: 'CreateZone', zoneType: 'stockpile', tiles: rect(w, 44, 26, Z, 5, 4) },
    { type: 'PlaceBuilding', buildingType: 'wall', origin: w.index(52, 20, Z), orientation: 0, materialChoice: 0 },
    { type: 'PlaceBuilding', buildingType: 'wall', origin: w.index(53, 20, Z), orientation: 0, materialChoice: 0 },
    { type: 'PlaceBuilding', buildingType: 'carpenter', origin: w.index(56, 24, Z), orientation: 0, materialChoice: 0 },
    { type: 'Designate', kind: 'channel', tiles: rect(w, 36, 36, Z, 4, 2), priority: 4 },
  ];
  for (const command of commands) w.submit(command);
}

const scenario: Scenario = {
  id: 'core_save_roundtrip',
  milestone: 2,
  seed: SEED,
  world: 'flat-test',
  embark: 'default',
  setup: prepareBusyFortress,
  run: (w) => {
    w.step(HALF);
    const header = { ...gameHeader(w.game, 'manual'), formatVersion: SAVE_FORMAT_VERSION, compressed: false };
    const loaded = restoreGame(inMemorySave(header, gameSections(w.game)));
    expect(loaded.game.hash()).toBe(w.hash());
    loaded.game.step(HALF);

    const uninterrupted = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
    prepareBusyFortress(uninterrupted);
    uninterrupted.step(2 * HALF);
    expect(loaded.game.tick).toBe(uninterrupted.tick);
    expect(loaded.game.hash()).toBe(uninterrupted.hash());
    // There was work to carry across the save: something was built and something hauled.
    expect(uninterrupted.events('BuildingCompleted').length).toBeGreaterThan(0);
    expect(uninterrupted.events('JobCompleted').length).toBeGreaterThan(0);
  },
};

export default scenario;
