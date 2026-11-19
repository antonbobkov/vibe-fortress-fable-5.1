/**
 * The designate tool and panel: `ui-screens/fortress-screen.md` § Designate tool, 24 § Input model
 * ("Within a designation or zone tool: `Enter` or a click starts and ends a rectangle; `1`–`9` set
 * the priority; `Ctrl+Z` undoes the last batch"), `ui-keymap-and-screens.md` § Mouse ("Left drag
 * … designate", "Right click … cancel the tool") and `command-catalog.md` rows `Designate`,
 * `UndoDesignation`, `SetTraffic`.
 *
 * `Designate` refuses the whole command when any discovered tile fails its precondition (D-052),
 * so the tool submits only the box's tiles that pass or are undiscovered ("undiscovered tiles
 * accepted blind"), and counts the rest as skipped (24 § Input model: every tool is best effort).
 * The stairs tool chooses each tile's stairs itself and sends one `Designate` per stair kind.
 */

import { PRIORITY_DEFAULT, PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import type { Command } from '@core/commands';
import { Designation, TileFlag, TileKind } from '@core/map3d';
import type { MapReader } from '@core/readers';
import type { TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import { acceleratorLabel } from '../keymap';
import { UNDO_BATCHES_MAX } from '../constants';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { keyCells, label } from '../widgets';

export type TrafficMode = 'normal' | 'restricted' | 'forbidden';

export interface DesignateKind {
  /** The accelerator in the panel. */
  readonly key: string;
  /** The `ui.tool.designate.*` string and the tool's name. */
  readonly id: string;
  readonly designation?: Designation;
  readonly special?: 'stairs' | 'traffic';
}

/** The panel's rows, in the wireframe's order. */
export const DESIGNATE_KINDS: readonly DesignateKind[] = [
  { key: 'd', id: 'dig', designation: Designation.Dig },
  { key: 'c', id: 'channel', designation: Designation.Channel },
  // One stair tool: it chooses up, down or up/down stairs for each tile (24 § Input model).
  { key: 'w', id: 'stairs', special: 'stairs' },
  { key: 'r', id: 'ramp', designation: Designation.Ramp },
  { key: 's', id: 'smooth', designation: Designation.Smooth },
  { key: 'e', id: 'engrave', designation: Designation.Engrave },
  { key: 'x', id: 'remove', designation: Designation.Remove },
  { key: 't', id: 'chop', designation: Designation.Chop },
  { key: 'g', id: 'gather', designation: Designation.Gather },
  { key: 'h', id: 'harvest', designation: Designation.Harvest },
  { key: 'f', id: 'traffic', special: 'traffic' },
  // 24 § Designations: cut ice from frozen water, and set a fire on purpose (`ui-keymap-and-screens.md` § Designate panel).
  { key: 'q', id: 'harvest_ice', designation: Designation.HarvestIce },
  { key: 'b', id: 'ignite', designation: Designation.Ignite },
];

/**
 * Every row can be chosen. `harvest` was dim until 07 existed (docs/archive/decisions-archive.md D-066); 07 owns
 * `DesignateHarvest` now (audit Q9).
 */
export function kindAvailable(_kind: DesignateKind): boolean {
  return true;
}

export interface TilePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** The tiles of the rectangle spanned by two corners on the first corner's level, in index order. */
export function rectTiles(map: MapReader, a: TilePoint, b: TilePoint): TileIndex[] {
  const x0 = Math.max(0, Math.min(a.x, b.x));
  const x1 = Math.min(map.w - 1, Math.max(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y));
  const y1 = Math.min(map.h - 1, Math.max(a.y, b.y));
  const out: TileIndex[] = [];
  if (!map.inBounds(0, 0, a.z)) return out;
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) out.push(map.index(x, y, a.z));
  return out;
}

/**
 * The tiles of the box spanned by two corners: the rectangle on every level from the first
 * corner's to the second's, level by level from the top, each level in index order (24 § Input
 * model).
 */
export function boxTiles(map: MapReader, a: TilePoint, b: TilePoint): TileIndex[] {
  const out: TileIndex[] = [];
  for (let z = Math.max(a.z, b.z); z >= Math.min(a.z, b.z); z -= 1) out.push(...rectTiles(map, { x: a.x, y: a.y, z }, { x: b.x, y: b.y, z }));
  return out;
}

/** The levels a box spans. */
export function boxLevels(a: TilePoint, b: TilePoint): number {
  return Math.abs(a.z - b.z) + 1;
}

const UP = 1;
const DOWN = 2;

/** The ways a tile already leads: up, down or both for a stair, none otherwise. */
function stairWays(kind: TileKind): number {
  if (kind === TileKind.StairsUp) return UP;
  if (kind === TileKind.StairsDown) return DOWN;
  if (kind === TileKind.StairsUpDown) return UP | DOWN;
  return 0;
}

/**
 * The stairs that give a tile the ways it needs (24 § Input model), or null when it has them
 * already. An undiscovered tile (`null`) is taken as rock. A floor that must lead only down takes
 * down stairs; a wall or floor that must lead only up takes up stairs; any other wall or floor
 * takes up/down stairs, and so does a stair that lacks a way (03 re-carves it). Any other tile
 * gets up/down stairs here, which 03's precondition refuses, so the tile is skipped.
 */
function stairFor(kind: TileKind | null, need: number): Designation | null {
  if (need === 0) return null;
  if (kind === TileKind.Floor && need === DOWN) return Designation.StairsDown;
  if ((kind === null || kind === TileKind.Wall || kind === TileKind.Floor) && need === UP) return Designation.StairsUp;
  const has = kind === null ? 0 : stairWays(kind);
  if (has !== 0 && (has & need) === need) return null;
  return Designation.StairsUpDown;
}

/** One reason a box left tiles out: a strings key (`ui.kind.*` or `ui.status.skip.*`) and how many. */
export interface SkipCount {
  readonly reason: string;
  readonly n: number;
}

/** What a finished box sends, and what it left out. */
export interface DesignatePlan {
  readonly commands: Command[];
  /** Tiles designated. */
  readonly designated: number;
  /** Tiles left out, by reason, most first. */
  readonly skipped: readonly SkipCount[];
  /** Stair tiles that already lead every way they need. */
  readonly already: number;
}

/** Counts the skipped tiles by reason, most first, then in the order they were met. */
class Skips {
  private readonly counts = new Map<string, number>();
  add(reason: string): void {
    this.counts.set(reason, (this.counts.get(reason) ?? 0) + 1);
  }
  list(): SkipCount[] {
    return [...this.counts].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n);
  }
}

