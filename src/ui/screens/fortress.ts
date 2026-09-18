/**
 * The fortress screen: `ui-screens/fortress-screen.md`, `02-systems/24-ui-and-input.md`
 * § Fortress screen layout, § Input model, § Inspection, § Announcements and the log, and
 * `ui-keymap-and-screens.md` § Keymap (global, map, panel keys), § Fortress panels, § Mouse.
 *
 * The compositor draws the map viewport; this screen draws over the same buffer: the rectangle of
 * a tool in progress, the sidebar (title row with the panel's name and hotkey, then the panel),
 * the log strip and the two status rows. It turns keys and mouse gestures into UI actions and
 * commands; everything that touches the simulation goes through its {@link FortressHost}.
 */

import type { Command } from '@core/commands';
import type { GameEvent } from '@core/events';
import type { Designation } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EventType } from '@core/event-types';
import type { AnnouncementSpec, PanelSpec } from '@core/system';
import type { TileIndex } from '@core/types';
import type { KeyPress } from '@platform/input';
import type { Layout, Rect } from '@render/cellbuffer';
import { AnnouncementLog, type LogLine } from '../announcements';
import { STATUS_HINT_SECONDS } from '../constants';
import type { Keymap } from '../keymap';
import { drawDesignatePanel, DesignateTool, rectTiles, type TilePoint } from '../panels/designate';
import { creaturesAt, creatureSummary, drawLookPanel, tileSummary, type LookTab } from '../panels/look';
import { drawLogPanel, drawLogStrip, type LogFilter } from '../panels/log';
import { clickHit, type CellPointer, type CellWheel, type Screen } from '../screen';
import { statusRow1, type Speed } from '../status';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import type { UiState } from '../ui-state';
import { label, labelRow } from '../widgets';

/** The panels the UI draws itself (24 § Panels: `designate` (03), `log`, `look`). */
export const UI_PANELS: readonly PanelSpec[] = [
  { id: 'designate', title: 'Designate', hotkey: 'd' },
  { id: 'look', title: 'Look', hotkey: 'k' },
  { id: 'log', title: 'Log', hotkey: 'a' },
];

/** The speeds `+` and `-` step through ("speed up (1× → 2× → 4×)"). */
const SPEEDS: readonly Speed[] = [1, 2, 4];

/** Milliseconds an alert flashes the strip ("the log strip flashes for one second"). */
export const ALERT_FLASH_MS = 1000;

export interface FortressSettings {
  /** 24: "`auto-pause on danger` setting is on (default on)". */
  autoPauseDanger: boolean;
}

export interface FortressHost {
  readonly readers: ReaderSet;
  readonly registry: Registry;
  readonly ui: UiState;
  submit(command: Command): void;
  speed(): Speed;
  setSpeed(speed: Speed): void;
  pan(dx: number, dy: number): void;
  changeZ(dz: number): void;
  centerOn(x: number, y: number, z: number): void;
  /** `Home`: centre on the hearth, or the wagon. */
  home(): void;
  /** `Ctrl` + wheel / `Ctrl+↑↓`: one zoom level in (+1) or out (−1). */
  zoom(delta: number): void;
  /** The layout of the last composed frame. */
  layout(): Layout;
  /** 03's precondition for designating a tile. */
  precondition(i: TileIndex, kind: Designation): boolean;
  /** The panels systems registered (`register.panel`). */
  registeredPanels(): readonly PanelSpec[];
  /** The announcement rows systems registered (`register.announcement`). */
  announcements(): readonly { type: EventType; spec: AnnouncementSpec }[];
  /** A wall clock in milliseconds, for the status hint and the flash (presentation only). */
  now(): number;
}

export class FortressScreen implements Screen {
  readonly id = 'fortress' as const;
  readonly tool = new DesignateTool();
  readonly log: AnnouncementLog;
  readonly settings: FortressSettings = { autoPauseDanger: true };
  lookTab: LookTab = 0;
  logFilter: LogFilter = 0;
  /** The tile under the mouse, for the status bar's second row. */
  hover: TileIndex | null = null;
  /** A danger line shown until any key dismisses it. */
  pinned: LogLine | null = null;
  private flashUntil = 0;
  private rejection: { text: string; until: number } | null = null;
  private dragging = false;
  private middle: { col: number; row: number } | null = null;
  private lastSpeed: Speed = 1;
  private last: Surface | null = null;
  private registered = false;

