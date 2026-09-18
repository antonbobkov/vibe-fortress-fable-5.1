import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { C as COMPONENTS } from '@core/components';
import { HeadlessGame } from '@app/headless';
import { Designation, Map3D, TileFlag, TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { TileIndex } from '@core/types';
import {
  TerrainFacts,
  TerrainSystem,
  cavernAt,
  precondition,
  stairwellTiles,
  transition,
  type MaterialClass,
  type MaterialFacts,
  type TerrainReader,
  type TransitionRolls,
} from '@systems/terrain';
import { MINING_STONE_DROP_PERMILLE } from '@systems/terrain/constants';

const registry = contentRegistry();
const materials = registry.table('materials');
const GRANITE = materials.index('granite');
const LOAM = materials.index('loam');
const HEMATITE = materials.index('hematite');
const AMETHYST = materials.index('amethyst');
const ICE = materials.index('ice');
const OAK = materials.index('oak');
const DEEPSILVER = materials.index('deepsilver_ore');

// ---------- the pure transition table ----------

/** Facts over the real registry, so every class comes from `materials.md`. */
const facts: MaterialFacts = new TerrainFacts(registry);

function rolls(stone = true): TransitionRolls {
  return {
    stoneDrops: () => stone,
    logs: () => 3,
    gather: () => ({ type: 'plant_food', material: 'bramble_berry', count: 2 }),
    logMaterial: () => 'oak',
  };
}

/** A 5×5×5 map, all open, for the table cases. */
function tiny(): Map3D {
  return new Map3D(5, 5, 5);
}

function put(map: Map3D, x: number, y: number, z: number, kind: TileKind, material = GRANITE, flags = 0): TileIndex {
  const i = map.index(x, y, z);
  map.kind[i] = kind;
  map.material[i] = material;
  map.flags[i] = flags;
  return i;
}

interface Row {
  readonly name: string;
  readonly kind: Designation;
  readonly build: (map: Map3D) => TileIndex;
  readonly pass: boolean;
}

const C = TileFlag.Constructed;

/** `03` § Tile transitions, the precondition column, each row passing and failing. */
const PRECONDITIONS: readonly Row[] = [
  { name: 'dig wall', kind: Designation.Dig, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Wall) },
  { name: 'dig boulder', kind: Designation.Dig, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Boulder) },
  { name: 'dig constructed wall', kind: Designation.Dig, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Wall, GRANITE, C) },
  { name: 'dig floor', kind: Designation.Dig, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Floor) },
  { name: 'channel floor', kind: Designation.Channel, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Floor) },
  { name: 'channel ramp', kind: Designation.Channel, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Ramp) },
  { name: 'channel sapling', kind: Designation.Channel, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Sapling, 1) },
  { name: 'channel shrub', kind: Designation.Channel, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Shrub, 1) },
  { name: 'channel stairs_down', kind: Designation.Channel, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.StairsDown) },
  { name: 'channel wall', kind: Designation.Channel, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Wall) },
  { name: 'stairs_up wall', kind: Designation.StairsUp, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Wall) },
  { name: 'stairs_up floor', kind: Designation.StairsUp, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Floor) },
  { name: 'stairs_down floor', kind: Designation.StairsDown, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Floor) },
  { name: 'stairs_down wall', kind: Designation.StairsDown, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Wall) },
  { name: 'stairs_updown wall', kind: Designation.StairsUpDown, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Wall) },
  { name: 'stairs_updown floor', kind: Designation.StairsUpDown, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Floor) },
  {
    name: 'ramp wall under open',
    kind: Designation.Ramp,
    pass: true,
    build: (m) => put(m, 2, 2, 2, TileKind.Wall),
  },
  {
    name: 'ramp wall under floor',
    kind: Designation.Ramp,
    pass: true,
    build: (m) => {
      put(m, 2, 2, 3, TileKind.Floor);
      return put(m, 2, 2, 2, TileKind.Wall);
    },
  },
  {
    name: 'ramp wall under wall',
    kind: Designation.Ramp,
    pass: false,
    build: (m) => {
      put(m, 2, 2, 3, TileKind.Wall);
      return put(m, 2, 2, 2, TileKind.Wall);
    },
  },
  { name: 'smooth stone wall', kind: Designation.Smooth, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Wall) },
  { name: 'smooth stone floor', kind: Designation.Smooth, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Floor) },
  { name: 'smooth soil wall', kind: Designation.Smooth, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Wall, LOAM) },
  { name: 'smooth constructed wall', kind: Designation.Smooth, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Wall, GRANITE, C) },
  { name: 'smooth smoothed wall', kind: Designation.Smooth, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Wall, GRANITE, TileFlag.Smoothed) },
  { name: 'engrave smoothed wall', kind: Designation.Engrave, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Wall, GRANITE, TileFlag.Smoothed) },
  { name: 'engrave rough wall', kind: Designation.Engrave, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Wall) },
  { name: 'remove constructed wall', kind: Designation.Remove, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Wall, GRANITE, C) },
  { name: 'remove constructed floor', kind: Designation.Remove, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Floor, GRANITE, C) },
  { name: 'remove natural wall', kind: Designation.Remove, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Wall) },
  { name: 'chop tree', kind: Designation.Chop, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Tree, 1) },
  { name: 'chop shrub', kind: Designation.Chop, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Shrub, 1) },
  { name: 'gather shrub', kind: Designation.Gather, pass: true, build: (m) => put(m, 2, 2, 2, TileKind.Shrub, 1) },
  { name: 'gather tree', kind: Designation.Gather, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Tree, 1) },
  { name: 'harvest is 07\'s', kind: Designation.Harvest, pass: false, build: (m) => put(m, 2, 2, 2, TileKind.Floor) },
];

