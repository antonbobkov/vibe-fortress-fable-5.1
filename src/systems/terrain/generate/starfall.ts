/**
 * Stage 10, the `starfall` crater: `03-terrain-and-mining.md` § Local map generation stage 10;
 * `algorithms/local-map-generation.md` step 8; the trait's row in `regions-biomes-and-traits.md`
 * § Region traits. Run last in the stage, after the conversions, on its own stream
 * (`terrain.starfall`): a map without the trait draws nothing, and every other stream of a map with
 * it draws what it drew without it, so only the crater's ground changes.
 */

import { TileFlag, TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import { CRATER_EDGE_DISTANCE, CRATER_RADIUS_MAX, CRATER_RADIUS_MIN, CRATER_WYRMTONGUE_PERMILLE } from '../constants';
import { COL_LAKE, COL_RIVER, hasTrait, materialIndex, stageStream, type LocalGen, type SpawnEntry } from './common';

/** The trait whose map has the crater. */
export const STARFALL = 'starfall';
/** The meteorite's material: one boulder a map, the only one (`minerals-and-metals.md` § Ores). */
export const STAR_IRON = 'star_iron';
/** The crater floor's material, ash for good (07 § Ash). */
export const CRATER_FLOOR = 'ash_soil';
/** The plant that grows wild on the crater floor (`plants.md`). */
export const CRATER_PLANT = 'wild_wyrmtongue';

const CARDINALS: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Inward distance of a column from the arrival edge. */
function inward(g: LocalGen, x: number, y: number): number {
  const e = g.spec.arrivalEdge;
  return e === 'n' ? y : e === 's' ? g.h - 1 - y : e === 'w' ? x : g.w - 1 - x;
}

function wet(g: LocalGen, c: number): boolean {
  return ((g.colFlags[c] as number) & (COL_RIVER | COL_LAKE)) !== 0 || (g.waterTop[c] as number) > 0;
}

/** The surface kinds a crater may take: natural ground, not a stair, a pit or a building's tile. */
const NATURAL_SURFACE: readonly TileKind[] = [TileKind.Floor, TileKind.Ramp, TileKind.Tree, TileKind.Sapling, TileKind.Shrub, TileKind.Boulder];

/**
 * A centre fits a crater of radius `r` when its surface tile is a dry `floor`; every column within
 * `r + 2` is dry, with no fluid from two levels below the centre's surface up to its own surface
 * (the crater and the meteorite's pocket stay out of water and magma); and every column within `r`
 * stands no lower than one level below the centre, so the crater is only ever dug, never filled,
 * with natural ground on top and solid rock or soil from two levels below the centre up to it (no
 * sunken hall's stair or room is cut open).
 */
function fits(g: LocalGen, x: number, y: number, r: number): boolean {
  const map = g.map;
  const c = y * g.w + x;
  const zc = g.heights[c] as number;
  const centre = map.index(x, y, zc);
  if (map.kindAt(centre) !== TileKind.Floor || map.fluidLevelAt(centre) > 0) return false;
  const reach = r + 2;
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const d2 = dx * dx + dy * dy;
      if (d2 > reach * reach) continue;
      const nc = (y + dy) * g.w + x + dx;
      if (wet(g, nc)) return false;
      const top = g.heights[nc] as number;
      if (d2 <= r * r) {
        if (top < zc - 1) return false;
        if (!NATURAL_SURFACE.includes(map.kindAt(map.index(x + dx, y + dy, top)))) return false;
        for (let z = zc - 2; z < top; z += 1) if (map.kindAt(map.index(x + dx, y + dy, z)) !== TileKind.Wall) return false;
      }
      for (let z = Math.max(0, zc - 2); z <= Math.max(top, zc); z += 1) {
        if (map.fluidLevelAt(map.index(x + dx, y + dy, z)) > 0) return false;
      }
    }
  }
  return true;
}

/** The centres that fit radius `r`, in column order, `CRATER_EDGE_DISTANCE` from the arrival edge. */
function centres(g: LocalGen, r: number): number[] {
  const out: number[] = [];
  const margin = CRATER_RADIUS_MAX + 2;
  for (let y = margin; y < g.h - margin; y += 1) {
    for (let x = margin; x < g.w - margin; x += 1) {
      if (inward(g, x, y) < CRATER_EDGE_DISTANCE) continue;
      if (fits(g, x, y, r)) out.push(y * g.w + x);
    }
  }
  return out;
}

