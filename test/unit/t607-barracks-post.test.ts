/**
 * T-607: a squad at its barracks takes the zone's tiles a walker can stand on (16 § Squads), so a
 * member is never posted to the tile an archery target fills, and every member trains.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z, HeadlessGame } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { BuildingsSystem } from '@systems/buildings';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import { dwarfComponents } from '@systems/dwarves/rules/components';
import { makeDwarf } from '@systems/dwarves/rules/make-dwarf';

function spawnAdultDwarf(game: HeadlessGame, at: number): number {
  const record = makeDwarf(game.world.rngFor('testworld'), game.registry);
  record.ageYears = 25;
  return game.world.services.spawn.creature(
    game.registry.table('creatures').index('dwarf'),
    at,
    'fortress',
    {
      name: record.name,
      ageTicks: record.ageYears * TICKS_PER_YEAR,
      child: false,
      dwarf: dwarfComponents(record, game.registry, game.world.rngFor('10'), 'none'),
    },
  );
}

describe('T-607: barracks posts skip a tile nobody can stand on', () => {
  it('T-607: with an archery target on the zone\'s first tile, every member is present and trains', () => {
    const game = new HeadlessGame({ seed: 't607-post', world: 'flat-test', embark: 'none' });
    const entities = game.world.entities;
    const at = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);
    const tiles = [at, at + 1, at + 2, at + 3];
    expect(game.world.applyCommand({ type: 'CreateZone', zoneType: 'barracks', tiles }).ok).toBe(true);
    const buildings = game.world.readers.of<BuildingsReader>('14');
    const zoneId = buildings.zonesOfType('barracks')[0] as number;
    expect(buildings.zone(zoneId)?.tiles[0]).toBe(at);

    const oak = game.registry.table('materials').index('oak');
    expect(game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'archery_target', origin: at, orientation: 0, materialChoice: 'oak' }).ok).toBe(true);
    const bSystem = game.world.scheduler.byId('14') as BuildingsSystem;
    bSystem.completeNow(bSystem.lastPlacedBuilding, oak, 0);
    expect(game.world.readers.pathing.passable(at, 'walker', { faction: 'fortress' })).toBe(false);

    // Two unarmed soldiers off the zone: the lower id is the first member, whose post was the target's tile.
    const a = spawnAdultDwarf(game, game.map.index(10, 14, FLAT_TEST_SURFACE_Z));
    const b = spawnAdultDwarf(game, game.map.index(12, 14, FLAT_TEST_SURFACE_Z));
    game.world.applyCommand({ type: 'CreateSquad', name: 'Posts' });
    const squad = game.world.readers.of<CombatReader>('16').squads()[0] as SquadWithId;
    expect(game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [a, b] }).ok).toBe(true);
    expect(game.world.applyCommand({ type: 'SetZoneSetting', zoneId, key: 'squad', value: squad.id }).ok).toBe(true);
    expect(game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'train' }).ok).toBe(true);

    const dodge = game.registry.table('skills').index('dodge');
    game.step(1500);
    for (const m of [a, b]) {
      const pos = entities.get(m, C.Position);
      expect(pos === undefined ? -1 : tiles.indexOf(game.map.index(pos.x, pos.y, pos.z))).toBeGreaterThan(0);
      expect(entities.get(m, C.Skills)?.xp[dodge] ?? 0).toBeGreaterThan(0);
    }
  });
});
