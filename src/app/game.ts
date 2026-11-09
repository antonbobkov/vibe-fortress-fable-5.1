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
import { InputSource, swallowedByDefault, type EventTargetLike, type KeyPress, type PointerAction, type WheelAction } from '@platform/input';
import {
  FrameLoop,
  browserFrameScheduler,
  browserHidden,
  browserNow,
  type FrameScheduler,
} from '@platform/realtime';
import { contentRegistry } from '@content/loader';
import { formatDate, SEASON_NAMES, seasonOf } from '@core/calendar';
import { FORTRESS_NAME_MAX_CHARS, LOCAL_MAP_Z, WORLD_SIZE_STANDARD, ZOOM_LEVELS } from '@core/constants';
import { Compositor, type ViewState } from '@render/compositor';
import { GlyphAtlas, glyphChars } from '@render/atlas';
import { Palette } from '@render/palette';
import { Renderer } from '@render/renderer';
import { autoZoom, CellBuffer, computeViewport } from '@render/cellbuffer';
import { WorldMapCompositor } from '@render/world-map';
import { FrameDriver, InProcessHost, type NewGameSpec, type Speed } from '@app/sim-host';
import {
  SaveManager,
  autoSaveId,
  exportFileName,
  manualSaveId,
  slugify,
  newestManualId,
  readSaveHeader,
  rollAutosaves,
  rollSnapshots,
  SNAPSHOTS_KEPT,
  finalSaveId,
  type SaveHeader,
  type SaveKind,
  type SaveThumbnail,
} from '@app/save-manager';
import { validateImport, SaveLoadError, type LoadedGame } from '@app/game-save';
import { browserFiles, type FileBridge } from '@platform/files';
import { bytesToBase64 } from '@core/serialize';
import { SIM_TICKS_PER_SECOND, STATUS_ROWS } from '@core/constants';
import { BUNDLED_FONT_FAMILY, FLUID_ANIM_MS, LOG_ROWS } from '@render/constants';
import { ConfirmScreen } from '@ui/screens/confirm';
import { LoadScreen, type SaveListing } from '@ui/screens/load';
import { TradeSessionScreen } from '@ui/screens/trade_session';
import { LaborManagerScreen, type LaborManagerOpen } from '@ui/screens/labor_manager';
import { TextInputScreen, type TextInputSpec } from '@ui/screens/text_input';
import { SettingsScreen } from '@ui/screens/settings';
import { LegendScreen } from '@ui/screens/legend';
import { GameMenuScreen } from '@ui/screens/game_menu';
import { composeLegend, LegendStore, type EndReason } from '@app/legend';
import type { LegendReader } from '@systems/legend';
import { SettingsStore } from '@app/settings-store';
import { Music, type MusicScene } from '@ui/music';
import { MUSIC_REVERB_S, MUSIC_SUSPEND_DELAY_S, TUTORIAL_CHECK_MS, TUTORIAL_WORLD_SEED } from '@ui/constants';
import { readTutorialFacts, Tutorial, tutorialRegion, type TutorialStep } from '@ui/tutorial';
import { AudioGate, browserAudioContext } from '@platform/audio';
import type { CombatReader } from '@systems/combat';
import type { ThreatsReader } from '@systems/threats';
import { DEFAULT_USER_SETTINGS, type UserSettings } from '@ui/settings';
import type { TradeReader } from '@systems/trade';
import { createStorage, StorageQuotaError } from '@platform/storage';
import type { Command } from '@core/commands';
import { EventListeners, type EventListener, type Unsubscribe } from '@core/events';
import type { Registry } from '@core/registry';
import { localMapSpec } from '@systems/embark';
import { generate, worldGeneratedEvent, worldReader, type WorldMap, type WorldgenReader, type WorldgenStage } from '@systems/worldgen';
import { Keymap, type KeymapRow } from '@ui/keymap';
import { Strings } from '@ui/strings';
import { GlyphMap, Surface, themeOf, type Theme } from '@ui/surface';
import type { CellPointer, Screen, ScreenId } from '@ui/screen';
import { MainMenuScreen } from '@ui/screens/main_menu';
import { IntroScreen, hallFilm } from '@ui/screens/intro';
import { deepFilm } from '@ui/screens/intro_deep';
import type { DeepIntroDef, IntroDef } from '@content/schema';
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
  readonly settingsStore?: SettingsStore;
  readonly legends?: LegendStore;
  /** Where the music's pieces start and its silences come from; `Math.random` by default. */
  readonly musicRandom?: () => number;
  /** Draw as with Reduced motion whatever the setting says: the test build (e2e and screenshots, 23 § Animation). */
  readonly reducedMotion?: boolean;
  /**
   * Offer the tutorial on the first `New world` (`ui-screens/menus-and-world.md` § Main menu): the
   * app does; a test build only with `?tutorial=offer`, and the unit tests when they ask.
   */
  readonly offerTutorial?: boolean;
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
  /** A test build draws as with Reduced motion (23 § Animation). */
  private readonly forceReducedMotion: boolean;
  readonly strings: Strings;
  readonly glyphs: GlyphMap;
  theme: Theme;
  readonly userSettings: UserSettings = { ...DEFAULT_USER_SETTINGS };
  private readonly settingsStore: SettingsStore | null;
  private readonly legends: LegendStore | null;
  readonly ui: UiState = defaultUiState(START_Z);
  /** The fortress screen's tools, panels, log and status bar (T-M1-14). */
  readonly fortress: FortressScreen;
  /** The music (24 § Music): it follows the events always, and plays once {@link boot} gives it an output. */
  readonly music: Music;
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
  /** A fortress death is checked once after its event tick, when removals are complete. */
  private lastDwarfDeath: { name: string; cause: string } | null = null;
  private finished = false;
  private menuSpeed: Speed = 0;
  /** The Load screen's list, refreshed from the headers after every change. */
  private listing: SaveListing[] = [];
  /** The last save written or loaded, for the tests and the e2e hook. */
  lastSaveId: string | null = null;
  /** The line the last save wrote to the log, for the game menu to show; read once. */
  private lastSavedLine: string | null = null;
  /** The world tick of the last save of the running fortress (24 § Game menu's unsaved check). */
  lastSaveTick: number | null = null;
  /** The host's applied-command count at the last save; not saved (T-118). */
  private lastSaveCommands = 0;
  private pending: Promise<void> = Promise.resolve();
  private readonly randomSeed: () => string;
  private newest: string | null = null;
  /** A message drawn over a blank screen while the app works synchronously. */
  private busy: string | null = null;
  /** The running tutorial (`ui-screens/menus-and-world.md` § Tutorial); presentation only, never saved. */
  private tutorial: Tutorial | null = null;
  /** The wall-clock time of the tutorial's last check, and whether a key or click has come since. */
  private tutorialCheckedAt = -Infinity;
  private tutorialInput = false;
  /** Manual and quick saves written in this session, for the tutorial's `saved` check. */
  private manualSaves = 0;
  private readonly offerTutorial: boolean;

  constructor(options: GameOptions) {
    this.forceReducedMotion = options.reducedMotion === true;
    this.offerTutorial = options.offerTutorial === true;
    this.userSettings.colorblind = options.colorblind === true;
    this.seed = options.seed;
    this.registry = options.registry ?? contentRegistry();
    this.palette = new Palette(this.registry, { colorblind: options.colorblind === true });
    this.surface = new CanvasSurface(options.canvas, {
      ...(options.devicePixelRatio === undefined
        ? {}
        : { devicePixelRatio: options.devicePixelRatio }),
    });
    const widthPx = options.width * (options.devicePixelRatio ?? 1);
    const heightPx = options.height * (options.devicePixelRatio ?? 1);
    const fit = computeViewport(widthPx, heightPx, this.requestedZoom(widthPx, heightPx));
    this.ui.zoom = fit.zoom;
    this.atlas = new GlyphAtlas({
      cellPx: fit.cellPx,
      chars: glyphChars(this.registry),
      createCanvas: options.createCanvas,
      fontFamily: BUNDLED_FONT_FAMILY,
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
    this.settingsStore = options.settingsStore ?? null;
    this.legends = options.legends ?? null;
    this.files = options.files ?? null;
    this.host.afterTick = () => { this.takeAutosave(); this.checkHallEnd(); };
    this.randomSeed = options.randomSeed ?? defaultRandomSeed;
    this.createCanvas = options.createCanvas;
    this.fortress = new FortressScreen(this.fortressHost(), this.keymap, this.strings);
    this.music = new Music(this.registry, options.musicRandom ?? Math.random);
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
      get loadSheddingActive() { return host.loadSheddingActive; },
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
      toggleMusic: () => this.toggleMusic(),
      gameMenu: () => this.openGameMenu(),
      saveMenu: () => this.openGameMenu('save'),
      debug: {
        stats: () => this.host.stats(),
        seed: () => (this.host.started ? this.host.world.seed : ''),
        dumpSave: () => void this.dumpSave(),
        replaySeasonLog: () => this.exportSeasonLog(),
        hashWorld: () => this.noteWorldHash(),
      },
      confirm: (id, params, answer) => this.confirm(id, params as Readonly<Record<string, string | number>>, answer),
      laborManager: (open) => this.openLaborManager(open),
      prompt: (spec, answer) => this.prompt(spec, answer),
    };
  }

  /**
   * `ui-screens/panels.md` § Debug `dump save`: the running game's container, offered as a file
   * without storing it as a save.
   */
  private async dumpSave(): Promise<void> {
    const files = this.files;
    if (files === null || !this.host.started) return;
    const blob = await this.host.save({ kind: 'manual', ui: this.uiSection(), playTimeSeconds: this.playTimeSeconds(), thumbnail: this.thumbnail() });
    const calendar = this.host.readers.calendar;
    files.download(exportFileName(this.host.world.fortress.name, calendar.year, calendar.season), blob);
  }

  /**
   * § Debug `replay season log`; `tooling.md` § Debug and replay: "A season's command log can be
   * exported from the debug panel and replayed headless".
   */
  private exportSeasonLog(): void {
    const files = this.files;
    if (files === null || !this.host.started) return;
    const log = this.host.world.commandLog.serialize();
    const bytes = new TextEncoder().encode(JSON.stringify(log));
    files.download(`${slugify(this.host.world.fortress.name)}-season-log.json`, bytes);
    this.note('note', this.strings.get('ui.debug.log_exported', { n: log.length }));
  }

  /** § Debug `hash world`: the world hash of `simulation-core.md` § Determinism, in the log. */
  private noteWorldHash(): void {
    if (!this.host.started) return;
    this.note('note', this.strings.get('ui.debug.hash', { hash: this.host.headless.hash() }));
    this.render();
  }

  /** Subscribe the fortress screen to the running world's events (24 § Events consumed). */
  private subscribe(): void {
    this.unsubscribe?.();
    this.lastDwarfDeath = null;
    this.finished = false;
    this.music.watch.reset(this.tenseState());
    this.unsubscribe = this.host.onEvents((events) => {
      this.fortress.onEvents(events);
      this.music.onEvents(events);
      this.compositor.onEvents(events, Math.floor(Date.now() / FLUID_ANIM_MS));
      // `persistence.md` § Autosave: "On every `SeasonChanged`, the app saves". The world is in the
      // middle of its tick here, so the save waits for the tick to end (D-083).
      for (const e of events) {
        if (e.type === 'SeasonChanged') this.autosaveDue = { year: e['year'] as number, season: e['season'] as number };
        if (e.type === 'CreatureDied' && e['faction'] === 'fortress') {
          this.lastDwarfDeath = { name: String(e['name'] ?? 'Unknown'), cause: String(e['cause'] ?? 'wounds') };
        }
      }
    });
  }

  // ---------- music (24 § Music) ----------

  /** The danger the music follows, as the world has it now: the hearth alert and the sieges on the map. */
  private tenseState(): { hearth: boolean; sieges: number[] } {
    const readers = this.host.readers;
    const hearth = readers.has('16') && readers.of<CombatReader>('16').alert() === 'hearth';
    const threats = readers.has('18') ? readers.of<ThreatsReader>('18') : null;
    const sieges = threats === null ? [] : threats.activeParties().filter((id) => threats.party(id)?.purpose === 'siege');
    return { hearth, sieges: [...sieges] };
  }

  /** The intro, the screens before a fortress, or a fortress and the screens over it. */
  get musicScene(): MusicScene {
    if (this.top() instanceof IntroScreen) return 'intro';
    return this.stack[0] === FORTRESS && this.host.started ? 'fortress' : 'menu';
  }

  /** Once a frame: the music chooses and plays (nothing without an audio output). */
  updateMusic(): void {
    this.music.update(this.musicScene, this.userSettings);
  }

  /** The mute key: music on or off, saved with the settings. */
  toggleMusic(): void {
    const on = !this.userSettings.music;
    if (this.top() === FORTRESS && this.host.started) this.fortress.notice(this.strings.get(on ? 'ui.music.on' : 'ui.music.off'));
    this.changeSettings({ music: on });
  }

  // ---------- saving and loading (T-M2-11) ----------

  /** Resolves when saving and loading operations the app started are complete. */
  settled(): Promise<void> {
    return this.pending;
  }

  private isQuotaError(error: unknown): boolean {
    if (error instanceof StorageQuotaError) return true;
    if (error instanceof Error) {
      return error.name === 'StorageQuotaError' || error.name === 'QuotaExceededError' || /quota/i.test(error.message);
    }
    return false;
  }

  private handleQuotaError(blob?: Uint8Array | Promise<Uint8Array>): void {
    this.note('danger', this.strings.get('ui.save.quota'));
    const files = this.files;
    if (files === null || !this.host.started) return;
    const calendar = this.host.readers.calendar;
    const name = exportFileName(this.host.world.fortress.name, calendar.year, calendar.season);
    if (blob !== undefined) {
      void Promise.resolve(blob).then((data) => files.download(name, data));
    } else {
      void this.dumpSave();
    }
  }

  private track(work: Promise<void>): Promise<void> {
    const next = this.pending
      .then(() => work)
      .catch((error: unknown) => {
        if (this.isQuotaError(error)) {
          this.handleQuotaError();
        } else {
          this.note('danger', this.strings.get('ui.save.failed', { reason: error instanceof Error ? error.message : String(error) }));
        }
      });
    this.pending = next;
    return next;
  }

  /** Preferences are separate from saves so a page reload keeps keys and accessibility choices. */
  async loadSettings(): Promise<void> {
    const stored = await this.settingsStore?.load();
    if (!stored) return;
    this.keymap.loadOverrides(stored.keymapOverrides);
    this.applySettings(stored.preferences);
  }

  private persistSettings(): void {
    const store = this.settingsStore;
    if (!store) return;
    const preferences = { ...this.userSettings };
    const overrides = this.keymap.overrides();
    this.pending = this.pending.then(() => store.save(preferences, overrides)).catch((error: unknown) => {
      if (this.isQuotaError(error)) {
        this.handleQuotaError();
      } else {
        this.note('danger', this.strings.get('ui.save.failed', { reason: error instanceof Error ? error.message : String(error) }));
      }
    });
  }

  private applySettings(settings: UserSettings): void {
    const zoomBefore = this.userSettings.zoom;
    Object.assign(this.userSettings, settings);
    this.fortress.settings.autoPauseDanger = settings.autoPauseDanger;
    this.fortress.settings.autoPauseAlert = settings.autoPauseAlert;
    this.fortress.settings.hintsEnabled = settings.hints;
    this.fortress.settings.edgeScrolling = settings.edgeScrolling;
    this.fortress.settings.combatLog = settings.combatLog;
    this.palette.setColorblind(settings.colorblind);
    this.theme = themeOf(this.palette);
    if (zoomBefore !== settings.zoom) this.resize(this.surface.cssWidth, this.surface.cssHeight);
  }

  changeSettings(patch: Partial<UserSettings>): void {
    this.applySettings({ ...this.userSettings, ...patch });
    this.persistSettings();
    this.render();
  }

  resetSettings(): void {
    this.keymap.reset();
    // Whether the intro has played, or the tutorial been offered, is not a preference: a reset keeps it.
    this.applySettings({ ...DEFAULT_USER_SETTINGS, introSeen: this.userSettings.introSeen, tutorialOffered: this.userSettings.tutorialOffered });
    this.persistSettings();
    this.render();
  }

  openSettings(): void {
    this.pushScreen(new SettingsScreen({
      keymap: this.keymap,
      strings: this.strings,
      settings: () => this.userSettings,
      zoomView: () => ({
        requested: this.requestedZoom(this.surface.cssWidth * this.surface.pixelRatio, this.surface.cssHeight * this.surface.pixelRatio),
        shown: this.ui.zoom,
      }),
      change: (patch) => this.changeSettings(patch),
      bindingsChanged: () => this.persistSettings(),
      resetDefaults: () => this.resetSettings(),
      back: () => { this.popScreen(); this.render(); },
    }));
    this.render();
  }

  /** Open the Esc menu after the fortress has dismissed its current tool and panel. */
  openGameMenu(selected = 'resume'): void {
    if (!this.host.started || this.top() !== FORTRESS) return;
    this.menuSpeed = this.host.speed();
    this.host.setSpeed(0);
    const menu: GameMenuScreen = new GameMenuScreen({
      fortressName: () => (this.host.started ? this.host.world.fortress.name : ''),
      resume: () => {
        this.popScreen();
        this.host.setSpeed(this.menuSpeed);
        this.render();
      },
      save: () => {
        this.lastSavedLine = null;
        void this.quickSave().then(() => {
          const text = this.lastSavedLine;
          this.lastSavedLine = null;
          if (text !== null) { menu.flash(text); this.render(); }
        });
      },
      load: () => void this.openLoad(),
      settings: () => this.openSettings(),
      rename: () => this.renameFortress(),
      retire: () => this.retireFortress(),
      mainMenu: () => this.leaveToMainMenu(),
      viewOnly: () => this.host.viewOnly,
      now: () => Date.now(),
    }, this.strings);
    if (menu.items().some((item) => item.id === selected && item.enabled !== false)) menu.selected = selected;
    this.pushScreen(menu);
    this.render();
  }

  private renameFortress(): void {
    const current = this.host.started ? this.host.world.fortress.name : '';
    this.prompt(
      {
        title: this.strings.get('ui.menu.rename_title', { fortress: current }),
        value: current,
        maxLength: FORTRESS_NAME_MAX_CHARS,
      },
      (name) => {
        if (name !== null) {
          this.host.submit({ type: 'RenameFortress', name });
        }
      },
    );
  }

  /**
   * 24 § Game menu: `Main menu` "(confirm if unsaved changes since the last save)". `{time}` is the
   * date of the last save, or of the embark when the fortress has never been saved (D-200).
   */
  private leaveToMainMenu(): void {
    if (!this.unsavedSince()) {
      void this.showMainMenu();
      return;
    }
    this.confirm('c_main_menu', { time: formatDate(this.savedAtTick()) }, (yes) => {
      if (yes) void this.showMainMenu();
    });
  }

  /** The tick the running fortress was last saved at, or its embark tick. */
  private savedAtTick(): number {
    if (this.lastSaveTick !== null) return this.lastSaveTick;
    return this.host.started ? this.host.readers.fortress.state.embarkTick : 0;
  }

  /**
   * Ticks have run, or commands have been applied, since the last save (or since the embark, when
   * there is none). A command given while paused takes effect without the calendar advancing, so
   * ticks alone would miss it (T-118).
   */
  unsavedSince(): boolean {
    if (!this.host.started) return false;
    if (this.host.commandCount !== this.lastSaveCommands) return true;
    return this.host.readers.calendar.tick > this.savedAtTick();
  }

  private note(severity: 'note' | 'alert' | 'danger', text: string): void {
    if (!this.host.started) return;
    this.fortress.log.append(severity, text, this.host.readers.calendar.tick);
  }

  /** Called after every tick: the autosave and rolling snapshot a `SeasonChanged` asked for. */
  private takeAutosave(): void {
    const due = this.autosaveDue;
    this.autosaveDue = null;
    if (due === null || this.saves === null) return;
    const saves = this.saves;
    if (this.userSettings.autosave) {
      void this.saveAs('auto', autoSaveId(due.year, due.season));
    }
    const keep = this.userSettings.snapshotsKept ?? SNAPSHOTS_KEPT;
    const snapshotPromise = this.host.save({
      kind: 'snapshot',
      ui: this.uiSection(),
      playTimeSeconds: this.playTimeSeconds(),
      thumbnail: this.thumbnail(),
    });
    const savedAt = this.host.readers.calendar.tick;
    const savedCommands = this.host.commandCount;
    void this.track(
      (async (): Promise<void> => {
        const id = await rollSnapshots(saves, keep);
        const blob = await snapshotPromise;
        try {
          await saves.write(id, blob);
        } catch (error) {
          if (this.isQuotaError(error)) {
            this.handleQuotaError(blob);
            return;
          }
          throw error;
        }
        this.lastSaveId = id;
        this.lastSaveTick = savedAt;
        this.lastSaveCommands = savedCommands;
        this.note('note', this.strings.get('ui.save.saved', { fortress: this.host.world.fortress.name, date: formatDate(savedAt) }));
        await this.refreshListing();
      })(),
    );
  }

  /** The hall falls silent only after the final death has been applied and removed. */
  private checkHallEnd(): void {
    const death = this.lastDwarfDeath;
    this.lastDwarfDeath = null;
    if (death === null || this.finished || !this.host.started) return;
    const population = this.host.readers.of<{ population(): number }>('10').population();
    if (population === 0) void this.finishFortress({ kind: 'all_dead', lastName: death.name, lastCause: death.cause });
  }

  /** `RetireFortress`: the c_retire confirmation defaults to No. */
  retireFortress(): void {
    if (!this.host.started || this.finished) return;
    this.confirm('c_retire', { fortress: this.host.world.fortress.name }, (yes) => {
      if (yes) void this.finishFortress({ kind: 'retired' });
    });
  }

  private async finishFortress(reason: EndReason): Promise<void> {
    if (this.finished || !this.host.started) return;
    this.finished = true;
    this.host.setSpeed(0);
    const journal = this.host.readers.of<LegendReader>('24');
    const record = composeLegend(this.host.headless, this.host.worldMap, this.registry, journal, this.fortress.log.lines, reason);
    void this.saveAs('final', finalSaveId(record.name));
    if (this.legends !== null) void this.track(this.legends.write(record));
    this.host.setViewOnly(true);
    this.resetTo(new LegendScreen([record], { back: () => void this.showMainMenu() }, record.id));
    this.render();
    await this.settled();
  }

  async openLegends(): Promise<void> {
    const records = await this.legends?.list() ?? [];
    this.pushScreen(new LegendScreen(records, { back: () => { this.popScreen(); this.render(); } }));
    this.render();
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
    const savedAt = this.host.readers.calendar.tick;
    const savedCommands = this.host.commandCount;
    return this.track(
      (async (): Promise<void> => {
        const data = await blob;
        try {
          await saves.write(id, data);
        } catch (error) {
          if (this.isQuotaError(error)) {
            this.handleQuotaError(data);
            return;
          }
          throw error;
        }
        if (kind === 'auto') await rollAutosaves(saves);
        if (kind === 'manual') {
          this.manualSaves += 1;
          this.tutorialInput = true;
        }
        this.lastSaveId = id;
        this.lastSaveTick = savedAt;
        this.lastSaveCommands = savedCommands;
        this.lastSavedLine = this.strings.get('ui.save.saved', { fortress: this.host.world.fortress.name, date: formatDate(savedAt) });
        this.note('note', this.lastSavedLine);
        await this.refreshListing();
      })(),
    );
  }

  /** `F5` quick save: a manual save (`manual-<unixMs>`). */
  quickSave(): Promise<void> {
    return this.saveAs('manual', manualSaveId(Date.now()));
  }

  /** `F9` quick load, "with confirmation" (`c_quickload`): the newest manual save (D-083). */
  quickLoad(): Promise<void> {
    return this.track(
      (async (): Promise<void> => {
        const id = this.saves === null ? null : await newestManualId(this.saves);
        if (id === null) {
          this.note('note', this.strings.get('ui.save.no_quick'));
          this.fortress.notice(this.strings.get('ui.save.no_quick'));
          this.render();
          return;
        }
        this.confirm('c_quickload', {}, (yes) => {
          if (yes) void this.loadSave(id);
        });
      })(),
    );
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

  /** Push the `text_input` dialog; the answer (null when cancelled) pops it. */
  prompt(spec: TextInputSpec, answer: (text: string | null) => void): void {
    const dialog = new TextInputScreen(spec, this.strings, (text) => {
      if (this.top() === dialog) this.popScreen();
      answer(text);
      this.render();
    });
    this.pushScreen(dialog);
    this.render();
  }

  /**
   * The labor manager over the fortress (`ui-screens/panels.md` § Labor manager, U-06). The
   * simulation keeps its speed under it; its commands apply at the next command phase.
   */
  openLaborManager(open: LaborManagerOpen = {}): void {
    if (!this.host.started || this.top() !== FORTRESS) return;
    const screen = new LaborManagerScreen({
      readers: this.host.readers,
      registry: this.registry,
      strings: this.strings,
      submit: (command) => this.host.submit(command),
      back: () => {
        if (this.top() === screen) this.popScreen();
        this.render();
      },
    }, open);
    this.pushScreen(screen);
    this.render();
  }

  /** Load a stored save and switch to its fortress, paused (`save-format.md` § Load procedure step 6). */
  loadSave(id: string): Promise<void> {
    const saves = this.saves;
    if (saves === null) return Promise.resolve();
    return this.track(
      (async (): Promise<void> => {
        const blob = await saves.read(id);
        if (blob === undefined) {
          // §4.2: a listed save whose data is gone says so.
          this.note('alert', this.strings.get('ui.load.unreadable_save'));
          this.render();
          return;
        }
        try {
          this.enterLoaded(await this.host.load(blob));
          this.lastSaveId = id;
          this.lastSaveTick = this.host.readers.calendar.tick;
          this.lastSaveCommands = 0;
        } catch (error) {
          const reason = error instanceof SaveLoadError ? error.section : error instanceof Error ? error.message : String(error);
          const row = this.listing.find((s) => s.id === id);
          if (row) {
            const at = this.listing.indexOf(row);
            this.listing[at] = { ...row, unreadable: reason };
          }
          this.note('danger', this.strings.get('ui.load.failed', { reason }));
          this.render();
        }
      })(),
    );
  }

  /** The loaded game on screen: its `ui` section restored, the log tail back, paused. */
  enterLoaded(loaded: LoadedGame): void {
    this.fortress.tool.clearHistory();
    this.subscribe();
    this.finished = loaded.header.kind === 'final';
    this.autosaveDue = null;
    this.fortress.log.lines.length = 0;
    if (loaded.ui !== null) {
      this.fortress.log.lines.push(...fromSaved(this.ui, loaded.ui as SavedUiState));
      // The saved zoom is the one that was in effect; the window fits again from the setting.
      this.resize(this.surface.cssWidth, this.surface.cssHeight);
    } else this.fortress.resetHints();
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
        load: (id) => this.loadFromList(id),
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

  /**
   * The Load screen's `Load`. 24 § Confirmations asks for a confirmation when the row is a snapshot
   * (`c_load_snapshot`, "The current game continues to exist as its own saves"); `{season}` is the
   * season the snapshot was taken in.
   */
  private loadFromList(id: string): void {
    const row = this.listing.find((s) => s.id === id);
    if (row === undefined || row.kind !== 'snapshot') {
      void this.loadSave(id);
      return;
    }
    const season = SEASON_NAMES[seasonOf(row.tick)] as string;
    this.confirm('c_load_snapshot', { season }, (yes) => {
      if (yes) void this.loadSave(id);
    });
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
    try {
      await this.importBlob(blob);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.note('alert', this.strings.get('ui.load.import_failed', { reason: message }));
      if (this.top() instanceof LoadScreen) {
        (this.top() as LoadScreen).setMessage(this.strings.get('ui.load.import_failed', { reason: message }));
        this.render();
      }
    }
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
    const requested = this.userSettings.zoom;
    const from = requested === 'auto' ? this.ui.zoom : requested;
    const at = ZOOM_LEVELS.indexOf(from as (typeof ZOOM_LEVELS)[number]);
    const next = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, (at < 0 ? 1 : at) + delta))] as number;
    if (next === from && requested !== 'auto') return;
    if (next === this.ui.zoom && requested === 'auto') return;
    this.userSettings.zoom = next;
    this.persistSettings();
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

  private readonly appEvents = new EventListeners();

  /** Events before a fortress exists, notably 01's completed world generation. */
  onAppEvents(listener: EventListener): Unsubscribe {
    return this.appEvents.add(listener);
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
    if (screen !== FORTRESS) this.fortress.tool.clearHistory();
    // Leaving the fortress, a load or a new game ends the tutorial (§ Tutorial, The end).
    this.tutorial = null;
    this.stack.length = 0;
    this.stack.push(screen);
  }

  /** `simulation-core.md` § Startup sequence steps 3 to 5 for the `flat-test` world. */
  async start(spec: { seed?: string; embark?: NewGameSpec['embark'] } = {}): Promise<void> {
    await this.host.newGame({ seed: spec.seed ?? this.seed, ...(spec.embark === undefined ? {} : { embark: spec.embark }) });
    this.lastSaveCommands = 0;
    this.fortress.tool.clearHistory();
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

  /**
   * Whether the intro plays at this launch (`ui-screens/menus-and-world.md` § Intro): the setting
   * `always`, or `first time` before it has played at a launch. Playing it at launch is saved.
   */
  introAtLaunch(): boolean {
    const settings = this.userSettings;
    const play = settings.intro === 'always' || (settings.intro === 'first time' && !settings.introSeen);
    if (play && !settings.introSeen) {
      settings.introSeen = true;
      this.persistSettings();
    }
    return play;
  }

  /** The intro of the chosen style, over nothing; when it ends or is skipped, the main menu. */
  openIntro(): void {
    const film = this.userSettings.introStyle === 'deep'
      ? deepFilm(this.registry.derived<DeepIntroDef>('deepIntro'), this.strings)
      : hallFilm(this.registry.derived<IntroDef>('intro'), this.strings);
    this.resetTo(new IntroScreen({ now: () => Date.now(), done: () => void this.showMainMenu() }, film));
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
        newWorld: () => this.newWorld(),
        continueGame: () => void this.continueNewest(),
          available: (entry) => (entry === 'load' && this.saves !== null) || (entry === 'legends' && this.legends !== null) || entry === 'settings' || entry === 'intro',
          open: (entry) => {
            if (entry === 'load') void this.openLoad();
            if (entry === 'legends') void this.openLegends();
            if (entry === 'settings') this.openSettings();
            if (entry === 'intro') this.openIntro();
            if (entry === 'tutorial') void this.startTutorial();
        },
      },
      this.keymap,
      this.strings,
    );
  }

  /**
   * `New world`: world generation, after the tutorial has been offered once (`c_tutorial`, default
   * No) when this app offers it (`ui-screens/menus-and-world.md` § Main menu).
   */
  newWorld(): void {
    if (!this.offerTutorial || this.userSettings.tutorialOffered) {
      this.openWorldGen();
      return;
    }
    this.userSettings.tutorialOffered = true;
    this.persistSettings();
    this.confirm('c_tutorial', {}, (yes) => {
      if (yes) void this.startTutorial();
      else this.openWorldGen();
    });
  }

  /**
   * The tutorial (`ui-screens/menus-and-world.md` § Tutorial): the standard world of
   * `TUTORIAL_WORLD_SEED`, an embark with the default preset on the region the rule ranks first,
   * and the tutorial's box over the fortress screen.
   */
  async startTutorial(): Promise<void> {
    await this.working(this.strings.get('ui.busy.tutorial'));
    let world: WorldMap;
    let regionId: number;
    try {
      world = generate(TUTORIAL_WORLD_SEED, WORLD_SIZE_STANDARD, this.registry);
      this.appEvents.deliver([worldGeneratedEvent(world)]);
      regionId = tutorialRegion(world, this.registry);
    } finally {
      this.busy = null;
    }
    await this.embarkRegion(world, regionId);
    this.tutorial = new Tutorial(this.registry.derived<readonly TutorialStep[]>('tutorial'), this.strings, this.keymap);
    this.tutorialInput = true;
    this.render();
  }

  /** The tutorial's step for the tests and the e2e hook, or null when none runs. */
  tutorialState(): { step: string | null; index: number; total: number } | null {
    const t = this.tutorial;
    return t === null ? null : { step: t.step?.id ?? null, index: t.index, total: t.steps.length };
  }

  /** Check the tutorial's step after a key or a click, and every `TUTORIAL_CHECK_MS` otherwise. */
  private checkTutorial(): void {
    const tutorial = this.tutorial;
    if (tutorial === null || !this.host.started) return;
    const now = Date.now();
    if (!this.tutorialInput && now - this.tutorialCheckedAt < TUTORIAL_CHECK_MS) return;
    this.tutorialInput = false;
    this.tutorialCheckedAt = now;
    tutorial.update(readTutorialFacts({
      readers: this.host.readers,
      registry: this.registry,
      camX: this.ui.camX,
      camY: this.ui.camY,
      z: this.ui.z,
      viewCols: this.mapCols(),
      viewRows: this.mapRows(),
      lookTile: this.ui.panel === 'look' && this.ui.sidebar ? this.fortress.lookTile() : null,
      speed: this.host.speed(),
      saves: this.manualSaves,
    }));
  }

  /** The tutorial's keys, before the screen's (`F1` skip, `Shift+F1` end). Returns whether the key was one. */
  private tutorialKey(key: KeyPress): boolean {
    const tutorial = this.tutorial;
    if (tutorial === null || this.top() !== FORTRESS || !this.host.started) return false;
    const id = this.keymap.resolve('global', key)?.id;
    if (id === 'tutorial_skip') tutorial.skip();
    else if (id === 'tutorial_end') tutorial.end();
    else return false;
    if (tutorial.ended) this.tutorial = null;
    this.tutorialInput = true;
    this.render();
    return true;
  }

  openWorldGen(): void {
    this.pushScreen(
      new WorldGenScreen(
        {
          randomSeed: () => this.randomSeed(),
          generate: (seed, size, onProgress) => {
            const world = generate(seed, size, this.registry, {
              onProgress: (stage: WorldgenStage, pct: number) => onProgress(stage, pct),
            });
            this.appEvents.deliver([worldGeneratedEvent(world)]);
            return world;
          },
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
          confirm: (id, params, answer) => this.confirm(id, params, answer),
          now: () => Date.now(),
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
      this.lastSaveCommands = 0;
      this.subscribe();
    } finally {
      this.busy = null;
    }
    this.enterFortress();
  }

  /** Switch to the fortress screen, paused, centered on the wagon (arrival step 8). */
  enterFortress(): void {
    this.fortress.tool.clearHistory();
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

  /** The zoom the setting asks for at a canvas size: its level, or the automatic pick (23 § Canvas and cells). */
  private requestedZoom(widthPx: number, heightPx: number): number {
    const zoom = this.userSettings.zoom;
    return zoom === 'auto' ? autoZoom(widthPx, heightPx) : zoom;
  }

  /** Fit the grid to the canvas and rebuild the atlas when the cell size changed. */
  resize(cssWidth: number, cssHeight: number, dpr = this.surface.pixelRatio): void {
    const fit = computeViewport(cssWidth * dpr, cssHeight * dpr, this.requestedZoom(cssWidth * dpr, cssHeight * dpr));
    this.surface.resize(cssWidth, cssHeight, dpr, fit.cssScale);
    this.cols = fit.cols;
    this.rows = fit.rows;
    this.cssScale = fit.cssScale;
    this.ui.zoom = fit.zoom;
    if (fit.cellPx !== this.atlas.cellPx) {
      // A new cell size needs a new atlas (23 § Atlas: "drawn once per zoom").
      this.atlas = new GlyphAtlas({ cellPx: fit.cellPx, chars: glyphChars(this.registry), createCanvas: this.createCanvas, fontFamily: BUNDLED_FONT_FAMILY });
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
    return new Surface(cells, this.glyphs, this.theme, this.palette).lines();
  }

  /** Compose and draw one frame. */
  render(): void {
    if (this.busy === null && this.host.started && this.top() === FORTRESS && this.host.readers.has('20') && this.host.readers.of<TradeReader>('20').sessionOpen()) {
      this.host.setSpeed(0);
      this.pushScreen(new TradeSessionScreen({
        readers: this.host.readers,
        registry: this.registry,
        submit: (command) => this.host.submit(command),
        commandTick: () => this.host.step(1),
        back: () => this.popScreen(),
        strings: this.strings,
      }));
    }
    const top = this.top();
    if (this.busy !== null || top !== FORTRESS) {
      if (this.screenBuffer === null || this.screenBuffer.cols !== this.cols || this.screenBuffer.rows !== this.rows) {
        this.screenBuffer = new CellBuffer(this.cols, this.rows);
      }
      const buffer = this.screenBuffer;
      buffer.fill(0, this.theme.black, this.theme.black);
      const surface = new Surface(buffer, this.glyphs, this.theme, this.palette);
      if (this.busy !== null) {
        const text = this.busy;
        surface.text(Math.max(0, Math.floor((this.cols - text.length) / 2)), Math.floor(this.rows / 2), text, this.theme.text);
      } else if (top !== FORTRESS) {
        // A caption names each key as the live keymap binds it (24 § Settings).
        const captions = top.captionKeys?.();
        if (captions !== undefined) surface.keyNames = (text, only) => this.keymap.relabel(text, only ?? captions);
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
      selectedZone: this.ui.panel === 'zones' ? this.fortress.zones.selected : 0,
      // 23 § Animation: the presentation clock (`algorithms/compositor.md` `animPhase`).
      animFrame: Math.floor(Date.now() / FLUID_ANIM_MS),
      reducedMotion: this.userSettings.reducedMotion || this.forceReducedMotion,
    };
    const cells = this.compositor.compose(this.host.readers, view, this.cols, this.rows);
    const surface = new Surface(cells, this.glyphs, this.theme, this.palette);
    this.fortress.draw(surface);
    this.checkTutorial();
    this.tutorial?.draw(surface, this.compositor.layout.map, (name) => this.fortress.landmarks.get(name) ?? null);
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
    if (this.tutorialKey(key)) return true;
    const screen = this.inputScreen();
    if (screen === null) return false;
    this.tutorialInput = true;
    // A screen written against its default keys reads a rebound key as the default it replaced;
    // a default key that was moved away does nothing there.
    const contexts = screen.translatedKeys?.() ?? [];
    const press = contexts.length === 0 ? key : this.keymap.translate(contexts, key);
    const used = press === null ? false : screen.key(press);
    // The music key acts on every screen; a screen that uses the key keeps it (24 § Music).
    if (!used && this.keymap.resolve('global', key)?.id === 'music') {
      this.toggleMusic();
      return true;
    }
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
    return { ...at, button: action.button, clicks: action.clicks ?? 1, shift: action.shift, ctrl: action.ctrl, alt: action.alt, meta: action.meta };
  }

  pointerDown(action: PointerAction): void {
    if (this.busy !== null) return;
    const p = this.cellPointer(action);
    this.tutorialInput = true;
    // A press on the tutorial's box is the box's: its buttons act, and the map under it is not touched.
    if (this.tutorial !== null && this.top() === FORTRESS && this.tutorial.press(p.col, p.row, p.button)) {
      if (this.tutorial.ended) this.tutorial = null;
      this.render();
      return;
    }
    this.inputScreen()?.pointerDown?.(p);
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
    this.tutorialInput = true;
    if (screen?.pointerUp === undefined) return;
    screen.pointerUp(this.cellPointer(action));
    this.render();
  }

  wheel(action: WheelAction): void {
    if (this.busy !== null) return;
    const screen = this.inputScreen();
    this.tutorialInput = true;
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

/** What `window.__deepholm` exposes in test builds (`testing-strategy.md` § E2E harness). */
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
  /** The running tutorial's step (`ui-screens/menus-and-world.md` § Tutorial), or null. */
  tutorial(): { step: string | null; index: number; total: number } | null;
}

/**
 * The readers the harness sees: the world's own core readers plus `ui`, which is the presentation
 * state of `schemas/system-state.md` § UiState and belongs to no system (docs/04-implementation/schemas/system-state.md § UiState), and
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
    tutorial: () => game.tutorialState(),
  };
}

export interface BootOptions {
  readonly canvasId?: string;
  readonly seed?: string;
  readonly scheduler?: FrameScheduler;
}

/**
 * Wire the platform to the game and start the frame loop on the intro or the main menu. `main.ts`
 * calls this; the e2e harness reads `window.__deepholm`, which exists only when the build mode is
 * `test` (`testing-strategy.md` § E2E harness). In a test build, `?start=flat-test` opens the
 * `flat-test` fortress directly, the M0 start the `boot` test was written against (D-061), and the
 * intro is skipped at launch unless `?intro=on` lets its setting decide.
 */
export async function boot(options: BootOptions = {}): Promise<Game> {
  const element = document.getElementById(options.canvasId ?? 'screen');
  if (element === null) throw new Error('boot: no canvas element');
  const canvas = element as unknown as CanvasLike;
  const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  const storage = createStorage();
  const testBuild = import.meta.env.MODE === 'test';
  const query = testBuild ? new URLSearchParams(window.location.search) : null;
  const game = new Game({
    canvas,
    seed: options.seed ?? 'deepholm',
    createCanvas: domCanvasFactory(document),
    devicePixelRatio: dpr,
    width: window.innerWidth,
    height: window.innerHeight,
    saves: new SaveManager(storage),
    legends: new LegendStore(storage),
    settingsStore: new SettingsStore(storage),
    files: browserFiles(document),
    // 23 § Animation: a test build draws as with Reduced motion (e2e and screenshots).
    reducedMotion: import.meta.env.MODE === 'test',
    // The tutorial is offered on the first New world; a test build offers it only with `?tutorial=offer`.
    offerTutorial: !testBuild || query?.get('tutorial') === 'offer',
  });
  await game.loadSettings();
  // 24 § Music: audio waits for the first key press or click, and a test build makes none.
  if (!testBuild) {
    const gate = new AudioGate(() => game.userSettings.music && game.userSettings.musicVolume > 0, browserAudioContext, MUSIC_REVERB_S, MUSIC_SUSPEND_DELAY_S);
    gate.attach(window as unknown as EventTargetLike);
    game.music.attach(() => gate.output());
  }
  const start = query?.get('start') ?? null;
  if (start === 'flat-test') await game.start({ seed: options.seed ?? 'deepholm', ...(query?.get('embark') === 'default' ? { embark: 'default' as const } : {}) });
  // The intro plays at launch as its setting says; a test build skips it unless `?intro=on`.
  else if ((!testBuild || query?.get('intro') === 'on') && game.introAtLaunch()) game.openIntro();
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
    {
      toLocal: local,
      // A function key or a Ctrl key the keymap binds now is the game's, not the browser's (a key
      // rebound to `F6` or `Ctrl+P`, 24 § Settings).
      swallow: (key) => swallowedByDefault(key) || ((key.ctrl || /^F\d{1,2}$/.test(key.key)) && game.keymap.binds(key)),
    },
  );
  input.attach();
  // Right click belongs to the game (24 § Input model), not to the browser's context menu.
  element.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('resize', () => {
    game.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    game.render();
  });

  // Hidden tabs can suspend RAF entirely: visibility events break the rate window even then.
  const now = browserNow();
  document.addEventListener('visibilitychange', () => {
    game.driver.reset(now());
    // 24 § Music: the music pauses while the document is hidden, and goes on when it is shown.
    game.music.setHidden(document.hidden === true);
  });
  game.music.setHidden(document.hidden === true);
  const loop = new FrameLoop({
    scheduler: options.scheduler ?? browserFrameScheduler(),
    hidden: browserHidden(),
  });
  loop.start((nowMs, hidden) => {
    game.driver.onFrame(nowMs, hidden);
    game.updateMusic();
  });

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
    ...(header.testing === true ? { testing: true } : {}),
  };
}