  constructor(
    private readonly host: FortressHost,
    private readonly keymap: Keymap,
    private readonly strings: Strings,
  ) {
    this.log = new AnnouncementLog(strings, host.registry);
  }

  get ui(): UiState {
    return this.host.ui;
  }

  /** Every panel: the UI's own and the registered ones, by hotkey. */
  panels(): PanelSpec[] {
    const out = [...UI_PANELS];
    for (const p of this.host.registeredPanels()) if (!out.some((q) => q.id === p.id)) out.push(p);
    return out;
  }

  private ensureRegistered(): void {
    if (this.registered) return;
    this.log.register(this.host.announcements());
    this.registered = true;
  }

  // ---------- events ----------

  /**
   * The presentation subscriber of 24 § Events consumed: every event through the announcement
   * registry; `CommandRejected` "shows the reason in the status bar for two seconds".
   */
  onEvents(events: readonly GameEvent[]): void {
    this.ensureRegistered();
    const readers = this.host.readers;
    for (const event of events) {
      if (event.type === 'CommandRejected') {
        const reason = String((event as unknown as { reason: string }).reason).replace(/_/g, ' ');
        this.rejection = { text: this.strings.get('ui.status.rejected', { reason }), until: this.host.now() + STATUS_HINT_SECONDS * 1000 };
        continue;
      }
      const done = this.log.announce(event, readers, readers.calendar.tick);
      if (done === null) continue;
      if (done.severity === 'alert') this.flashUntil = this.host.now() + ALERT_FLASH_MS;
      if (done.severity === 'danger') {
        this.pinned = done.line;
        if (this.settings.autoPauseDanger) this.host.setSpeed(0);
        if (done.focus !== undefined) this.focusOn(done.focus);
      }
    }
  }

  /** Centre the view on a tile (a danger's focus, a log line's). */
  focusOn(tile: TileIndex): void {
    const map = this.host.readers.map;
    const x = tile % map.w;
    const y = Math.floor(tile / map.w) % map.h;
    const z = Math.floor(tile / (map.w * map.h));
    this.host.centerOn(x, y, z);
  }

  // ---------- drawing ----------

  draw(surface: Surface): void {
    this.ensureRegistered();
    this.last = surface;
    const layout = this.host.layout();
    this.drawSelection(surface, layout.map);
    if (layout.sidebar !== null) this.drawSidebar(surface, layout.sidebar);
    drawLogStrip(surface, layout.log, this.log.lines, this.pinned, this.host.now() < this.flashUntil);
    this.drawStatus(surface, layout.status);
  }

  /** "While dragging: the rectangle is inverted on the map." */
  private drawSelection(surface: Surface, map: Rect): void {
    const a = this.tool.anchor;
    const b = this.tool.end ?? this.hoverPoint();
    if (a === null || b === null || a.z !== this.ui.z) return;
    const x0 = Math.min(a.x, b.x) - this.ui.camX;
    const y0 = Math.min(a.y, b.y) - this.ui.camY;
    const x1 = Math.max(a.x, b.x) - this.ui.camX;
    const y1 = Math.max(a.y, b.y) - this.ui.camY;
    const c0 = Math.max(0, x0);
    const r0 = Math.max(0, y0);
    const c1 = Math.min(map.cols - 1, x1);
    const r1 = Math.min(map.rows - 1, y1);
    if (c1 < c0 || r1 < r0) return;
    surface.invert({ col: map.col + c0, row: map.row + r0, cols: c1 - c0 + 1, rows: r1 - r0 + 1 });
  }

