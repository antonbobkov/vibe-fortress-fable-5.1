import { describe, expect, it, vi } from 'vitest';
import { buildFlatTestMap, FLAT_TEST_SPEC } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import { Map3D, TileFlag, TileKind } from '@core/map3d';
import { RngStream } from '@core/rng';
import { arrive } from '@systems/embark';
import type { DwarvesSystem } from '@systems/dwarves';
import type { ItemsReader } from '@systems/items';
import type { FluidsReader } from '@systems/fluids';
import { TerrainSystem } from '@systems/terrain';
import { TREE_LOGS_MIN, TREE_LOGS_MAX } from '@systems/terrain/constants';
import type { LocalGen } from '@systems/terrain/generate/common';
import { carveHall } from '@systems/terrain/generate/traits';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();

function hall(candidates: readonly [number, number, number][]): { x: number; y: number; z: number } | null {
  const map = buildFlatTestMap(registry, 48, 48);
  const heights = new Int16Array(map.w * map.h).fill(32);
  for (const [x, y, z] of candidates) {
    // T-436: the hall's footprint must fit under the ground, so each candidate stands on a rise
    // that covers its footprint (only the candidate column has a floor at that height).
    for (let yy = y - 4; yy <= y + 4; yy += 1) for (let xx = x - 1; xx < x + 17; xx += 1) heights[yy * map.w + xx] = Math.max(heights[yy * map.w + xx] as number, z);
    map.setKind(map.index(x, y, z), TileKind.Floor, registry.table('materials').index('loam'));
  }
  const g: LocalGen = {
    spec: FLAT_TEST_SPEC, map, registry, s: 't119-hall', w: map.w, h: map.h, d: map.d,
    heights, waterTop: new Int16Array(heights.length), colFlags: new Uint8Array(heights.length),
    stack: [], waterSources: [], sinks: [], cavernFloors: [[], [], [], []], cavernOpen: [],
    bare: new Uint8Array(heights.length), rocky: new Uint8Array(heights.length), scree: new Uint8Array(heights.length), veins: [], spawns: [], warmSprings: [], volcano: -1,
  };
  return carveHall(g, new RngStream(119));
}

