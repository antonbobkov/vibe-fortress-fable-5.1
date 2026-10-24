/**
 * The tutorial: `04-implementation/ui-screens/menus-and-world.md` § Tutorial, with its steps from
 * `03-content/ui-keymap-and-screens.md` § Tutorial (the `tutorial` content table) and the strings
 * `tutorial.<id>`.
 *
 * A step is done when its check holds. The checks are the fixed set of {@link TUTORIAL_CHECKS};
 * each reads {@link TutorialFacts}, which the app takes from the readers and the presentation state,
 * so the tutorial only reads and draws: it gives no command and changes no rule. The box is drawn
 * over the map view after the fortress screen has drawn, and the highlight recolours the cells of a
 * landmark the fortress screen recorded; neither takes a key or a click that is not its own.
 */

import { C } from '@core/components';
import { Designation, TileKind } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { BuildingsReader } from '@systems/buildings';
import { localMapSpec, siteSummary } from '@systems/embark';
import type { WorkshopsReader } from '@systems/workshops';
import type { WorldMap } from '@systems/worldgen';
import { TUTORIAL_BOX_COLS } from './constants';
import { PANEL_CONTEXTS, type KeyContext, type Keymap } from './keymap';
import { wrapText } from './messages';
import type { Speed } from './status';
import type { Strings } from './strings';
import type { Surface } from './surface';
import { label } from './widgets';

/** A row of the `tutorial` content table. */
export interface TutorialStep {
  readonly id: string;
  /** One of {@link TUTORIAL_CHECKS}. */
  readonly check: string;
  /** A fortress panel id, or `z`, `speed` or `menu`. */
  readonly highlight: string;
  readonly text: string;
}

/** The fixed set of checks a step may name (§ Tutorial, The steps). */
export const TUTORIAL_CHECKS = [
  'view_moved', 'looked', 'dig_designated', 'stairs_designated', 'stockpile_made', 'workshop_placed',
  'order_queued', 'farm_plot_made', 'labors_changed', 'paused_and_sped', 'saved',
] as const;

/** The fields of status row 1 a step may highlight; any other highlight is a panel id. */
export const TUTORIAL_FIELDS: readonly string[] = ['z', 'speed', 'menu'];

/** What the checks read. The counts that walk the map are methods, computed only when a check asks. */
export interface TutorialFacts {
  readonly camX: number;
  readonly camY: number;
  readonly z: number;
  /** The map is larger than the map view in some direction, so the view can move. */
  readonly canPan: boolean;
  /** The tile the look panel shows while it is open, or null. */
  readonly lookTile: TileIndex | null;
  /** A dwarf of the fortress is on {@link lookTile}. */
  readonly lookDwarf: boolean;
  readonly speed: Speed;
  /** Manual and quick saves of this fortress written in this session. */
  readonly saves: number;
  /** Tiles designated for digging. */
  digDesignations(): number;
  /** Tiles designated for down stairs or up/down stairs. */
  stairDesignations(): number;
  /** Tiles that are down stairs or up/down stairs. */
  downStairs(): number;
  /** Zones of a type. */
  zones(type: string): number;
  /** Workshops in any state: planned, under construction or built. */
  workshops(): number;
  /** Work orders, at a workshop or for the fortress. */
  orders(): number;
  /** Every dwarf's labors, as one string that changes when any labor does. */
  labors(): string;
}

/** What a check keeps between two looks within one step: its start and the parts that have held. */
export type TutorialMemo = Record<string, number | string | boolean>;

/**
 * Whether a step's check holds. The first call of a step (an empty memo) takes the step's start;
 * a check with two parts holds once each part has held at some time during the step.
 */