/**
 * Why a discovered tile could not take a designation: its kind, or for stairs "already open" and
 * "built stairs". 03 carves no constructed wall: for dig, stairs and ramps it reads "built wall".
 * 03 cuts no stairs and no channel under a building: for those a constructed floor (or stair)
 * reads "built floor" ("built stairs"), and a tile under any other building "under a building", as
 * does the wall a ramp would carve from under a floor that holds one.
 */
function skipReason(map: MapReader, i: TileIndex, d: Designation): string {
  const kind = map.kindAt(i);
  const stairs = d === Designation.StairsUp || d === Designation.StairsDown || d === Designation.StairsUpDown;
  const built = (map.flagsAt(i) & TileFlag.Constructed) !== 0;
  if (stairs && kind === TileKind.Open) return 'ui.status.skip.open';
  if (stairs && stairWays(kind) !== 0) return 'ui.status.skip.built_stairs';
  if (built && kind === TileKind.Wall && (stairs || d === Designation.Dig || d === Designation.Ramp)) return 'ui.status.skip.built_wall';
  if ((stairs || d === Designation.Channel) && map.buildingAt(i) !== 0) {
    if (built && kind === TileKind.Floor) return 'ui.status.skip.built_floor';
    if (built && stairWays(kind) !== 0) return 'ui.status.skip.built_stairs';
    return 'ui.status.skip.building';
  }
  if (d === Designation.Ramp && kind === TileKind.Wall) {
    const { x, y, z } = map.unpack(i);
    const up = map.inBounds(x, y, z + 1) ? map.index(x, y, z + 1) : -1;
    if (up >= 0 && map.kindAt(up) === TileKind.Floor && map.buildingAt(up) !== 0) return 'ui.status.skip.building';
  }
  return `ui.kind.${kind}`;
}

