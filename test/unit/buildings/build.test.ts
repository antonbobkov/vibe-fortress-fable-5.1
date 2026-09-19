import { describe, it, expect } from 'vitest';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function bld(w: TestWorld): BuildingsReader {
  return w.readers.of<BuildingsReader>('14');
}

function items(w: TestWorld): ItemsReader {
  return w.readers.of<ItemsReader>('13');
}

function place(w: TestWorld, type: string, origin: TileIndex, extra: Record<string, unknown> = {}): { ok: boolean; reason?: string } {
  return w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: type, origin, ...extra } as never) as { ok: boolean; reason?: string };
}

describe('T-M2-05 placement', () => {
  it('every construction row\'s `on` rule', () => {
    const w = new TestWorld({ seed: 'on-rules', world: 'flat-test' });
    const granite = w.game.registry.table('materials').index('granite');
    const terrain = w.game.world.services.terrain;
    const floor = w.index(20, 20, Z);
    const high = w.index(20, 20, Z + 5); // open, no neighbour
    const beside = w.index(21, 20, Z + 1); // open, above a floor: supported from below
    // A pit: (30, 20, 32) opened to show `floor over open` on the tile above an open tile.
    terrain.setKind(w.index(30, 20, Z - 1), TileKind.Open, 0);
    const overOpen = w.index(30, 20, Z);
    for (const t of [high, beside, w.index(21, 20, Z + 1)]) w.discover(t);
    const cases: [string, TileIndex, boolean][] = [
      ['wall', floor, true],
      ['wall', beside, true],
      ['wall', high, false],
      ['floor', beside, true],
      ['floor', high, false],
      ['floor', floor, true],
      ['paved_floor', floor, true],
      ['paved_floor', beside, false],
      ['ramp', floor, false],
      ['stairs_up', floor, true],
      ['stairs_up', beside, false],
      ['stairs_down', floor, false],
      ['stairs_down', overOpen, true],
      ['stairs_updown', overOpen, true],
      ['stairs_updown', floor, false],
      ['fortification', floor, true],
      ['fortification', beside, false],
    ];
    for (const [type, at, ok] of cases) {
      const r = place(w, type, at);
      expect([type, at, r.ok]).toEqual([type, at, ok]);
      if (!ok) expect(r.reason).toBe('bad_placement');
      if (r.ok) w.game.world.applyCommand({ type: 'CancelBuilding', buildingId: bld(w).at(at) } as never);
    }
    // A ramp needs a wall beside it.
    terrain.setKind(w.index(41, 20, Z), TileKind.Wall, granite);
    expect(place(w, 'ramp', w.index(40, 20, Z)).ok).toBe(true);
  });

  it('rejections: undiscovered, occupied, a second hearth, bad fields; furniture is placed since T-M2-06 (D-073, D-074)', () => {
    const w = new TestWorld({ seed: 'rejects', world: 'flat-test' });
    const t = w.index(20, 20, Z);
    w.discover(t, false);
    expect(place(w, 'wall', t)).toEqual({ ok: false, reason: 'not_discovered' });
    w.discover(t, true);
    expect(place(w, 'wall', t).ok).toBe(true);
    expect(place(w, 'floor', t)).toEqual({ ok: false, reason: 'footprint_blocked' });
    expect(place(w, 'bed', w.index(22, 20, Z)).ok).toBe(true);
    expect(place(w, 'nothing', w.index(23, 20, Z))).toEqual({ ok: false, reason: 'not_found' });
    expect(place(w, 'wall', w.index(22, 20, Z), { priority: 12 })).toEqual({ ok: false, reason: 'out_of_range' });
    expect(place(w, 'wall', w.index(22, 20, Z), { materialChoice: 'unobtainium' })).toEqual({ ok: false, reason: 'not_found' });
    expect(place(w, 'hearth', w.index(24, 20, Z)).ok).toBe(true);
    expect(place(w, 'hearth', w.index(26, 20, Z))).toEqual({ ok: false, reason: 'hearth_exists' });
    expect(place(w, 'trade_depot', w.index(94, 20, Z))).toEqual({ ok: false, reason: 'out_of_bounds' });
    expect(place(w, 'wagon', w.index(60, 20, Z))).toEqual({ ok: false, reason: 'bad_placement' });
    w.step(1);
    expect(w.events('BuildingPlaced').map((e) => e['buildingType'])).toEqual(['wall', 'bed', 'hearth']);
  });

  it('a planned building is passable; a built impassable one blocks every class', () => {
    const w = new TestWorld({ seed: 'passable', world: 'flat-test' });
    const t = w.index(20, 20, Z);
    expect(place(w, 'hearth', t).ok).toBe(true);
    const id = bld(w).at(t);
    w.step(1);
    expect(bld(w).get(id)?.state).toBe('planned');
    expect(w.pathing.graph.passable(t, 'walker')).toBe(true);
    (w.game.world.scheduler.byId('14') as unknown as { completeNow(id: EntityId, m: number): void }).completeNow(id, 0);
    w.step(1);
    expect(bld(w).get(id)?.state).toBe('built');
    expect(w.pathing.graph.passable(t, 'walker')).toBe(false);
    expect(bld(w).blocksMovementAt(t, 'small')).toBe(true);
    expect(w.reachable(w.index(19, 20, Z), t)).toBe(false);
    expect(w.events('HearthLit')).toHaveLength(1);
  });
});

