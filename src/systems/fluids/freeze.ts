/**
 * Freezing and thawing: `02-systems/04-fluids.md` § Freezing and thawing, and
 * `04-implementation/algorithms/fluids.md` (freeze and thaw, called from `TemperatureTick`).
 *
 * 05 decides temperature; 04 keeps `outdoorWaterTiles` (water or ice with a level, on an `outdoor`
 * tile) and on each `TemperatureTick` freezes those below `FREEZE_C` and thaws those above
 * `THAW_C`. The `TemperatureTick` is dispatched in step 4; the tile changes wait for 04's next tick
 * (step 2) so that the connectivity relabel of that tick sees them (D-099).
 */

import { FLUID_FROZEN_BIT, FLUID_LEVEL_MASK, FLUID_TYPE_BIT, TileFlag, TileKind, isSolidBottomed, type Map3D } from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { MovementApi, TerrainApi } from '@core/system';
import type { EntityId, MovementClass, TileIndex } from '@core/types';
import { FREEZE_C, ICE_WALL_LEVEL, THAW_C } from './constants';
import { sortedInsert, sortedRemove } from './state';
import type { FluidSim } from './step';

export interface FreezeHost {
  /** 05's `temperatureAt`, or null without a materials system. */
  temperatureAt(i: TileIndex): number | null;
  /** 05's warm springs never freeze. */
  isWarmSpring(i: TileIndex): boolean;
  readonly ice: number;
  /** Creatures on a tile, with their movement class. */
  creaturesAt(i: TileIndex): readonly EntityId[];
  movementClassOf(id: EntityId): MovementClass;
  /** 22's passability for a class. */
  walkable(i: TileIndex, cls: MovementClass): boolean;
  movement(): MovementApi | null;
}

export interface FreezeContext {
  readonly terrain: TerrainApi;
  emit(event: GameEvent): void;
}

export class Freezer {
  readonly sim: FluidSim;
  readonly host: FreezeHost;
  /** `outdoorWaterTiles`, ascending. */
  readonly outdoor: number[] = [];
  /** `frozenOriginalKind`, the material that went with it and the ice kind it became (supersets, D-099). */
  readonly original = new Map<TileIndex, { kind: TileKind; material: number; ice?: TileKind }>();
  /** A `TemperatureTick` arrived since 04's last tick. */
  pending = false;

  constructor(sim: FluidSim, host: FreezeHost) {
    this.sim = sim;
    this.host = host;
  }

  private get map(): Map3D {
    return this.sim.map;
  }

  /** Whether a tile belongs in `outdoorWaterTiles`: water (liquid or frozen) on an `outdoor` tile. */
  private belongs(i: TileIndex): boolean {
    const f = (this.map.fluid[i] ?? 0) as number;
    return (f & FLUID_LEVEL_MASK) > 0 && (f & FLUID_TYPE_BIT) === 0 && this.map.hasFlag(i, TileFlag.Outdoor);
  }

  /** Keep one tile's membership current. */
  note(i: TileIndex): void {
    if (this.belongs(i)) sortedInsert(this.outdoor, i);
    else sortedRemove(this.outdoor, i);
  }

  /** The whole map (a new game). */
  scan(): void {
    this.outdoor.length = 0;
    const n = this.map.tileCount;
    for (let i = 0; i < n; i += 1) if (this.belongs(i)) this.outdoor.push(i);
  }

  /**
   * `TilesChanged`: a changed tile's column may have changed `outdoor` (03 recomputes whole
   * columns); a frozen tile that is no longer the ice it froze into was dug ("the water is gone"),
   * so its water and its record go. Frozen water is not water to 22 (D-099), so only the redraw
   * is marked.
   */
  tilesChanged(tiles: readonly TileIndex[]): void {
    const map = this.map;
    const columns = new Set<number>();
    for (const t of tiles) {
      const was = this.original.get(t);
      if (this.sim.isFrozen(t) && (map.materialAt(t) !== this.host.ice || (was?.ice !== undefined && map.kindAt(t) !== was.ice))) {
        map.fluid[t] = 0;
        this.sim.eqCount[t] = 0;
        map.markChunkDirty(t, true, false);
        this.original.delete(t);
      }
      columns.add(t % (map.w * map.h));
    }
    for (const c of Array.from(columns).sort((a, b) => a - b)) {
      for (let z = 0; z < map.d; z += 1) this.note(c + z * map.w * map.h);
    }
  }