  private drawSidebar(surface: Surface, rect: Rect): void {
    const t = surface.theme;
    surface.fill(rect, t.black);
    const rule = surface.glyphs.index('│');
    for (let r = 0; r < rect.rows; r += 1) surface.put(rect.col, rect.row + r, rule, t.border, t.black);
    const panel = this.panels().find((p) => p.id === this.ui.panel);
    if (panel === undefined) return;
    const inner = { col: rect.col + 1, row: rect.row, cols: rect.cols - 1, rows: rect.rows };
    const key = `[${panel.hotkey}]`;
    label(surface, inner.col + 1, inner.row, panel.title, { fg: t.key, width: inner.cols - key.length - 2 });
    label(surface, inner.col + inner.cols - key.length - 1, inner.row, key);
    const body = { col: inner.col, row: inner.row + 1, cols: inner.cols, rows: inner.rows - 1 };
    const readers = this.host.readers;
    if (panel.id === 'designate') drawDesignatePanel(surface, body, this.tool, this.strings);
    else if (panel.id === 'look') drawLookPanel(surface, body, readers, this.host.registry, this.strings, this.lookTile(), this.lookTab);
    else if (panel.id === 'log') drawLogPanel(surface, body, this.log.lines, this.logFilter, this.strings, (line) => {
      if (line.focus !== undefined) this.focusOn(line.focus);
    });
  }

  private drawStatus(surface: Surface, rect: Rect): void {
    if (rect.rows <= 0) return;
    const t = surface.theme;
    const row1 = statusRow1(this.host.readers, this.strings, this.ui.z, this.host.speed(), rect.cols);
    labelRow(surface, rect.col, rect.row, rect.cols, row1);
    if (rect.rows > 1) labelRow(surface, rect.col, rect.row + 1, rect.cols, ` ${this.statusRow2()}`, { fg: t.text });
  }

  /**
   * Row 2: "the tile summary under the mouse (or the cursor), then the hotkey strip …; with a tool
   * active it shows the tool name, the priority, the rectangle size while dragging, and `[Esc]
   * cancel`." A rejection reason takes the row for `STATUS_HINT_SECONDS`.
   */
  statusRow2(): string {
    const s = this.strings;
    if (this.rejection !== null && this.host.now() < this.rejection.until) return this.rejection.text;
    if (this.tool.active) {
      const name = this.tool.name(s);
      const a = this.tool.anchor;
      const b = this.tool.end ?? this.hoverPoint();
      if (this.tool.kind === 'stairwell' && a !== null) return s.get('ui.status.stairwell_top', { z: a.z });
      if (a !== null && b !== null) {
        const w = Math.abs(a.x - b.x) + 1;
        const h = Math.abs(a.y - b.y) + 1;
        return s.get('ui.status.drag', { tool: name, w, h, n: w * h, priority: this.tool.priority });
      }
      if (this.tool.kind === 'traffic') return s.get('ui.status.tool_mode', { tool: name, mode: s.get(`ui.tool.traffic.${this.tool.traffic}`) });
      return s.get('ui.status.tool', { tool: name, priority: this.tool.priority });
    }
    const tile = this.hover ?? this.cursorTile();
    const strip = s.get('ui.status.strip');
    if (tile === null) return strip;
    const creatures = creaturesAt(this.host.readers, tile);
    const summary = creatures.length > 0 ? creatureSummary(this.host.readers, creatures[0] as number) : tileSummary(this.host.readers, s, tile);
    return `${summary} · ${strip}`;
  }

  // ---------- tiles and points ----------

  private tileOf(p: TilePoint): TileIndex | null {
    const map = this.host.readers.map;
    return map.inBounds(p.x, p.y, p.z) ? map.index(p.x, p.y, p.z) : null;
  }

  private pointOfCell(col: number, row: number): TilePoint | null {
    const rect = this.host.layout().map;
    if (col < rect.col || row < rect.row || col >= rect.col + rect.cols || row >= rect.row + rect.rows) return null;
    const p = { x: this.ui.camX + col - rect.col, y: this.ui.camY + row - rect.row, z: this.ui.z };
    return this.tileOf(p) === null ? null : p;
  }

  private hoverPoint(): TilePoint | null {
    if (this.hover === null) return null;
    const map = this.host.readers.map;
    return { x: this.hover % map.w, y: Math.floor(this.hover / map.w) % map.h, z: this.ui.z };
  }

  private cursorTile(): TileIndex | null {
    const c = this.ui.cursor;
    return c === null ? null : this.tileOf({ x: c.x, y: c.y, z: this.ui.z });
  }

  /** "k: look cursor at the mouse (or map center)". */
  private centerPoint(): TilePoint {
    const rect = this.host.layout().map;
    return { x: this.ui.camX + Math.floor(rect.cols / 2), y: this.ui.camY + Math.floor(rect.rows / 2), z: this.ui.z };
  }

