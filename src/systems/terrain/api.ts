/**
 * The terrain API of 03: `02-systems/03-terrain-and-mining.md` § Interfaces › Terrain API,
 * § Support and collapse, § Discovery, § Outdoor and lit, and `data-model.md` § Terrain API.
 *
 * Every tile change goes through {@link TerrainCore.write}, so support, discovery, the designation
 * precondition check and the outdoor/lit flags follow every change the same way, whoever asked
 * (`03` § Fluids and constructions interplay). `TilesChanged` and `TilesDiscovered` are batched and
 * flushed once per tick by the world, after every system has run.
 */

import { C } from '@core/components';
import { CAVERN_1_Z_MAX, CAVERN_1_Z_MIN, CAVERN_2_Z_MAX, CAVERN_2_Z_MIN, CAVERN_3_Z_MAX, CAVERN_3_Z_MIN } from '@core/constants';
import { Designation, TileFlag, TileKind, isSolidBottomed, type Map3D } from '@core/map3d';
import type { EntityStore } from '@core/entities';
import type { GameEvent } from '@core/events';
import type { CoreServices, TerrainApi } from '@core/system';
import type { EntityId, Priority, TileIndex } from '@core/types';
import { computeLitLevel } from './generate/light';
import type { TerrainFacts } from './facts';
import { constructionItem, isStructuralKind, isSupportKind, precondition } from './rules/transitions';
import { sortedIndexOf, sortedInsert, sortedRemove, type PendingTerrain } from './state';

/** The cavern bands of `constants.md`, index 1-3. */
export const CAVERN_BANDS: readonly (readonly [number, number])[] = [
  [0, -1],
  [CAVERN_1_Z_MIN, CAVERN_1_Z_MAX],
  [CAVERN_2_Z_MIN, CAVERN_2_Z_MAX],
  [CAVERN_3_Z_MIN, CAVERN_3_Z_MAX],
];

/** The cavern whose band holds z (1 shallowest … 3 deepest), or 0. */
export function cavernAt(z: number): number {
  for (let t = 1; t <= 3; t += 1) {
    const band = CAVERN_BANDS[t] as readonly [number, number];
    if (z >= band[0] && z <= band[1]) return t;
  }
  return 0;
}

/** Kinds that are rock, not part of a cavern's open region. */
function isRock(kind: TileKind): boolean {
  return kind === TileKind.Wall || kind === TileKind.Boulder || kind === TileKind.Fortification;
}

/** An item 03 owes the world; recorded until items exist (M2). */
export interface IntendedDrop {
  readonly type: string;
  readonly material: number | string;
  readonly count: number;
  readonly tile: TileIndex;
  readonly tick: number;
  readonly reason: string;
}

/** What the core needs from its surroundings. */
export interface TerrainHost {
  readonly map: Map3D;
  readonly entities: EntityStore;
  readonly facts: TerrainFacts;
  readonly services: CoreServices;
  tick(): number;
  emit(event: GameEvent): void;
  /** Entities standing on a tile (the spatial index). */
  entitiesAt(i: TileIndex): readonly EntityId[];
  /** `ctx.spawn.item` for a dropped item, by content ids (T-M1-11). */
  spawnItem?(type: string, material: number | string, count: number, tile: TileIndex): void;
}

/** The live state of 03: designations, engravings, the forbidden set, breaches and found veins. */
export class TerrainCore implements TerrainApi {
  readonly host: TerrainHost;
  /** Tiles with a designation, ascending: the iteration source (`03` § State). */
  readonly designated: number[] = [];
  readonly engravings = new Map<TileIndex, { quality: number; engraverId: EntityId; motif: number }>();
  readonly forbidden: number[] = [];
  readonly cavernBreached: [boolean, boolean, boolean] = [false, false, false];
  readonly veinsFound: number[] = [];
  /** Drops recorded for the M2 item system (and read by tests). */
  readonly drops: IntendedDrop[] = [];

