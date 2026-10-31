/**
 * T-449: a river in a cut has drinking steps, and both inflows of a river keep their source marks
 * (`03-terrain-and-mining.md` § Local map generation stages 2 and 9).
 */

import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { LOCAL_MAP_Z } from '@core/constants';
import { Map3D, TileKind } from '@core/map3d';
import { FLAT_TEST_SPEC } from '@app/headless';
import type { LocalMapSpec } from '@systems/embark';
import { DRINK_STEP_SPACING } from '@systems/terrain/constants';
import { newLocalGen } from '@systems/terrain/generate';
import { COL_LAKE, COL_RIVER, COL_SOURCE, type LocalGen } from '@systems/terrain/generate/common';
import { edgePoint, stageRivers } from '@systems/terrain/generate/rivers';
import { stageRamps } from '@systems/terrain/generate/surface';

const registry = contentRegistry();
const HIGH = 40;
const LOW = 34;

function gen(seed: string, size: number, river: LocalMapSpec['river'], relief: 0 | 1 = 1): LocalGen {
  const spec: LocalMapSpec = { ...FLAT_TEST_SPEC, seed, traits: [], relief, river };
  return newLocalGen(spec, new Map3D(size, size, LOCAL_MAP_Z), registry);
}

const wet = (g: LocalGen, c: number): boolean => ((g.colFlags[c] as number) & (COL_RIVER | COL_LAKE)) !== 0;

/** High ground crossed by one strip of low ground, so the river runs in a deep cut either side of it. */
function cutMap(seed: string, inflow: 'w' | 'n', outflow: 'e' | 's'): LocalGen {
  const g = gen(seed, 48, { inflowEdges: [inflow], outflowEdge: outflow, class: 'brook' });
  g.heights.fill(HIGH);
  for (let k = 0; k < 48; k += 1) g.heights[inflow === 'w' ? k * 48 + 30 : 30 * 48 + k] = LOW;
  stageRivers(g);
  return g;
}

/** Whether walking the column heights in steps of at most one level gets from a column to the ground: the high ground, or the low strip a lane may meet first. */
function climbsOut(g: LocalGen, start: number, strip: (c: number) => boolean): boolean {
  const seen = new Set([start]);
  const todo = [start];
  while (todo.length > 0) {
    const c = todo.pop() as number;
    if (g.heights[c] === HIGH || strip(c)) return true;
    const x = c % g.w;
    for (const n of [x > 0 ? c - 1 : -1, x < g.w - 1 ? c + 1 : -1, c - g.w, c + g.w]) {
      if (n < 0 || n >= g.w * g.h || seen.has(n) || wet(g, n)) continue;
      if (Math.abs((g.heights[n] as number) - (g.heights[c] as number)) > 1) continue;
      seen.add(n);
      todo.push(n);
    }
  }
  return false;
}

