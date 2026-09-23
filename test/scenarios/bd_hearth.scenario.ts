import { expect } from 'vitest';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import type { MaterialsReader } from '@systems/materials';
import type { MoraleReader } from '@systems/morale';
import type { Scenario } from './runner';
import { rect } from './m1-helpers';

const scenario: Scenario = {
  id: 'bd_hearth', milestone: 4, seed: 'bd-hearth', world: 'flat-test', embark: 'none',
  run: (w) => {
    const z = 25;
    w.digRoom(48, 48, z, 7, 7);
    w.digRoom(45, 51, z, 3, 1);
    for (const tile of rect(w, 48, 48, z, 7, 7)) w.discover(tile);
    for (const tile of rect(w, 45, 51, z, 3, 1)) w.discover(tile);
    const at = w.index(51, 51, z);
    const edge = w.index(53, 53, z);
    const outside = w.index(54, 54, z);
    const dwarf = w.spawnDwarf({ at: w.index(45, 51, z) });
    const buildings = w.readers.of<BuildingsReader>('14');
    const materials = w.readers.of<MaterialsReader>('05');
    const before = materials.temperatureAt(edge);
    expect(buildings.hearthLightAt(edge)).toBe(false);
    const hearth = w.build('hearth', at, 'granite');
    expect(buildings.hearth()).toBe(hearth);
    expect(buildings.hearthHallTiles()).toHaveLength(25);
    expect(buildings.hearthLightAt(edge)).toBe(true);
    expect(buildings.hearthLightAt(outside)).toBe(false);
    expect(w.map.hasFlag(edge, TileFlag.Lit)).toBe(false);
    expect(materials.temperatureAt(edge)).toBe(before + 2);
    expect(materials.temperatureAt(outside)).not.toBe(before + 2);
    w.step(1);
    expect(w.events('HearthLit')).toHaveLength(1);
    expect(w.readers.of<MoraleReader>('15').thoughts(dwarf).some((t) => t.id === 'hearth_lit' && t.value > 0)).toBe(true);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'hearth', origin: outside, orientation: 0, materialChoice: 'granite' }))
      .toEqual({ ok: false, reason: 'hearth_exists' });
    expect(w.game.world.applyCommand({ type: 'DeconstructBuilding', buildingId: hearth }))
      .toEqual({ ok: false, reason: 'hearth_is_home' });
    w.digRoom(60, 60, z, 2, 2);
    const otherTiles = rect(w, 60, 60, z, 2, 2);
    for (const tile of otherTiles) w.discover(tile);
    const emptyHall = w.zone('hearth_hall', otherTiles);
    w.step(10);
    expect(buildings.room(emptyHall)?.requirementsMet).toBe(false);
    expect(buildings.hearthHallTiles()).toHaveLength(25);
    const zone = w.zone('hearth_hall', rect(w, 49, 49, z, 5, 5));
    w.step(10);
    expect(buildings.room(zone)?.requirementsMet).toBe(true);
    expect(buildings.hearthHallTiles()).toEqual(buildings.zone(zone)?.tiles);
    w.until(() => {
      const p = w.game.world.entities.get(dwarf, C.Position);
      return p !== undefined && buildings.hearthHallTiles().includes(w.index(p.x, p.y, p.z));
    }, 500);
    expect(w.events('DwarfIdle').some((event) => event['id'] === dwarf)).toBe(true);
  },
};
export default scenario;
