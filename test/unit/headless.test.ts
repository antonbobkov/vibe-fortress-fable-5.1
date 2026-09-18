import { describe, it, expect } from 'vitest';
import {
  FLAT_TEST_SOIL,
  FLAT_TEST_SOIL_DEPTH,
  FLAT_TEST_STONE,
  FLAT_TEST_SURFACE_Z,
  FLAT_TEST_MAGMA_SHELL,
  HeadlessGame,
  buildFlatTestMap,
  generatedSpec,
  hashesAt,
} from '@app/headless';
import { contentRegistry } from '@content/loader';
import { MAGMA_SEA_TOP_Z } from '@core/constants';
import { FluidType, TileFlag, TileKind } from '@core/map3d';
import { runScenario, currentMilestone, type Scenario } from '../scenarios/runner';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const materials = registry.table('materials');

describe('T-M0-11 headless: the flat-test map', () => {
  const map = buildFlatTestMap(registry);

  it('has a flat walkable surface at z = 32 with open sky above it', () => {
    for (const [x, y] of [
      [0, 0],
      [48, 48],
      [95, 95],
    ] as [number, number][]) {
      expect(map.kindAt(map.index(x, y, FLAT_TEST_SURFACE_Z))).toBe(TileKind.Floor);
      expect(map.kindAt(map.index(x, y, FLAT_TEST_SURFACE_Z + 1))).toBe(TileKind.Open);
      expect(map.columnSurfaceZ(x, y)).toBe(FLAT_TEST_SURFACE_Z);
    }
  });

  it('has three soil levels over granite', () => {
    const soil = materials.index(FLAT_TEST_SOIL);
    const stone = materials.index(FLAT_TEST_STONE);
    for (let d = 0; d < FLAT_TEST_SOIL_DEPTH; d += 1) {
      const z = FLAT_TEST_SURFACE_Z - d;
      expect(map.materialAt(map.index(40, 40, z))).toBe(soil);
      if (d > 0) expect(map.kindAt(map.index(40, 40, z))).toBe(TileKind.Wall);
    }
    const belowSoil = FLAT_TEST_SURFACE_Z - FLAT_TEST_SOIL_DEPTH;
    expect(map.materialAt(map.index(40, 40, belowSoil))).toBe(stone);
    expect(map.kindAt(map.index(40, 40, belowSoil))).toBe(TileKind.Wall);
  });

  it('has the Sea of Fire behind a basalt rim and cap', () => {
    const shell = materials.index(FLAT_TEST_MAGMA_SHELL);
    for (let z = 0; z <= MAGMA_SEA_TOP_Z; z += 1) {
      const inner = map.index(40, 40, z);
      expect(map.kindAt(inner)).toBe(TileKind.Open);
      expect(map.fluidLevelAt(inner)).toBe(7);
      expect(map.fluidTypeAt(inner)).toBe(FluidType.Magma);
      expect(map.fluidSourceAt(inner)).toBe(true);
      const rim = map.index(0, 40, z);
      expect(map.kindAt(rim)).toBe(TileKind.Wall);
      expect(map.materialAt(rim)).toBe(shell);
    }
    const cap = map.index(40, 40, MAGMA_SEA_TOP_Z + 1);
    expect(map.kindAt(cap)).toBe(TileKind.Wall);
    expect(map.materialAt(cap)).toBe(shell);
  });

  it('has no cavern: the rock between the magma cap and the surface is solid', () => {
    for (let z = MAGMA_SEA_TOP_Z + 1; z < FLAT_TEST_SURFACE_Z; z += 1) {
      for (let k = 0; k < 40; k += 1) {
        const i = map.index((k * 7) % map.w, (k * 13) % map.h, z);
        expect(map.kindAt(i)).toBe(TileKind.Wall);
      }
    }
  });

  it('marks the surface and the sky outdoor, lit and discovered', () => {
    const surface = map.index(20, 20, FLAT_TEST_SURFACE_Z);
    expect(map.hasFlag(surface, TileFlag.Outdoor)).toBe(true);
    expect(map.hasFlag(surface, TileFlag.Discovered)).toBe(true);
    expect(map.hasFlag(surface, TileFlag.Lit)).toBe(true);
    expect(map.hasFlag(map.index(20, 20, FLAT_TEST_SURFACE_Z - 1), TileFlag.Outdoor)).toBe(false);
  });
});

