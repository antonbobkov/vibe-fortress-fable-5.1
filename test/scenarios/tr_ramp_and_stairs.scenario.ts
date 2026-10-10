import { expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import type { Scenario } from './runner';

/** T-157: a miner carves a ramp; a builder completes every ramp/stair construction. */
const scenario: Scenario = {
  id: 'tr_ramp_and_stairs', milestone: 8, seed: 'tr-ramp-and-stairs', world: 'flat-test', embark: 'none',
  run: (w) => {
    const ramp = w.index(15, 10, 32);
    const granite = w.game.registry.table('materials').index('granite');
    w.carve(ramp, TileKind.Wall, granite);
    w.spawnDwarf({ at: w.index(14, 10, 32), skills: { mining: 15, building: 15 } });
    w.spawnItem('pick', 'iron', w.index(14, 10, 32));
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [ramp], kind: 'ramp' }).ok).toBe(true);
    w.until((v) => v.events('JobCompleted').some((e) => e['jobType'] === 'carve_ramp'), 800);
    expect(w.map.kindAt(ramp)).toBe(TileKind.Ramp);
    const types = ['ramp', 'stairs_up', 'stairs_down', 'stairs_updown', 'floor', 'paved_floor'] as const;
    const kinds = [TileKind.Ramp, TileKind.StairsUp, TileKind.StairsDown, TileKind.StairsUpDown, TileKind.Floor, TileKind.Floor];
    w.spawnItem('stone_block', 'granite', w.index(22, 12, 32), 20);
    const buildings = w.readers.of<BuildingsReader>('14');
    for (const [i, type] of types.entries()) {
      const tile = w.index(20 + i * 3, 10, 32);
      if (type === 'ramp') w.carve(w.map.index(21, 10, 32), TileKind.Wall, granite);
      if (type === 'stairs_down' || type === 'stairs_updown') w.carve(w.map.below(tile), TileKind.Open);
      expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: type,
        origin: tile, materialChoice: 'granite' }).ok, type).toBe(true);
      const id = buildings.at(tile);
      w.until(() => w.game.world.entities.get(id, C.Building)?.state === 'built', 1200);
      w.step(1);
      expect(w.map.kindAt(tile), type).toBe(kinds[i]);
      expect(w.events('BuildingCompleted').some((e) => e['id'] === id && e['buildingType'] === type)).toBe(true);
    }
  },
};
export default scenario;
