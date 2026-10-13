/**
 * The help panel (`?`): `ui-screens/panels.md` § Help — "Two tabs: `Keys` (the keymap table
 * grouped by context, live from the keymap) and `Legend` (glyphs and colors by category, generated
 * from content: terrain, fluids, creatures, items, buildings, overlays)". 24 § Panels lists `help`
 * among the panels and `ui-keymap-and-screens.md` § Fortress panels gives it the hotkey `?`.
 *
 * The key rows read {@link Keymap.bindings}, so a rebinding (T-M7-07) shows at once. The legend's
 * terrain and fluid rows are the § Terrain rows of `glyphs-and-colors.md` that the compositor
 * draws, named through `render/glyphs.ts` so no glyph index is written twice; the creature, item
 * and building rows are the content tables' own `glyph` and `fg` columns; the overlay rows are the
 * overlay menu's (D-199).
 */

import type { Registry } from '@core/registry';
import type { Rect } from '@render/cellbuffer';
import {
  GLYPH_BOULDER,
  GLYPH_ENGRAVED,
  GLYPH_FORTIFICATION,
  GLYPH_GRASS,
  GLYPH_PAVED_FLOOR,
  GLYPH_RAMP,
  GLYPH_ROUGH_FLOOR,
  GLYPH_ROUGH_WALL,
  GLYPH_SAPLING,
  GLYPH_SMOOTH_FLOOR,
  GLYPH_SOLID_WALL,
  GLYPH_STAIRS_DOWN,
  GLYPH_STAIRS_UP,
  GLYPH_STAIRS_UPDOWN,
  GLYPH_TREE,
} from '@render/glyphs';
import { ACTION_IDS, KEY_CONTEXTS, acceleratorLabel, keyLabel, type Binding, type KeyContext, type Keymap } from '../keymap';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { label, tabs } from '../widgets';
import { OVERLAY_ROWS } from './overlays';

export type HelpTab = 0 | 1;

/** One line of either tab. A heading has no glyph and is drawn in the key colour. */
export interface HelpRow {
  readonly category: string;
  readonly text: string;
  /** The key labels a keys row stands for (`←`, `→`, `↑`, `↓` for "←→↑↓  pan …"). */
  readonly keys?: readonly string[];
  readonly heading?: true;
  /** The palette row the line is drawn in (the legend's colours). */
  readonly fg?: string;
}

/** The action wording of `ui-keymap-and-screens.md` § Keymap for each action id. */
const WORDING: Readonly<Record<string, string>> = Object.freeze(
  Object.entries(ACTION_IDS).reduce<Record<string, string>>((out, [text, id]) => {
    if (out[id] === undefined) out[id] = text;
    return out;
  }, {}),
);

/** The context headings, as the keymap table names its sections. */
const CONTEXT_TITLES: Readonly<Record<string, string>> = Object.freeze({
  global: 'Global',
  map: 'Map',
  panel: 'Panels',
  world_map: 'World map',
  embark: 'Embark',
  trade_session: 'Trade session',
  fortress_panel: 'Fortress panels',
  labor_manager: 'Labor manager',
  units_panel: 'Units panel',
  military_panel: 'Military panel',
});

/** § Terrain, the solid rows: the glyph the compositor draws and the thing it draws. */
const TERRAIN_LEGEND: readonly { readonly glyph: number; readonly name: string }[] = [
  { glyph: GLYPH_ROUGH_WALL, name: 'rough wall' },
  { glyph: GLYPH_SOLID_WALL, name: 'smoothed or block wall' },
  { glyph: GLYPH_ENGRAVED, name: 'engraved wall or floor' },
  { glyph: GLYPH_ROUGH_FLOOR, name: 'rough floor, mud, ash' },
  { glyph: GLYPH_SMOOTH_FLOOR, name: 'smoothed floor' },
  { glyph: GLYPH_PAVED_FLOOR, name: 'paved floor' },
  { glyph: GLYPH_GRASS, name: 'grass, moss, shrub' },
  { glyph: GLYPH_RAMP, name: 'ramp' },
  { glyph: GLYPH_STAIRS_UP, name: 'stairs up' },
  { glyph: GLYPH_STAIRS_DOWN, name: 'stairs down' },
  { glyph: GLYPH_STAIRS_UPDOWN, name: 'stairs up and down' },
  { glyph: GLYPH_FORTIFICATION, name: 'fortification' },
  { glyph: GLYPH_TREE, name: 'tree' },
  { glyph: GLYPH_SAPLING, name: 'sapling' },
  { glyph: GLYPH_BOULDER, name: 'boulder' },
];

