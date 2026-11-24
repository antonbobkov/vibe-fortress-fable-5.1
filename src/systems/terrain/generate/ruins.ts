/**
 * Stage 10b: the ruins of ended fortresses. `02-systems/02-embark-and-loadout.md` § Ruins;
 * `03-terrain-and-mining.md` § Local map generation stage 10b (T-686).
 *
 * A ruin record holds the tiles a fortress changed from its site as generated, packed: for each
 * tile in ascending index order, the index's distance from the previous one (a varint), the tile
 * kind (a byte), the material's place in the record's palette (a varint) and the flags (a byte:
 * 1 constructed, 2 smoothed). Applying the records of a site in the order the fortresses ended
 * rebuilds what each left; only the last one's items lie there, as the next fortress found them.
 */

import { TileFlag, TileKind, isSolidBottomed, type Map3D } from '@core/map3d';
import type { Registry } from '@core/registry';
import { base64ToBytes, bytesToBase64 } from '@core/serialize';
import type { RuinBuilding, RuinRecord, WorldMap } from '@systems/worldgen';
import type { SpawnEntry } from './common';

/** One changed tile of a ruin. */
export interface RuinTile {
  readonly index: number;
  readonly kind: TileKind;
  readonly material: number;
  readonly constructed: boolean;
  readonly smoothed: boolean;
}

const FLAG_CONSTRUCTED = 1;
const FLAG_SMOOTHED = 2;

/** The ruins of one region of a world, in the order the fortresses ended. */
export function ruinsOf(world: Pick<WorldMap, 'ruins'> | null | undefined, regionId: number): RuinRecord[] {
  return (world?.ruins ?? []).filter((ruin) => ruin.regionId === regionId);
}

/** A world with one more ruin, after those it already has. */
export function withRuin(world: WorldMap, ruin: RuinRecord): WorldMap {
  return { ...world, ruins: [...(world.ruins ?? []), ruin] };
}

function pushVarint(out: number[], value: number): void {
  let v = value;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
}

/** Pack tiles (ascending by index) and name their materials by a palette of ids. */
export function encodeRuinTiles(tiles: readonly RuinTile[], registry: Registry): Pick<RuinRecord, 'tileCount' | 'materials' | 'tiles'> {
  const materials = registry.table<{ id: string }>('materials');
  const palette: string[] = [];
  const slot: number[] = [];
  const out: number[] = [];
  let previous = 0;
  for (const tile of tiles) {
    let at = slot[tile.material];
    if (at === undefined) {
      at = palette.length;
      slot[tile.material] = at;
      palette.push(materials.byIndex(tile.material)?.id ?? '');
    }
    pushVarint(out, tile.index - previous);
    previous = tile.index;
    out.push(tile.kind);
    pushVarint(out, at);
    out.push((tile.constructed ? FLAG_CONSTRUCTED : 0) | (tile.smoothed ? FLAG_SMOOTHED : 0));
  }
  return { tileCount: tiles.length, materials: palette, tiles: bytesToBase64(Uint8Array.from(out)) };
}

/** Unpack a ruin's tiles; a material the content no longer has reads as index 0. */
export function decodeRuinTiles(ruin: Pick<RuinRecord, 'tileCount' | 'materials' | 'tiles'>, registry: Registry): RuinTile[] {
  const materials = registry.table('materials');
  const palette = ruin.materials.map((id) => (materials.has(id) ? materials.index(id) : 0));
  const bytes = base64ToBytes(ruin.tiles);
  const tiles: RuinTile[] = [];
  let at = 0;
  let index = 0;
  const varint = (): number => {
    let value = 0;
    let scale = 1;
    while (at < bytes.length) {
      const b = bytes[at] as number;
      at += 1;
      value += (b & 0x7f) * scale;
      if (b < 0x80) break;
      scale *= 0x80;
    }
    return value;
  };
  for (let k = 0; k < ruin.tileCount && at < bytes.length; k += 1) {
    index += varint();
    const kind = (bytes[at] ?? TileKind.Wall) as TileKind;
    at += 1;
    const material = palette[varint()] ?? 0;
    const flags = bytes[at] ?? 0;
    at += 1;
    tiles.push({ index, kind, material, constructed: (flags & FLAG_CONSTRUCTED) !== 0, smoothed: (flags & FLAG_SMOOTHED) !== 0 });
  }
  return tiles;
}

/**
 * Stage 10b: lay a site's ruins over its generated map, in the order the fortresses ended, and
 * record the last one's items in the spawn list where they still have a floor to lie on, and its
 * standing furniture in `standing` for 14 to place at arrival (T-690). A ruin
 * tile sets the tile's kind and material and its constructed and smoothed flags, clears its
 * engraving, grass and snow, and its fluid when it is a wall; nothing is drawn, so a site with the
 * same ruins is the same map each time.
 */
export function stageRuins(map: Map3D, ruins: readonly RuinRecord[], registry: Registry, spawns: SpawnEntry[], standing: RuinBuilding[] = []): void {
  const size = map.w * map.h * map.d;
  const cleared = TileFlag.Constructed | TileFlag.Smoothed | TileFlag.Engraved | TileFlag.Grass | TileFlag.Snow;
  for (const ruin of ruins) {
    for (const tile of decodeRuinTiles(ruin, registry)) {
      const i = tile.index;
      if (i < 0 || i >= size) continue;
      map.kind[i] = tile.kind;
      map.material[i] = tile.material;
      map.flags[i] = ((map.flags[i] as number) & ~cleared) | (tile.constructed ? TileFlag.Constructed : 0) | (tile.smoothed ? TileFlag.Smoothed : 0);
      if (tile.kind === TileKind.Wall || tile.kind === TileKind.Fortification) map.fluid[i] = 0;
    }
  }
  const last = ruins[ruins.length - 1];
  if (last === undefined) return;
  const items = registry.table('items');
  const materials = registry.table('materials');
  for (const item of last.items) {
    if (item.tile < 0 || item.tile >= size || !isSolidBottomed(map.kind[item.tile] as TileKind)) continue;
    if (!items.has(item.type) || !materials.has(item.material)) continue;
    spawns.push({ kind: 'item', type: item.type, material: item.material, quality: item.quality, count: item.count, tile: item.tile, source: 'ruins' });
  }
  // T-690: the last ruin's standing furniture whose type, item and material the content still has;
  // 14 places each at arrival where its tiles still stand as its placement rule asks.
  const buildings = registry.table('buildings');
  for (const piece of last.buildings ?? []) {
    if (piece.tile < 0 || piece.tile >= size) continue;
    if (!buildings.has(piece.type) || !items.has(piece.item) || !materials.has(piece.material)) continue;
    standing.push(piece);
  }
}