/**
 * The ways each tile must lead for the stairs a box asks for (24 § Input model): over several
 * levels a column on each tile of the rectangle; on one level a floor or a stair is a column to
 * the level below, and a wall or an undiscovered tile takes up/down stairs. An end of a column
 * also leads toward a stair directly beyond it, and that stair must lead back.
 */
function stairNeeds(map: MapReader, a: TilePoint, b: TilePoint, skips: Skips): Map<TileIndex, number> {
  const needs = new Map<TileIndex, number>();
  const add = (i: TileIndex, ways: number): void => { needs.set(i, (needs.get(i) ?? 0) | ways); };
  const discovered = (i: TileIndex): boolean => (map.flagsAt(i) & TileFlag.Discovered) !== 0;
  const isStair = (i: TileIndex): boolean => discovered(i) && stairWays(map.kindAt(i)) !== 0;
  const column = (x: number, y: number, zTop: number, zBottom: number, both: boolean): void => {
    for (let z = zTop; z >= zBottom; z -= 1) {
      let need = both ? UP | DOWN : (z < zTop ? UP : 0) | (z > zBottom ? DOWN : 0);
      if (z === zTop && map.inBounds(x, y, z + 1) && isStair(map.index(x, y, z + 1))) {
        need |= UP;
        add(map.index(x, y, z + 1), DOWN);
      }
      if (z === zBottom && map.inBounds(x, y, z - 1) && isStair(map.index(x, y, z - 1))) {
        need |= DOWN;
        add(map.index(x, y, z - 1), UP);
      }
      add(map.index(x, y, z), need);
    }
  };
  const zTop = Math.max(a.z, b.z);
  const zBottom = Math.min(a.z, b.z);
  for (const top of rectTiles(map, { x: a.x, y: a.y, z: zTop }, { x: b.x, y: b.y, z: zTop })) {
    const { x, y } = map.unpack(top);
    if (zTop > zBottom) {
      column(x, y, zTop, zBottom, false);
      continue;
    }
    const kind = discovered(top) ? map.kindAt(top) : TileKind.Wall;
    if (kind === TileKind.Wall) column(x, y, zTop, zTop, true);
    else if (kind === TileKind.Floor || stairWays(kind) !== 0) column(x, y, zTop, Math.max(0, zTop - 1), false);
    else skips.add(skipReason(map, top, Designation.StairsUpDown));
  }
  return needs;
}

/**
 * What the reach check reads of 22 and the fortress: whether a tile is joined now, by 22's walker
 * labels, to a tile a fortress dwarf stands on, and whether a walker may stand on it.
 */
export interface ReachProbe {
  reached(i: TileIndex): boolean;
  passable(i: TileIndex): boolean;
}

/** What a batch leaves out of reach (24 § Input model). */
export interface BatchReach {
  /** The batch's tiles no dwarf reaches, even when every tile it can reach is worked, in index order. */
  readonly unreachable: readonly TileIndex[];
  /** Tiles in the batch. */
  readonly total: number;
}

/** The tile kinds a diagonal step may not cut past (22 § Edges). */
function blocksCorner(kind: TileKind): boolean {
  return kind === TileKind.Wall || kind === TileKind.Tree || kind === TileKind.Boulder || kind === TileKind.Fortification;
}

/** What a finished job leaves a dwarf can stand on (03 § Tile transitions), or null when its walkability does not change. */
function workedKind(designation: string): TileKind | null {
  switch (designation) {
    case 'dig':
    case 'chop':
      return TileKind.Floor;
    case 'stairs_up':
      return TileKind.StairsUp;
    case 'stairs_down':
      return TileKind.StairsDown;
    case 'stairs_updown':
      return TileKind.StairsUpDown;
    case 'ramp':
      return TileKind.Ramp;
    default:
      return null;
  }
}

const leadsUp = (k: TileKind): boolean => k === TileKind.StairsUp || k === TileKind.StairsUpDown;
const leadsDown = (k: TileKind): boolean => k === TileKind.StairsDown || k === TileKind.StairsUpDown;

