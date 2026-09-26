/** T-M6-12 plate edge and delay; T-M6-13 drawbridge outcome. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { LINK_DELAY_TICKS } from '@systems/buildings/constants';
import type { BuildingsSystem } from '@systems/buildings';
import type { Scenario } from './runner';

let plate = 0;
let target = 0;
let goblin = 0;
const scenario: Scenario = {
  id: 'df_plate_bridge', milestone: 6, seed: 'df-plate-bridge', world: 'flat-test', embark: 'none',
  setup: (w) => {
    const granite = w.game.registry.table('materials').index('granite');
    plate = w.build('pressure_plate', w.index(40, 40, 32), 'granite');
    w.game.world.services.terrain.setKind(w.index(51, 40, 32), TileKind.Open, granite);
    const result = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'drawbridge', origin: w.index(50, 40, 32),
      orientation: 0, materialChoice: 'granite', width: 2, height: 1 });
    expect(result.ok).toBe(true);
    const buildings = w.game.world.scheduler.byId('14') as BuildingsSystem;
    target = buildings.lastPlacedBuilding;
    buildings.completeNow(target, granite);
    const record = w.game.world.entities.get(plate, C.Building);
    if (record) w.game.world.entities.add(plate, C.Building, { ...record, linkedIds: [target] });
    goblin = w.spawnCreature('gloam_warrior', w.index(39, 40, 32), 'hostile:gloam');
  },
  run: (w) => {
    w.step(1);
    w.game.world.services.movement?.teleport(goblin, w.index(40, 40, 32));
    w.until((world) => world.events('MechanismTriggered').some((event) => event['sourceId'] === plate && event['on'] === true), 4);
    const triggered = w.tick;
    expect(w.readers.of<{ mechanismState(id: number): string }>('14').mechanismState(target)).toBe('lowered');
    w.step(LINK_DELAY_TICKS - 1);
    expect(w.readers.of<{ mechanismState(id: number): string }>('14').mechanismState(target)).toBe('lowered');
    w.until((world) => world.readers.of<{ mechanismState(id: number): string }>('14').mechanismState(target) === 'raised', 10);
    expect(w.tick - triggered).toBeLessThanOrEqual(LINK_DELAY_TICKS + 10);
    expect(w.readers.pathing.passable(w.index(51, 40, 32), 'walker')).toBe(false);
  },
};
export default scenario;