/** § Terrain, the fluid and hazard rows, with their ramp colours. */
const FLUID_LEGEND: readonly { readonly glyph: string; readonly name: string; readonly fg: string }[] = [
  { glyph: '~', name: 'water, levels 1-2', fg: 'water_1' },
  { glyph: '≈', name: 'water, levels 3-7', fg: 'water_7' },
  { glyph: '~', name: 'magma, levels 1-2', fg: 'magma_1' },
  { glyph: '≈', name: 'magma, levels 3-7', fg: 'magma_7' },
  { glyph: '▒', name: 'ice', fg: 'ice_blue' },
  { glyph: '^', name: 'fire', fg: 'yellow' },
  { glyph: '*', name: 'web', fg: 'silk_white' },
];

interface GlyphRow {
  readonly id: string;
  readonly name?: string;
  readonly glyph?: string;
  readonly fg?: string;
}

/** The "Work orders" rows of the keys tab, in order. */
const ORDER_HELP_KEYS: readonly string[] = [
  'ui.help.orders.new', 'ui.help.orders.count', 'ui.help.orders.repeat', 'ui.help.orders.remove', 'ui.help.orders.edit', 'ui.help.orders.picker',
];

/** The "Build" rows of the keys tab: placing many and the out-of-stock order (D-U6). */
const BUILD_HELP_KEYS: readonly string[] = ['ui.help.build.drag', 'ui.help.build.corner', 'ui.help.build.order'];

/** The building panel's rows (U-05) and Designate's re-prioritize, which are the panels' own keys. */
const BUILDING_HELP_KEYS: readonly string[] = ['ui.help.building.rows', 'ui.help.building.link', 'ui.help.building.cage', 'ui.help.building.owner', 'ui.help.building.plan', 'ui.help.designate.priority'];

/** Help's context order: the panel hotkeys first (Q14), then the keymap table's order. */
export const HELP_CONTEXT_ORDER: readonly KeyContext[] = ['fortress_panel', ...KEY_CONTEXTS.filter((c) => c !== 'fortress_panel')];

/** A group's keys as one label: a run of digits as a range (`1–9`), arrows side by side, the rest spaced. */
export function keysLabel(labels: readonly string[]): string {
  const shown = labels.map((l) => (l === 'any-letter' ? '[letter]' : l));
  const digits = shown.map(Number);
  if (shown.length > 2 && shown.every((l) => /^\d$/.test(l)) && digits.every((d, k) => k === 0 || d === (digits[k - 1] as number) + 1)) {
    return `${shown[0] as string}–${shown[shown.length - 1] as string}`;
  }
  if (shown.every((l) => ['←', '→', '↑', '↓'].includes(l))) return shown.join('');
  return shown.join(' ');
}

/**
 * Every binding of the live keymap under its context heading, the panel hotkeys first; the keys
 * of one action with the same wording share a row (Q14: "←→↑↓  pan by 1 cell", "1–9  set priority").
 */
