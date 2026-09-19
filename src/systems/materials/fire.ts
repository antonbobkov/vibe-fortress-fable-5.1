/**
 * Fire: `02-systems/05-materials-and-temperature.md` § Fire, and
 * `04-implementation/algorithms/environment.md` § Fire.
 *
 * Every change of the `burning` flag happens in the materials tick (step 2 of the tick), never in
 * event dispatch: `burning` blocks every movement class (22), so the flag marks the chunk for the
 * connectivity relabel of the same tick (D-082, D-089). Ignitions that events ask for (magma
 * beside a burnable tile, lightning) wait in `pendingIgnite` for the next materials tick. D-096.
 */

import { C } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { GameEvent } from '@core/events';
import { FLUID_FROZEN_BIT, FLUID_LEVEL_MASK, FLUID_TYPE_BIT, TileFlag, TileKind, type Map3D } from '@core/map3d';
import type { RngStream } from '@core/rng';
import type { ItemsApi, TerrainApi } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import {
  BURN_TICK_DAMAGE,
  FIRE_SPREAD_COOLDOWN,
  FIRE_SPREAD_PERMILLE,
  FIRE_SPREAD_WET_PERMILLE,
  ITEM_BURN_TICKS,
  MATERIALS_CADENCE,
  PLANT_BURN_TICKS,
  RAIN_EXTINGUISH_PERMILLE,
} from './constants';
import type { BurningState } from './state';

export interface FireHost {
  readonly map: Map3D;
  readonly entities: EntityStore;
  readonly rng: RngStream;
  /** Material class, burnable flag and burn duration by material index. */
  classOf(material: number): string;
  burnable(material: number): boolean;
  burnTicks(material: number): number;
  /** Everything standing or lying on a tile. */
  entitiesAt(i: TileIndex): readonly EntityId[];
  /** 06's state is `rain` or `storm`. */
  raining(): boolean;
  /** A burning tile is a temperature source: its reach is recomputed. */
  sourceChanged(i: TileIndex): void;
}

export interface FireContext {
  readonly terrain: TerrainApi;
  readonly items: ItemsApi | null;
  emit(event: GameEvent): void;
}

/** The four cardinal neighbours and the tile above, the spread targets of `05` § Fire. */
function spreadTargets(map: Map3D, i: TileIndex): TileIndex[] {
  const out: TileIndex[] = [];
  for (const [dx, dy, dz] of [
    [0, -1, 0],
    [1, 0, 0],
    [0, 1, 0],
    [-1, 0, 0],
    [0, 0, 1],
  ] as const) {
    const j = map.offset(i, dx, dy, dz);
    if (j >= 0) out.push(j);
  }
  return out;
}

export class Fire {
  readonly host: FireHost;
  readonly burning = new Map<TileIndex, BurningState>();
  /** Burn timers of burnable items on burning tiles (`ITEM_BURN_TICKS`). */
  readonly itemBurn = new Map<EntityId, number>();
  /** Tiles to ignite at the next materials tick if they are burnable: magma beside them or lightning. */
  readonly pendingIgnite = new Set<TileIndex>();

  constructor(host: FireHost) {
    this.host = host;
  }

  private get map(): Map3D {
    return this.host.map;
  }

  /**
   * `burnableTile(T)`: a `tree`, `sapling` or `shrub`, a `floor` with `grass`, or a burnable soil
   * (peat) outdoors, since "Cave flora is not burnable" and "Fire never burns underground except on
   * wooden constructions and items"; a constructed tile of wood anywhere.
   */
  burnableTile(i: TileIndex): boolean {
    const map = this.map;
    const kind = map.kindAt(i);
    const material = map.materialAt(i);
    if (map.hasFlag(i, TileFlag.Constructed)) return this.host.classOf(material) === 'wood' && kind !== TileKind.Open;
    if (!map.hasFlag(i, TileFlag.Outdoor)) return false;
    if (kind === TileKind.Tree || kind === TileKind.Sapling || kind === TileKind.Shrub) return true;
    if (kind === TileKind.Floor && map.hasFlag(i, TileFlag.Grass)) return true;
    return (kind === TileKind.Floor || kind === TileKind.Wall) && this.host.classOf(material) === 'soil' && this.host.burnable(material);
  }

  /**
   * The burn duration of a tile: its material's `burnTicks` ("the burn duration of a tile made of
   * it"); a tile burning for its plants (grass, a shrub) whose material gives none burns for
   * `PLANT_BURN_TICKS` (D-097).
   */
  burnTicksOf(i: TileIndex): number {
    const t = this.host.burnTicks(this.map.materialAt(i));
    return t > 0 ? t : PLANT_BURN_TICKS;
  }

  private hasWater(i: TileIndex): boolean {
    const f = (this.map.fluid[i] ?? 0) as number;
    return (f & FLUID_LEVEL_MASK) > 0 && (f & FLUID_TYPE_BIT) === 0 && (f & FLUID_FROZEN_BIT) === 0;
  }

  /** `ignite(T)`: burning, the flag through the terrain API, the chunk dirtied for 22. */
  ignite(i: TileIndex, ctx: FireContext): void {
    if (this.burning.has(i)) return;
    this.burning.set(i, { remainingTicks: this.burnTicksOf(i), spreadCooldown: 0 });
    ctx.terrain.setFlag(i, TileFlag.Burning, true);
    this.map.markChunkDirty(i, true, true);
    this.host.sourceChanged(i);
  }

