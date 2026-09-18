/**
 * `tr_discovery` of `04-implementation/acceptance-tests.md` § 03 Terrain: "dig toward an
 * undiscovered cavern | `CavernBreached` on the first open cavern tile; the connected cavern region
 * is discovered".
 *
 * A generated local map (the flat-test region of D-046, with its caverns). Setup finds an open,
 * unseen tile O of cavern one with rock W beside it and rock S beyond, S's column solid up to the
 * surface and every tile around the shaft rock; a finished stair shaft is laid down S's column,
 * and W is designated for digging. The miner walks down the shaft and digs W, which opens onto O.
 */

import { expect } from 'vitest';
import { CAVERN_1_Z_MAX, CAVERN_1_Z_MIN } from '@core/constants';
import { TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { Scenario } from './runner';
import { onlyMiner, stairShaft } from './m1-helpers';

function rock(kind: TileKind): boolean {
  return kind === TileKind.Wall || kind === TileKind.Boulder || kind === TileKind.Fortification;
}

interface Site {
  o: TileIndex;
  w: TileIndex;
  sx: number;
  sy: number;
  z: number;
  top: number;
}

/** The first site in (z descending, y, x) order. */
function findSite(map: Map3D): Site {
  for (let z = CAVERN_1_Z_MAX; z >= CAVERN_1_Z_MIN; z -= 1) {
    for (let y = 8; y < map.h - 8; y += 1) {
      for (let x = 8; x < map.w - 8; x += 1) {
        const o = map.index(x, y, z);
        if (rock(map.kindAt(o)) || map.hasFlag(o, TileFlag.Discovered) || map.fluidLevelAt(o) > 0) continue;
        const w = map.index(x - 1, y, z);
        if (map.kindAt(w) !== TileKind.Wall) continue;
        const sx = x - 2;
        const top = map.columnSurfaceZ(sx, y);
        const surface = map.index(sx, y, top);
        if (map.kindAt(surface) !== TileKind.Floor || map.fluidLevelAt(surface) > 0) continue;
        let ok = true;
        for (let zz = z; zz < top && ok; zz += 1) {
          const s = map.index(sx, y, zz);
          if (map.kindAt(s) !== TileKind.Wall) ok = false;
          for (const n of map.neighbors26(s)) {
            if (n === w || (map.xOf(n) === sx && map.yOf(n) === y)) continue;
            if (map.zOf(n) >= top) continue;
            if (!rock(map.kindAt(n))) ok = false;
          }
        }
        if (ok) return { o, w, sx, sy: y, z, top };
      }
    }
  }
  throw new Error('tr_discovery: no site found');
}

/** The band's open region face-connected to `start`. */
function region(map: Map3D, start: TileIndex): TileIndex[] {
  const seen = new Set<number>([start]);
  const queue = [start];
  const out: TileIndex[] = [];
  while (queue.length > 0) {
    const t = queue.shift() as TileIndex;
    out.push(t);
    for (const n of map.neighbors6(t)) {
      const z = map.zOf(n);
      if (seen.has(n) || z < CAVERN_1_Z_MIN || z > CAVERN_1_Z_MAX || rock(map.kindAt(n))) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return out;
}

let site: Site | null = null;

const scenario: Scenario = {
  id: 'tr_discovery',
  milestone: 1,
  seed: 'tr-discovery',
  world: { region: {} },
  embark: 'default',
  setup: (w) => {
    site = findSite(w.map);
    stairShaft(w, site.sx, site.sy, site.top, site.z);
    onlyMiner(w);
    const r = w.game.world.applyCommand({ type: 'Designate', tiles: [site.w], kind: 'dig' });
    if (!r.ok) throw new Error(`designate: ${r.reason}`);
  },
  run: (w) => {
    w.until((world) => world.events('CavernBreached').length > 0, 8_000);
    w.step(1);
  },
  expect: (w) => {
    const s = site as Site;
    const breach = w.events('CavernBreached');
    expect(breach).toHaveLength(1);
    expect(breach[0]?.['cavern']).toBe(1);
    expect(w.map.kindAt(s.w)).toBe(TileKind.Floor);
    // The breach tile is the first open cavern tile beside the dug one.
    expect(w.map.neighbors26(s.w)).toContain(breach[0]?.['tile']);
    const tiles = region(w.map, s.o);
    expect(tiles.length).toBeGreaterThan(1);
    for (const t of tiles) expect(w.map.hasFlag(t, TileFlag.Discovered)).toBe(true);
    expect(w.events('TilesDiscovered').length).toBeGreaterThan(0);
  },
};

export default scenario;
