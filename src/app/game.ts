/**
 * The game: the screen stack, the view state and the wiring of host, compositor and renderer.
 *
 * Implements `01-architecture/simulation-core.md` § Startup sequence and § The frame loop (through
 * `sim-host.ts`), `02-systems/23-rendering.md` § Viewport and camera (clamping, "Changing `z`
 * keeps `camX, camY`") and the screen stack of `02-systems/24-ui-and-input.md` § Concepts ("a
 * full-window mode on a stack"). The screens outside the fortress are `ui/screens/*`; the app
 * gives them what only it may touch (world generation, the host, the save store) through their
 * host interfaces, because `ui/` may not import `app/`.
 *
 * The fortress's map keys are 24 § Input model: "arrow keys pan by one cell, `Shift` + arrows by
 * ten; `<` and `>` (also `,` and `.`) z-level down and up".
 */

import type { ItemsReader } from '@systems/items';
import type { BuildingsReader } from '@systems/buildings';
import { CanvasSurface, domCanvasFactory, type CanvasFactory, type CanvasLike } from '@platform/canvas';
import { InputSource, type EventTargetLike, type KeyPress, type PointerAction, type WheelAction } from '@platform/input';
import {
  FrameLoop,
  browserFrameScheduler,
  browserHidden,
  type FrameScheduler,
} from '@platform/realtime';
import { contentRegistry } from '@content/loader';
import { LOCAL_MAP_Z, ZOOM_LEVELS } from '@core/constants';
import { Compositor, type ViewState } from '@render/compositor';
import { GlyphAtlas, glyphChars } from '@render/atlas';
import { Palette } from '@render/palette';
import { Renderer } from '@render/renderer';
import { CellBuffer, computeViewport } from '@render/cellbuffer';
import { WorldMapCompositor } from '@render/world-map';
import { FrameDriver, InProcessHost, type NewGameSpec, type Speed } from '@app/sim-host';
import {
  SaveManager,
  autoSaveId,
  exportFileName,
  manualSaveId,
  newestManualId,
  readSaveHeader,
  rollAutosaves,
  type SaveHeader,
  type SaveKind,
  type SaveThumbnail,
} from '@app/save-manager';
import { validateImport, type LoadedGame } from '@app/game-save';
import { browserFiles, type FileBridge } from '@platform/files';
import { bytesToBase64 } from '@core/serialize';
import { SIM_TICKS_PER_SECOND, STATUS_ROWS } from '@core/constants';
import { FLUID_ANIM_MS, LOG_ROWS } from '@render/constants';
import { ConfirmScreen } from '@ui/screens/confirm';
import { LoadScreen, type SaveListing } from '@ui/screens/load';
import { createStorage } from '@platform/storage';
import type { Command } from '@core/commands';
import type { Registry } from '@core/registry';
import { localMapSpec } from '@systems/embark';
import { generate, worldReader, type WorldMap, type WorldgenReader, type WorldgenStage } from '@systems/worldgen';
import { Keymap, type KeymapRow } from '@ui/keymap';
import { Strings } from '@ui/strings';
import { GlyphMap, Surface, themeOf, type Theme } from '@ui/surface';
import type { CellPointer, Screen, ScreenId } from '@ui/screen';
import { MainMenuScreen } from '@ui/screens/main_menu';
import { WorldGenScreen } from '@ui/screens/world_gen';
import { WorldMapScreen } from '@ui/screens/world_map';
import { EmbarkScreen } from '@ui/screens/embark';
import type { HeadlessEmbark } from '@app/headless';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState, fromSaved, toSaved, type SavedUiState, type UiState } from '@ui/ui-state';
import { TerrainFacts, precondition } from '@systems/terrain';
import { jsonSection, type SaveSection } from '@app/save-manager';

export type { ScreenId } from '@ui/screen';
export type { UiState } from '@ui/ui-state';

export interface GameOptions {
  readonly canvas: CanvasLike;
  readonly seed: string;
  readonly registry?: Registry;
  readonly createCanvas: CanvasFactory;
  readonly devicePixelRatio?: number;
  readonly colorblind?: boolean;
  /** Canvas size in CSS pixels; the app passes the window size. */
  readonly width: number;
  readonly height: number;
  /** Where saves are listed from (the main menu's `Continue`); none in the unit tests. */
  readonly saves?: SaveManager;
  /** A fresh random seed for the world generation screen. */
  readonly randomSeed?: () => string;
  /** The export download and import picker (`platform/files.ts`); none in the unit tests. */
  readonly files?: FileBridge;
}

/** `persistence.md` § What is saved: "thumbnail (a 48×27 cell ASCII snapshot of the surface)". */
export const THUMBNAIL_COLS = 48;
export const THUMBNAIL_ROWS = 27;

/** The z-level the fortress screen opens on: the `flat-test` surface. */
const START_Z = 32;

/** The built-in fortress screen of the stack (its keys and drawing live on {@link Game}). */
const FORTRESS = 'fortress' as const;

type StackEntry = Screen | typeof FORTRESS;

let seedCounter = 0;

/** The default random seed: a word and a number, as the wireframe shows (`coldmere-4471`). */
function defaultRandomSeed(): string {
  seedCounter += 1;
  const n = Math.floor(Math.random() * 10000);
  return `deep-${n}-${seedCounter}`;
}

