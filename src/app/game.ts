/**
 * The game: the screen stack, the view state and the wiring of host, compositor and renderer.
 *
 * Implements `01-architecture/simulation-core.md` § Startup sequence and § The frame loop (through
 * `sim-host.ts`), `02-systems/23-rendering.md` § Viewport and camera (clamping, "Changing `z`
 * keeps `camX, camY`") and the map keys of `02-systems/24-ui-and-input.md` § Input model:
 * "arrow keys pan by one cell, `Shift` + arrows by ten; `<` and `>` (also `,` and `.`) z-level
 * down and up".
 *
 * The screen stack holds only `fortress` in M0; the main menu, world map and embark screens are
 * T-M1-12 and T-M1-13, and the panels, tools and status bar are T-M1-14.
 */

import { CanvasSurface, domCanvasFactory, type CanvasFactory, type CanvasLike } from '@platform/canvas';
import { InputSource, type EventTargetLike, type KeyPress } from '@platform/input';
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
import { computeViewport, type CellBuffer } from '@render/cellbuffer';
import { FrameDriver, InProcessHost, type Speed } from '@app/sim-host';
import type { Command } from '@core/commands';
import type { Registry } from '@core/registry';

/** The screens of 24 § Screens outside the fortress; M0 registers only the fortress. */
export type ScreenId = 'fortress';

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
}

/** The z-level the fortress screen opens on: the `flat-test` surface. */
const START_Z = 32;

export class Game {
  readonly host = new InProcessHost();
  readonly seed: string;
  readonly registry: Registry;
  readonly palette: Palette;
  readonly atlas: GlyphAtlas;
  readonly compositor: Compositor;
  readonly renderer: Renderer;
  readonly surface: CanvasSurface;
  readonly driver: FrameDriver;
  readonly ui: UiState = {
    camX: 0,
    camY: 0,
    z: START_Z,
    zoom: 1,
    panel: null,
    overlays: ['designations', 'zones'],
    cursor: null,
  };

  private readonly screens: ScreenId[] = ['fortress'];
  private cols = 0;
  private rows = 0;
  private cells: CellBuffer | null = null;

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
    this.renderer = new Renderer({ surface: this.surface, atlas: this.atlas, palette: this.palette });
    this.driver = new FrameDriver({ host: this.host, render: () => this.render() });
    this.resize(options.width, options.height, options.devicePixelRatio ?? 1);
  }

  /** The screen on top of the stack. */
  get screen(): ScreenId {
    return this.screens[this.screens.length - 1] as ScreenId;
  }

  pushScreen(screen: ScreenId): void {
    this.screens.push(screen);
  }

  popScreen(): void {
    if (this.screens.length > 1) this.screens.pop();
  }

  /** `simulation-core.md` § Startup sequence steps 3 to 5. */
  async start(spec: { seed?: string } = {}): Promise<void> {
    await this.host.newGame({ seed: spec.seed ?? this.seed });
    this.centerOnMap();
    this.render();
  }

  /** Fit the grid to the canvas and rebuild the atlas when the cell size changed. */
  resize(cssWidth: number, cssHeight: number, dpr = this.surface.pixelRatio): void {
    const fit = computeViewport(cssWidth * dpr, cssHeight * dpr, this.ui.zoom);
    this.surface.resize(cssWidth, cssHeight, dpr, fit.cssScale);
    this.cols = fit.cols;
    this.rows = fit.rows;
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

  /** Compose and draw one frame. */
  render(): void {
    if (!this.host.started) return;
    const view: ViewState = {
      camX: this.ui.camX,
      camY: this.ui.camY,
      z: this.ui.z,
      sidebarOpen: this.ui.panel !== null,
      cursor: this.ui.cursor,
    };
    this.cells = this.compositor.compose(this.host.readers, view, this.cols, this.rows);
    this.renderer.draw(this.cells);
  }

  /**
   * The map keys of 24 § Input model. Returns whether the key was consumed, so the screens that
   * arrive in M1 can take what is left.
   */
  handleKey(key: KeyPress): boolean {
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
  submit(command: Command): void;
  setSpeed(speed: Speed): void;
  step(ticks: number): void;
  screenshotName(name: string): string;
  key(key: string, shift?: boolean): void;
}

/**
 * The readers the harness sees: the world's own core readers plus `ui`, which is the presentation
 * state of `schemas/system-state.md` § UiState and belongs to no system. See DECISIONS.md D-033.
 */
export interface HookReaders {
  readonly map: InProcessHost['readers']['map'];
  readonly entities: InProcessHost['readers']['entities'];
  readonly calendar: InProcessHost['readers']['calendar'];
  readonly fortress: InProcessHost['readers']['fortress'];
  readonly ui: Readonly<UiState>;
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
 * Wire the platform to the game and start the frame loop. `main.ts` calls this; the e2e harness
 * reads `window.__deepholm`, which exists only when the build mode is `test`
 * (`01-testing-strategy.md` § E2E harness).
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
  });
  await game.start({ seed: options.seed ?? 'deepholm' });

  const input = new InputSource(
    window as unknown as EventTargetLike,
    element as unknown as EventTargetLike,
    { onKey: (key) => void game.handleKey(key) },
  );
  input.attach();
  window.addEventListener('resize', () => {
    game.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    game.render();
  });

  const loop = new FrameLoop({
    scheduler: options.scheduler ?? browserFrameScheduler(),
    hidden: browserHidden(),
  });
  loop.start((nowMs, hidden) => game.driver.onFrame(nowMs, hidden));

  if (import.meta.env.MODE === 'test') {
    (window as unknown as { __deepholm: TestHook }).__deepholm = testHook(game);
  }
  return game;
}