/**
 * The tiles of a batch of `Designate` commands no fortress dwarf can reach (24 § Input model). The
 * batch is worked through in thought, with 03's stand tiles and 22's edges: a tile is worked when a
 * dwarf reaches one of its stand tiles (the tile itself for a channel, down stairs and a floor
 * smoothed or engraved; else a walkable tile of its level's 8-neighbourhood, and for up and up/down
 * stairs a down or up/down stair directly above); a worked tile a dwarf can stand on is reached when
 * a step leads into it from a reached tile (a side, a diagonal that cuts past no solid corner, stairs
 * that meet, a ramp). What is never worked is out of reach. A corner is not a side: a box that meets
 * the open only at a corner has its corner tile dug from the diagonal and nothing more. The tiles
 * already designated (`pending`, by designation id) are worked through with the batch, so a room
 * designated under a shaft that is designated but not yet carved is in reach; only the batch's own
 * tiles are counted.
 */
export function batchReach(map: MapReader, probe: ReachProbe, commands: readonly Command[], pending: readonly (readonly [TileIndex, string])[] = []): BatchReach {
  const batch = new Map<TileIndex, string>();
  for (const c of commands) {
    if (c.type !== 'Designate') continue;
    for (const t of c['tiles'] as readonly TileIndex[]) batch.set(t, c['kind'] as string);
  }
  const own = [...batch.keys()].sort((a, b) => a - b);
  for (const [t, designation] of pending) if (!batch.has(t)) batch.set(t, designation);
  const worked = new Set<TileIndex>();
  /** Worked tiles whose kind the job changes, with that kind. */
  const after = new Map<TileIndex, TileKind>();
  const reachedNew = new Set<TileIndex>();
  const kindOf = (i: TileIndex): TileKind => after.get(i) ?? map.kindAt(i);
  const walkable = (i: TileIndex): boolean => after.has(i) || probe.passable(i);
  const reached = (i: TileIndex): boolean => reachedNew.has(i) || (!after.has(i) && probe.reached(i));
  const at = (x: number, y: number, z: number): TileIndex => (map.inBounds(x, y, z) ? map.index(x, y, z) : -1);

  /** A step joins the two tiles (22 § Edges), read on the batch as worked so far. */
  const step = (a: TileIndex, b: TileIndex): boolean => {
    const p = map.unpack(a);
    const q = map.unpack(b);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const dz = q.z - p.z;
    if (!walkable(a) || !walkable(b)) return false;
    if (dz === 0) {
      if (dx === 0 || dy === 0) return true;
      const c1 = at(p.x + dx, p.y, p.z);
      const c2 = at(p.x, p.y + dy, p.z);
      return c1 >= 0 && c2 >= 0 && !blocksCorner(kindOf(c1)) && !blocksCorner(kindOf(c2));
    }
    const [lo, hi, ox, oy] = dz > 0 ? [p, q, dx, dy] : [q, p, -dx, -dy];
    const low = map.index(lo.x, lo.y, lo.z);
    const high = map.index(hi.x, hi.y, hi.z);
    if (ox === 0 && oy === 0) return leadsUp(kindOf(low)) && leadsDown(kindOf(high));
    // A ramp leans on the solid tile beside it and leads to the tile above that one.
    if (ox !== 0 && oy !== 0) return false;
    const lean = at(lo.x + ox, lo.y + oy, lo.z);
    return kindOf(low) === TileKind.Ramp && lean >= 0 && blocksCorner(kindOf(lean));
  };

  const around = (i: TileIndex, levels: readonly number[]): TileIndex[] => {
    const { x, y, z } = map.unpack(i);
    const out: TileIndex[] = [];
    for (const dz of levels) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0 && dz === 0) continue;
      const n = at(x + dx, y + dy, z + dz);
      if (n >= 0) out.push(n);
    }
    return out;
  };

  const stands = (i: TileIndex, designation: string): TileIndex[] => {
    const kind = map.kindAt(i);
    const onIt = designation === 'channel' || designation === 'stairs_down' ||
      ((designation === 'smooth' || designation === 'engrave') && kind !== TileKind.Wall);
    if (onIt) return [i];
    const out = around(i, [0]);
    const { x, y, z } = map.unpack(i);
    const above = at(x, y, z + 1);
    if ((designation === 'stairs_up' || designation === 'stairs_updown') && above >= 0 && leadsDown(kindOf(above))) out.push(above);
    // 03 § Ice harvesting: the bank above, a miner reaching down.
    if (designation === 'harvest_ice' && above >= 0) out.push(above, ...around(above, [0]));
    return out;
  };

  const queue: TileIndex[] = [...batch.keys()].sort((a, b) => a - b);
  const wake = (i: TileIndex): void => {
    for (const n of around(i, [-1, 0, 1])) if (batch.has(n)) queue.push(n);
  };
  for (let k = 0; k < queue.length; k += 1) {
    const t = queue[k] as TileIndex;
    const designation = batch.get(t) as string;
    if (!worked.has(t) && stands(t, designation).some((s) => reached(s) && walkable(s))) {
      worked.add(t);
      const kind = workedKind(designation);
      if (kind !== null) after.set(t, kind);
      wake(t);
    }
    if (worked.has(t) && after.has(t) && !reachedNew.has(t) && around(t, [-1, 0, 1]).some((n) => reached(n) && step(n, t))) {
      reachedNew.add(t);
      wake(t);
    }
  }
  return { unreachable: own.filter((t) => !worked.has(t)), total: own.length };
}