export class Game {
  readonly host = new InProcessHost();
  readonly seed: string;
  readonly registry: Registry;
  readonly palette: Palette;
  /** Rebuilt when the zoom changes the cell size. */
  atlas: GlyphAtlas;
  readonly compositor: Compositor;
  readonly worldMapCompositor: WorldMapCompositor;
  renderer: Renderer;
  readonly surface: CanvasSurface;
  readonly driver: FrameDriver;
  readonly keymap: Keymap;
  readonly strings: Strings;
  readonly glyphs: GlyphMap;
  readonly theme: Theme;
  readonly ui: UiState = defaultUiState(START_Z);
  /** The fortress screen's tools, panels, log and status bar (T-M1-14). */
  readonly fortress: FortressScreen;
  private readonly createCanvas: CanvasFactory;
  private unsubscribe: (() => void) | null = null;
  /** The world of the embark screen, before the game exists. */
  private pendingWorld: WorldMap | null = null;

  private readonly stack: StackEntry[] = [FORTRESS];
  private cols = 0;
  private rows = 0;
  private cssScale = 1;
  private cells: CellBuffer | null = null;
  private screenBuffer: CellBuffer | null = null;
  private lastSurface: Surface | null = null;
  private readonly saves: SaveManager | null;
  private readonly files: FileBridge | null;
  /** The season an autosave is owed for, taken after the tick that announced it (D-083). */
  private autosaveDue: { year: number; season: number } | null = null;
  /** The Load screen's list, refreshed from the headers after every change. */
  private listing: SaveListing[] = [];
  /** The last save written or loaded, for the tests and the e2e hook. */
  lastSaveId: string | null = null;
  private pending: Promise<void> = Promise.resolve();
  private readonly randomSeed: () => string;
  private newest: string | null = null;
  /** A message drawn over a blank screen while the app works synchronously. */
  private busy: string | null = null;

  constructor(options: GameOptions) {
    this.seed = options.seed;
    this.registry = options.registry ?? contentRegistry();
    this.palette = new Palette(this.registry, { colorblind: options.colorblind === true });
    this.surface = new CanvasSurface(options.canvas, {
      ...(options.devicePixelRatio === undefined
        ? {}
        : { devicePixelRatio: options.devicePixelRatio }),
    });
    const fit = computeViewport(
      options.width * (options.devicePixelRatio ?? 1),
      options.height * (options.devicePixelRatio ?? 1),
      this.ui.zoom,
    );
    this.atlas = new GlyphAtlas({
      cellPx: fit.cellPx,
      chars: glyphChars(this.registry),
      createCanvas: options.createCanvas,
    });
    this.compositor = new Compositor({ registry: this.registry, palette: this.palette });
    this.worldMapCompositor = new WorldMapCompositor(this.registry, this.palette);
    this.renderer = new Renderer({ surface: this.surface, atlas: this.atlas, palette: this.palette });
    this.driver = new FrameDriver({ host: this.host, render: () => this.render() });
    this.keymap = Keymap.fromRows(this.registry.derived<readonly KeymapRow[]>('keymap'));
    this.strings = new Strings(this.registry);
    this.glyphs = GlyphMap.of(this.registry);
    this.theme = themeOf(this.palette);
    this.saves = options.saves ?? null;
    this.files = options.files ?? null;
    this.host.afterTick = () => this.takeAutosave();
    this.randomSeed = options.randomSeed ?? defaultRandomSeed;
    this.createCanvas = options.createCanvas;
    this.fortress = new FortressScreen(this.fortressHost(), this.keymap, this.strings);
    this.resize(options.width, options.height, options.devicePixelRatio ?? 1);
  }

  /** What the fortress screen may touch: the host, the camera, 03's precondition. */
  private fortressHost(): FortressHost {
    const host = this.host;
    let facts: TerrainFacts | null = null;
    return {
      get readers() {
        return host.readers;
      },
      registry: this.registry,
      ui: this.ui,
      submit: (command) => this.host.submit(command),
      speed: () => this.host.speed(),
      setSpeed: (speed) => this.host.setSpeed(speed),
      pan: (dx, dy) => void this.pan(dx, dy),
      changeZ: (dz) => void this.changeZ(dz),
      centerOn: (x, y, z) => {
        this.centerOn(x, y, z);
        this.render();
      },
      home: () => this.home(),
      zoom: (delta) => this.zoomBy(delta),
      layout: () => this.compositor.layout,
      precondition: (i, kind) => {
        facts ??= new TerrainFacts(this.registry);
        return precondition(this.host.headless.map, i, kind, facts);
      },
      registeredPanels: () => this.host.world.registrations.panels,
      announcements: () => this.host.world.registrations.announcements,
      now: () => Date.now(),
      quickSave: () => void this.quickSave(),
      quickLoad: () => void this.quickLoad(),
      confirm: (id, params, answer) => this.confirm(id, params as Readonly<Record<string, string | number>>, answer),
    };
  }