export function tutorialCheck(check: string, f: TutorialFacts, memo: TutorialMemo): boolean {
  const first = memo['begun'] !== true;
  memo['begun'] = true;
  switch (check) {
    case 'view_moved':
      if (first) { memo['camX'] = f.camX; memo['camY'] = f.camY; memo['z'] = f.z; }
      if (!f.canPan || f.camX !== memo['camX'] || f.camY !== memo['camY']) memo['moved'] = true;
      if (f.z !== memo['z']) memo['level'] = true;
      return memo['moved'] === true && memo['level'] === true;
    case 'looked':
      if (f.lookTile !== null) memo[f.lookDwarf ? 'dwarf' : 'tile'] = true;
      return memo['tile'] === true && memo['dwarf'] === true;
    case 'dig_designated':
      return f.digDesignations() > 0;
    case 'stairs_designated':
      if (first) memo['stairs'] = f.downStairs();
      return f.stairDesignations() > 0 || f.downStairs() > (memo['stairs'] as number);
    case 'stockpile_made':
      return f.zones('stockpile') > 0;
    case 'workshop_placed':
      return f.workshops() > 0;
    case 'order_queued':
      return f.orders() > 0;
    case 'farm_plot_made':
      return f.zones('farm_plot') > 0;
    case 'labors_changed':
      if (first) memo['labors'] = f.labors();
      return f.labors() !== memo['labors'];
    case 'paused_and_sped':
      if (!first && (memo['speed'] as number) > 0 && f.speed === 0) memo['paused'] = true;
      if (f.speed >= 2) memo['fast'] = true;
      memo['speed'] = f.speed;
      return memo['paused'] === true && memo['fast'] === true;
    case 'saved':
      if (first) memo['saves'] = f.saves;
      return f.saves > (memo['saves'] as number);
    default:
      return false;
  }
}

/** What the app gives {@link readTutorialFacts}: the readers and the view. */
export interface TutorialView {
  readonly readers: ReaderSet;
  readonly registry: Registry;
  readonly camX: number;
  readonly camY: number;
  readonly z: number;
  /** The map view's size in cells. */
  readonly viewCols: number;
  readonly viewRows: number;
  readonly lookTile: TileIndex | null;
  readonly speed: Speed;
  readonly saves: number;
}

/** The facts of the running fortress. The map is walked once, on the first count a check asks for. */
export function readTutorialFacts(v: TutorialView): TutorialFacts {
  const { readers, registry } = v;
  const map = readers.map;
  let scan: { dig: number; stairs: number; down: number } | null = null;
  const counts = (): { dig: number; stairs: number; down: number } => {
    if (scan !== null) return scan;
    let dig = 0;
    let stairs = 0;
    let down = 0;
    const n = map.w * map.h * map.d;
    for (let i = 0; i < n; i += 1) {
      const d = map.designationAt(i);
      if (d === Designation.Dig) dig += 1;
      else if (d === Designation.StairsDown || d === Designation.StairsUpDown) stairs += 1;
      const k = map.kindAt(i);
      if (k === TileKind.StairsDown || k === TileKind.StairsUpDown) down += 1;
    }
    scan = { dig, stairs, down };
    return scan;
  };
  const dwarf = registry.table('creatures').has('dwarf') ? registry.table('creatures').index('dwarf') : -1;
  const isDwarf = (id: number): boolean => {
    const c = readers.entities.get(id, C.Creature);
    return c !== undefined && readers.entities.alive(id) && c.faction === 'fortress' && c.species === dwarf;
  };
  const buildings = readers.has('14') ? readers.of<BuildingsReader>('14') : null;
  return {
    camX: v.camX,
    camY: v.camY,
    z: v.z,
    canPan: map.w > v.viewCols || map.h > v.viewRows,
    lookTile: v.lookTile,
    lookDwarf: v.lookTile !== null && readers.entities.at(v.lookTile).some(isDwarf),
    speed: v.speed,
    saves: v.saves,
    digDesignations: () => counts().dig,
    stairDesignations: () => counts().stairs,
    downStairs: () => counts().down,
    zones: (type) => buildings?.zonesOfType(type).length ?? 0,
    workshops: () => {
      const types = registry.table<{ id: string; category?: string }>('buildings');
      return readers.entities.with(C.Building).filter((id) => {
        const type = buildings?.get(id)?.typeId;
        return type !== undefined && types.byId(type)?.category === 'workshop';
      }).length;
    },
    orders: () => (readers.has('12') ? readers.of<WorkshopsReader>('12').allOrders().length : 0),
    labors: () => readers.entities.with(C.Labors).filter(isDwarf).sort((a, b) => a - b)
      .map((id) => `${id}:${Array.from(readers.entities.get(id, C.Labors)?.enabled ?? []).join(',')}`).join(';'),
  };
}

