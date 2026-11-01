import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { CLEAR_PLANT_TICKS } from '@systems/plants/constants';
import type { PlantsSystem } from '@systems/plants';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;
const bld = (w: TestWorld): BuildingsReader => w.readers.of<BuildingsReader>('14');
const materialOf = (w: TestWorld, id: string): number => w.game.registry.table('materials').index(id);
const world = (seed: string): TestWorld => new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });

function plant(w: TestWorld, tile: TileIndex, kind: TileKind, species: string): void {
  w.game.world.services.terrain.setKind(tile, kind, materialOf(w, species));
}

function place(w: TestWorld, type: string, origin: TileIndex): { result: { ok: boolean; reason?: string }; id: number } {
  const result = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: type, origin, orientation: 0, materialChoice: 'granite' }) as { ok: boolean; reason?: string };
  return { result, id: (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding };
}

function looseAt(w: TestWorld, near: readonly TileIndex[]): string[] {
  const items = w.game.registry.table<{ id: string }>('items');
  const out: string[] = [];
  for (const t of near) for (const id of w.readers.entities.at(t)) {
    const item = w.game.world.entities.get(id, C.Item);
    if (item !== undefined) out.push(items.byIndex(item.type)?.id ?? '');
  }
  return out;
}

describe('T-458 a sapling or shrub on a building site', () => {
  it('a door on a sapling is built, and the sapling goes first and leaves nothing', () => {
    const w = world('t458-door');
    const door = w.index(40, 40, Z);
    for (const x of [39, 41]) w.game.world.services.terrain.setKind(w.index(x, 40, Z), TileKind.Wall, materialOf(w, 'granite'));
    plant(w, door, TileKind.Sapling, 'oak');
    expect(bld(w).ghost('door', door, 0)).toMatchObject({ reason: null, clears: [door] });
    w.spawnItem('door', 'granite', w.index(40, 39, Z));
    w.spawnDwarf({ at: w.index(40, 38, Z), skills: { building: 10 } });
    const { result, id } = place(w, 'door', door);
    expect(result.ok).toBe(true);
    expect(w.map.kindAt(door)).toBe(TileKind.Sapling);
    w.until(() => w.map.kindAt(door) === TileKind.Floor, 1500);
    expect(bld(w).get(id)?.state).not.toBe('built');
    w.until(() => bld(w).get(id)?.state === 'built', 1500);
    expect(w.map.kindAt(door)).toBe(TileKind.Floor);
    expect(looseAt(w, [door])).toEqual([]);
    expect(w.events('TreeFelled')).toHaveLength(0);
  });

  it('a wall on a ripe shrub is built, with the shrub gone and its yield dropped beside the wall', () => {
    const w = world('t458-wall');
    const tile = w.index(40, 40, Z);
    plant(w, tile, TileKind.Shrub, 'bramble');
    w.spawnItem('stone_block', 'granite', w.index(42, 40, Z));
    w.spawnDwarf({ at: w.index(41, 40, Z), skills: { masonry: 10 } });
    const { result, id } = place(w, 'wall', tile);
    expect(result.ok).toBe(true);
    w.until(() => bld(w).get(id)?.state === 'built', 2000);
    expect(w.map.kindAt(tile)).toBe(TileKind.Wall);
    const row = w.game.registry.table<{ id: string; yieldItem?: string }>('plants').byId('bramble');
    expect(looseAt(w, w.map.neighbors8(tile))).toContain(row?.yieldItem);
  });

  it('a regrowing shrub leaves nothing', () => {
    const w = world('t458-regrowing');
    const tile = w.index(40, 40, Z);
    plant(w, tile, TileKind.Shrub, 'bramble');
    (w.game.world.scheduler.byId('07') as PlantsSystem).shrubTimers.set(tile, w.tick + 100_000);
    const { id } = place(w, 'wall', tile);
    (w.game.world.scheduler.byId('14') as BuildingsSystem).buildings.complete(id, [], materialOf(w, 'granite'));
    w.step(1);
    expect(w.map.kindAt(tile)).toBe(TileKind.Wall);
    expect(looseAt(w, [tile, ...w.map.neighbors8(tile)])).toEqual([]);
  });

  it('the plant adds CLEAR_PLANT_TICKS to the job, once per tile', () => {
    const w = world('t458-ticks');
    const tile = w.index(40, 40, Z);
    plant(w, tile, TileKind.Sapling, 'oak');
    const { id } = place(w, 'wall', tile);
    w.step(2);
    const jobs = w.readers.of<{ byKey(k: string): { data: Record<string, unknown> } | undefined }>('11');
    expect(jobs.byKey(`build:${id}`)?.data['clearTicks']).toBe(CLEAR_PLANT_TICKS);
  });

  it('cancelling before the work leaves the plant, and a planned site does not grow into a tree', () => {
    const w = world('t458-cancel');
    const tile = w.index(40, 40, Z);
    plant(w, tile, TileKind.Sapling, 'oak');
    const plants = w.game.world.scheduler.byId('07') as PlantsSystem;
    plants.saplings.set(tile, -10_000_000);
    const { id } = place(w, 'wall', tile);
    w.until(() => w.events('DayPassed').length > 0, 5000);
    expect(w.map.kindAt(tile)).toBe(TileKind.Sapling);
    expect(w.game.world.applyCommand({ type: 'CancelBuilding', buildingId: id }).ok).toBe(true);
    expect(w.map.kindAt(tile)).toBe(TileKind.Sapling);
  });

  it('a grown tree still refuses, and the ghost says to chop it', () => {
    const w = world('t458-tree');
    const tile = w.index(40, 40, Z);
    plant(w, tile, TileKind.Tree, 'oak');
    expect(place(w, 'wall', tile).result).toEqual({ ok: false, reason: 'bad_placement' });
    expect(bld(w).ghost('wall', tile, 0)).toMatchObject({ reason: 'bad_placement', rule: 'chop_first', bad: [tile] });
  });

  it('the chop tool takes a sapling: it leaves a floor and no logs, and no tree is counted felled', () => {
    const w = world('t458-chop');
    const tile = w.index(40, 40, Z);
    plant(w, tile, TileKind.Sapling, 'oak');
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'chop', tiles: [tile] }).ok).toBe(true);
    w.spawnItem('axe', 'iron', w.index(41, 40, Z));
    w.spawnDwarf({ at: w.index(41, 40, Z), skills: { woodcutting: 10 } });
    w.until(() => w.map.kindAt(tile) === TileKind.Floor, 2000);
    expect(looseAt(w, [tile])).toEqual([]);
    expect(w.events('TreeFelled')).toHaveLength(0);
  });

  it('the gather tool takes a shrub', () => {
    const w = world('t458-gather');
    const tile = w.index(40, 40, Z);
    plant(w, tile, TileKind.Shrub, 'bramble');
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'gather', tiles: [tile] }).ok).toBe(true);
  });
});
