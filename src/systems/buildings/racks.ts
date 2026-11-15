/**
 * `14` § The drying rack: what it wants (its setting's drying rows, `items.md` § Drying), the days its
 * held items gain on each `DayPassed` by the day's weather, and their dried forms. 13 hauls to it by
 * the rule of § Building wants; nobody works it.
 */
import { C, type Building } from '@core/components';
import { reject, OK, type Command, type CommandResult } from '@core/commands';
import { TileFlag } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import type { BuildingStore } from './build';
import { RACK_CAPACITY } from './constants';

/** A row of `items.md` § Drying. */
export interface DryingRow {
  readonly id: string;
  readonly input: string;
  readonly material?: string;
  readonly count: number;
  readonly with?: { readonly item: string; readonly count: number };
  readonly output: { readonly item: string; readonly count: number };
  readonly days: number;
}

/** One concrete want of a building that holds items, as 13 hauls to it (13 § Buildings that want items). */
export interface HolderWantView {
  readonly types: readonly number[];
  readonly count: number;
  readonly materials?: readonly number[];
  readonly pool?: number;
  readonly units?: boolean;
}

/** One held item of a rack with its drying days (the panel's line). */
export interface RackItemView {
  readonly itemId: EntityId;
  /** The drying row that takes it; '' for a second input (a hide's salt). */
  readonly row: string;
  readonly days: number;
  /** Days left until it is dry; 0 when it waits (for its group, or for salt). */
  readonly left: number;
}

/** A building row's tag that makes it a drying rack. */
export const RACK_TAG = 'rack';
/** The `wants` match of a rack: the drying rows its setting takes (`buildings-and-furniture.md` § Special). */
export const DRYING_MATCH = 'drying';
/** The building setting that names a rack's drying rows; absent: every row. */
const DRYING_SETTING = 'drying';
/** The pool a rack's drying wants share (`RACK_CAPACITY` units over them all). */
const DRYING_POOL = 1;
/** 06's states that count as a wet day for an outdoor rack. */
const WET_STATES: readonly string[] = ['rain', 'storm', 'snow'];

/** The day's weather so far, as an outdoor rack counts it. */
export interface RackDay { notClear: boolean; wet: boolean }

export class RackStore {
  /** The weather of the day so far (§ The drying rack); kept only while a rack is built. */
  day: RackDay | null = null;
  private rowsCache: DryingRow[] | null = null;

  constructor(private readonly store: BuildingStore, private readonly weather: () => string | null) {}

  private get registry() { return this.store.host.registry; }

  /** Every drying row, in table order ([] when the content has none). */
  rows(): DryingRow[] {
    if (this.rowsCache === null) {
      const registry = this.registry;
      if (!registry.hasTable('drying')) this.rowsCache = [];
      else {
        const table = registry.table<DryingRow>('drying');
        const out: DryingRow[] = [];
        for (let k = 1; k <= table.size; k += 1) {
          const row = table.byIndex(k);
          if (row !== undefined) out.push(row);
        }
        this.rowsCache = out;
      }
    }
    return this.rowsCache;
  }

  isRack(b: Building | undefined): b is Building {
    return b !== undefined && this.store.row(b.type).tags.includes(RACK_TAG);
  }

  /** Built racks, ascending. */
  racks(): EntityId[] {
    return this.store.all().filter((id) => {
      const b = this.store.get(id);
      return b?.state === 'built' && this.isRack(b);
    }).sort((a, b) => a - b);
  }

  /** The drying rows a rack takes (`SetRackDrying`; every row by default), in table order. */
  enabled(b: Building): DryingRow[] {
    const chosen = b.settings[DRYING_SETTING];
    const rows = this.rows();
    return Array.isArray(chosen) ? rows.filter((r) => chosen.includes(r.id)) : rows;
  }

  private itemType(id: string): number {
    const items = this.registry.table<{ id: string }>('items');
    return items.has(id) ? items.index(id) : 0;
  }

  private materialIndex(id: string): number {
    const materials = this.registry.table<{ id: string }>('materials');
    return materials.has(id) ? materials.index(id) : 0;
  }

