/**
 * The world map screen: `04-implementation/ui-screens/menus-and-world.md` § World map,
 * `02-systems/01-world-generation.md` § Player-facing behavior and 24 § Screens outside the
 * fortress ("the map with the cursor; the region panel on the right; the filter panel (`f`);
 * `Embark` (`Enter` on a valid region). Legend of biome glyphs (`?`)"), with the `world_map`
 * keys of `ui-keymap-and-screens.md` (arrows move the cursor, `Shift`: 8).
 *
 * The region panel states the record in words; "Regions that cannot be embarked on (ocean,
 * glacier) say so." The filter panel narrows `findRegions`: matching regions keep full color,
 * the others dim.
 */

import { SIDEBAR_COLS } from '@core/constants';
import type { Registry } from '@core/registry';
import type { Civ, Edge } from '@core/types';
import type { KeyPress } from '@platform/input';
import type { WorldMapCompositor } from '@render/world-map';
import { CIVS, matchesFilter, type RegionFilter, type RegionRecord, type WorldMap } from '@systems/worldgen';
import type { Keymap } from '../keymap';
import { clickHit, type CellPointer, type Screen } from '../screen';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { bar, button, label, list, separator, type ListState } from '../widgets';
import { wrapText } from '../messages';

/** `01` § Region record: ratings are integers 0–`RATING_MAX`; the wireframe draws five cells. */
export const RATING_BAR_CELLS = 5;
const RATING_TOP = 4;

/** `world_map` › arrows: "move the cursor (`Shift`: 8)". */
export const WORLD_CURSOR_SHIFT_STEP = 8;

export interface WorldMapHost {
  embark(world: WorldMap, regionId: number): void;
  back(): void;
}

interface BiomeRow {
  readonly id: string;
  readonly name: string;
  readonly glyph: string;
  readonly embarkable: boolean;
}

interface NamedRow {
  readonly id: string;
  readonly name: string;
}

type TriState = 'any' | 'yes' | 'no';

/** The filter panel's state; everything open by default. */
export interface FilterState {
  excludedBiomes: string[];
  wealth: [number, number];
  peril: [number, number];
  temper: [number, number];
  river: TriState;
  volcano: TriState;
  traits: string[];
}

export function defaultFilter(): FilterState {
  return {
    excludedBiomes: [],
    wealth: [0, RATING_TOP],
    peril: [0, RATING_TOP],
    temper: [0, RATING_TOP],
    river: 'any',
    volcano: 'any',
    traits: [],
  };
}

