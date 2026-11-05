import { describe, it, expect } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { FLAT_TEST_SPEC, HeadlessGame } from '@app/headless';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import {
  ARRIVAL_SEARCH_DEPTH,
  SUPPLY_CONTAINER_MATERIAL,
  WAGON_LOGS,
  arrive,
  spawnSupplies,
  supplyAnimals,
  type EmbarkEntryRow,
} from '@systems/embark';
import type { ItemsReader } from '@systems/items';
import { BATTLEFIELD_BAND_MAX, BATTLEFIELD_BAND_MIN, BATTLEFIELD_BONE_PILES, BATTLEFIELD_ITEM_COUNT, BATTLEFIELD_SKULLS } from '@systems/terrain/constants';

interface CatalogRow extends EmbarkEntryRow {
  readonly material?: string;
  readonly count?: number;
  readonly container?: string;
}

function readers(game: HeadlessGame): { items: ItemsReader; b: BuildingsReader } {
  return { items: game.world.readers.of<ItemsReader>('13'), b: game.world.readers.of<BuildingsReader>('14') };
}

/** `[type id, material id, units]` of a set of items, sorted. */
function describeItems(game: HeadlessGame, ids: readonly EntityId[]): [string, string, number][] {
  const items = readers(game).items;
  const materials = game.registry.table('materials');
  const map = new Map<string, number>();
  for (const id of ids) {
    const it = items.get(id);
    if (it === undefined) continue;
    const key = `${items.def(it.type)?.id ?? '?'}|${materials.idOf(it.material)}`;
    map.set(key, (map.get(key) ?? 0) + it.count);
  }
  return Array.from(map.keys())
    .sort()
    .map((k) => {
      const [type, mat] = k.split('|') as [string, string];
      return [type, mat, map.get(k) as number];
    });
}