  /** The freeze and thaw pass of a `TemperatureTick` (`algorithms/fluids.md`). */
  run(ctx: FreezeContext): void {
    if (!this.pending) return;
    this.pending = false;
    for (const t of this.outdoor.slice()) {
      const temp = this.host.temperatureAt(t);
      if (temp === null) return;
      const frozen = this.sim.isFrozen(t);
      if (!frozen && temp < FREEZE_C && this.sim.level(t) > 0 && !this.host.isWarmSpring(t)) this.freeze(t, ctx);
      else if (frozen && temp > THAW_C) this.thaw(t, ctx);
    }
  }

  /**
   * `freeze(i)`: level ≥ `ICE_WALL_LEVEL` → an ice `wall`; else an ice `floor` if the tile below
   * is solid-bottomed, else a `wall`. The level stays in the fluid byte with `frozen` set. Creatures
   * on the tile move to the nearest walkable tile within 2, else die "frozen in the ice".
   */
  freeze(t: TileIndex, ctx: FreezeContext): void {
    const map = this.map;
    const sim = this.sim;
    const below = map.below(t);
    const kind = sim.level(t) >= ICE_WALL_LEVEL ? TileKind.Wall : below >= 0 && isSolidBottomed(map.kindAt(below)) ? TileKind.Floor : TileKind.Wall;
    this.original.set(t, { kind: map.kindAt(t), material: map.materialAt(t), ice: kind });
    sim.deactivate(t);
    map.fluid[t] = ((map.fluid[t] ?? 0) as number) | FLUID_FROZEN_BIT;
    sim.eqCount[t] = 0;
    map.markChunkDirty(t, true, true);
    ctx.terrain.setKind(t, kind, this.host.ice);
    this.displace(t, ctx);
    ctx.emit({ type: 'TileFrozen', tile: t });
  }

  /** `thaw(i)`: the kind and material it had before, the frozen bit cleared, the tile touched. */
  thaw(t: TileIndex, ctx: FreezeContext): void {
    const map = this.map;
    const was = this.original.get(t) ?? { kind: TileKind.Open, material: 0 };
    this.original.delete(t);
    ctx.terrain.setKind(t, was.kind, was.material);
    map.fluid[t] = ((map.fluid[t] ?? 0) as number) & ~FLUID_FROZEN_BIT;
    this.sim.eqCount[t] = 0;
    map.markChunkDirty(t, true, true);
    this.sim.touch(t);
    ctx.emit({ type: 'TileThawed', tile: t });
  }

  /** The creatures on a freezing tile: to the nearest walkable tile within 2, else dead. */
  private displace(t: TileIndex, ctx: FreezeContext): void {
    const here = this.host.creaturesAt(t);
    if (here.length === 0) return;
    const map = this.map;
    const { x, y, z } = map.unpack(t);
    for (const id of here.slice()) {
      const cls = this.host.movementClassOf(id);
      let target = -1;
      for (let r = 1; r <= 2 && target < 0; r += 1) {
        for (let dz = -r; dz <= r && target < 0; dz += 1) {
          for (let dy = -r; dy <= r && target < 0; dy += 1) {
            for (let dx = -r; dx <= r && target < 0; dx += 1) {
              if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
              if (!map.inBounds(x + dx, y + dy, z + dz)) continue;
              const j = map.index(x + dx, y + dy, z + dz);
              if (this.host.walkable(j, cls)) target = j;
            }
          }
        }
      }
      const movement = this.host.movement();
      if (target >= 0 && movement !== null) movement.teleport(id, target);
      else ctx.emit({ type: 'CreatureDied', id, cause: 'frozen', killerId: 0 });
    }
  }
}
