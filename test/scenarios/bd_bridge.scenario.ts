/** T-M6-13: a lever raises a gate bridge under a goblin, sealing a raid, and lowering restores the path. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { LINK_DELAY_TICKS } from '@systems/buildings/constants';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { arriveParty } from '@systems/threats';
import type { Scenario } from './runner';

let bridge = 0;
let lever = 0;
let goblin = 0;
let partyId = 0;
const scenario: Scenario = {
  id: 'bd_bridge', milestone: 6, seed: 'bd-bridge', world: 'flat-test', embark: 'none',
  setup: (w) => {
    const granite = w.game.registry.table('materials').index('granite');
    for (let x = 20; x <= 28; x += 1) for (let y = 20; y <= 28; y += 1) {
      if (x === 20 || x === 28 || y === 20 || y === 28) w.game.world.services.terrain.setKind(w.index(x, y, 32), TileKind.Wall, granite);
    }
    w.game.world.services.terrain.setKind(w.index(20, 24, 32), TileKind.Open, 0);
    const placed = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'drawbridge', origin: w.index(20, 24, 32),
      width: 2, height: 1, orientation: 2, materialChoice: 'granite' });
    expect(placed.ok).toBe(true);
    const buildings = w.game.world.scheduler.byId('14') as BuildingsSystem;
    bridge = buildings.lastPlacedBuilding;
    buildings.completeNow(bridge, granite);
    lever = w.build('lever', w.index(25, 24, 32), 'granite');
    w.build('hearth', w.index(24, 24, 32), 'granite');
    const record = w.game.world.entities.get(lever, C.Building)!;
    w.game.world.entities.add(lever, C.Building, { ...record, linkedIds: [bridge] });
    const dwarf = w.spawnDwarf({ at: w.index(25, 25, 32) });
    expect(w.game.world.applyCommand({ type: 'SetLabor', dwarfId: dwarf, labor: 'hauling', on: true }).ok).toBe(true);
  },
  run: (w) => {
    const buildings = w.readers.of<BuildingsReader>('14');
    const outside = w.index(19, 24, 32);
    const inside = w.index(23, 24, 32);
    w.step(1);
    expect(w.readers.pathing.reachable(outside, inside, 'walker')).toBe(true);
    expect(w.game.world.applyCommand({ type: 'PullLever', leverId: lever }).ok).toBe(true);
    w.until(() => w.events('MechanismTriggered').some((e) => e['sourceId'] === lever && e['on'] === true), 500);
    w.step(LINK_DELAY_TICKS - 1);
    goblin = w.spawnCreature('gloam_warrior', w.index(20, 24, 32), 'hostile:gloam');
    w.until(() => buildings.mechanismState(bridge) === 'raised', 10);
    expect(w.events('DamageDealt').some((e) => e['defenderId'] === goblin)).toBe(true);
    expect(w.game.world.services.movement?.tileOf(goblin)).not.toBe(w.index(20, 24, 32));
    expect(w.readers.pathing.reachable(outside, inside, 'walker')).toBe(false);
    partyId = arriveParty(w.game.world, w.game.registry, w.game.world.rngFor('18'), 'raid', 'gloam', 2, 'w', w.tick, 0, 2, false).partyId;
    w.until(() => w.game.world.entities.get(partyId, C.Party)?.state === 'loiter', 1000);
    w.until(() => w.events('RaidEnded').some((e) => e['partyId'] === partyId && e['outcome'] === 'withdrew'), 3500);
    // A scripted second lever edge tests the lowering path after the two-day raid has left.
    w.game.world.emit({ type: 'MechanismTriggered', sourceId: lever, on: false });
    w.until(() => buildings.mechanismState(bridge) === 'lowered', LINK_DELAY_TICKS + 10);
    w.until(() => w.readers.pathing.reachable(outside, inside, 'walker'), 20);
  },
};
export default scenario;
