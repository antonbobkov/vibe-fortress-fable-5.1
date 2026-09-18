/**
 * Setup helpers shared by the M1 terrain and job scenarios. Not a `*.scenario.ts` file, so the
 * index does not collect it. Everything goes through public APIs: commands, the terrain API and
 * the readers.
 */

import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { TestWorld } from './test-world';

/** The embarked dwarves, in spawn order. */
export function dwarves(w: TestWorld): readonly EntityId[] {
  return w.game.arrival?.dwarves ?? [];
}

/** Keep one miner: every other dwarf's `mining` labor is turned off (`SetLabor`). */
export function onlyMiner(w: TestWorld, labor = 'mining'): EntityId {
  const all = dwarves(w);
  for (const id of all.slice(1)) {
    const r = w.game.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor, on: false });
    if (!r.ok) throw new Error(`onlyMiner: ${r.reason}`);
  }
  return all[0] as EntityId;
}

/** A finished stair shaft (down at the top, up/down between, up at the bottom), laid through the terrain API. */
export function stairShaft(w: TestWorld, x: number, y: number, zTop: number, zBottom: number): void {
  const terrain = w.game.world.services.terrain;
  for (let z = zTop; z >= zBottom; z -= 1) {
    const i = w.index(x, y, z);
    const kind = z === zTop ? TileKind.StairsDown : z === zBottom ? TileKind.StairsUp : TileKind.StairsUpDown;
    terrain.setKind(i, kind, w.map.materialAt(i));
  }
}

/** The tiles of a w × h rectangle on one level, row by row. */
export function rect(w: TestWorld, x: number, y: number, z: number, width: number, height: number): TileIndex[] {
  const out: TileIndex[] = [];
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) out.push(w.index(x + dx, y + dy, z));
  return out;
}