export function helpKeyRows(keymap: Keymap, strings?: Strings): HelpRow[] {
  const out: HelpRow[] = [];
  for (const context of HELP_CONTEXT_ORDER) {
    const bindings = keymap.of(context);
    if (bindings.length === 0) continue;
    out.push({ category: context, text: CONTEXT_TITLES[context] ?? context, heading: true });
    const groups: { text: string; id: string; keys: string[] }[] = [];
    for (const binding of bindings) {
      const text = actionText(binding);
      const last = groups[groups.length - 1];
      if (last !== undefined && last.id === binding.id && last.text === text) last.keys.push(keyLabel(binding.spec));
      else groups.push({ text, id: binding.id, keys: [keyLabel(binding.spec)] });
    }
    for (const g of groups) out.push({ category: context, text: `${keysLabel(g.keys)}  ${g.text}`, keys: g.keys });
    // D-U2: an accelerator on a panel letter takes `Shift`; the keymap table has no row to say so.
    if (context === 'panel' && strings !== undefined) out.push({ category: context, text: strings.get('ui.help.accelerators') });
  }
  if (strings !== undefined) {
    // The order list's and the picker's keys (D-U5), which are the panel's own and not keymap rows.
    out.push({ category: 'orders', text: strings.get('ui.help.orders.title'), heading: true });
    for (const key of ORDER_HELP_KEYS) out.push({ category: 'orders', text: strings.get(key) });
    out.push({ category: 'build', text: strings.get('ui.help.build.title'), heading: true });
    for (const key of BUILD_HELP_KEYS) out.push({ category: 'build', text: strings.get(key) });
    out.push({ category: 'building', text: strings.get('ui.help.building.title'), heading: true });
    for (const key of BUILDING_HELP_KEYS) out.push({ category: 'building', text: strings.get(key) });
    out.push({ category: 'jobs', text: strings.get('ui.help.jobs.title'), heading: true });
    out.push({ category: 'jobs', text: strings.get('ui.help.jobs.filter') });
    out.push({ category: 'jobs', text: strings.get('ui.help.jobs.labor', { key: acceleratorLabel('l', keymap.panelLetters()) }) });
    out.push({ category: 'jobs', text: strings.get('ui.help.jobs.state', { key: acceleratorLabel('s', keymap.panelLetters()) }) });
    out.push({ category: 'stocks', text: strings.get('ui.help.stocks.title'), heading: true });
    out.push({ category: 'stocks', text: strings.get('ui.help.stocks.filter') });
    out.push({ category: 'animals', text: strings.get('ui.help.animals.title'), heading: true });
    out.push({ category: 'animals', text: strings.get('ui.help.animals.train', { key: acceleratorLabel('t', keymap.panelLetters()) }) });
    out.push({ category: 'animals', text: strings.get('ui.help.animals.cap', { key: acceleratorLabel('c', keymap.panelLetters()) }) });
    out.push({ category: 'designate', text: strings.get('ui.help.designate.undo') });
    out.push({ category: 'game_menu', text: strings.get('ui.help.game_menu.title'), heading: true });
    out.push({ category: 'game_menu', text: strings.get('ui.help.game_menu.rename') });
    out.push({ category: 'zones', text: strings.get('ui.help.zones.title'), heading: true });
    out.push({ category: 'zones', text: strings.get('ui.help.zones.select') });
    const rows = [
      ['p', 'ui.help.zones.preset'], ['g', 'ui.help.zones.tree'], ['q', 'ui.help.zones.numbers'],
      ['v', 'ui.help.zones.materials'], ['o', 'ui.help.zones.owner'], ['y', 'ui.help.zones.types'],
    ] as const;
    for (const [letter, text] of rows) out.push({ category: 'zones', text: strings.get(text, { key: acceleratorLabel(letter, keymap.panelLetters()) }) });
  }
  return out;
}

/**
 * The wording the keymap table gives this row (Q14: per context, so Trade's `+` reads "quantity"),
 * a panel hotkey's panel name, or the action id read as words.
 */
export function actionText(binding: Binding): string {
  if (binding.text !== undefined) return binding.text;
  if (binding.context === 'fortress_panel') return `${binding.id.charAt(0).toUpperCase()}${binding.id.slice(1)} panel`;
  return WORDING[binding.id] ?? binding.id.replaceAll('_', ' ');
}