describe('T-M0-11 headless: the game', () => {
  it('registers the pathing and spatial readers and answers walkability through the graph', () => {
    const game = new HeadlessGame({ seed: 'headless', world: 'flat-test' });
    expect(game.world.readers.has('pathing')).toBe(true);
    expect(game.world.readers.has('spatial')).toBe(true);
    const surface = game.map.index(10, 10, 32);
    const rock = game.map.index(10, 10, 31);
    expect(game.world.readers.map.isWalkable(surface, 'walker')).toBe(true);
    expect(game.world.readers.map.isWalkable(rock, 'walker')).toBe(false);
    expect(game.world.readers.pathing.reachable(surface, game.map.index(80, 80, 32), 'walker')).toBe(true);
    expect(game.world.readers.spatial.at(surface)).toEqual([]);
  });

  it('rebuilds the labels of a dirtied chunk in the tick-end core phase', () => {
    const game = new HeadlessGame({ seed: 'headless', world: 'flat-test' });
    const a = game.map.index(10, 10, 31);
    expect(game.pathing.connectivity.label(a, 'walker')).toBe(0);
    game.map.setKind(a, TileKind.Floor, 1);
    expect(game.pathing.connectivity.label(a, 'walker')).toBe(0);
    game.step(1);
    expect(game.pathing.connectivity.label(a, 'walker')).not.toBe(0);
  });

  it('hashes grids, entities, the calendar and every system, and notices a changed tile', () => {
    const game = new HeadlessGame({ seed: 'headless', world: 'flat-test' });
    const before = game.hash();
    expect(before).toMatch(/^[0-9a-f]{16}$/);
    expect(game.hash()).toBe(before);
    game.map.setKind(game.map.index(5, 5, 32), TileKind.Wall, 1);
    expect(game.hash()).not.toBe(before);
  });

  it('the hash notices a new entity and a changed component', () => {
    const game = new HeadlessGame({ seed: 'headless', world: 'flat-test' });
    const empty = game.hash();
    const id = game.world.entities.create('creature');
    const withEntity = game.hash();
    expect(withEntity).not.toBe(empty);
    game.movement.teleport(id, game.map.index(10, 10, 32));
    expect(game.hash()).not.toBe(withEntity);
  });

  it('hashesAt returns one hash per checkpoint of a single run', () => {
    const hashes = hashesAt({ seed: 'headless', world: 'flat-test' }, [0, 10, 20]);
    expect([...hashes.keys()]).toEqual([0, 10, 20]);
    expect(new Set(hashes.values()).size).toBe(3);
  });
});

describe('T-M0-11 headless: the scenario runner', () => {
  const base: Omit<Scenario, 'world' | 'embark'> = {
    id: 'fixture',
    milestone: 0,
    seed: 'runner',
    run: 0,
  };

  it('reads the current milestone from PROGRESS.md', () => {
    expect(currentMilestone()).toBeGreaterThanOrEqual(0);
  });

  it('T-M1-05: a generated world and a region spec build a generated local map', () => {
    const generated = runScenario({ ...base, world: 'generated', run: 0 });
    expect(generated.game.local).not.toBeNull();
    expect(generated.game.local?.spec).toEqual(generatedSpec(base.seed));
    const region = runScenario({ ...base, world: { region: { biome: 'taiga', lake: true } }, run: 0 });
    expect(region.game.local?.spec.biome).toBe('taiga');
    expect(region.game.local?.columns.some((f) => f !== 0)).toBe(true);
  });

  it('T-M1-04: the default embark is lifted and lands the Balanced party', () => {
    const w = runScenario({ ...base, world: 'flat-test', embark: 'default', run: 1 });
    expect(w.game.world.entities.ofKind('creature')).toHaveLength(7);
    expect(w.events('Embarked')).toHaveLength(1);
    expect(() => runScenario({ ...base, world: 'flat-test', embark: { nope: 1 } })).toThrow(/preset/);
  });

  it('runs setup, then the ticks, then the assertions', () => {
    const order: string[] = [];
    const w = runScenario({
      ...base,
      world: 'flat-test',
      setup: () => order.push('setup'),
      run: 3,
      expect: (world) => {
        order.push('expect');
        expect(world.tick).toBe(3);
      },
    });
    expect(order).toEqual(['setup', 'expect']);
    expect(w.tick).toBe(3);
  });

  it('submits scheduled commands at their tick and records the rejection', () => {
    const w = runScenario({
      ...base,
      world: 'flat-test',
      commands: [{ tick: 1, command: { type: 'RenameFortress', name: 'Deepdelve' } }],
      run: 3,
    });
    expect(w.game.world.fortress.name).toBe('Deepdelve');
    expect(w.events('CommandRejected')).toHaveLength(0);
  });
});

describe('T-M0-11 headless: TestWorld', () => {
  it('digs, lays floor and reports events', () => {
    const w = new TestWorld({ seed: 'tw', world: 'flat-test' });
    w.digRoom(10, 10, 31, 3, 3);
    expect(w.map.kindAt(w.index(11, 11, 31))).toBe(TileKind.Floor);
    w.placeFloorSlab(10, 10, 34, 2, 2);
    expect(w.map.kindAt(w.index(10, 10, 34))).toBe(TileKind.Floor);
    w.step(1);
    expect(w.reachable(w.index(10, 10, 31), w.index(12, 12, 31))).toBe(true);
  });

  it('`until` steps to a condition and gives up loudly', () => {
    const w = new TestWorld({ seed: 'tw', world: 'flat-test' });
    expect(w.until((world) => world.tick >= 5, 100)).toBe(5);
    expect(() => w.until(() => false, 3)).toThrow(/did not hold within 3 ticks/);
  });

  it('every helper whose subsystem is not built yet names the task that will build it', () => {
    const w = new TestWorld({ seed: 'tw', world: 'flat-test' });
    expect(() => w.build()).toThrow(/T-M2-05/);
    expect(() => w.zone()).toThrow(/T-M2-03/);
    expect(() => w.setNeed()).toThrow(/T-M4-05/);
    expect(() => w.forceWeather()).toThrow(/T-M3-06/);
    expect(() => w.forceTemperature()).toThrow(/T-M3-03/);
  });
});