/** The `Designate` id of each designation a tile can hold (`command-catalog.md`). */
export const DESIGNATION_IDS: Readonly<Partial<Record<Designation, string>>> = {
  [Designation.Dig]: 'dig',
  [Designation.Channel]: 'channel',
  [Designation.StairsUp]: 'stairs_up',
  [Designation.StairsDown]: 'stairs_down',
  [Designation.StairsUpDown]: 'stairs_updown',
  [Designation.Ramp]: 'ramp',
  [Designation.Smooth]: 'smooth',
  [Designation.Engrave]: 'engrave',
  [Designation.Remove]: 'remove',
  [Designation.Chop]: 'chop',
  [Designation.Gather]: 'gather',
  [Designation.HarvestIce]: 'harvest_ice',
  [Designation.Ignite]: 'ignite',
};

/**
 * The stairs tool over several levels (24 § Input model): whether a column of the box left out of
 * reach is topped by a ramp, which takes no stairs.
 */
export function rampTopped(map: MapReader, a: TilePoint, b: TilePoint, unreachable: readonly TileIndex[]): boolean {
  if (a.z === b.z) return false;
  const zTop = Math.max(a.z, b.z);
  return unreachable.some((t) => {
    const { x, y } = map.unpack(t);
    const top = map.index(x, y, zTop);
    return (map.flagsAt(top) & TileFlag.Discovered) !== 0 && map.kindAt(top) === TileKind.Ramp;
  });
}

export interface DesignateContext {
  readonly map: MapReader;
  /** 03's transition precondition for a tile and kind (`precondition()` of `@systems/terrain`). */
  precondition(i: TileIndex, kind: Designation): boolean;
}

export class DesignateTool {
  /** The chosen row's id, or `null` when the panel is open with no tool. */
  kind: string | null = null;
  priority = PRIORITY_DEFAULT;
  traffic: TrafficMode = 'restricted';
  /** `Delete`: the rectangle clears designations instead. */
  clearing = false;
  /** The first corner of a rectangle in progress (drag or `Enter`). */
  anchor: TilePoint | null = null;
  /** The corner under the pointer while dragging. */
  end: TilePoint | null = null;
  private readonly batches: TileIndex[][] = [];
  /** Latest remaining batch, also used by re-prioritize. */
  get lastBatch(): TileIndex[] | null { return this.batches.at(-1) ?? null; }
  /** Undo history is not persisted across worlds or loads. */
  clearHistory(): void { this.batches.length = 0; }

  get active(): boolean {
    return this.kind !== null || this.clearing;
  }

  current(): DesignateKind | undefined {
    return DESIGNATE_KINDS.find((k) => k.id === this.kind);
  }

  /** A panel accelerator; returns whether it chose a row. */
  choose(key: string): boolean {
    const kind = DESIGNATE_KINDS.find((k) => k.key === key);
    if (kind === undefined || !kindAvailable(kind)) return false;
    if (kind.special === 'traffic' && this.kind === 'traffic') {
      const order: TrafficMode[] = ['restricted', 'forbidden', 'normal'];
      this.traffic = order[(order.indexOf(this.traffic) + 1) % order.length] as TrafficMode;
    }
    this.kind = kind.id;
    this.clearing = false;
    this.anchor = null;
    this.end = null;
    return true;
  }

  setPriority(p: number): void {
    this.priority = Math.max(PRIORITY_MIN, Math.min(PRIORITY_MAX, p));
  }

