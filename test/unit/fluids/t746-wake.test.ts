import { describe, it, expect } from 'vitest';
import { FLUID_MAX_LEVEL } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import { TestWorld } from '../../scenarios/test-world';
import { carve, harness, type Harness } from './harness';

/**
 * A cistern behind a floodgate, as `cistern-well.ts` lays one out, on the bare simulation: a source
 * at z 7 over an open shaft down to a feed tunnel at z 1 (x 1 … 3), then the way through (a
 * floodgate at x 4, or a stretch of rock `gap` tiles long), two tiles of tunnel on the cistern's
 * side, a 3 × 3 cistern, a well column open from z 2 to the hall's level z 6 over its middle, and
 * the hall's floor around it at z 6. Everything is full and asleep before the way opens.
 */
interface Cistern {
  readonly h: Harness;
  readonly way: TileIndex[];
  readonly column: TileIndex[];
  readonly hall: TileIndex[];
  readonly cistern: TileIndex[];
}

const Y = 2;
const HALL_Z = 6;
const SOURCE_Z = 7;

function cistern(seed: string, opts: { source: boolean; gateFull?: boolean; gap?: number }): Cistern {
  const gap = opts.gap ?? 1;
  const cx = 4 + gap + 2;
  const h = harness(seed, cx + 5, 5, 9);
  const map = h.map;
  carve(map, 1, Y, 1, 3, 1, TileKind.Floor);
  for (let z = 2; z <= SOURCE_Z; z += 1) map.kind[map.index(1, Y, z)] = TileKind.Open;
  const way: TileIndex[] = [];
  for (let x = 4; x < 4 + gap; x += 1) way.push(map.index(x, Y, 1));
  // A floodgate stands on a floor; a stretch of rock is dug when it opens.
  if (gap === 1) {
    map.kind[way[0] as TileIndex] = TileKind.Floor;
    h.fluidBlocked.add(way[0] as TileIndex);
  }
  const near = carve(map, 4 + gap, Y, 1, 2, 1, TileKind.Floor);
  const cistern = carve(map, cx, Y - 1, 1, 3, 3, TileKind.Floor);
  const hall = carve(map, cx, Y - 1, HALL_Z, 3, 3, TileKind.Floor).filter((i) => i !== map.index(cx + 1, Y, HALL_Z));
  const column: TileIndex[] = [];
  for (let z = 2; z <= HALL_Z; z += 1) {
    const i = map.index(cx + 1, Y, z);
    map.kind[i] = TileKind.Open;
    column.push(i);
  }
  if (opts.source) {
    h.sim.pour(map.index(1, Y, SOURCE_Z), FLUID_MAX_LEVEL, false, true);
    for (let z = 2; z < SOURCE_Z; z += 1) h.sim.pour(map.index(1, Y, z), FLUID_MAX_LEVEL);
  }
  for (let x = 1; x <= 3; x += 1) h.sim.pour(map.index(x, Y, 1), FLUID_MAX_LEVEL);
  for (const t of [...near, ...cistern]) h.sim.pour(t, FLUID_MAX_LEVEL);
  if (opts.gateFull === true) h.sim.pour(way[0] as TileIndex, FLUID_MAX_LEVEL);
  h.steps(200);
  return { h, way, column, hall, cistern };
}

/** What 04 does on the floodgate's `BuildingStateChanged`, or on the dug tiles' `TilesChanged`. */
function open(c: Cistern): void {
  for (const t of c.way) {
    c.h.fluidBlocked.delete(t);
    c.h.map.kind[t] = TileKind.Floor;
  }
  c.h.sim.opened(c.way);
}

const levels = (c: Cistern, tiles: readonly TileIndex[]): number[] => tiles.map((t) => c.h.sim.level(t));

