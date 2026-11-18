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

import { Designation, FLUID_FROZEN_BIT, FLUID_LEVEL_MASK, FLUID_TYPE_BIT, TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { TileIndex } from '@core/types';

/** `03` § Reader `materialClassAt`: stone, soil, ore, gem, bone, ice, wood, constructed. */
export type MaterialClass = 'stone' | 'soil' | 'ore' | 'gem' | 'bone' | 'ice' | 'wood' | 'constructed' | 'other';

/** What the rules need to know about materials and plants, from the registry. */
export interface MaterialFacts {
  /** The class of a tile material (a material index); `other` for air and unknown rows. */
  classOf(material: number): MaterialClass;
  /** True for the deepsilver mineral (`minerals-and-metals.md`, the `deepsilver` flag). */
  isDeepsilver(material: number): boolean;
  /** True for a soil tagged `soil_drop` (`materials.md` § Soil: clay, sand, peat). Absent: none. */
  dropsSoil?(material: number): boolean;
  /** The item a dug tile of class `bone` drops: a `tusk` of `ivory`, a `fossil` of any other. Absent: a fossil. */
  boneItem?(material: number): string;
  /** The material's `burnable` column (`materials.md`). Absent: nothing burns, so `ignite` never passes. */
  burnable?(material: number): boolean;
  /** A plant species whose `plants` row is tagged `fireproof` (the salt crust). Absent: none. */
  fireproof?(material: number): boolean;
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

/** 09 § Gathering webs: what `gather` on a web tile yields. */
export const WEB_ITEM = 'thread';
export const WEB_MATERIAL = 'silk_web';

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
  Designation.HarvestIce,
  Designation.Ignite,
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
  harvest_ice: Designation.HarvestIce,
  ignite: Designation.Ignite,
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
 * `harvest_ice`: frozen outdoor water (04's frozen record): an ice `wall` or ice `floor` whose fluid
 * byte holds water with the `frozen` bit, on an `outdoor` tile (`03` § Ice harvesting). The
 * recut wait (`iceCut`) is 03's state and is checked by `Designate`, not here.
 */
export function frozenOutdoorWater(map: Map3D, i: TileIndex, facts: MaterialFacts): boolean {
  const k = map.kindAt(i);
  if (k !== TileKind.Wall && k !== TileKind.Floor) return false;
  if (constructed(map, i) || !map.hasFlag(i, TileFlag.Outdoor)) return false;
  const f = (map.fluid[i] ?? 0) as number;
  if ((f & FLUID_LEVEL_MASK) === 0 || (f & FLUID_TYPE_BIT) !== 0 || (f & FLUID_FROZEN_BIT) === 0) return false;
  return facts.classOf(map.materialAt(i)) === 'ice';
}

/**
 * `03` § Ice harvesting: a `harvest_ice` designation is kept while its tile is outdoor water, frozen
 * or thawed (an `open` or `floor` tile whose fluid byte holds water, on an `outdoor` tile); its job waits for the
 * ice while the tile is thawed. The frozen bit is not read for the thawed case: 04's thaw writes the
 * tile before it clears the bit.
 */
export function iceDesignationHolds(map: Map3D, i: TileIndex, facts: MaterialFacts): boolean {
  if (frozenOutdoorWater(map, i, facts)) return true;
  const k = map.kindAt(i);
  if ((k !== TileKind.Open && k !== TileKind.Floor) || constructed(map, i) || !map.hasFlag(i, TileFlag.Outdoor)) return false;
  const f = (map.fluid[i] ?? 0) as number;
  return (f & FLUID_LEVEL_MASK) !== 0 && (f & FLUID_TYPE_BIT) === 0;
}

/**
 * 05's `burnableTile(T)` over the map and the material facts (`05` § Fire, Ignition): a constructed
 * tile of wood anywhere; outdoors a tree, sapling or shrub (not of a `fireproof` species: the salt
 * crust), a grass floor, or a floor or wall of a burnable soil (peat). The same rule as `Fire.burnableTile` (the terrain test holds them equal).
 */
export function burnableTile(map: Map3D, i: TileIndex, facts: MaterialFacts): boolean {
  const kind = map.kindAt(i);
  const material = map.materialAt(i);
  if (constructed(map, i)) return facts.classOf(material) === 'wood' && kind !== TileKind.Open;
  if (!map.hasFlag(i, TileFlag.Outdoor)) return false;
  if (kind === TileKind.Tree || kind === TileKind.Sapling || kind === TileKind.Shrub) return facts.fireproof?.(material) !== true;
  if (kind === TileKind.Floor && map.hasFlag(i, TileFlag.Grass)) return true;
  return (kind === TileKind.Floor || kind === TileKind.Wall) && facts.classOf(material) === 'soil' && facts.burnable?.(material) === true;
}

/**
 * `03` § Tile transitions: stairs are cut only into a `floor` that holds no building, planned or
 * built, of any kind (furniture, a workshop, a door, a construction): nothing is carved under one.
 */
export function stairFloor(map: Map3D, i: TileIndex): boolean {
  return map.kindAt(i) === TileKind.Floor && map.buildingAtTile(i) === 0;
}

/**
 * `03` § Tile transitions: a `wall` that is not `constructed`. Dig, stairs and ramps carve only
 * natural rock; a built wall comes down by `remove`, which returns its blocks.
 */
export function naturalWall(map: Map3D, i: TileIndex): boolean {
  return map.kindAt(i) === TileKind.Wall && !constructed(map, i);
}

/** A stair designation (up, down or up/down). */
export function isStairDesignation(kind: Designation): boolean {
  return kind === Designation.StairsUp || kind === Designation.StairsDown || kind === Designation.StairsUpDown;
}

/**
 * `03` § Tile transitions: a designation that is refused on a tile that holds a building, and
 * cleared when one is placed there: the stairs, and `channel`, which opens the tile.
 */
export function cutsUnderBuilding(kind: Designation): boolean {
  return isStairDesignation(kind) || kind === Designation.Channel;
}

/** The floor above a wall that a `ramp` would open holds a building (`03` § Tile transitions). */
export function rampOpensBuilding(map: Map3D, i: TileIndex): boolean {
  const up = map.above(i);
  return up >= 0 && map.kindAt(up) === TileKind.Floor && map.buildingAtTile(up) !== 0;
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
      // Opens the tile, so never one that holds a building.
      return (
        (k === TileKind.Floor ||
          k === TileKind.Ramp ||
          k === TileKind.Sapling ||
          k === TileKind.Shrub ||
          k === TileKind.StairsDown) &&
        map.buildingAtTile(i) === 0
      );
    case Designation.StairsUp:
      // Carved from a natural wall, or cut into a floor that holds no building.
      return naturalWall(map, i) || stairFloor(map, i);
    case Designation.StairsUpDown:
      // As up stairs, or a natural stair re-carved to lead both ways.
      return naturalWall(map, i) || stairFloor(map, i) ||
        ((k === TileKind.StairsUp || k === TileKind.StairsDown) && !constructed(map, i));
    case Designation.StairsDown:
      return stairFloor(map, i);
    case Designation.Ramp: {
      if (!naturalWall(map, i)) return false;
      const up = map.above(i);
      if (up < 0) return false;
      const ku = map.kindAt(up);
      // The floor above is opened, so it must hold no building.
      return ku === TileKind.Open || (ku === TileKind.Floor && !rampOpensBuilding(map, i));
    }
    case Designation.Smooth:
      return smoothable(map, i, facts);
    case Designation.Engrave:
      return map.hasFlag(i, TileFlag.Smoothed) && !map.hasFlag(i, TileFlag.Engraved);
    case Designation.Remove:
      return constructed(map, i) && isStructuralKind(k);
    case Designation.Chop:
      return k === TileKind.Tree || k === TileKind.Sapling;
    case Designation.Gather:
      // A shrub, or a web on a floor (09 § Gathering webs).
      return k === TileKind.Shrub || (k === TileKind.Floor && map.hasFlag(i, TileFlag.Web));
    case Designation.HarvestIce:
      return frozenOutdoorWater(map, i, facts);
    case Designation.Ignite:
      // `03` § Setting a fire: a tile 05 calls burnable, not wet, not under snow, not already burning.
      return burnableTile(map, i, facts) && !map.hasFlag(i, TileFlag.Wet) && !map.hasFlag(i, TileFlag.Snow) && !map.hasFlag(i, TileFlag.Burning);
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
  /**
   * `chance(SOIL_DROP_PERMILLE)` for a dug soil tile tagged `soil_drop`, on the stream
   * `03.soil_drop` (drawn only for such a tile). Absent: such a tile drops nothing.
   */
  soilDrops?(): boolean;
  /** Logs for a felled tree of the given plant species index. */
  logs(species: number): number;
  /**
   * The product of a gathered shrub of the given plant species index: item type, material and
   * count, and — with the species' `wildSeedPermille` — one seed of the crop it sows
   * (`07` § Shrubs, § Seeds; T-M4-02), and a second product given with the first (`09` § Gathering).
   */
  gather(species: number): { type: string; material: string; count: number; seed?: string;
    extra?: { type: string; material: string; count: number } } | null;
  /** The log material of a tree species (its wood). */
  logMaterial(species: number): string;
}

/**
 * "Item produced" of `dig` (and every row that says "As dig"): "Per material class: `stone` and
 * `obsidian`: `raw_stone` with `MINING_STONE_DROP_PERMILLE`; `ore`: always `ore`; `gem`: always
 * `rough_gem`; `bone`: always `fossil` (a `tusk` for `ivory`, stage 9b's tusks); `soil` tagged `soil_drop`: `soil_load` with
 * `SOIL_DROP_PERMILLE`; every other class: none" (docs/02-systems/03-terrain-and-mining.md
 * § Tile transitions).
 */
export function digDrop(map: Map3D, i: TileIndex, facts: MaterialFacts, rolls: TransitionRolls): DropSpec | null {
  const material = map.materialAt(i);
  const cls = facts.classOf(material);
  if (cls === 'ore') return { type: 'ore', material, count: 1, tile: i };
  if (cls === 'gem') return { type: 'rough_gem', material, count: 1, tile: i };
  if (cls === 'bone') return { type: facts.boneItem?.(material) ?? 'fossil', material, count: 1, tile: i };
  if (cls === 'stone') return rolls.stoneDrops() ? { type: 'raw_stone', material, count: 1, tile: i } : null;
  if (cls === 'soil' && facts.dropsSoil?.(material) === true && rolls.soilDrops !== undefined) {
    return rolls.soilDrops() ? { type: 'soil_load', material, count: 1, tile: i } : null;
  }
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
      // "Tile becomes `open`; if the tile below is a natural `wall`, it becomes `ramp`; a built wall,
      // or a `floor`, stays; if it is `open` nothing more." Drops come from the tile below when it
      // becomes a ramp.
      changes.push({ tile: i, kind: TileKind.Open, material: 0, clear: TileFlag.Smoothed | TileFlag.Engraved | TileFlag.Grass });
      const below = map.below(i);
      if (below >= 0 && naturalWall(map, below)) {
        addDrop(digDrop(map, below, facts, rolls));
        changes.push({ tile: below, kind: TileKind.Ramp, material: map.materialAt(below) });
      }
      break;
    }
    case Designation.StairsUp:
      // "As dig from a `wall`; none from a `floor`".
      if (map.kindAt(i) === TileKind.Wall) addDrop(digDrop(map, i, facts, rolls));
      changes.push({ tile: i, kind: TileKind.StairsUp, material });
      break;
    case Designation.StairsDown:
      changes.push({ tile: i, kind: TileKind.StairsDown, material });
      break;
    case Designation.StairsUpDown:
      // "As dig from a `wall`; none otherwise" (a floor, or a stair re-carved).
      if (map.kindAt(i) === TileKind.Wall) addDrop(digDrop(map, i, facts, rolls));
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
      const count = map.kindAt(i) === TileKind.Tree ? rolls.logs(material) : 0;
      if (count > 0) drops.push({ type: 'log', material: rolls.logMaterial(material), count, tile: i });
      changes.push({ tile: i, kind: TileKind.Floor, material: ground, ...(soil ? { set: TileFlag.Grass } : {}) });
      break;
    }
    case Designation.Gather: {
      // 09 § Gathering webs: a web yields one `thread` of `silk_web` and is gone; no draw.
      if (k === TileKind.Floor) {
        drops.push({ type: WEB_ITEM, material: WEB_MATERIAL, count: 1, tile: i });
        changes.push({ tile: i, clear: TileFlag.Web });
        break;
      }
      // "shrub stays; regrowth timer set (07)"; the product drops.
      const product = rolls.gather(material);
      if (product !== null && product.count > 0) {
        drops.push({ type: product.type, material: product.material, count: product.count, tile: i });
      }
      if (product?.seed !== undefined) drops.push({ type: 'seed', material: product.seed, count: 1, tile: i });
      if (product?.extra !== undefined && product.extra.count > 0) drops.push({ ...product.extra, tile: i });
      break;
    }
    case Designation.None:
    case Designation.Harvest:
    case Designation.HarvestIce:
    case Designation.Ignite:
      // `harvest_ice` and `ignite` change no tile here: 03's producer drops the block or emits `TileIgnited`.
      break;
    default:
      break;
  }
  return { changes, drops };
}

