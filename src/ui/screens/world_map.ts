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
import { localMapSpec, SIGNATURE_LIKELY, siteFrostbite, siteLacks, siteSummary, type LocalMapSpec, type SiteSummary } from '@systems/embark';
import { CIVS, hasLandRoute, matchesFilter, type RegionFilter, type RegionRecord, type WorldMap } from '@systems/worldgen';
import { SITE_LABEL_COLS, SITE_LIST_NAMES, START_SITE_REACH_DIVISOR } from '../constants';
import type { KeyContext, Keymap } from '../keymap';
import { clickHit, type CellPointer, type CellWheel, type Screen } from '../screen';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { bar, button, label, list, separator, type ListState } from '../widgets';
import { chainText, wrapHang, wrapText } from '../messages';

/** The season words of `ui.season.<word>`, spring … winter. */
const SEASON_WORDS = ['spring', 'summer', 'autumn', 'winter'] as const;

/** `01` § Region record: ratings are integers 0–`RATING_MAX`; the wireframe draws five cells. */
export const RATING_BAR_CELLS = 5;
const RATING_TOP = 4;

/** `world_map` › arrows: "move the cursor (`Shift`: 8)". */
export const WORLD_CURSOR_SHIFT_STEP = 8;

/** `ui-keymap-and-screens.md` § Mouse: the wheel over the sidebar "scrolls … three rows a notch". */
const WHEEL_ROWS = 3;

export interface WorldMapHost {
  embark(world: WorldMap, regionId: number): void;
  back(): void;
  /**
   * The presentation clock and the Reduced motion setting (23 § Animation), which blink the
   * cursor; absent: a steady cursor.
   */
  animation?(): { readonly animFrame: number; readonly reducedMotion: boolean };
  /** The fortresses that ended on a region of this world, from the Legends (T-672); absent: none. */
  ruins?(regionId: number): readonly { readonly fortress: string; readonly cause: string }[];
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

/** The colour of a region panel line: the name, plain text, a note, a missing essential. */
export type PanelTone = 'key' | 'text' | 'dim' | 'alert';

/** One line of the region panel: words in a tone, or a rating with its bar. */
export type PanelLine = { readonly text: string; readonly fg: PanelTone } | { readonly rating: string; readonly value: number };

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

  captionKeys(): readonly KeyContext[] { return ['world_map', 'panel']; }
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
  private readonly materialNames: Map<string, string>;
  private readonly plantNames: Map<string, string>;
  private readonly creatureNames: Map<string, string>;
  private siteCache: { regionId: number; summary: SiteSummary } | null = null;
  /** The first region panel line shown; the panel scrolls when its text is longer than it. */
  regionScroll = 0;
  private panelCols = SIDEBAR_COLS;

  constructor(
    readonly world: WorldMap,
    private readonly host: WorldMapHost,
    private readonly keymap: Keymap,
    private readonly strings: Strings,
    private readonly compositor: WorldMapCompositor,
    private readonly registry: Registry,
  ) {
    const biomes = registry.table<BiomeRow>('biomes');
    this.biomes = biomes.ids().map((id) => biomes.byId(id) as BiomeRow);
    const names = (table: string): Map<string, string> => {
      const t = registry.table<NamedRow>(table);
      return new Map(t.ids().map((id) => [id, (t.byId(id) as NamedRow).name]));
    };
    this.traitNames = names('regionTraits');
    this.materialNames = names('materials');
    this.plantNames = names('plants');
    this.creatureNames = names('creatures');
    const civs = registry.table<NamedRow>('civilizations');
    this.civNames = new Map(civs.ids().map((id) => [id, (civs.byId(id) as NamedRow).name.replace(/^the /, '')]));
    this.cursor = this.startCursor();
  }

