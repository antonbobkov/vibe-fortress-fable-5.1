/** T-M6-13 pit: retracting a bridge drops a raider three levels into a hatch-sealed chamber. */
import { expect } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import { LINK_DELAY_TICKS } from '@systems/buildings/constants';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { Scenario } from './runner';

let bridge = 0;
let lever = 0;
let raider = 0;
let span = 0;
let landing = 0;
const scenario: Scenario = {
  id: 'df_pattern_pit', milestone: 6, seed: 'df-pattern-pit', world: 'flat-test', embark: 'none',
  setup: (w) => {
    const granite = w.game.registry.table('materials').index('granite');
    span = w.index(40, 40, 32);
    landing = w.index(40, 40, 28);
    for (let z = 29; z <= 32; z += 1) {
      const tile = w.index(40, 40, z);
      w.game.world.services.terrain.setKind(tile, TileKind.Open, 0);
      w.game.world.services.terrain.setFlag(tile, TileFlag.Discovered, true);
    }
    w.game.world.services.terrain.setKind(landing, TileKind.Floor, granite);
    w.game.world.services.terrain.setFlag(landing, TileFlag.Discovered, true);
    for (const n of w.map.neighbors8(landing)) w.game.world.services.terrain.setKind(n, TileKind.Wall, granite);
    w.game.world.services.terrain.setKind(w.index(41, 40, 28), TileKind.StairsDown, granite);
    w.game.world.services.terrain.setFlag(w.index(41, 40, 28), TileFlag.Discovered, true);
    const hatch = w.build('hatch', w.index(41, 40, 28), 'granite');
    expect(w.game.world.applyCommand({ type: 'SetHatchMode', buildingId: hatch, mode: 'locked' }).ok).toBe(true);
    const placed = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'drawbridge', origin: span,
      width: 2, height: 1, orientation: 2, materialChoice: 'granite' });
    expect(placed.ok).toBe(true);
    const buildings = w.game.world.scheduler.byId('14') as BuildingsSystem;
    bridge = buildings.lastPlacedBuilding;
    buildings.completeNow(bridge, granite);
    lever = w.build('lever', w.index(43, 40, 32), 'granite');
    const record = w.game.world.entities.get(lever, C.Building)!;
    w.game.world.entities.add(lever, C.Building, { ...record, linkedIds: [bridge] });
    raider = w.spawnCreature('gloam_warrior', span, 'hostile:gloam');
  },
  run: (w) => {
    const buildings = w.readers.of<BuildingsReader>('14');
    w.step(1);
    expect(w.map.kindAt(span)).toBe(TileKind.Floor);
    w.game.world.emit({ type: 'MechanismTriggered', sourceId: lever, on: true });
    w.step(LINK_DELAY_TICKS);
    expect(buildings.mechanismState(bridge)).toBe('lowered');
    w.until(() => buildings.mechanismState(bridge) === 'raised', 10);
    expect(w.events('Fell').some((e) => e['id'] === raider)).toBe(true);
    expect(w.game.world.services.movement?.tileOf(raider)).toBe(landing);
    expect(w.events('DamageDealt').some((e) => e['defenderId'] === raider)).toBe(true);
  },
};
export default scenario;
