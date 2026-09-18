import { describe, it, expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';
import { rect } from '../../scenarios/m1-helpers';

const Z = 25;

function bld(w: TestWorld): BuildingsReader {
  return w.readers.of<BuildingsReader>('14');
}

function apply(w: TestWorld, cmd: Record<string, unknown>): { ok: boolean; reason?: string } {
  return w.game.world.applyCommand(cmd as never) as { ok: boolean; reason?: string };
}

/** A w × h room dug in the granite at z 25, its tiles and its border discovered. */
function dig(w: TestWorld, x: number, y: number, width: number, height: number): TileIndex[] {
  w.digRoom(x, y, Z, width, height);
  for (let yy = y - 1; yy <= y + height; yy += 1) for (let xx = x - 1; xx <= x + width; xx += 1) w.discover(w.index(xx, yy, Z));
  return rect(w, x, y, Z, width, height);
}

describe('T-M2-07 rooms', () => {
  it('enclosure: rock all round encloses; an opening does not; a door in the opening encloses again', () => {
    const w = new TestWorld({ seed: 'enclosure', world: 'flat-test' });
    const tiles = dig(w, 30, 30, 3, 3);
    const zone = w.zone('barracks', tiles);
    w.step(10);
    expect(bld(w).room(zone)).toMatchObject({ enclosed: true, requirementsMet: true });
    // Open a gap in the north wall and run a corridor out.
    const gap = w.index(31, 29, Z);
    const granite = w.game.registry.table('materials').index('granite');
    for (let y = 26; y <= 29; y += 1) w.game.world.services.terrain.setKind(w.index(31, y, Z), TileKind.Floor, granite);
    w.step(10);
    expect(bld(w).room(zone)?.enclosed).toBe(false);
    const unenclosed = bld(w).room(zone)?.score ?? 0;
    w.build('door', gap, 'oak');
    w.step(10);
    expect(bld(w).room(zone)?.enclosed).toBe(true);
    // Barracks with no furniture: 9 natural stone tiles, 9 size; the door adds nothing inside.
    expect(unenclosed).toBe(9 + 9);
    expect(bld(w).room(zone)?.score).toBe((9 + 9) * 1.5);
  });

  it('requirements per room type', () => {
    const w = new TestWorld({ seed: 'requirements', world: 'flat-test' });
    const zoneOf = (type: string, x: number): EntityId => w.zone(type, dig(w, x, 30, 3, 3));
    const bedroom = zoneOf('bedroom', 10);
    const dining = zoneOf('dining_hall', 20);
    const hearthHall = zoneOf('hearth_hall', 30);
    const hospital = zoneOf('hospital', 40);
    const tomb = zoneOf('tomb', 50);
    const barracks = zoneOf('barracks', 60);
    w.step(10);
    const met = (): boolean[] => [bedroom, dining, hearthHall, hospital, tomb, barracks].map((z) => bld(w).room(z)?.requirementsMet ?? false);
    expect(met()).toEqual([false, false, false, false, false, true]);
    w.build('bed', w.index(10, 30, Z), 'oak');
    w.build('table', w.index(20, 30, Z), 'oak');
    w.build('hearth', w.index(31, 31, Z), 'granite');
    w.build('bed', w.index(40, 30, Z), 'oak');
    w.build('coffin', w.index(50, 30, Z), 'granite');
    w.step(10);
    // A table alone is no dining seat; a hospital needs a chest besides the bed.
    expect(met()).toEqual([true, false, true, false, true, true]);
    w.build('chair', w.index(22, 32, Z), 'oak');
    w.build('chest', w.index(42, 32, Z), 'oak');
    w.step(10);
    expect(met()).toEqual([true, false, true, true, true, true]);
    w.build('chair', w.index(21, 31, Z), 'oak');
    w.step(10);
    expect(met()).toEqual([true, true, true, true, true, true]);
    expect(bld(w).diningSeats()).toHaveLength(1);
  });

  it('the hearth hall is the 5×5 around the hearth while no hearth-hall zone holds it', () => {
    const w = new TestWorld({ seed: 'hearth-hall', world: 'flat-test' });
    expect(bld(w).hearthHallTiles()).toEqual([]);
    expect(bld(w).hearthHallTier()).toBe(0);
    const tiles = dig(w, 30, 30, 5, 5);
    const hearth = w.index(32, 32, Z);
    w.build('hearth', hearth, 'granite');
    expect(bld(w).hearthHallTiles()).toEqual(tiles);
    // 25 stone tiles + 25 size, enclosed: 75 → decent.
    expect(bld(w).hearthHallTier()).toBe(2);
    // A hearth-hall zone may take in the (impassable) hearth's tile (D-075).
    const zone = w.zone('hearth_hall', dig(w, 29, 30, 7, 5));
    w.step(10);
    expect(bld(w).hearthHallTiles()).toHaveLength(35);
    expect(bld(w).hearthHallTier()).toBe(bld(w).room(zone)?.tier);
  });

  it('AssignRoom: a bedroom with a bed; one bedroom per dwarf; RoomAssigned', () => {
    const w = new TestWorld({ seed: 'assign', world: 'flat-test', embark: 'default' });
    const a = w.zone('bedroom', dig(w, 10, 30, 2, 2));
    const b = w.zone('bedroom', dig(w, 20, 30, 2, 2));
    const barracks = w.zone('barracks', dig(w, 30, 30, 2, 2));
    const dwarf = w.game.arrival?.dwarves[0] as EntityId;
    expect(apply(w, { type: 'AssignRoom', zoneId: a, dwarfId: dwarf })).toEqual({ ok: false, reason: 'no_bed' });
    expect(apply(w, { type: 'AssignRoom', zoneId: barracks, dwarfId: dwarf })).toEqual({ ok: false, reason: 'precondition_failed' });
    expect(apply(w, { type: 'AssignRoom', zoneId: 9999, dwarfId: dwarf })).toEqual({ ok: false, reason: 'not_found' });
    w.step(1);
    const bedA = w.build('bed', w.index(10, 30, Z), 'oak');
    w.build('bed', w.index(20, 30, Z), 'oak');
    expect(apply(w, { type: 'AssignRoom', zoneId: a, dwarfId: 12345 })).toEqual({ ok: false, reason: 'not_found' });
    expect(apply(w, { type: 'AssignRoom', zoneId: a, dwarfId: dwarf })).toEqual({ ok: true });
    expect(bld(w).bedroomOf(dwarf)).toBe(a);
    expect(bld(w).freeBeds()).not.toContain(bedA);
    expect(apply(w, { type: 'AssignRoom', zoneId: b, dwarfId: dwarf })).toEqual({ ok: true });
    expect(bld(w).bedroomOf(dwarf)).toBe(b);
    expect(bld(w).ownerOf(a)).toBe(0);
    expect(bld(w).freeBeds()).toContain(bedA);
    w.step(1);
    expect(w.events('RoomAssigned').map((e) => [e['zoneId'], e['dwarfId']])).toEqual([
      [a, dwarf],
      [a, 0],
      [b, dwarf],
    ]);
  });

  it('daily auto-assignment: titled dwarves first (Thane, Warden, Broker, Chief Medic), then lowest mood, then id', () => {
    const w = new TestWorld({ seed: 'auto-assign', world: 'flat-test', embark: 'default' });
    const entities = w.game.world.entities;
    const dwarves = (w.game.arrival?.dwarves ?? []).slice();
    const thane = w.game.arrival?.thane as EntityId;
    // Give two others titles, out of id order: the higher id is the Warden, the lower the Chief Medic.
    const others = dwarves.filter((d) => d !== thane);
    const warden = others[others.length - 1] as EntityId;
    const medic = others[0] as EntityId;
    entities.add(warden, C.Title, { title: 'warden' });
    entities.add(medic, C.Title, { title: 'chief_medic' });
    const zones: EntityId[] = [];
    for (let k = 0; k < 4; k += 1) {
      const z = w.zone('bedroom', dig(w, 10 + k * 4, 30, 2, 2));
      w.build('bed', w.index(10 + k * 4, 30, Z), 'oak');
      zones.push(z);
    }
    // Each mood is the 55 stub, so the untitled go by id.
    const untitled = others.filter((d) => d !== warden && d !== medic).sort((x, y) => x - y);
    w.until((x) => x.events('RoomAssigned').length >= 4, 2 * 24 * 60 * 10);
    expect(zones.map((z) => bld(w).ownerOf(z))).toEqual([thane, warden, medic, untitled[0]]);
    // A second day gives nothing new: every bedroom is owned.
    const n = w.events('RoomAssigned').length;
    w.step(24 * 60 * 10 + 10);
    expect(w.events('RoomAssigned')).toHaveLength(n);
  });

  it('a building completed inside, a smoothing on the border and a removal each rescore the room', () => {
    const w = new TestWorld({ seed: 'rescore', world: 'flat-test' });
    const tiles = dig(w, 30, 30, 2, 2);
    const zone = w.zone('bedroom', tiles);
    w.step(10);
    const bare = bld(w).room(zone)?.score ?? 0;
    const bed = w.build('bed', w.index(30, 30, Z), 'oak');
    w.step(10);
    expect(bld(w).room(zone)?.score).toBeGreaterThan(bare);
    // Soil is worth nothing, natural stone 1: turn one tile to soil through the terrain API.
    const soil = w.game.registry.table('materials').index('loam');
    w.game.world.services.terrain.setKind(w.index(31, 31, Z), TileKind.Floor, soil);
    w.step(10);
    const withSoil = bld(w).room(zone)?.score ?? 0;
    const system = w.game.world.scheduler.byId('14') as unknown as { buildings: { remove(id: EntityId): void } };
    system.buildings.remove(bed);
    w.step(10);
    expect(bld(w).room(zone)?.score).toBeLessThan(withSoil);
    expect(bld(w).room(zone)?.requirementsMet).toBe(false);
    apply(w, { type: 'RemoveZone', zoneId: zone });
    w.step(1);
    expect(bld(w).room(zone)).toBeUndefined();
  });
});
