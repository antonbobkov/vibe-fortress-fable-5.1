/** T-416: the drink search reads the fluid bytes row by row and chooses exactly what the tile-by-tile scan chose. */
import { describe, expect, it } from 'vitest';
import type { TickContext } from '@core/system';
import { FLUID_FROZEN_BIT, FluidType, TileFlag, TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import { DRINK_SEARCH_RADIUS } from '@systems/dwarves/constants';
import { water } from '@systems/dwarves/activities';
import { Z_DISTANCE_WEIGHT } from '@systems/jobs/constants';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

/** The search as it was before T-416, tile by tile through the map's accessors: the reference. */
function reference(ctx: TickContext, from: TileIndex, allowed: (t: TileIndex) => boolean): TileIndex {
  const m = ctx.world.map;
  const reachable = (a: TileIndex, b: TileIndex): boolean => ctx.readers.pathing.passable(b, 'walker') && ctx.readers.pathing.reachable(a, b, 'walker');
  const fx = m.xOf(from), fy = m.yOf(from), fz = m.zOf(from);
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  const dzs = [0];
  for (let s = 1; s <= 8; s += 1) dzs.push(-s, s);
  for (const dz of dzs) {
    const near = dz < 0 ? Math.abs(dz) - 1 : Math.abs(dz);
    if ((Math.abs(dz) - 1) * Z_DISTANCE_WEIGHT > bestDistance) break;
    const z = fz + dz;
    if (z < 0 || z >= m.d) continue;
    for (let dy = -DRINK_SEARCH_RADIUS; dy <= DRINK_SEARCH_RADIUS; dy += 1) {
      const wy = fy + dy;
      if (wy < 0 || wy >= m.h) continue;
      for (let dx = -DRINK_SEARCH_RADIUS; dx <= DRINK_SEARCH_RADIUS; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) - 1 + near * Z_DISTANCE_WEIGHT > bestDistance) continue;
        const wx = fx + dx;
        if (wx < 0 || wx >= m.w) continue;
        const wt = m.index(wx, wy, z);
        if (m.fluidLevelAt(wt) < 1 || m.fluidTypeAt(wt) !== FluidType.Water || m.fluidFrozenAt(wt)) continue;
        const over = z + 1 < m.d ? m.index(wx, wy, z + 1) : -1;
        const fromAbove = over >= 0 && m.kindAt(over) === TileKind.Open && m.fluidLevelAt(over) === 0;
        for (const sz of fromAbove ? [z, z + 1] : [z]) {
          for (let sy = wy - 1; sy <= wy + 1; sy += 1) {
            if (sy < 0 || sy >= m.h) continue;
            for (let sx = wx - 1; sx <= wx + 1; sx += 1) {
              if (sx < 0 || sx >= m.w || (sx === wx && sy === wy)) continue;
              const st = m.index(sx, sy, sz);
              const d = Math.max(Math.abs(sx - fx), Math.abs(sy - fy)) + Math.abs(sz - fz) * Z_DISTANCE_WEIGHT;
              if (!reachable(from, st) || !allowed(st)) continue;
              if (d < bestDistance || (d === bestDistance && (best < 0 || st < best))) { best = st; bestDistance = d; }
            }
          }
        }
      }
    }
  }
  return best;
}

describe('T-416 the row scan of the drink search keeps its choice', () => {
  it('chooses the same stand tile as the tile-by-tile scan from every walkable start, with frozen, magma and buried water about', () => {
    const w = new TestWorld({ seed: 't416-scan', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    // A brook one level down with open air over it (drunk from its bank), from (56, 10) to (56, 14).
    for (let y = 10; y <= 14; y += 1) {
      const cut = w.index(56, y, Z);
      w.carve(cut, TileKind.Open);
      w.map.setFlag(cut, TileFlag.Outdoor, true);
      w.carve(w.index(56, y, Z - 1), TileKind.Floor);
      w.setFluid(w.index(56, y, Z - 1), 7, 'water', true);
    }
    // A puddle on the surface, a frozen pool and a magma pool, each a tie or a near miss for some starts.
    w.setFluid(w.index(20, 40, Z), 1, 'water', false);
    for (const x of [30, 31]) w.setFluid(w.index(x, 20, Z), 4, 'water', false);
    w.map.fluid[w.index(31, 20, Z)] = ((w.map.fluid[w.index(31, 20, Z)] ?? 0) as number) | FLUID_FROZEN_BIT;
    w.setFluid(w.index(44, 44, Z), 4, 'magma', false);
    // Water two levels down, reached by no stair: never a stand tile.
    w.carve(w.index(10, 10, Z - 2), TileKind.Floor);
    w.setFluid(w.index(10, 10, Z - 2), 7, 'water', false);
    w.step(1);
    const ctx = { world: w.game.world, readers: w.readers, registry: w.game.registry, tick: w.tick } as unknown as TickContext;
    const allowed = (): boolean => true;
    let found = 0;
    let compared = 0;
    for (let y = 2; y < w.map.h - 2; y += 7) {
      for (let x = 2; x < w.map.w - 2; x += 7) {
        const from = w.index(x, y, Z);
        if (!w.readers.pathing.passable(from, 'walker')) continue;
        const expected = reference(ctx, from, allowed);
        expect(water(ctx, from, allowed), `from (${x}, ${y})`).toBe(expected);
        compared += 1;
        if (expected >= 0) found += 1;
      }
    }
    expect(compared).toBeGreaterThan(50);
    expect(found).toBeGreaterThan(20);
    // And a start with no water in reach at all.
    const dry = new TestWorld({ seed: 't416-dry', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    dry.step(1);
    const dctx = { world: dry.game.world, readers: dry.readers, registry: dry.game.registry, tick: dry.tick } as unknown as TickContext;
    expect(water(dctx, dry.index(30, 30, Z), allowed)).toBe(reference(dctx, dry.index(30, 30, Z), allowed));
  });
});