/**
 * `starfall`: a crater of radius `CRATER_RADIUS_MIN`–`CRATER_RADIUS_MAX` (a smaller one where the
 * drawn radius fits nowhere), its floor one level below the centre's surface and of `ash_soil`,
 * ramps where its rim is one level away, wild wyrmtongue on `CRATER_WYRMTONGUE_PERMILLE` of its
 * floor, and one `boulder` of `star_iron` one level below the centre. The crater's walkable tiles
 * are recorded in `craterTiles`.
 */
export function stageStarfall(g: LocalGen): void {
  if (!hasTrait(g, STARFALL)) return;
  const st = stageStream(g.s, 'terrain.starfall');
  const map = g.map;
  let r = st.int(CRATER_RADIUS_MIN, CRATER_RADIUS_MAX);
  let found = centres(g, r);
  while (found.length === 0 && r > CRATER_RADIUS_MIN) {
    r -= 1;
    found = centres(g, r);
  }
  if (found.length === 0) return;
  const centre = st.pick(found);
  const cx = centre % g.w;
  const cy = Math.floor(centre / g.w);
  const zf = (g.heights[centre] as number) - 1;
  const ash = materialIndex(g, CRATER_FLOOR);
  const inside = new Uint8Array(g.w * g.h);

  // Lower every column within the radius to the floor: what stood above it is opened.
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx;
      const y = cy + dy;
      const c = y * g.w + x;
      const top = g.heights[c] as number;
      for (let z = zf + 1; z <= top; z += 1) {
        const i = map.index(x, y, z);
        map.kind[i] = TileKind.Open;
        map.material[i] = 0;
        map.fluid[i] = 0;
        map.flags[i] = 0;
      }
      const floor = map.index(x, y, zf);
      map.kind[floor] = TileKind.Floor;
      map.material[floor] = ash;
      map.fluid[floor] = 0;
      map.flags[floor] = 0;
      g.heights[c] = zf;
      inside[c] = 1;
    }
  }

  // The ring of ramps: wherever the crater's edge and the ground beside it are one level apart,
  // the lower of the two leans on the higher.
  for (let dy = -r; dy <= r; dy += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      const x = cx + dx;
      const y = cy + dy;
      const c = y * g.w + x;
      if (inside[c] !== 1) continue;
      for (const [ox, oy] of CARDINALS) {
        const nc = (y + oy) * g.w + x + ox;
        if (inside[nc] === 1) continue;
        const top = g.heights[nc] as number;
        if (top === zf + 1) {
          const i = map.index(x, y, zf);
          if (map.kindAt(i) === TileKind.Floor) map.kind[i] = TileKind.Ramp;
        } else if (top === zf - 1) {
          const i = map.index(x + ox, y + oy, top);
          if (map.kindAt(i) === TileKind.Floor && map.fluidLevelAt(i) === 0) {
            map.kind[i] = TileKind.Ramp;
            map.flags[i] = (map.flags[i] as number) & ~(TileFlag.Grass | TileFlag.Snow);
          }
        }
      }
    }
  }

  // Wild wyrmtongue on the floor (not on the ramps), on the same stream, in column order.
  const plant = materialIndex(g, CRATER_PLANT);
  const tiles: TileIndex[] = [];
  for (let y = cy - r; y <= cy + r; y += 1) {
    for (let x = cx - r; x <= cx + r; x += 1) {
      if (inside[y * g.w + x] !== 1) continue;
      const i = map.index(x, y, zf);
      if (map.kindAt(i) === TileKind.Floor && st.chance(CRATER_WYRMTONGUE_PERMILLE)) {
        map.kind[i] = TileKind.Shrub;
        map.material[i] = plant;
      }
      tiles.push(i);
    }
  }

  // The meteorite, in a pocket one level below the centre's floor.
  const pocket = map.index(cx, cy, zf - 1);
  map.kind[pocket] = TileKind.Boulder;
  map.material[pocket] = materialIndex(g, STAR_IRON);
  map.fluid[pocket] = 0;
  map.flags[pocket] = 0;

  tiles.sort((a, b) => a - b);
  for (const i of tiles) g.craterTiles.push(i);

  // An item or creature the other traits left on ground the crater took lies on its floor.
  for (let k = 0; k < g.spawns.length; k += 1) {
    const s = g.spawns[k] as SpawnEntry;
    const x = map.xOf(s.tile);
    const y = map.yOf(s.tile);
    if (inside[y * g.w + x] === 1 && map.zOf(s.tile) > zf) g.spawns[k] = { ...s, tile: map.index(x, y, zf) };
  }
}
