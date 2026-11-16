/**
 * 08's hives: `02-systems/08-animals-and-domestication.md` § Hives.
 *
 * A built `beehive` with enough flowers in reach (07's `plants.flowerAt`) adds a `honeycomb` to
 * itself every `HIVE_DAYS` from spring to autumn, up to `HIVE_CAPACITY`. The comb lies in the hive
 * reserved, as an egg lies in its nest box, until `collect_honey` lifts it out. The collector is
 * stung now and then, and in summer so is anyone who stands near a hive at the hour. Every draw is
 * on 08's stream and is made only where a hive is, so a fortress with no hive draws as before.
 */

import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { RngStream } from '@core/rng';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';
import type { PlantsReader } from '@systems/plants';
import {
  HIVE_CAPACITY,
  HIVE_DAYS,
  HIVE_FLOWERS_MIN,
  HIVE_FLOWER_RADIUS,
  HIVE_PASSER_PERMILLE,
  HIVE_STING_RADIUS,
  HIVE_TAG,
  HONEYCOMB_ITEM,
  HONEY_MATERIAL,
  STING_PERMILLE,
  STING_SOURCE_BEES,
} from './constants';

/** The winter season index (`core/calendar`): a hive in winter is silent. */
const WINTER = 3;
/** The summer season index: the season passers-by are stung in. */
const SUMMER = 1;

export interface HivesHost {
  readonly rng: RngStream;
  buildings(): BuildingsReader | null;
  plants(): PlantsReader | null;
  dwarves(): DwarvesReader | null;
}

export class Hives {
  /** Built hives, ascending id (`AnimalsState.hives`). */
  readonly ids: EntityId[] = [];
  /** Combs lying in a hive: comb item → its hive (`AnimalsState.combs`). */
  readonly combs = new Map<EntityId, EntityId>();

  constructor(private readonly host: HivesHost) {}

  /** A building that completed: kept when it is a hive. */
  built(id: EntityId): void {
    const buildings = this.host.buildings();
    if (buildings === null || !buildings.byTag(HIVE_TAG).includes(id) || this.ids.includes(id)) return;
    this.ids.push(id);
    this.ids.sort((a, b) => a - b);
  }

  /** A hive that goes lets its combs go to ordinary hauling. */
  removed(id: EntityId, ctx: { world: TickContext['world'] }): void {
    const at = this.ids.indexOf(id);
    if (at < 0) return;
    this.ids.splice(at, 1);
    for (const [comb, hive] of Array.from(this.combs.entries()).sort((a, b) => a[0] - b[0])) {
      if (hive !== id) continue;
      this.combs.delete(comb);
      if (ctx.world.entities.alive(comb)) ctx.world.services.items?.release(comb);
    }
  }

  /** The combs lying in a hive, ascending. */
  combsOf(hive: EntityId, alive: (id: EntityId) => boolean): EntityId[] {
    const out: EntityId[] = [];
    for (const [comb, h] of this.combs) if (h === hive && alive(comb)) out.push(comb);
    return out.sort((a, b) => a - b);
  }

  /** The hive's origin tile, or -1. */
  tileOf(hive: EntityId): TileIndex {
    const b = this.host.buildings()?.get(hive);
    return b === undefined || b.state !== 'built' ? -1 : b.origin;
  }

  /** `animals.hiveFlowers(id)`: the flower tiles within `HIVE_FLOWER_RADIUS` of the hive, on its level. */
  flowers(hive: EntityId, map: TickContext['world']['map']): number {
    const plants = this.host.plants();
    const at = this.tileOf(hive);
    if (plants === null || at < 0) return 0;
    const x0 = map.xOf(at);
    const y0 = map.yOf(at);
    const z = map.zOf(at);
    let n = 0;
    for (let y = Math.max(0, y0 - HIVE_FLOWER_RADIUS); y <= Math.min(map.h - 1, y0 + HIVE_FLOWER_RADIUS); y += 1) {
      for (let x = Math.max(0, x0 - HIVE_FLOWER_RADIUS); x <= Math.min(map.w - 1, x0 + HIVE_FLOWER_RADIUS); x += 1) {
        if (plants.flowerAt(map.index(x, y, z))) n += 1;
      }
    }
    return n;
  }