  /** The enabled row that takes the item as its input. */
  rowFor(b: Building, itemId: EntityId): DryingRow | undefined {
    const it = this.store.host.entities.get(itemId, C.Item);
    if (it === undefined) return undefined;
    return this.enabled(b).find((r) => this.itemType(r.input) === it.type &&
      (r.material === undefined || this.materialIndex(r.material) === it.material));
  }

  /** The enabled row the item is a second input of (a hide's salt). */
  private withFor(b: Building, itemId: EntityId): DryingRow | undefined {
    const it = this.store.host.entities.get(itemId, C.Item);
    if (it === undefined) return undefined;
    return this.enabled(b).find((r) => r.with !== undefined && this.itemType(r.with.item) === it.type);
  }

  private units(itemId: EntityId): number {
    return this.store.host.entities.get(itemId, C.Item)?.count ?? 0;
  }

  /**
   * What 13 hauls to a rack: each enabled row's input (of its material, when it names one), up to
   * `RACK_CAPACITY` units over them all; and for a row with a second input, as many of it as the
   * units of the row's input it holds need.
   */
  wants(id: EntityId): HolderWantView[] {
    const b = this.store.get(id);
    if (b === undefined || b.state !== 'built' || !this.isRack(b)) return [];
    const held = this.store.heldOf(b);
    const out: HolderWantView[] = [];
    for (const row of this.enabled(b)) {
      const type = this.itemType(row.input);
      if (type === 0) continue;
      out.push({ types: [type], count: RACK_CAPACITY, pool: DRYING_POOL, units: true,
        ...(row.material === undefined ? {} : { materials: [this.materialIndex(row.material)] }) });
    }
    for (const row of this.enabled(b)) {
      if (row.with === undefined) continue;
      const inputs = held.filter((it) => this.rowFor(b, it)?.id === row.id).reduce((n, it) => n + this.units(it), 0);
      const type = this.itemType(row.with.item);
      if (inputs > 0 && type !== 0) out.push({ types: [type], count: inputs * row.with.count, units: true });
    }
    return out;
  }

  /** The panel's lines: each held item, its row, its days and the days left. */
  view(id: EntityId): RackItemView[] {
    const b = this.store.get(id);
    if (b === undefined || !this.isRack(b)) return [];
    const days = new Map(b.dryDays ?? []);
    return this.store.heldOf(b).map((itemId) => {
      const row = this.rowFor(b, itemId);
      const d = days.get(itemId) ?? 0;
      return { itemId, row: row?.id ?? '', days: d, left: row === undefined ? 0 : Math.max(0, row.days - d) };
    });
  }

  /** `SetRackDrying { buildingId, rows }`: which drying rows the rack takes; a held item none takes drops on its tile. */
  setDrying(cmd: Command): CommandResult {
    const id = cmd['buildingId'];
    const b = typeof id === 'number' ? this.store.get(id) : undefined;
    if (b === undefined || b.state !== 'built' || !this.isRack(b)) return reject('not_found');
    const rows = cmd['rows'];
    const all = this.rows();
    if (!Array.isArray(rows) || rows.some((r) => typeof r !== 'string' || !all.some((row) => row.id === r))) return reject('bad_setting');
    const chosen = all.filter((row) => rows.includes(row.id)).map((row) => row.id);
    const settings = { ...b.settings };
    if (chosen.length === all.length) delete settings[DRYING_SETTING];
    else settings[DRYING_SETTING] = chosen;
    const next = this.store.write(id as EntityId, { settings });
    this.releaseUntaken(id as EntityId, next);
    return OK;
  }

  /** Every held item no enabled row takes, as its input or its second input, drops on the rack's tile. */
  private releaseUntaken(id: EntityId, b: Building): void {
    const kept: EntityId[] = [];
    for (const it of this.store.heldOf(b)) {
      if (this.rowFor(b, it) !== undefined || this.withFor(b, it) !== undefined) kept.push(it);
      else this.store.host.services.items?.uninstall?.(it, b.origin);
    }
    this.writeHeld(id, kept, new Map(b.dryDays ?? []));
  }