describe('T-119 retained systems 01-07 resolutions', () => {
  it('D-048: higher ground wins before inward distance; equal heights prefer inward then column order', () => {
    expect(hall([[12, 25, 34], [10, 31, 33]])).toMatchObject({ x: 12, y: 25, z: 32 });
    expect(hall([[12, 25, 33], [14, 31, 33], [10, 31, 33]])).toMatchObject({ x: 10, y: 31, z: 31 });
  });

  it('D-053: separate settling actions in one tick emit separate ordered collapse batches', () => {
    const map = new Map3D(16, 16, 8);
    const material = registry.table('materials').index('granite');
    const support = [map.index(3, 3, 4), map.index(9, 9, 4)];
    const floors = [map.index(4, 3, 4), map.index(10, 9, 4)];
    for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) map.setKind(map.index(x, y, 2), TileKind.Floor, material);
    for (const tile of support) map.setKind(tile, TileKind.Wall, material);
    for (const tile of floors) {
      map.setKind(tile, TileKind.Floor, material);
      map.setFlag(tile, TileFlag.Constructed, true);
    }
    const w = new TestWorld({ seed: 't119-collapse', map });
    const core = (w.game.world.scheduler.byId('03') as TerrainSystem).core;
    const tick = w.tick;
    for (const tile of support.slice().reverse()) core.setKind(tile, TileKind.Open, 0);
    expect(w.tick).toBe(tick);
    for (const tile of floors) expect(map.kindAt(tile)).toBe(TileKind.Open);
    w.step(1);
    expect(w.events('ConstructionCollapsed').map((e) => e['tiles'])).toEqual([[floors[1]], [floors[0]]]);
  });

  it('D-076: wagon clearing preserves each tree species wood and its log range', () => {
    const map = buildFlatTestMap(registry, 48, 48);
    const materials = registry.table('materials');
    const plants = registry.table<{ id: string; logs: [number, number] }>('plants');
    for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) map.setKind(map.index(x, y, 32), TileKind.Tree, materials.index('pine'));
    const cx = map.w >> 1;
    for (let y = 0; y <= 2; y += 1) for (let x = cx - 1; x <= cx + 1; x += 1) map.setKind(map.index(x, y, 32), TileKind.Floor, materials.index('loam'));
    const trees = [['ash', map.index(cx - 1, 0, 32)], ['oak', map.index(cx + 1, 2, 32)]] as const;
    for (const [species, tile] of trees) map.setKind(tile, TileKind.Tree, materials.index(species));
    const w = new TestWorld({ seed: 't119-two-trees', map });
    const result = arrive(w.game.world, FLAT_TEST_SPEC, [], { fortressName: 'Two woods' });
    expect(result.logDrops).toEqual(trees.map(([, tile]) => tile));
    const items = w.readers.of<ItemsReader>('13');
    for (const [species, tile] of trees) {
      expect(materials.index(species)).not.toBe(plants.index(species));
      const ids = items.at(tile);
      for (const id of ids) expect(items.get(id)).toMatchObject({ type: registry.table('items').index('log'), material: materials.index(species) });
      const count = ids.reduce((sum, id) => sum + items.get(id)!.count, 0);
      const range = plants.byId(species)!.logs;
      expect(count).toBeGreaterThanOrEqual(Math.max(TREE_LOGS_MIN, range[0]));
      expect(count).toBeLessThanOrEqual(Math.min(TREE_LOGS_MAX, range[1]));
      expect(map.kindAt(tile)).toBe(TileKind.Floor);
    }
  });

  it('D-101: lightning enumerates chunks first and tiles within a chunk, not global tile order', () => {
    const map = buildFlatTestMap(registry, 48, 48);
    map.flags.fill(0);
    const lowTile = map.index(18, 1, 32);
    const firstChunkTile = map.index(0, 2, 32);
    expect(firstChunkTile).toBeGreaterThan(lowTile);
    for (const tile of [lowTile, firstChunkTile]) {
      for (let z = 32; z < map.d; z += 1) map.setFlag(map.index(map.xOf(tile), map.yOf(tile), z), TileFlag.Outdoor, true);
    }
    const w = new TestWorld({ seed: 't119-lightning-order', map });
    w.forceWeather('storm');
    const rng = w.game.world.rngFor('06');
    const chance = vi.spyOn(rng, 'chance').mockReturnValue(true);
    const int = vi.spyOn(rng, 'int').mockImplementation((min) => min);
    try {
      w.step(8);
      expect(w.events('LightningStrike').map((e) => e['tile'])).toEqual([firstChunkTile]);
    } finally {
      chance.mockRestore();
      int.mockRestore();
    }
  });

  it('D-102: the movement hook writes Brain mist memory and Needs masterwork joy without changing terrain', () => {
    const w = new TestWorld({ seed: 't119-movement-writes', map: buildFlatTestMap(registry, 48, 48) });
    const outside = w.index(18, 20, 32);
    const inside = w.index(20, 20, 32);
    const dwarf = w.spawnDwarf({ at: outside });
    w.zone('dining_hall', [inside, w.index(21, 20, 32)]);
    const object = w.spawnItem('bed', 'oak', w.index(21, 20, 32), 1, 5);
    w.step(1);
    w.setNeed(dwarf, 'joy', 45);
    // The reader supplies mist; exercise the installed handler with the world's real services.
    const system = w.game.world.scheduler.byId('10') as DwarvesSystem;
    const world = w.game.world;
    const emitted: GameEvent[] = [];
    const before = w.game.world.entities.get(dwarf, C.Brain)!;
    const kind = w.map.kind.slice();
    const flags = w.map.flags.slice();
    const mist = vi.spyOn(w.readers.of<FluidsReader>('04'), 'isMisty').mockImplementation((tile) => tile === inside);
    try {
      system.handle({ type: 'EntitiesMoved', moves: [[dwarf, outside, inside]] }, {
        world, registry: world.registry, rng: world.rngFor('10'), readers: world.readers,
        register: world.registrations, tick: w.tick, emit: (event) => emitted.push(event),
        terrain: world.services.terrain, jobs: world.services.jobs, spawn: world.services.spawn,
      });
    } finally {
      mist.mockRestore();
    }
    expect(emitted.filter((e) => e.type === 'SawMasterwork' && e['id'] === dwarf).map((e) => e['itemId'])).toEqual([object]);
    expect(w.game.world.entities.get(dwarf, C.Needs)?.joy).toBe(35);
    expect(system.serialize().sawMasterworks).toEqual([[dwarf, object]]);
    expect(before.lastMistTick).toBe(0);
    expect(w.game.world.entities.get(dwarf, C.Brain)?.lastMistTick).toBeGreaterThan(0);
    expect(emitted.filter((e) => e.type === 'DwarfFeltMist').map((e) => e['id'])).toContain(dwarf);
    expect(w.map.kind).toEqual(kind);
    expect(w.map.flags).toEqual(flags);
  });
});
