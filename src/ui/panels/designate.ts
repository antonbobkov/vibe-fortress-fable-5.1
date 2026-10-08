/**
 * The designate tool and panel: `ui-screens/fortress-screen.md` § Designate tool, 24 § Input model
 * ("Within a designation or zone tool: `Enter` or a click starts and ends a rectangle; `1`–`9` set
 * the priority; `Ctrl+Z` undoes the last batch"), `ui-keymap-and-screens.md` § Mouse ("Left drag
 * … designate", "Right click … cancel the tool") and `command-catalog.md` rows `Designate`,
 * `UndoDesignation`, `SetTraffic`, `DesignateStairwell`.
 *
 * `Designate` refuses the whole command when any discovered tile fails its precondition (D-052),
 * so the tool submits only the rectangle's tiles that pass or are undiscovered ("undiscovered
 * tiles accepted blind").
 */

import { PRIORITY_DEFAULT, PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import type { Command } from '@core/commands';
import { Designation, TileFlag } from '@core/map3d';
import type { MapReader } from '@core/readers';
import type { TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import { acceleratorLabel } from '../keymap';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { label, separator } from '../widgets';

export type TrafficMode = 'normal' | 'restricted' | 'forbidden';

export interface DesignateKind {
  /** The accelerator in the panel. */
  readonly key: string;
  /** The `ui.tool.designate.*` string and the tool's name. */
  readonly id: string;
  readonly designation?: Designation;
  readonly special?: 'stairwell' | 'traffic';
}

/** The panel's rows, in the wireframe's order. */
export const DESIGNATE_KINDS: readonly DesignateKind[] = [
  { key: 'd', id: 'dig', designation: Designation.Dig },
  { key: 'c', id: 'channel', designation: Designation.Channel },
  { key: 'u', id: 'stairs_up', designation: Designation.StairsUp },
  { key: 'j', id: 'stairs_down', designation: Designation.StairsDown },
  { key: 'i', id: 'stairs_updown', designation: Designation.StairsUpDown },
  { key: 'r', id: 'ramp', designation: Designation.Ramp },
  { key: 'w', id: 'stairwell', special: 'stairwell' },
  { key: 's', id: 'smooth', designation: Designation.Smooth },
  { key: 'e', id: 'engrave', designation: Designation.Engrave },
  { key: 'x', id: 'remove', designation: Designation.Remove },
  { key: 't', id: 'chop', designation: Designation.Chop },
  { key: 'g', id: 'gather', designation: Designation.Gather },
  { key: 'h', id: 'harvest', designation: Designation.Harvest },
  { key: 'f', id: 'traffic', special: 'traffic' },
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
  /** The tiles of the last `Designate` batch, for `Ctrl+Z`. */
  lastBatch: TileIndex[] | null = null;

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

  /**
   * The commands a finished rectangle submits. A designation keeps the tiles that pass 03's
   * precondition or are undiscovered; traffic takes every tile; clearing takes the designated
   * tiles; a stairwell is the column between the two corners' levels at the first corner.
   */
  commands(ctx: DesignateContext, a: TilePoint, b: TilePoint): Command[] {
    const map = ctx.map;
    if (this.clearing) {
      const tiles = rectTiles(map, a, b).filter((i) => map.designationAt(i) !== Designation.None);
      return tiles.length === 0 ? [] : [{ type: 'UndoDesignation', tiles }];
    }
    const kind = this.current();
    if (kind === undefined) return [];
    if (kind.special === 'traffic') return [{ type: 'SetTraffic', tiles: rectTiles(map, a, b), mode: this.traffic }];
    if (kind.special === 'stairwell') {
      if (a.z === b.z) return [];
      return [{ type: 'DesignateStairwell', x: a.x, y: a.y, zTop: Math.max(a.z, b.z), zBottom: Math.min(a.z, b.z), priority: this.priority }];
    }
    // `command-catalog.md`: `DesignateHarvest { tiles[] }` is 07's, which marks the ripe crops.
    if (kind.designation === Designation.Harvest) return [{ type: 'DesignateHarvest', tiles: rectTiles(map, a, b) }];
    const designation = kind.designation as Designation;
    const tiles = rectTiles(map, a, b).filter(
      (i) => (map.flagsAt(i) & TileFlag.Discovered) === 0 || ctx.precondition(i, designation),
    );
    if (tiles.length === 0) return [];
    return [{ type: 'Designate', tiles, kind: kind.id, priority: this.priority }];
  }

  /** Record what a submitted batch was, so `Ctrl+Z` can undo it. */
  remember(commands: readonly Command[]): void {
    const batch = commands.find((c) => c.type === 'Designate');
    if (batch !== undefined) this.lastBatch = (batch['tiles'] as TileIndex[]).slice();
  }

  /** `Ctrl+Z`: "undoes the last batch". */
  undo(): Command | null {
    if (this.lastBatch === null) return null;
    const cmd: Command = { type: 'UndoDesignation', tiles: this.lastBatch };
    this.lastBatch = null;
    return cmd;
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
export function drawDesignatePanel(s: Surface, rect: Rect, tool: DesignateTool, strings: Strings, reprioritize?: () => void): void {
  const t = s.theme;
  let row = rect.row;
  const colW = Math.floor((rect.cols - 2) / 2);
  for (let k = 0; k < DESIGNATE_KINDS.length; k += 2) {
    for (let j = 0; j < 2; j += 1) {
      const kind = DESIGNATE_KINDS[k + j];
      if (kind === undefined) continue;
      const col = rect.col + 1 + j * colW;
      // A letter that opens a panel takes `Shift` here (`[S-d] Dig`, D-U2).
      let caption = `${acceleratorLabel(kind.key)} ${strings.get(`ui.tool.designate.${kind.id}`)}`;
      if (kind.special === 'traffic') caption += ` (${strings.get(`ui.tool.traffic.${tool.traffic}`)})`;
      // One cell short of the column, so a long caption does not run into its neighbour's key.
      const n = kindAvailable(kind) ? label(s, col, row, caption, { width: colW - 1 }) : s.text(col, row, caption, t.dim, t.black, colW - 1);
      if (tool.kind === kind.id) s.invert({ col, row, cols: n, rows: 1 });
      if (kindAvailable(kind)) s.hit({ col, row, cols: n, rows: 1 }, () => void tool.choose(kind.key));
    }
    row += 1;
  }
  label(s, rect.col + 1, row, strings.get('ui.tool.designate.priority', { n: tool.priority }));
  row += 1;
  label(s, rect.col + 1, row, strings.get('ui.tool.designate.undo'));
  row += 1;
  // U-05: the last batch can take another priority (`SetDesignationPriority`).
  label(s, rect.col + 1, row, strings.get('ui.tool.designate.reprioritize', { n: tool.priority }), { fg: tool.lastBatch === null ? s.theme.dim : s.theme.text, width: rect.cols - 2 });
  if (reprioritize !== undefined) s.hit({ col: rect.col + 1, row, cols: rect.cols - 2, rows: 1 }, () => reprioritize());
  row += 1;
  separator(s, rect.col + 1, row, 0);
  label(s, rect.col + 1, row, strings.get('ui.tool.designate.help1'), { fg: t.dim, width: rect.cols - 1 });
  label(s, rect.col + 1, row + 1, strings.get('ui.tool.designate.help2'), { fg: t.dim, width: rect.cols - 1 });
}