  /** The point a keyboard action works at: the look cursor, the mouse, or the map centre. */
  private actionPoint(): TilePoint {
    const c = this.ui.cursor;
    if (c !== null) return { x: c.x, y: c.y, z: this.ui.z };
    return this.hoverPoint() ?? this.centerPoint();
  }

  lookTile(): TileIndex | null {
    return this.cursorTile();
  }

  // ---------- actions ----------

  openPanel(id: string | null): void {
    if (id !== 'designate') this.tool.cancel();
    this.ui.panel = id;
    this.ui.sidebar = true;
  }

  /** Look at a tile: the look panel with the cursor on it. */
  look(p: TilePoint): void {
    this.ui.cursor = { x: p.x, y: p.y };
    this.lookTab = 0;
    this.openPanel('look');
  }

  /** Submit a finished rectangle. */
  commit(a: TilePoint, b: TilePoint): Command[] {
    const map = this.host.readers.map;
    const commands = this.tool.commands({ map, precondition: (i, k) => this.host.precondition(i, k) }, a, b);
    for (const c of commands) this.host.submit(c);
    this.tool.remember(commands);
    this.tool.anchor = null;
    this.tool.end = null;
    return commands;
  }

  /** `Enter` with a tool: "start/end rectangle at the cursor". */
  private rectPoint(): void {
    const p = this.actionPoint();
    if (this.tool.anchor === null) {
      this.tool.anchor = p;
      return;
    }
    const a = this.tool.anchor;
    // A stairwell's two points differ in level; a rectangle's lie on the first point's level.
    this.commit(a, this.tool.kind === 'stairwell' ? p : { x: p.x, y: p.y, z: a.z });
  }

  /** "`Esc` cancels the current tool, then closes the panel, then opens the game menu." */
  private cancel(): void {
    if (this.tool.anchor !== null) {
      this.tool.anchor = null;
      this.tool.end = null;
      return;
    }
    if (this.tool.active) {
      this.tool.cancel();
      return;
    }
    if (this.ui.panel !== null) {
      this.ui.panel = null;
      if (this.ui.cursor !== null) this.ui.cursor = null;
    }
    // The game menu is M7's (T-M7).
  }