  /** `Esc` / right click: cancel the tool (and any rectangle in progress). */
  cancel(): void {
    this.kind = null;
    this.clearing = false;
    this.anchor = null;
    this.end = null;
  }

  /** The commands a finished box submits (24 § Input model); `plan` also says what they leave out. */
  commands(ctx: DesignateContext, a: TilePoint, b: TilePoint): Command[] {
    return this.plan(ctx, a, b).commands;
  }

  /**
   * A finished box (24 § Input model). A designation keeps the tiles that pass 03's precondition or
   * are undiscovered and skips the rest; traffic takes every tile; clearing takes the designated
   * tiles; the stairs tool chooses each tile's stairs and skips only the tiles that cannot take them.
   */
  plan(ctx: DesignateContext, a: TilePoint, b: TilePoint): DesignatePlan {
    const map = ctx.map;
    const none: DesignatePlan = { commands: [], designated: 0, skipped: [], already: 0 };
    const discovered = (i: TileIndex): boolean => (map.flagsAt(i) & TileFlag.Discovered) !== 0;
    if (this.clearing) {
      const tiles = boxTiles(map, a, b).filter((i) => map.designationAt(i) !== Designation.None);
      return tiles.length === 0 ? none : { ...none, commands: [{ type: 'UndoDesignation', tiles }] };
    }
    const kind = this.current();
    if (kind === undefined) return none;
    if (kind.special === 'traffic') return { ...none, commands: [{ type: 'SetTraffic', tiles: boxTiles(map, a, b), mode: this.traffic }] };
    const skips = new Skips();
    if (kind.special === 'stairs') {
      const byKind = new Map<Designation, TileIndex[]>();
      let already = 0;
      for (const [i, need] of stairNeeds(map, a, b, skips)) {
        const d = stairFor(discovered(i) ? map.kindAt(i) : null, need);
        if (d === null) already += 1;
        else if (discovered(i) && !ctx.precondition(i, d)) skips.add(skipReason(map, i, d));
        else {
          const list = byKind.get(d) ?? [];
          list.push(i);
          byKind.set(d, list);
        }
      }
      const commands: Command[] = [];
      let designated = 0;
      const order: readonly [Designation, string][] = [[Designation.StairsDown, 'stairs_down'], [Designation.StairsUpDown, 'stairs_updown'], [Designation.StairsUp, 'stairs_up']];
      for (const [d, id] of order) {
        const tiles = byKind.get(d);
        if (tiles === undefined) continue;
        designated += tiles.length;
        commands.push({ type: 'Designate', tiles, kind: id, priority: this.priority });
      }
      return { commands, designated, skipped: skips.list(), already };
    }
    // `command-catalog.md`: `DesignateHarvest { tiles[] }` is 07's, which marks the ripe crops.
    if (kind.designation === Designation.Harvest) return { ...none, commands: [{ type: 'DesignateHarvest', tiles: boxTiles(map, a, b) }] };
    const designation = kind.designation as Designation;
    const tiles: TileIndex[] = [];
    for (const i of boxTiles(map, a, b)) {
      if (!discovered(i) || ctx.precondition(i, designation)) tiles.push(i);
      else skips.add(skipReason(map, i, designation));
    }
    const commands: Command[] = tiles.length === 0 ? [] : [{ type: 'Designate', tiles, kind: kind.id, priority: this.priority }];
    return { commands, designated: tiles.length, skipped: skips.list(), already: 0 };
  }

  /** Record what a submitted batch was (every `Designate` in it), so `Ctrl+Z` can undo it. */
  remember(commands: readonly Command[]): void {
    const tiles = commands.filter((c) => c.type === 'Designate').flatMap((c) => c['tiles'] as TileIndex[]);
    if (tiles.length > 0) {
      this.batches.push(tiles);
      if (this.batches.length > UNDO_BATCHES_MAX) this.batches.shift();
    }
  }

  /** `Ctrl+Z`: "undoes the last batch". */
  undo(): Command | null {
    const tiles = this.batches.pop();
    return tiles === undefined ? null : { type: 'UndoDesignation', tiles };
  }

  /**
   * `SetDesignationPriority` for the last batch: its tiles that are still designated take the tool's
   * priority (`command-catalog.md`: "designations exist"), or null when there are none.
   */
  reprioritize(map: MapReader): Command | null {
    const tiles = (this.lastBatch ?? []).filter((i) => map.designationAt(i) !== Designation.None);
    return tiles.length === 0 ? null : { type: 'SetDesignationPriority', tiles, priority: this.priority };
  }

