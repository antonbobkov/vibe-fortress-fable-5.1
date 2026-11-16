/**
 * Where a flower grows: `02-systems/07-plants-and-farming.md` § Flowers and
 * `02-systems/23-rendering.md` § Compositor step 2 (natural outdoor surfaces).
 *
 * A flower is a pure function of the tile's position and the biome's `flowers` share
 * (`regions-biomes-and-traits.md` § Biome surface), with no state and no draw. The compositor
 * draws one with it and 07 counts one with it, so the simulation never reads the renderer.
 */

import { FIXED_SCALE, type Fixed } from './fixed';
import { hashInts } from './noise';

/** The salt of the per-tile hash the surface's variety and its flowers share. */
export const SURFACE_TILE_SALT = 0x5f3759df;

/** The per-tile hash of the surface's variety (glyph variants, tints, flowers). */
export function surfaceTileHash(x: number, y: number, z: number): number {
  return hashInts(SURFACE_TILE_SALT, x, y, z);
}

/** A grass tile at (x, y, z) carries a flower under a biome whose `flowers` share is `share`. */
export function flowerByHash(share: Fixed, hash: number): boolean {
  return share > 0 && (hash >>> 8) % FIXED_SCALE < share;
}

/** {@link flowerByHash} of the tile's own hash. */
export function flowerTile(share: Fixed, x: number, y: number, z: number): boolean {
  return flowerByHash(share, surfaceTileHash(x, y, z));
}