  /** Subscribe the fortress screen to the running world's events (24 § Events consumed). */
  private subscribe(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.host.onEvents((events) => {
      this.fortress.onEvents(events);
      this.compositor.onEvents(events, Math.floor(Date.now() / FLUID_ANIM_MS));
      // `persistence.md` § Autosave: "On every `SeasonChanged`, the app saves". The world is in the
      // middle of its tick here, so the save waits for the tick to end (D-083).
      for (const e of events) {
        if (e.type === 'SeasonChanged') this.autosaveDue = { year: e['year'] as number, season: e['season'] as number };
      }
    });
  }

  // ---------- saving and loading (T-M2-11) ----------

  /** Resolves when the saves the app started are compressed and stored. */
  settled(): Promise<void> {
    return this.pending;
  }

  private track(work: Promise<void>): Promise<void> {
    const next = this.pending
      .then(() => work)
      .catch((error: unknown) => {
        this.note('danger', this.strings.get('ui.save.failed', { reason: error instanceof Error ? error.message : String(error) }));
      });
    this.pending = next;
    return next;
  }

  private note(severity: 'note' | 'alert' | 'danger', text: string): void {
    if (!this.host.started) return;
    this.fortress.log.append(severity, text, this.host.readers.calendar.tick);
  }

  /** Called after every tick: the autosave a `SeasonChanged` asked for. */
  private takeAutosave(): void {
    const due = this.autosaveDue;
    this.autosaveDue = null;
    if (due === null || this.saves === null) return;
    void this.saveAs('auto', autoSaveId(due.year, due.season));
  }

  /** The header's play time: the simulated time since the embark, at 1× (D-083). */
  private playTimeSeconds(): number {
    const world = this.host.world;
    return Math.max(0, world.calendar.tick - world.fortress.embarkTick) / SIM_TICKS_PER_SECOND;
  }

  /** The header thumbnail: 48×27 map cells of the surface around the wagon (or the map centre). */
  thumbnail(): SaveThumbnail {
    const readers = this.host.readers;
    const map = readers.map;
    const arrival = this.host.headless.arrival;
    const cx = arrival === null ? Math.floor(map.w / 2) : arrival.wagon.x;
    const cy = arrival === null ? Math.floor(map.h / 2) : arrival.wagon.y;
    const z = arrival === null ? START_Z : arrival.wagon.z;
    const view: ViewState = {
      camX: Math.max(0, Math.min(Math.max(0, map.w - THUMBNAIL_COLS), cx - Math.floor(THUMBNAIL_COLS / 2))),
      camY: Math.max(0, Math.min(Math.max(0, map.h - THUMBNAIL_ROWS), cy - Math.floor(THUMBNAIL_ROWS / 2))),
      z,
      sidebarOpen: false,
      cursor: null,
    };
    const cells = this.compositor.compose(readers, view, THUMBNAIL_COLS, THUMBNAIL_ROWS + LOG_ROWS + STATUS_ROWS);
    const bytes = new Uint8Array(THUMBNAIL_COLS * THUMBNAIL_ROWS * 10);
    const out = new DataView(bytes.buffer);
    let at = 0;
    for (let r = 0; r < THUMBNAIL_ROWS; r += 1) {
      for (let c = 0; c < THUMBNAIL_COLS; c += 1) {
        const i = r * cells.cols + c;
        out.setUint16(at, cells.glyph[i] as number, true);
        out.setInt32(at + 2, cells.fg[i] as number, true);
        out.setInt32(at + 6, cells.bg[i] as number, true);
        at += 10;
      }
    }
    return { cols: THUMBNAIL_COLS, rows: THUMBNAIL_ROWS, cells: bytesToBase64(bytes) };
  }

  /**
   * Save the running game under `id`. The sections are taken now, between ticks; compression and
   * storage follow. An autosave keeps the four most recent autosaves (`persistence.md`).
   */
  saveAs(kind: SaveKind, id: string): Promise<void> {
    const saves = this.saves;
    if (saves === null || !this.host.started) return Promise.resolve();
    const blob = this.host.save({ kind, ui: this.uiSection(), playTimeSeconds: this.playTimeSeconds(), thumbnail: this.thumbnail() });
    return this.track(
      (async (): Promise<void> => {
        await saves.write(id, await blob);
        if (kind === 'auto') await rollAutosaves(saves);
        this.lastSaveId = id;
        this.note('note', this.strings.get('ui.save.saved', { name: id }));
        await this.refreshListing();
      })(),
    );
  }

  /** `F5` quick save: a manual save (`manual-<unixMs>`). */
  quickSave(): Promise<void> {
    return this.saveAs('manual', manualSaveId(Date.now()));
  }

  /** `F9` quick load, "with confirmation" (`c_quickload`): the newest manual save (D-083). */
  async quickLoad(): Promise<void> {
    await this.pending;
    const id = this.saves === null ? null : await newestManualId(this.saves);
    if (id === null) {
      this.note('note', this.strings.get('ui.save.no_quick'));
      this.render();
      return;
    }
    this.confirm('c_quickload', {}, (yes) => {
      if (yes) void this.loadSave(id);
    });
  }

  /** Push a confirmation dialog; the answer pops it. */
  confirm(id: string, params: Readonly<Record<string, string | number>>, answer: (yes: boolean) => void): void {
    const dialog = new ConfirmScreen(this.registry, this.strings, id, params, (yes) => {
      if (this.top() === dialog) this.popScreen();
      answer(yes);
      this.render();
    });
    this.pushScreen(dialog);
    this.render();
  }

