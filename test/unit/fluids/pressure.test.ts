import { describe, it, expect } from 'vitest';
import { FLUID_DEEP_LEVEL, FLUID_MAX_LEVEL } from '@core/constants';
import { TileKind } from '@core/map3d';
import { WADE_LARGE_SIZE } from '@core/path-constants';
import { FLUID_SETTLE_STEPS, OBSIDIAN_WALL_LEVEL, PRESSURE_BUDGET_TILES, PRESSURE_SEARCH_LIMIT } from '@systems/fluids/constants';
import { OBSIDIAN, carve, harness } from './harness';

/** A U-tube: a body of full water joined at the bottom to an open shaft. */
function uTube(sourceTop: number, shaftTop: number, source: boolean) {
  const h = harness(`u-${sourceTop}-${source}`, 8, 4, 12);
  const y = 1;
  carve(h.map, 1, y, 1, 5, 1, TileKind.Floor);
  for (let z = 2; z <= sourceTop; z += 1) carve(h.map, 1, y, z, 1, 1, TileKind.Open);
  for (let z = 2; z <= shaftTop; z += 1) carve(h.map, 5, y, z, 1, 1, TileKind.Open);
  for (let z = 1; z <= sourceTop; z += 1) h.sim.pour(h.map.index(1, y, z), FLUID_MAX_LEVEL, false, source);
  for (let x = 2; x <= 4; x += 1) h.sim.pour(h.map.index(x, y, 1), FLUID_MAX_LEVEL);
  return { h, y };
}

describe('T-M3-02 fluids: rule 3, pressure', () => {
  it('a source column fills the shaft to one below its top and never higher', () => {
    const { h, y } = uTube(5, 10, true);
    for (let k = 0; k < 400; k += 1) {
      h.steps(1);
      for (let z = 5; z <= 10; z += 1) expect(h.sim.level(h.map.index(5, y, z))).toBe(0);
    }
    for (let z = 1; z <= 4; z += 1) expect(h.sim.level(h.map.index(5, y, z))).toBe(FLUID_MAX_LEVEL);
  });

  it('pressure never lifts above the head: a plain body lifts its own units and conserves them', () => {
    const { h, y } = uTube(6, 10, false);
    const tiles: number[] = [];
    for (let z = 1; z <= 10; z += 1) tiles.push(h.map.index(1, y, z), h.map.index(5, y, z));
    for (let x = 2; x <= 4; x += 1) tiles.push(h.map.index(x, y, 1));
    const start = h.sum(tiles);
    let highest = 0;
    for (let k = 0; k < 600; k += 1) {
      h.steps(1);
      let top = 0;
      for (let z = 1; z <= 10; z += 1) if (h.sim.level(h.map.index(1, y, z)) > 0) top = z;
      for (let z = 1; z <= 10; z += 1) if (h.sim.level(h.map.index(5, y, z)) > 0) highest = Math.max(highest, z);
      // The shaft's water never stands above the body's highest full tile.
      expect(highest).toBeLessThanOrEqual(Math.max(top, 6));
      expect(h.sum(tiles) + h.sim.destroyedUnits).toBe(start);
    }
    expect(h.sim.level(h.map.index(5, y, 2))).toBeGreaterThan(0);
  });

  it('D-088: pressure does not lift water up through a floor', () => {
    const { h, y } = uTube(5, 10, true);
    h.map.kind[h.map.index(5, y, 2)] = TileKind.Floor;
    h.steps(200);
    expect(h.sim.level(h.map.index(5, y, 2))).toBe(0);
  });

  it('budget exhaustion retries next step: the searches that found no budget are not counted idle', () => {
    const h = harness('budget', 34, 34, 3);
    const body = carve(h.map, 1, 1, 1, 32, 32, TileKind.Floor);
    carve(h.map, 1, 1, 2, 32, 32, TileKind.Open);
    for (const t of body) h.sim.pour(t, FLUID_MAX_LEVEL);
    h.steps(1);
    // Every search walks PRESSURE_SEARCH_LIMIT tiles (the body has no head), so the budget covers
    // only the first PRESSURE_BUDGET_TILES / PRESSURE_SEARCH_LIMIT tiles of the step.
    const searched = Math.ceil(PRESSURE_BUDGET_TILES / PRESSURE_SEARCH_LIMIT);
    const idle1 = body.filter((t) => h.sim.idle[t] === 1).length;
    const idle0 = body.filter((t) => h.sim.idle[t] === 0).length;
    expect(idle1).toBe(searched - 1);
    expect(idle0).toBe(body.length - idle1);
    expect(h.sim.activeCount()).toBe(body.length);
    expect(h.sim.budget).toBe(0);
  });
});