describe('T-M1-07 terrain: the transition table', () => {
  for (const row of PRECONDITIONS) {
    it(`precondition: ${row.name} ${row.pass ? 'passes' : 'fails'}`, () => {
      const map = tiny();
      const i = row.build(map);
      expect(precondition(map, i, row.kind, facts)).toBe(row.pass);
    });
  }

  it('dig: floor of the same material, the tile above unchanged, drops by material class', () => {
    const cases: [number, string | null, boolean][] = [
      [GRANITE, 'raw_stone', true],
      [GRANITE, null, false],
      [LOAM, null, true],
      [HEMATITE, 'ore', false],
      [AMETHYST, 'rough_gem', false],
      [ICE, null, true],
    ];
    for (const [material, drop, stone] of cases) {
      const map = tiny();
      const i = put(map, 2, 2, 2, TileKind.Wall, material);
      put(map, 2, 2, 3, TileKind.Wall, GRANITE);
      const r = transition(map, i, Designation.Dig, facts, rolls(stone));
      expect(r.changes).toEqual([{ tile: i, kind: TileKind.Floor, material }]);
      expect(r.drops.map((d) => d.type)).toEqual(drop === null ? [] : [drop]);
      expect(r.changes.some((c) => c.tile === map.above(i))).toBe(false);
    }
  });

  it('channel: open; a wall below becomes a ramp and drops as dug; a floor below stays', () => {
    const map = tiny();
    const i = put(map, 2, 2, 3, TileKind.Floor);
    const below = put(map, 2, 2, 2, TileKind.Wall, HEMATITE);
    const r = transition(map, i, Designation.Channel, facts, rolls());
    expect(r.changes[0]).toMatchObject({ tile: i, kind: TileKind.Open, material: 0 });
    expect(r.changes[1]).toEqual({ tile: below, kind: TileKind.Ramp, material: HEMATITE });
    expect(r.drops).toEqual([{ type: 'ore', material: HEMATITE, count: 1, tile: below }]);

    const m2 = tiny();
    const j = put(m2, 2, 2, 3, TileKind.Floor);
    put(m2, 2, 2, 2, TileKind.Floor);
    const r2 = transition(m2, j, Designation.Channel, facts, rolls());
    expect(r2.changes).toHaveLength(1);
    expect(r2.drops).toEqual([]);

    const m3 = tiny();
    const k = put(m3, 2, 2, 3, TileKind.Floor);
    const r3 = transition(m3, k, Designation.Channel, facts, rolls());
    expect(r3.changes).toHaveLength(1);
  });

  it('stairs and ramps: the carved kind, the dig drop, and the tile above a ramp opens if it was floor', () => {
    for (const [kind, result, drops] of [
      [Designation.StairsUp, TileKind.StairsUp, 1],
      [Designation.StairsUpDown, TileKind.StairsUpDown, 1],
    ] as const) {
      const map = tiny();
      const i = put(map, 2, 2, 2, TileKind.Wall);
      const r = transition(map, i, kind, facts, rolls(true));
      expect(r.changes).toEqual([{ tile: i, kind: result, material: GRANITE }]);
      expect(r.drops).toHaveLength(drops);
    }
    const map = tiny();
    const i = put(map, 2, 2, 2, TileKind.Floor);
    const r = transition(map, i, Designation.StairsDown, facts, rolls(true));
    expect(r.changes).toEqual([{ tile: i, kind: TileKind.StairsDown, material: GRANITE }]);
    expect(r.drops).toEqual([]);

    const m2 = tiny();
    const up = put(m2, 2, 2, 3, TileKind.Floor);
    const w = put(m2, 2, 2, 2, TileKind.Wall);
    const r2 = transition(m2, w, Designation.Ramp, facts, rolls(false));
    expect(r2.changes).toEqual([
      { tile: w, kind: TileKind.Ramp, material: GRANITE },
      { tile: up, kind: TileKind.Open, material: 0 },
    ]);
  });

  it('smooth and engrave set their flags and drop nothing', () => {
    const map = tiny();
    const i = put(map, 2, 2, 2, TileKind.Wall);
    expect(transition(map, i, Designation.Smooth, facts, rolls())).toEqual({ changes: [{ tile: i, set: TileFlag.Smoothed }], drops: [] });
    expect(transition(map, i, Designation.Engrave, facts, rolls())).toEqual({ changes: [{ tile: i, set: TileFlag.Engraved }], drops: [] });
  });

  it('remove: the material returns; a constructed floor over natural rock becomes the natural floor', () => {
    const map = tiny();
    put(map, 2, 2, 1, TileKind.Wall, LOAM);
    const f = put(map, 2, 2, 2, TileKind.Floor, GRANITE, C);
    const r = transition(map, f, Designation.Remove, facts, rolls());
    expect(r.drops).toEqual([{ type: 'stone_block', material: GRANITE, count: 1, tile: f }]);
    expect(r.changes).toEqual([{ tile: f, kind: TileKind.Floor, material: LOAM, clear: C }]);

    const m2 = tiny();
    const w = put(m2, 2, 2, 2, TileKind.Wall, OAK, C);
    const r2 = transition(m2, w, Designation.Remove, facts, rolls());
    expect(r2.drops[0]?.type).toBe('log');
    expect(r2.changes).toEqual([{ tile: w, kind: TileKind.Open, material: 0, clear: C }]);

    const m3 = tiny();
    const s = put(m3, 2, 2, 2, TileKind.StairsUp, GRANITE, C);
    expect(transition(m3, s, Designation.Remove, facts, rolls()).changes[0]).toMatchObject({ kind: TileKind.Open });
  });

  it('chop: floor of the ground below, grass on soil, logs by species; gather: the shrub stays and drops its product', () => {
    const map = tiny();
    put(map, 2, 2, 1, TileKind.Wall, LOAM);
    const t = put(map, 2, 2, 2, TileKind.Tree, 1);
    const r = transition(map, t, Designation.Chop, facts, rolls());
    expect(r.changes).toEqual([{ tile: t, kind: TileKind.Floor, material: LOAM, set: TileFlag.Grass }]);
    expect(r.drops).toEqual([{ type: 'log', material: 'oak', count: 3, tile: t }]);

    const s = put(map, 3, 3, 2, TileKind.Shrub, 1);
    const g = transition(map, s, Designation.Gather, facts, rolls());
    expect(g.changes).toEqual([]);
    expect(g.drops).toEqual([{ type: 'plant_food', material: 'bramble_berry', count: 2, tile: s }]);
  });

  it('classes: stone, soil, ore, gem, ice and wood come from materials.md; obsidian counts as stone', () => {
    const cls = (id: string): MaterialClass => facts.classOf(materials.index(id));
    expect([cls('granite'), cls('loam'), cls('hematite'), cls('amethyst'), cls('ice'), cls('oak'), cls('obsidian')]).toEqual([
      'stone',
      'soil',
      'ore',
      'gem',
      'ice',
      'wood',
      'stone',
    ]);
    expect(facts.isDeepsilver(DEEPSILVER)).toBe(true);
    expect(facts.isDeepsilver(HEMATITE)).toBe(false);
    expect(MINING_STONE_DROP_PERMILLE).toBe(300);
  });
});