  /** Load a stored save and switch to its fortress, paused (`save-format.md` § Load procedure step 6). */
  async loadSave(id: string): Promise<void> {
    const saves = this.saves;
    if (saves === null) return;
    const blob = await saves.read(id);
    if (blob === undefined) return;
    this.enterLoaded(await this.host.load(blob));
    this.lastSaveId = id;
  }

  /** The loaded game on screen: its `ui` section restored, the log tail back, paused. */
  enterLoaded(loaded: LoadedGame): void {
    this.subscribe();
    this.autosaveDue = null;
    this.fortress.log.lines.length = 0;
    if (loaded.ui !== null) {
      const zoom = this.ui.zoom;
      this.fortress.log.lines.push(...fromSaved(this.ui, loaded.ui as SavedUiState));
      if (this.ui.zoom !== zoom) this.resize(this.surface.cssWidth, this.surface.cssHeight);
    }
    this.resetTo(FORTRESS);
    this.host.setSpeed(0);
    this.clampCamera();
    this.render();
  }

  /** The Load screen's rows, from the headers only (`persistence.md` § Storage). */
  private async refreshListing(): Promise<void> {
    if (this.saves === null) return;
    const rows = await this.saves.list();
    this.listing = rows.map((row): SaveListing => listingOf(row.id, row.header));
    if (this.top() instanceof LoadScreen) this.render();
  }

  /** `Load` (main menu, 24 § Screens outside the fortress). */
  async openLoad(): Promise<void> {
    await this.refreshListing();
    const screen = new LoadScreen(
      {
        saves: () => this.listing,
        load: (id) => void this.loadSave(id),
        remove: (id) => {
          const row = this.listing.find((s) => s.id === id);
          this.confirm('c_delete_save', { save: row === undefined ? id : `${row.fortress} (${id})` }, (yes) => {
            const saves = this.saves;
            if (!yes || saves === null) return;
            void this.track(saves.delete(id).then(() => this.refreshListing()));
          });
        },
        exportSave: (id) => void this.exportSave(id),
        importSave: () => void this.importSave(),
        back: () => {
          this.popScreen();
          this.render();
        },
      },
      this.keymap,
      this.strings,
    );
    this.pushScreen(screen);
    this.render();
  }

  /** `persistence.md` § Export and import: the container, unchanged, as `<slug>-y<year>-<season>.deepholm`. */
  async exportSave(id: string): Promise<void> {
    if (this.saves === null || this.files === null) return;
    const blob = await this.saves.read(id);
    if (blob === undefined) return;
    const header = readSaveHeader(blob);
    this.files.download(exportFileName(header.fortress, header.calendar.year, header.calendar.season), blob);
  }

  /** Import: pick a file, then {@link importBlob}. */
  async importSave(): Promise<void> {
    if (this.saves === null || this.files === null) return;
    const blob = await this.files.pick('.deepholm');
    if (blob === null) return;
    await this.importBlob(blob);
  }

  /** "Import reads a file, validates magic and version, checks the content hash … and stores it as a manual save." */
  async importBlob(blob: Uint8Array): Promise<string> {
    const saves = this.saves;
    if (saves === null) throw new Error('no save store');
    await validateImport(blob, this.registry);
    const id = manualSaveId(Date.now());
    await saves.write(id, blob);
    await this.refreshListing();
    return id;
  }

  /** `Continue`: "loads the newest save of any kind". */
  async continueNewest(): Promise<void> {
    if (this.saves === null) return;
    const all = await this.saves.list();
    if (all.length === 0) return;
    const newest = all.reduce((a, b) => (b.header.calendar.tick > a.header.calendar.tick ? b : a));
    await this.loadSave(newest.id);
  }

  /** `Home`: center on the built hearth, falling back to the arrival wagon. */
  home(): void {
    if (!this.host.started) return;
    const buildings = this.host.readers.of<BuildingsReader>('14');
    const hearth = buildings.get(buildings.hearth());
    if (hearth?.state === 'built') {
      const map = this.host.headless.map;
      this.centerOn(map.xOf(hearth.origin), map.yOf(hearth.origin), map.zOf(hearth.origin));
      this.render();
      return;
    }
    const arrival = this.host.headless.arrival;
    if (arrival === null) this.centerOnMap();
    else this.centerOn(arrival.wagon.x, arrival.wagon.y, arrival.wagon.z);
    this.render();
  }

