import type { BuildingsReader } from '@systems/buildings';
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
import { TileFlag, type Designation } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EventType } from '@core/event-types';
import type { AnnouncementSpec, PanelSpec } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { KeyPress } from '@platform/input';
import type { Layout, Rect } from '@render/cellbuffer';
import { AnnouncementLog, type LogLine } from '../announcements';
import { HintEngine, type HintRow } from '../hints';
import { STATUS_HINT_SECONDS } from '../constants';
import { acceleratorOf, keyLabel, type Keymap } from '../keymap';
import { drawDesignatePanel, DesignateTool, rectTiles, type TilePoint } from '../panels/designate';
import { BuildTool, drawBuildPanel } from '../panels/build';
import { BuildingPanel, drawBuildingPanel } from '../panels/building';
import { buildings, confirmThen, type PanelContext } from '../panels/context';
import { drawJobsPanel, JobsPanel } from '../panels/jobs';
import { drawLaborsPanel, LaborsPanel } from '../panels/labors';
import { drawStocksPanel, StocksPanel } from '../panels/stocks';
import { drawUnitsPanel, dwarvesOf, idleCount, UnitsPanel } from '../panels/units';
import { drawZonesPanel, removalConfirm, ZoneTool } from '../panels/zones';
import { countStep, drawOrdersPanel, drawWorkshopPanel, OrdersPanel } from '../panels/orders';
import { drawAnimalsPanel, AnimalsPanel } from '../panels/animals';
import { drawMoodPanel, MoodPanel } from '../panels/mood';
import { changePopulationCap, drawPopulationPanel, POPULATION_CAP_STEP } from '../panels/population';
import { drawMilitaryPanel, MilitaryPanel } from '../panels/military';
import { drawThreatsPanel, ThreatsPanel } from '../panels/threats';
import { CivilizationsPanel, drawCivilizationsPanel } from '../panels/civilizations';
import { DepotPanel, drawDepotPanel } from '../panels/depot';
import { C } from '@core/components';
import { creaturesAt, creatureSummary, drawLookPanel, tileSummary, type LookTab } from '../panels/look';
import { drawLogPanel, drawLogStrip, type LogFilter } from '../panels/log';
import { clickHit, type CellPointer, type CellWheel, type Screen } from '../screen';
import { statusFields, statusRight, statusRow1, statusFieldSpacing, statusPanelStrip, type Speed } from '../status';
import { drawCalendarPanel, weatherColor, weatherGlyph, weatherOf } from '../panels/calendar';
import { drawOverlaysPanel, OVERLAY_ROWS, OverlayMenu } from '../panels/overlays';
import { drawHelpPanel, HelpPanel, type HelpTab } from '../panels/help';
import { DebugPanel, drawDebugPanel, type DebugHost } from '../panels/debug';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import type { UiState } from '../ui-state';
import { drawTooltip, editText, label, labelRow, typedChar } from '../widgets';
import { blockedText, buildingName, commandFocus, pluralName, rejectionText, zoneName, zoneEditorMessage } from '../messages';

/** The panels the UI draws itself (24 § Panels: `designate` (03), `log`, `look`). */
export const UI_PANELS: readonly PanelSpec[] = [
  { id: 'designate', title: 'Designate', hotkey: 'd' },
  { id: 'look', title: 'Look', hotkey: 'k' },
  { id: 'log', title: 'Log', hotkey: 'a' },
  // 23 § Compositor step 8, `ui-screens/panels.md` § Overlays (f) (T-M3-08).
  { id: 'overlays', title: 'Overlays', hotkey: 'f' },
  // `06` § Player-facing behavior: opened from the status bar date; no hotkey (D-103).
  { id: 'calendar', title: 'Calendar', hotkey: '' },
  { id: 'population', title: 'Population', hotkey: 'p' },
  { id: 'civilizations', title: 'Civilizations', hotkey: 'c' },
  // `ui-screens/panels.md` §§ Help, Debug; their keys are the global `?` and `F12` rows (T-M7-08).
  { id: 'help', title: 'Help', hotkey: '?' },
  { id: 'debug', title: 'Debug', hotkey: 'F12' },
];

/** The speeds `+` and `-` step through ("speed up (1× → 2× → 4×)"). */
const SPEEDS: readonly Speed[] = [1, 2, 4];

/** Milliseconds an alert flashes the strip ("the log strip flashes for one second"). */
export const ALERT_FLASH_MS = 1000;

/** Rows `PageUp`/`PageDown` scroll the help and debug lists by (`ui-keymap-and-screens.md` § Panels). */
export const HELP_PAGE_ROWS = 10;

export interface FortressSettings {
  /** 24: "`auto-pause on danger` setting is on (default on)". */
  autoPauseDanger: boolean;
  autoPauseAlert: boolean;
  hintsEnabled: boolean;
  edgeScrolling: boolean;
  combatLog: 'all' | 'hits only' | 'off';
}

export interface FortressHost {
  readonly loadSheddingActive?: boolean;
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
  /** `F5` quick save and `F9` quick load (24 § Input model), when the app offers saving (T-M2-11). */
  quickSave?(): void;
  quickLoad?(): void;
  gameMenu?(): void;
  /** `Ctrl+S`: the save menu (the game menu with Save chosen). */
  saveMenu?(): void;
  /** The debug panel's timings and its three actions (`ui-screens/panels.md` § Debug). */
  debug?: DebugHost;
  confirm?(id: string, params: Readonly<Record<string, unknown>>, answer: (yes: boolean) => void): void;
  /** Open the labor manager over the fortress, with these dwarves marked or the cursor on one (U-06). */
  laborManager?(open: { readonly marked?: readonly EntityId[]; readonly focus?: EntityId | undefined }): void;
  /** The `text_input` dialog: a rename. The answer is the text, or null when cancelled (U-06). */
  prompt?(spec: { readonly title: string; readonly value: string; readonly maxLength: number }, answer: (text: string | null) => void): void;
}

export class FortressScreen implements Screen {
  readonly id = 'fortress' as const;
  readonly tool = new DesignateTool();
  readonly build = new BuildTool();
  readonly zones = new ZoneTool();
  readonly stocks = new StocksPanel();
  readonly units = new UnitsPanel();
  readonly jobs = new JobsPanel();
  readonly labors = new LaborsPanel();
  readonly orders = new OrdersPanel();
  readonly animals = new AnimalsPanel();
  readonly mood = new MoodPanel();
  readonly military = new MilitaryPanel();
  readonly threats = new ThreatsPanel();
  readonly civilizations = new CivilizationsPanel();
  readonly depot = new DepotPanel();
  /** The building panel: a click on any building that is not a workshop or a depot (U-05). */
  readonly building = new BuildingPanel();
  workshopId = 0;
  /** The shift state of the click being handled (the labor grid's "shift-click: whole column"). */
  private clickShift = false;
  readonly log: AnnouncementLog;
  readonly hints: HintEngine;
  readonly settings: FortressSettings = { autoPauseDanger: true, autoPauseAlert: false, hintsEnabled: true, edgeScrolling: false, combatLog: 'hits only' };
  lookTab: LookTab = 0;
  logFilter: LogFilter = 0;
  /** The overlays panel (T-M3-08). */
  readonly overlayMenu = new OverlayMenu();
  /** The help and debug panels (T-M7-08). */
  readonly help: HelpPanel;
  readonly debugPanel = new DebugPanel();
  /** The tile under the mouse, for the status bar's second row. */
  hover: TileIndex | null = null;
  /** A danger line shown until any key dismisses it. */
  pinned: LogLine | null = null;
  private flashUntil = 0;
  private message: { text: string; until: number } | null = null;
  private noticeGhost: string | null = null;
  private dragging = false;
  /**
   * `ui-keymap-and-screens.md` § Mouse: "Left drag | with no tool: select a rectangle (then
   * `Delete`, forbid, dump, move to depot)". Presentation only, never saved (D-200).
   */
  selection: { a: TilePoint; b: TilePoint } | null = null;
  private selecting: TilePoint | null = null;
  private middle: { col: number; row: number } | null = null;
  private lastSpeed: Speed = 1;
  /** The cells of the speed glyph on row 1: a right click there steps the speed. */
  private speedRegion: Rect | null = null;
  private last: Surface | null = null;
  pointer: { col: number; row: number } | null = null;
  private registered = false;

  constructor(
    private readonly host: FortressHost,
    private readonly keymap: Keymap,
    private readonly strings: Strings,
  ) {
    this.log = new AnnouncementLog(strings, host.registry, this.ui);
    this.hints = new HintEngine(host.registry, host.ui, this.log);
    this.help = new HelpPanel(host.registry, keymap, strings);
  }

  get ui(): UiState {
    return this.host.ui;
  }

  /** What the T-M2-09 panels reach. */
  get ctx(): PanelContext {
    const host = this.host;
    return {
      readers: host.readers,
      registry: host.registry,
      strings: this.strings,
      submit: (c) => host.submit(c),
      focusOn: (t) => this.focusOn(t),
      look: (t) => {
        const map = host.readers.map;
        this.focusOn(t);
        this.look({ x: t % map.w, y: Math.floor(t / map.w) % map.h, z: Math.floor(t / (map.w * map.h)) });
      },
      openPanel: (id) => this.openPanel(id),
      shiftClick: () => this.clickShift,
      notice: (text) => this.notice(text),
      clearNotice: () => this.clearNotice(),
      panelLetters: this.panelLetters(),
      ...(host.confirm === undefined ? {} : {
        confirm: (id: string, params: Readonly<Record<string, string | number>>, run: () => void): void => {
          host.confirm?.(id, params, (yes) => { if (yes) run(); });
        },
      }),
      ...(host.laborManager === undefined ? {} : { laborManager: (open) => host.laborManager?.(open) }),
      ...(host.prompt === undefined ? {} : { prompt: (spec, answer) => host.prompt?.(spec, answer) }),
    };
  }

  /**
   * The letters that open panels now (D-U2: "panel hotkeys always win"): the keymap's
   * `fortress_panel` rows and any registered panel's own letter. An accelerator on one of them
   * needs `Shift`.
   */
  panelLetters(): Set<string> {
    const out = this.keymap.panelLetters();
    // `panels()` gives a registered panel the key it is bound to now, or its own letter when unbound.
    for (const panel of this.panels()) if (/^[a-z]$/.test(panel.hotkey)) out.add(panel.hotkey);
    return out;
  }

  /**
   * `Space` marks a row where a list is a multi-select (the units table, the squad's add and
   * remove lists) instead of pausing: UI audit § 3 "`Space` to mark rows" (D-247).
   */
  private markKey(): boolean {
    if (!this.ui.sidebar) return false;
    if (this.ui.panel === 'units' && !this.units.editing && this.units.choice === null) {
      this.units.toggleMark(this.ctx);
      return true;
    }
    if (this.ui.panel === 'military') return this.military.toggleMark(this.ctx);
    return false;
  }

