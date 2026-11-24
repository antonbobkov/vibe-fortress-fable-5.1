/**
 * The ruin an ended fortress leaves on its site (`02-systems/02-embark-and-loadout.md` § Ruins, T-686):
 * the tiles it dug, built and smoothed, told against its site as generated, and some of its items,
 * weathered and looted. The record goes into the world map, which the next fortress on the world
 * saves, and stage 10b of local map generation lays it over the site again.
 */
import { C, type Building, type Item, type Position } from '@core/components';
import { Map3D, TileFlag, TileKind } from '@core/map3d';
import { hash } from '@core/noise';
import type { Registry } from '@core/registry';
import { RngStream } from '@core/rng';
import type { EntityId } from '@core/types';
import {
  localMapSpec,
  RUIN_COLLAPSE_PERMILLE,
  RUIN_FURNITURE_MAX,
  RUIN_FURNITURE_STAND_PERMILLE,
  RUIN_ITEMS_MAX,
  RUIN_ITEM_KEEP_PERMILLE,
  RUIN_ITEM_VALUABLE_PERMILLE,
} from '@systems/embark';
import { generateLocal } from '@systems/terrain/generate';
import { encodeRuinTiles, ruinsOf, type RuinTile } from '@systems/terrain/generate/ruins';
import { linksItem, type BuildingRow } from '@systems/buildings';
import type { RuinBuilding, RuinItem, RuinRecord, WorldMap } from '@systems/worldgen';
import type { HeadlessGame } from './headless';

/** Item categories the looters favour (`02` § Ruins). */
const VALUABLE = ['bar/metal', 'stone/gem', 'craft/', 'weapon/', 'armor/', 'ammo/'];
/** Item categories that outlast the years between (`02` § Ruins); anything else rots or is gone. */
const ORDINARY = ['furniture/', 'stone/raw', 'stone/block', 'stone/fossil', 'wood/', 'container/', 'tool/', 'bar/', 'ore'];

/** The kinds a fortress digs or carves a tile into. */
function isDugKind(kind: number): boolean {
  return kind === TileKind.Floor || kind === TileKind.Ramp || kind === TileKind.StairsUp || kind === TileKind.StairsDown
    || kind === TileKind.StairsUpDown || kind === TileKind.Open || kind === TileKind.Fortification;
}

/** The kinds of natural ground a fortress digs from. */
function isGroundKind(kind: number): boolean {
  return kind === TileKind.Wall || kind === TileKind.Floor || kind === TileKind.Ramp || kind === TileKind.StairsUp
    || kind === TileKind.StairsDown || kind === TileKind.StairsUpDown;
}

/**
 * The tiles of `final` that a fortress changed from `site` (the site as it was generated, with the
 * ruins it already had): a tile dug or carved from natural ground (not a tree, shrub or boulder
 * cleared), a constructed tile, and a smoothed or engraved one (engravings wear to smooth). A
 * constructed tile has fallen with `RUIN_COLLAPSE_PERMILLE`, or when the site holds water there,
 * and is left out.
 */
export function ruinTiles(final: Map3D, site: Map3D, rng: RngStream): RuinTile[] {
  const tiles: RuinTile[] = [];
  const size = final.w * final.h * final.d;
  const worked = TileFlag.Smoothed | TileFlag.Engraved;
  for (let i = 0; i < size; i += 1) {
    const kind = final.kind[i] as number;
    const was = site.kind[i] as number;
    const flags = final.flags[i] as number;
    const material = final.material[i] as number;
    const smoothed = (flags & worked) !== 0;
    const constructed = (flags & TileFlag.Constructed) !== 0;
    const changed = kind !== was || material !== site.material[i];
    if (constructed) {
      if (!changed && ((site.flags[i] as number) & TileFlag.Constructed) !== 0) continue;
      if (rng.chance(RUIN_COLLAPSE_PERMILLE) || (site.fluid[i] as number) !== 0) continue;
      tiles.push({ index: i, kind, material, constructed: true, smoothed });
    } else if (kind !== was && isGroundKind(was) && isDugKind(kind)) {
      tiles.push({ index: i, kind, material, constructed: false, smoothed });
    } else if (!changed && smoothed && ((site.flags[i] as number) & TileFlag.Smoothed) === 0) {
      tiles.push({ index: i, kind, material, constructed: false, smoothed: true });
    }
  }
  return tiles;
}

/**
 * The tile an item lies on: its own, or its container's (a barrel in a stockpile); -1 for an item
 * carried, or in a building's load: the wagon and what it holds leave with the expedition.
 */
function itemTile(game: HeadlessGame, id: EntityId, item: Item): number {
  const entities = game.world.entities;
  let at: EntityId = id;
  let holder: Item | undefined = item;
  for (let depth = 0; depth < 4 && holder !== undefined; depth += 1) {
    const pos = entities.get<Position>(at, C.Position);
    if (pos !== undefined) return game.map.index(pos.x, pos.y, pos.z);
    if (holder.carriedBy !== 0 || holder.containerId === 0) return -1;
    at = holder.containerId;
    holder = entities.get<Item>(at, C.Item);
  }
  return -1;
}