  /**
   * `DayPassed`, from spring to autumn: a hive whose day has come, with room for a comb and flowers
   * enough, adds one comb to itself, reserved so no hauler takes it.
   */
  daily(ctx: TickContext): void {
    if (this.ids.length === 0) return;
    const entities = ctx.world.entities;
    for (const [comb] of Array.from(this.combs.entries())) if (!entities.alive(comb)) this.combs.delete(comb);
    if (ctx.readers.calendar.season === WINTER) return;
    const items = ctx.registry.table<{ id: string }>('items');
    const materials = ctx.registry.table<{ id: string }>('materials');
    if (!items.has(HONEYCOMB_ITEM) || !materials.has(HONEY_MATERIAL)) return;
    const day = Math.floor(ctx.tick / TICKS_PER_DAY);
    for (const hive of this.ids) {
      if ((day + hive) % HIVE_DAYS !== 0) continue;
      const at = this.tileOf(hive);
      if (at < 0) continue;
      if (this.combsOf(hive, (id) => entities.alive(id)).length >= HIVE_CAPACITY) continue;
      if (this.flowers(hive, ctx.world.map) < HIVE_FLOWERS_MIN) continue;
      const comb = ctx.spawn.item(items.index(HONEYCOMB_ITEM), materials.index(HONEY_MATERIAL), at, 1, 1);
      if (comb === 0) continue;
      ctx.world.services.items?.reserve(comb, 0);
      this.combs.set(comb, hive);
    }
  }

  /**
   * `HourPassed` in summer: every fortress dwarf within `HIVE_STING_RADIUS` of a built hive, on its
   * level, ascending id, is stung with `HIVE_PASSER_PERMILLE` (one draw a dwarf, however many hives).
   */
  hourly(ctx: TickContext): void {
    if (this.ids.length === 0 || ctx.readers.calendar.season !== SUMMER) return;
    const dwarves = this.host.dwarves();
    if (dwarves === null) return;
    const map = ctx.world.map;
    const tiles = this.ids.map((hive) => this.tileOf(hive)).filter((t) => t >= 0);
    if (tiles.length === 0) return;
    for (const id of dwarves.list()) {
      const p = ctx.world.entities.get(id, C.Position);
      if (p === undefined) continue;
      const near = tiles.some((t) => map.zOf(t) === p.z &&
        Math.max(Math.abs(map.xOf(t) - p.x), Math.abs(map.yOf(t) - p.y)) <= HIVE_STING_RADIUS);
      if (!near) continue;
      if (this.host.rng.chance(HIVE_PASSER_PERMILLE)) ctx.emit({ type: 'Stung', id, source: STING_SOURCE_BEES });
    }
  }

  /** `collect_honey` done: the collector is stung with `STING_PERMILLE`. */
  stingCollector(workerId: EntityId, emit: TickContext['emit']): void {
    if (this.host.rng.chance(STING_PERMILLE)) emit({ type: 'Stung', id: workerId, source: STING_SOURCE_BEES });
  }

  serialize(): { hives?: EntityId[]; combs?: [EntityId, EntityId][] } {
    return {
      ...(this.ids.length === 0 ? {} : { hives: this.ids.slice() }),
      ...(this.combs.size === 0 ? {} : {
        combs: Array.from(this.combs.entries()).sort((a, b) => a[0] - b[0]).map(([c, h]): [EntityId, EntityId] => [c, h]),
      }),
    };
  }

  deserialize(state: { hives?: EntityId[]; combs?: [EntityId, EntityId][] }): void {
    this.ids.length = 0;
    this.ids.push(...(state.hives ?? []));
    this.combs.clear();
    for (const [c, h] of state.combs ?? []) this.combs.set(c, h);
  }
}