describe('T-M2-05 the build job', () => {
  it('a wall is built from a log: the log is consumed, the tile is a constructed wall, BuildingCompleted', () => {
    const w = new TestWorld({ seed: 'build-wall', world: 'flat-test', embark: 'default' });
    const log = w.spawnItem('log', 'oak', w.index(44, 14, Z));
    const t = w.index(50, 16, Z);
    // The wagon's value (T-M2-08) reaches the wealth with the first tick's events.
    w.step(1);
    const wealth0 = items(w).wealth();
    // Oak: the wagon's pine logs (T-M2-08) are not this wall's.
    expect(place(w, 'wall', t, { materialChoice: 'oak' }).ok).toBe(true);
    const id = bld(w).at(t);
    // (The embark wagon's own BuildingCompleted comes first since T-M2-08.)
    w.until((x) => x.events('BuildingCompleted').some((e) => e['id'] === id), 2000);
    expect(w.map.kindAt(t)).toBe(TileKind.Wall);
    expect(w.map.hasFlag(t, TileFlag.Constructed)).toBe(true);
    expect(w.map.materialAt(t)).toBe(w.game.registry.table('materials').index('oak'));
    expect(w.game.world.entities.alive(log)).toBe(false);
    expect(bld(w).get(id)).toMatchObject({ state: 'built', typeId: 'wall' });
    const oak = 3;
    expect(w.events('BuildingCompleted').find((e) => e['id'] === id)).toMatchObject({ id, buildingType: 'wall', value: oak + 2 });
    w.step(10);
    // The log's 3 marks went with it; the wall adds oak (3) + the wall bonus (2).
    expect(items(w).wealth() - wealth0).toBe(-oak + oak + 2);
  });

  it('a wall build waits while a creature stands on the tile', () => {
    const w = new TestWorld({ seed: 'build-wait', world: 'flat-test', embark: 'default' });
    w.spawnItem('stone_block', 'granite', w.index(44, 14, Z));
    const t = w.index(50, 16, Z);
    const cow = w.spawnCreature('cow', t, 'fortress');
    expect(place(w, 'wall', t).ok).toBe(true);
    w.until((x) => x.events('JobStarted').some((e) => e['jobType'] === 'build'), 2000);
    w.step(400);
    expect(w.map.kindAt(t)).toBe(TileKind.Floor);
    expect(w.events('BuildingCompleted').filter((e) => e['buildingType'] === 'wall')).toHaveLength(0);
    w.movement.teleport(cow, w.index(60, 30, Z));
    w.until((x) => x.map.kindAt(t) === TileKind.Wall, 300);
  });

  it('deconstructing a construction designates `remove`, which returns the item it was built from (D-050)', () => {
    const w = new TestWorld({ seed: 'decon', world: 'flat-test', embark: 'default' });
    // Built from raw granite: by material class 03 would return a block; 14's record says raw stone.
    w.spawnItem('raw_stone', 'granite', w.index(44, 14, Z));
    const t = w.index(52, 16, Z);
    expect(place(w, 'wall', t).ok).toBe(true);
    const id = bld(w).at(t);
    w.until((x) => x.map.kindAt(t) === TileKind.Wall, 2000);
    expect(bld(w).get(id)?.settings['inputs']).toEqual([{ type: 'raw_stone', material: w.game.registry.table('materials').index('granite') }]);
    expect(w.game.world.applyCommand({ type: 'DeconstructBuilding', buildingId: id } as never)).toEqual({ ok: true });
    expect(w.map.designationAt(t)).not.toBe(0);
    // 03's `remove`: a constructed wall becomes open (its natural floor went when the wall was set).
    w.until((x) => x.map.kindAt(t) === TileKind.Open, 2000);
    w.step(12);
    expect(items(w).at(t).map((i) => items(w).def(items(w).get(i)?.type ?? 0)?.id)).toEqual(['raw_stone']);
    expect(w.game.world.entities.alive(id)).toBe(false);
    expect(w.events('BuildingRemoved')).toEqual([expect.objectContaining({ id, buildingType: 'wall' })]);
  });

  it('deconstructing another building returns its inputs; the hearth stays while dwarves live', () => {
    const w = new TestWorld({ seed: 'decon-depot', world: 'flat-test', embark: 'default' });
    const origin = w.index(50, 16, Z);
    const depot = w.build('trade_depot', origin, 'oak');
    const hearth = w.build('hearth', w.index(60, 16, Z), 'granite');
    expect(w.game.world.applyCommand({ type: 'DeconstructBuilding', buildingId: hearth } as never)).toEqual({ ok: false, reason: 'hearth_is_home' });
    expect(w.game.world.applyCommand({ type: 'CancelBuilding', buildingId: depot } as never)).toEqual({ ok: false, reason: 'not_cancellable' });
    expect(w.game.world.applyCommand({ type: 'DeconstructBuilding', buildingId: depot } as never)).toEqual({ ok: true });
    w.until((x) => !x.game.world.entities.alive(depot), 2000);
    const centre = w.index(51, 17, Z);
    expect(items(w).at(centre).map((i) => items(w).def(items(w).get(i)?.type ?? 0)?.id)).toEqual(['log', 'log', 'log']);
    expect(bld(w).at(origin)).toBe(0);
  });

  it('CancelBuilding removes a planned building and its job; SetBuildingPriority reaches the job', () => {
    const w = new TestWorld({ seed: 'cancel', world: 'flat-test', embark: 'default' });
    const t = w.index(50, 16, Z);
    // Granite: nothing of it is in the wagon (T-M2-08), so the build stays planned.
    expect(place(w, 'wall', t, { materialChoice: 'granite' }).ok).toBe(true);
    const id = bld(w).at(t);
    w.step(2);
    const job = w.readers.of<{ byKey(k: string): { id: number; priority: number } | undefined }>('11').byKey(`build:${id}`);
    expect(job).toBeDefined();
    expect(w.game.world.applyCommand({ type: 'SetBuildingPriority', buildingId: id, priority: 2 } as never)).toEqual({ ok: true });
    expect(w.readers.of<{ byKey(k: string): { priority: number } | undefined }>('11').byKey(`build:${id}`)?.priority).toBe(2);
    expect(w.game.world.applyCommand({ type: 'CancelBuilding', buildingId: id } as never)).toEqual({ ok: true });
    expect(bld(w).at(t)).toBe(0);
    expect(w.readers.of<{ byKey(k: string): unknown }>('11').byKey(`build:${id}`)).toBeUndefined();
  });
});
