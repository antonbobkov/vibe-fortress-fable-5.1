/**
 * Stage 11: discovery, outdoor and lit. `03-terrain-and-mining.md` § Local map generation
 * stage 11, § Discovery, § Outdoor and lit; `algorithms/local-map-generation.md` step 9.
 *
 * The functions work on any `Map3D`, so 03's system (T-M1-07) recomputes columns and chunks with
 * the same code after the map changes.
 */

import { TileFlag, TileKind, isSolidBottomed, type Map3D } from '@core/map3d';
import { LIGHT_SPREAD } from '../constants';

/** The light a column scan carries down: open sky, daylight through glass floors, or none. */
export const SKY = 0;
export const GLASS = 1;
const DARK = 2;

/**
 * `outdoor` and `skylit` for one column, in one pass down from the sky. A tile is outdoor when every
 * tile above it is `open`, so the open tiles and the first non-open tile are outdoor. A constructed
 * glass floor keeps the light going as an open tile does: the tiles below it that are reached
 * before the first other non-open tile (that one included) are `skylit`, not outdoor.
 */
export function computeOutdoorColumn(map: Map3D, x: number, y: number): void {
  let light = SKY;
  for (let z = map.d - 1; z >= 0; z -= 1) {
    const i = map.index(x, y, z);
    const f = map.flags[i] as number;
    const set = light === SKY ? TileFlag.Outdoor : light === GLASS ? TileFlag.Skylit : 0;
    map.flags[i] = (f & ~(TileFlag.Outdoor | TileFlag.Skylit)) | set;
    light = nextLight(map, i, light);
  }
}

/** The light below tile `i`, given the light that reached it. */
export function nextLight(map: Map3D, i: number, light: number): number {
  const kind = map.kind[i];
  if (kind === TileKind.Open || light === DARK) return light;
  return kind === TileKind.Floor && map.isGlassAt(i) ? GLASS : DARK;
}

/**
 * `lit` for one level: outdoor and skylit tiles, and open or walkable tiles within `LIGHT_SPREAD`
 * tiles horizontally (8-neighbourhood steps) of an outdoor open tile on the same level, the light
 * passing through anything that is not a wall, and through a constructed glass wall.
 */
export function computeLitLevel(map: Map3D, z: number): void {
  const n = map.w * map.h;
  const dist = new Int8Array(n).fill(-1);
  let frontier: number[] = [];
  for (let c = 0; c < n; c += 1) {
    const i = z * n + c;
    if ((map.flags[i] as number) & TileFlag.Outdoor && map.kind[i] === TileKind.Open) {
      dist[c] = 0;
      frontier.push(c);
    }
  }
  for (let step = 1; step <= LIGHT_SPREAD && frontier.length > 0; step += 1) {
    const next: number[] = [];
    for (const c of frontier) {
      const x = c % map.w;
      const y = Math.floor(c / map.w);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
          const nc = ny * map.w + nx;
          // A constructed glass wall does not stop the light (03 § Outdoor and lit).
          if (dist[nc] !== -1 || (map.kind[z * n + nc] === TileKind.Wall && !map.isGlassAt(z * n + nc))) continue;
          dist[nc] = step;
          next.push(nc);
        }
      }
    }
    frontier = next;
  }
  for (let c = 0; c < n; c += 1) {
    const i = z * n + c;
    const f = map.flags[i] as number;
    const kind = map.kind[i] as TileKind;
    const lit = (f & (TileFlag.Outdoor | TileFlag.Skylit)) !== 0 || (dist[c] !== -1 && (kind === TileKind.Open || isSolidBottomed(kind)));
    map.flags[i] = lit ? f | TileFlag.Lit : f & ~TileFlag.Lit;
  }
}

/** Mark every outdoor tile and its 26 neighbours discovered. */
export function discoverOutdoor(map: Map3D): void {
  const marks: number[] = [];
  for (let i = 0; i < map.tileCount; i += 1) if ((map.flags[i] as number) & TileFlag.Outdoor) marks.push(i);
  for (const i of marks) {
    const x = map.xOf(i);
    const y = map.yOf(i);
    const z = map.zOf(i);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!map.inBounds(x + dx, y + dy, z + dz)) continue;
          const j = map.index(x + dx, y + dy, z + dz);
          map.flags[j] = (map.flags[j] as number) | TileFlag.Discovered;
        }
      }
    }
  }
}

/** Stage 11 over the whole map. */
export function stageLight(map: Map3D): void {
  for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) computeOutdoorColumn(map, x, y);
  for (let z = 0; z < map.d; z += 1) computeLitLevel(map, z);
  discoverOutdoor(map);
}