  /** One zoom level in or out (`ZOOM_LEVELS`); the grid refits to the canvas. */
  zoomBy(delta: number): void {
    const at = ZOOM_LEVELS.indexOf(this.ui.zoom as (typeof ZOOM_LEVELS)[number]);
    const next = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, (at < 0 ? 1 : at) + delta))] as number;
    if (next === this.ui.zoom) return;
    this.ui.zoom = next;
    this.resize(this.surface.cssWidth, this.surface.cssHeight);
    this.render();
  }

  /** The screen on top of the stack. */
  get screen(): ScreenId {
    const top = this.top();
    return top === FORTRESS ? 'fortress' : top.id;
  }

  /** The UI screen object on top, or `null` for the fortress. */
  get topScreen(): Screen | null {
    const top = this.top();
    return top === FORTRESS ? null : top;
  }

  private top(): StackEntry {
    return this.stack[this.stack.length - 1] as StackEntry;
  }

  pushScreen(screen: Screen | 'fortress'): void {
    this.stack.push(screen);
  }

  popScreen(): void {
    if (this.stack.length > 1) this.stack.pop();
  }

  /** Replace the whole stack with one screen. */
  resetTo(screen: Screen | 'fortress'): void {
    this.stack.length = 0;
    this.stack.push(screen);
  }

  /** `simulation-core.md` § Startup sequence steps 3 to 5 for the `flat-test` world. */
  async start(spec: { seed?: string; embark?: NewGameSpec['embark'] } = {}): Promise<void> {
    await this.host.newGame({ seed: spec.seed ?? this.seed, ...(spec.embark === undefined ? {} : { embark: spec.embark }) });
    this.fortress.resetHints();
    this.subscribe();
    this.resetTo(FORTRESS);
    this.centerOnMap();
    if (this.host.headless.arrival !== null) this.fortress.showFirstHint();
    this.render();
  }

  /** The `ui` save section (`save-format.md` § Sections; `system-state.md` § UiState). */
  uiSection(): SaveSection {
    return jsonSection('ui', toSaved(this.ui, this.fortress.log.lines));
  }

  // ---------- the screens outside the fortress (T-M1-12) ----------

  /** The first screen of a normal start (24 § Screens outside the fortress). */
  async showMainMenu(): Promise<void> {
    this.newest = await this.newestSaveSummary();
    this.resetTo(this.mainMenu());
    this.render();
  }

  private async newestSaveSummary(): Promise<string | null> {
    if (this.saves === null) return null;
    try {
      const all = await this.saves.list();
      if (all.length === 0) return null;
      const newest = all.reduce((a, b) => (b.header.calendar.tick > a.header.calendar.tick ? b : a));
      return `${newest.header.fortress} · Year ${newest.header.calendar.year}`;
    } catch {
      return null;
    }
  }

  mainMenu(): MainMenuScreen {
    return new MainMenuScreen(
      {
        newestSave: () => this.newest,
        newWorld: () => this.openWorldGen(),
        continueGame: () => void this.continueNewest(),
        available: (entry) => entry === 'load' && this.saves !== null,
        open: (entry) => {
          if (entry === 'load') void this.openLoad();
        },
      },
      this.keymap,
      this.strings,
    );
  }

  openWorldGen(): void {
    this.pushScreen(
      new WorldGenScreen(
        {
          randomSeed: () => this.randomSeed(),
          generate: (seed, size, onProgress) =>
            generate(seed, size, this.registry, {
              onProgress: (stage: WorldgenStage, pct: number) => onProgress(stage, pct),
            }),
          back: () => this.popScreen(),
          continueTo: (world) => this.openWorldMap(world),
        },
        this.keymap,
        this.strings,
        this.worldMapCompositor,
      ),
    );
    this.render();
  }

  openWorldMap(world: WorldMap): void {
    this.pushScreen(
      new WorldMapScreen(
        world,
        {
          embark: (w, regionId) => this.openEmbark(w, regionId),
          back: () => this.popScreen(),
        },
        this.keymap,
        this.strings,
        this.worldMapCompositor,
        this.registry,
      ),
    );
    this.render();
  }

  /** The embark screen for a region (`ui-screens/embark.md`, T-M1-13). */
  openEmbark(world: WorldMap, regionId: number): void {
    const region = world.regions[regionId];
    if (region === undefined) return;
    this.pendingWorld = world;
    this.pushScreen(
      new EmbarkScreen(
        this.registry,
        world.seed,
        { name: region.name, peril: region.peril, tempC: region.tempC },
        {
          embark: (session) => void this.embarkRegion(world, regionId, { session }),
          back: () => this.popScreen(),
        },
        this.keymap,
        this.strings,
      ),
    );
    this.render();
  }

  /**
   * `Embark` on a region: the local map from its `LocalMapSpec` (03) and 02's arrival with the
   * embark screen's session (or a preset). Arrival step 8: "The app switches to the fortress
   * screen, paused, centered on the wagon at the surface z-level".
   */
  async embarkRegion(world: WorldMap, regionId: number, embark: HeadlessEmbark = 'default'): Promise<void> {
    await this.working(this.strings.get('ui.busy.site'));
    try {
      const spec = localMapSpec(world, regionId, this.registry);
      await this.host.newGame({ seed: world.seed, world: 'local', spec, embark, worldMap: world });
      this.subscribe();
    } finally {
      this.busy = null;
    }
    this.enterFortress();
  }

  /** Switch to the fortress screen, paused, centered on the wagon (arrival step 8). */
  enterFortress(): void {
    this.busy = null;
    this.fortress.resetHints();
    this.resetTo(FORTRESS);
    this.host.setSpeed(0);
    const arrival = this.host.headless.arrival;
    if (arrival === null) this.centerOnMap();
    else this.centerOn(arrival.wagon.x, arrival.wagon.y, arrival.wagon.z);
    this.fortress.showFirstHint();
    this.render();
  }

  /** Draw a message and yield once, so it is on screen before a long synchronous step. */
  private async working(message: string): Promise<void> {
    this.busy = message;
    this.render();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  /** The world-level reader of the running game's generated world, if any. */
  worldReader(): WorldgenReader | null {
    const top = this.top();
    // Before an embark the world is the world map screen's (the hook's readers read it there).
    if (top instanceof WorldMapScreen || top instanceof EmbarkScreen) {
      const shown = top instanceof WorldMapScreen ? top.world : this.pendingWorld;
      if (shown !== null) return worldReader(shown);
    }
    const map = this.host.started ? this.host.worldMap : null;
    return map === null ? null : worldReader(map);
  }

  // ---------- layout and drawing ----------

  /** Fit the grid to the canvas and rebuild the atlas when the cell size changed. */
  resize(cssWidth: number, cssHeight: number, dpr = this.surface.pixelRatio): void {
    const fit = computeViewport(cssWidth * dpr, cssHeight * dpr, this.ui.zoom);
    this.surface.resize(cssWidth, cssHeight, dpr, fit.cssScale);
    this.cols = fit.cols;
    this.rows = fit.rows;
    this.cssScale = fit.cssScale;
    this.ui.zoom = fit.zoom;
    if (fit.cellPx !== this.atlas.cellPx) {
      // A new cell size needs a new atlas (23 § Atlas: "drawn once per zoom").
      this.atlas = new GlyphAtlas({ cellPx: fit.cellPx, chars: glyphChars(this.registry), createCanvas: this.createCanvas });
      this.renderer = new Renderer({ surface: this.surface, atlas: this.atlas, palette: this.palette });
    }
    this.clampCamera();
  }

  get viewCols(): number {
    return this.cols;
  }

  get viewRows(): number {
    return this.rows;
  }

  /** The last composed buffer; the e2e hook reads it. */
  cellBuffer(): CellBuffer | null {
    return this.cells;
  }

  /** The last buffer's rows as text (the e2e hook and the tests read screens this way). */
  textRows(): string[] {
    const cells = this.cells;
    if (cells === null) return [];
    return new Surface(cells, this.glyphs, this.theme).lines();
  }

  /** Compose and draw one frame. */
  render(): void {
    const top = this.top();
    if (this.busy !== null || top !== FORTRESS) {
      if (this.screenBuffer === null || this.screenBuffer.cols !== this.cols || this.screenBuffer.rows !== this.rows) {
        this.screenBuffer = new CellBuffer(this.cols, this.rows);
      }
      const buffer = this.screenBuffer;
      buffer.fill(0, this.theme.black, this.theme.black);
      const surface = new Surface(buffer, this.glyphs, this.theme);
      if (this.busy !== null) {
        const text = this.busy;
        surface.text(Math.max(0, Math.floor((this.cols - text.length) / 2)), Math.floor(this.rows / 2), text, this.theme.text);
      } else if (top !== FORTRESS) {
        top.draw(surface);
      }
      this.lastSurface = surface;
      this.cells = buffer;
      this.renderer.draw(buffer);
      return;
    }
    if (!this.host.started) return;
    const view: ViewState = {
      camX: this.ui.camX,
      camY: this.ui.camY,
      z: this.ui.z,
      // "`Tab` toggles it without changing the panel" (24 § Fortress screen layout).
      sidebarOpen: this.ui.panel !== null && this.ui.sidebar,
      cursor: this.ui.cursor,
      overlays: this.ui.overlays,
      // 23 § Animation: the presentation clock (`algorithms/compositor.md` `animPhase`).
      animFrame: Math.floor(Date.now() / FLUID_ANIM_MS),
    };
    const cells = this.compositor.compose(this.host.readers, view, this.cols, this.rows);
    const surface = new Surface(cells, this.glyphs, this.theme);
    this.fortress.draw(surface);
    this.cells = cells;
    this.lastSurface = surface;
    this.renderer.draw(cells);
  }

  // ---------- input ----------

  /** The screen object input goes to: the top of the stack, the fortress once a world runs. */
  private inputScreen(): Screen | null {
    const top = this.top();
    if (top !== FORTRESS) return top;
    return this.host.started ? this.fortress : null;
  }

  /** A key press, routed to the screen on top. Returns whether the key was consumed. */
  handleKey(key: KeyPress): boolean {
    if (this.busy !== null) return false;
    const screen = this.inputScreen();
    if (screen === null) return false;
    const used = screen.key(key);
    this.render();
    return used;
  }

  /**
   * Canvas-local CSS pixels to a cell (`algorithms/compositor.md` § Mouse mapping:
   * `cellAt(px, py) = (floor(px / cellPx), floor(py / cellPx))`, in device pixels).
   */
  cellAt(cssX: number, cssY: number): { col: number; row: number } {
    const scale = this.surface.pixelRatio / this.cssScale;
    return {
      col: Math.floor((cssX * scale) / this.atlas.cellPx),
      row: Math.floor((cssY * scale) / this.atlas.cellPx),
    };
  }

  /** The canvas-local CSS pixel at the centre of a cell: the inverse of {@link cellAt}. */
  cellCenter(col: number, row: number): { x: number; y: number } {
    const scale = this.cssScale / this.surface.pixelRatio;
    return {
      x: (col + 0.5) * this.atlas.cellPx * scale,
      y: (row + 0.5) * this.atlas.cellPx * scale,
    };
  }

  private cellPointer(action: PointerAction): CellPointer {
    const at = this.cellAt(action.x, action.y);
    return { ...at, button: action.button, shift: action.shift, ctrl: action.ctrl, alt: action.alt, meta: action.meta };
  }

  pointerDown(action: PointerAction): void {
    if (this.busy !== null) return;
    this.inputScreen()?.pointerDown?.(this.cellPointer(action));
    this.render();
  }

  pointerMove(action: PointerAction): void {
    if (this.busy !== null) return;
    const screen = this.inputScreen();
    if (screen?.pointerMove === undefined) return;
    screen.pointerMove(this.cellPointer(action));
    this.render();
  }

  pointerUp(action: PointerAction): void {
    if (this.busy !== null) return;
    const screen = this.inputScreen();
    if (screen?.pointerUp === undefined) return;
    screen.pointerUp(this.cellPointer(action));
    this.render();
  }

  wheel(action: WheelAction): void {
    if (this.busy !== null) return;
    const screen = this.inputScreen();
    if (screen?.wheel === undefined) return;
    const at = this.cellAt(action.x, action.y);
    screen.wheel({ ...at, dy: action.dy, shift: action.shift, ctrl: action.ctrl, alt: action.alt, meta: action.meta });
    this.render();
  }

  /** The surface of the last UI frame (its widgets' click regions). */
  get uiSurface(): Surface | null {
    return this.lastSurface;
  }

  // ---------- the fortress camera ----------

  /** "arrow keys pan by one cell, `Shift` + arrows by ten"; the camera stays inside the map. */
  pan(dx: number, dy: number): boolean {
    this.ui.camX += dx;
    this.ui.camY += dy;
    this.clampCamera();
    this.render();
    return true;
  }

  /** "`<` and `>` … z-level down and up"; "Changing `z` keeps `camX, camY`". */
  changeZ(dz: number): boolean {
    const depth = this.host.started ? this.host.readers.map.d : LOCAL_MAP_Z;
    this.ui.z = Math.max(0, Math.min(depth - 1, this.ui.z + dz));
    this.render();
    return true;
  }

  /** `render.centerOn(tile)`: "sets the camera so the tile is centered and switches `z`". */
  centerOn(x: number, y: number, z: number): void {
    this.ui.camX = x - Math.floor(this.mapCols() / 2);
    this.ui.camY = y - Math.floor(this.mapRows() / 2);
    this.ui.z = z;
    this.clampCamera();
  }

  /** `render.centerOn(tile)` for the whole map: the camera starts at the middle of the map. */
  centerOnMap(): void {
    if (!this.host.started) return;
    const map = this.host.readers.map;
    this.ui.camX = Math.floor((map.w - this.mapCols()) / 2);
    this.ui.camY = Math.floor((map.h - this.mapRows()) / 2);
    this.clampCamera();
  }

  /** "The camera is clamped so the viewport never shows outside the map". */
  clampCamera(): void {
    if (!this.host.started) return;
    const map = this.host.readers.map;
    this.ui.camX = Math.max(0, Math.min(Math.max(0, map.w - this.mapCols()), this.ui.camX));
    this.ui.camY = Math.max(0, Math.min(Math.max(0, map.h - this.mapRows()), this.ui.camY));
  }

  private mapCols(): number {
    return this.compositor.layout.map.cols > 0 ? this.compositor.layout.map.cols : this.cols;
  }

  private mapRows(): number {
    return this.compositor.layout.map.rows > 0 ? this.compositor.layout.map.rows : this.rows;
  }
}