  private changed: TileIndex[] = [];
  private discovered: TileIndex[] = [];
  private collapsed: TileIndex[] = [];
  private readonly litDirty: Uint8Array;
  private readonly supportQueue: number[] = [];
  private settling = false;
  /** Bumped on every designation change; 03's job producer reconciles when it moves. */
  designationsVersion = 0;
  /** 14's record of the item each construction was built from (D-050, T-M2-05). */
  private constructionSource: ((tile: TileIndex) => string | null) | null = null;

  constructor(host: TerrainHost) {
    this.host = host;
    this.litDirty = new Uint8Array(host.map.d);
  }

  private get map(): Map3D {
    return this.host.map;
  }

  private check(i: TileIndex): void {
    if (!this.map.validIndex(i)) throw new RangeError(`tile index out of range: ${i}`);
  }

  // ---------- the terrain API ----------

  setKind(i: TileIndex, kind: TileKind, material: number): void {
    this.check(i);
    this.write(i, kind, material, 0, 0);
    this.settle();
  }

  /** Installed by 03's job producer, whose stream rolls a shrub's product. */
  plantClearer: ((i: TileIndex, ripe: boolean) => void) | null = null;

  clearPlant(i: TileIndex, ripe: boolean): void {
    this.check(i);
    this.plantClearer?.(i, ripe);
  }

  setFlag(i: TileIndex, flag: TileFlag, value: boolean): void {
    this.check(i);
    if (this.map.hasFlag(i, flag) === value) return;
    this.map.setFlag(i, flag, value);
    this.changed.push(i);
    if (flag === TileFlag.Constructed) {
      this.queueSupport(i);
      this.settle();
    }
  }

  setDesignation(i: TileIndex, kind: Designation, priority: number): void {
    this.check(i);
    if (kind === Designation.None) {
      this.clearDesignation(i);
      return;
    }
    this.map.setDesignation(i, kind, priority);
    sortedInsert(this.designated, i);
    this.changed.push(i);
    this.designationsVersion += 1;
  }

  clearDesignation(i: TileIndex): void {
    this.check(i);
    if (this.map.designationAt(i) === Designation.None) return;
    this.map.setDesignation(i, Designation.None, 0);
    sortedRemove(this.designated, i);
    this.changed.push(i);
    this.designationsVersion += 1;
  }

  /** Change several tiles as one action (a transition), then settle support once. */
  writeMany(changes: readonly { tile: TileIndex; kind?: TileKind; material?: number; set?: number; clear?: number }[]): void {
    for (const c of changes) {
      this.check(c.tile);
      const kind = c.kind ?? this.map.kindAt(c.tile);
      const material = c.material ?? this.map.materialAt(c.tile);
      this.write(c.tile, kind, material, c.set ?? 0, c.clear ?? 0);
    }
    this.settle();
  }

  setConstructionItemSource(source: ((tile: TileIndex) => string | null) | null): void {
    this.constructionSource = source;
  }

  /**
   * The item a construction returns: the one 14 recorded it was built from, else by material class
   * (D-050: "until 14 records what was used").
   */
  constructionItemAt(tile: TileIndex, material: number): string {
    return this.constructionSource?.(tile) ?? constructionItem(material, this.host.facts, (m) => this.host.facts.isMetal(m));
  }

  // ---------- the one write path ----------

  /**
   * Write one tile: kind, material and flags; recompute the column's `outdoor` flags; mark the
   * level for the `lit` pass; queue the support checks of the constructed neighbours; clear a
   * designation whose precondition no longer holds (`03` § Tile transitions, last paragraph).
   */
  private write(i: TileIndex, kind: TileKind, material: number, set: number, clear: number): void {
    const map = this.map;
    const kindChanged = map.kindAt(i) !== kind;
    map.setKind(i, kind, material);
    if (set !== 0 || clear !== 0) {
      const before = map.flagsAt(i);
      const after = (before | set) & ~clear & 0xffff;
      if (after !== before) {
        map.flags[i] = after;
        map.markChunkDirty(i, true, false);
      }
    }
    this.changed.push(i);
    if (kindChanged) {
      this.recomputeColumn(i);
      for (const n of map.neighbors6(i)) this.queueSupport(n);
      this.queueSupport(i);
    }
    this.revalidateDesignation(i);
    const below = map.below(i);
    if (below >= 0) this.revalidateDesignation(below);
  }