/** A key context's heading, as the keymap table names its sections. */
export function contextTitle(context: string): string {
  return CONTEXT_TITLES[context] ?? context;
}

/** The six legend categories of § Help, generated from the content tables. */
export function helpGlyphRows(registry: Registry, charOf: (glyph: number) => string): HelpRow[] {
  const out: HelpRow[] = [];
  const heading = (text: string): void => { out.push({ category: text, text, heading: true }); };
  const fromTable = (category: string, table: string): void => {
    heading(category);
    const rows = registry.table<GlyphRow>(table);
    for (const id of rows.ids()) {
      const row = rows.byId(id) as GlyphRow;
      if (row.glyph === undefined || row.glyph === '') continue;
      const entry: HelpRow = {
        category,
        text: `${Array.from(row.glyph)[0] ?? '?'}  ${row.name ?? id.replaceAll('_', ' ')}`,
        ...(row.fg === undefined ? {} : { fg: row.fg }),
      };
      out.push(entry);
    }
  };

  heading('Terrain');
  for (const row of TERRAIN_LEGEND) out.push({ category: 'Terrain', text: `${charOf(row.glyph)}  ${row.name}` });
  heading('Fluids');
  for (const row of FLUID_LEGEND) out.push({ category: 'Fluids', text: `${row.glyph}  ${row.name}`, fg: row.fg });
  fromTable('Creatures', 'creatures');
  fromTable('Items', 'items');
  fromTable('Buildings', 'buildings');
  heading('Overlays');
  for (const row of OVERLAY_ROWS) out.push({ category: 'Overlays', text: `∙  ${row.label}` });
  return out;
}

export class HelpPanel {
  tab: HelpTab = 0;
  /** The first visible row. Help is a reference list: it scrolls and has no selection. */
  scroll = 0;
  private legend: HelpRow[] | null = null;

  constructor(private readonly registry: Registry, private readonly keymap: Keymap, private readonly strings?: Strings) {}

  rows(charOf: (glyph: number) => string): HelpRow[] {
    if (this.tab === 0) return helpKeyRows(this.keymap, this.strings);
    this.legend ??= helpGlyphRows(this.registry, charOf);
    return this.legend;
  }

  setTab(tab: HelpTab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.scroll = 0;
  }

  /** Scroll by `delta` rows; the draw clamps it to the rows that exist. */
  move(delta: number): void {
    this.scroll = Math.max(0, this.scroll + delta);
  }
}

export function drawHelpPanel(surface: Surface, rect: Rect, panel: HelpPanel): void {
  if (rect.rows <= 0) return;
  const t = surface.theme;
  tabs(surface, rect.col + 1, rect.row, [{ key: '1', label: 'Keys' }, { key: '2', label: 'Legend' }], panel.tab,
    (index) => panel.setTab(index as HelpTab));
  const rows = panel.rows((glyph) => surface.glyphs.char(glyph));
  const width = rect.cols - 2;
  const visible = rect.rows - 1;
  if (visible <= 0) return;
  panel.scroll = Math.max(0, Math.min(Math.max(0, rows.length - visible), panel.scroll));
  for (let k = 0; k < visible; k += 1) {
    const row = rows[panel.scroll + k];
    const line = rect.row + 1 + k;
    surface.fill({ col: rect.col + 1, row: line, cols: width, rows: 1 }, t.black);
    if (row === undefined) continue;
    // § Help: "glyphs and colors by category" — a heading in the key colour, a legend row in the
    // palette row its content table names.
    const fg = row.heading === true ? t.key : row.fg === undefined ? t.text : surface.color(row.fg);
    label(surface, rect.col + 1, line, row.text, { fg, width, keys: false });
  }
  if (rows.length > visible) {
    label(surface, rect.col + rect.cols - 8, rect.row + rect.rows - 1,
      `${panel.scroll + 1}/${rows.length}`, { fg: t.dim, keys: false });
  }
}