describe('T-M3-02 fluids: rule 4, evaporation', () => {
  it('only isolated level-1 water evaporates; it stays active until it does (D-090)', () => {
    const h = harness('evaporate', 12, 12, 3);
    const [lone] = carve(h.map, 1, 1, 1, 1, 1) as [number];
    const pair = carve(h.map, 4, 1, 1, 2, 1);
    const [deep] = carve(h.map, 8, 1, 1, 1, 1) as [number];
    const [magma] = carve(h.map, 10, 1, 1, 1, 1) as [number];
    const [spring] = carve(h.map, 1, 5, 1, 1, 1) as [number];
    h.sim.pour(lone, 1);
    for (const t of pair) h.sim.pour(t, 1);
    h.sim.pour(deep, 2);
    h.sim.pour(magma, 1, true);
    h.sim.pour(spring, 1, false, true);
    let gone = -1;
    for (let k = 0; k < 3000 && gone < 0; k += 1) {
      h.steps(1);
      if (h.sim.level(lone) === 0) gone = k;
    }
    expect(gone).toBeGreaterThan(FLUID_SETTLE_STEPS);
    expect(h.sum(pair)).toBe(2);
    expect(h.sim.level(deep)).toBe(2);
    expect(h.sim.level(spring)).toBe(FLUID_MAX_LEVEL);
    h.steps(200, true);
    expect(h.sim.level(magma)).toBe(1);
  });

  it('an isolated puddle takes about 250 ticks (125 steps) to vanish on average', () => {
    let total = 0;
    const runs = 60;
    for (let s = 0; s < runs; s += 1) {
      const h = harness(`puddle-${s}`, 3, 3, 3);
      const [t] = carve(h.map, 1, 1, 1, 1, 1) as [number];
      h.sim.pour(t, 1);
      let k = 0;
      while (h.sim.level(t) > 0 && k < 5000) {
        h.steps(1);
        k += 1;
      }
      total += k;
    }
    const mean = total / runs;
    expect(mean).toBeGreaterThan(80);
    expect(mean).toBeLessThan(180);
  });
});

describe('T-M3-02 fluids: contact and entities', () => {
  it('water beside magma casts obsidian: a wall from OBSIDIAN_WALL_LEVEL, a floor below it; one unit of water is lost', () => {
    const h = harness('contact', 8, 4, 3);
    const row = carve(h.map, 1, 1, 1, 5, 1);
    h.map.kind[row[4] as number] = TileKind.Wall;
    const [a, water, b] = [row[0] as number, row[1] as number, row[2] as number];
    h.sim.pour(a, OBSIDIAN_WALL_LEVEL, true);
    h.sim.pour(b, OBSIDIAN_WALL_LEVEL - 1, true);
    h.sim.pour(water, 5);
    h.steps(1);
    expect(h.map.kindAt(a)).toBe(TileKind.Wall);
    expect(h.map.kindAt(b)).toBe(TileKind.Floor);
    expect(h.map.materialAt(a)).toBe(OBSIDIAN);
    expect(h.sim.level(a) + h.sim.level(b)).toBe(0);
    expect(h.events.filter((e) => e.type === 'ObsidianFormed').map((e) => e['tile'])).toEqual([a, b]);
    expect(h.sum(row)).toBe(3);
  });

  it('deep water submerges creatures, except a large one below level 7; magma touches everything on the tile', () => {
    const h = harness('entities', 8, 4, 3);
    const row = carve(h.map, 1, 1, 1, 3, 1);
    const [pond, lava] = [row[0] as number, row[2] as number];
    h.map.kind[row[1] as number] = TileKind.Wall;
    h.entities.set(pond, [10, 11, 12]);
    h.sizes.set(10, 50);
    h.sizes.set(11, WADE_LARGE_SIZE);
    h.entities.set(lava, [20, 21]);
    h.sizes.set(20, 50);
    // The fluid arrives during a step (it falls in from the open tile above), as it does in play.
    const above = (t: number): number => h.map.above(t);
    h.map.kind[above(pond)] = TileKind.Open;
    h.map.kind[above(lava)] = TileKind.Open;
    h.sim.pour(above(pond), FLUID_DEEP_LEVEL + 1);
    h.sim.pour(above(lava), 1, true);
    h.steps(1);
    h.steps(1, true);
    const sub = h.events.filter((e) => e.type === 'CreatureSubmerged');
    expect(sub.map((e) => e['id'])).toEqual([10]);
    expect(h.events.find((e) => e.type === 'MagmaContact')).toEqual({ type: 'MagmaContact', tile: lava, entities: [20, 21] });
    h.events.length = 0;
    h.sim.pour(above(pond), FLUID_MAX_LEVEL - FLUID_DEEP_LEVEL - 1);
    h.steps(1);
    expect(h.events.filter((e) => e.type === 'CreatureSubmerged').map((e) => e['id'])).toEqual([10, 11]);
  });

  it('D-089: a level change marks the chunk for relabelling only when it crosses a passability band', () => {
    const h = harness('band', 8, 4, 3);
    const [t] = carve(h.map, 1, 1, 1, 1, 1) as [number];
    const rec = h.map.chunk(h.map.chunkOf(t));
    if (rec === undefined) throw new Error('no chunk');
    const dirtied = (level: number, magma = false): boolean => {
      rec.dirtyPath = false;
      rec.dirtyRender = false;
      h.sim.pour(t, level, magma);
      expect(rec.dirtyRender).toBe(true);
      return rec.dirtyPath;
    };
    // Shallow water is as passable as an empty tile; deep water and magma are not.
    expect(dirtied(2)).toBe(false);
    expect(dirtied(3)).toBe(false);
    expect(dirtied(FLUID_DEEP_LEVEL)).toBe(true);
    expect(dirtied(FLUID_MAX_LEVEL)).toBe(false);
    expect(dirtied(1)).toBe(true);
    expect(dirtied(1, true)).toBe(true);
    expect(dirtied(0)).toBe(true);
  });
});