  /**
   * Where the cursor starts: the region nearest the centre where a fortress can embark (and that the
   * filter keeps, when one is set), by Chebyshev distance, ties to the lowest id. It prefers the
   * nearest site with no frostbite from the first night (02 § Site summary) and no missing essential
   * (§ What a site has and lacks) within the world's size / `START_SITE_REACH_DIVISOR` of the centre;
   * else the nearest with no frostbite from the first night; else the nearest. The centre on a world
   * with none.
   */
  private startCursor(): { x: number; y: number } {
    const size = this.world.size;
    const mid = Math.floor(size / 2);
    const reach = Math.floor(size / START_SITE_REACH_DIVISOR);
    const matches = this.matches();
    const distance = (id: number): number => Math.max(Math.abs((id % size) - mid), Math.abs(Math.floor(id / size) - mid));
    const nearest = (keep: (r: RegionRecord) => boolean): RegionRecord | null => {
      // Regions come in id order, and the sort is stable, so ties go to the lowest id.
      const sites = this.world.regions.filter(keep).sort((a, b) => distance(a.id) - distance(b.id));
      const spec = (r: RegionRecord): LocalMapSpec => localMapSpec(this.world, r.id, this.registry);
      const thaws = (r: RegionRecord): boolean => siteFrostbite(spec(r), this.registry)?.arrival !== true;
      return sites.find((r) => distance(r.id) <= reach && thaws(r) && siteLacks(spec(r), this.registry).length === 0) ??
        sites.find(thaws) ?? sites[0] ?? null;
    };
    const site = (matches === undefined ? null : nearest((r) => this.embarkable(r) && matches(r.id))) ?? nearest((r) => this.embarkable(r));
    return site === null ? { x: mid, y: mid } : { x: site.id % size, y: Math.floor(site.id / size) };
  }