/** The `RegionFilter` of `world.findRegions` a filter state stands for. */
export function regionFilterOf(state: FilterState, allBiomes: readonly string[]): RegionFilter {
  const f: { -readonly [K in keyof RegionFilter]: RegionFilter[K] } = {
    wealth: state.wealth,
    peril: state.peril,
    temper: state.temper,
  };
  if (state.excludedBiomes.length > 0) f.biomes = allBiomes.filter((b) => !state.excludedBiomes.includes(b));
  if (state.river !== 'any') f.river = state.river === 'yes';
  if (state.volcano !== 'any') f.volcano = state.volcano === 'yes';
  if (state.traits.length > 0) f.traits = state.traits;
  return f;
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

export class WorldMapScreen implements Screen {
  readonly id = 'world_map' as const;
  cursor: { x: number; y: number };
  camX = 0;
  camY = 0;
  mode: 'region' | 'filter' | 'legend' = 'region';
  filter: FilterState = defaultFilter();
  readonly filterList: ListState = { selected: 0, scroll: 0 };
  private last: Surface | null = null;
  private mapCols = 0;
  private mapRows = 0;
  private readonly biomes: BiomeRow[];
  private readonly traitNames: Map<string, string>;
  private readonly civNames: Map<string, string>;

  constructor(
    readonly world: WorldMap,
    private readonly host: WorldMapHost,
    private readonly keymap: Keymap,
    private readonly strings: Strings,
    private readonly compositor: WorldMapCompositor,
    registry: Registry,
  ) {
    const biomes = registry.table<BiomeRow>('biomes');
    this.biomes = biomes.ids().map((id) => biomes.byId(id) as BiomeRow);
    const traits = registry.table<NamedRow>('regionTraits');
    this.traitNames = new Map(traits.ids().map((id) => [id, (traits.byId(id) as NamedRow).name]));
    const civs = registry.table<NamedRow>('civilizations');
    this.civNames = new Map(civs.ids().map((id) => [id, (civs.byId(id) as NamedRow).name.replace(/^the /, '')]));
    const mid = Math.floor(world.size / 2);
    this.cursor = { x: mid, y: mid };
  }

  get regionId(): number {
    return this.cursor.y * this.world.size + this.cursor.x;
  }

  region(): RegionRecord | undefined {
    return this.world.regions[this.regionId];
  }

  embarkable(region: RegionRecord | undefined): boolean {
    if (region === undefined) return false;
    return this.biomes.find((b) => b.id === region.biome)?.embarkable === true;
  }

  private matches(): ((id: number) => boolean) | undefined {
    const f = regionFilterOf(this.filter, this.biomes.map((b) => b.id));
    const open = defaultFilter();
    const isOpen = JSON.stringify(this.filter) === JSON.stringify(open);
    if (isOpen) return undefined;
    return (id) => {
      const r = this.world.regions[id];
      return r !== undefined && matchesFilter(r, f);
    };
  }

  /** The number of regions the filter keeps. */
  matchCount(): number {
    const m = this.matches();
    return m === undefined ? this.world.regions.length : this.world.regions.filter((r) => m(r.id)).length;
  }

  moveCursor(dx: number, dy: number): void {
    const size = this.world.size;
    this.cursor = {
      x: Math.max(0, Math.min(size - 1, this.cursor.x + dx)),
      y: Math.max(0, Math.min(size - 1, this.cursor.y + dy)),
    };
    this.follow();
  }

  /** Keep the cursor inside the visible map rectangle. */
  private follow(): void {
    const size = this.world.size;
    if (this.mapCols <= 0 || this.mapRows <= 0) return;
    if (this.cursor.x < this.camX) this.camX = this.cursor.x;
    if (this.cursor.x >= this.camX + this.mapCols) this.camX = this.cursor.x - this.mapCols + 1;
    if (this.cursor.y < this.camY) this.camY = this.cursor.y;
    if (this.cursor.y >= this.camY + this.mapRows) this.camY = this.cursor.y - this.mapRows + 1;
    this.camX = Math.max(0, Math.min(Math.max(0, size - this.mapCols), this.camX));
    this.camY = Math.max(0, Math.min(Math.max(0, size - this.mapRows), this.camY));
  }

  draw(surface: Surface): void {
    this.last = surface;
    const side = Math.min(SIDEBAR_COLS, Math.max(0, surface.cols - 20));
    this.mapCols = surface.cols - side - 1;
    this.mapRows = surface.rows;
    this.follow();
    const matches = this.matches();
    this.compositor.compose(
      surface.cells,
      { col: 0, row: 0, cols: this.mapCols, rows: this.mapRows },
      this.world,
      matches === undefined ? { camX: this.camX, camY: this.camY, cursor: this.cursor } : { camX: this.camX, camY: this.camY, cursor: this.cursor, matches },
    );
    surface.hit({ col: 0, row: 0, cols: this.mapCols, rows: this.mapRows }, () => {});
    const rule = surface.glyphs.index('│');
    for (let r = 0; r < surface.rows; r += 1) surface.put(this.mapCols, r, rule, surface.theme.border, surface.theme.black);
    const panel = { col: this.mapCols + 1, row: 0, cols: side, rows: surface.rows };
    if (this.mode === 'filter') this.drawFilter(surface, panel);
    else if (this.mode === 'legend') this.drawLegend(surface, panel);
    else this.drawRegion(surface, panel);
  }

  /** The region panel's lines, in words (`01` § Player-facing behavior). */
  regionLines(): string[] {
    const s = this.strings;
    const r = this.region();
    if (r === undefined) return [];
    const biome = this.biomes.find((b) => b.id === r.biome);
    const out: string[] = [];
    if (r.name.length > 0) out.push(r.name);
    out.push(capitalize(biome?.name ?? r.biome));
    if (!this.embarkable(r)) {
      out.push(s.get('ui.worldmap.no_embark', { biome: biome?.name ?? r.biome }));
      return out;
    }
    if (r.river !== null) {
      const edge = (e: Edge): string => s.get(`ui.edge.${e}`);
      const from = r.river.inflow.map(edge).join(' and ');
      if (r.river.inflow.length === 0 && r.river.outflow !== null) out.push(s.get('ui.worldmap.river_source', { to: edge(r.river.outflow) }));
      else if (r.river.outflow === null) out.push(s.get('ui.worldmap.river_mouth', { from }));
      else out.push(s.get('ui.worldmap.river', { from, to: edge(r.river.outflow) }));
    }
    if (r.lake) out.push(s.get('ui.worldmap.lake'));
    if (r.volcano) out.push(s.get('ui.worldmap.volcano'));
    return out;
  }

  private drawRegion(surface: Surface, panel: { col: number; row: number; cols: number; rows: number }): void {
    const s = this.strings;
    const t = surface.theme;
    const r = this.region();
    let row = panel.row;
    const line = (text: string, fg = t.text): void => {
      label(surface, panel.col + 1, row, text, { fg, width: panel.cols - 2 });
      row += 1;
    };
    const lines = this.regionLines();
    lines.forEach((text, k) => line(text, k === 0 ? t.key : t.text));
    if (r === undefined || !this.embarkable(r)) return;
    row += 1;
    const rating = (key: string, value: number): void => {
      const name = s.get(key);
      label(surface, panel.col + 1, row, name);
      bar(surface, panel.col + 9, row, value, RATING_BAR_CELLS, RATING_BAR_CELLS);
      label(surface, panel.col + 9 + RATING_BAR_CELLS + 1, row, String(value), { fg: t.value });
      row += 1;
    };
    rating('ui.worldmap.wealth', r.wealth);
    rating('ui.worldmap.peril', r.peril);
    for (const text of wrapText(s.get('ui.worldmap.peril_note'), panel.cols - 2, 3)) line(text, t.dim);
    rating('ui.worldmap.temper', r.temper);
    if (r.traits.length > 0) {
      line(s.get('ui.worldmap.trait', { traits: r.traits.map((id) => this.traitNames.get(id) ?? id).join(', ') }));
    }
    row += 1;
    for (const civ of CIVS as readonly Civ[]) {
      line(
        s.get('ui.worldmap.civ', {
          civ: capitalize(this.civNames.get(civ) ?? civ),
          n: r.civDistance[civ],
          edge: s.get(`ui.edge_short.${r.nearestEdgeTo[civ]}`),
        }),
      );
    }
    row += 1;
    let c = panel.col + 1;
    c += button(surface, c, row, 'f', s.get('ui.worldmap.filter'), () => this.toggle('filter')) + 2;
    button(surface, c, row, '?', s.get('ui.worldmap.legend'), () => this.toggle('legend'));
    row += 1;
    button(surface, panel.col + 1, row, 'Enter', s.get('ui.worldmap.embark'), () => this.embark());
  }

  /** The filter panel's rows: biome toggles, rating bounds, river and volcano, traits. */
  filterRows(): { text: string; toggle: () => void; adjust: (d: number) => void }[] {
    const s = this.strings;
    const f = this.filter;
    const rows: { text: string; toggle: () => void; adjust: (d: number) => void }[] = [];
    for (const b of this.biomes) {
      const on = !f.excludedBiomes.includes(b.id);
      const toggle = (): void => {
        f.excludedBiomes = on ? [...f.excludedBiomes, b.id].sort() : f.excludedBiomes.filter((x) => x !== b.id);
      };
      rows.push({ text: `[${on ? 'x' : ' '}] ${b.glyph} ${b.name}`, toggle, adjust: toggle });
    }
    const bound = (key: 'wealth' | 'peril' | 'temper', end: 0 | 1): void => {
      const range = f[key];
      const name = `${s.get(`ui.worldmap.${key}`)} ${s.get(end === 0 ? 'ui.worldmap.filter_min' : 'ui.worldmap.filter_max')}`;
      const adjust = (d: number): void => {
        const next: [number, number] = [range[0], range[1]];
        next[end] = Math.max(0, Math.min(RATING_TOP, next[end] + d));
        if (next[0] > next[1]) return;
        f[key] = next;
      };
      rows.push({ text: `${name.padEnd(14)} [-] ${range[end]} [+]`, toggle: () => adjust(1), adjust });
    };
    for (const key of ['wealth', 'peril', 'temper'] as const) {
      bound(key, 0);
      bound(key, 1);
    }
    const tri = (key: 'river' | 'volcano'): void => {
      const order: TriState[] = ['any', 'yes', 'no'];
      const cycle = (d: number): void => {
        f[key] = order[(order.indexOf(f[key]) + d + 3) % 3] as TriState;
      };
      rows.push({ text: `${s.get(`ui.worldmap.filter_${key}`).padEnd(14)} ${s.get(`ui.worldmap.filter_${f[key]}`)}`, toggle: () => cycle(1), adjust: cycle });
    };
    tri('river');
    tri('volcano');
    for (const [id, name] of Array.from(this.traitNames.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const on = f.traits.includes(id);
      const toggle = (): void => {
        f.traits = on ? f.traits.filter((x) => x !== id) : [...f.traits, id].sort();
      };
      rows.push({ text: `[${on ? 'x' : ' '}] ${name}`, toggle, adjust: toggle });
    }
    return rows;
  }

  private drawFilter(surface: Surface, panel: { col: number; row: number; cols: number; rows: number }): void {
    const s = this.strings;
    label(surface, panel.col + 1, panel.row, s.get('ui.worldmap.filter_title'), { fg: surface.theme.key });
    label(surface, panel.col + 1, panel.row + 1, s.get('ui.worldmap.filter_matches', { n: this.matchCount() }), { fg: surface.theme.value });
    const rows = this.filterRows();
    const height = Math.max(1, panel.rows - 5);
    list(
      surface,
      { col: panel.col + 1, row: panel.row + 2, cols: panel.cols - 1, rows: height },
      rows.map((r) => r.text),
      this.filterList,
      (index) => {
        this.filterList.selected = index;
        rows[index]?.toggle();
      },
    );
    separator(surface, panel.col + 1, panel.row + 2 + height, panel.cols - 2);
    label(surface, panel.col + 1, panel.row + 3 + height, s.get('ui.worldmap.filter_help'));
    button(surface, panel.col + 1, panel.row + 4 + height, 'f', s.get('ui.worldmap.close'), () => this.toggle('filter'));
  }

  private drawLegend(surface: Surface, panel: { col: number; row: number; cols: number; rows: number }): void {
    const s = this.strings;
    label(surface, panel.col + 1, panel.row, s.get('ui.worldmap.legend_title'), { fg: surface.theme.key });
    let row = panel.row + 1;
    for (const b of this.biomes) {
      if (surface.inside(panel.col + 1, row)) surface.cells.setCell(panel.col + 1, row, this.compositor.biomeCell(b.id));
      label(surface, panel.col + 3, row, b.name);
      row += 1;
    }
    if (surface.inside(panel.col + 1, row)) surface.cells.setCell(panel.col + 1, row, this.compositor.riverCell());
    label(surface, panel.col + 3, row, s.get('ui.worldmap.legend_river'));
    row += 2;
    button(surface, panel.col + 1, row, '?', s.get('ui.worldmap.close'), () => this.toggle('legend'));
  }

  toggle(mode: 'filter' | 'legend'): void {
    this.mode = this.mode === mode ? 'region' : mode;
  }

  embark(): void {
    if (!this.embarkable(this.region())) return;
    this.host.embark(this.world, this.regionId);
  }

  key(press: KeyPress): boolean {
    if (this.mode === 'filter') {
      const rows = this.filterRows();
      const p = this.keymap.resolve('panel', press);
      if (p?.id === 'select') {
        this.filterList.selected = Math.max(0, Math.min(rows.length - 1, this.filterList.selected + (p.arg === '↑' ? -1 : 1)));
        return true;
      }
      if (p?.id === 'activate') {
        rows[this.filterList.selected]?.toggle();
        return true;
      }
      if (press.key === '+' || press.key === '=' || press.key === '-') {
        rows[this.filterList.selected]?.adjust(press.key === '-' ? -1 : 1);
        return true;
      }
      if (press.key === 'Esc') {
        this.mode = 'region';
        return true;
      }
    }
    if (press.key === 'Esc') {
      if (this.mode !== 'region') this.mode = 'region';
      else this.host.back();
      return true;
    }
    const action = this.keymap.resolve('world_map', press);
    if (action === null) return false;
    switch (action.id) {
      case 'cursor': {
        const step = action.shift ? WORLD_CURSOR_SHIFT_STEP : 1;
        const d = { '←': [-1, 0], '→': [1, 0], '↑': [0, -1], '↓': [0, 1] }[action.arg as '←'] ?? [0, 0];
        this.moveCursor((d[0] as number) * step, (d[1] as number) * step);
        return true;
      }
      case 'filter':
        this.toggle('filter');
        return true;
      case 'legend':
        this.toggle('legend');
        return true;
      case 'embark':
        this.embark();
        return true;
      default:
        return false;
    }
  }

  pointerDown(p: CellPointer): void {
    if (p.button === 0 && p.col < this.mapCols && p.row < this.mapRows) {
      this.moveCursor(this.camX + p.col - this.cursor.x, this.camY + p.row - this.cursor.y);
      return;
    }
    clickHit(this.last, p);
  }
}