describe('T-M2-08 arrival: the wagon and its supplies', () => {
  it('the wagon stands within ARRIVAL_SEARCH_DEPTH of the arrival edge and holds the Balanced supplies; two picks', () => {
    const game = new HeadlessGame({ seed: 'arrival-wagon', world: 'flat-test', embark: 'default' });
    const { items, b } = readers(game);
    const arrival = game.arrival;
    if (arrival === null) throw new Error('no arrival');
    const wagon = arrival.wagonId;
    expect(b.wagon()).toBe(wagon);
    expect(b.get(wagon)).toMatchObject({ state: 'built', typeId: 'wagon' });
    expect(b.get(wagon)?.footprint).toHaveLength(9);
    expect(arrival.wagon.y).toBeLessThanOrEqual(ARRIVAL_SEARCH_DEPTH);
    const centre = game.map.index(arrival.wagon.x, arrival.wagon.y, arrival.wagon.z);
    expect(b.holderTile(wagon)).toBe(centre);
    expect(items.count('pick')).toBe(2);
    // Everything bought is in the wagon (directly or in a barrel or bag in it).
    const catalog = game.registry.table<CatalogRow>('embarkCatalog');
    const inside: EntityId[] = [];
    for (const id of items.inContainer(wagon)) {
      inside.push(id);
      inside.push(...items.inContainer(id));
    }
    const want = new Map<string, number>();
    const add = (type: string, mat: string, n: number): void => {
      const k = `${type}|${mat}`;
      want.set(k, (want.get(k) ?? 0) + n);
    };
    for (const line of arrival.supplies) {
      const row = catalog.byId(line.entry) as CatalogRow;
      if (row.item === undefined || row.material === undefined) continue;
      add(row.item, row.material, (row.count ?? 1) * line.count);
      if (row.container !== undefined) add(row.container, SUPPLY_CONTAINER_MATERIAL[row.container] as string, line.count);
    }
    const expected = Array.from(want.keys())
      .sort()
      .map((k) => [...(k.split('|') as [string, string]), want.get(k) as number]);
    expect(describeItems(game, inside)).toEqual(expected);
    for (const id of inside) expect(items.tileOf(id)).toBe(centre);
  });

  it('every catalog entry spawns the right item, material, count and container', () => {
    const game = new HeadlessGame({ seed: 'catalog', world: 'flat-test' });
    const { items } = readers(game);
    const system = game.world.scheduler.byId('14') as BuildingsSystem;
    const materials = game.registry.table('materials');
    const centre = game.map.index(48, 10, 32);
    const wagon = system.buildings.placeWagon(centre, { type: 'log', material: materials.index('pine'), count: WAGON_LOGS });
    const catalog = game.registry.table<CatalogRow>('embarkCatalog');
    let checked = 0;
    for (const entry of catalog.ids()) {
      const row = catalog.byId(entry) as CatalogRow;
      if (row.item === undefined) continue;
      const before = new Set(items.inContainer(wagon));
      spawnSupplies(game.world, [{ entry, count: 1 }], wagon, centre);
      const fresh = items.inContainer(wagon).filter((id) => !before.has(id));
      if (row.container !== undefined) {
        expect([entry, fresh.length]).toEqual([entry, 1]);
        const holder = fresh[0] as EntityId;
        expect([entry, describeItems(game, [holder])]).toEqual([entry, [[row.container, SUPPLY_CONTAINER_MATERIAL[row.container], 1]]]);
        expect([entry, describeItems(game, items.inContainer(holder))]).toEqual([entry, [[row.item, row.material, row.count ?? 1]]]);
      } else {
        expect([entry, describeItems(game, fresh)]).toEqual([entry, [[row.item, row.material, row.count ?? 1]]]);
      }
      checked += 1;
    }
    expect(checked).toBeGreaterThan(60);
  });

  it('animals: Tame, no pasture, beside the wagon; pairs alternate female and male, "3 chickens and a rooster"', () => {
    const game = new HeadlessGame({ seed: 'arrival-animals', world: 'flat-test', embark: 'default' });
    const arrival = game.arrival;
    if (arrival === null) throw new Error('no arrival');
    const e = game.world.entities;
    const species = game.registry.table('creatures');
    expect(arrival.animals.map((id) => [species.idOf(e.get(id, C.Creature)?.species ?? 0), e.get(id, C.Creature)?.sex])).toEqual([
      ['dog', 1],
      ['dog', 0],
      ['cat', 1],
    ]);
    for (const id of arrival.animals) {
      expect(e.get(id, C.Tame)).toMatchObject({ pastureId: 0, trained: 'none', condition: 0 });
      expect(e.get(id, C.Creature)?.faction).toBe('fortress');
      const p = e.get(id, C.Position);
      expect(Math.max(Math.abs((p?.x ?? 0) - arrival.wagon.x), Math.abs((p?.y ?? 0) - arrival.wagon.y))).toBeLessThanOrEqual(3);
    }
    expect(supplyAnimals(game.registry, [{ entry: 'e_chickens', count: 1 }, { entry: 'e_war_dog', count: 1 }, { entry: 'e_bull', count: 1 }])).toEqual([
      { species: 'chicken', sex: 1, trained: 'none' },
      { species: 'chicken', sex: 1, trained: 'none' },
      { species: 'chicken', sex: 1, trained: 'none' },
      { species: 'chicken', sex: 0, trained: 'none' },
      { species: 'dog', sex: 1, trained: 'war' },
      { species: 'cow', sex: 0, trained: 'none' },
    ]);
  });

  it('trees cleared for the wagon become logs on the ground', () => {
    const game = new HeadlessGame({ seed: 'arrival-trees', world: 'flat-test' });
    const map = game.map;
    const plants = game.registry.table<{ id: string; logs?: number[] }>('plants');
    const ash = game.registry.table('materials').index('ash');
    for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) if ((x + y) % 5 === 0) map.setKind(map.index(x, y, 32), TileKind.Tree, ash);
    const system = game.world.scheduler.byId('14') as BuildingsSystem;
    const arrival = arrive(game.world, FLAT_TEST_SPEC, [], { fortressName: 'Woods', placeWagon: (c, l) => system.buildings.placeWagon(c, l) });
    const g = game;
    expect(arrival.logDrops.length).toBeGreaterThan(0);
    const items = readers(g).items;
    const [lo, hi] = plants.byId('ash')?.logs as [number, number];
    for (const t of arrival.logDrops) {
      expect(g.map.kindAt(t)).toBe(TileKind.Floor);
      const logs = items.at(t).filter((id) => items.def(items.get(id)?.type ?? 0)?.id === 'log');
      const units = logs.reduce((s, id) => s + (items.get(id)?.count ?? 0), 0);
      expect(units).toBeGreaterThanOrEqual(lo);
      expect(units).toBeLessThanOrEqual(hi);
      expect(logs.every((id) => g.registry.table('materials').idOf(items.get(id)?.material ?? 0) === 'ash')).toBe(true);
    }
  });
});

describe('T-M2-08 arrival: trait spawn lists', () => {
  it('old_battlefield scatters its 30 rusted arms, bones and skulls in the band', () => {
    const spec = { ...FLAT_TEST_SPEC, seed: 'battlefield', traits: ['old_battlefield'] };
    const game = new HeadlessGame({ seed: 'battlefield', world: 'local', spec, embark: 'default' });
    const { items } = readers(game);
    const spawns = game.local?.spawns.filter((s) => s.source === 'old_battlefield') ?? [];
    // This map also holds the old channel of 03 stage 10 (one wand, not iron): one entry more.
    expect(spawns).toHaveLength(BATTLEFIELD_ITEM_COUNT + BATTLEFIELD_BONE_PILES + BATTLEFIELD_SKULLS + 1);
    const all = game.world.entities.with(C.Item);
    const rusted = all.filter((id) => items.get(id)?.quality === 0 && game.registry.table('materials').idOf(items.get(id)?.material ?? 0) === 'iron');
    expect(rusted).toHaveLength(BATTLEFIELD_ITEM_COUNT);
    for (const id of rusted) {
      const y = game.map.yOf(items.tileOf(id)); // arrival edge n
      expect(y).toBeGreaterThanOrEqual(BATTLEFIELD_BAND_MIN);
      expect(y).toBeLessThanOrEqual(BATTLEFIELD_BAND_MAX);
    }
    expect(items.count('skull')).toBe(BATTLEFIELD_SKULLS);
    expect(items.count('bone_pile')).toBe(BATTLEFIELD_BONE_PILES);
    for (const s of spawns) expect(items.at(s.tile).some((id) => items.def(items.get(id)?.type ?? 0)?.id === s.type)).toBe(true);
  });
});