describe('T-746 fluids: opening a way wakes the body it joins', () => {
  // The steps each case took to fill the column and wet the hall, with about half as much again to spare.
  for (const [gateFull, gap, within] of [[true, 1, 45], [false, 1, 60], [false, 6, 135]] as const) {
    const what = gap > 1 ? `a stretch of ${gap} tiles of rock dug out` : `the shut floodgate opened${gateFull ? ' (its tile holding water)' : ''}`;
    it(`a full cistern, ${what}: the water rises up the well column and floods the hall`, () => {
      const c = cistern(`t746-open-${gateFull}-${gap}`, { source: true, gateFull, gap });
      expect(c.h.sim.activeCount(), 'everything asleep before the way opens').toBe(0);
      expect(levels(c, c.column)).toEqual([0, 0, 0, 0, 0]);
      open(c);
      let steps = 0;
      while (steps < within && !(levels(c, c.column).slice(0, 4).every((l) => l === FLUID_MAX_LEVEL) && c.h.sum(c.hall) > 0)) {
        c.h.steps(1);
        steps += 1;
      }
      expect(levels(c, c.column).slice(0, 4), `the column full within ${within} steps`).toEqual([7, 7, 7, 7]);
      expect(c.h.sum(c.hall), 'water on the hall floor').toBeGreaterThan(0);
      // The column stops one below the source.
      c.h.steps(300);
      expect(levels(c, c.column)).toEqual([7, 7, 7, 7, 7]);
      expect(c.h.sim.level(c.h.map.above(c.column[4] as TileIndex))).toBe(0);
    });
  }

  it('the regression: a touch of the gate alone leaves the column dry', () => {
    const c = cistern('t746-touch', { source: true, gateFull: true });
    c.h.fluidBlocked.delete(c.way[0] as TileIndex);
    c.h.sim.touch(c.way[0] as TileIndex);
    c.h.steps(300);
    expect(levels(c, c.column)).toEqual([0, 0, 0, 0, 0]);
    expect(c.h.sim.activeCount()).toBe(0);
  });

  it('a tile filled by the water joins a full, sleeping cistern to the shaft: the brook let into a long feed lifts the column', () => {
    // No change opens anything here: the feed's last tile fills, and the body it joins wakes.
    const c = cistern('t746-filled', { source: false, gap: 12 });
    for (const t of c.way) c.h.map.kind[t] = TileKind.Floor;
    for (const t of c.way) c.h.sim.pour(t, FLUID_MAX_LEVEL);
    c.h.steps(200);
    for (let x = 1; x <= 3; x += 1) c.h.sim.pour(c.h.map.index(x, Y, 1), 0);
    c.h.steps(200);
    expect(c.h.sim.activeCount(), 'the cistern and its long feed asleep').toBe(0);
    c.h.sim.pour(c.h.map.index(1, Y, SOURCE_Z), FLUID_MAX_LEVEL, false, true);
    c.h.steps(600);
    expect(levels(c, c.column)).toEqual([7, 7, 7, 7, 7]);
  });

  it('a closed system stays asleep: with nothing higher than the cistern, the opened gate wakes only its neighbours', () => {
    const c = cistern('t746-closed', { source: false, gateFull: true });
    expect(c.h.sim.activeCount()).toBe(0);
    const all = [...c.cistern, ...c.column, ...c.hall, ...c.way];
    const before = c.h.sum(all);
    open(c);
    // The gate's tile and its two neighbours in the tunnel, nothing of the cistern.
    expect(c.h.sim.activeCount()).toBe(3);
    c.h.steps(40);
    expect(levels(c, c.column)).toEqual([0, 0, 0, 0, 0]);
    expect(c.h.sum(all)).toBe(before);
    expect(c.h.sim.activeCount(), 'asleep again').toBe(0);
  });

  it('in the game: a wall dug out of a feed tunnel (`TilesChanged`) wakes the cistern beyond it', () => {
    // On `flat-test`: a source over a shaft seven deep onto a tunnel of 12 tiles at z 20, its sixth
    // tile left rock, and a full 3 × 3 cistern beyond with the well's column open up to a hall at z 23.
    const w = new TestWorld({ seed: 't746', world: 'flat-test', embark: 'none' });
    const L = 20;
    const H = L + 3;
    const [Y0, FEED, WELL] = [40, 2, 16];
    const wall = w.index(FEED + 6, Y0, L);
    for (let x = FEED; x < WELL - 1; x += 1) if (w.index(x, Y0, L) !== wall) w.carve(w.index(x, Y0, L), TileKind.Floor);
    for (let z = L + 1; z <= L + 8; z += 1) w.carve(w.index(FEED, Y0, z), TileKind.Open);
    const cisternTiles: TileIndex[] = [];
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) cisternTiles.push(w.index(WELL + dx, Y0 + dy, L));
    for (const t of cisternTiles) w.carve(t, TileKind.Floor);
    const hallTiles: TileIndex[] = [];
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (dx !== 0 || dy !== 0) hallTiles.push(w.index(WELL + dx, Y0 + dy, H));
    for (const t of hallTiles) w.carve(t, TileKind.Floor);
    for (let z = L + 1; z <= H; z += 1) w.carve(w.index(WELL, Y0, z), TileKind.Open);
    for (let x = FEED + 7; x < WELL - 1; x += 1) w.setFluid(w.index(x, Y0, L), FLUID_MAX_LEVEL);
    for (const t of cisternTiles) w.setFluid(t, FLUID_MAX_LEVEL);
    w.setFluid(w.index(FEED, Y0, L + 8), FLUID_MAX_LEVEL, 'water', true);
    w.step(2000);
    const sim = w.fluids.sim;
    expect(sim.activeCount(), 'the feed and the cistern settled').toBe(0);
    expect(sim.level(w.index(WELL, Y0, L + 1))).toBe(0);
    w.carve(wall, TileKind.Floor);
    w.game.world.emit({ type: 'TilesChanged', tiles: [wall] });
    w.step(600);
    for (let z = L + 1; z <= H; z += 1) expect(sim.level(w.index(WELL, Y0, z)), `the column at z ${z}`).toBe(FLUID_MAX_LEVEL);
    expect(w.fluidSum(hallTiles), 'water in the hall').toBeGreaterThan(0);
  });
});
