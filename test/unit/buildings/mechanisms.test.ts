import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M6-13 mechanisms', () => {
  it('links through work at the target and source, consumes a mechanism, and returns it on unlink', () => {
    const w = new TestWorld({ seed: 'm613-link', world: 'flat-test', embark: 'none' });
    const source = w.build('lever', w.index(40, 40, 32), 'granite');
    const target = w.build('floodgate_building', w.index(44, 40, 32), 'granite');
    const dwarf = w.spawnDwarf({ at: w.index(42, 40, 32), skills: { mechanics: 8 } });
    expect(w.game.world.applyCommand({ type: 'SetLabor', dwarfId: dwarf, labor: 'mechanics', on: true }).ok).toBe(true);
    const mechanism = w.spawnItem('mechanism', 'granite', w.index(42, 41, 32));
    const buildings = w.readers.of<BuildingsReader>('14');
    expect(w.game.world.applyCommand({ type: 'LinkMechanism', sourceId: source, targetId: target }).ok).toBe(true);
    w.until(() => buildings.get(source)?.linkedIds.includes(target) === true, 1500);
    expect(buildings.get(target)?.linkedIds).toContain(source);
    expect(w.game.world.entities.alive(mechanism)).toBe(false);
    expect(w.game.world.applyCommand({ type: 'UnlinkMechanism', sourceId: source, targetId: target }).ok).toBe(true);
    expect(buildings.get(source)?.linkedIds).not.toContain(target);
    expect(buildings.get(target)?.linkedIds).not.toContain(source);
    expect(w.readers.of<ItemsReader>('13').count('mechanism')).toBe(1);
  });

  it('a lowered bridge spans open space and a raised bridge blocks the path and displaces a creature', () => {
    const w = new TestWorld({ seed: 'm613-bridge', world: 'flat-test', embark: 'none' });
    const granite = w.game.registry.table('materials').index('granite');
    const open = w.index(51, 40, 32);
    w.game.world.services.terrain.setKind(open, TileKind.Open, 0);
    const placed = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'drawbridge', origin: w.index(50, 40, 32),
      width: 2, height: 1, orientation: 0, materialChoice: 'granite' });
    expect(placed.ok).toBe(true);
    const buildings = w.game.world.scheduler.byId('14') as BuildingsSystem;
    const bridge = buildings.lastPlacedBuilding;
    buildings.completeNow(bridge, granite);
    expect(w.map.kindAt(open)).toBe(TileKind.Floor);
    expect(w.readers.pathing.passable(open, 'walker')).toBe(true);
    const goblin = w.spawnCreature('gloam_warrior', open, 'hostile:gloam');
    const record = w.game.world.entities.get(bridge, C.Building);
    expect(record).toBeDefined();
    w.game.world.emit({ type: 'MechanismTriggered', sourceId: bridge, on: true });
    // A bridge is normally triggered through a linked lever or plate; wire a setup plate.
    const plate = w.build('pressure_plate', w.index(40, 40, 32), 'granite');
    const p = w.game.world.entities.get(plate, C.Building)!;
    w.game.world.entities.add(plate, C.Building, { ...p, linkedIds: [bridge] });
    w.game.world.emit({ type: 'MechanismTriggered', sourceId: plate, on: true });
    w.until(() => w.readers.of<BuildingsReader>('14').mechanismState(bridge) === 'raised', 130);
    expect(w.readers.pathing.passable(open, 'walker')).toBe(false);
    expect(w.map.kindAt(open)).toBe(TileKind.Open);
    expect(w.game.world.services.movement?.tileOf(goblin)).not.toBe(open);
    expect(w.events('DamageDealt').some((e) => e['defenderId'] === goblin)).toBe(true);
  });
});