// ---------- the system over a map ----------

function game(map?: Map3D): HeadlessGame {
  return new HeadlessGame({ seed: 'terrain-test', ...(map === undefined ? { world: 'flat-test' as const } : { map }) });
}

function reader(g: HeadlessGame): TerrainReader {
  return g.world.readers.of<TerrainReader>('03');
}

function events(g: HeadlessGame): GameEvent[] {
  const out: GameEvent[] = [];
  g.world.onEvents((batch) => out.push(...batch));
  return out;
}

/** A small all-open map with a solid granite ground at z = 2. */
function openMap(): Map3D {
  const map = new Map3D(16, 16, 8);
  for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) put(map, x, y, 2, TileKind.Floor);
  return map;
}

describe('T-M1-07 terrain: support and collapse', () => {
  const FACES: readonly [string, number, number, number][] = [
    ['west', -1, 0, 0],
    ['east', 1, 0, 0],
    ['north', 0, -1, 0],
    ['south', 0, 1, 0],
    ['below', 0, 0, -1],
    ['above', 0, 0, 1],
  ];
  for (const [name, dx, dy, dz] of FACES) {
    it(`a constructed floor touching only a wall ${name} of it is supported; with none it is not`, () => {
      const map = new Map3D(8, 8, 8);
      const i = put(map, 4, 4, 4, TileKind.Floor, GRANITE, C);
      const g = game(map);
      const t = g.terrain as TerrainSystem;
      expect(reader(g).isSupported(i)).toBe(false);
      put(map, 4 + dx, 4 + dy, 4 + dz, TileKind.Wall);
      expect(reader(g).isSupported(i)).toBe(true);
      expect(t.core.isSupported(i)).toBe(true);
    });
  }

  it('natural tiles never collapse', () => {
    const map = new Map3D(8, 8, 8);
    const i = put(map, 4, 4, 4, TileKind.Floor);
    const g = game(map);
    expect(reader(g).isSupported(i)).toBe(true);
  });

  it('D-053: collapses cascade in (z ascending, y, x) order in the same tick, each dropping its material below', () => {
    const map = openMap();
    const idx = (x: number, y: number, z: number): TileIndex => map.index(x, y, z);
    // Four floors in the air, each held only by its own constructed wall standing on a pillar.
    const floors: TileIndex[] = [];
    const walls: TileIndex[] = [];
    const spots: [number, number, number, number][] = [
      [9, 9, 5, GRANITE],
      [3, 6, 4, OAK],
      [3, 3, 4, GRANITE],
      [9, 3, 5, GRANITE],
    ];
    for (const [x, y, z, m] of spots) {
      for (let zz = 3; zz <= z; zz += 1) walls.push(put(map, x - 1, y, zz, TileKind.Wall, GRANITE, C));
      floors.push(put(map, x, y, z, TileKind.Floor, m, C));
    }
    const g = game(map);
    const seen = events(g);
    const core = (g.terrain as TerrainSystem).core;
    // The top wall of every pillar goes in one action, listed in descending order.
    const tops = spots.map(([x, y, z]) => idx(x - 1, y, z)).sort((a, b) => b - a);
    core.writeMany(tops.map((tile) => ({ tile, kind: TileKind.Open, material: 0, clear: C })));
    for (const f of floors) expect(map.kindAt(f)).toBe(TileKind.Open);
    const drops = reader(g).intendedDrops().filter((d) => d.reason === 'collapse');
    const order = floors.slice().sort((a, b) => a - b);
    // Each lands on the first solid-bottomed tile below: the ground at z = 2.
    expect(drops.map((d) => d.tile)).toEqual(order.map((f) => idx(map.xOf(f), map.yOf(f), 2)));
    expect(drops.map((d) => d.type)).toEqual(order.map((f) => (f === floors[1] ? 'log' : 'stone_block')));
    // The rest of each pillar still stands on the ground.
    expect(map.kindAt(idx(8, 9, 3))).toBe(TileKind.Wall);
    g.step(1);
    const collapsed = seen.filter((e) => e.type === 'ConstructionCollapsed');
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.['tiles']).toEqual(order);
  });

  it('D-053: two constructions that touch hold each other up (the rule is local, natural or constructed)', () => {
    const map = openMap();
    const w = put(map, 5, 5, 3, TileKind.Wall, GRANITE, C);
    put(map, 5, 5, 4, TileKind.Wall, GRANITE, C);
    const a = put(map, 6, 5, 4, TileKind.Floor, GRANITE, C);
    const b = put(map, 7, 5, 4, TileKind.Floor, GRANITE, C);
    const g = game(map);
    (g.terrain as TerrainSystem).core.writeMany([{ tile: map.index(5, 5, 4), kind: TileKind.Open, material: 0, clear: C }]);
    expect(map.kindAt(a)).toBe(TileKind.Floor);
    expect(map.kindAt(b)).toBe(TileKind.Floor);
    expect(map.kindAt(w)).toBe(TileKind.Wall);
  });
});