interface RegionRank {
  readonly id: number;
  readonly key: readonly number[];
}

/**
 * The region the tutorial embarks on (§ Tutorial, The site): the first by the fewest missing
 * essentials, the lowest peril, a river or brook, the `temperate_forest` biome, the fewest traits,
 * a temperate climate and the lowest id. Biomes no one can embark on are not ranked.
 */
export function tutorialRegion(world: WorldMap, registry: Registry): number {
  const biomes = registry.table<{ id: string; embarkable: boolean }>('biomes');
  let best: RegionRank | null = null;
  for (const r of world.regions) {
    if (biomes.byId(r.biome)?.embarkable !== true) continue;
    // The cheap keys first: no summary is read for a region that cannot rank first on peril alone
    // once the best so far lacks nothing.
    if (best !== null && best.key[0] === 0 && r.peril > (best.key[1] as number)) continue;
    const site = siteSummary(localMapSpec(world, r.id, registry), registry);
    const key = [
      site.lacks.length,
      r.peril,
      site.water.river === null ? 1 : 0,
      r.biome === 'temperate_forest' ? 0 : 1,
      r.traits.length,
      site.climate.band === 'temperate' ? 0 : 1,
      r.id,
    ];
    if (best === null || before(key, best.key)) best = { id: r.id, key };
  }
  return best?.id ?? 0;
}

function before(a: readonly number[], b: readonly number[]): boolean {
  for (let k = 0; k < a.length; k += 1) {
    if ((a[k] as number) !== (b[k] as number)) return (a[k] as number) < (b[k] as number);
  }
  return false;
}

/**
 * The contexts a step's keys are read in, as a hint's are: the global keys, the panel letters, the
 * map and list keys, then the step's own panel. A panel letter in the text puts that panel's keys
 * first for the keys after it (`[z]`, then `[S-s]`).
 */
const STEP_CONTEXTS: readonly KeyContext[] = ['global', 'fortress_panel', 'map', 'panel'];

interface Button { readonly rect: Rect; readonly run: () => void }

/** A running tutorial: the step it is on, and its box. */
export class Tutorial {
  /** The step on, or `steps.length` once every step is done. */
  index = 0;
  /** Set when the player ends or closes the tutorial; the app then drops it. */
  ended = false;
  private memo: TutorialMemo = {};
  private box: Rect | null = null;
  private buttons: Button[] = [];

  constructor(
    readonly steps: readonly TutorialStep[],
    private readonly strings: Strings,
    private readonly keymap: Keymap,
  ) {}

  /** Every step is done: the box says so and offers to close. */
  get done(): boolean {
    return this.index >= this.steps.length;
  }

  get step(): TutorialStep | null {
    return this.steps[this.index] ?? null;
  }

  /** Check the step against the facts; a step whose check holds gives way to the next. Returns the steps completed. */
  update(facts: TutorialFacts): number {
    let completed = 0;
    for (let step = this.step; step !== null && !this.ended; step = this.step) {
      if (!tutorialCheck(step.check, facts, this.memo)) break;
      this.next();
      completed += 1;
    }
    return completed;
  }

  /** The skip key or button: the next step; once every step is done, closing. */
  skip(): void {
    if (this.done) this.end();
    else this.next();
  }

  end(): void {
    this.ended = true;
  }

  private next(): void {
    this.index += 1;
    this.memo = {};
  }

  /** The step's text with its keys as they are bound now. */
  text(): string {
    const step = this.step;
    if (step === null) return this.keymap.relabel(this.strings.get('ui.tutorial.done'), STEP_CONTEXTS, true);
    const own = PANEL_CONTEXTS[step.highlight];
    return this.keymap.relabel(this.strings.get(`tutorial.${step.id}`), own === undefined ? STEP_CONTEXTS : [...STEP_CONTEXTS, own], true);
  }

  /** The box's title. */
  title(): string {
    return this.done ? this.strings.get('ui.tutorial.done_title') : this.strings.get('ui.tutorial.title', { n: this.index + 1, total: this.steps.length });
  }