/**
 * The items a ruin keeps: each lasting item on the map (not one carried) stays with
 * `RUIN_ITEM_KEEP_PERMILLE`, a valuable one with `RUIN_ITEM_VALUABLE_PERMILLE`, drawn in id order;
 * over `RUIN_ITEMS_MAX`, items drawn uniformly go until it fits. A stack keeps half its count (at
 * least one), and each item is a quality level worse (not below 0).
 */
export function ruinItems(game: HeadlessGame, registry: Registry, rng: RngStream): RuinItem[] {
  const types = registry.table<{ id: string; category: string }>('items');
  const materials = registry.table<{ id: string }>('materials');
  const out: RuinItem[] = [];
  for (const id of game.world.entities.with(C.Item)) {
    const item = game.world.entities.get<Item>(id, C.Item);
    if (item === undefined || item.carriedBy !== 0) continue;
    const row = types.byIndex(item.type);
    const material = materials.byIndex(item.material);
    if (row === undefined || material === undefined) continue;
    const valuable = VALUABLE.some((prefix) => row.category.startsWith(prefix));
    if (!valuable && !ORDINARY.some((prefix) => row.category.startsWith(prefix))) continue;
    const tile = itemTile(game, id, item);
    if (tile < 0) continue;
    if (!rng.chance(valuable ? RUIN_ITEM_VALUABLE_PERMILLE : RUIN_ITEM_KEEP_PERMILLE)) continue;
    out.push({ tile, type: row.id, material: material.id, count: Math.max(1, Math.floor(item.count / 2)), quality: Math.max(0, item.quality - 1) });
  }
  // Over the most a ruin keeps, drop items drawn uniformly until it fits; the rest keep id order.
  while (out.length > RUIN_ITEMS_MAX) out.splice(rng.int(0, out.length - 1), 1);
  return out;
}

/**
 * Furniture that holds something living or a name, and does not stand empty in a ruin: a cage, a
 * hive, a nest box, a chain post, a coffin and a memorial slab (`02` § Ruins).
 */
const NOT_STANDING = ['cage', 'hive', 'nest_box', 'chain', 'coffin', 'memorial'];

/**
 * The furniture a ruin keeps standing (`02` § Ruins, T-690): each built piece of furniture that links
 * its item (a door, a hatch, a bed, a table, a chair, a cabinet, a statue …, not those of
 * {@link NOT_STANDING}) stands with `RUIN_FURNITURE_STAND_PERMILLE`, drawn in id order after the
 * items; over `RUIN_FURNITURE_MAX`, pieces drawn uniformly go until it fits. Its item is weathered as
 * a kept item is: a quality level worse (not below 0). The rest are gone.
 */
export function ruinBuildings(game: HeadlessGame, registry: Registry, rng: RngStream): RuinBuilding[] {
  const types = registry.table<BuildingRow>('buildings');
  const itemTypes = registry.table<{ id: string }>('items');
  const materials = registry.table<{ id: string }>('materials');
  const entities = game.world.entities;
  const out: RuinBuilding[] = [];
  for (const id of entities.with(C.Building)) {
    const b = entities.get<Building>(id, C.Building);
    if (b === undefined || b.state !== 'built' || b.itemId === 0) continue;
    const row = types.byIndex(b.type);
    if (row === undefined || !linksItem(row) || row.tags.some((tag) => NOT_STANDING.includes(tag))) continue;
    const item = entities.get<Item>(b.itemId, C.Item);
    const type = item === undefined ? undefined : itemTypes.byIndex(item.type);
    const material = item === undefined ? undefined : materials.byIndex(item.material);
    if (item === undefined || type === undefined || material === undefined) continue;
    if (!rng.chance(RUIN_FURNITURE_STAND_PERMILLE)) continue;
    out.push({ tile: b.origin, type: row.id, orientation: b.orientation, item: type.id, material: material.id, quality: Math.max(0, item.quality - 1) });
  }
  while (out.length > RUIN_FURNITURE_MAX) out.splice(rng.int(0, out.length - 1), 1);
  return out;
}

/**
 * The ruin of the running fortress, or `null` on a map that is not a world's site. Its choices
 * draw on their own stream, from the world seed, the region and the tick the fortress ended, so
 * the same end leaves the same ruin: tiles, then items, then furniture. A testing fortress leaves
 * its halls but no items and no furniture.
 */
export function composeRuin(game: HeadlessGame, world: WorldMap, registry: Registry): RuinRecord | null {
  const fortress = game.world.fortress;
  const regionId = fortress.regionId;
  if (world.regions[regionId] === undefined) return null;
  const site = new Map3D();
  if (site.w !== game.map.w || site.h !== game.map.h || site.d !== game.map.d) return null;
  generateLocal(localMapSpec(world, regionId, registry), site, registry, { ruins: ruinsOf(world, regionId) });
  const rng = new RngStream(hash(world.seed, 'ruins', regionId, game.tick));
  const tiles = ruinTiles(game.map, site, rng);
  const items = fortress.testing === true ? [] : ruinItems(game, registry, rng);
  const buildings = fortress.testing === true ? [] : ruinBuildings(game, registry, rng);
  return { fortress: fortress.name, regionId, endedTick: game.tick, ...encodeRuinTiles(tiles, registry), items, ...(buildings.length === 0 ? {} : { buildings }) };
}