  private revalidateDesignation(i: TileIndex): void {
    const d = this.map.designationAt(i);
    if (d === Designation.None || d === Designation.Harvest) return;
    if (!precondition(this.map, i, d, this.host.facts)) this.clearDesignation(i);
  }

  /** `03` § Outdoor and lit: "Recomputed for the whole column when any tile in the column changes kind." */
  private recomputeColumn(i: TileIndex): void {
    const map = this.map;
    const x = map.xOf(i);
    const y = map.yOf(i);
    let sky = true;
    for (let z = map.d - 1; z >= 0; z -= 1) {
      const t = map.index(x, y, z);
      const f = map.flags[t] as number;
      const next = sky ? f | TileFlag.Outdoor : f & ~TileFlag.Outdoor;
      if (next !== f) {
        map.flags[t] = next;
        map.markChunkDirty(t, true, false);
        this.litDirty[z] = 1;
      }
      if (map.kind[t] !== TileKind.Open) sky = false;
    }
    this.litDirty[map.zOf(i)] = 1;
  }

  // ---------- support and collapse ----------

  private queueSupport(i: TileIndex): void {
    if (i < 0) return;
    if (!this.map.hasFlag(i, TileFlag.Constructed)) return;
    sortedInsert(this.supportQueue, i);
  }

  /**
   * `03` § Support and collapse: "A `constructed` `wall`, `floor`, `ramp`, `stairs_*` or
   * `fortification` is supported if any of its six face-adjacent tiles is `wall`, `floor`, `ramp`,
   * `stairs_*`, `fortification` or `tree` (natural or constructed)." Natural tiles are always
   * supported.
   */
  isSupported(i: TileIndex): boolean {
    const map = this.map;
    if (!map.hasFlag(i, TileFlag.Constructed) || !isStructuralKind(map.kindAt(i))) return true;
    const ns = map.neighbors6(i);
    for (let k = 0; k < ns.length; k += 1) {
      if (isSupportKind(map.kindAt(ns[k] as TileIndex))) return true;
    }
    return false;
  }

  /**
   * Collapse unsupported constructions until stable, in `(z ascending, y, x)` order, which is
   * ascending tile index; emit one `ConstructionCollapsed` for the cascade.
   */
  private settle(): void {
    if (this.settling) return;
    this.settling = true;
    try {
      while (this.supportQueue.length > 0) {
        const i = this.supportQueue.shift() as number;
        if (this.isSupported(i)) continue;
        this.collapse(i);
      }
    } finally {
      this.settling = false;
    }
    if (this.collapsed.length > 0) {
      const tiles = this.collapsed.slice().sort((a, b) => a - b);
      this.collapsed = [];
      this.host.emit({ type: 'ConstructionCollapsed', tiles });
    }
  }

  /** The first place a falling thing comes to rest from `i` (the movement helper's `fall` rule). */
  landingTile(i: TileIndex): TileIndex {
    const map = this.map;
    let cur = i;
    for (;;) {
      const below = map.below(cur);
      if (below < 0) return cur;
      const kind = map.kindAt(below);
      if (isSolidBottomed(kind)) return below;
      if (kind !== TileKind.Open) return cur;
      cur = below;
    }
  }

  private collapse(i: TileIndex): void {
    const map = this.map;
    const material = map.materialAt(i);
    const item = this.constructionItemAt(i, material);
    // "it becomes `open` …, its material item is spawned at the first solid tile below, creatures
    // on it fall (22 movement helper) and items on it fall".
    this.write(i, TileKind.Open, 0, 0, TileFlag.Constructed | TileFlag.Smoothed | TileFlag.Engraved);
    this.collapsed.push(i);
    this.drop(item, material, 1, this.landingTile(i), 'collapse');
    const movement = this.host.services.movement;
    if (movement !== null) {
      const here = this.host.entitiesAt(i).slice();
      for (const id of here) {
        if (this.host.entities.kind(id) !== 'creature') continue;
        movement.fall(id, { tick: this.host.tick(), emit: (e) => this.host.emit(e) });
      }
    }
  }

