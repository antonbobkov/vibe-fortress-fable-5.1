/**
 * The designation transition table of `02-systems/03-terrain-and-mining.md` § Tile transitions
 * (what designations do), as pure rules over a `Map3D`: the precondition of each designation and
 * the tile changes and item drop its completion makes.
 *
 * The rules never write the map. `apply` returns the list of changes; 03's terrain API performs
 * them, so support, discovery and the outdoor/lit flags follow every change the same way
 * (`03` § Fluids and constructions interplay: "Every such call goes through the same support and
 * discovery updates as designation work").
 */

import { Designation, TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { TileIndex } from '@core/types';

/** `03` § Reader `materialClassAt`: stone, soil, ore, gem, ice, wood, constructed. */
export type MaterialClass = 'stone' | 'soil' | 'ore' | 'gem' | 'ice' | 'wood' | 'constructed' | 'other';

/** What the rules need to know about materials and plants, from the registry. */
export interface MaterialFacts {
  /** The class of a tile material (a material index); `other` for air and unknown rows. */
  classOf(material: number): MaterialClass;
  /** True for the deepsilver mineral (`minerals-and-metals.md`, the `deepsilver` flag). */
  isDeepsilver(material: number): boolean;
}

/** An item a transition owes the world: `type` and `material` are content ids. */
export interface DropSpec {
  readonly type: string;
  /** A material index, or a content id resolved by the caller. */
  readonly material: number | string;
  readonly count: number;
  /** Where the item appears (before the "nearest walkable tile" rule for open tiles). */
  readonly tile: TileIndex;
}

/** One tile change: a new kind and material, and flags to set or clear. */
export interface TileChange {
  readonly tile: TileIndex;
  readonly kind?: TileKind;
  readonly material?: number;
  readonly set?: number;
  readonly clear?: number;
}

/** The designation kinds 03 owns (`harvest` is 07's `DesignateHarvest`). */
export const TERRAIN_DESIGNATIONS: readonly Designation[] = [
  Designation.Dig,
  Designation.Channel,
  Designation.StairsUp,
  Designation.StairsDown,
  Designation.StairsUpDown,
  Designation.Ramp,
  Designation.Smooth,
  Designation.Engrave,
  Designation.Remove,
  Designation.Chop,
  Designation.Gather,
];

/** The names the UI and scenarios use for designation kinds (`data-model.md` § Designations). */
export const DESIGNATION_NAMES: Readonly<Record<string, Designation>> = Object.freeze({
  dig: Designation.Dig,
  channel: Designation.Channel,
  stairs_up: Designation.StairsUp,
  stairs_down: Designation.StairsDown,
  stairs_updown: Designation.StairsUpDown,
  ramp: Designation.Ramp,
  smooth: Designation.Smooth,
  engrave: Designation.Engrave,
  remove: Designation.Remove,
  chop: Designation.Chop,
  gather: Designation.Gather,
  harvest: Designation.Harvest,
});

/** The kinds a `remove` or the support rule treats as constructions (`03` § Support and collapse). */
export function isStructuralKind(kind: TileKind): boolean {
  return (
    kind === TileKind.Wall ||
    kind === TileKind.Floor ||
    kind === TileKind.Ramp ||
    kind === TileKind.StairsUp ||
    kind === TileKind.StairsDown ||
    kind === TileKind.StairsUpDown ||
    kind === TileKind.Fortification
  );
}

/**
 * `03` § Support and collapse: "any of its six face-adjacent tiles is `wall`, `floor`, `ramp`,
 * `stairs_*`, `fortification` or `tree` (natural or constructed)".
 */
export function isSupportKind(kind: TileKind): boolean {
  return isStructuralKind(kind) || kind === TileKind.Tree;
}

function constructed(map: Map3D, i: TileIndex): boolean {
  return map.hasFlag(i, TileFlag.Constructed);
}

/** `smooth`: "natural `wall` or `floor` of stone" (material class `stone`). */
function smoothable(map: Map3D, i: TileIndex, facts: MaterialFacts): boolean {
  const kind = map.kindAt(i);
  if (kind !== TileKind.Wall && kind !== TileKind.Floor) return false;
  if (constructed(map, i) || map.hasFlag(i, TileFlag.Smoothed)) return false;
  return facts.classOf(map.materialAt(i)) === 'stone';
}

/**
 * The precondition column of the table. `harvest` is not a terrain designation (07), so it never
 * passes here.
 */
export function precondition(map: Map3D, i: TileIndex, kind: Designation, facts: MaterialFacts): boolean {
  if (!map.validIndex(i)) return false;
  const k = map.kindAt(i);
  switch (kind) {
    case Designation.Dig:
      return (k === TileKind.Wall || k === TileKind.Boulder) && !constructed(map, i);
    case Designation.Channel:
      return (
        k === TileKind.Floor ||
        k === TileKind.Ramp ||
        k === TileKind.Sapling ||
        k === TileKind.Shrub ||
        k === TileKind.StairsDown
      );
    case Designation.StairsUp:
    case Designation.StairsUpDown:
      return k === TileKind.Wall;
    case Designation.StairsDown:
      return k === TileKind.Floor;
    case Designation.Ramp: {
      if (k !== TileKind.Wall) return false;
      const up = map.above(i);
      if (up < 0) return false;
      const ku = map.kindAt(up);
      return ku === TileKind.Open || ku === TileKind.Floor;
    }
    case Designation.Smooth:
      return smoothable(map, i, facts);
    case Designation.Engrave:
      return map.hasFlag(i, TileFlag.Smoothed) && !map.hasFlag(i, TileFlag.Engraved);
    case Designation.Remove:
      return constructed(map, i) && isStructuralKind(k);
    case Designation.Chop:
      return k === TileKind.Tree;
    case Designation.Gather:
      return k === TileKind.Shrub;
    case Designation.None:
    case Designation.Harvest:
      return false;
    default:
      return false;
  }
}

/** The result of completing a designation: the tile changes in order, and the drops. */
export interface TransitionResult {
  readonly changes: readonly TileChange[];
  readonly drops: readonly DropSpec[];
}

/** Rolls the transition needs: the stone drop and the log and product counts. */
export interface TransitionRolls {
  /** `chance(MINING_STONE_DROP_PERMILLE)` for a dug stone tile. */
  stoneDrops(): boolean;
  /** Logs for a felled tree of the given plant species index. */
  logs(species: number): number;
  /** The product of a gathered shrub of the given plant species index: item type, material and count. */
  gather(species: number): { type: string; material: string; count: number } | null;
  /** The log material of a tree species (its wood). */
  logMaterial(species: number): string;
}

/**
 * "Item produced" of `dig` (and every row that says "As dig"): "Per material class: soil none;
 * stone with `MINING_STONE_DROP_PERMILLE`; ore and gem always; ice none". Obsidian and other rock
 * classes count as stone (DECISIONS.md D-050).
 */
export function digDrop(map: Map3D, i: TileIndex, facts: MaterialFacts, rolls: TransitionRolls): DropSpec | null {
  const material = map.materialAt(i);
  const cls = facts.classOf(material);
  if (cls === 'ore') return { type: 'ore', material, count: 1, tile: i };
  if (cls === 'gem') return { type: 'rough_gem', material, count: 1, tile: i };
  if (cls === 'stone') return rolls.stoneDrops() ? { type: 'raw_stone', material, count: 1, tile: i } : null;
  return null;
}

/**
 * The item a removed or collapsed construction returns: "The block, log or bar used". 14 records
 * which one in M2; until then the material's class decides (D-050): wood gives a `log`, metal a
 * `bar`, anything else a `stone_block`.
 */
export function constructionItem(material: number, facts: MaterialFacts, isMetal: (m: number) => boolean): string {
  if (facts.classOf(material) === 'wood') return 'log';
  if (isMetal(material)) return 'bar';
  return 'stone_block';
}

/**
 * The result column. Call only when {@link precondition} holds. `floorUnder` is the material a
 * felled tree leaves (the tile below's material).
 */
export function transition(
  map: Map3D,
  i: TileIndex,
  kind: Designation,
  facts: MaterialFacts,
  rolls: TransitionRolls,
  isMetal: (m: number) => boolean = () => false,
): TransitionResult {
  const k = map.kindAt(i);
  const material = map.materialAt(i);
  const changes: TileChange[] = [];
  const drops: DropSpec[] = [];
  const addDrop = (d: DropSpec | null): void => {
    if (d !== null) drops.push(d);
  };
  switch (kind) {
    case Designation.Dig:
      // "`floor` with the same material; the tile above is unchanged".
      addDrop(digDrop(map, i, facts, rolls));
      changes.push({ tile: i, kind: TileKind.Floor, material });
      break;
    case Designation.Channel: {
      // "Tile becomes `open`; if the tile below is `wall`, it becomes `ramp`; if it is `floor` it
      // stays; if it is `open` nothing more." Drops come from the tile below when it becomes a ramp.
      changes.push({ tile: i, kind: TileKind.Open, material: 0, clear: TileFlag.Smoothed | TileFlag.Engraved | TileFlag.Grass });
      const below = map.below(i);
      if (below >= 0 && map.kindAt(below) === TileKind.Wall) {
        addDrop(digDrop(map, below, facts, rolls));
        changes.push({ tile: below, kind: TileKind.Ramp, material: map.materialAt(below) });
      }
      break;
    }
    case Designation.StairsUp:
      addDrop(digDrop(map, i, facts, rolls));
      changes.push({ tile: i, kind: TileKind.StairsUp, material });
      break;
    case Designation.StairsDown:
      changes.push({ tile: i, kind: TileKind.StairsDown, material });
      break;
    case Designation.StairsUpDown:
      addDrop(digDrop(map, i, facts, rolls));
      changes.push({ tile: i, kind: TileKind.StairsUpDown, material });
      break;
    case Designation.Ramp: {
      // "`ramp`; the tile above becomes `open` if it was `floor`".
      addDrop(digDrop(map, i, facts, rolls));
      changes.push({ tile: i, kind: TileKind.Ramp, material });
      const up = map.above(i);
      if (up >= 0 && map.kindAt(up) === TileKind.Floor) changes.push({ tile: up, kind: TileKind.Open, material: 0 });
      break;
    }
    case Designation.Smooth:
      changes.push({ tile: i, set: TileFlag.Smoothed });
      break;
    case Designation.Engrave:
      changes.push({ tile: i, set: TileFlag.Engraved });
      break;
    case Designation.Remove: {
      // "`wall` or `floor` becomes `open`, except a constructed floor over natural rock becomes the
      // natural floor; stairs and ramps become `open`".
      drops.push({ type: constructionItem(material, facts, isMetal), material, count: 1, tile: i });
      const below = map.below(i);
      const naturalRockBelow =
        below >= 0 && map.kindAt(below) === TileKind.Wall && !map.hasFlag(below, TileFlag.Constructed);
      if (k === TileKind.Floor && naturalRockBelow) {
        changes.push({ tile: i, kind: TileKind.Floor, material: map.materialAt(below), clear: TileFlag.Constructed });
      } else {
        changes.push({ tile: i, kind: TileKind.Open, material: 0, clear: TileFlag.Constructed });
      }
      break;
    }
    case Designation.Chop: {
      // "`floor` (grass if soil); logs by species size".
      const below = map.below(i);
      const ground = below >= 0 ? map.materialAt(below) : 0;
      const soil = facts.classOf(ground) === 'soil';
      const count = rolls.logs(material);
      if (count > 0) drops.push({ type: 'log', material: rolls.logMaterial(material), count, tile: i });
      changes.push({ tile: i, kind: TileKind.Floor, material: ground, ...(soil ? { set: TileFlag.Grass } : {}) });
      break;
    }
    case Designation.Gather: {
      // "shrub stays; regrowth timer set (07)"; the product drops.
      const product = rolls.gather(material);
      if (product !== null && product.count > 0) {
        drops.push({ type: product.type, material: product.material, count: product.count, tile: i });
      }
      break;
    }
    case Designation.None:
    case Designation.Harvest:
      break;
    default:
      break;
  }
  return { changes, drops };
}