  /** Put the cursor on a region: a new embark after an abandoned fortress starts on its site. */
  focus(regionId: number): void {
    if (this.world.regions[regionId] === undefined) return;
    this.cursor = { x: regionId % this.world.size, y: Math.floor(regionId / this.world.size) };
    this.regionScroll = 0;
    this.follow();
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

  /** The number of sites the filter keeps: the regions it keeps where a fortress can embark (no ocean). */
  matchCount(): number {
    const m = this.matches();
    return this.world.regions.filter((r) => this.embarkable(r) && (m === undefined || m(r.id))).length;
  }

  moveCursor(dx: number, dy: number): void {
    const size = this.world.size;
    this.cursor = {
      x: Math.max(0, Math.min(size - 1, this.cursor.x + dx)),
      y: Math.max(0, Math.min(size - 1, this.cursor.y + dy)),
    };
    this.regionScroll = 0;
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
    this.panelCols = side;
    this.mapCols = surface.cols - side - 1;
    this.mapRows = surface.rows;
    this.follow();
    const matches = this.matches();
    const animation = this.host.animation?.() ?? { animFrame: 0, reducedMotion: true };
    this.compositor.compose(
      surface.cells,
      { col: 0, row: 0, cols: this.mapCols, rows: this.mapRows },
      this.world,
      { camX: this.camX, camY: this.camY, cursor: this.cursor, animFrame: animation.animFrame, reducedMotion: animation.reducedMotion, ruined: (id) => this.ruined(id), ...(matches === undefined ? {} : { matches }) },
    );
    surface.hit({ col: 0, row: 0, cols: this.mapCols, rows: this.mapRows }, () => {});
    const rule = surface.glyphs.index('│');
    for (let r = 0; r < surface.rows; r += 1) surface.put(this.mapCols, r, rule, surface.theme.border, surface.theme.black);
    const panel = { col: this.mapCols + 1, row: 0, cols: side, rows: surface.rows };
    if (this.mode === 'filter') this.drawFilter(surface, panel);
    else if (this.mode === 'legend') this.drawLegend(surface, panel);
    else this.drawRegion(surface, panel);
  }

  /** The site summary of the region under the cursor (`02` § Site summary), or null at sea. */
  site(): SiteSummary | null {
    const r = this.region();
    if (r === undefined || !this.embarkable(r)) return null;
    if (this.siteCache?.regionId !== r.id) {
      this.siteCache = { regionId: r.id, summary: siteSummary(localMapSpec(this.world, r.id, this.registry), this.registry) };
    }
    return this.siteCache.summary;
  }

  /** Names joined, at most `SITE_LIST_NAMES` of them and then "and N more". */
  private listOf(names: readonly string[]): string {
    if (names.length <= SITE_LIST_NAMES) return names.join(', ');
    return this.strings.get('ui.site.more', { list: names.slice(0, SITE_LIST_NAMES).join(', '), n: names.length - SITE_LIST_NAMES });
  }

  /** The rows of the site summary: a label and its value, in words. */
  siteRows(site: SiteSummary): [string, string][] {
    const s = this.strings;
    const material = (id: string): string => this.materialNames.get(id) ?? id;
    const plant = (id: string): string => this.plantNames.get(id) ?? id;
    const creature = (id: string): string => this.creatureNames.get(id) ?? id;
    const count = (c: { estimate: number; species: readonly string[] } | null): string =>
      c === null ? s.get('ui.site.none') : s.get('ui.site.count', { n: c.estimate.toLocaleString('en-US'), species: this.listOf(c.species.map(plant)) });

    const soil = site.soil !== null
      ? s.get('ui.site.soil_value', { materials: site.soil.materials.map(material).join(', '), n: site.soil.depth })
      : s.get(site.ground === 'obsidian' ? 'ui.site.soil_obsidian' : 'ui.site.soil_rock');

    const edge = (e: Edge): string => s.get(`ui.edge.${e}`);
    const water: string[] = [];
    const w = site.water;
    if (w.river !== null) {
      const params = { class: s.get(`ui.site.river_class.${w.river.class}`), from: chainText(s, w.river.inflow.map(edge), 'and') };
      const spring = w.river.inflow.length === 0;
      water.push(w.river.outflow === null
        ? s.get(spring ? 'ui.site.river_spring_lake' : 'ui.site.river_lake', params)
        : s.get(spring ? 'ui.site.river_spring' : 'ui.site.river', { ...params, to: edge(w.river.outflow) }));
    }
    if (w.lake && (w.river === null || w.river.outflow !== null)) water.push(s.get('ui.site.lake'));
    if ((w.river !== null || w.lake) && w.freezes) water.push(s.get('ui.site.freezes'));
    if (w.springs) water.push(s.get('ui.site.springs'));

    const ores = site.ores.length > 0 ? s.get('ui.site.ores_value', { ores: this.listOf(site.ores.map(material)) }) : s.get('ui.site.ores_none');
    const c = site.climate;
    const wild = site.wildlife;
    const wildlife = [
      wild.dangerous.length > 0 ? s.get('ui.site.dangerous', { list: this.listOf(wild.dangerous.map(creature)) }) : s.get('ui.site.harmless'),
      ...(wild.other.length > 0 ? [s.get('ui.site.also', { list: this.listOf(wild.other.map(creature)) })] : []),
    ];
    return [
      [s.get('ui.site.soil'), soil],
      [s.get('ui.site.trees'), count(site.trees)],
      [s.get('ui.site.shrubs'), `${count(site.shrubs)}; ${s.get(site.grass ? 'ui.site.grass' : 'ui.site.no_grass')}`],
      [s.get('ui.site.water'), water.length > 0 ? water.join('; ') : s.get('ui.site.water_none')],
      [s.get('ui.site.stone'), s.get('ui.site.stone_value', { geology: s.get(`ui.site.geology.${site.stone.geology}`), layers: this.listOf(site.stone.layers.map(material)) })],
      [s.get('ui.site.ores'), site.deepsilver ? `${ores}; ${s.get('ui.site.deepsilver')}` : ores],
      [
        s.get('ui.site.climate'),
        s.get('ui.site.climate_value', { band: s.get(`ui.site.band.${c.band}`), mean: c.meanC, summer: c.summerC, winter: c.winterC }) +
          (c.longWinter ? s.get('ui.site.long_winter') : '') +
          (c.frostbite !== null && !c.frostbite.arrival
            ? s.get('ui.site.frostbite_later', { season: s.get(`ui.season.${SEASON_WORDS[c.frostbite.season] ?? 'winter'}`).toLowerCase(), c: c.frostbite.nightC })
            : ''),
      ],
      [s.get('ui.site.wildlife'), wildlife.join('; ')],
    ];
  }

  /**
   * The summary's two rows after Wildlife (`02` § What a site has and lacks): "This site has:" and
   * "This site lacks:", each its goods in table order, a good the map gets only by a roll "likely".
   */
  signatureRows(site: SiteSummary): [string, string] {
    const s = this.strings;
    const name = (good: string): string => {
      const word = s.has(`ui.site.good.${good}`) ? s.get(`ui.site.good.${good}`) : (this.materialNames.get(good) ?? good);
      return SIGNATURE_LIKELY.includes(good) ? s.get('ui.site.likely', { good: word }) : word;
    };
    const list = (goods: readonly string[]): string => (goods.length > 0 ? goods.map(name).join(', ') : s.get('ui.site.none'));
    return [
      s.get('ui.site.has', { list: list(site.signature.has) }),
      s.get('ui.site.lacks', { list: list(site.signature.lacks) }),
    ];
  }

  /**
   * The region panel's lines, in words (`01` § Player-facing behavior; menus-and-world.md § World
   * map): the name and biome, the missing essentials in the alert colour, the site summary, the
   * ratings and traits, and each civilization's distance.
   */
  panelLines(width: number): PanelLine[] {
    const s = this.strings;
    const r = this.region();
    if (r === undefined) return [];
    const biome = this.biomes.find((b) => b.id === r.biome);
    const out: PanelLine[] = [];
    const text = (t: string, fg: PanelTone = 'text'): void => {
      out.push({ text: t, fg });
    };
    if (r.name.length > 0) text(r.name, 'key');
    text(capitalize(biome?.name ?? r.biome));
    const site = this.site();
    if (site === null) {
      text(s.get('ui.worldmap.no_embark', { biome: biome?.name ?? r.biome }));
      return out;
    }
    if (r.volcano) text(s.get('ui.worldmap.volcano'));
    for (const lack of site.lacks) for (const t of wrapHang(s.get(`ui.site.lack.${lack}`), width, 2)) text(t, 'alert');
    // 02 § Site summary: frostbite is a missing essential too, a warmth the site does not give.
    const frost = site.climate.frostbite;
    if (frost?.arrival === true) {
      for (const t of wrapHang(s.get('ui.site.frostbite_arrival', { c: frost.nightC, limit: frost.limitC }), width, 2)) text(t, 'alert');
    }
    out.push({ text: '', fg: 'text' });
    for (const [name, value] of this.siteRows(site)) {
      for (const t of wrapHang(`${name.padEnd(SITE_LABEL_COLS - 1)} ${value}`, width, SITE_LABEL_COLS)) text(t);
    }
    const [has, lacks] = this.signatureRows(site);
    for (const t of wrapHang(has, width, 2)) text(t);
    for (const t of wrapHang(lacks, width, 2)) text(t, 'alert');
    out.push({ text: '', fg: 'text' });
    out.push({ rating: 'ui.worldmap.wealth', value: r.wealth });
    out.push({ rating: 'ui.worldmap.peril', value: r.peril });
    for (const t of wrapText(s.get('ui.worldmap.peril_note'), width, 3)) text(t, 'dim');
    out.push({ rating: 'ui.worldmap.temper', value: r.temper });
    for (const t of wrapText(s.get('ui.worldmap.temper_note'), width, 3)) text(t, 'dim');
    // Each trait on its own line, and under it what the trait does.
    for (const id of r.traits) {
      text(s.get('ui.worldmap.trait', { traits: this.traitNames.get(id) ?? id }));
      const key = id === 'gemsprings' && !site.water.springs ? 'ui.site.trait.gemsprings_dry' : `ui.site.trait.${id}`;
      if (s.has(key)) for (const t of wrapHang(capitalize(s.get(key)), width, 2)) text(t, 'dim');
    }
    // A fortress that ended here, by its legend record: the site is remembered, not rebuilt (T-672).
    for (const ruin of this.host.ruins?.(r.id) ?? []) for (const t of wrapHang(s.get('ui.worldmap.ruins', ruin), width, 2)) text(t, 'dim');
    out.push({ text: '', fg: 'text' });
    for (const civ of CIVS as readonly Civ[]) {
      const params = {
        civ: capitalize(this.civNames.get(civ) ?? civ),
        n: r.civDistance[civ],
        edge: s.get(`ui.edge_short.${r.nearestEdgeTo[civ]}`),
      };
      // A civilization no land route reaches still sends its caravans and raiders in from that edge (18, 20).
      if (hasLandRoute(this.world.size, r.civDistance[civ])) text(s.get('ui.worldmap.civ', params));
      else for (const t of wrapHang(s.get('ui.worldmap.civ_no_route', params), width, 2)) text(t);
    }
    return out;
  }

  /** The region panel's lines as text, a rating as its name and value. */
  regionLines(width = SIDEBAR_COLS - 2): string[] {
    return this.panelLines(width).map((l) => ('rating' in l ? `${this.strings.get(l.rating)} ${l.value}` : l.text));
  }

  /**
   * The key rows at the foot of the region panel: the move row, then filter and legend, then
   * Embark. The move row gives way, before the text above scrolls, when the text and the three
   * rows (and the gap before them) do not fit.
   */
  private keyRows(panel: { rows: number }, total: number): number {
    return total <= panel.rows - 4 ? 3 : 2;
  }

  /** The rows the region panel's text may use above its key rows and the gap before them. */
  private regionHeight(panel: { rows: number }, total: number): number {
    return Math.max(1, panel.rows - 1 - this.keyRows(panel, total));
  }

  /** The region panel's size as last drawn. */
  private panelSize(): { rows: number; cols: number } {
    return this.last === null ? { rows: 0, cols: SIDEBAR_COLS } : { rows: this.last.rows, cols: this.panelCols };
  }

  /** Scroll the region panel by `delta` rows, inside its text. */
  scrollRegion(delta: number): void {
    const panel = this.panelSize();
    const total = this.panelLines(Math.max(1, panel.cols - 2)).length;
    const max = Math.max(0, total - this.regionHeight(panel, total));
    this.regionScroll = Math.max(0, Math.min(max, this.regionScroll + delta));
  }

  private drawRegion(surface: Surface, panel: { col: number; row: number; cols: number; rows: number }): void {
    const s = this.strings;
    const t = surface.theme;
    const tone: Record<PanelTone, typeof t.text> = { key: t.key, text: t.text, dim: t.dim, alert: t.alert };
    const lines = this.panelLines(Math.max(1, panel.cols - 2));
    const height = this.regionHeight(panel, lines.length);
    this.regionScroll = Math.max(0, Math.min(Math.max(0, lines.length - height), this.regionScroll));
    const shown = lines.slice(this.regionScroll, this.regionScroll + height);
    shown.forEach((l, k) => {
      const row = panel.row + k;
      if ('rating' in l) {
        label(surface, panel.col + 1, row, s.get(l.rating));
        bar(surface, panel.col + 9, row, l.value, RATING_BAR_CELLS, RATING_BAR_CELLS);
        label(surface, panel.col + 9 + RATING_BAR_CELLS + 1, row, String(l.value), { fg: t.value });
      } else {
        label(surface, panel.col + 1, row, l.text, { fg: tone[l.fg], width: panel.cols - 2 });
      }
    });
    // The text scrolls (PageUp, PageDown, the wheel); arrows at the right edge say there is more.
    const edge = panel.col + panel.cols - 1;
    if (this.regionScroll > 0) label(surface, edge, panel.row, '▲', { fg: t.dim });
    if (this.regionScroll + height < lines.length) label(surface, edge, panel.row + height - 1, '▼', { fg: t.dim });
    // The key rows show on every region; off land the last says so in place of Embark.
    let row = panel.row + panel.rows - this.keyRows(panel, lines.length);
    if (this.keyRows(panel, lines.length) === 3) {
      label(surface, panel.col + 1, row, s.get('ui.worldmap.move'), { width: panel.cols - 2 });
      row += 1;
    }
    let c = panel.col + 1;
    c += button(surface, c, row, 'f', s.get('ui.worldmap.filter'), () => this.toggle('filter')) + 2;
    button(surface, c, row, '?', s.get('ui.worldmap.legend'), () => this.toggle('legend'));
    row += 1;
    if (this.site() === null) label(surface, panel.col + 1, row, s.get('ui.worldmap.no_embark_move'), { fg: t.dim, width: panel.cols - 2 });
    else button(surface, panel.col + 1, row, 'Enter', s.get('ui.worldmap.embark'), () => this.embark());
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

  /**
   * A fortress ended on the region (T-690): the world holds its ruin (`WorldMap.ruins`), or the
   * Legends name a fortress there (one that ended before T-686 left ruins).
   */
  ruined(regionId: number): boolean {
    return (this.world.ruins ?? []).some((r) => r.regionId === regionId) || (this.host.ruins?.(regionId).length ?? 0) > 0;
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
    row += 1;
    if (surface.inside(panel.col + 1, row)) surface.cells.setCell(panel.col + 1, row, this.compositor.ruinCell());
    label(surface, panel.col + 3, row, s.get('ui.worldmap.legend_ruin'));
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
      const own = this.keymap.resolve('world_map', press);
      if (own?.id === 'adjust') {
        rows[this.filterList.selected]?.adjust(Number(own.arg) < 0 ? -1 : 1);
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
    if (action === null) {
      // `panel` › PageUp / PageDown: scroll the region panel's text by a page.
      const p = this.mode === 'region' ? this.keymap.resolve('panel', press) : null;
      if (p?.id !== 'scroll') return false;
      const panel = this.panelSize();
      const page = Math.max(1, this.regionHeight(panel, this.panelLines(Math.max(1, panel.cols - 2)).length) - 1);
      this.scrollRegion(Number(p.arg) * page);
      return true;
    }
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

  /** The wheel over the region panel scrolls its text three rows a notch. */
  wheel(w: CellWheel): void {
    if (this.mode !== 'region' || w.col <= this.mapCols) return;
    this.scrollRegion(Math.sign(w.dy) * WHEEL_ROWS);
  }
}