describe('T-M1-07 terrain: discovery', () => {
  /** A 16×16×30 granite block with a cavern pocket in band 1 and a shaft leaving the band below it. */
  function cavernMap(): { map: Map3D; region: TileIndex[]; below: TileIndex; far: TileIndex; dug: TileIndex } {
    const map = new Map3D(16, 16, 30);
    for (let z = 0; z < 30; z += 1) for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) put(map, x, y, z, TileKind.Wall);
    const region: TileIndex[] = [];
    for (let z = 18; z <= 19; z += 1) {
      for (let y = 4; y <= 8; y += 1) {
        for (let x = 4; x <= 8; x += 1) region.push(put(map, x, y, z, z === 18 ? TileKind.Floor : TileKind.Open));
      }
    }
    // A shaft from the pocket down out of the band.
    put(map, 6, 6, 17, TileKind.Open);
    const below = put(map, 6, 6, 16, TileKind.Open);
    put(map, 6, 6, 15, TileKind.Floor);
    // The tile a miner digs, next to the pocket's east wall.
    put(map, 10, 6, 18, TileKind.Floor);
    put(map, 9, 6, 18, TileKind.Floor);
    return { map, region, below, far: map.index(14, 14, 18), dug: map.index(9, 6, 18) };
  }

  it('a breach flood-fills the connected open region of the band only, plus one tile of rock', () => {
    const { map, region, below, far, dug } = cavernMap();
    const g = game(map);
    const seen = events(g);
    const core = (g.terrain as TerrainSystem).core;
    expect(cavernAt(18)).toBe(1);
    expect(core.checkBreach(dug)).toBe(1);
    for (const t of region) expect(map.hasFlag(t, TileFlag.Discovered)).toBe(true);
    // The rock ring around the region is seen; the shaft continues below the band unseen.
    expect(map.hasFlag(map.index(3, 4, 18), TileFlag.Discovered)).toBe(true);
    expect(map.hasFlag(map.index(6, 6, 17), TileFlag.Discovered)).toBe(true);
    expect(map.hasFlag(below, TileFlag.Discovered)).toBe(false);
    expect(map.hasFlag(far, TileFlag.Discovered)).toBe(false);
    expect(reader(g).cavernBreached(1)).toBe(true);
    // Once per cavern.
    expect(core.checkBreach(dug)).toBe(0);
    g.step(1);
    expect(seen.filter((e) => e.type === 'CavernBreached').map((e) => e['cavern'])).toEqual([1]);
    expect((seen.find((e) => e.type === 'TilesDiscovered')?.['tiles'] as number[]).length).toBeGreaterThan(region.length);
  });

  it('a fortress creature entering a tile discovers its 26 neighbours on the next tick', () => {
    const g = game();
    const map = g.map;
    const e = g.world.entities;
    const id = e.create('creature');
    e.add(id, COMPONENTS.Creature, { species: 1, name: 'Test', sex: 0, ageTicks: 0, faction: 'fortress', sizeClass: 60, bodyPlan: 1 });
    const deep = map.index(20, 20, 30);
    expect(map.hasFlag(deep, TileFlag.Discovered)).toBe(false);
    g.movement.teleport(id, deep);
    g.step(2);
    expect(map.hasFlag(deep, TileFlag.Discovered)).toBe(true);
    expect(map.hasFlag(map.index(21, 21, 29), TileFlag.Discovered)).toBe(true);
    expect(map.hasFlag(map.index(22, 20, 30), TileFlag.Discovered)).toBe(false);
  });
});

