/**
 * 14 § Burial, Coffins ready: a tomb keeps its own coffins standing. Each day, while fewer free
 * coffins stand in a tomb than its `coffins ready` setting, coffin items from stock are placed on its
 * free tiles, farthest from its way in first, never on a tile whose filling would cut another of its
 * tiles off from the way in. What stock cannot answer is the tomb's shortfall, which 12 answers with
 * a standing coffin order (`tombShortfalls`).
 */
import type { EntityId, TileIndex } from '@core/types';
import { TileKind } from '@core/map3d';
import type { BuildingRow, BuildingStore } from './build';
import type { ZoneStore } from './zones';
import { TOMB_COFFINS_READY } from './constants';

/** A tomb that lacks coffins stock cannot give it: 12's standing order makes `short` of them. */
export interface TombShortfall {
  readonly zoneId: EntityId;
  /** Coffins the tomb still lacks after the coffins in stock, at least 1. */
  readonly short: number;
}

const TOMB = 'tomb';
/** The tomb's setting (`SetZoneSetting` key) for the coffins it keeps ready. */
export const COFFINS_READY_SETTING = 'coffins_ready';

export class TombKeeper {
  constructor(private readonly zones: ZoneStore, private readonly buildings: BuildingStore,
    /** 13's available units under a filter (`countAvailable`), 0 without 13. */
    private readonly countAvailable: (filter: Record<string, unknown>) => number) {}

  /** The building type tagged `coffin` (the coffin), or undefined. */
  private coffinRow(): BuildingRow | undefined {
    return this.buildings.rowsList().find((row) => row.tags.includes('coffin'));
  }

  /** The tombs, ascending id. */
  tombs(): EntityId[] {
    return this.zones.all().filter((id) => this.zones.typeIdOf(id) === TOMB);
  }

  /** The coffins a tomb keeps ready: its setting, or `TOMB_COFFINS_READY`, never more than its tiles. */
  wanted(zoneId: EntityId): number {
    const zone = this.zones.zone(zoneId);
    if (zone === undefined) return 0;
    const raw = zone.settings[COFFINS_READY_SETTING];
    const set = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : TOMB_COFFINS_READY;
    return Math.min(set, zone.tiles.length);
  }

  /**
   * The coffins that stand ready in a tomb: built with no body and kept for anyone, or placed and
   * not built yet (a coffin on its way).
   */
  ready(zoneId: EntityId): number {
    const zone = this.zones.zone(zoneId);
    if (zone === undefined) return 0;
    const tiles = new Set(zone.tiles);
    let n = 0;
    for (const id of this.coffinBuildings()) {
      const b = this.buildings.get(id);
      if (b === undefined || !tiles.has(b.origin)) continue;
      if (b.state !== 'built') n += 1;
      else if ((b.settings['occupantId'] as number | undefined ?? 0) === 0 && b.ownerId === 0) n += 1;
    }
    return n;
  }

  /** Every coffin building, placed or built, ascending id. */
  private coffinBuildings(): EntityId[] {
    const row = this.coffinRow();
    if (row === undefined) return [];
    const type = this.buildings.typeOf(row.id);
    return this.buildings.all().filter((id) => this.buildings.get(id)?.type === type);
  }

  /**
   * The coffin items stock can give a tomb: the available coffins (13's count, no body inside)
   * less the coffins placed anywhere and not built yet, which will take some of them.
   */
  stock(): number {
    const row = this.coffinRow();
    const match = row?.inputs[0]?.match;
    if (row === undefined || match === undefined) return 0;
    const types = this.buildings.typesOf(match);
    if (types.length === 0) return 0;
    const unbuilt = this.coffinBuildings().filter((id) => this.buildings.get(id)?.state !== 'built').length;
    return Math.max(0, this.countAvailable({ types, unoccupied: true }) - unbuilt);
  }

  /** Each tomb's coffins short after stock, tombs in id order taking stock first; tombs short of none are left out. */
  shortfalls(): TombShortfall[] {
    let stock = this.stock();
    const out: TombShortfall[] = [];
    for (const zoneId of this.tombs()) {
      const need = Math.max(0, this.wanted(zoneId) - this.ready(zoneId));
      const given = Math.min(need, stock);
      stock -= given;
      if (need - given > 0) out.push({ zoneId, short: need - given });
    }
    return out;
  }

  /** `DayPassed`: each tomb in id order places coffins from stock up to its setting. */
  dayPassed(place: (origin: TileIndex, buildingType: string) => boolean): void {
    const row = this.coffinRow();
    if (row === undefined) return;
    let stock = this.stock();
    for (const zoneId of this.tombs()) {
      let need = Math.max(0, this.wanted(zoneId) - this.ready(zoneId));
      while (need > 0 && stock > 0) {
        const tile = this.site(zoneId, row.id);
        if (tile < 0 || !place(tile, row.id)) break;
        need -= 1;
        stock -= 1;
      }
    }
  }