  /** The tool's name for the status bar. */
  name(strings: Strings): string {
    if (this.clearing) return strings.get('ui.tool.designate.clear');
    const kind = this.current();
    return kind === undefined ? '' : strings.get(`ui.tool.designate.${kind.id}`);
  }
}

/** The panel body (the title row is the sidebar's). */
export function drawDesignatePanel(s: Surface, rect: Rect, tool: DesignateTool, strings: Strings, reprioritize?: () => void, undo?: () => void, clear?: () => void): void {
  const t = s.theme;
  let row = rect.row;
  // The left column is as wide as its longest caption, "[S-b] Set a fire"; the right takes the rest, which holds "[S-t] Chop trees".
  const leftW = 17;
  for (let k = 0; k < DESIGNATE_KINDS.length; k += 2) {
    for (let j = 0; j < 2; j += 1) {
      const kind = DESIGNATE_KINDS[k + j];
      if (kind === undefined) continue;
      const col = rect.col + 1 + j * leftW;
      const width = j === 0 ? leftW - 1 : Math.max(1, rect.cols - 2 - leftW);
      // A letter that opens a panel takes `Shift` here (`[S-d] Dig`, D-U2).
      const short = `ui.tool.designate.caption.${kind.id}`;
      const caption = `${acceleratorLabel(kind.key)} ${strings.get(strings.has(short) ? short : `ui.tool.designate.${kind.id}`)}`;
      const n = kindAvailable(kind) ? label(s, col, row, caption, { width }) : label(s, col, row, caption, { fg: t.dim, width, keys: false, relabel: true });
      // A caption that needs more than its name says what the tool does when hovered (the stairs tool).
      const tip = `ui.tool.designate.tip.${kind.id}`;
      if (strings.has(tip)) s.tooltip({ col, row, cols: n, rows: 1 }, strings.get(tip));
      if (tool.kind === kind.id) s.invert({ col, row, cols: n, rows: 1 });
      if (kindAvailable(kind)) s.hit({ col, row, cols: n, rows: 1 }, () => void tool.choose(kind.key));
    }
    row += 1;
  }
  // `Priority [-] n [+]`: the two brackets are buttons that step the priority within 1-9.
  const priorityText = strings.get('ui.tool.designate.priority', { n: tool.priority });
  label(s, rect.col + 1, row, priorityText);
  for (const cell of keyCells(s, priorityText)) {
    if (cell.key === '-') s.hit({ col: rect.col + 1 + cell.from, row, cols: cell.cols, rows: 1 }, () => tool.setPriority(tool.priority - 1));
    if (cell.key === '+') s.hit({ col: rect.col + 1 + cell.from, row, cols: cell.cols, rows: 1 }, () => tool.setPriority(tool.priority + 1));
  }
  row += 1;
  // `[Ctrl+Z] undo last` and `[Del] clear rect` are two buttons that do what the keys do.
  const undoText = strings.get('ui.tool.designate.undo_only');
  const undoWidth = label(s, rect.col + 1, row, undoText);
  if (undo !== undefined) s.hit({ col: rect.col + 1, row, cols: undoWidth, rows: 1 }, undo);
  const clearWidth = label(s, rect.col + 1 + undoWidth + 2, row, strings.get('ui.tool.designate.clear_rect'), { width: rect.cols - undoWidth - 4 });
  if (clear !== undefined) s.hit({ col: rect.col + 1 + undoWidth + 2, row, cols: clearWidth, rows: 1 }, clear);
  row += 1;
  // U-05: the last batch can take another priority (`SetDesignationPriority`).
  label(s, rect.col + 1, row, strings.get('ui.tool.designate.reprioritize', { n: tool.priority }), { fg: tool.lastBatch === null ? s.theme.dim : s.theme.text, width: rect.cols - 2 });
  if (reprioritize !== undefined) s.hit({ col: rect.col + 1, row, cols: rect.cols - 2, rows: 1 }, () => reprioritize());
  row += 1;
  label(s, rect.col + 1, row, strings.get('ui.tool.designate.help1'), { fg: t.dim, width: rect.cols - 2 });
}
