/**
 * A source-fed waterfall on `flat-test` for `fl_waterfall_mist` (and the performance smoke's
 * builder): a one-tile tunnel on level `top` from a water source, ending over a shaft that drops
 * `drop` levels onto the floor of a 3 × 3 room.
 */

import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { TestWorld } from './test-world';

export interface Waterfall {
  readonly source: TileIndex;
  readonly channel: TileIndex[];
  /** The floor the water lands on. */
  readonly landing: TileIndex;
  /** The open tiles of the shaft, top first. */
  readonly shaft: TileIndex[];
}

export function digWaterfall(w: TestWorld, x0: number, y: number, top: number, length: number, drop: number): Waterfall {
  const channel: TileIndex[] = [];
  for (let x = x0; x < x0 + length; x += 1) {
    const t = w.index(x, y, top);
    w.carve(t, TileKind.Floor);
    channel.push(t);
  }
  const sx = x0 + length;
  const shaft: TileIndex[] = [];
  for (let z = top; z > top - drop; z -= 1) {
    const t = w.index(sx, y, z);
    w.carve(t, TileKind.Open);
    shaft.push(t);
  }
  const floorZ = top - drop;
  w.digRoom(sx - 1, y - 1, floorZ, 3, 3);
  const source = channel[0] as TileIndex;
  w.setFluid(source, 7, 'water', true);
  return { source, channel, landing: w.index(sx, y, floorZ), shaft };
}