  /** The cells a highlight covers: a panel's title row or its strip entry, or a field of status row 1. */
  highlight(landmark: (name: string) => Rect | null): Rect | null {
    const step = this.step;
    if (step === null) return null;
    if (TUTORIAL_FIELDS.includes(step.highlight)) return landmark(step.highlight);
    return landmark(`panel:${step.highlight}`) ?? landmark(`strip:${step.highlight}`);
  }

  /** Draw the highlight and the box over the fortress screen; the box sits in the map view's top left corner. */
  draw(surface: Surface, map: Rect, landmark: (name: string) => Rect | null): void {
    this.box = null;
    this.buttons = [];
    if (this.ended) return;
    const t = surface.theme;
    const lit = this.highlight(landmark);
    if (lit !== null) {
      for (let r = 0; r < lit.rows; r += 1) {
        for (let c = 0; c < lit.cols; c += 1) {
          const col = lit.col + c;
          const row = lit.row + r;
          if (!surface.inside(col, row)) continue;
          surface.put(col, row, surface.cells.get(col, row).glyph, t.black, t.key);
        }
      }
    }
    const cols = Math.min(TUTORIAL_BOX_COLS, map.cols);
    if (cols < 16 || map.rows < 5) return;
    const inner = cols - 4;
    const lines = wrapText(this.text(), inner, Math.max(1, map.rows - 3));
    const rows = lines.length + 3;
    const box = { col: map.col, row: map.row, cols, rows };
    this.box = box;
    surface.fill(box, t.panelBg);
    const g = (ch: string): number => surface.glyphs.index(ch);
    for (let c = 1; c < cols - 1; c += 1) {
      surface.put(box.col + c, box.row, g('─'), t.border, t.panelBg);
      surface.put(box.col + c, box.row + rows - 1, g('─'), t.border, t.panelBg);
    }
    for (let r = 1; r < rows - 1; r += 1) {
      surface.put(box.col, box.row + r, g('│'), t.border, t.panelBg);
      surface.put(box.col + cols - 1, box.row + r, g('│'), t.border, t.panelBg);
    }
    surface.put(box.col, box.row, g('┌'), t.border, t.panelBg);
    surface.put(box.col + cols - 1, box.row, g('┐'), t.border, t.panelBg);
    surface.put(box.col, box.row + rows - 1, g('└'), t.border, t.panelBg);
    surface.put(box.col + cols - 1, box.row + rows - 1, g('┘'), t.border, t.panelBg);
    label(surface, box.col + 2, box.row, ` ${this.title()} `, { fg: t.key, bg: t.panelBg, width: cols - 4, keys: false });
    lines.forEach((line, k) => label(surface, box.col + 2, box.row + 1 + k, line, { bg: t.panelBg, width: inner, relabel: false }));
    const buttons = this.done
      ? [{ text: this.strings.get('ui.tutorial.close'), run: () => this.end() }]
      : [{ text: this.strings.get('ui.tutorial.skip'), run: () => this.skip() }, { text: this.strings.get('ui.tutorial.end'), run: () => this.end() }];
    let at = box.col + 2;
    const row = box.row + rows - 2;
    for (const button of buttons) {
      const text = this.keymap.relabel(button.text, ['global']);
      const n = label(surface, at, row, text, { bg: t.panelBg, width: Math.max(0, box.col + cols - 2 - at), relabel: false });
      this.buttons.push({ rect: { col: at, row, cols: n, rows: 1 }, run: button.run });
      at += n + 2;
    }
  }

  /** The box's cells in the last frame, or null when none was drawn. */
  get boxRect(): Rect | null {
    return this.box;
  }

  /**
   * A press on the box: a left click on a button does what its key does. Returns whether the press
   * was on the box, which then keeps it from the map under it.
   */
  press(col: number, row: number, button: number): boolean {
    const box = this.box;
    if (box === null || col < box.col || row < box.row || col >= box.col + box.cols || row >= box.row + box.rows) return false;
    if (button !== 0) return true;
    const hit = this.buttons.find((b) => row === b.rect.row && col >= b.rect.col && col < b.rect.col + b.rect.cols);
    hit?.run();
    return true;
  }
}