/** What `window.__deepholm` exposes in test builds (`01-testing-strategy.md` § E2E harness). */
export interface TestHook {
  readonly host: InProcessHost;
  readonly readers: HookReaders;
  cells(): { cols: number; rows: number; glyph: number[]; fg: number[]; bg: number[] };
  /** The screen's rows decoded to text. */
  text(): string[];
  /** The id of the screen on top of the stack. */
  screen(): ScreenId;
  /** Canvas-local CSS pixels of a cell's centre, for driving the real mouse. */
  cellCenter(col: number, row: number): { x: number; y: number };
  /** Every living dwarf's tile (`readers.of('10').list()` through the movement helper). */
  dwarves(): { id: number; x: number; y: number; z: number }[];
  submit(command: Command): void;
  setSpeed(speed: Speed): void;
  step(ticks: number): void;
  screenshotName(name: string): string;
  key(key: string, shift?: boolean): void;
  /** The world hash of the running game (`simulation-core.md` § Determinism), or '' before one. */
  hash(): string;
  /** The id of the last save written or loaded (T-M2-11). */
  lastSaveId(): string | null;
  /** Resolves when the app's pending saves are stored. */
  settled(): Promise<void>;
}

/**
 * The readers the harness sees: the world's own core readers plus `ui`, which is the presentation
 * state of `schemas/system-state.md` § UiState and belongs to no system (DECISIONS.md D-033), and
 * `world`, the generated world's reader when there is one (it lives outside the tick loop, `01`).
 */