  /**
   * The tile of a tomb where the next coffin goes, or -1. The way in is every walkable tile of the
   * ring around the tomb (same level, its corners too) and every walkable tomb tile that is not a
   * plain floor (a stair); its tiles join one another side to side. A tile is taken only when, with it filled, every other walkable tomb tile still joins the
   * way in, the tomb and its way in fall into no more separate parts than before, and every coffin in
   * the tomb keeps a walkable side. Of those, the farthest from the way in goes first, so the tiles
   * nearest it fill last.
   */
  site(zoneId: EntityId, typeId: string): TileIndex {
    const zone = this.zones.zone(zoneId);
    if (zone === undefined) return -1;
    const map = this.buildings.host.map;
    const walkable = (t: TileIndex): boolean => this.buildings.host.walkable(t);
    const inTomb = new Set(zone.tiles);
    const sides = (t: TileIndex): TileIndex[] => {
      const out: TileIndex[] = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = map.offset(t, dx, dy, 0);
        if (n >= 0) out.push(n);
      }
      return out;
    };
    // A tomb tile one can walk through: walkable, and no building on it but one that lets walkers by.
    const through = (t: TileIndex): boolean => {
      if (!walkable(t)) return false;
      const id = map.buildingAtTile(t);
      if (id === 0) return true;
      const b = this.buildings.get(id);
      return b !== undefined && this.buildings.row(b.type).passable === true;
    };
    // The way in: the walkable ring around the tomb (its corners too, so ground open around a tomb
    // joins up around it), and the tomb's stairs.
    const entries = new Set<TileIndex>();
    for (const t of zone.tiles) {
      if (through(t) && map.kindAt(t) !== TileKind.Floor) entries.add(t);
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const n = map.offset(t, dx, dy, 0);
        if (n >= 0 && !inTomb.has(n) && walkable(n)) entries.add(n);
      }
    }
    if (entries.size === 0) return -1;
    const pass = zone.tiles.filter((t) => through(t));
    const blocked = zone.tiles.filter((t) => map.buildingAtTile(t) !== 0 && !through(t));
    // The parts of the way in and the walkable tomb tiles, without `without`: each tile's part, and how many.
    const parts = (without: TileIndex): { of: Map<TileIndex, number>; n: number; entered: Set<number> } => {
      const open = new Set<TileIndex>([...entries, ...pass]);
      open.delete(without);
      const of = new Map<TileIndex, number>();
      const entered = new Set<number>();
      let n = 0;
      for (const start of [...open].sort((a, b) => a - b)) {
        if (of.has(start)) continue;
        n += 1;
        const queue = [start];
        of.set(start, n);
        while (queue.length > 0) {
          const f = queue.pop() as TileIndex;
          if (entries.has(f)) entered.add(n);
          // A step out of the tomb stays beside it: the way in joins only through the tomb or itself.
          for (const s of sides(f)) if (open.has(s) && !of.has(s)) { of.set(s, n); queue.push(s); }
        }
      }
      return { of, n, entered };
    };
    // Steps from the way in over the walkable tomb tiles.
    const dist = new Map<TileIndex, number>();
    let frontier = [...entries].sort((a, b) => a - b);
    const passSet = new Set(pass);
    for (let d = 1; frontier.length > 0; d += 1) {
      const next: TileIndex[] = [];
      for (const f of frontier) for (const s of sides(f)) if (passSet.has(s) && !entries.has(s) && !dist.has(s)) { dist.set(s, d); next.push(s); }
      frontier = next;
    }
    const before = parts(-1);
    const candidates = pass.filter((t) => map.buildingAtTile(t) === 0 && map.kindAt(t) === TileKind.Floor && !entries.has(t) && dist.has(t))
      .sort((a, b) => (dist.get(b) as number) - (dist.get(a) as number) || a - b);
    for (const t of candidates) {
      const after = parts(t);
      if (after.n > before.n) continue;
      if (pass.some((p) => p !== t && !after.entered.has(after.of.get(p) ?? -1))) continue;
      const coffins = [...blocked.filter((c) => sides(c).some((s) => before.of.has(s))), t];
      if (!coffins.every((c) => sides(c).some((s) => s !== t && after.of.has(s)))) continue;
      if (this.buildings.ghost(typeId, t, 0).reason !== null) continue;
      return t;
    }
    return -1;
  }
}