  private step(delta: number): void {
    const now = this.host.speed();
    const at = SPEEDS.indexOf(now === 0 ? this.lastSpeed : now);
    const next = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, at + delta))] as Speed;
    this.host.setSpeed(next);
    this.lastSpeed = next;
  }

  key(press: KeyPress): boolean {
    this.ensureRegistered();
    if (this.pinned !== null) {
      // "the strip shows the line until dismissed by any key".
      this.pinned = null;
      return true;
    }
    const global = this.keymap.resolve('global', press);
    if (global !== null) {
      switch (global.id) {
        case 'cancel':
          this.cancel();
          return true;
        case 'pause': {
          const speed = this.host.speed();
          if (speed === 0) this.host.setSpeed(this.lastSpeed);
          else {
            this.lastSpeed = speed;
            this.host.setSpeed(0);
          }
          return true;
        }
        case 'speed_up':
          this.step(1);
          return true;
        case 'speed_down':
          this.step(-1);
          return true;
        case 'toggle_sidebar':
          this.ui.sidebar = !this.ui.sidebar;
          return true;
        case 'undo': {
          const cmd = this.tool.undo();
          if (cmd !== null) this.host.submit(cmd);
          return true;
        }
        default:
          break;
      }
    }
    if (press.key === ' ') return this.key({ ...press, key: 'Space' });

    // The open panel's own keys come before the map's and the panel hotkeys.
    const panel = this.ui.panel;
    if (panel === 'designate' && this.ui.sidebar) {
      const acc = this.keymap.resolve('panel', press);
      if (acc?.id === 'accelerator' && !press.ctrl && this.tool.choose(String(acc.arg))) return true;
    }
    if ((panel === 'look' || panel === 'log') && /^[1-3]$/.test(press.key) && !this.tool.active) {
      const n = Number(press.key) - 1;
      if (panel === 'look') this.lookTab = n as LookTab;
      else this.logFilter = n as LogFilter;
      return true;
    }

    const map = this.keymap.resolve('map', press);
    if (map !== null) {
      switch (map.id) {
        case 'pan': {
          const step = map.shift ? 10 : 1;
          const d = { '←': [-1, 0], '→': [1, 0], '↑': [0, -1], '↓': [0, 1] }[map.arg as '←'] ?? [0, 0];
          this.host.pan((d[0] as number) * step, (d[1] as number) * step);
          return true;
        }
        case 'z_down':
          this.host.changeZ(-1);
          return true;
        case 'z_up':
          this.host.changeZ(1);
          return true;
        case 'home':
          this.host.home();
          return true;
        case 'zoom':
          this.host.zoom(Number(map.arg));
          return true;
        case 'look':
          if (!this.tool.active) {
            this.look(this.hoverPoint() ?? this.centerPoint());
            return true;
          }
          break;
        case 'rect_point':
          if (this.tool.active) {
            this.rectPoint();
            return true;
          }
          break;
        case 'priority':
          if (this.tool.active) {
            this.tool.setPriority(Number(map.arg));
            return true;
          }
          break;
        case 'delete_selection':
          if (panel === 'designate') {
            this.tool.cancel();
            this.tool.clearing = true;
            return true;
          }
          break;
        default:
          break;
      }
    }

    if (!press.ctrl && !press.alt && !press.meta) {
      const opened = this.panels().find((p) => p.hotkey === press.key);
      if (opened !== undefined) {
        if (this.ui.panel === opened.id && this.ui.sidebar) this.openPanel(null);
        else if (opened.id === 'look') this.look(this.hoverPoint() ?? this.centerPoint());
        else this.openPanel(opened.id);
        return true;
      }
    }
    return false;
  }

  // ---------- mouse ----------

  pointerDown(p: CellPointer): void {
    const at = this.pointOfCell(p.col, p.row);
    if (at === null) {
      clickHit(this.last, p);
      return;
    }
    if (p.button === 1) {
      this.middle = { col: p.col, row: p.row };
      return;
    }
    if (p.button === 2) {
      // "Right click: cancels the current tool; with no tool, opens the inspection panel".
      if (this.tool.active) this.tool.cancel();
      else this.look(at);
      return;
    }
    if (p.button !== 0) return;
    if (this.tool.kind === 'stairwell' && this.tool.anchor !== null && this.tool.anchor.z !== at.z) {
      this.commit(this.tool.anchor, at);
      return;
    }
    if (this.tool.active) {
      this.tool.anchor = at;
      this.tool.end = at;
      this.dragging = true;
      return;
    }
    this.look(at);
  }

  pointerMove(p: CellPointer): void {
    const at = this.pointOfCell(p.col, p.row);
    this.hover = at === null ? null : this.tileOf(at);
    if (this.middle !== null) {
      // Middle drag pans: the map follows the pointer.
      this.host.pan(this.middle.col - p.col, this.middle.row - p.row);
      this.middle = { col: p.col, row: p.row };
      return;
    }
    if (this.dragging && at !== null && this.tool.anchor !== null) this.tool.end = { x: at.x, y: at.y, z: this.tool.anchor.z };
  }

  pointerUp(p: CellPointer): void {
    if (p.button === 1) {
      this.middle = null;
      return;
    }
    if (!this.dragging) return;
    this.dragging = false;
    const a = this.tool.anchor;
    const at = this.pointOfCell(p.col, p.row);
    const b = at === null ? this.tool.end : { x: at.x, y: at.y, z: a?.z ?? this.ui.z };
    if (a === null || b === null) return;
    if (this.tool.kind === 'stairwell') {
      // A stairwell spans levels: the click marks the top; the bottom is the next point (Enter
      // or click) after changing level.
      if (a.x === b.x && a.y === b.y) {
        this.tool.end = null;
        return;
      }
    }
    this.commit(a, b);
  }

  wheel(w: CellWheel): void {
    if (w.ctrl) {
      this.host.zoom(w.dy < 0 ? 1 : -1);
      return;
    }
    if (w.shift) {
      this.host.pan(0, w.dy > 0 ? 1 : -1);
      return;
    }
    // "Wheel: z-level (down = deeper)".
    this.host.changeZ(w.dy > 0 ? -1 : 1);
  }

  /** The tiles a rectangle between two points covers (for the tests and the status bar). */
  tilesBetween(a: TilePoint, b: TilePoint): TileIndex[] {
    return rectTiles(this.host.readers.map, a, b);
  }
}
