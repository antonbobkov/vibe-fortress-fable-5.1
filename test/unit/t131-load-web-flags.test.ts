import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TileFlag, TileKind, type Map3D } from '@core/map3d';
import { buildFlatTestMap, HeadlessGame } from '@app/headless';
import { loadGame, roundTrip, saveGame } from '@app/game-save';
import type { ThreatsSystem } from '@systems/threats';

function floors(map: Map3D, x: number, y: number): void {
  for (let row = y; row < y + 5; row++) {
    for (let col = x; col < x + 5; col++) {
      const tile = map.index(col, row, 21);
      map.setKind(tile, TileKind.Floor, map.materialAt(tile));
    }
  }
}

function webTiles(map: Map3D): number[] {
  return Array.from(map.flags.keys()).filter((tile) => (map.flagsAt(tile) & TileFlag.Web) !== 0);
}

function threats(game: HeadlessGame): ThreatsSystem {
  return game.world.scheduler.inOrder().find((system) => system.id === '18') as ThreatsSystem;
}

function continuesIdentically(original: HeadlessGame, loaded: HeadlessGame): void {
  expect(loaded.hash()).toBe(original.hash());
  expect(webTiles(loaded.map)).toEqual(webTiles(original.map));
  expect(loaded.world.entities.with(C.Hostile)).toEqual(original.world.entities.with(C.Hostile));
  expect(threats(loaded).serialize().webs).toEqual(threats(original).serialize().webs);
  for (const count of [1, 19, 180]) {
    original.step(count);
    loaded.step(count);
    expect(loaded.hash(), `after ${count} more ticks`).toBe(original.hash());
    expect(webTiles(loaded.map)).toEqual(webTiles(original.map));
  }
}

describe('T-131 loading preserves cavern populations and web flags', () => {
  it('bootstraps readers without cavern or embark populations, while ordinary initialization still spawns', () => {
    const registry = contentRegistry();
    const map = buildFlatTestMap(registry, 16, 16);
    floors(map, 4, 4);
    const flags = map.flags.slice();
    const bootstrap = new HeadlessGame({ seed: 't131-bootstrap', registry, map, loading: true, embark: 'default' });
    expect(bootstrap.arrival).toBeNull();
    expect(bootstrap.world.entities.with(C.Creature)).toEqual([]);
    expect(map.flags).toEqual(flags);
    expect(bootstrap.world.readers.has('18')).toBe(true);
    expect(threats(bootstrap).reader().monstersInCavern(1)).toBe(0);
    expect(threats(bootstrap).serialize().webs).toEqual([]);
    const ordinary = new HeadlessGame({ seed: 't131-bootstrap', registry, map, embark: 'none' });
    expect(ordinary.world.entities.with(C.Hostile).length).toBeGreaterThan(0);
    expect(webTiles(map).length).toBeGreaterThan(0);
  });

  it('does not create webs on floors carved after initialization, through a file save', async () => {
    const registry = contentRegistry();
    const map = buildFlatTestMap(registry, 16, 16);
    const original = new HeadlessGame({ seed: 't131-carved-floors', registry, map, embark: 'none' });
    floors(map, 4, 4);
    original.step(2);
    expect(webTiles(map)).toEqual([]);
    expect(original.world.entities.with(C.Hostile)).toEqual([]);
    const blob = await saveGame(original, { kind: 'manual' });
    const loaded = (await loadGame(blob, { registry })).game;
    continuesIdentically(original, loaded);
  });

  it('retains authentic initial spiders and webs when additional floors exist at save time', () => {
    const registry = contentRegistry();
    const map = buildFlatTestMap(registry, 16, 16);
    floors(map, 2, 2);
    const original = new HeadlessGame({ seed: 't131-saved-spiders', registry, map, embark: 'none' });
    const spiders = original.world.entities.with(C.Hostile).filter((id) =>
      original.world.entities.get(id, C.Creature)?.species === registry.table('creatures').index('giant_cave_spider'));
    expect(spiders).toHaveLength(2);
    expect(webTiles(map).length).toBeGreaterThan(0);
    floors(map, 9, 9);
    original.step(2);
    const loaded = roundTrip(original).game;
    continuesIdentically(original, loaded);
  });
});