  // ---------- items ----------

  /**
   * An item 03 owes the world. The spawn API creates it once items exist (M2, T-M1-11's stub
   * records it); until then 03 records it here.
   */
  drop(type: string, material: number | string, count: number, tile: TileIndex, reason: string): void {
    this.drops.push({ type, material, count, tile, tick: this.host.tick(), reason });
    this.host.spawnItem?.(type, material, count, tile);
  }

  // ---------- discovery ----------

  /** Mark a tile and its 26 neighbours discovered (`03` § Discovery). */
  discoverAround(i: TileIndex): void {
    const map = this.map;
    this.discoverOne(i);
    const ns = map.neighbors26(i);
    for (let k = 0; k < ns.length; k += 1) this.discoverOne(ns[k] as TileIndex);
  }

  /** True when a tile and all its neighbours are already discovered. */
  allDiscoveredAround(i: TileIndex): boolean {
    const map = this.map;
    if (!map.hasFlag(i, TileFlag.Discovered)) return false;
    const ns = map.neighbors26(i);
    for (let k = 0; k < ns.length; k += 1) if (!map.hasFlag(ns[k] as TileIndex, TileFlag.Discovered)) return false;
    return true;
  }

  private discoverOne(i: TileIndex): void {
    if (this.map.hasFlag(i, TileFlag.Discovered)) return;
    this.map.setFlag(i, TileFlag.Discovered, true);
    this.discovered.push(i);
  }

  /**
   * A tile changed by a designation opened onto a cavern: when any of its 26 neighbours is an
   * undiscovered, non-rock tile inside a cavern band whose cavern has not been breached, emit
   * `CavernBreached { cavern, tile }` and discover the band's connected open region plus one tile
   * of rock around it (`03` § Discovery, § Digging as a job). Returns the cavern, or 0. Call
   * before {@link discoverAround}, which would otherwise hide the undiscovered neighbour.
   */
  checkBreach(i: TileIndex): number {
    const map = this.map;
    const ns = map.neighbors26(i);
    for (let k = 0; k < ns.length; k += 1) {
      const n = ns[k] as TileIndex;
      const cavern = cavernAt(map.zOf(n));
      if (cavern === 0 || this.cavernBreached[cavern - 1] === true) continue;
      if (map.hasFlag(n, TileFlag.Discovered) || isRock(map.kindAt(n))) continue;
      this.cavernBreached[cavern - 1] = true;
      this.host.emit({ type: 'CavernBreached', cavern, tile: n });
      this.discoverCavern(n, cavern);
      return cavern;
    }
    return 0;
  }

  /** "the entire connected open region of the cavern reachable from the breach tile within the cavern band (flood fill bounded to the band), plus one tile of rock around it". */
  discoverCavern(start: TileIndex, cavern: number): number {
    const map = this.map;
    const band = CAVERN_BANDS[cavern] as readonly [number, number];
    const seen = new Set<number>([start]);
    const queue: number[] = [start];
    const region: number[] = [];
    while (queue.length > 0) {
      const t = queue.shift() as number;
      region.push(t);
      const ns = map.neighbors6(t);
      for (let k = 0; k < ns.length; k += 1) {
        const n = ns[k] as TileIndex;
        if (seen.has(n)) continue;
        const z = map.zOf(n);
        if (z < band[0] || z > band[1]) continue;
        if (isRock(map.kindAt(n))) continue;
        seen.add(n);
        queue.push(n);
      }
    }
    region.sort((a, b) => a - b);
    for (const t of region) this.discoverAround(t);
    return region.length;
  }

  // ---------- veins ----------

