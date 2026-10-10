import { expect } from 'vitest';
import { C } from '@core/components';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';

/** T-157: racks are built furniture used in a squad's scored training room. */
const scenario: Scenario = {
  id: 'bd_racks', milestone: 8, seed: 'bd-racks', world: 'flat-test', embark: 'none',
  run: (w) => {
    const tiles = [w.index(20, 20, 32), w.index(21, 20, 32), w.index(22, 20, 32)];
    const zone = w.zone('barracks', tiles);
    w.spawnDwarf({ at: w.index(19, 20, 32), skills: { building: 10 } });
    const buildings = w.readers.of<BuildingsReader>('14');
    const items = w.readers.of<ItemsReader>('13');
    const linked: number[] = [];
    for (const [i, type] of ['weapon_rack', 'armor_stand'].entries()) {
      const item = w.spawnItem(type, 'iron', w.index(19, 21 + i, 32), 1, 4);
      expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: type,
        origin: tiles[i]!, materialChoice: 'iron' }).ok).toBe(true);
      const building = buildings.at(tiles[i]!);
      w.until(() => buildings.get(building)?.state === 'built', 1000);
      expect(buildings.get(building)?.itemId).toBe(item);
      linked.push(item);
    }
    w.step(1);
    expect(buildings.roomScore(zone)?.parts.furniture).toBeCloseTo(linked.reduce((sum, id) => sum + items.value(id) / 10, 0));
    const soldier = w.spawnDwarf({ at: tiles[2]! });
    const apply = w.game.world.applyCommand.bind(w.game.world);
    expect(apply({ type: 'CreateSquad', name: 'Rack room' }).ok).toBe(true);
    const squad = w.readers.of<CombatReader>('16').squads()[0]!.id;
    expect(apply({ type: 'SetSquadMembers', squadId: squad, members: [soldier] }).ok).toBe(true);
    expect(apply({ type: 'SetZoneSetting', zoneId: zone, key: 'squad', value: squad }).ok).toBe(true);
    expect(apply({ type: 'SetSquadMode', squadId: squad, mode: 'train' }).ok).toBe(true);
    w.until((v) => v.events('TrainingSession').some((e) => e['squadId'] === squad), 500);
    expect(w.game.world.entities.get(squad, C.Squad)?.barracksZoneId).toBe(zone);
    expect(w.events('TrainingSession')[0]?.['members']).toContain(soldier);
  },
};
export default scenario;