/**
 * 14 § Placement step 4: a builder uproots a sapling or shrub. The tile becomes what felling a tree
 * leaves; a sapling drops nothing, and a shrub drops its `gather` product if it is `ripe` (07 § Shrubs).
 */
export function clearPlantTransition(map: Map3D, i: TileIndex, facts: MaterialFacts, rolls: TransitionRolls, ripe: boolean): TransitionResult {
  const below = map.below(i);
  const ground = below >= 0 ? map.materialAt(below) : 0;
  const soil = facts.classOf(ground) === 'soil';
  const drops: DropSpec[] = [];
  if (map.kindAt(i) === TileKind.Shrub && ripe) {
    const product = rolls.gather(map.materialAt(i));
    if (product !== null && product.count > 0) drops.push({ type: product.type, material: product.material, count: product.count, tile: i });
    if (product?.seed !== undefined) drops.push({ type: 'seed', material: product.seed, count: 1, tile: i });
    if (product?.extra !== undefined && product.extra.count > 0) drops.push({ ...product.extra, tile: i });
  }
  return { changes: [{ tile: i, kind: TileKind.Floor, material: ground, ...(soil ? { set: TileFlag.Grass } : {}) }], drops };
}

/**
 * A floor tile under a roost's ceiling: a `floor` with an `open` tile above it and a natural `wall`
 * above that (`03` § Local map generation, after stage 6; 08 checks it again before each drop).
 */
export function roostCeilingOver(map: Map3D, i: TileIndex): boolean {
  if (!map.validIndex(i) || map.kindAt(i) !== TileKind.Floor) return false;
  const air = map.above(i);
  if (air < 0 || map.kindAt(air) !== TileKind.Open) return false;
  const ceiling = map.above(air);
  return ceiling >= 0 && map.kindAt(ceiling) === TileKind.Wall && !map.hasFlag(ceiling, TileFlag.Constructed);
}