export interface HookReaders {
  readonly map: InProcessHost['readers']['map'];
  readonly entities: InProcessHost['readers']['entities'];
  readonly calendar: InProcessHost['readers']['calendar'];
  readonly fortress: InProcessHost['readers']['fortress'];
  readonly ui: Readonly<UiState>;
  readonly world: WorldgenReader | null;
  /** `readers.items` of `module-interfaces.md`: 13's reader (T-M2-08). */
  readonly items: ItemsReader;
  /** 14's reader. */
  readonly buildings: BuildingsReader;
  of<T>(id: string): T;
}

/** Build the test hook for a game. Installed on `window` only in test builds. */
export function testHook(game: Game): TestHook {
  return {
    host: game.host,
    readers: {
      get map() {
        return game.host.readers.map;
      },
      get entities() {
        return game.host.readers.entities;
      },
      get calendar() {
        return game.host.readers.calendar;
      },
      get fortress() {
        return game.host.readers.fortress;
      },
      get ui() {
        return game.ui;
      },
      get world() {
        return game.worldReader();
      },
      get items() {
        return game.host.readers.of<ItemsReader>('13');
      },
      get buildings() {
        return game.host.readers.of<BuildingsReader>('14');
      },
      of<T>(id: string): T {
        return game.host.readers.of<T>(id);
      },
    },
    cells: () => {
      const buffer = game.cellBuffer();
      if (buffer === null) return { cols: 0, rows: 0, glyph: [], fg: [], bg: [] };
      return {
        cols: buffer.cols,
        rows: buffer.rows,
        glyph: Array.from(buffer.glyph),
        fg: Array.from(buffer.fg),
        bg: Array.from(buffer.bg),
      };
    },
    text: () => game.textRows(),
    screen: () => game.screen,
    cellCenter: (col, row) => game.cellCenter(col, row),
    dwarves: () => {
      if (!game.host.started) return [];
      const headless = game.host.headless;
      const map = headless.map;
      const ids = game.host.readers.of<{ list(): number[] }>('10').list();
      return ids.map((id) => {
        const i = headless.movement.tileOf(id);
        const x = i % map.w;
        const y = Math.floor(i / map.w) % map.h;
        const z = Math.floor(i / (map.w * map.h));
        return { id, x, y, z };
      });
    },
    submit: (command) => game.host.submit(command),
    setSpeed: (speed) => game.host.setSpeed(speed),
    step: (ticks) => {
      game.host.step(ticks);
      game.render();
    },
    screenshotName: (name) => `reports/screenshots/${name}.png`,
    key: (key, shift = false) => {
      game.handleKey({ key, repeat: false, shift, ctrl: false, alt: false, meta: false });
    },
    hash: () => (game.host.started ? game.host.headless.hash() : ''),
    lastSaveId: () => game.lastSaveId,
    settled: () => game.settled(),
  };
}