describe('T-M1-07 terrain: commands', () => {
  it('Designate accepts undiscovered tiles blind and rejects a discovered tile that fails the precondition', () => {
    const g = game();
    const map = g.map;
    const floor = map.index(10, 10, 32);
    const blind = map.index(10, 10, 20);
    expect(g.world.applyCommand({ type: 'Designate', tiles: [blind], kind: 'dig', priority: 3 })).toEqual({ ok: true });
    expect(reader(g).designationAt(blind)).toEqual({ kind: Designation.Dig, priority: 3 });
    expect(g.world.applyCommand({ type: 'Designate', tiles: [floor, map.index(11, 10, 20)], kind: Designation.Dig })).toEqual({
      ok: false,
      reason: 'precondition_failed',
    });
    // Nothing of a rejected command was applied.
    expect(reader(g).designationAt(map.index(11, 10, 20))).toBeNull();
    expect(g.world.applyCommand({ type: 'Designate', tiles: [floor], kind: 'channel' })).toEqual({ ok: true });
    expect(reader(g).designationAt(floor)?.priority).toBe(5);
    expect(g.world.applyCommand({ type: 'Designate', tiles: [floor], kind: 'channel', priority: 10 })).toEqual({ ok: false, reason: 'out_of_range' });
    expect(g.world.applyCommand({ type: 'Designate', tiles: [-3], kind: 'dig' })).toEqual({ ok: false, reason: 'out_of_bounds' });
    expect(reader(g).designations().map((d) => d.tile)).toEqual([blind, floor]);
  });

  it('D-052: deepsilver_unconfirmed until ConfirmDeepsilver', () => {
    const g = game();
    const map = g.map;
    const t = map.index(10, 10, 31);
    map.material[t] = DEEPSILVER;
    map.setFlag(t, TileFlag.Discovered, true);
    expect(g.world.applyCommand({ type: 'Designate', tiles: [t], kind: 'dig' })).toEqual({ ok: false, reason: 'deepsilver_unconfirmed' });
    expect(g.world.applyCommand({ type: 'ConfirmDeepsilver' })).toEqual({ ok: true });
    expect(g.world.fortress.deepsilverConfirmed).toBe(true);
    expect(g.world.applyCommand({ type: 'Designate', tiles: [t], kind: 'dig' })).toEqual({ ok: true });
  });

  it('D-052: undo clears designations without progress and keeps tiles with progress', () => {
    const g = game();
    const t = g.terrain as TerrainSystem;
    const a = g.map.index(3, 3, 25);
    const b = g.map.index(4, 3, 25);
    g.world.applyCommand({ type: 'Designate', tiles: [a, b], kind: 'dig' });
    t.progressOf = (tile) => (tile === a ? 300 : 0);
    expect(g.world.applyCommand({ type: 'UndoDesignation', tiles: [a, b] })).toEqual({ ok: false, reason: 'has_progress' });
    expect(reader(g).designationAt(a)).not.toBeNull();
    expect(reader(g).designationAt(b)).toBeNull();
    t.progressOf = () => 0;
    expect(g.world.applyCommand({ type: 'UndoDesignation', tiles: [a, b] })).toEqual({ ok: true });
    expect(reader(g).designations()).toEqual([]);
  });

  it('SetDesignationPriority needs a designation on every tile', () => {
    const g = game();
    const a = g.map.index(3, 3, 25);
    g.world.applyCommand({ type: 'Designate', tiles: [a], kind: 'dig' });
    expect(g.world.applyCommand({ type: 'SetDesignationPriority', tiles: [a, a + 1], priority: 2 })).toEqual({ ok: false, reason: 'not_found' });
    expect(g.world.applyCommand({ type: 'SetDesignationPriority', tiles: [a], priority: 2 })).toEqual({ ok: true });
    expect(reader(g).designationAt(a)).toEqual({ kind: Designation.Dig, priority: 2 });
  });

  it('DesignateStairwell expands to stairs_down, stairs_updown and stairs_up', () => {
    const g = game();
    const map = g.map;
    expect(stairwellTiles(map, 5, 5, 32, 29).map((s) => s.kind)).toEqual([
      Designation.StairsDown,
      Designation.StairsUpDown,
      Designation.StairsUpDown,
      Designation.StairsUp,
    ]);
    expect(g.world.applyCommand({ type: 'DesignateStairwell', x: 5, y: 5, zTop: 29, zBottom: 32 })).toEqual({ ok: false, reason: 'precondition_failed' });
    expect(g.world.applyCommand({ type: 'DesignateStairwell', x: 5, y: 5, zTop: 99, zBottom: 30 })).toEqual({ ok: false, reason: 'out_of_bounds' });
    expect(g.world.applyCommand({ type: 'DesignateStairwell', x: 5, y: 5, zTop: 32, zBottom: 30 })).toEqual({ ok: true });
    expect(reader(g).designations().map((d) => d.kind)).toEqual([Designation.StairsUp, Designation.StairsUpDown, Designation.StairsDown]);
  });

  it('SetTraffic: restricted sets the flag; forbidden also blocks fortress creatures in 22', () => {
    const g = game();
    const map = g.map;
    const t = map.index(8, 8, 32);
    expect(g.world.applyCommand({ type: 'SetTraffic', tiles: [t], mode: 'restricted' })).toEqual({ ok: true });
    expect(map.hasFlag(t, TileFlag.Restricted)).toBe(true);
    expect(g.pathing.graph.passable(t, 'walker', { faction: 'fortress' })).toBe(true);
    expect(g.world.applyCommand({ type: 'SetTraffic', tiles: [t], mode: 'forbidden' })).toEqual({ ok: true });
    expect(reader(g).isForbidden(t)).toBe(true);
    expect(g.pathing.graph.passable(t, 'walker', { faction: 'fortress' })).toBe(false);
    expect(g.pathing.graph.passable(t, 'walker', { faction: 'wild' })).toBe(true);
    expect(g.world.applyCommand({ type: 'SetTraffic', tiles: [t], mode: 'normal' })).toEqual({ ok: true });
    expect(map.hasFlag(t, TileFlag.Restricted)).toBe(false);
    expect(reader(g).isForbidden(t)).toBe(false);
    expect(g.world.applyCommand({ type: 'SetTraffic', tiles: [t], mode: 'sideways' })).toEqual({ ok: false, reason: 'precondition_failed' });
  });
});