  /** The tool whose rectangle the map shows: the designate or the zone tool. */
  private rectTool(): { anchor: TilePoint | null; end: TilePoint | null } | null {
    if (this.tool.active) return this.tool;
    if (this.zones.active) return this.zones;
    return null;
  }

  /** Any map tool is active. */
  get toolActive(): boolean {
    return this.tool.active || this.build.active || this.zones.active;
  }

  /** Every panel: the UI's own and the registered ones, by hotkey. */
  panels(): PanelSpec[] {
    const out = [...UI_PANELS];
    for (const p of this.host.registeredPanels()) if (!out.some((q) => q.id === p.id)) out.push(p);
    return out.map((panel) => {
      // A panel's title is `ui.panel.<id>.title` when the strings table has it
      // (`ui-screens/fortress-screen.md` § Strings), otherwise the registered one.
      const key = `ui.panel.${panel.id}.title`;
      const titled = this.strings.has(key) ? { ...panel, title: this.strings.get(key) } : panel;
      // Help and Debug are bound in the global context (`?`, `F12`), the rest in `fortress_panel`.
      const binding = this.keymap.bindings.find((entry) => entry.context === 'fortress_panel' && entry.id === panel.id)
        ?? this.keymap.bindings.find((entry) => entry.context === 'global' && entry.id === panel.id);
      return binding ? { ...titled, hotkey: keyLabel(binding.spec) } : titled;
    });
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
    const arrivals = new Map<string, { line: LogLine; count: number; name: string }>();
    for (const event of events) {
      this.orders.onEvent(event);
      if (event.type === 'AttackResolved' && (this.settings.combatLog === 'off' || (this.settings.combatLog === 'hits only' && event['outcome'] !== 'hit'))) continue;
      if (event.type === 'VeinFound') {
        const material = (event as unknown as { material?: string }).material;
        if (material !== undefined && this.host.registry.table<{ id: string; deepsilver?: boolean }>('minerals').byId(material)?.deepsilver === true) this.ui.deepFound = true;
      }
      if (event.type === 'CommandRejected') {
        // `command-catalog.md` § Rejection reasons, made specific where the command tells more
        // (D-U4); 24 § Announcements: the status row shows it and the log keeps it as an alert
        // with the command's focus.
        const e = event as unknown as { reason: string; command?: Command };
        if (e.command?.type === 'PlaceBuilding') this.build.clearPlacement();
        const reason = rejectionText(this.ctx, e.command, String(e.reason));
        const text = this.strings.get('ui.status.rejected', { reason });
        this.notice(text);
        this.log.append('alert', text, readers.calendar.tick, commandFocus(readers, e.command));
        this.flashUntil = this.host.now() + ALERT_FLASH_MS;
        continue;
      }
      // One line per dangerous species in a batch: "A wolf has come to the valley.", "3 wolves have come to the valley.".
      const species = event.type === 'AnimalSpawned' ? String(event['species']) : '';
      const group = species === '' ? undefined : arrivals.get(species);
      if (group !== undefined) {
        group.count += 1;
        group.line.text = this.strings.get('announce.dangerous_arrived_many', { count: group.count, species: pluralName(group.name) });
        continue;
      }
      if (event.type === 'ZoneChanged' && event['change'] === 'created' && this.pendingZone !== null && event['zoneType'] === this.pendingZone.type) {
        // A zone made by a drag says so, names the tiles left out, and is selected at once (T-274).
        const zoneId = Number(event['zoneId']);
        const made = this.pendingZone;
        this.pendingZone = null;
        const name = zoneName(this.ctx, zoneId);
        this.notice(made.left === 0 ? this.strings.get('ui.status.zone_made', { name, n: made.made }) : this.strings.get('ui.status.zone_made_left', { name, n: made.made, left: made.left, reasons: made.reasons }));
        this.zones.selected = zoneId;
        this.zones.stockpile.reset();
      }
      const done = this.log.announce(event, readers, readers.calendar.tick);
      if (done === null) continue;
      if (event.type === 'AnimalSpawned' && done.severity === 'alert') {
        arrivals.set(species, { line: done.line, count: 1, name: String(this.host.registry.table<{ id: string; name: string }>('creatures').byId(species)?.name ?? species).toLowerCase() });
        // The first sighting pauses once per fortress, as a first raid does; later ones never do.
        if (!this.ui.wildlifeAlerted) {
          this.ui.wildlifeAlerted = true;
          if (this.settings.autoPauseDanger) this.host.setSpeed(0);
        }
      }
      if (done.severity === 'alert') {
        this.flashUntil = this.host.now() + ALERT_FLASH_MS;
        if (this.settings.autoPauseAlert) this.host.setSpeed(0);
      }
      if (done.severity === 'danger') {
        this.pinned = done.line;
        if (this.settings.autoPauseDanger) this.host.setSpeed(0);
        if (done.focus !== undefined) this.focusOn(done.focus);
      }
    }
    this.hints.onEvents(events, readers, this.settings.hintsEnabled);
  }

  /**
   * A message on status row 2 for `STATUS_HINT_SECONDS`: a refusal, or why a gesture did nothing
   * (D-U4: "UI-layer no-ops get a status message"). Replaced at once by starting a drag, a new
   * ghost state or a new notice (T-243).
   */
  notice(text: string): void {
    this.build.clearPlacementNotice();
    this.message = { text, until: this.host.now() + STATUS_HINT_SECONDS * 1000 };
    this.noticeGhost = this.build.active ? this.ghostKey() : null;
  }

  clearNotice(): void {
    this.build.clearPlacementNotice();
    this.message = null;
    this.noticeGhost = null;
  }

  private ghostKey(): string {
    if (!this.build.active) return '';
    const p = this.hoverPoint() ?? this.actionPoint();
    const row = this.build.current(this.ctx);
    if (row === undefined) return '';
    const ghost = this.build.ghost(this.ctx, p);
    const blocked = ghost === null ? 'null' : (blockedText(this.ctx, row.id, ghost) ?? 'ok');
    return `${row.id}:${p.x},${p.y},${p.z}:${blocked}`;
  }

  /** The status message while it shows, or null. */
  get currentNotice(): string | null {
    return this.message !== null && this.host.now() < this.message.until ? this.message.text : null;
  }

  /** 02 § Arrival: the first hint appears when the paused fortress screen opens. */
  showFirstHint(): void { this.hints.show('hint_dig', this.host.readers.calendar.tick, this.settings.hintsEnabled); }

  /** 24 § Interfaces: future systems and content can add a hint through the UI registry. */
  registerHint(hint: HintRow): void { this.hints.hint(hint); }

  resetHints(): void {
    this.ui.hintsShown = [];
    this.ui.hintPending = [];
    this.ui.hintBareSince = [];
    this.ui.hintUnreachableSince = [];
    this.ui.workshopIdleNotes = [];
    this.ui.wildlifeAlerted = false;
  }

  /** The tiles of the current selection, or an empty list. */
  selectionTiles(): TileIndex[] {
    const sel = this.selection;
    return sel === null ? [] : rectTiles(this.host.readers.map, sel.a, sel.b);
  }

  /**
   * The keys a selection takes. `Delete` is the § Map row "with a selection: cancel designations /
   * remove zone / cancel building"; `f`, `d` and `t` are § Stocks' forbid, dump and move to depot.
   */
  private selectionKey(press: KeyPress): boolean {
    const tiles = this.selectionTiles();
    if (tiles.length === 0) return false;
    // `f`, `d` and `t` are panel letters: with a selection they take `Shift` (D-U2).
    const key = press.key === 'Delete' ? 'Delete' : acceleratorOf(press, this.panelLetters());
    if (key === 'Delete') {
      this.host.submit({ type: 'UndoDesignation', tiles });
      const buildings = this.host.readers.has('14') ? this.host.readers.of<import('@systems/buildings').BuildingsReader>('14') : null;
      if (buildings !== null) {
        const zones = new Set<number>();
        for (const tile of tiles) {
          const id = buildings.at(tile);
          const state = id === 0 ? undefined : buildings.get(id)?.state;
          if (state === 'planned' || state === 'constructing') this.host.submit({ type: 'CancelBuilding', buildingId: id });
          const zone = buildings.zoneAt(tile);
          if (zone !== 0) zones.add(zone);
        }
        for (const zone of Array.from(zones).sort((a, b) => a - b)) {
          if ((buildings.zone(zone)?.tiles ?? []).every((t) => tiles.includes(t))) this.removeZone(zone);
        }
      }
      this.selection = null;
      return true;
    }
    if (key === 'f') { this.host.submit({ type: 'ForbidItem', tiles, on: true }); return true; }
    if (key === 'd') {
      confirmThen(this.ctx, 'c_dump_selection', { n: tiles.length }, () => this.host.submit({ type: 'DumpItem', tiles, on: true }));
      return true;
    }
    if (key === 't') {
      const items = this.host.readers.has('13') ? this.host.readers.of<{ at(i: TileIndex): number[] }>('13') : null;
      const ids = items === null ? [] : tiles.flatMap((tile) => items.at(tile));
      if (ids.length > 0) this.host.submit({ type: 'MoveToDepot', itemIds: ids });
      else this.notice(this.strings.get('ui.status.no_goods'));
      return true;
    }
    return false;
  }