  private writeHeld(id: EntityId, held: readonly EntityId[], days: ReadonlyMap<EntityId, number>): void {
    const dryDays = held.filter((it) => (days.get(it) ?? 0) > 0).map((it): [EntityId, number] => [it, days.get(it) as number]);
    const b = this.store.get(id) as Building;
    const patch: Partial<Building> = { held: held.slice() };
    const next = { ...b, ...patch };
    if (dryDays.length > 0) next.dryDays = dryDays;
    else delete next.dryDays;
    this.store.host.entities.add(id, C.Building, next);
  }

  // ---------- the day's weather and DayPassed ----------

  private fresh(state: string | null): RackDay {
    return { notClear: state !== null && state !== 'clear', wet: state !== null && WET_STATES.includes(state) };
  }

  /** `WeatherChanged { from, to }`: the day so far is not clear, and wet in rain, storm or snow. */
  weatherChanged(from: string, to: string): void {
    if (this.day === null) {
      if (this.racks().length === 0) return;
      this.day = this.fresh(from);
    }
    if (to !== 'clear') this.day.notClear = true;
    if (WET_STATES.includes(to)) this.day.wet = true;
  }

  /**
   * `DayPassed`: each held item of each rack gains its drying days (under a roof one; outdoors two
   * on a day clear all day, none on a wet one, else one); a dry item becomes its dried form on the
   * rack's tile, released.
   */
  dayPassed(ctx: TickContext): void {
    const racks = this.racks();
    if (racks.length === 0) { this.day = null; return; }
    const day = this.day ?? this.fresh(this.weather());
    for (const id of racks) this.dry(id, day, ctx);
    this.day = this.fresh(this.weather());
  }

  private dry(id: EntityId, day: RackDay, ctx: TickContext): void {
    const b = this.store.get(id) as Building;
    const held = this.store.heldOf(b);
    if (held.length === 0) {
      if (b.dryDays !== undefined) this.writeHeld(id, [], new Map());
      return;
    }
    const outdoor = this.store.host.map.hasFlag(b.origin, TileFlag.Outdoor);
    const gain = !outdoor ? 1 : day.wet ? 0 : day.notClear ? 1 : 2;
    const before = new Map(b.dryDays ?? []);
    const days = new Map<EntityId, number>();
    for (const it of held) {
      if (this.rowFor(b, it) === undefined) continue;
      days.set(it, (before.get(it) ?? 0) + gain);
    }
    const items = ctx.world.services.items;
    for (const row of this.enabled(b)) {
      const dry = held.filter((it) => this.store.host.entities.has(it, C.Item) && this.rowFor(b, it)?.id === row.id && (days.get(it) ?? 0) >= row.days);
      if (dry.length === 0) continue;
      const out = this.itemType(row.output.item);
      if (out === 0) continue;
      let groups = Math.floor(dry.reduce((n, it) => n + this.units(it), 0) / row.count);
      if (row.with !== undefined) {
        const salt = held.filter((it) => this.store.host.entities.has(it, C.Item) && this.withFor(b, it)?.id === row.id);
        groups = Math.min(groups, Math.floor(salt.reduce((n, it) => n + this.units(it), 0) / row.with.count));
        let need = groups * row.with.count;
        for (const it of salt) {
          if (need <= 0) break;
          const take = Math.min(need, this.units(it));
          items?.consume(it, take);
          need -= take;
        }
      }
      if (groups <= 0) continue;
      const material = this.store.host.entities.get(dry[0] as EntityId, C.Item)?.material ?? 0;
      let need = groups * row.count;
      for (const it of dry) {
        if (need <= 0) break;
        const take = Math.min(need, this.units(it));
        items?.consume(it, take);
        need -= take;
      }
      ctx.spawn.item(out, material, b.origin, groups * row.output.count, 1);
    }
    const living = held.filter((it) => this.store.host.entities.has(it, C.Item));
    this.writeHeld(id, living, days);
  }
}