describe('T-M1-07 terrain: the tile API', () => {
  it('a kind change recomputes the column outdoor flags and the level lit flags, batched into one TilesChanged', () => {
    const g = game();
    const seen = events(g);
    const map = g.map;
    const floor = map.index(30, 30, 32);
    const roof = map.index(30, 30, 34);
    expect(map.hasFlag(floor, TileFlag.Outdoor)).toBe(true);
    g.world.services.terrain.setKind(roof, TileKind.Wall, GRANITE);
    expect(map.hasFlag(floor, TileFlag.Outdoor)).toBe(false);
    expect(map.hasFlag(roof, TileFlag.Outdoor)).toBe(true);
    g.step(1);
    // Daylight still reaches under a one-tile roof from the open tiles beside it.
    expect(map.hasFlag(map.index(30, 30, 33), TileFlag.Lit)).toBe(true);
    const changed = seen.filter((e) => e.type === 'TilesChanged');
    expect(changed).toHaveLength(1);
    expect(changed[0]?.['tiles']).toContain(roof);
  });

  it('D-049: 03 installs its terrain API in the world services, and a bare world keeps the core one', () => {
    const g = game();
    expect(g.world.services.terrain).toBe((g.terrain as TerrainSystem).core);
    const bare = new HeadlessGame({ seed: 'bare', world: 'flat-test', systems: [] });
    expect(bare.terrain).toBeNull();
    expect(bare.world.services.terrain).not.toBeInstanceOf(Object.getPrototypeOf((g.terrain as TerrainSystem).core).constructor);
  });

  it('a designation whose precondition stops holding is cleared silently', () => {
    const g = game();
    const map = g.map;
    const t = map.index(12, 12, 32);
    g.world.applyCommand({ type: 'Designate', tiles: [t], kind: 'stairs_down' });
    g.world.services.terrain.setKind(t, TileKind.Wall, GRANITE);
    expect(reader(g).designationAt(t)).toBeNull();
  });

  it('the inspector hides an undiscovered tile\'s material', () => {
    const g = game();
    const map = g.map;
    expect(reader(g).inspect(map.index(1, 1, 20))).toMatchObject({ discovered: false, material: 'unknown rock', materialClass: 'unknown' });
    expect(reader(g).inspect(map.index(1, 1, 32))).toMatchObject({ discovered: true, material: 'loam', materialClass: 'soil' });
    expect(reader(g).surfaceZ(1, 1)).toBe(32);
    expect(reader(g).spec()?.seed).toBe('flat-test');
  });
});