  /** § Mouse: a double-clicked unit or job row centres the map on it. */
  private centerOnPanelRow(): void {
    const ctx = this.ctx;
    if (this.ui.panel === 'units') {
      const id = this.units.selectedId(ctx);
      const p = id === 0 ? undefined : this.host.readers.entities.get(id, C.Position);
      if (p !== undefined) this.focusOn(this.host.readers.map.index(p.x, p.y, p.z));
      return;
    }
    if (this.ui.panel === 'jobs') {
      const job = this.jobs.selected(ctx);
      const tile = job === undefined ? null : this.jobs.tileOf(ctx, job);
      if (tile !== null) this.focusOn(tile);
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
    this.drawSelectionBorder(surface, layout.map);
    this.drawRoomBorder(surface, layout.map);
    this.drawGhost(surface, layout.map);
    if (layout.sidebar !== null) this.drawSidebar(surface, layout.sidebar);
    drawLogStrip(surface, layout.log, this.log.lines, this.pinned, this.host.now() < this.flashUntil);
    // A pinned danger line is dismissed by a click on it, as by the first key.
    if (this.pinned !== null && layout.log.rows > 0) surface.hit({ col: layout.log.col, row: layout.log.row + layout.log.rows - 1, cols: layout.log.cols, rows: 1 }, () => { this.pinned = null; });
    this.drawStatus(surface, layout.status);
    drawTooltip(surface, this.pointer);
  }

  /** "While dragging: the rectangle is inverted on the map"; a zone rectangle shows valid tiles as ▒ on green and blocked tiles as x on red. */
  private drawSelection(surface: Surface, map: Rect): void {
    const tool = this.rectTool();
    if (tool === null) return;
    const a = tool.anchor;
    const b = tool.end ?? this.hoverPoint();
    if (a === null || b === null || a.z !== this.ui.z) return;
    if (tool === this.zones) {
      this.drawZoneRect(surface, map, a, b);
      return;
    }
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

  /** 23 § Compositor step 10: "a selection rectangle inverts its border cells". */
  private drawSelectionBorder(surface: Surface, map: Rect): void {
    const sel = this.selection;
    if (sel === null || sel.a.z !== this.ui.z) return;
    const x0 = Math.min(sel.a.x, sel.b.x) - this.ui.camX;
    const y0 = Math.min(sel.a.y, sel.b.y) - this.ui.camY;
    const x1 = Math.max(sel.a.x, sel.b.x) - this.ui.camX;
    const y1 = Math.max(sel.a.y, sel.b.y) - this.ui.camY;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
        if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) continue;
        surface.invert({ col: map.col + x, row: map.row + y, cols: 1, rows: 1 });
      }
    }
  }

  /** A selected room marks open border tiles with x on red in either palette. */
  private drawRoomBorder(surface: Surface, rect: Rect): void {
    if (this.ui.panel !== 'zones' || this.zones.active) return;
    const map = this.host.readers.map;
    for (const tile of buildings(this.ctx)?.roomDiagnostics(this.zones.selected)?.openBorder ?? []) {
      const z = Math.floor(tile / (map.w * map.h));
      if (z !== this.ui.z) continue;
      const col = tile % map.w - this.ui.camX;
      const row = Math.floor(tile / map.w) % map.h - this.ui.camY;
      if (col < 0 || row < 0 || col >= rect.cols || row >= rect.rows) continue;
      surface.put(rect.col + col, rect.row + row, surface.glyphs.index('x'), surface.theme.black, surface.theme.bad);
    }
  }

  /** Zone validity is a glyph as well as a background, in both palettes. */
  private drawZoneRect(surface: Surface, map: Rect, a: TilePoint, b: TilePoint): void {
    const t = surface.theme;
    const type = this.zones.resizing ? (this.ctx.readers.has('14') ? (this.ctx.readers.of<{ zone(id: number): { type: string } | undefined }>('14').zone(this.zones.selected)?.type ?? '') : '') : (this.zones.kind ?? '');
    for (const i of rectTiles(this.host.readers.map, a, b)) {
      const m = this.host.readers.map;
      const col = (i % m.w) - this.ui.camX;
      const row = (Math.floor(i / m.w) % m.h) - this.ui.camY;
      if (col < 0 || row < 0 || col >= map.cols || row >= map.rows) continue;
      const ok = this.zones.tileOk(this.ctx, type, i, this.zones.resizing ? this.zones.selected : 0);
      surface.put(map.col + col, map.row + row, surface.glyphs.index(ok ? '▒' : 'x'), t.black, ok ? t.good : t.bad);
    }
  }

  /** The build tool's footprint ghost under the pointer: "a building ghost uses green or red `bg` by validity" (23 step 10). */
  private drawGhost(surface: Surface, map: Rect): void {
    if (!this.build.active) return;
    const t = surface.theme;
    const okGlyph = surface.glyphs.index('▒');
    const badGlyph = surface.glyphs.index('x');
    const m = this.host.readers.map;
    const from = this.build.anchor;
    if (from !== null) {
      // A drag of a 1×1 type: one ghost per tile of the rectangle, blocked tiles marked (D-U6).
      if (from.z !== this.ui.z) return;
      const to = this.build.end ?? this.hoverPoint() ?? from;
      const ok = new Set(this.build.plan(this.ctx, from, to).ok);
      for (const i of rectTiles(m, from, { x: to.x, y: to.y, z: from.z })) {
        const col = (i % m.w) - this.ui.camX;
        const r = (Math.floor(i / m.w) % m.h) - this.ui.camY;
        if (col < 0 || r < 0 || col >= map.cols || r >= map.rows) continue;
        surface.put(map.col + col, map.row + r, ok.has(i) ? okGlyph : badGlyph, t.black, ok.has(i) ? t.ghostOk : t.ghostBad);
      }
      return;
    }
    const p = this.hoverPoint();
    if (p === null) return;
    const ghost = this.build.ghost(this.ctx, p);
    const row = this.build.current(this.ctx);
    if (ghost === null || row === undefined) return;
    for (const i of ghost.tiles) {
      const col = (i % m.w) - this.ui.camX;
      const r = (Math.floor(i / m.w) % m.h) - this.ui.camY;
      if (col < 0 || r < 0 || col >= map.cols || r >= map.rows) continue;
      const bad = ghost.reason !== null && (ghost.bad.includes(i) || ghost.bad.length === 0);
      surface.put(map.col + col, map.row + r, bad ? badGlyph : okGlyph, t.black, bad ? t.ghostBad : t.ghostOk);
    }
  }

  private drawSidebar(surface: Surface, rect: Rect): void {
    const t = surface.theme;
    surface.fill(rect, t.black);
    const rule = surface.glyphs.index('│');
    for (let r = 0; r < rect.rows; r += 1) surface.put(rect.col, rect.row + r, rule, t.border, t.black);
    const panel = this.panels().find((p) => p.id === this.ui.panel) ?? (this.ui.panel === 'workshop' || this.ui.panel === 'depot' ? { id: this.ui.panel, title: this.ui.panel === 'depot' ? 'Depot' : 'Workshop', hotkey: '' }
        : this.ui.panel === 'building' ? { id: 'building', title: this.strings.get('ui.panel.building.title'), hotkey: '' } : undefined);
    if (panel === undefined) return;
    const inner = { col: rect.col + 1, row: rect.row, cols: rect.cols - 1, rows: rect.rows };
    // The title row ends with `[x]`, a button that closes the panel as `Esc` does with no tool armed.
    const key = this.strings.get('ui.panel.close');
    label(surface, inner.col + 1, inner.row, this.panelTitle(panel.id, panel.title), { fg: t.key, width: inner.cols - key.length - 2 });
    const closeAt = inner.col + inner.cols - key.length - 1;
    label(surface, closeAt, inner.row, key);
    const closeCells = { col: closeAt, row: inner.row, cols: key.length, rows: 1 };
    surface.tooltip(closeCells, this.strings.get('ui.panel.close_tip'));
    surface.hit(closeCells, () => this.openPanel(null));
    const body = { col: inner.col, row: inner.row + 1, cols: inner.cols, rows: inner.rows - 1 };
    const readers = this.host.readers;
    const ctx = this.ctx;
    if (panel.id === 'designate') drawDesignatePanel(surface, body, this.tool, this.strings, () => this.reprioritize(), () => this.undoDesignation(), () => this.clearSelected());
    else if (panel.id === 'build') drawBuildPanel(surface, body, this.build, ctx, { key: this.ordersKey(), run: () => void this.orderMissing() });
    else if (panel.id === 'zones') drawZonesPanel(surface, body, this.zones, ctx, () => this.removeZone(this.zones.selected));
    else if (panel.id === 'stocks') drawStocksPanel(surface, body, this.stocks, ctx);
    else if (panel.id === 'units') drawUnitsPanel(surface, body, this.units, ctx);
    else if (panel.id === 'jobs') drawJobsPanel(surface, body, this.jobs, ctx);
    else if (panel.id === 'labors') drawLaborsPanel(surface, body, this.labors, ctx);
    else if (panel.id === 'orders') drawOrdersPanel(surface, body, this.orders, ctx);
    else if (panel.id === 'workshop') drawWorkshopPanel(surface, body, this.workshopId, this.orders, ctx,
      (action, recipeId) => this.orders.workshopAction(ctx, this.workshopId, action, () => this.deconstruct(this.workshopId), recipeId));
    else if (panel.id === 'building') drawBuildingPanel(surface, body, this.building, ctx, (id) => this.deconstruct(id));
    else if (panel.id === 'animals') drawAnimalsPanel(surface, body, this.animals, ctx);
    else if (panel.id === 'mood') drawMoodPanel(surface, body, this.mood, ctx);
    else if (panel.id === 'population') drawPopulationPanel(surface, body, ctx);
    else if (panel.id === 'look') drawLookPanel(surface, body, readers, this.host.registry, this.strings, this.lookTile(), this.lookTab,
      (leverId) => ctx.submit({ type: 'PullLever', leverId }), (buildingId) => this.deconstruct(buildingId), (buildingId) => this.openBuilding(buildingId));
    else if (panel.id === 'calendar') drawCalendarPanel(surface, body, readers, this.strings);
    else if (panel.id === 'overlays') drawOverlaysPanel(surface, body, this.overlayMenu, this.ui.overlays);
    else if (panel.id === 'help') drawHelpPanel(surface, body, this.help);
    else if (panel.id === 'debug' && this.host.debug !== undefined) drawDebugPanel(surface, body, this.debugPanel, ctx, this.host.debug);
    else if (panel.id === 'military') drawMilitaryPanel(surface, body, this.military, ctx, this.host);
    else if (panel.id === 'threats') drawThreatsPanel(surface, body, this.threats, ctx, this.ui.deepFound);
    else if (panel.id === 'civilizations') drawCivilizationsPanel(surface, body, this.civilizations, ctx, () => this.openTrade());
    else if (panel.id === 'depot') drawDepotPanel(surface, body, this.depot, ctx, () => this.moveGoods(), this.host.speed() === 0);
    else if (panel.id === 'log') drawLogPanel(surface, body, this.log.lines, this.logFilter, this.strings, (line) => {
      if (line.focus !== undefined) this.focusOn(line.focus);
    });
  }

  private drawStatus(surface: Surface, rect: Rect): void {
    if (rect.rows <= 0) return;
    const t = surface.theme;
    const readers = this.host.readers;
    const loadShedding = this.host.loadSheddingActive === true;
    const row1 = statusRow1(readers, this.strings, this.ui.z, this.host.speed(), rect.cols, loadShedding);
    labelRow(surface, rect.col, rect.row, rect.cols, row1);
    // The date opens the calendar panel; the weather glyph takes its colour (T-M3-08).
    const fields = statusFields(readers, this.strings, this.ui.z, this.host.speed(), loadShedding);
    const fieldSpacing = statusFieldSpacing(fields, this.strings, rect.cols);
    let fieldCol = rect.col + 1;
    for (const field of fields) {
      if (field.startsWith('+') || field.startsWith('!')) surface.text(fieldCol, rect.row, field, t.danger, t.black, rect.cols - (fieldCol - rect.col));
      if (loadShedding && field === fields[fields.length - 1]) surface.text(fieldCol, rect.row, field, surface.color('yellow'), t.black, rect.cols - (fieldCol - rect.col));
      fieldCol += Array.from(field).length + fieldSpacing;
    }
    const date = Array.from(fields[0] ?? '').length;
    const weather = weatherOf(readers);
    // Every field of row 1 is a button (T-270): the date and the weather open the Calendar, `☺` Units, `♥` Mood, `+n` Units with the wounded first, `!n` Threats, `$` Civilizations; the speed pauses or resumes, and a right click steps it.
    this.speedRegion = null;
    let hitCol = rect.col + 1;
    fields.forEach((field, k) => {
      const width = Array.from(field).length;
      const cells = { col: hitCol, row: rect.row, cols: width, rows: 1 };
      hitCol += width + fieldSpacing;
      if (k === 0 || (k === 1 && weather !== null)) surface.hit(cells, () => this.openPanel('calendar'));
      else if (k === fields.length - 1) {
        this.speedRegion = cells;
        surface.hit(cells, () => this.togglePause());
      } else if (field.startsWith('☺')) surface.hit(cells, () => this.openPanel('units'));
      else if (field.startsWith('♥')) surface.hit(cells, () => this.openPanel('mood'));
      else if (field.startsWith('+')) {
        surface.tooltip(cells, this.strings.get('ui.status.wounded_tip', { n: field.slice(1) }));
        surface.hit(cells, () => { this.openPanel('units'); this.units.woundedFirst = true; });
      } else if (field.startsWith('!')) {
        surface.tooltip(cells, this.strings.get('ui.status.hostiles_tip', { n: field.slice(1) }));
        surface.hit(cells, () => this.openPanel('threats'));
      } else if (field.startsWith('$')) surface.hit(cells, () => this.openPanel('civilizations'));
    });
    // `[Esc] menu` and `[?] help` at the right edge are buttons too.
    const left = ` ${fields.join(' '.repeat(fieldSpacing))}`;
    const right = statusRight(this.strings, Array.from(left).length, rect.cols);
    const rightStart = rect.col + Math.max(Array.from(left).length + 1, rect.cols - Array.from(right.text).length);
    surface.hit({ col: rightStart, row: rect.row, cols: Array.from(right.menu).length, rows: 1 }, () => this.host.gameMenu?.());
    surface.hit({ col: rightStart + Array.from(right.menu).length + 2, row: rect.row, cols: Array.from(right.help).length, rows: 1 }, () => this.togglePanel('help'));

    if (weather !== null && fields.length > 1) {
      const at = rect.col + 1 + date + fieldSpacing;
      surface.put(at, rect.row, surface.glyphs.index(weatherGlyph(weather)), weatherColor(weather, t), t.black);
    }
    if (rect.rows > 1) {
      const text2 = this.statusRow2(rect.cols - 1);
      const full = ` ${text2}`;
      const chars = Array.from(full);
      if (chars.length > rect.cols && rect.cols > 0) {
        surface.tooltip({ col: rect.col, row: rect.row + 1, cols: rect.cols, rows: 1 }, text2);
        const visible = `${chars.slice(0, rect.cols - 1).join('')}…`;
        labelRow(surface, rect.col, rect.row + 1, rect.cols, visible, { fg: t.text });
      } else {
        labelRow(surface, rect.col, rect.row + 1, rect.cols, full, { fg: t.text });
      }
      this.hitStrip(surface, rect, chars.length > rect.cols ? `${chars.slice(0, rect.cols - 1).join('')}…` : full);
    }
  }

  /** Each complete `[x] name` entry of the hotkey strip on row 2 does what its key does. */
  private hitStrip(surface: Surface, rect: Rect, shown: string): void {
    for (const entry of this.strings.get('ui.status.strip').split('  ')) {
      const at = shown.indexOf(entry);
      const letter = /^\[(.)\]/.exec(entry)?.[1];
      if (at < 0 || letter === undefined) continue;
      surface.hit({ col: rect.col + Array.from(shown.slice(0, at)).length, row: rect.row + 1, cols: Array.from(entry).length, rows: 1 },
        () => void this.key({ key: letter, repeat: false, shift: false, ctrl: false, alt: false, meta: false }));
    }
  }

  /** Pause, or resume at the last speed (the pause key and the speed glyph). */
  private togglePause(): void {
    const speed = this.host.speed();
    if (speed === 0) this.host.setSpeed(this.lastSpeed);
    else {
      this.lastSpeed = speed;
      this.host.setSpeed(0);
    }
  }

  /** A right click on the speed glyph: the next speed, 1x to 2x to 4x to 1x; paused stays paused. */
  private cycleSpeed(): void {
    const now = this.host.speed();
    const current = now === 0 ? this.lastSpeed : now;
    const next = SPEEDS[(SPEEDS.indexOf(current) + 1) % SPEEDS.length] as Speed;
    this.lastSpeed = next;
    if (now === 0) this.notice(this.strings.get('ui.status.paused_speed', { speed: next }));
    else this.host.setSpeed(next);
  }

  /** `[Del] clear rect`: what the Delete key does with a rectangle selected. */
  private clearSelected(): void {
    if (!this.selectionKey({ key: 'Delete', repeat: false, shift: false, ctrl: false, alt: false, meta: false })) this.notice(this.strings.get('ui.status.not_selected'));
  }

  /**
   * Row 2: "the tile summary under the mouse (or the cursor), then the hotkey strip …; with a tool
   * active it shows the tool name, the priority, the rectangle size while dragging, and `[Esc]
   * cancel`." A rejection reason takes the row for `STATUS_HINT_SECONDS` or until replaced earlier
   * by starting a drag, a new ghost state or a new notice (T-243).
   */
  statusRow2(cols = Infinity): string {
    const s = this.strings;
    if (this.dragging || this.build.anchor !== null || this.zones.anchor !== null || this.tool.anchor !== null || this.selection !== null) {
      this.clearNotice();
    }
    if (this.build.active && this.build.anchor === null && !this.dragging) {
      const placed = this.build.placementAt(this.ctx, this.hoverPoint() ?? this.actionPoint());
      if (placed !== null) return placed;
    }
    if (this.build.active && this.noticeGhost !== null && this.ghostKey() !== this.noticeGhost) {
      this.clearNotice();
    }
    const notice = this.currentNotice;
    if (notice !== null) return notice;
    if (this.pointer !== null && this.last !== null) {
      const tip = this.last.tooltipAt(this.pointer.col, this.pointer.row);
      if (tip !== null) return tip.text;
    }
    if (this.ui.panel === 'zones' && this.zones.stockpile.linkingFor !== 0) {
      return s.get('ui.stockpile.link_prompt', { name: zoneName(this.ctx, this.zones.stockpile.linkingFor) });
    }
    if (this.ui.panel === 'building' && this.building.linking) {
      return s.get('ui.status.link', { building: buildingName(this.ctx, this.building.id), kinds: s.get('ui.building.linkable') });
    }
    if (this.build.active) {
      const row = this.build.current(this.ctx);
      const name = row === undefined ? '' : row.name.charAt(0).toUpperCase() + row.name.slice(1);
      const p = this.hoverPoint() ?? this.actionPoint();
      const from = this.build.anchor;
      if (from !== null) {
        // D-U6: "the status bar shows the count" while dragging, and what the stock cannot supply.
        const to = this.build.end ?? p;
        const plan = this.build.plan(this.ctx, from, { x: to.x, y: to.y, z: from.z });
        const count = plan.blocked === 0 ? s.get('ui.status.build_drag', { tool: name, n: plan.ok.length })
          : s.get(plan.blocked === 1 ? 'ui.status.build_drag_blocked_one' : 'ui.status.build_drag_blocked', { tool: name, n: plan.ok.length, blocked: plan.blocked });
        const stock = this.stockText(plan.ok.length);
        return stock === '' ? count : `${count} · ${stock}`;
      }
      const ghost = this.build.ghost(this.ctx, p);
      const blocked = ghost === null || row === undefined ? null : blockedText(this.ctx, row.id, ghost);
      const stock = this.stockText(0);
      if (blocked !== null) return stock === '' ? s.get('ui.status.build_blocked', { tool: name, reason: blocked }) : s.get('ui.status.build_blocked_stock', { tool: name, reason: blocked, stock });
      if (stock !== '') return s.get('ui.status.build_stock', { tool: name, stock });
      return s.get(this.build.multi(this.ctx) ? 'ui.status.build_many' : 'ui.status.build', { tool: name });
    }
    if (this.zones.selected !== 0 && this.ui.panel === 'zones' && this.zones.anchor === null) {
      return s.get('ui.zone.selected', { name: zoneName(this.ctx, this.zones.selected), n: this.host.readers.has('14') ? (this.host.readers.of<import('@systems/buildings').BuildingsReader>('14').zone(this.zones.selected)?.tiles.length ?? 0) : 0 });
    }
    if (this.zones.active) {
      const name = this.zones.resizing ? s.get('ui.zone.resize') : s.get(`ui.zone.type.${this.zones.kind ?? ''}`);
      const a = this.zones.anchor;
      const b = this.zones.end ?? this.hoverPoint();
      if (a !== null && b !== null) {
        const w = Math.abs(a.x - b.x) + 1;
        const h = Math.abs(a.y - b.y) + 1;
        const type = this.zones.kind ?? '';
        const ok = rectTiles(this.host.readers.map, a, b).filter((i) => this.zones.tileOk(this.ctx, type, i, this.zones.resizing ? this.zones.selected : 0)).length;
        return s.get('ui.status.zone_drag', { tool: name, w, h, n: w * h, ok });
      }
      return s.get('ui.status.zone', { tool: name });
    }
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
    if (this.selection !== null) {
      const sel = this.selection;
      const w = Math.abs(sel.a.x - sel.b.x) + 1;
      const h = Math.abs(sel.a.y - sel.b.y) + 1;
      return s.get('ui.status.selection', { w, h, n: w * h });
    }
    const tile = this.hover ?? this.cursorTile();
    if (tile === null) return statusPanelStrip(s, cols);
    const creatures = creaturesAt(this.host.readers, tile);
    const summary = creatures.length > 0 ? creatureSummary(this.host.readers, creatures[0] as number) : tileSummary(this.host.readers, s, tile);
    const prefix = `${summary} · `;
    const strip = statusPanelStrip(s, cols - Array.from(prefix).length);
    return strip.length === 0 ? summary : `${prefix}${strip}`;
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

  /** A panel hotkey: open it, or close it when it is the open one ("`?` help", "`F12` debug"). */
  private togglePanel(id: string): void {
    if (this.ui.panel === id && this.ui.sidebar) this.openPanel(null);
    else this.openPanel(id);
  }

  /** A panel's filter ends with the panel (24 § Rules, text input). */
  private clearFilters(): void {
    this.units.filter = '';
    this.units.editing = false;
    this.jobs.filter.value = '';
    this.jobs.filter.focused = false;
    this.stocks.filter.value = '';
    this.stocks.filter.focused = false;
  }

  /** The Units filter field: it types every printable key, `Space` included, before any command key. */
  private unitsFilterKey(press: KeyPress): boolean {
    if (press.ctrl || press.alt || press.meta) return false;
    if (press.key === 'Enter') this.units.editing = false;
    else if (press.key === 'Backspace') this.units.filter = Array.from(this.units.filter).slice(0, -1).join('');
    else {
      const ch = typedChar(press.key);
      if (ch === null) return false;
      this.units.filter += ch;
    }
    this.units.list.selected = 0;
    return true;
  }

  /** A panel's title, with the filter in use: `Units · filter: xxx (3 of 80)`. */
  private panelTitle(id: string, panelName: string): string {
    let title = panelName;
    const ctx = this.ctx;
    let filter = '';
    let counts: { shown: number; total: number } | null = null;
    if (id === 'units') {
      const idle = idleCount(ctx);
      if (this.units.filter === '') {
        return this.units.idleOnly
          ? this.strings.get('ui.units.title_idle', { title, n: this.units.rows(ctx).length })
          : this.strings.get('ui.units.title_counts', { title, total: dwarvesOf(ctx).length, idle });
      }
      title = this.units.idleOnly ? this.strings.get('ui.units.title_idle_only', { title }) : title;
      filter = this.units.filter;
      counts = { shown: this.units.rows(ctx).length, total: dwarvesOf(ctx).length };
    } else if (id === 'jobs' && this.jobs.filter.value !== '') {
      filter = this.jobs.filter.value;
      counts = { shown: this.jobs.jobs(ctx).length, total: this.jobs.allJobs(ctx).length };
    } else if (id === 'stocks' && this.stocks.filter.value !== '') filter = this.stocks.filter.value;
    if (filter === '') return title;
    return counts === null
      ? this.strings.get('ui.panel.filtered', { title, filter })
      : this.strings.get('ui.panel.filtered_counts', { title, filter, shown: counts.shown, total: counts.total });
  }

  openPanel(id: string | null): void {
    if (id !== 'animals') this.animals.capEditor = null;
    if (id !== 'designate') this.tool.cancel();
    if (id !== 'build') this.build.cancel();
    if (id !== 'zones') this.zones.cancel();
    if (id !== 'building') this.building.cancel();
    if (id !== this.ui.panel) this.clearFilters();
    this.ui.panel = id;
    this.ui.sidebar = true;
  }

  /**
   * `RemoveZone` with the confirmation 24 § Confirmations asks for: "removing a zone with crops or
   * a stockpile with items" (`c_remove_zone_crops`, `c_remove_stockpile_items`), and for any other
   * zone `c_remove_zone` (D-U2: every destructive single-key action asks first).
   */
  removeZone(zoneId: number): void {
    if (zoneId === 0) return;
    const ask = removalConfirm(this.ctx, zoneId);
    const remove = (): void => {
      if (this.zones.selected === zoneId) this.zones.selected = 0;
      this.host.submit({ type: 'RemoveZone', zoneId });
    };
    if (ask === null) confirmThen(this.ctx, 'c_remove_zone', { zone: zoneName(this.ctx, zoneId) }, remove);
    else confirmThen(this.ctx, ask.id, { n: ask.n }, remove);
  }

  /**
   * `DeconstructBuilding` (14 § Player-facing behavior: the building panel offers deconstruct) with
   * 24 § Confirmations' `c_deconstruct_workshop` when the workshop still has orders, and
   * `c_deconstruct_building` for any other building (D-U2).
   */
  deconstruct(buildingId: number): void {
    if (buildingId === 0) return;
    const orders = this.host.readers.entities.get(buildingId, C.Workshop)?.orders.length ?? 0;
    const send = (): void => this.host.submit({ type: 'DeconstructBuilding', buildingId });
    if (orders === 0) confirmThen(this.ctx, 'c_deconstruct_building', { building: buildingName(this.ctx, buildingId) }, send);
    else confirmThen(this.ctx, 'c_deconstruct_workshop', { n: orders }, send);
  }

  /**
   * A building's own panel (14 § Player-facing behavior): the depot's, a workshop's ("workshops
   * delegate to 12"), or the building panel for anything else (U-05).
   */
  openBuilding(buildingId: number): void {
    if (buildingId === 0 || !this.host.readers.has('14')) return;
    const reader = this.host.readers.of<import('@systems/buildings').BuildingsReader>('14');
    if (reader.depots().includes(buildingId)) {
      this.depot.select(this.ctx, buildingId);
      this.openPanel('depot');
    } else if (this.host.readers.entities.has(buildingId, C.Workshop)) {
      this.workshopId = buildingId;
      this.openPanel('workshop');
    } else {
      this.openPanel('building');
      this.building.open(buildingId);
    }
  }

  private moveGoods(): void {
    const id = this.depot.selectedDepot(this.ctx);
    if (!id) return;
    this.stocks.startDepot(id);
    this.openPanel('stocks');
  }

  /** `[t] trade`: open the session, or say why not (§4.2: no depot, no caravan yet). */
  private openTrade(): void {
    this.depot.trade(this.ctx, this.host.speed() === 0);
  }

  /** Look at a tile: the look panel with the cursor on it. */
  look(p: TilePoint): void {
    this.ui.cursor = { x: p.x, y: p.y };
    this.lookTab = 0;
    this.openPanel('look');
  }

  /** Submit a finished zone rectangle. */
  commitZone(a: TilePoint, b: TilePoint): Command[] {
    const resized = this.zones.resizing ? this.host.readers.has('14') ? this.host.readers.of<import('@systems/buildings').BuildingsReader>('14').zone(this.zones.selected)?.type : undefined : undefined;
    const type = resized ?? this.zones.kind ?? '';
    const commands = this.zones.commands(this.ctx, a, b);
    if (commands.length === 0 && type !== '') {
      // §4.2: a rectangle where no tile qualifies says which rule failed; a farm plot also
      // brings up `hint_farm` (Q12: the zone tool never sends the rectangle that refusal needed).
      const s = this.strings;
      const rule = s.has(`ui.zone.rule.${type}`) ? s.get(`ui.zone.rule.${type}`) : s.get('ui.zone.rule.default');
      this.notice(s.get('ui.status.zone_none', { tool: s.get(`ui.zone.type.${type}`), n: rectTiles(this.host.readers.map, a, b).length, rule }));
      if (type === 'farm_plot') this.hints.show('hint_farm', this.host.readers.calendar.tick, this.settings.hintsEnabled);
    }
    if (commands.length > 0 && type !== '' && !this.zones.resizing && commands[0]?.type === 'CreateZone') this.pendingZone = this.zoneOutcome(type, a, b, ((commands[0] as Command)['tiles'] as readonly number[]).length);
    for (const c of commands) this.host.submit(c);
    this.zones.anchor = null;
    this.zones.end = null;
    return commands;
  }

  /** What a finished zone drag left out of the rectangle, by reason (a trimmed zone says so). */
  private zoneOutcome(type: string, a: TilePoint, b: TilePoint, made: number): { type: string; made: number; left: number; reasons: string } {
    const buildings = this.host.readers.has('14') ? this.host.readers.of<import('@systems/buildings').BuildingsReader>('14') : null;
    const counts = { another: 0, other: 0 };
    for (const i of rectTiles(this.host.readers.map, a, b)) {
      if (this.zones.tileOk(this.ctx, type, i)) continue;
      if ((buildings?.zoneAt(i) ?? 0) !== 0) counts.another += 1;
      else counts.other += 1;
    }
    const s = this.strings;
    const other = type === 'farm_plot' ? 'soil' : type === 'fishing' ? 'water' : 'walkable';
    const parts = [counts.another > 0 ? s.get('ui.zone.left.another', { n: counts.another }) : '', counts.other > 0 ? s.get(`ui.zone.left.${other}`, { n: counts.other }) : ''].filter((t) => t !== '');
    return { type, made, left: counts.another + counts.other, reasons: parts.join(', ') };
  }

  /** The zone a drag just asked for: its message and selection wait for the zone to exist. */
  private pendingZone: { type: string; made: number; left: number; reasons: string } | null = null;

  /** Place the build tool's building at a point ("Placing keeps the tool active until `Esc`"). */
  place(p: TilePoint): Command | null {
    const ctx = this.ctx;
    const cmd = this.build.command(ctx, p);
    if (cmd !== null) {
      // One the simulation will take counts toward what the stock must supply (D-U6).
      const ghost = this.build.ghost(ctx, p);
      if (ghost?.reason === null) {
        this.build.placed(ctx, 1);
        const stock = this.stockText(0);
        let text = this.strings.get('ui.status.build_placed_one', { tool: this.build.name(ctx) });
        if (stock !== '') text = `${text} · ${stock}`;
        this.notice(text);
        this.build.rememberPlacement(ghost.tiles, text);
      }
      this.host.submit(cmd);
    } else this.notice(this.strings.get('ui.status.off_map'));
    return cmd;
  }

  /**
   * A finished drag of a type placed one per tile (D-U6, S9): one `PlaceBuilding` per valid tile of
   * the rectangle; the others are skipped and reported in one message naming the rule. A drag that
   * never left its tile is the single click.
   */
  placeMany(a: TilePoint, b: TilePoint): Command[] {
    const ctx = this.ctx;
    const s = this.strings;
    this.build.anchor = null;
    this.build.end = null;
    const to = { x: b.x, y: b.y, z: a.z };
    if (a.x === to.x && a.y === to.y) {
      const one = this.place(a);
      return one === null ? [] : [one];
    }
    const plan = this.build.plan(ctx, a, to);
    const commands = plan.ok.map((tile) => this.build.commandAt(ctx, tile)).filter((c): c is Command => c !== null);
    this.build.placed(ctx, commands.length);
    const tool = this.build.name(ctx);
    const rule = plan.rules.slice(0, 2).join(', ');
    const n = commands.length;
    let text = plan.blocked === 0 ? s.get('ui.status.build_placed', { tool, n })
      : n === 0 ? s.get('ui.status.build_none', { tool, blocked: plan.blocked, rule })
      : s.get(plan.blocked === 1 ? 'ui.status.build_skipped_one' : 'ui.status.build_skipped', { tool, n, blocked: plan.blocked, rule });
    const stock = this.stockText(0);
    if (stock !== '') text = `${text} · ${stock}`;
    this.notice(text);
    this.build.rememberPlacement(plan.ok, text);
    for (const c of commands) this.host.submit(c);
    return commands;
  }

  /** The key that opens Orders, as the out-of-stock line shows it (`[o] order N`). */
  private ordersKey(): string {
    return this.panels().find((p) => p.id === 'orders')?.hotkey ?? '';
  }

  /** "0 doors in stock: 5 will wait · [o] order 5" with `extra` more about to be placed, or '' (D-U6). */
  private stockText(extra: number): string {
    const offer = this.build.offer(this.ctx, extra);
    if (offer === null) return '';
    const text = this.build.offerText(this.ctx, offer, this.ordersKey());
    return text.action === '' ? text.stock : `${text.stock} · ${text.action}`;
  }

  /**
   * `[o] order N` of the out-of-stock line: the order picker, preset to the missing item and the
   * count that waits (D-U6). False when there is nothing to order or no workshop to order it at:
   * the key then opens Orders as it always does.
   */
  orderMissing(): boolean {
    const offer = this.build.offer(this.ctx);
    if (offer === null || offer.recipeId === null) return false;
    const preset = { recipeId: offer.recipeId, quantity: offer.waiting };
    this.openPanel('orders');
    this.orders.workshopId = 0;
    this.orders.list.selected = 0;
    this.orders.openPicker(this.ctx, preset);
    return true;
  }

  /** Submit a finished rectangle. */
  commit(a: TilePoint, b: TilePoint): Command[] {
    const map = this.host.readers.map;
    const commands = this.tool.commands({ map, precondition: (i, k) => this.host.precondition(i, k) }, a, b);
    const hasUnconfirmedDeepsilver = !this.host.readers.fortress.state.deepsilverConfirmed && commands.some((cmd) => {
      if (cmd.type !== 'Designate') return false;
      const tiles = cmd['tiles'] as readonly TileIndex[] | undefined;
      if (!tiles) return false;
      return tiles.some((tile) => {
        if ((map.flagsAt(tile) & TileFlag.Discovered) === 0) return false;
        const mat = map.materialAt(tile);
        const matRow = this.host.registry.table<{ id: string }>('materials').byIndex(mat);
        if (!matRow) return false;
        const minRow = this.host.registry.table<{ id: string; deepsilver?: boolean }>('minerals').byId(matRow.id);
        return minRow?.deepsilver === true;
      });
    });
    if (hasUnconfirmedDeepsilver && this.host.confirm !== undefined) {
      this.host.confirm('c_deepsilver', {}, (yes) => {
        if (yes) {
          this.host.submit({ type: 'ConfirmDeepsilver' });
          for (const c of commands) this.host.submit(c);
          this.tool.remember(commands);
        }
      });
      this.tool.anchor = null;
      this.tool.end = null;
      return [];
    }
    if (commands.length === 0) this.notice(this.emptyRectText());
    for (const c of commands) this.host.submit(c);
    this.tool.remember(commands);
    this.tool.anchor = null;
    this.tool.end = null;
    return commands;
  }

  /**
   * `[S-p]` in Designate: `SetDesignationPriority` gives the tool's priority to the tiles of the
   * last batch that are still designated (U-05; UI audit § 5.4).
   */
  reprioritize(): Command | null {
    const cmd = this.tool.reprioritize(this.host.readers.map);
    if (cmd === null) {
      this.notice(this.strings.get('ui.status.nothing_to_prioritize'));
      return null;
    }
    this.host.submit(cmd);
    this.notice(this.strings.get('ui.status.reprioritized', { n: (cmd['tiles'] as TileIndex[]).length, priority: this.tool.priority }));
    return cmd;
  }

  /** §4.2: why a designation rectangle sent nothing ("No tile here can be dug: …"). */
  private emptyRectText(): string {
    const key = this.tool.clearing ? 'ui.status.none.clear' : `ui.status.none.${this.tool.kind ?? ''}`;
    return this.strings.has(key) ? this.strings.get(key) : this.strings.get('ui.status.none.any');
  }

  /** `Enter` with a tool: "start/end rectangle at the cursor". */
  private rectPoint(shift = false): void {
    const p = this.actionPoint();
    if (this.build.active) {
      // D-U6 by keyboard: `Shift+Enter` marks a corner, `Enter` at the other places one per tile.
      if (this.build.anchor !== null) this.placeMany(this.build.anchor, p);
      else if (shift && this.build.multi(this.ctx)) { this.build.anchor = p; this.clearNotice(); }
      else if (shift) this.notice(this.strings.get('ui.status.build_single', { tool: this.build.name(this.ctx) }));
      else this.place(p);
      return;
    }
    if (this.zones.active) {
      if (this.zones.anchor === null) { this.zones.anchor = p; this.clearNotice(); }
      else this.commitZone(this.zones.anchor, { x: p.x, y: p.y, z: this.zones.anchor.z });
      return;
    }
    if (this.tool.anchor === null) {
      this.tool.anchor = p;
      this.clearNotice();
      return;
    }
    const a = this.tool.anchor;
    // A stairwell's two points differ in level; a rectangle's lie on the first point's level.
    this.commit(a, this.tool.kind === 'stairwell' ? p : { x: p.x, y: p.y, z: a.z });
  }

  /** "`Esc` cancels the current tool, then closes the panel, then opens the game menu." */
  private cancel(): void {
    // The Esc chain of 24 § Input model, innermost first: a modal editor, then a rectangle in
    // progress, then the selection, then the tool, then the panel, then the game menu.
    if (this.orders.materialOpen) { this.orders.materialOpen = false; return; }
    if (this.orders.picker.open) { this.orders.picker.open = false; return; }
    if (this.animals.capEditor !== null) { this.animals.capEditor = null; return; }
    if (this.animals.name.focused) { this.animals.name.focused = false; return; }
    if (this.animals.trainChoice !== null) { this.animals.trainChoice = null; return; }
    if (this.military.settingStation || this.military.settingPatrol || this.military.settingKill || this.military.settingFollow || this.military.memberChoice) { this.military.cancel(); return; }
    if (this.zones.farmMenus.some((m) => m.open)) { for (const m of this.zones.farmMenus) m.open = false; return; }
    if (this.zones.cancelEditor()) return;
    if (this.units.editing) {
      this.units.editing = false;
      return;
    }
    if (this.units.choice !== null) { this.units.choice = null; return; }
    if (this.ui.panel === 'building' && this.building.cancel()) return;
    if (this.zones.anchor !== null) {
      this.zones.anchor = null;
      this.zones.end = null;
      return;
    }
    if (this.zones.active) {
      this.zones.cancel();
      return;
    }
    if (this.build.anchor !== null) {
      this.build.anchor = null;
      this.build.end = null;
      this.dragging = false;
      return;
    }
    if (this.build.active) {
      this.build.cancel();
      return;
    }
    if (this.tool.anchor !== null) {
      this.tool.anchor = null;
      this.tool.end = null;
      return;
    }
    if (this.tool.active) {
      this.tool.cancel();
      return;
    }
    if (this.selection !== null) {
      this.selection = null;
      return;
    }
      if (this.ui.panel !== null) {
        this.clearFilters();
        this.ui.panel = null;
        if (this.ui.cursor !== null) this.ui.cursor = null;
        return;
      }
      this.host.gameMenu?.();
  }

  private undoDesignation(): void {
    const cmd = this.tool.undo();
    if (cmd !== null) this.host.submit(cmd);
    else this.notice(this.strings.get('ui.status.nothing_to_undo'));
  }

  /** `+`/`-`: the next speed. While paused the game stays paused and the speed it resumes at changes (Q10). */
  private step(delta: number): void {
    const now = this.host.speed();
    const at = SPEEDS.indexOf(now === 0 ? this.lastSpeed : now);
    const next = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, at + delta))] as Speed;
    this.lastSpeed = next;
    if (now === 0) this.notice(this.strings.get('ui.status.paused_speed', { speed: next }));
    else this.host.setSpeed(next);
  }

  key(press: KeyPress): boolean {
    this.ensureRegistered();
    if (this.ui.sidebar && this.ui.panel === 'animals' && this.animals.capKey(this.ctx, press)) return true;
    if (this.textFocused() && press.key === 'Space') press = { ...press, key: ' ' };
    if (this.ui.sidebar && this.ui.panel === 'units' && this.units.editing && this.unitsFilterKey(press)) return true;
    if (this.ui.sidebar && this.ui.panel === 'jobs' && this.jobs.filter.key(press)) { this.jobs.resetSelection(); return true; }
    if (this.ui.sidebar && this.ui.panel === 'stocks' && this.stocks.filter.key(press)) { this.stocks.tree.selected = 0; this.stocks.tree.scroll = 0; return true; }
    if (this.ui.panel === 'stocks' && this.stocks.depotSelection && (press.key === 'Esc' || press.key === 'Escape')) {
      this.stocks.cancelDepot();
      this.openPanel('depot');
      return true;
    }
    if (this.ui.panel === 'stocks' && this.stocks.depotSelection && (press.key === 'Space' || press.key === ' ')) {
      this.stocks.toggleDepot(this.ctx);
      return true;
    }
    if (this.pinned !== null) {
      // "the strip shows the line until dismissed by any key".
      this.pinned = null;
      return true;
    }
    if ((press.key === ' ' || press.key === 'Space') && !press.ctrl && !press.alt && !press.meta && this.markKey()) return true;
    // The order picker and the material list are modal: they take every key they use (letters
    // are the picker's type-ahead filter) and leave the rest (`Space`, `F5`) to the screen.
    if (this.ui.panel === 'orders' && (this.orders.materialOpen || this.orders.picker.open) && this.orders.key(this.ctx, press)) return true;
    if (!press.ctrl && !press.alt && !press.meta) {
      // U-07: settings widgets take Space, Tab and +/- before the global pause/speed/sidebar keys.
      if (this.ui.panel === 'zones' && this.ui.sidebar && ['Space', ' ', 'Tab', '+', '=', '-'].includes(press.key) && this.zones.editorKey(this.ctx, press)) return true;
      // `+`/`-` change the selected order's count before they are the game-speed keys (Q2); the
      // military, civilizations and population panels keep their own `+` (and `-`).
      if (this.ui.panel === 'orders' && this.ui.sidebar && countStep(press) !== 0 && this.orders.selectedRow(this.ctx) !== undefined) return this.orders.key(this.ctx, press);
      if ((this.ui.panel === 'military' || this.ui.panel === 'civilizations') && press.key === '+') return this.panelKey(this.ui.panel, press);
      if (this.ui.panel === 'population' && (press.key === '+' || press.key === '-')) return this.panelKey(this.ui.panel, press);
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
        case 'quick_save':
          this.host.quickSave?.();
          return true;
        case 'quick_load':
          this.host.quickLoad?.();
          return true;
        case 'save_menu':
          // 24 § Input model: "`Ctrl+S` save menu" (Q10).
          if (this.host.saveMenu !== undefined) this.host.saveMenu();
          else this.host.quickSave?.();
          return true;
        case 'help':
          this.togglePanel('help');
          return true;
        case 'debug':
          this.togglePanel('debug');
          return true;
        case 'undo': {
          this.undoDesignation();
          return true;
        }
        default:
          break;
      }
    }
    if (press.key === ' ') return this.key({ ...press, key: 'Space' });

    // D-U2: a panel hotkey always opens or closes its panel, whatever panel is open; only a
    // focused text field (the units filter, an animal's name) takes the letter instead. The open
    // panel's own keys come next, before the map's.
    // D-U6: with the build tool's out-of-stock line showing, the Orders key opens the picker preset.
    if (this.build.active && this.ui.sidebar && !press.ctrl && !press.alt && !press.meta && !press.shift && press.key === this.ordersKey() && this.orderMissing()) return true;
    if (!this.textFocused() && this.panelHotkey(press)) return true;
    const panel = this.ui.panel;
    if (this.ui.sidebar && panel !== null && this.panelKey(panel, press)) return true;
    if (panel === 'designate' && this.ui.sidebar) {
      const letter = acceleratorOf(press, this.panelLetters());
      if (letter === 'p') {
        this.reprioritize();
        return true;
      }
      if (letter !== '' && this.tool.choose(letter)) return true;
    }
    if (panel === 'look' && this.ui.sidebar && press.key.toLowerCase() === 'x' && !this.toolActive) {
      const tile = this.lookTile();
      const building = tile === null ? 0 : this.host.readers.map.buildingAt(tile);
      if (building !== 0) {
        this.deconstruct(building);
        return true;
      }
    }
    if (panel === 'look' && this.ui.sidebar && press.key === 'Enter' && !this.toolActive && !press.ctrl && !press.alt && !press.meta) {
      // U-05: the keyboard's way to a building's panel (the mouse's is a click on it).
      const tile = this.lookTile();
      const building = tile === null ? 0 : this.host.readers.map.buildingAt(tile);
      if (building !== 0) {
        this.openBuilding(building);
        return true;
      }
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
          if (!this.toolActive) {
            this.look(this.hoverPoint() ?? this.centerPoint());
            return true;
          }
          break;
        case 'rotate':
          if (this.build.active) {
            this.build.rotate(this.ctx);
            return true;
          }
          break;
        case 'cycle_material':
          if (this.build.active) {
            this.build.cycleMaterial(this.ctx);
            return true;
          }
          break;
        case 'rect_point':
          if (this.toolActive) {
            this.rectPoint(map.shift === true);
            return true;
          }
          break;
        case 'priority':
          if (this.build.active) {
            this.build.priority = Math.max(1, Math.min(9, Number(map.arg)));
            return true;
          }
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

    // § Mouse: with a selection, `Delete`, forbid, dump and move to depot act on it (D-200); the
    // keys are the stocks panel's own accelerators and Esc gives the panel hotkeys back.
    if (this.selection !== null && !press.ctrl && !press.alt && !press.meta && this.selectionKey(press)) return true;

    return false;
  }

  /** A text field of the open panel has the keyboard: letters are text, not hotkeys. */
  private textFocused(): boolean {
    if (!this.ui.sidebar) return false;
    return (this.ui.panel === 'jobs' && this.jobs.filter.focused) || (this.ui.panel === 'stocks' && this.stocks.filter.focused) || (this.ui.panel === 'units' && this.units.editing) || (this.ui.panel === 'animals' && this.animals.name.focused);
  }

  /**
   * A panel hotkey (`ui-keymap-and-screens.md` § Fortress panels): open the panel, or close it
   * when it is the open one. A letter with `Shift` is never a panel hotkey: it is the open
   * panel's accelerator (`[S-m]`, D-U2).
   */
  private panelHotkey(press: KeyPress): boolean {
    if (press.alt || press.meta) return false;
    const letter = /^[a-zA-Z]$/.test(press.key);
    const binding = this.keymap.of('fortress_panel').find((b) => b.spec.key === press.key && b.spec.ctrl === press.ctrl &&
      (b.spec.shift === press.shift || (!letter && !b.spec.shift)));
    const panels = this.panels();
    const opened = (binding === undefined ? undefined : panels.find((p) => p.id === binding.id))
      ?? (!press.ctrl && !press.shift ? panels.find((p) => p.hotkey === press.key) : undefined);
    if (opened === undefined) return false;
    if (this.ui.panel === opened.id && this.ui.sidebar) {
      const wasArmed = (opened.id === 'designate' && this.tool.active)
        || (opened.id === 'build' && this.build.active)
        || (opened.id === 'zones' && this.zones.active);
      this.openPanel(null);
      if (wasArmed) {
        this.notice(this.strings.get('ui.status.panel_closed', { panel: opened.title, key: opened.hotkey }));
      }
    } else if (opened.id === 'look') this.look(this.hoverPoint() ?? this.centerPoint());
    else {
      // `[l]` over the Units list opens Labors on the dwarf under the Units cursor, at its first column.
      const fromUnits = opened.id === 'labors' && this.ui.panel === 'units' && this.ui.sidebar ? this.units.selectedId(this.ctx) : 0;
      this.openPanel(opened.id);
      if (opened.id === 'labors') {
        this.labors.firstColumn = 0;
        if (fromUnits !== 0) this.labors.selectedRow = Math.max(0, dwarvesOf(this.ctx).indexOf(fromUnits));
      }
      // `[o]` shows every order again after a workshop's own list.
      if (opened.id === 'orders') { this.orders.workshopId = 0; this.orders.list.selected = 0; this.orders.picker.open = false; this.orders.materialOpen = false; }
      // `[d] dig` (the status strip, `hint_dig`): the panel opens with Dig chosen, since `d` again closes it (D-241).
      if (opened.id === 'designate' && !this.tool.active) this.tool.choose('d');
    }
    return true;
  }

  /**
   * The keys of the open panel (24 § Panels: "arrows move the selection, `Enter` activates … letters
   * in `[brackets]` are accelerators"). An open list panel takes `↑`/`↓` (and the labor grid
   * `←`/`→`) before the map does (D-077).
   */
  private panelKey(panel: string, press: KeyPress): boolean {
    if (press.ctrl || press.alt || press.meta) return false;
    const ctx = this.ctx;
    const k = press.key;
    const up = k === 'ArrowUp' || k === '↑';
    const down = k === 'ArrowDown' || k === '↓';
    const left = k === 'ArrowLeft' || k === '←';
    const right = k === 'ArrowRight' || k === '→';
    // An accelerator: a letter that opens a panel counts only with `Shift` (`[S-m]`, D-U2).
    const letter = acceleratorOf(press, ctx.panelLetters);
    const submit = (cmds: readonly Command[] | Command | null): boolean => {
      if (cmds === null) return true;
      for (const c of Array.isArray(cmds) ? cmds : [cmds]) this.host.submit(c as Command);
      return true;
    };
      switch (panel) {
        case 'population':
          if (k === '+' || k === '-') {
            changePopulationCap(ctx, k === '+' ? POPULATION_CAP_STEP : -POPULATION_CAP_STEP);
            return true;
          }
          return false;
      case 'help':
        if (k === '1' || k === '2') { this.help.setTab((Number(k) - 1) as HelpTab); return true; }
        if (!press.shift && (up || down)) { this.help.move(up ? -1 : 1); return true; }
        if (k === 'PageUp' || k === 'PageDown') { this.help.move(k === 'PageUp' ? -HELP_PAGE_ROWS : HELP_PAGE_ROWS); return true; }
        return false;
      case 'debug': {
        const debug = this.host.debug;
        if (!press.shift && (up || down)) { this.debugPanel.move(up ? -1 : 1); return true; }
        if (k === 'PageUp' || k === 'PageDown') { this.debugPanel.move(k === 'PageUp' ? -HELP_PAGE_ROWS : HELP_PAGE_ROWS); return true; }
        if (debug === undefined) return false;
        if (letter === 'd') { debug.dumpSave(); return true; }
        if (letter === 'r') { debug.replaySeasonLog(); return true; }
        if (letter === 'h') { debug.hashWorld(); return true; }
        return false;
      }
      case 'overlays':
        if (!press.shift && (up || down)) {
          this.overlayMenu.move(up ? -1 : 1);
          return true;
        }
        if (k === 'Enter') {
          OverlayMenu.toggle(this.ui.overlays, (OVERLAY_ROWS[this.overlayMenu.selected] as { id: string }).id);
          return true;
        }
        return false;
      case 'build':
        if (!press.shift && (up || down) && this.build.active) {
          this.build.move(up ? -1 : 1, ctx);
          return true;
        }
        return letter !== '' && letter !== 'r' && letter !== 'x' && this.build.choose(letter);
        case 'zones':
          if (this.zones.stockpile.linkingFor !== 0 && k === 'Enter') {
            const tile = this.tileOf(this.actionPoint());
            if (tile !== null) this.zones.stockpile.pickSource(ctx, tile);
            return true;
          }
          if (k === 'Delete' && !this.zones.active && ctx.readers.has('14') && ctx.readers.of<BuildingsReader>('14').zone(this.zones.selected)?.type === 'stockpile') {
            this.removeZone(this.zones.selected); return true;
          }
          if (this.zones.editorKey(ctx, press)) return true;
          if (this.zones.farmKey(ctx, press)) return true;
          if (k === 'Enter' && !this.zones.active && this.zones.selected === 0) {
            const tile = this.tileOf(this.actionPoint());
            if (tile === null || !this.zones.select(ctx, tile)) this.notice(zoneEditorMessage(ctx, 'no_zone'));
            return true;
          }
        if (letter === 'x' && !this.zones.active && this.zones.selected !== 0 && ctx.readers.of<BuildingsReader>('14').zone(this.zones.selected)?.type !== 'stockpile') {
          this.removeZone(this.zones.selected);
          return true;
        }
        if (letter === 'e' && !this.zones.active && this.zones.selected !== 0) {
          this.zones.resizing = true;
          return true;
        }
        return letter !== '' && this.zones.choose(letter);
      case 'stocks':
        if (k === '/') { this.stocks.filter.focused = true; return true; }
        if (this.stocks.depotSelection) {
          if (!press.shift && (up || down)) { this.stocks.move(up ? -1 : 1, ctx); return true; }
          if (k === 'Enter' || k === 'Space' || k === ' ') { this.stocks.toggleDepot(ctx); return true; }
          if (letter === 't') { this.stocks.confirmDepot(ctx); return true; }
          return false;
        }
        if (!press.shift && (up || down)) {
          this.stocks.move(up ? -1 : 1, ctx);
          return true;
        }
        if (k === 'Enter') {
          this.stocks.expand(ctx);
          return true;
        }
        if (letter === 'f') { this.stocks.flag(ctx, 'ForbidItem'); return true; }
        if (letter === 'd') { this.stocks.flag(ctx, 'DumpItem'); return true; }
        if (letter === 'm') { this.stocks.flag(ctx, 'MeltItem'); return true; }
        if (letter === 't') { this.moveGoods(); return true; }
        return false;
      case 'civilizations':
        return this.civilizations.key(ctx, press, () => this.openTrade());
      case 'depot':
        if (!press.shift && (up || down)) { this.depot.move(up ? -1 : 1, ctx); return true; }
        if (letter === 'm') { this.moveGoods(); return true; }
        if (letter === 'r') { this.depot.remove(ctx); return true; }
        if (letter === 't') { this.openTrade(); return true; }
        return false;
      case 'units': {
        if (this.units.editing) return this.unitsFilterKey(press);
        // U-06: marks, titles, rename, squads, sleep hour, and the open chooser's keys.
        if (this.units.key(ctx, press)) return true;
        if (k === '/') {
          this.units.editing = true;
          return true;
        }
        if (!press.shift && (up || down)) {
          this.units.move(up ? -1 : 1, ctx);
          return true;
        }
        const id = this.units.selectedId(ctx);
        const p = id === 0 ? undefined : this.host.readers.entities.get(id, C.Position);
        const at = p === undefined ? null : this.host.readers.map.index(p.x, p.y, p.z);
        if (k === 'Enter' && at !== null) {
          ctx.look(at);
          return true;
        }
        if (letter === 'c' && at !== null) {
          this.focusOn(at);
          return true;
        }
        return false;
      }
      case 'jobs': {
        if (k === '/') { this.jobs.filter.focused = true; return true; }
        if (letter === 'l') { this.jobs.cycleLabor(ctx); return true; }
        if (letter === 's') { this.jobs.cycleState(); return true; }
        if (!press.shift && (up || down)) {
          this.jobs.move(up ? -1 : 1, ctx);
          return true;
        }
        if (letter === 'p') return submit(this.jobs.priority(ctx));
        if (letter === 'x') return submit(this.jobs.cancel(ctx));
        const j = this.jobs.selected(ctx);
        if (k === 'Enter' && j !== undefined) {
          const t = this.jobs.tileOf(ctx, j);
          if (t !== null) this.focusOn(t);
          return true;
        }
        return false;
      }
      case 'orders':
        return this.orders.key(ctx, press);
      case 'workshop':
        return this.orders.workshopKey(ctx, this.workshopId, press, () => this.deconstruct(this.workshopId));
      case 'building':
        return this.building.key(ctx, press, (id) => this.deconstruct(id));
      case 'animals': {
        if (this.animals.capEditor !== null) return false;
        if (this.animals.name.focused) {
          if (k === 'Enter') return submit(this.animals.finishName(ctx));
          return editText(this.animals.name, press);
        }
        if (this.animals.trainChoice !== null) {
          if (up || down) {
            this.animals.trainChoice.selected = this.animals.trainChoice.selected === 0 ? 1 : 0;
            return true;
          }
          if (k === 'Enter') return submit(this.animals.finishTrain());
          if (k === 'Backspace' || k === 'Esc' || k === 'Escape') {
            this.animals.trainChoice = null;
            return true;
          }
          return false;
        }
        if (k === '1' || k === '2') { this.animals.trainChoice = null; this.animals.tab = k === '1' ? 0 : 1; this.animals.list.selected = 0; return true; }
        if (!press.shift && (up || down)) { this.animals.move(up ? -1 : 1, ctx); return true; }
        if (this.animals.tab === 0) {
          if (letter === 'p') return submit(this.animals.pasture(ctx));
          if (letter === 's') { this.animals.slaughterAsk(ctx); return true; }
          if (letter === 'c') { this.animals.startCap(ctx); return true; }
          if (letter === 'a') return submit(this.animals.assign(ctx));
          if (letter === 'n') { this.animals.startName(ctx); return true; }
          if (letter === 't') { this.animals.startTrain(ctx); return true; }
        } else {
          if (letter === 'h') return submit(this.animals.hunt(ctx));
        }
        return false;
      }
      case 'mood': {
        if (!press.shift && (up || down)) { this.mood.move(up ? -1 : 1, ctx); return true; }
        if (letter === 's') { this.mood.sorted = !this.mood.sorted; this.mood.list.selected = 0; return true; }
        if (k === 'Enter') {
          const id = this.mood.selected(ctx);
          const p = ctx.readers.entities.get(id, C.Position);
          if (p !== undefined) ctx.look(ctx.readers.map.index(p.x, p.y, p.z));
          return true;
        }
        return false;
      }
      case 'labors':
        if (!press.shift && (up || down)) {
          this.labors.move(up ? -1 : 1, ctx);
          return true;
        }
        if (!press.shift && (left || right)) {
          this.labors.scroll(left ? -1 : 1);
          return true;
        }
        if (letter === 'a') return submit(this.labors.toggleRow(ctx));
        // U-06: the labor manager, with the cursor on the selected dwarf.
        if (k === 'Enter') {
          ctx.laborManager?.({ focus: dwarvesOf(ctx)[this.labors.selectedRow] });
          return true;
        }
        return false;
      case 'military':
        return this.military.key(ctx, press, this.host);
      case 'threats':
        return this.threats.key(ctx, press);
      default:
        return false;
    }
  }

  // ---------- mouse ----------

  pointerDown(p: CellPointer): void {
    this.pointer = { col: p.col, row: p.row };
    const at = this.pointOfCell(p.col, p.row);
    if (at === null) {
      const sr = this.speedRegion;
      if (p.button === 2 && sr !== null && p.row === sr.row && p.col >= sr.col && p.col < sr.col + sr.cols) {
        this.cycleSpeed();
        return;
      }
      this.clickShift = p.shift;
      clickHit(this.last, p);
      this.clickShift = false;
      // § Mouse: "Double-click a unit or job row: center the map on it".
      if ((p.clicks ?? 1) >= 2) this.centerOnPanelRow();
      return;
    }
    if (p.button === 1) {
      this.middle = { col: p.col, row: p.row };
      return;
    }
    if (p.button === 2) {
      // "Right click: cancels the current tool; with no tool, opens the inspection panel".
      if (this.military.settingStation || this.military.settingPatrol || this.military.settingKill || this.military.settingFollow) this.military.cancel();
      else if (this.ui.panel === 'zones' && this.zones.stockpile.linkingFor !== 0) this.zones.stockpile.cancel();
      else if (this.ui.panel === 'building' && this.building.linking) this.building.cancel();
      else if (this.build.active) this.build.cancel();
      else if (this.zones.active) this.zones.cancel();
      else if (this.tool.active) this.tool.cancel();
      else this.look(at);
      return;
    }
    if (p.button !== 0) return;
    if (this.military.settingStation || this.military.settingPatrol || this.military.settingKill || this.military.settingFollow) {
      const tile = this.tileOf(at);
      if (tile !== null) {
        if (this.military.settingStation) this.military.setStation(this.ctx, tile, this.host);
        else if (this.military.settingPatrol) this.military.setPatrol(this.ctx, tile, this.host);
        else if (this.military.setOrderTarget(this.ctx, tile, this.host)) this.military.cancel();
        else this.notice(this.strings.get(this.military.settingKill ? 'ui.status.click_creature' : 'ui.status.click_dwarf'));
        if (!this.military.settingKill && !this.military.settingFollow) this.military.cancel();
      }
      return;
    }
    if (this.ui.panel === 'zones' && this.ui.sidebar && this.zones.stockpile.linkingFor !== 0) {
      const tile = this.tileOf(at);
      if (tile !== null) this.zones.stockpile.pickSource(this.ctx, tile);
      return;
    }
    if (this.ui.panel === 'building' && this.ui.sidebar && this.building.linking) {
      // U-05: the link target is picked on the map.
      const tile = this.tileOf(at);
      if (tile !== null) this.building.pickAt(this.ctx, tile);
      return;
    }
    if (this.build.active) {
      if (this.build.anchor !== null) {
        // The corner was marked with `Shift+Enter`: the click is the other corner.
        this.placeMany(this.build.anchor, at);
      } else if (this.build.multi(this.ctx)) {
        // D-U6: a drag places one per valid tile; the click is a drag that stays on its tile.
        this.build.anchor = at;
        this.build.end = at;
        this.dragging = true;
        this.clearNotice();
      } else this.place(at);
      return;
    }
    if (this.zones.active) {
      this.zones.anchor = at;
      this.zones.end = at;
      this.dragging = true;
      this.clearNotice();
      return;
    }
    if (this.ui.panel === 'zones' && this.ui.sidebar) {
      const tile = this.tileOf(at);
      if (tile !== null && this.zones.select(this.ctx, tile)) return;
    }
    if (this.tool.kind === 'stairwell' && this.tool.anchor !== null && this.tool.anchor.z !== at.z) {
      this.commit(this.tool.anchor, at);
      return;
    }
    if (this.tool.active) {
      this.tool.anchor = at;
      this.tool.end = at;
      this.dragging = true;
      this.clearNotice();
      return;
    }
    const tile = this.tileOf(at);
    const buildingId = tile !== null && this.host.readers.has('14') ? this.host.readers.of<import('@systems/buildings').BuildingsReader>('14').at(tile) : 0;
    this.selection = null;
    if (buildingId !== 0) {
      // 14 § Player-facing behavior: "Clicking a building opens its panel"; a drag from it still selects.
      this.openBuilding(buildingId);
      if (this.ui.panel === 'building') {
        this.ui.cursor = { x: at.x, y: at.y };
        this.selecting = at;
        this.clearNotice();
      }
      return;
    }
    this.selecting = at;
    this.clearNotice();
    this.look(at);
  }

  pointerMove(p: CellPointer): void {
    this.pointer = { col: p.col, row: p.row };
    const at = this.pointOfCell(p.col, p.row);
    this.hover = at === null ? null : this.tileOf(at);
    if (at === null) this.build.clearPlacement();
    else this.build.placementAt(this.ctx, at);
    if (this.middle !== null) {
      // Middle drag pans: the map follows the pointer.
      this.host.pan(this.middle.col - p.col, this.middle.row - p.row);
      this.middle = { col: p.col, row: p.row };
      return;
    }
    if (this.settings.edgeScrolling && at !== null && !this.dragging) {
      const map = this.host.layout().map;
      const dx = p.col === map.col ? -1 : p.col === map.col + map.cols - 1 ? 1 : 0;
      const dy = p.row === map.row ? -1 : p.row === map.row + map.rows - 1 ? 1 : 0;
      if (dx || dy) this.host.pan(dx, dy);
    }
    if (this.dragging && at !== null && this.build.anchor !== null) this.build.end = { x: at.x, y: at.y, z: this.build.anchor.z };
    else if (this.dragging && at !== null && this.zones.anchor !== null) this.zones.end = { x: at.x, y: at.y, z: this.zones.anchor.z };
    else if (this.dragging && at !== null && this.tool.anchor !== null) this.tool.end = { x: at.x, y: at.y, z: this.tool.anchor.z };
    else if (this.selecting !== null && at !== null && (at.x !== this.selecting.x || at.y !== this.selecting.y)) {
      this.selection = { a: this.selecting, b: { x: at.x, y: at.y, z: this.selecting.z } };
    }
  }

  pointerUp(p: CellPointer): void {
    this.pointer = { col: p.col, row: p.row };
    if (p.button === 1) {
      this.middle = null;
      return;
    }
    this.selecting = null;
    if (!this.dragging) return;
    this.dragging = false;
    if (this.build.anchor !== null) {
      const from = this.build.anchor;
      const up = this.pointOfCell(p.col, p.row);
      this.placeMany(from, up ?? this.build.end ?? from);
      return;
    }
    if (this.zones.anchor !== null) {
      const za = this.zones.anchor;
      const zat = this.pointOfCell(p.col, p.row);
      const zb = zat === null ? this.zones.end : { x: zat.x, y: zat.y, z: za.z };
      if (zb !== null) this.commitZone(za, zb);
      return;
    }
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
    // Over the sidebar the wheel scrolls the list under the pointer, three rows a notch, and never changes the level.
    const side = this.host.layout().sidebar;
    if (side !== null && this.ui.sidebar && w.col >= side.col && w.col < side.col + side.cols && w.row >= side.row && w.row < side.row + side.rows) {
      const panel = this.ui.panel;
      if (panel !== null) for (let k = 0; k < 3; k += 1) this.panelKey(panel, { key: w.dy > 0 ? 'ArrowDown' : 'ArrowUp', repeat: false, shift: false, ctrl: false, alt: false, meta: false });
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