  /**
   * The key of the vein a mineral tile belongs to: the lowest tile index of the face-connected set
   * of tiles of the same material (bounded; D-051).
   */
  veinKey(i: TileIndex, limit = 4096): number {
    const map = this.map;
    const material = map.materialAt(i);
    const seen = new Set<number>([i]);
    const queue: number[] = [i];
    let low = i;
    while (queue.length > 0 && seen.size < limit) {
      const t = queue.shift() as number;
      if (t < low) low = t;
      const ns = map.neighbors6(t);
      for (let k = 0; k < ns.length; k += 1) {
        const n = ns[k] as TileIndex;
        if (seen.has(n) || map.materialAt(n) !== material) continue;
        const kind = map.kindAt(n);
        if (kind === TileKind.Open || kind === TileKind.Tree || kind === TileKind.Sapling || kind === TileKind.Shrub) continue;
        seen.add(n);
        queue.push(n);
      }
    }
    return low;
  }

  /** Record a vein as found; true the first time. */
  findVein(i: TileIndex): boolean {
    return sortedInsert(this.veinsFound, this.veinKey(i));
  }

  // ---------- traffic ----------

  isForbidden(i: TileIndex): boolean {
    return sortedIndexOf(this.forbidden, i) >= 0;
  }

  setForbidden(i: TileIndex, on: boolean): boolean {
    const changed = on ? sortedInsert(this.forbidden, i) : sortedRemove(this.forbidden, i);
    if (changed) this.map.markChunkDirty(i, true, true);
    return changed;
  }

  /** Add a tile to this tick's `TilesChanged` batch without changing it (a traffic mark). */
  markChanged(i: TileIndex): void {
    this.changed.push(i);
  }

  /** Snapshot work owed to the normal terrain flush without running it. */
  savePending(): PendingTerrain | undefined {
    const changed = Array.from(new Set(this.changed)).sort((a, b) => a - b);
    const discovered = Array.from(new Set(this.discovered)).sort((a, b) => a - b);
    const litDirty: number[] = [];
    for (let z = 0; z < this.litDirty.length; z += 1) if (this.litDirty[z]) litDirty.push(z);
    return changed.length || discovered.length || litDirty.length ? { changed, discovered, litDirty } : undefined;
  }

  /** Older saves have no pending batch; loading does not emit or relight. */
  loadPending(state: PendingTerrain | undefined): void {
    this.changed = state?.changed.slice() ?? [];
    this.discovered = state?.discovered.slice() ?? [];
    this.litDirty.fill(0);
    for (const z of state?.litDirty ?? []) this.litDirty[z] = 1;
  }

  // ---------- the tick's batch ----------

  /** Recompute `lit` on every level a change touched (`03` § Outdoor and lit). */
  private relight(): void {
    const map = this.map;
    const n = map.w * map.h;
    for (let z = 0; z < map.d; z += 1) {
      if (this.litDirty[z] === 0) continue;
      this.litDirty[z] = 0;
      const before = map.flags.slice(z * n, (z + 1) * n);
      computeLitLevel(map, z);
      for (let c = 0; c < n; c += 1) {
        if ((((before[c] as number) ^ (map.flags[z * n + c] as number)) & TileFlag.Lit) !== 0) {
          map.markChunkDirty(z * n + c, true, false);
        }
      }
    }
  }

  /** `TilesChanged { tiles }` and `TilesDiscovered { tiles }`, once per tick, sorted and unique. */
  flush(emit: (event: GameEvent) => void): void {
    this.relight();
    if (this.changed.length > 0) {
      const tiles = Array.from(new Set(this.changed)).sort((a, b) => a - b);
      this.changed = [];
      emit({ type: 'TilesChanged', tiles });
    }
    if (this.discovered.length > 0) {
      const tiles = Array.from(new Set(this.discovered)).sort((a, b) => a - b);
      this.discovered = [];
      emit({ type: 'TilesDiscovered', tiles });
    }
  }

  /** The designation's priority as a `Priority`. */
  priorityAt(i: TileIndex): Priority {
    return this.map.designationPriorityAt(i) as Priority;
  }

  /** True for a fortress creature (discovery follows only the fortress's own creatures). */
  isFortressCreature(id: EntityId): boolean {
    if (!this.host.entities.alive(id)) return false;
    const creature = this.host.entities.get(id, C.Creature);
    return creature?.faction === 'fortress';
  }
}