  /** `extinguish(T, ash)`. */
  extinguish(i: TileIndex, ash: boolean, ctx: FireContext): void {
    if (!this.burning.delete(i)) return;
    ctx.terrain.setFlag(i, TileFlag.Burning, false);
    if (ash) ctx.terrain.setFlag(i, TileFlag.Ash, true);
    this.map.markChunkDirty(i, true, true);
    this.host.sourceChanged(i);
  }

  /**
   * `burnOut(T)`: a tree, sapling or shrub becomes a `floor` of the ground below with `ash` and no
   * `grass`; a grass floor loses `grass` and gains `ash`; a wooden construction is removed as a
   * `remove` would (03), with no item returned; the tile goes out with ash.
   */
  private burnOut(i: TileIndex, ctx: FireContext): void {
    const map = this.map;
    const kind = map.kindAt(i);
    const terrain = ctx.terrain;
    if (map.hasFlag(i, TileFlag.Constructed)) {
      const below = map.below(i);
      const naturalRockBelow = below >= 0 && map.kindAt(below) === TileKind.Wall && !map.hasFlag(below, TileFlag.Constructed);
      terrain.setFlag(i, TileFlag.Constructed, false);
      if (kind === TileKind.Floor && naturalRockBelow) terrain.setKind(i, TileKind.Floor, map.materialAt(below));
      else terrain.setKind(i, TileKind.Open, 0);
    } else if (kind === TileKind.Tree || kind === TileKind.Sapling || kind === TileKind.Shrub) {
      const below = map.below(i);
      terrain.setKind(i, TileKind.Floor, below >= 0 ? map.materialAt(below) : map.materialAt(i));
    }
    terrain.setFlag(i, TileFlag.Grass, false);
    this.extinguish(i, map.kindAt(i) !== TileKind.Open, ctx);
  }

  /** One materials tick of fire, over the burning tiles in ascending order. */
  tick(ctx: FireContext): void {
    const map = this.map;
    const rng = this.host.rng;
    const started: TileIndex[] = [];
    const spread: TileIndex[] = [];
    const out: TileIndex[] = [];
    // Ignitions asked for since the last tick (magma, lightning): these ignore wet and snow.
    for (const t of Array.from(this.pendingIgnite).sort((a, b) => a - b)) {
      if (!this.burning.has(t) && this.burnableTile(t) && !this.hasWater(t)) {
        this.ignite(t, ctx);
        started.push(t);
      }
    }
    this.pendingIgnite.clear();
    const raining = this.host.raining();
    for (const t of Array.from(this.burning.keys()).sort((a, b) => a - b)) {
      const s = this.burning.get(t);
      if (s === undefined || started.includes(t) || spread.includes(t)) continue;
      // A tile that stopped being burnable (dug, built over) stops burning (`TilesChanged`).
      if (!this.burnableTile(t)) {
        this.extinguish(t, false, ctx);
        out.push(t);
        continue;
      }
      s.remainingTicks -= MATERIALS_CADENCE;
      if (raining && map.hasFlag(t, TileFlag.Outdoor) && rng.chance(RAIN_EXTINGUISH_PERMILLE * MATERIALS_CADENCE)) {
        this.extinguish(t, false, ctx);
        out.push(t);
        continue;
      }
      if (this.hasWater(t)) {
        this.extinguish(t, false, ctx);
        out.push(t);
        continue;
      }
      if (s.spreadCooldown > 0) {
        s.spreadCooldown -= MATERIALS_CADENCE;
      } else {
        for (const n of spreadTargets(map, t)) {
          if (this.burning.has(n) || !this.burnableTile(n)) continue;
          if (map.hasFlag(n, TileFlag.Wet) || map.hasFlag(n, TileFlag.Snow) || this.hasWater(n)) continue;
          if (rng.chance(raining ? FIRE_SPREAD_WET_PERMILLE : FIRE_SPREAD_PERMILLE)) {
            this.ignite(n, ctx);
            spread.push(n);
          }
        }
        s.spreadCooldown = FIRE_SPREAD_COOLDOWN;
      }
      this.burnThings(t, ctx);
      if (s.remainingTicks <= 0) {
        this.burnOut(t, ctx);
        out.push(t);
      }
    }
    // Item timers of items that are no longer on a burning tile lapse.
    for (const id of Array.from(this.itemBurn.keys())) {
      const p = this.host.entities.get(id, C.Position);
      if (p === undefined || !this.burning.has(map.index(p.x, p.y, p.z))) this.itemBurn.delete(id);
    }
    for (const t of started) ctx.emit({ type: 'FireStarted', tile: t });
    if (spread.length > 0) ctx.emit({ type: 'FireSpread', tiles: spread.sort((a, b) => a - b) });
    if (out.length > 0) ctx.emit({ type: 'FireOut', tiles: out.sort((a, b) => a - b) });
  }

  /** Items on a burning tile burn after `ITEM_BURN_TICKS`; creatures take `BurnDamage`. */
  private burnThings(t: TileIndex, ctx: FireContext): void {
    const entities = this.host.entities;
    for (const id of this.host.entitiesAt(t).slice()) {
      const kind = entities.kind(id);
      if (kind === 'creature') {
        ctx.emit({ type: 'BurnDamage', id, amount: BURN_TICK_DAMAGE });
        continue;
      }
      if (kind !== 'item') continue;
      const item = entities.get(id, C.Item);
      if (item === undefined || !this.host.burnable(item.material)) continue;
      const left = (this.itemBurn.get(id) ?? ITEM_BURN_TICKS) - MATERIALS_CADENCE;
      if (left > 0) {
        this.itemBurn.set(id, left);
        continue;
      }
      this.itemBurn.delete(id);
      // The container burns, then its contents follow the rule (they lie on the tile once it is gone).
      ctx.items?.destroy(id, 'burned');
    }
  }
}
