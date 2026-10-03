import { describe, it, expect } from 'vitest';
import { C, ItemFlag } from '@core/components';
import { TileKind } from '@core/map3d';
import { ALERT_LOCK_GRACE_TICKS, ALERT_OUTSIDE_CLEAR_TICKS } from '@systems/defense/constants';
import type { MoverOptions } from '@core/pathfinding';
import type { EntityId, MovementClass, TileIndex } from '@core/types';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function bld(w: TestWorld): BuildingsReader {
  return w.readers.of<BuildingsReader>('14');
}

function items(w: TestWorld): ItemsReader {
  return w.readers.of<ItemsReader>('13');
}

function apply(w: TestWorld, cmd: Record<string, unknown>): { ok: boolean; reason?: string } {
  return w.game.world.applyCommand(cmd as never) as { ok: boolean; reason?: string };
}

/** A door in a one-tile gap of a wall line across the map at y = 20 (walls east and west of it). */
function doorWorld(seed: string): { w: TestWorld; door: EntityId; t: TileIndex } {
  const w = new TestWorld({ seed, world: 'flat-test' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const t = w.index(40, 20, Z);
  const door = w.build('door', t, 'oak');
  w.step(1);
  return { w, door, t };
}

describe('T-M2-06 doors', () => {
  it('passability matrix: fortress, wild, hostile with and without opensDoors, tame at no_pets, large, locked', () => {
    const { w, door, t } = doorWorld('door-matrix');
    const b = bld(w);
    const rows: [string, MovementClass, string | undefined, MoverOptions, boolean, boolean, boolean][] = [
      // label, class, faction, mover, blocked open, blocked no_pets, blocked locked
      ['labels (no faction)', 'walker', undefined, {}, false, false, true],
      ['dwarf', 'walker', 'fortress', { faction: 'fortress' }, false, false, true],
      ['tame dog', 'walker', 'fortress', { faction: 'fortress', tame: true }, false, true, true],
      ['trader', 'walker', 'trader:hillfolk', { faction: 'trader:hillfolk' }, false, false, true],
      ['wild elk', 'walker', 'wild', { faction: 'wild' }, true, true, true],
      ['gloam warrior (opens doors)', 'walker', 'hostile:gloam', { faction: 'hostile:gloam', opensDoors: true }, false, false, true],
      ['troll (breaks doors, cannot open)', 'walker', 'hostile:gloam', { faction: 'hostile:gloam' }, true, true, true],
      ['hollow crawler', 'walker', 'deep', { faction: 'deep' }, true, true, true],
      ['large fortress animal', 'large', 'fortress', { faction: 'fortress' }, true, true, true],
    ];
    for (const mode of ['open', 'no_pets', 'locked'] as const) {
      expect(apply(w, { type: 'SetDoorMode', buildingId: door, mode })).toEqual({ ok: true });
      for (const [label, cls, faction, mover, open, noPets, locked] of rows) {
        const want = mode === 'open' ? open : mode === 'no_pets' ? noPets : locked;
        expect([label, mode, b.blocksMovementAt(t, cls, faction, mover)]).toEqual([label, mode, want]);
        expect([label, mode, w.pathing.graph.passable(t, cls, mover)]).toEqual([label, mode, !want]);
      }
    }
    expect(b.doorAt(t)).toBe(true);
    expect(b.mechanismState(door)).toBe('locked');
  });

  it('a locked door cuts connectivity; unlocking restores it; BuildingStateChanged per change', () => {
    const { w, door } = doorWorld('door-lock');
    const north = w.index(40, 15, Z);
    const south = w.index(40, 25, Z);
    expect(w.reachable(north, south)).toBe(true);
    expect(apply(w, { type: 'SetDoorMode', buildingId: door, mode: 'locked' })).toEqual({ ok: true });
    w.step(1);
    expect(w.reachable(north, south)).toBe(false);
    expect(apply(w, { type: 'SetDoorMode', buildingId: door, mode: 'open' })).toEqual({ ok: true });
    w.step(1);
    expect(w.reachable(north, south)).toBe(true);
    expect(w.events('BuildingStateChanged').map((e) => e['state'])).toEqual(['locked', 'open']);
  });

  it('lock_on_alert locks while the alert is `hearth`', () => {
    const { w, door, t } = doorWorld('door-alert');
    expect(apply(w, { type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' })).toEqual({ ok: true });
    expect(bld(w).blocksMovementAt(t, 'walker', 'fortress', { faction: 'fortress' })).toBe(false);
    w.game.world.fortress.alert = 'hearth';
    expect(bld(w).blocksMovementAt(t, 'walker', 'fortress', { faction: 'fortress' })).toBe(true);
    expect(bld(w).mechanismState(door)).toBe('locked');
  });

  it('SetDoorMode and SetHatchMode: the tag and the mode are checked', () => {
    const { w, door } = doorWorld('door-cmds');
    const bed = w.build('bed', w.index(30, 30, Z), 'oak');
    expect(apply(w, { type: 'SetDoorMode', buildingId: 9999, mode: 'locked' })).toEqual({ ok: false, reason: 'not_found' });
    expect(apply(w, { type: 'SetDoorMode', buildingId: bed, mode: 'locked' })).toEqual({ ok: false, reason: 'no_tag' });
    expect(apply(w, { type: 'SetHatchMode', buildingId: door, mode: 'locked' })).toEqual({ ok: false, reason: 'no_tag' });
    expect(apply(w, { type: 'SetDoorMode', buildingId: door, mode: 'ajar' })).toEqual({ ok: false, reason: 'bad_setting' });
    expect(bld(w).get(door)?.mode).toBe('open');
  });

  it('a closed door blocks line of sight; a creature in the doorway opens it', () => {
    const { w, door, t } = doorWorld('door-sight');
    const a = w.index(40, 17, Z);
    const c = w.index(40, 23, Z);
    expect(w.pathing.graph.lineOfSight(a, c)).toBe(false);
    expect(bld(w).doorOpen(door)).toBe(false);
    w.spawnCreature('cow', t, 'fortress');
    expect(bld(w).doorOpen(door)).toBe(true);
    expect(w.pathing.graph.lineOfSight(a, c)).toBe(true);
  });

  it('a door needs walls on two opposite sides', () => {
    const w = new TestWorld({ seed: 'door-walls', world: 'flat-test' });
    expect(apply(w, { type: 'PlaceBuilding', buildingType: 'door', origin: w.index(30, 30, Z) })).toEqual({ ok: false, reason: 'bad_placement' });
  });
});

describe('T-M2-06 hatches', () => {
  it('a locked hatch removes the stairs edge through its tile (pathfinding)', () => {
    const w = new TestWorld({ seed: 'hatch', world: 'flat-test' });
    const granite = w.game.registry.table('materials').index('granite');
    const terrain = w.game.world.services.terrain;
    const top = w.index(30, 30, Z);
    const bottom = w.index(30, 30, Z - 1);
    const room = w.index(31, 30, Z - 1);
    terrain.setKind(top, TileKind.StairsDown, granite);
    terrain.setKind(bottom, TileKind.StairsUp, granite);
    terrain.setKind(room, TileKind.Floor, granite);
    const hatch = w.build('hatch', top, 'oak');
    w.step(1);
    expect(w.pathing.graph.hasEdge(top, bottom, 'walker')).toBe(true);
    expect(w.reachable(w.index(30, 28, Z), room)).toBe(true);
    // A hatch never blocks horizontal movement.
    expect(bld(w).blocksMovementAt(top, 'walker', 'wild', { faction: 'wild' })).toBe(false);
    expect(apply(w, { type: 'SetHatchMode', buildingId: hatch, mode: 'locked' })).toEqual({ ok: true });
    w.step(1);
    expect(bld(w).lockedHatchAt(top)).toBe(true);
    expect(bld(w).blocksFallAt(top)).toBe(true);
    expect(w.pathing.graph.hasEdge(top, bottom, 'walker')).toBe(false);
    expect(w.pathing.graph.hasEdge(bottom, top, 'walker')).toBe(false);
    expect(w.reachable(w.index(30, 28, Z), room)).toBe(false);
    expect(w.pathing.graph.passable(top, 'walker')).toBe(true);
  });

  it('a locked hatch over a ramp top removes the ramp edges (D-074)', () => {
    const w = new TestWorld({ seed: 'hatch-ramp', world: 'flat-test' });
    const granite = w.game.registry.table('materials').index('granite');
    const terrain = w.game.world.services.terrain;
    // A ramp at z-1 leaning on the wall to its east, whose top is the surface tile above that wall.
    const ramp = w.index(30, 30, Z - 1);
    const rampTop = w.index(30, 30, Z);
    const up = w.index(31, 30, Z);
    terrain.setKind(ramp, TileKind.Ramp, granite);
    terrain.setKind(rampTop, TileKind.Open, 0);
    const hatch = w.build('hatch', rampTop, 'oak');
    expect(w.pathing.graph.hasEdge(ramp, up, 'walker')).toBe(true);
    expect(w.pathing.graph.hasEdge(up, ramp, 'walker')).toBe(true);
    expect(apply(w, { type: 'SetHatchMode', buildingId: hatch, mode: 'locked' })).toEqual({ ok: true });
    expect(w.pathing.graph.hasEdge(ramp, up, 'walker')).toBe(false);
    expect(w.pathing.graph.hasEdge(up, ramp, 'walker')).toBe(false);
  });
});

describe('T-M2-06 furniture', () => {
  it('the furniture item is linked, not consumed, and returns on deconstruction', () => {
    const w = new TestWorld({ seed: 'bed-link', world: 'flat-test', embark: 'default' });
    const oak = w.game.registry.table('materials').index('oak');
    const bedType = w.game.registry.table('items').index('bed');
    const item = w.spawnItem('bed', 'oak', w.index(44, 14, Z), 1, 3);
    // The wagon (T-M2-08) holds three pine beds; its value reaches the wealth with the first tick.
    w.step(1);
    const beds0 = items(w).count(bedType);
    const free0 = items(w).available(bedType);
    const wealth0 = items(w).wealth();
    const t = w.index(50, 16, Z);
    expect(apply(w, { type: 'PlaceBuilding', buildingType: 'bed', origin: t, materialChoice: 'oak' })).toEqual({ ok: true });
    const id = bld(w).at(t);
    w.until((x) => x.events('BuildingCompleted').some((e) => e['id'] === id), 3000);
    const built = bld(w).get(id);
    expect(built).toMatchObject({ state: 'built', itemId: item, material: oak });
    expect(w.game.world.entities.alive(item)).toBe(true);
    const rec = items(w).get(item);
    expect(((rec?.flags ?? 0) & ItemFlag.Installed) !== 0).toBe(true);
    expect(items(w).tileOf(item)).toBe(-1);
    expect(items(w).count(bedType)).toBe(beds0);
    expect(items(w).available(bedType)).toBe(free0 - 1);
    w.step(10);
    // The bed's own value stays in the wealth; the building adds oak's material value (bonus 0).
    expect(items(w).wealth() - wealth0).toBe(3);
    // A second bed build cannot take the linked bed.
    expect(items(w).findItem({ type: bedType, materialId: oak }, w.index(44, 14, Z))).toBe(0);
    expect(apply(w, { type: 'DeconstructBuilding', buildingId: id })).toEqual({ ok: true });
    w.until((x) => !x.game.world.entities.alive(id), 2000);
    expect(w.game.world.entities.alive(item)).toBe(true);
    expect(items(w).tileOf(item)).toBe(t);
    expect(((items(w).get(item)?.flags ?? 0) & ItemFlag.Installed) === 0).toBe(true);
    expect(items(w).get(item)?.quality).toBe(3);
    expect(items(w).count(bedType)).toBe(beds0);
    expect(items(w).available(bedType)).toBe(free0);
  });

  it('special buildings: depots and coffins are listed, the store tag is readable, a cage has no occupant, no well works without water', () => {
    const w = new TestWorld({ seed: 'specials', world: 'flat-test' });
    const depot = w.build('trade_depot', w.index(50, 16, Z), 'oak');
    const coffin = w.build('coffin', w.index(40, 16, Z), 'granite');
    const chest = w.build('chest', w.index(41, 16, Z), 'oak');
    const cabinet = w.build('cabinet', w.index(42, 16, Z), 'oak');
    const cage = w.build('cage_building', w.index(43, 16, Z), 'oak');
    for (const type of ['chain_post', 'nest_box', 'memorial_slab', 'statue', 'archery_target']) w.build(type, w.index(30 + ['chain_post', 'nest_box', 'memorial_slab', 'statue', 'archery_target'].indexOf(type), 40, Z), 'granite');
    expect(bld(w).depots()).toEqual([depot]);
    expect(bld(w).freeCoffins()).toEqual([coffin]);
    expect(bld(w).byTag('store')).toEqual([chest, cabinet]);
    expect(bld(w).cageOccupant(cage)).toBe(0);
    expect(bld(w).wells()).toEqual([]);
    expect(bld(w).wellWorking(depot)).toBe(false);
    // Statue, chest, cabinet, coffin and cage block movement; a nest box and a chain do not.
    expect(bld(w).blocksMovementAt(w.index(33, 40, Z), 'walker')).toBe(true);
    expect(bld(w).blocksMovementAt(w.index(30, 40, Z), 'walker')).toBe(false);
    expect(bld(w).blocksMovementAt(w.index(31, 40, Z), 'walker')).toBe(false);
    expect(apply(w, { type: 'DeconstructBuilding', buildingId: coffin })).toEqual({ ok: true });
    const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
    system.buildings.remove(coffin);
    expect(bld(w).freeCoffins()).toEqual([]);
  });
});

describe('T-M2-06 the wagon', () => {
  it('holds any number of items, finds them at its centre, and yields its logs and contents when taken apart', () => {
    const w = new TestWorld({ seed: 'wagon', world: 'flat-test', embark: 'default' });
    const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
    const oak = w.game.registry.table('materials').index('oak');
    const centre = w.index(50, 16, Z);
    const logType = w.game.registry.table('items').index('log');
    const logs0 = items(w).count(logType);
    const wagon = system.buildings.placeWagon(centre, { type: 'log', material: oak, count: 3 });
    expect(bld(w).byType('wagon')).toContain(wagon);
    expect(bld(w).at(w.index(49, 15, Z))).toBe(wagon);
    expect(bld(w).get(wagon)?.state).toBe('built');
    const ids: EntityId[] = [];
    for (let k = 0; k < 150; k += 1) ids.push(w.spawnItem('raw_stone', 'granite', { containerId: wagon }));
    expect(items(w).inContainer(wagon)).toHaveLength(150);
    expect(items(w).containerOf(ids[0] as EntityId)).toBe(wagon);
    expect(items(w).tileOf(ids[0] as EntityId)).toBe(centre);
    expect(items(w).findItem({ type: w.game.registry.table('items').index('raw_stone') }, w.index(55, 16, Z))).toBe(ids[0]);
    // Nothing takes them out while no stockpile wants them; the second wagon's contents lie at its centre.
    // A wagon is passable.
    expect(w.pathing.graph.passable(centre, 'walker')).toBe(true);
    expect(apply(w, { type: 'DeconstructBuilding', buildingId: wagon })).toEqual({ ok: true });
    w.until((x) => !x.game.world.entities.alive(wagon), 3000);
    expect(items(w).count(logType) - logs0).toBe(3);
    expect(items(w).tileOf(ids[149] as EntityId)).toBe(centre);
    expect(items(w).containerOf(ids[149] as EntityId)).toBe(0);
  });
});

describe('T-M8-06 door lock', () => {
  it('(a) a lock_on_alert door with no civilian outside locks after ALERT_OUTSIDE_CLEAR_TICKS, updating connectivity', () => {
    const { w, door } = doorWorld('door-lock-clear');
    w.build('hearth', w.index(40, 28, Z), 'granite');
    const outside = w.index(40, 15, Z);
    const inside = w.index(40, 25, Z);
    expect(w.reachable(outside, inside)).toBe(true);
    expect(apply(w, { type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' })).toEqual({ ok: true });
    expect(apply(w, { type: 'SetAlert', level: 'hearth' })).toEqual({ ok: true });
    w.step(2);
    expect(w.reachable(outside, inside)).toBe(true);
    w.until(() => !w.reachable(outside, inside), ALERT_OUTSIDE_CLEAR_TICKS + 20);
    expect(w.reachable(outside, inside)).toBe(false);
    expect(bld(w).mechanismState(door)).toBe('locked');
    const lockedEvents = w.events('BuildingStateChanged').filter((e) => e['id'] === door && e['state'] === 'locked');
    expect(lockedEvents).toHaveLength(1);
    // After more ticks, still unreachable and no duplicate event
    w.step(20);
    expect(w.reachable(outside, inside)).toBe(false);
    expect(w.events('BuildingStateChanged').filter((e) => e['id'] === door && e['state'] === 'locked')).toHaveLength(1);
  });

  it('(b) a lock_on_alert door with a civilian standing outside locks via ALERT_LOCK_GRACE_TICKS', () => {
    const { w, door } = doorWorld('door-lock-grace');
    w.build('hearth', w.index(40, 28, Z), 'granite');
    const outside = w.index(40, 15, Z);
    const inside = w.index(40, 25, Z);
    const dwarf = w.spawnDwarf({ at: outside });
    w.game.world.entities.remove(dwarf, C.Brain);
    expect(apply(w, { type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' })).toEqual({ ok: true });
    expect(apply(w, { type: 'SetAlert', level: 'hearth' })).toEqual({ ok: true });
    // After ALERT_OUTSIDE_CLEAR_TICKS, civilian is outside, so door remains unlocked
    w.step(ALERT_OUTSIDE_CLEAR_TICKS + 15);
    expect(w.reachable(outside, inside)).toBe(true);
    expect(w.events('BuildingStateChanged').filter((e) => e['id'] === door && e['state'] === 'locked')).toHaveLength(0);
    // Locks after ALERT_LOCK_GRACE_TICKS
    w.until(() => !w.reachable(outside, inside), ALERT_LOCK_GRACE_TICKS + 20);
    expect(w.reachable(outside, inside)).toBe(false);
    expect(bld(w).mechanismState(door)).toBe('locked');
    const lockedEvents = w.events('BuildingStateChanged').filter((e) => e['id'] === door && e['state'] === 'locked');
    expect(lockedEvents).toHaveLength(1);
  });

  it('(c) after AlertChanged to calm the door is passable and reachable again', () => {
    const { w, door, t } = doorWorld('door-lock-calm');
    w.build('hearth', w.index(40, 28, Z), 'granite');
    const outside = w.index(40, 15, Z);
    const inside = w.index(40, 25, Z);
    expect(apply(w, { type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' })).toEqual({ ok: true });
    expect(apply(w, { type: 'SetAlert', level: 'hearth' })).toEqual({ ok: true });
    w.until(() => !w.reachable(outside, inside), ALERT_OUTSIDE_CLEAR_TICKS + 20);
    expect(w.reachable(outside, inside)).toBe(false);
    expect(apply(w, { type: 'SetAlert', level: 'calm' })).toEqual({ ok: true });
    w.step(1);
    expect(w.reachable(outside, inside)).toBe(true);
    expect(bld(w).blocksMovementAt(t, 'walker', 'fortress')).toBe(false);
    const openEvents = w.events('BuildingStateChanged').filter((e) => e['id'] === door && e['state'] === 'open');
    expect(openEvents.length).toBeGreaterThanOrEqual(1);
  });
});