describe('T-449 drinking steps', () => {
  for (const [inflow, outflow] of [['w', 'e'], ['n', 's']] as const) {
    it(`a brook from ${inflow} to ${outflow} in a cut has steps on both banks that climb out, one level at a time`, () => {
      for (const seed of ['t449-steps-a', 't449-steps-b', 't449-steps-c']) {
        const g = cutMap(seed, inflow, outflow);
        const lowStrip = (c: number): boolean => (inflow === 'w' ? c % 48 === 30 : Math.floor(c / 48) === 30);
        const steps: number[] = [];
        for (let c = 0; c < g.w * g.h; c += 1) {
          if (wet(g, c) || lowStrip(c) || g.heights[c] !== LOW) continue;
          const x = c % 48;
          const beside = [x > 0 ? c - 1 : -1, x < 47 ? c + 1 : -1, c - 48, c + 48].some((n) => n >= 0 && n < 48 * 48 && wet(g, n));
          if (beside) steps.push(c);
        }
        // A step on each bank every DRINK_STEP_SPACING tiles of a path at least as long as the map is wide.
        expect(steps.length, seed).toBeGreaterThanOrEqual(Math.floor(48 / DRINK_STEP_SPACING));
        for (const c of steps) expect(climbsOut(g, c, lowStrip), `${seed}: the step at column ${c}`).toBe(true);
        const across = new Set(steps.map((c) => (inflow === 'w' ? Math.sign(Math.floor(c / 48) - 24) : Math.sign((c % 48) - 24))));
        expect(across.size, `${seed}: both banks`).toBeGreaterThanOrEqual(2);
      }
    });
  }

  it('from relief 1 a step grows nothing and holds no boulder; on level ground it changes nothing', () => {
    const g = cutMap('t449-steps-a', 'w', 'e');
    expect(g.bare.some((b) => b === 1)).toBe(true);
    const level = gen('t449-steps-a', 48, { inflowEdges: ['w'], outflowEdge: 'e', class: 'brook' }, 0);
    level.heights.fill(HIGH);
    stageRivers(level);
    expect(level.bare.every((b) => b === 0)).toBe(true);
    for (let c = 0; c < level.w * level.h; c += 1) if (!wet(level, c)) expect(level.heights[c]).toBe(HIGH);
  });

});

describe('T-454 a slope of several steps can be walked', () => {
  const size = 12;
  const material = registry.table('materials').index('granite');
  /** Ground stepping up one level a column along x = 5 or y = 5, in the direction (dx, dy). */
  function slope(dx: number, dy: number): { g: LocalGen; columns: number[] } {
    const g = gen('t454-ramps', size, null);
    g.heights.fill(HIGH);
    const columns: number[] = [];
    for (let k = 0; k <= 4; k += 1) {
      const x = dx === 0 ? 5 : 6 - dx * (3 - k);
      const y = dy === 0 ? 5 : 6 - dy * (3 - k);
      const c = y * size + x;
      g.heights[c] = HIGH - 5 + k;
      columns.push(c);
    }
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      const top = g.heights[y * size + x] as number;
      for (let z = 0; z < top; z += 1) g.map.setKind(g.map.index(x, y, z), TileKind.Wall, material);
      g.map.setKind(g.map.index(x, y, top), TileKind.Floor, material);
    }
    stageRamps(g);
    return { g, columns };
  }

  for (const [name, dx, dy] of [['north', 0, -1], ['west', -1, 0], ['south', 0, 1], ['east', 1, 0]] as const) {
    it(`climbing ${name}, every step is a ramp`, () => {
      const { g, columns } = slope(dx, dy);
      for (const c of columns) expect(g.map.kindAt(g.map.index(c % size, Math.floor(c / size), g.heights[c] as number)), `column ${c}`).toBe(TileKind.Ramp);
    });
  }
});

describe('T-449 source marks', () => {
  it('every inflow keeps the source marks of its edge tiles where another inflow has carved them', () => {
    const size = 5;
    for (let s = 0; s < 10; s += 1) {
      const g = gen(`t449-sources-${s}`, size, { inflowEdges: ['n', 'w'], outflowEdge: 'e', class: 'major' }, 0);
      g.heights.fill(HIGH);
      stageRivers(g);
      for (const edge of ['n', 'w'] as const) {
        const p = edgePoint(size, size, edge);
        const c = p.y * size + p.x;
        expect((g.colFlags[c] as number) & COL_SOURCE, `seed ${s}, edge ${edge}`).toBe(COL_SOURCE);
      }
      // Every wet column on an inflow edge within the band of its midpoint is a source.
      for (let k = -2; k <= 2; k += 1) {
        const mid = Math.floor(size / 2) + k;
        expect((g.colFlags[mid] as number) & COL_SOURCE, `seed ${s}, north edge ${mid}`).toBe(COL_SOURCE);
        expect((g.colFlags[mid * size] as number) & COL_SOURCE, `seed ${s}, west edge ${mid}`).toBe(COL_SOURCE);
      }
    }
  });
});