export interface BootOptions {
  readonly canvasId?: string;
  readonly seed?: string;
  readonly scheduler?: FrameScheduler;
}

/**
 * Wire the platform to the game and start the frame loop on the main menu. `main.ts` calls this;
 * the e2e harness reads `window.__deepholm`, which exists only when the build mode is `test`
 * (`01-testing-strategy.md` § E2E harness). In a test build, `?start=flat-test` opens the
 * `flat-test` fortress directly, the M0 start the `boot` test was written against (D-061).
 */
export async function boot(options: BootOptions = {}): Promise<Game> {
  const element = document.getElementById(options.canvasId ?? 'screen');
  if (element === null) throw new Error('boot: no canvas element');
  const canvas = element as unknown as CanvasLike;
  const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  const game = new Game({
    canvas,
    seed: options.seed ?? 'deepholm',
    createCanvas: domCanvasFactory(document),
    devicePixelRatio: dpr,
    width: window.innerWidth,
    height: window.innerHeight,
    saves: new SaveManager(createStorage()),
    files: browserFiles(document),
  });
  const testBuild = import.meta.env.MODE === 'test';
  const start = testBuild ? new URLSearchParams(window.location.search).get('start') : null;
  if (start === 'flat-test') await game.start({ seed: options.seed ?? 'deepholm' });
  else await game.showMainMenu();

  const local = (x: number, y: number): { x: number; y: number } => {
    const rect = element.getBoundingClientRect();
    return { x: x - rect.left, y: y - rect.top };
  };
  const input = new InputSource(
    window as unknown as EventTargetLike,
    element as unknown as EventTargetLike,
    {
      onKey: (key) => void game.handleKey(key),
      onPointerDown: (p) => game.pointerDown(p),
      onPointerMove: (p) => game.pointerMove(p),
      onPointerUp: (p) => game.pointerUp(p),
      onWheel: (w) => game.wheel(w),
    },
    { toLocal: local },
  );
  input.attach();
  // Right click belongs to the game (24 § Input model), not to the browser's context menu.
  element.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('resize', () => {
    game.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    game.render();
  });

  const loop = new FrameLoop({
    scheduler: options.scheduler ?? browserFrameScheduler(),
    hidden: browserHidden(),
  });
  loop.start((nowMs, hidden) => game.driver.onFrame(nowMs, hidden));

  if (testBuild) {
    (window as unknown as { __deepholm: TestHook }).__deepholm = testHook(game);
  }
  return game;
}

/** The Load screen row of a stored save's header. */
export function listingOf(id: string, header: SaveHeader): SaveListing {
  return {
    id,
    kind: header.kind,
    fortress: header.fortress,
    tick: header.calendar.tick,
    population: header.population,
    wealth: header.wealth,
    ...(header.thumbnail === undefined ? {} : { thumbnail: header.thumbnail }),
  };
}
