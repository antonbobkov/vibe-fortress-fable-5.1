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

import { CanvasSurface, domCanvasFactory, type CanvasFactory, type CanvasLike } from '@platform/canvas';
import { InputSource, type EventTargetLike, type KeyPress, type PointerAction, type WheelAction } from '@platform/input';
import {
  FrameLoop,
  browserFrameScheduler,
  browserHidden,
  type FrameScheduler,
} from '@platform/realtime';
import { contentRegistry } from '@content/loader';
import { LOCAL_MAP_Z } from '@core/constants';
import { Compositor, type ViewState } from '@render/compositor';
import { GlyphAtlas, glyphChars } from '@render/atlas';
import { Palette } from '@render/palette';
import { Renderer } from '@render/renderer';
import { CellBuffer, computeViewport } from '@render/cellbuffer';
import { WorldMapCompositor } from '@render/world-map';
import { FrameDriver, InProcessHost, type Speed } from '@app/sim-host';
import { SaveManager } from '@app/save-manager';
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

export type { ScreenId } from '@ui/screen';

/** `schemas/system-state.md` § UiState, with the M0 fields. */
export interface UiState {
  camX: number;
  camY: number;
  z: number;
  zoom: number;
  panel: string | null;
  overlays: string[];
  cursor: { x: number; y: number } | null;
}

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
}

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
  readonly atlas: GlyphAtlas;
  readonly compositor: Compositor;
  readonly worldMapCompositor: WorldMapCompositor;
  readonly renderer: Renderer;
  readonly surface: CanvasSurface;
  readonly driver: FrameDriver;
  readonly keymap: Keymap;
  readonly strings: Strings;
  readonly glyphs: GlyphMap;
  readonly theme: Theme;
  readonly ui: UiState = {
    camX: 0,
    camY: 0,
    z: START_Z,
    zoom: 1,
    panel: null,
    overlays: ['designations', 'zones'],
    cursor: null,
  };

  private readonly stack: StackEntry[] = [FORTRESS];
  private cols = 0;
  private rows = 0;
  private cssScale = 1;
  private cells: CellBuffer | null = null;
  private screenBuffer: CellBuffer | null = null;
  private lastSurface: Surface | null = null;
  private readonly saves: SaveManager | null;
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
    this.randomSeed = options.randomSeed ?? defaultRandomSeed;
    this.resize(options.width, options.height, options.devicePixelRatio ?? 1);
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
  async start(spec: { seed?: string } = {}): Promise<void> {
    await this.host.newGame({ seed: spec.seed ?? this.seed });
    this.resetTo(FORTRESS);
    this.centerOnMap();
    this.render();
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
        // Loading a save is T-M2-11's; until then Continue is never shown (no save can exist).
        continueGame: () => {},
        available: () => false,
        open: () => {},
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
          embark: (w, regionId) => void this.embarkRegion(w, regionId),
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

  /**
   * `Embark` on a region: the local map from its `LocalMapSpec` (03) and 02's arrival with the
   * Balanced preset; the embark screen that chooses the party is T-M1-13. Arrival step 8: "The app
   * switches to the fortress screen, paused, centered on the wagon at the surface z-level".
   */
  async embarkRegion(world: WorldMap, regionId: number): Promise<void> {
    await this.working(this.strings.get('ui.busy.site'));
    try {
      const spec = localMapSpec(world, regionId, this.registry);
      await this.host.newGame({ seed: world.seed, world: 'local', spec, embark: 'default', worldMap: world });
    } finally {
      this.busy = null;
    }
    this.enterFortress();
  }

  /** Switch to the fortress screen, paused, centered on the wagon (arrival step 8). */
  enterFortress(): void {
    this.busy = null;
    this.resetTo(FORTRESS);
    this.host.setSpeed(0);
    const arrival = this.host.headless.arrival;
    if (arrival === null) this.centerOnMap();
    else this.centerOn(arrival.wagon.x, arrival.wagon.y, arrival.wagon.z);
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
    if (fit.cellPx !== this.atlas.cellPx) this.atlas.clear();
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
      sidebarOpen: this.ui.panel !== null,
      cursor: this.ui.cursor,
    };
    this.cells = this.compositor.compose(this.host.readers, view, this.cols, this.rows);
    this.lastSurface = null;
    this.renderer.draw(this.cells);
  }

  // ---------- input ----------

  /**
   * A key press, routed to the screen on top. For the fortress: the map keys of 24 § Input model.
   * Returns whether the key was consumed.
   */
  handleKey(key: KeyPress): boolean {
    if (this.busy !== null) return false;
    const top = this.top();
    if (top !== FORTRESS) {
      const used = top.key(key);
      this.render();
      return used;
    }
    const step = key.shift ? 10 : 1;
    switch (key.key) {
      case '←':
        return this.pan(-step, 0);
      case '→':
        return this.pan(step, 0);
      case '↑':
        return this.pan(0, -step);
      case '↓':
        return this.pan(0, step);
      case '<':
      case ',':
        return this.changeZ(-1);
      case '>':
      case '.':
        return this.changeZ(1);
      default:
        return false;
    }
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
    const top = this.top();
    if (top !== FORTRESS) top.pointerDown?.(this.cellPointer(action));
    this.render();
  }

  pointerMove(action: PointerAction): void {
    if (this.busy !== null) return;
    const top = this.top();
    if (top !== FORTRESS && top.pointerMove !== undefined) {
      top.pointerMove(this.cellPointer(action));
      this.render();
    }
  }

  pointerUp(action: PointerAction): void {
    if (this.busy !== null) return;
    const top = this.top();
    if (top !== FORTRESS && top.pointerUp !== undefined) {
      top.pointerUp(this.cellPointer(action));
      this.render();
    }
  }

  wheel(action: WheelAction): void {
    if (this.busy !== null) return;
    const top = this.top();
    if (top !== FORTRESS && top.wheel !== undefined) {
      const at = this.cellAt(action.x, action.y);
      top.wheel({ ...at, dy: action.dy, shift: action.shift, ctrl: action.ctrl, alt: action.alt, meta: action.meta });
      this.render();
    }
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
  submit(command: Command): void;
  setSpeed(speed: Speed): void;
  step(ticks: number): void;
  screenshotName(name: string): string;
  key(key: string, shift?: boolean): void;
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
