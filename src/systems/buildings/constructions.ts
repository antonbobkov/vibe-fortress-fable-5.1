/**
 * Constructions and placement rules: `02-systems/14-buildings-and-rooms.md` § Placement step 1,
 * § Constructions, and `03-content/buildings-and-furniture.md` § Constructions (the `on` column).
 */

import { TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { TileIndex } from '@core/types';
import { isSupportKind } from '@systems/terrain';
import { WELL_DEPTH } from './constants';

/** `14` § Constructions: the tile kind each construction becomes. */
export const CONSTRUCTION_KIND: Readonly<Record<string, TileKind>> = Object.freeze({
  wall: TileKind.Wall,
  floor: TileKind.Floor,
  paved_floor: TileKind.Floor,
  ramp: TileKind.Ramp,
  stairs_up: TileKind.StairsUp,
  stairs_down: TileKind.StairsDown,
  stairs_updown: TileKind.StairsUpDown,
  fortification: TileKind.Fortification,
});

/** The `on` rules, by building id; every other row is "floor" (workshops, traps, mechanisms). */
export type OnRule =
  | 'floor'
  | 'floor_or_open_supported'
  | 'floor_adjacent_wall'
  | 'floor_over_open'
  | 'floor_between_walls'
  | 'stairs_down_or_ramp_top'
  | 'open_water_below'
  | 'never';

const ON_RULES: Readonly<Record<string, OnRule>> = Object.freeze({
  wall: 'floor_or_open_supported',
  floor: 'floor_or_open_supported',
  paved_floor: 'floor',
  ramp: 'floor_adjacent_wall',
  stairs_up: 'floor',
  stairs_down: 'floor_over_open',
  stairs_updown: 'floor_over_open',
  fortification: 'floor',
  door: 'floor_between_walls',
  hatch: 'stairs_down_or_ramp_top',
  well: 'open_water_below',
  // "placed at embark only".
  wagon: 'never',
  // The drawbridge's own footprint rule belongs to its task (M6, `bd_bridge`; D-073).
  drawbridge: 'never',
});

export function onRuleOf(id: string): OnRule {
  return ON_RULES[id] ?? 'floor';
}

/** "any of its six face-adjacent tiles is `wall`, `floor`, `ramp`, `stairs_*`, `fortification` or `tree`". */
function supported(map: Map3D, i: TileIndex): boolean {
  for (const n of map.neighbors6(i)) if (isSupportKind(map.kindAt(n))) return true;
  return false;
}

function sameLevelNeighbours4(map: Map3D, i: TileIndex): TileIndex[] {
  const out: TileIndex[] = [];
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const) {
    const n = map.offset(i, dx, dy, 0);
    if (n >= 0) out.push(n);
  }
  return out;
}

/** Whether one footprint tile satisfies the type's `on` rule. */
export function onRuleHolds(map: Map3D, rule: OnRule, i: TileIndex): boolean {
  const kind = map.kindAt(i);
  switch (rule) {
    case 'floor':
      return kind === TileKind.Floor;
    case 'floor_or_open_supported':
      return kind === TileKind.Floor || (kind === TileKind.Open && supported(map, i));
    case 'floor_adjacent_wall':
      return kind === TileKind.Floor && sameLevelNeighbours4(map, i).some((n) => map.kindAt(n) === TileKind.Wall);
    case 'floor_over_open': {
      const below = map.below(i);
      return kind === TileKind.Floor && below >= 0 && map.kindAt(below) === TileKind.Open;
    }
    case 'floor_between_walls': {
      if (kind !== TileKind.Floor) return false;
      const w = (dx: number, dy: number): boolean => {
        const n = map.offset(i, dx, dy, 0);
        return n >= 0 && map.kindAt(n) === TileKind.Wall;
      };
      return (w(-1, 0) && w(1, 0)) || (w(0, -1) && w(0, 1));
    }
    case 'stairs_down_or_ramp_top': {
      if (kind === TileKind.StairsDown || kind === TileKind.StairsUpDown) return true;
      // A ramp top: the open tile above a ramp.
      const below = map.below(i);
      return kind === TileKind.Open && below >= 0 && map.kindAt(below) === TileKind.Ramp;
    }
    case 'open_water_below': {
      if (kind !== TileKind.Open) return false;
      let cur = i;
      for (let d = 1; d <= WELL_DEPTH; d += 1) {
        cur = map.below(cur);
        if (cur < 0) return false;
        if (map.fluidLevelAt(cur) > 0 && map.fluidTypeAt(cur) === 0) return true;
        if (map.kindAt(cur) !== TileKind.Open) return false;
      }
      return false;
    }
    case 'never':
      return false;
    default:
      return false;
  }
}

/** Whether a construction is stood on by its builder (`at`) or built from beside it (`adjacent`). */
export function standsAt(id: string, map: Map3D, origin: TileIndex): boolean {
  const onFloorKinds = ['floor', 'paved_floor', 'stairs_up', 'stairs_down', 'stairs_updown'];
  return onFloorKinds.includes(id) && map.kindAt(origin) === TileKind.Floor;
}

/** Flags a finished construction sets and clears on its tile (`paved_floor` "clears grass and mud"). */
export function constructionFlags(id: string): { set: number; clear: number } {
  if (id === 'paved_floor') return { set: TileFlag.Constructed, clear: TileFlag.Grass | TileFlag.Mud };
  return { set: TileFlag.Constructed, clear: TileFlag.Smoothed | TileFlag.Engraved };
}
