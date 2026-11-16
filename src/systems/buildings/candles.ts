/**
 * `14` § Candle stands and lanterns: a built `candle_stand` holds up to `STAND_CANDLES` candles (13
 * fills it by § Building wants) and burns the first, `CANDLE_DAYS_TALLOW` or `CANDLE_DAYS_WAX` days
 * counted on `DayPassed` (`Building.burnDays`); while it holds a candle it lights its 3×3 for comfort.
 * A built `lantern` lights its 3×3 forever. Neither sets the map's `lit` flag: this is comfort light,
 * not crop light. The lit tiles are a cache of the buildings, rebuilt when a building record changes.
 */

import { C, type Building } from '@core/components';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingStore } from './build';
import { CANDLE_DAYS_TALLOW, CANDLE_DAYS_WAX } from './constants';

export const CANDLE_STAND = 'candle_stand';
export const LANTERN = 'lantern';
/** The candle material that burns long and clean (`materials.md`). */
export const BEESWAX = 'beeswax';

/** A tile's comfort light from stands and lanterns: `CLEAN` from a lantern or a beeswax stand, `TALLOW` from a tallow stand. */
export const CLEAN = 1;
export const TALLOW = 2;

/** A stand's panel line (`buildings.standCandles(id)`). */
export interface StandView {
  /** The candle units it holds. */
  readonly candles: number;
  /** The burning candle's material id, '' with none. */
  readonly burning: string;
  /** The days the burning candle has left (0 with none). */
  readonly daysLeft: number;
}

export class CandleStore {
  private cache: { revision: number; tiles: Map<TileIndex, number> } | null = null;

  constructor(private readonly store: BuildingStore) {}

  private typeId(b: Building): string {
    return this.store.row(b.type).id;
  }

  /** The units of the candles a stand holds, in its order. */
  candles(b: Building): number {
    const entities = this.store.host.entities;
    return this.store.heldOf(b).reduce((n, it) => n + (entities.get(it, C.Item)?.count ?? 1), 0);
  }

  /** The material id of the candle a built stand burns (its first held), '' with none. */
  burningMaterial(b: Building): string {
    if (b.state !== 'built' || this.typeId(b) !== CANDLE_STAND) return '';
    const first = this.store.heldOf(b)[0];
    const material = first === undefined ? undefined : this.store.host.entities.get(first, C.Item)?.material;
    if (material === undefined) return '';
    return this.store.host.registry.table<{ id: string }>('materials').byIndex(material)?.id ?? '';
  }

  /** The days a candle of the material burns: beeswax `CANDLE_DAYS_WAX`, anything else as tallow. */
  static daysOf(material: string): number {
    return material === BEESWAX ? CANDLE_DAYS_WAX : CANDLE_DAYS_TALLOW;
  }

  view(id: EntityId): StandView | undefined {
    const b = this.store.get(id);
    if (b === undefined || this.typeId(b) !== CANDLE_STAND) return undefined;
    const burning = this.burningMaterial(b);
    return { candles: this.candles(b), burning,
      daysLeft: burning === '' ? 0 : Math.max(0, CandleStore.daysOf(burning) - (b.burnDays ?? 0)) };
  }

  /** The stand and lantern light on a tile: `CLEAN | TALLOW` bits, 0 for none. */
  at(i: TileIndex): number {
    return this.tiles().get(i) ?? 0;
  }

  private tiles(): Map<TileIndex, number> {
    const revision = this.store.host.entities.revision(C.Building);
    if (this.cache !== null && this.cache.revision === revision) return this.cache.tiles;
    const tiles = new Map<TileIndex, number>();
    const map = this.store.host.map;
    for (const id of this.store.all()) {
      const b = this.store.get(id) as Building;
      if (b.state !== 'built') continue;
      const type = this.typeId(b);
      let bit = 0;
      if (type === LANTERN) bit = CLEAN;
      else if (type === CANDLE_STAND) {
        const burning = this.burningMaterial(b);
        bit = burning === '' ? 0 : burning === BEESWAX ? CLEAN : TALLOW;
      }
      if (bit === 0) continue;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const t = map.offset(b.origin, dx, dy, 0);
        if (t >= 0) tiles.set(t, (tiles.get(t) ?? 0) | bit);
      }
    }
    this.cache = { revision, tiles };
    return tiles;
  }

  /**
   * `DayPassed`: each built stand holding a candle burns a day of its first; a candle whose days are
   * spent is consumed (one unit of the stack) and the next is lit. Stands in ascending id.
   */
  dayPassed(ctx: TickContext): void {
    const entities = this.store.host.entities;
    for (const id of this.store.all().slice().sort((a, b) => a - b)) {
      const b = this.store.get(id) as Building;
      if (b.state !== 'built' || this.typeId(b) !== CANDLE_STAND) continue;
      const material = this.burningMaterial(b);
      if (material === '') {
        if (b.burnDays !== undefined) this.write(id, b, 0);
        continue;
      }
      const days = (b.burnDays ?? 0) + 1;
      if (days < CandleStore.daysOf(material)) { this.write(id, b, days); continue; }
      const first = this.store.heldOf(b)[0] as EntityId;
      ctx.world.services.items?.consume(first, 1);
      const living = (b.held ?? []).filter((it) => entities.has(it, C.Item));
      this.write(id, { ...b, held: living }, 0);
    }
  }

  private write(id: EntityId, b: Building, burnDays: number): void {
    const next: Building = { ...b };
    if (burnDays > 0) next.burnDays = burnDays;
    else delete next.burnDays;
    this.store.host.entities.add(id, C.Building, next);
  }
}
