import { describe, expect, it } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import { type BuildingsReader, type BuildingsSystem } from '@systems/buildings';
import type { CombatReader } from '@systems/combat';
import { SPAR_TICKS } from '@systems/combat/constants';
import { rejectionText } from '@ui/messages';
import { Strings } from '@ui/strings';
import { TestWorld } from '../scenarios/test-world';

function world(seed: string): TestWorld {
  return new TestWorld({ seed, map: buildFlatTestMap(contentRegistry(), 48, 48) });
}

describe('T-120 retained building and training resolutions', () => {
  it('D-075: daily assignment uses actual morale so the higher-id unhappy unhoused dwarf gets the bedroom', () => {
    const w = world('t120-room-mood');
    const a = w.spawnDwarf({ at: w.index(15, 15, 32) });
    const b = w.spawnDwarf({ at: w.index(16, 15, 32) });
    const zone = w.zone('bedroom', [w.index(20, 20, 32), w.index(21, 20, 32)]);
    w.build('bed', w.index(20, 20, 32), 'oak');
    w.step(1);
    const entities = w.game.world.entities;
    entities.add(a, C.Mood, { value: 75, tier: 3, thoughts: [], sulkCounterDays: 0 });
    entities.add(b, C.Mood, { value: 25, tier: 1, thoughts: [], sulkCounterDays: 0 });
    expect(a).toBeLessThan(b);
    const buildings = w.readers.of<BuildingsReader>('14');
    expect(buildings.bedroomOf(a)).toBe(0);
    expect(buildings.bedroomOf(b)).toBe(0);
    const rooms = (w.game.world.scheduler.byId('14') as BuildingsSystem).rooms;
    rooms.recompute();
    expect(buildings.room(zone)?.requirementsMet).toBe(true);
    rooms.autoAssign();
    expect(buildings.ownerOf(zone)).toBe(b);
  });

  it.each(['bed', 'wall', 'carpenter'])('D-170: rejects dimensions on fixed %s before making an entity or job, and names the building', (type) => {
    const w = world(`t120-fixed-${type}`);
    const cmd = { type: 'PlaceBuilding' as const, buildingType: type, origin: w.index(10, 10, 32), width: 2, height: 2 };
    const before = w.game.world.entities.with(C.Building);
    expect(w.game.world.applyCommand(cmd)).toEqual({ ok: false, reason: 'fixed_footprint' });
    expect(w.game.world.entities.with(C.Building)).toEqual(before);
    w.step(1);
    expect(w.events('BuildingPlaced')).toHaveLength(0);
    expect(w.events('JobCreated')).toHaveLength(0);
    const registry = w.game.registry;
    const name = registry.table<{ id: string; name: string }>('buildings').byId(type)!.name;
    expect(rejectionText({ registry, readers: w.readers, strings: new Strings(registry) }, cmd, 'fixed_footprint').toLowerCase()).toContain(name.toLowerCase());
  });

  it('D-170: a variable drawbridge accepts bounded integer dimensions and refuses invalid dimensions', () => {
    const w = world('t120-variable-bridge');
    const origin = w.index(10, 10, 32);
    for (const dimensions of [{ width: 0, height: 2 }, { width: 2.5, height: 2 }, { width: 6, height: 2 }]) {
      expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'drawbridge', origin, ...dimensions })).toEqual({ ok: false, reason: 'out_of_range' });
    }
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'drawbridge', origin, width: 2, height: 3 })).toEqual({ ok: true });
    const buildings = w.readers.of<BuildingsReader>('14');
    expect(buildings.get(buildings.at(origin))?.footprint).toHaveLength(6);
    // Omitted optional dimensions still use the fixed type's own footprint.
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'bed', origin: w.index(20, 20, 32), width: undefined, height: undefined })).toEqual({ ok: true });
  });

  it('D-249: a squad that has trained follows a new barracks assignment and trains there', () => {
    const w = world('t120-training-reassign');
    const firstTile = w.index(10, 10, 32);
    const secondTile = w.index(30, 30, 32);
    const dwarf = w.spawnDwarf({ at: firstTile });
    const first = w.zone('barracks', [firstTile, w.index(11, 10, 32)]);
    const second = w.zone('barracks', [secondTile, w.index(31, 30, 32)]);
    const apply = w.game.world.applyCommand.bind(w.game.world);
    expect(apply({ type: 'CreateSquad', name: 'Moving guard' })).toEqual({ ok: true });
    const combat = w.readers.of<CombatReader>('16');
    const squadId = combat.squads()[0]!.id;
    expect(apply({ type: 'SetSquadMembers', squadId, members: [dwarf] })).toEqual({ ok: true });
    expect(apply({ type: 'SetZoneSetting', zoneId: first, key: 'squad', value: squadId })).toEqual({ ok: true });
    expect(apply({ type: 'SetSquadMode', squadId, mode: 'train' })).toEqual({ ok: true });
    w.step(2);
    expect(w.events('TrainingSession').some((e) => e['squadId'] === squadId)).toBe(true);
    expect(combat.squad(squadId)?.barracksZoneId).toBe(first);
    expect(apply({ type: 'SetZoneSetting', zoneId: first, key: 'squad', value: 0 })).toEqual({ ok: true });
    expect(apply({ type: 'SetZoneSetting', zoneId: second, key: 'squad', value: squadId })).toEqual({ ok: true });
    w.step(1);
    expect(combat.squad(squadId)?.barracksZoneId).toBe(second);
    w.movement.teleport(dwarf, secondTile);
    const sessions = w.events('TrainingSession').length;
    w.until((ww) => ww.events('TrainingSession').length > sessions, SPAR_TICKS + 2);
    const pos = w.game.world.entities.get(dwarf, C.Position)!;
    expect([secondTile, w.index(31, 30, 32)]).toContain(w.index(pos.x, pos.y, pos.z));
    expect(w.map.hasFlag(secondTile, TileFlag.Discovered)).toBe(true);
  });
});
