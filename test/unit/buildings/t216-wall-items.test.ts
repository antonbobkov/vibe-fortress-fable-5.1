import { describe, expect, it } from 'vitest';
import { C, ItemFlag } from '@core/components';
import { TileKind } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;
function placeWall(w: TestWorld, tile: number): number {
  expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'wall', origin: tile,
    orientation: 0, materialChoice: 'granite' }).ok).toBe(true);
  return (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding;
}
function position(w: TestWorld, id: number): number {
  const p = w.game.world.entities.get(id, C.Position);
  expect(p).toBeDefined();
  return w.index(p!.x, p!.y, p!.z);
}

describe('T-216 walls clear loose items before sealing their ground', () => {
  it('a stepped wall moves a chopped-tree log without consuming it', () => {
    const w = new TestWorld({ seed: 't216-wall-log', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const tile = w.index(40, 40, Z);
    const log = w.spawnItem('log', 'oak', tile);
    const block = w.spawnItem('stone_block', 'granite', w.index(42, 40, Z));
    w.spawnDwarf({ at: w.index(41, 40, Z), skills: { masonry: 10 } });
    const id = placeWall(w, tile);
    w.until(() => w.readers.of<BuildingsReader>('14').get(id)?.state === 'built', 2000);
    const destination = Math.min(...w.map.neighbors8(tile));
    expect(w.map.kindAt(tile)).toBe(TileKind.Wall);
    expect(position(w, log)).toBe(destination);
    expect(w.game.world.entities.get(log, C.Item)).toMatchObject({ count: 1, material: w.game.registry.table('materials').index('oak') });
    expect(w.readers.of<ItemsReader>('13').at(destination)).toContain(log);
    expect(w.readers.entities.at(destination)).toContain(log);
    expect(w.game.world.entities.alive(block)).toBe(false);
    expect(w.events('BuildingCompleted').filter(ev => ev['id'] === id)).toHaveLength(1);
  });

  it('moves a reserved forbidden container with its contents and leftover construction units intact', () => {
    const w = new TestWorld({ seed: 't216-leftovers', world: 'flat-test', embark: 'none' });
    const tile = w.index(40, 40, Z);
    const barrel = w.spawnItem('barrel', 'oak', tile);
    const food = w.spawnItem('plant_food', 'barley', tile, 3);
    expect(w.game.world.services.items?.putIn(food, barrel)).toBe(true);
    w.game.world.services.items?.reserve(barrel, 123);
    w.game.world.services.items?.setFlag(barrel, ItemFlag.Forbidden, true);
    const material = w.spawnItem('stone_block', 'granite', tile, 3);
    const id = placeWall(w, tile);
    const store = (w.game.world.scheduler.byId('14') as BuildingsSystem).buildings;
    store.complete(id, [material], 0, 0, new Map([[material, 1]]));
    const destination = Math.min(...w.map.neighbors8(tile));
    expect(position(w, barrel)).toBe(destination);
    expect(position(w, material)).toBe(destination);
    expect(w.game.world.entities.get(material, C.Item)?.count).toBe(2);
    expect(w.game.world.entities.get(barrel, C.Item)).toMatchObject({ reservedBy: 123, flags: ItemFlag.Reserved | ItemFlag.Forbidden });
    expect(w.game.world.entities.get(food, C.Item)?.containerId).toBe(barrel);
    expect(w.game.world.entities.get(food, C.Position)).toBeUndefined();
    expect(w.game.world.entities.get(barrel, C.Container)?.contents).toEqual([food]);
    expect(w.readers.of<ItemsReader>('13').count('plant_food')).toBe(3);
  });

  it('waits without consuming materials if no adjacent ground can take the clutter, then retries', () => {
    const w = new TestWorld({ seed: 't216-blocked-clearance', world: 'flat-test', embark: 'none' });
    const tile = w.index(40, 40, Z);
    const log = w.spawnItem('log', 'oak', tile);
    const material = w.spawnItem('stone_block', 'granite', tile);
    const id = placeWall(w, tile);
    const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
    for (const at of w.map.neighbors8(tile)) w.carve(at, TileKind.Wall);
    const job = { key: `build:${id}`, data: { building: id }, inputs: [{ count: 1, delivered: [material] }] };
    expect(system.buildings.producer().canComplete?.(job)).toBe(false);
    system.buildings.complete(id, [material], 0);
    expect(w.game.world.entities.alive(material)).toBe(true);
    expect(w.map.kindAt(tile)).toBe(TileKind.Floor);
    expect(system.buildings.get(id)?.state).toBe('planned');
    const free = w.index(41, 40, Z);
    w.carve(free, TileKind.Floor);
    expect(system.buildings.producer().canComplete?.(job)).toBe(true);
    system.buildings.complete(id, [material], 0);
    expect(position(w, log)).toBe(free);
    expect(w.game.world.entities.alive(material)).toBe(false);
    expect(w.map.kindAt(tile)).toBe(TileKind.Wall);
  });

  it('fully consumed inputs need no clearance, but a creature still blocks completion', () => {
    const w = new TestWorld({ seed: 't216-no-leftovers', world: 'flat-test', embark: 'none' });
    const tile = w.index(40, 40, Z);
    const material = w.spawnItem('stone_block', 'granite', tile);
    const id = placeWall(w, tile);
    const system = w.game.world.scheduler.byId('14') as BuildingsSystem;
    for (const at of w.map.neighbors8(tile)) w.carve(at, TileKind.Wall);
    const job = { key: `build:${id}`, data: { building: id }, inputs: [{ count: 1, delivered: [material] }] };
    expect(system.buildings.producer().canComplete?.(job)).toBe(true);
    w.spawnDwarf({ at: tile });
    expect(system.buildings.producer().canComplete?.(job)).toBe(false);
  });

  it('clearance excludes open air even when a walker could enter it', () => {
    const w = new TestWorld({ seed: 't216-ground-clearance', world: 'flat-test', embark: 'none' });
    const tile = w.index(40, 40, Z);
    const log = w.spawnItem('log', 'oak', tile);
    const material = w.spawnItem('stone_block', 'granite', tile);
    const id = placeWall(w, tile);
    for (const at of w.map.neighbors8(tile)) w.carve(at, TileKind.Open);
    const free = w.index(41, 40, Z);
    w.carve(free, TileKind.Floor);
    (w.game.world.scheduler.byId('14') as BuildingsSystem).buildings.complete(id, [material], 0);
    expect(position(w, log)).toBe(free);
    expect(w.map.kindAt(tile)).toBe(TileKind.Wall);
  });

});
