/**
 * The keymap loader.
 *
 * `02-systems/24-ui-and-input.md` § Input model: "Every key the game reacts to is a binding of the
 * keymap, except the fixed keys", and § Interfaces: "the keymap resolves to `UiAction`s".
 * `keymap.json` is exported from `03-content/ui-keymap-and-screens.md` § Keymap: rows of
 * `{ context, key, action }` whose `action` is the table's own wording. This module names each
 * wording with an action id, parses the key column (`Ctrl+S`, `Shift+Tab`, `arrows`, `[letter]`,
 * the accelerator `[w]` / `[S-m]`, the `1`–`9` range) and resolves a key press in a context to an
 * action.
 *
 * Two ways reach a binding. A screen that names actions asks {@link Keymap.resolve}. The fortress
 * panels and the labor manager are written against their default keys, and the screen first passes
 * each press through {@link Keymap.translate}, which turns a rebound key into the default key it
 * replaced and drops a default key that was moved away.
 */

import type { KeyPress } from '@platform/input';

/**
 * Every key context, in the order the editor and Help group them: the fortress screen and its
 * panels, the screens over the fortress, then the screens before it.
 */
export const KEY_CONTEXTS = [
  'global', 'map', 'fortress_panel', 'panel', 'selection',
  'designate_panel', 'build_panel', 'zones_panel', 'zone_inspector', 'units_panel', 'labors_panel', 'jobs_panel',
  'orders_panel', 'workshop_panel', 'building_panel', 'stocks_panel', 'depot_panel', 'military_panel', 'animals_panel',
  'civilizations_panel', 'population_panel', 'mood_panel', 'log_panel', 'look_panel', 'help_panel', 'debug_panel',
  'labor_manager', 'labor_templates', 'trade_session', 'game_menu', 'confirm',
  'main_menu', 'world_gen', 'world_map', 'embark', 'load',
] as const;

export type KeyContext = (typeof KEY_CONTEXTS)[number];

/** Each context's heading, as § Keymap names its table (the editor and Help show it). */
const CONTEXT_TITLES: Readonly<Record<KeyContext, string>> = Object.freeze({
  global: 'Global',
  map: 'Map',
  fortress_panel: 'Fortress panels',
  panel: 'Panels',
  selection: 'Map selection',
  designate_panel: 'Designate panel',
  build_panel: 'Build panel',
  zones_panel: 'Zones panel',
  zone_inspector: 'Zone inspector',
  units_panel: 'Units panel',
  labors_panel: 'Labors panel',
  jobs_panel: 'Jobs panel',
  orders_panel: 'Orders panel',
  workshop_panel: 'Workshop panel',
  building_panel: 'Building panel',
  stocks_panel: 'Stocks panel',
  depot_panel: 'Depot panel',
  military_panel: 'Military panel',
  animals_panel: 'Animals panel',
  civilizations_panel: 'Civilizations panel',
  population_panel: 'Population panel',
  mood_panel: 'Mood panel',
  log_panel: 'Log panel',
  look_panel: 'Look panel',
  help_panel: 'Help panel',
  debug_panel: 'Debug panel',
  labor_manager: 'Labor manager',
  labor_templates: 'Profession templates',
  trade_session: 'Trade session',
  game_menu: 'Game menu',
  confirm: 'Confirmation',
  main_menu: 'Main menu',
  world_gen: 'World generation',
  world_map: 'World map',
  embark: 'Embark',
  load: 'Load',
});

/** A key context's heading; an unknown name is returned as it is. */
export function contextTitle(context: string): string {
  return (CONTEXT_TITLES as Readonly<Record<string, string>>)[context] ?? context;
}

/** The context of each sidebar panel's own keys (panels without own keys have none). */
export const PANEL_CONTEXTS: Readonly<Record<string, KeyContext>> = Object.freeze({
  designate: 'designate_panel', build: 'build_panel', zones: 'zones_panel', units: 'units_panel',
  labors: 'labors_panel', jobs: 'jobs_panel', orders: 'orders_panel', workshop: 'workshop_panel',
  building: 'building_panel', stocks: 'stocks_panel', depot: 'depot_panel', military: 'military_panel',
  animals: 'animals_panel', civilizations: 'civilizations_panel', population: 'population_panel',
  mood: 'mood_panel', log: 'log_panel', look: 'look_panel', help: 'help_panel', debug: 'debug_panel',
});

/** The contexts that act on the fortress screen beside the global, map and panel-letter keys. */
const FORTRESS_CONTEXTS: ReadonlySet<KeyContext> = new Set<KeyContext>(['selection', ...Object.values(PANEL_CONTEXTS), 'zone_inspector']);

/** The panel hotkeys named by ui-keymap-and-screens.md § Fortress panels. */
export const FORTRESS_PANEL_KEYS: readonly { id: string; key: string }[] = [
  { id: 'designate', key: 'd' }, { id: 'build', key: 'b' }, { id: 'zones', key: 'z' },
  { id: 'units', key: 'u' }, { id: 'labors', key: 'l' }, { id: 'jobs', key: 'j' },
  { id: 'orders', key: 'o' }, { id: 'stocks', key: 's' }, { id: 'military', key: 'm' },
  { id: 'animals', key: 'n' }, { id: 'threats', key: 't' }, { id: 'civilizations', key: 'c' },
  { id: 'population', key: 'p' }, { id: 'mood', key: 'e' }, { id: 'log', key: 'a' },
  { id: 'look', key: 'k' }, { id: 'overlays', key: 'f' },
];

/** The default panel letters: the set a panel's own accelerators may not use unshifted (D-U2, S4). */
export const DEFAULT_PANEL_LETTERS: ReadonlySet<string> = new Set(FORTRESS_PANEL_KEYS.map((panel) => panel.key));

/**
 * The accelerator a press means inside a panel (`ui-keymap-and-screens.md` § Panels, D-U2): a
 * letter that is a panel hotkey counts only with `Shift` (shown `[S-m]`), since the bare letter
 * always opens or closes that panel; any other letter counts with or without it. Returns the
 * lower-case letter, or `''`.
 */
export function acceleratorOf(press: KeyPress, reserved: ReadonlySet<string> = DEFAULT_PANEL_LETTERS): string {
  if (press.ctrl || press.alt || press.meta || !/^[a-zA-Z]$/.test(press.key)) return '';
  const letter = press.key.toLowerCase();
  if (!reserved.has(letter)) return letter;
  return press.shift ? letter : '';
}

/** An accelerator as a panel shows it: `[S-m]` for a panel letter, `[w]` for a free one. */
export function acceleratorLabel(letter: string, reserved: ReadonlySet<string> = DEFAULT_PANEL_LETTERS): string {
  return reserved.has(letter) ? `[S-${letter}]` : `[${letter}]`;
}

/** Keys that only modify another: a key capture waits for the key they go with, and they skip no intro. */
export const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'Dead', 'Process', 'Unidentified']);

/** A resolved action; `arg` carries the direction, digit or tab the key stands for. */
export interface UiAction {
  readonly id: string;
  readonly arg?: string | number;
  /** The press's `Shift` (arrows pan by ten, the world-map cursor by eight). */
  readonly shift: boolean;
}

/** One row of `keymap.json`. */
export interface KeymapRow {
  readonly context: string;
  readonly key: string;
  readonly action: string;
}

/**
 * The action id of every wording in the keymap table. The `arg` of an action comes from its key
 * (see {@link argOf}). A wording missing here is a content error the tests catch. Older wordings
 * stay, so that a keymap table of an earlier version still loads.
 */
export const ACTION_IDS: Readonly<Record<string, string>> = Object.freeze({
  'cancel tool → close panel → game menu': 'cancel',
  'pause / resume': 'pause',
  'speed up (1× → 2× → 4×)': 'speed_up',
  'speed down': 'speed_down',
  'quick save': 'quick_save',
  'quick load (confirm)': 'quick_load',
  'save menu': 'save_menu',
  'debug panel': 'debug',
  help: 'help',
  'toggle sidebar': 'toggle_sidebar',
  'undo last designation batch': 'undo',
  'calendar panel': 'calendar',
  'music on / off': 'music',
  'skip the tutorial step': 'tutorial_skip',
  'end the tutorial': 'tutorial_end',
  'pan by 1 cell (Shift: 10)': 'pan',
  'pan or move the map cursor (Shift: 10)': 'pan',
  'z-level down': 'z_down',
  'z-level up': 'z_up',
  'center on the hearth (or wagon)': 'home',
  'zoom in / out': 'zoom',
  'look cursor at the mouse (or map center)': 'look',
  'look at the mouse (or map center)': 'look',
  'with a tool: start/end rectangle at the cursor': 'rect_point',
  'act at the map cursor': 'rect_point',
  'with a designation or zone tool: set priority': 'priority',
  'with a building tool: rotate': 'rotate',
  'with a building tool: cycle material': 'cycle_material',
  'with a selection: cancel designations / remove zone / cancel building': 'delete_selection',
  'move selection': 'select',
  scroll: 'scroll',
  activate: 'activate',
  'next / previous field': 'field',
  'accelerator shown in brackets': 'accelerator',
  'focus the filter field': 'filter_focus',
  'back within nested menus': 'back',
  'move across, or change the focused value': 'across',
  'move the cursor (Shift: 8)': 'cursor',
  'filter panel': 'filter',
  'embark on the region': 'embark',
  'biome legend': 'legend',
  'adjust the selected filter': 'adjust',
  'Dwarves / Supplies / Animals tabs': 'tab',
  'adjust the selected skill or quantity': 'adjust',
  'reroll the selected dwarf': 'reroll',
  rename: 'rename',
  'presets menu': 'presets',
  Embark: 'embark',
  'switch column': 'switch_column',
  quantity: 'adjust',
  offer: 'offer',
  'gift (offer with nothing taken)': 'gift',
  close: 'cancel',
  'none of the selected goods': 'none',
  'all of the selected goods': 'all',
  // U-06: the labor manager and the multi-select lists of the units and military panels.
  'move the labor cursor (Shift+↑↓: mark the rows passed)': 'cursor',
  'mark the dwarf': 'mark',
  'mark all / none': 'mark_all',
  'toggle the labor (for every marked dwarf when the row is marked)': 'toggle',
  'whole row on / off': 'toggle_row',
  'whole column on / off (the marked dwarves, or everyone)': 'toggle_column',
  'labor priority up / down': 'adjust',
  'set the labor priority': 'priority',
  'profession templates': 'templates',
  'jump to the next labor starting with that letter (Shift and the letter for a, c, t)': 'letter_jump',
  'first dwarf': 'first',
  'last dwarf': 'last',
  'choose that template': 'template',
  'show only idle dwarves / all': 'idle_filter',
  'wounded dwarves first / list order': 'wounded_first',
  'mark the row (does not pause while the list is open)': 'mark',
  'give or take away a title': 'title',
  'rename the dwarf': 'rename_dwarf',
  'add the marked dwarves to a squad': 'to_squad',
  'sleep an hour earlier / later': 'sleep_hour',
  'the labor manager on the marked dwarves': 'labor_manager',
  'center the map on the dwarf': 'center',
  'add or remove every marked dwarf': 'commit',
  'choose the squad leader': 'leader',
  'assign a barracks zone': 'barracks',
  'rename the squad': 'rename_squad',
  'choose the squad weapon class': 'weapon',
  'choose the squad armor': 'armor',
  'alert: calm': 'alert_calm',
  'alert: watchful': 'alert_watchful',
  'alert: hearth': 'alert_hearth',
  'new squad': 'new_squad',
  'disband the squad (confirm)': 'disband',
  "set the squad's station": 'station',
  "clear the squad's station": 'clear_station',
  'add patrol points': 'patrol',
  'clear the patrol': 'clear_patrol',
  'order a kill': 'kill',
  'order to follow a dwarf': 'follow',
  "cancel the squad's orders": 'cancel_orders',
  'the next squad mode': 'mode_next',
  'squad mode: off': 'mode_off',
  'squad mode: train': 'mode_train',
  'squad mode: active': 'mode_active',
  'add members': 'add_members',
  'remove members': 'remove_members',
  'ranged or melee': 'ranged',
  // The map selection and the sidebar panels' own keys.
  'forbid everything on the selected tiles': 'forbid',
  'dump everything on the selected tiles (confirm)': 'dump',
  'move the goods on the selected tiles to the depot': 'to_depot',
  dig: 'dig',
  channel: 'channel',
  'stairs up': 'stairs_up',
  'stairs down': 'stairs_down',
  'up/down stairs': 'stairs_updown',
  ramp: 'ramp',
  stairwell: 'stairwell',
  smooth: 'smooth',
  engrave: 'engrave',
  'remove a construction': 'remove',
  'chop trees': 'chop',
  'gather plants': 'gather',
  harvest: 'harvest',
  'traffic (again: the next traffic mode)': 'traffic',
  "give the tool's priority to the last batch": 'reprioritize',
  constructions: 'construction',
  furniture: 'furniture',
  workshops: 'workshop',
  mechanisms: 'mechanism',
  traps: 'trap',
  special: 'special',
  stockpile: 'stockpile',
  'farm plot': 'farm_plot',
  pasture: 'pasture',
  bedroom: 'bedroom',
  'dining hall': 'dining_hall',
  'hearth hall': 'hearth_hall',
  hospital: 'hospital',
  barracks: 'barracks_zone',
  'archery range': 'archery_range',
  'meeting area': 'meeting_area',
  tomb: 'tomb',
  dump: 'dump_zone',
  'fishing zone': 'fishing',
  'gather zone': 'gather_zone',
  'back to the zone types': 'zone_types',
  'unlink a source of a stockpile, or remove the zone (confirm)': 'unlink_or_remove',
  'remove the stockpile zone (confirm)': 'remove_stockpile',
  'resize the zone': 'resize',
  'link a source stockpile': 'link_source',
  'open the stockpile preset dropdown': 'preset',
  'focus the category tree': 'tree',
  'focus numeric settings': 'numbers',
  'open allowed material classes': 'materials',
  "open the bedroom's owner picker": 'owner',
  "a farm plot: the highlighted row's crop for every season in which that crop can grow": 'all_seasons',
  'toggle the checkbox (category tree, material classes)': 'toggle_check',
  'adjust the focused value': 'adjust',
  'move between the jobs and the "Orders waiting" rows': 'waiting',
  'cycle the labors that have jobs': 'cycle_labor',
  'cycle all / open / claimed / blocked': 'cycle_state',
  "raise the job's priority (1–9, wrapping)": 'job_priority',
  'cancel the job': 'cancel_job',
  'new order (opens "Add order")': 'new_order',
  "the selected order's count +1 (`Shift`: +10)": 'count_up',
  "the selected order's count −1 (`Shift`: −10)": 'count_down',
  "the selected order's count +1 (Shift: +10)": 'count_up',
  "the selected order's count −1 (Shift: −10)": 'count_down',
  'repeat the selected order, or the last finished one': 'repeat',
  'remove the selected order (confirm)': 'remove_order',
  "the order's mode": 'order_mode',
  "the order's priority": 'order_priority',
  "the order's material": 'order_material',
  'move the order in its queue': 'reorder',
  'new order at this workshop': 'workshop_new',
  "this workshop's orders": 'workshop_orders',
  'the material of the orders here': 'workshop_material',
  'the next worker': 'workshop_worker',
  'suspend (confirm) or resume': 'workshop_suspend',
  'take the workshop apart (confirm)': 'take_apart',
  "a planned building's build priority": 'build_priority',
  'link a lever or a plate': 'link',
  'unlink the target under the cursor, or release a caged creature (confirm)': 'unlink_release',
  'pull the lever': 'pull',
  'tame the caged creature': 'tame',
  "the owner of a bed's bedroom, or whom a coffin is kept for": 'owner',
  'cancel the plan, or take the building apart (confirm)': 'cancel_or_take_apart',
  'forbid the selected items': 'forbid',
  'dump the selected items (confirm)': 'dump',
  'melt the selected items (confirm)': 'melt',
  'move goods to the depot': 'to_depot',
  'in the depot list: mark the goods': 'depot_mark',
  'return the selected goods to stock': 'depot_remove',
  'open the trade session': 'trade',
  'tame / wild tab': 'tab',
  'pasture the animal': 'pasture',
  'mark for slaughter (confirm)': 'slaughter',
  'edit the breeding cap': 'cap',
  'assign the animal': 'assign',
  'name the animal': 'name',
  'train the animal': 'train',
  'wild tab: hunt toggle': 'hunt',
  'depot panel': 'depot',
  'add a request': 'add_request',
  'remove the request': 'remove_request',
  "the request's priority": 'request_priority',
  'raise / lower the population cap': 'adjust',
  'sort by tier': 'sort',
  'log filter tabs': 'tab',
  'look tabs': 'tab',
  'take apart the building here (confirm)': 'take_apart',
  'Keys / Legend / Start tabs': 'tab',
  'dump save': 'dump_save',
  'replay season log': 'replay',
  'hash world': 'hash',
  // The screens over the fortress and before it.
  Resume: 'resume',
  Save: 'save',
  Load: 'load',
  Settings: 'settings',
  'Rename fortress': 'rename',
  'Retire fortress (confirm)': 'retire',
  'Main menu': 'main_menu',
  Yes: 'yes',
  No: 'no',
  'the default answer': 'default',
  'New world': 'new_world',
  Continue: 'continue',
  Legends: 'legends',
  About: 'about',
  Intro: 'intro',
  Tutorial: 'tutorial',
  Generate: 'generate',
  'random seed': 'randomize',
  'Delete (confirm)': 'delete',
  Export: 'export',
  Import: 'import',
});

/**
 * A parsed key column. `key` is the keymap spelling; `any-letter` stands for `[letter]`. An
 * accelerator (`accel`) is a letter that takes `Shift` while it is a panel letter.
 */
export interface KeySpec {
  readonly key: string | 'any-letter';
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly accel?: true;
}

export interface Binding {
  readonly context: KeyContext;
  readonly spec: KeySpec;
  readonly id: string;
  readonly arg?: string | number;
  /** The keymap table's own wording for this row (help and settings show it). */
  readonly text?: string;
}

/** A saved change from a content default, keyed by the binding's stable name ({@link actionName}). */
export interface KeyOverride { readonly binding: string; readonly spec: KeySpec }

/** A rebinding as versions before the keyed names saved it: the index of the expanded binding row. */
export interface LegacyKeyOverride { readonly index: number; readonly spec: KeySpec }

/** A key as the keymap writes it: `Ctrl+S`, `Shift+Tab`, `F5`; an accelerator by its letter. */
export function keyLabel(spec: KeySpec): string {
  return `${spec.ctrl ? 'Ctrl+' : ''}${spec.shift ? 'Shift+' : ''}${spec.key}`;
}

/**
 * A binding named by its context and default key, `<context>/<default key>`: the names of
 * {@link LEGACY_BINDINGS}, and the form one version saved rebindings under, which still loads.
 */
export function bindingName(context: string, spec: KeySpec): string {
  return `${context}/${keyLabel(spec)}`;
}

/**
 * A binding's stable name, what a saved rebinding is keyed by: its context and action id, the
 * argument its key gives (`map/pan:←`), and `#2`, `#3` … for a further key of the same action
 * (`global/speed_up#2` is `=`). A later change of a default key does not change it.
 */
export function actionName(binding: Pick<Binding, 'context' | 'id' | 'arg'>, ordinal = 1): string {
  return `${binding.context}/${binding.id}${binding.arg === undefined ? '' : `:${binding.arg}`}${ordinal > 1 ? `#${ordinal}` : ''}`;
}

/**
 * Browser shortcuts a page cannot keep from the browser (closing, opening or switching tabs and
 * windows): a binding may not take one (24 § Settings).
 */
export function browserReserved(spec: Pick<KeySpec, 'key' | 'ctrl' | 'shift'>): boolean {
  if (!spec.ctrl) return false;
  const key = spec.key.length === 1 ? spec.key.toLowerCase() : spec.key;
  return ['w', 't', 'n', 'q', 'Tab', 'PageUp', 'PageDown', 'F4'].includes(key);
}

/**
 * The bindings in the order the versions before keyed names expanded them, by name: a saved
 * `{ index }` rebinding is the binding named at that index.
 */
export const LEGACY_BINDINGS: readonly string[] = Object.freeze([
  'global/Esc', 'global/Space', 'global/+', 'global/=', 'global/-', 'global/F5', 'global/F9', 'global/Ctrl+S', 'global/F12', 'global/?', 'global/Tab', 'global/Ctrl+Z',
  'map/←', 'map/→', 'map/↑', 'map/↓', 'map/<', 'map/,', 'map/>', 'map/.', 'map/Home', 'map/Ctrl+↑', 'map/Ctrl+↓', 'map/k', 'map/Enter',
  'map/1', 'map/2', 'map/3', 'map/4', 'map/5', 'map/6', 'map/7', 'map/8', 'map/9', 'map/r', 'map/x', 'map/Delete',
  'panel/↑', 'panel/↓', 'panel/PageUp', 'panel/PageDown', 'panel/Enter', 'panel/Tab', 'panel/Shift+Tab', 'panel/any-letter', 'panel//', 'panel/Backspace',
  'world_map/←', 'world_map/→', 'world_map/↑', 'world_map/↓', 'world_map/f', 'world_map/Enter', 'world_map/?',
  'embark/1', 'embark/2', 'embark/3', 'embark/+', 'embark/-', 'embark/r', 'embark/n', 'embark/p', 'embark/Enter',
  'trade_session/Tab', 'trade_session/+', 'trade_session/-', 'trade_session/Enter', 'trade_session/g', 'trade_session/Esc',
  'fortress_panel/d', 'fortress_panel/b', 'fortress_panel/z', 'fortress_panel/u', 'fortress_panel/l', 'fortress_panel/j', 'fortress_panel/o',
  'fortress_panel/s', 'fortress_panel/m', 'fortress_panel/n', 'fortress_panel/t', 'fortress_panel/c', 'fortress_panel/p', 'fortress_panel/e',
  'fortress_panel/a', 'fortress_panel/k', 'fortress_panel/f',
  'labor_manager/←', 'labor_manager/→', 'labor_manager/↑', 'labor_manager/↓', 'labor_manager/Space', 'labor_manager/*', 'labor_manager/Enter',
  'labor_manager/a', 'labor_manager/c', 'labor_manager/+', 'labor_manager/-', 'labor_manager/1', 'labor_manager/2', 'labor_manager/3',
  'labor_manager/4', 'labor_manager/5', 'labor_manager/6', 'labor_manager/7', 'labor_manager/8', 'labor_manager/9', 'labor_manager/t',
  'labor_manager/letters', 'labor_manager/Esc',
  'units_panel/Space', 'units_panel/*', 'units_panel/i', 'units_panel/Shift+W', 'units_panel/Shift+T', 'units_panel/Shift+N', 'units_panel/Shift+M',
  'units_panel/[', 'units_panel/]',
  'military_panel/Space', 'military_panel/*', 'military_panel/Enter', 'military_panel/Shift+L', 'military_panel/Shift+B', 'military_panel/Shift+N',
  'military_panel/w', 'military_panel/g',
  'global/Shift+Y',
]);

const ARROWS = ['←', '→', '↑', '↓'];

/**
 * Parse one key column into the specs it binds: `Ctrl+S`, `Shift+Tab`, `arrows` (the four
 * arrows), `[letter]` (any letter), an accelerator `[w]` or `[S-m]`, a plain key.
 */
export function parseKeySpec(raw: string): KeySpec[] {
  if (raw === 'arrows') return ARROWS.map((key) => ({ key, ctrl: false, shift: false }));
  if (raw === '[letter]') return [{ key: 'any-letter', ctrl: false, shift: false }];
  const accel = /^\[(?:S-)?([a-z])\]$/.exec(raw);
  if (accel !== null) return [{ key: accel[1] as string, ctrl: false, shift: false, accel: true }];
  const parts = raw.length > 1 && raw.includes('+') ? raw.split('+') : [raw];
  let ctrl = false;
  let shift = false;
  const mods = parts.slice(0, -1);
  for (const m of mods) {
    if (m === 'Ctrl') ctrl = true;
    else if (m === 'Shift') shift = true;
    else throw new RangeError(`keymap: unknown modifier "${m}" in "${raw}"`);
  }
  const key = parts[parts.length - 1] as string;
  if (key.length === 0) throw new RangeError(`keymap: empty key in "${raw}"`);
  return [{ key, ctrl, shift }];
}

/** The argument an action takes from its key: a direction, a digit, a tab index, ±1. */
export function argOf(id: string, key: string): string | number | undefined {
  switch (id) {
    case 'pan':
    case 'cursor':
    case 'select':
    case 'across':
      return key;
    case 'zoom':
      return key === '↑' ? 1 : -1;
    case 'scroll':
      return key === 'PageUp' ? -1 : 1;
    case 'field':
      return 1;
    case 'priority':
    case 'build_priority':
    case 'template':
      return Number(key);
    case 'tab':
      return Number(key) - 1;
    case 'adjust':
      return key === '-' ? -1 : 1;
    default:
      return undefined;
  }
}

/** The keymap's spelling of a press's key: the space bar is `Space`. */
function spelled(key: string): string {
  return key === ' ' ? 'Space' : key;
}

function isLetter(key: string): boolean {
  return /^[a-zA-Z]$/.test(key);
}

/** The same key, a letter in either case. */
function sameKey(a: string, b: string): boolean {
  return a === b || (isLetter(a) && isLetter(b) && a.toLowerCase() === b.toLowerCase());
}

function sameSpec(a: KeySpec, b: KeySpec): boolean {
  return a.key === b.key && a.ctrl === b.ctrl && a.shift === b.shift && (a.accel === true) === (b.accel === true);
}

/** A row that stands for every letter, or a key that never names a binding of its own. */
function pseudo(spec: KeySpec): boolean {
  return spec.key === 'any-letter' || spec.key === 'letters';
}

/** Two keys that one press could mean both of. */
function collide(a: KeySpec, b: KeySpec): boolean {
  if (pseudo(a) || pseudo(b)) return false;
  if (a.accel === true && b.accel === true) return a.key === b.key;
  if (a.accel === true) return !b.ctrl && sameKey(a.key, b.key);
  if (b.accel === true) return !a.ctrl && sameKey(a.key, b.key);
  return a.ctrl === b.ctrl && a.shift === b.shift && sameKey(a.key, b.key);
}

/**
 * Whether a new key for a binding of `target` must be refused because a binding of `other` can
 * act at the same time and already has it (24 § Settings). `spec` is the new key.
 */
function coActive(target: KeyContext, other: KeyContext, spec: KeySpec, held: KeySpec): boolean {
  if (target === other) return true;
  if (target === 'global' || other === 'global') return true;
  if ((target === 'map' && other === 'fortress_panel') || (target === 'fortress_panel' && other === 'map')) return true;
  // The map keys act beside the list keys and every panel's own keys.
  if ((target === 'map' && (other === 'panel' || FORTRESS_CONTEXTS.has(other))) || (other === 'map' && (target === 'panel' || FORTRESS_CONTEXTS.has(target)))) return true;
  // A panel letter may take a letter that panels use only as accelerators: those then take Shift.
  // A panel's own bare letter would be lost behind it.
  if (target === 'fortress_panel') return FORTRESS_CONTEXTS.has(other) && held.accel !== true;
  // A panel's own bare letter would never be reached past the panel letter that has it.
  if (other === 'fortress_panel') return FORTRESS_CONTEXTS.has(target) && spec.accel !== true && !spec.ctrl && !spec.shift && isLetter(spec.key);
  if (target === 'panel' || other === 'panel') return true;
  if ((target === 'selection' && FORTRESS_CONTEXTS.has(other)) || (other === 'selection' && FORTRESS_CONTEXTS.has(target))) return true;
  return (target === 'zones_panel' && other === 'zone_inspector') || (target === 'zone_inspector' && other === 'zones_panel');
}

/** A token of a caption, `[S-t]` or `[Del]`, as a key; `null` for one that names no key. */
function tokenSpec(token: string): KeySpec | null {
  if (token === 'Del') return { key: 'Delete', ctrl: false, shift: false };
  const shifted = /^S-(.)$/.exec(token);
  if (shifted !== null) return { key: shifted[1] as string, ctrl: false, shift: true };
  if (token.length > 1 && token.includes('+') && !token.endsWith('+')) {
    try { return parseKeySpec(token)[0] ?? null; } catch { return null; }
  }
  return token.length === 0 ? null : { key: token, ctrl: false, shift: false };
}

/** Whether a caption's key names this default key. */
function names(token: KeySpec, spec: KeySpec, reserved: ReadonlySet<string>): boolean {
  if (pseudo(spec) || spec.key === 'Esc') return false;
  // A bare panel letter in a caption names the panel; an accelerator on it is written `[S-m]`.
  if (spec.accel === true) return !token.ctrl && sameKey(token.key, spec.key) && (token.shift || !reserved.has(token.key.toLowerCase()));
  return token.ctrl === spec.ctrl && token.shift === spec.shift && sameKey(token.key, spec.key);
}

/** The key words that prose names unbracketed ("↑↓ choose, Enter apply"). */
const KEY_WORDS: readonly string[] = ['↑↓', '←→', '↑', '↓', '←', '→', 'PageUp', 'PageDown', 'Backspace', 'Delete', 'Enter', 'Space', 'Tab', 'Home', 'End'];

export class Keymap {
  private readonly defaults: readonly Binding[];
  private current: Binding[];
  private readonly names: readonly string[];
  /** The `<context>/<default key>` names ({@link bindingName}), which older saves use. */
  private readonly keyNames: readonly string[];
  /** Whether any binding is rebound, until the next change ({@link relabel} runs for every caption drawn). */
  private changedCache: boolean | null = null;

  get bindings(): readonly Binding[] { return this.current; }

  constructor(bindings: readonly Binding[]) {
    this.defaults = bindings.map((binding) => ({ ...binding, spec: { ...binding.spec } }));
    this.current = this.defaults.map((binding) => ({ ...binding, spec: { ...binding.spec } }));
    const seen = new Map<string, number>();
    this.names = this.defaults.map((binding) => {
      const base = actionName(binding);
      const ordinal = (seen.get(base) ?? 0) + 1;
      seen.set(base, ordinal);
      return actionName(binding, ordinal);
    });
    this.keyNames = this.defaults.map((binding) => bindingName(binding.context, binding.spec));
  }

  /**
   * Build the keymap from the table rows, context by context in {@link KEY_CONTEXTS} order. A table
   * that writes a digit range as its two ends (rows `1` and `9` of one action) binds the digits
   * between to the same action (24 § Input model: "`1`–`9` set the priority").
   */
  static fromRows(rows: readonly KeymapRow[]): Keymap {
    const out: Binding[] = [];
    for (const row of rows) {
      if (!(KEY_CONTEXTS as readonly string[]).includes(row.context)) throw new RangeError(`keymap: unknown context "${row.context}"`);
      if (ACTION_IDS[row.action] === undefined) throw new RangeError(`keymap: no action id for "${row.action}"`);
    }
    for (const context of KEY_CONTEXTS) {
      if (context === 'fortress_panel') {
        for (const panel of FORTRESS_PANEL_KEYS) out.push({ context, spec: { key: panel.key, ctrl: false, shift: false }, id: panel.id });
        continue;
      }
      const own = rows.filter((row) => row.context === context);
      for (const row of own) {
        const id = ACTION_IDS[row.action] as string;
        const range = row.key === '1' && own.some((other) => other.action === row.action && other.key === '9');
        for (const spec of parseKeySpec(row.key)) {
          const keys = range ? ['1', '2', '3', '4', '5', '6', '7', '8'] : [spec.key];
          for (const key of keys) {
            const s: KeySpec = { ...spec, key };
            const arg = key === 'any-letter' ? undefined : argOf(id, key);
            const binding: Binding = arg === undefined ? { context, spec: s, id, text: row.action } : { context, spec: s, id, arg, text: row.action };
            if (!out.some((b) => b.context === context && sameSpec(b.spec, s))) out.push(binding);
          }
        }
      }
    }
    return new Keymap(out);
  }

  /** Every binding of a context. */
  of(context: KeyContext): Binding[] {
    return this.bindings.filter((b) => b.context === context);
  }

  /** The default of the binding at `index`. */
  defaultOf(index: number): Binding | undefined {
    return this.defaults[index];
  }

  /** The stable name of the binding at `index` (`map/look`). */
  nameOf(index: number): string {
    return this.names[index] ?? '';
  }

  /** Whether the binding at `index` has a key other than its default. */
  rebound(index: number): boolean {
    const now = this.current[index];
    const was = this.defaults[index];
    return now !== undefined && was !== undefined && !sameSpec(now.spec, was.spec);
  }

  /** Whether any binding has a key other than its default. */
  anyRebound(): boolean {
    this.changedCache ??= this.current.some((_, index) => this.rebound(index));
    return this.changedCache;
  }

  /** A fixed key (§ Fixed keys): `Esc`, and the rows that stand for every letter. */
  fixed(index: number): boolean {
    const spec = this.defaults[index]?.spec;
    return spec === undefined || spec.key === 'Esc' || pseudo(spec);
  }

  /** The bare letters the fortress panels are bound to now (rebinding moves them). */
  panelLetters(): Set<string> {
    const out = new Set<string>();
    for (const b of this.of('fortress_panel')) if (!b.spec.ctrl && !b.spec.shift && /^[a-z]$/.test(b.spec.key)) out.add(b.spec.key);
    return out;
  }

  /** Whether any binding has this key now (an accelerator or `[letter]` aside). */
  binds(press: KeyPress): boolean {
    const key = spelled(press.key);
    return this.current.some((b) => !pseudo(b.spec) && b.spec.accel !== true && b.spec.ctrl === press.ctrl && b.spec.shift === press.shift && sameKey(b.spec.key, key));
  }

  /** The key the binding of `context` whose default is the bare key `key` has now, or `null`. */
  keyNow(context: KeyContext, key: string): KeySpec | null {
    const index = this.defaults.findIndex((b) => b.context === context && b.spec.key === key && !b.spec.ctrl && !b.spec.shift);
    return index < 0 ? null : (this.current[index] as Binding).spec;
  }

  /** A key as a caption or Help writes it: an accelerator `[S-m]` or `[w]`, a Shift letter `[S-n]`, any other as the table does. */
  label(spec: KeySpec): string {
    if (spec.accel === true) return acceleratorLabel(spec.key, this.panelLetters());
    if (spec.shift && !spec.ctrl && isLetter(spec.key)) return `[S-${spec.key.toLowerCase()}]`;
    return keyLabel(spec);
  }

  overrides(): KeyOverride[] {
    return this.current.flatMap((binding, index) => this.rebound(index) ? [{ binding: this.nameOf(index), spec: { ...binding.spec } }] : []);
  }

  /** Every binding back to its default. */
  reset(): void {
    this.current = this.defaults.map((binding) => ({ ...binding, spec: { ...binding.spec } }));
    this.changedCache = null;
  }

  /**
   * One binding back to its default. Returns the binding that has the default key now and so
   * keeps this one where it is, or `null` when it was restored.
   */
  resetOne(index: number): Binding | null {
    const was = this.defaults[index];
    if (was === undefined) return null;
    return this.rebind(index, was.spec);
  }

  /**
   * Give the binding at `index` a new key. Returns the binding that already has it and acts at the
   * same time, and changes nothing; or `null` when the key was set. A fixed binding, or a key that
   * names no single key, returns the binding itself. A letter given to an accelerator stays an
   * accelerator; a binding may always take its own default key back unless its own context uses it.
   */
  rebind(index: number, spec: KeySpec): Binding | null {
    const target = this.current[index];
    const was = this.defaults[index];
    if (target === undefined || was === undefined) return null;
    if (this.fixed(index) || !spec.key || pseudo(spec) || browserReserved(spec)) return target;
    const next = Keymap.capture(was.spec, spec);
    const restoring = sameSpec(next, was.spec);
    // A binding of the same context is named first, then one that acts beside it.
    const conflict = this.current.find((binding, other) => other !== index && binding.context === target.context && collide(binding.spec, next))
      ?? (restoring ? undefined : this.current.find((binding, other) => other !== index && coActive(target.context, binding.context, next, binding.spec) && collide(binding.spec, next)));
    if (conflict) return conflict;
    this.current[index] = { ...target, spec: next };
    this.changedCache = null;
    return null;
  }

  /** The key a capture means for a binding whose default is `def`: an accelerator takes the letter. */
  private static capture(def: KeySpec, spec: KeySpec): KeySpec {
    if (def.accel === true && !spec.ctrl && isLetter(spec.key)) return { key: spec.key.toLowerCase(), ctrl: false, shift: false, accel: true };
    if (isLetter(spec.key) && spec.key.length === 1) return { key: spec.shift || spec.ctrl ? spec.key.toUpperCase() : spec.key.toLowerCase(), ctrl: spec.ctrl, shift: spec.shift };
    return { key: spec.key, ctrl: spec.ctrl, shift: spec.shift };
  }

  /**
   * Load saved rebindings: `{ binding, spec }` named by {@link actionName} (or by
   * {@link bindingName}, as one version saved them), or the `{ index, spec }` of earlier versions,
   * which {@link LEGACY_BINDINGS} names. An entry for no binding, for a fixed key, for a browser
   * shortcut or with a malformed key is skipped. A rebinding that would share a key with a binding
   * that acts beside it (24 § Settings) is dropped, the later of two rebindings in table order
   * first, so the rest still load.
   */
  loadOverrides(overrides: readonly unknown[]): void {
    const proposed = this.defaults.map((binding) => ({ ...binding, spec: { ...binding.spec } }));
    const changed = new Set<number>();
    for (const entry of overrides) {
      if (typeof entry !== 'object' || entry === null) continue;
      const raw = entry as { binding?: unknown; index?: unknown; spec?: unknown };
      const name = typeof raw.binding === 'string' ? raw.binding : typeof raw.index === 'number' && Number.isInteger(raw.index) ? LEGACY_BINDINGS[raw.index] : undefined;
      const byName = name === undefined ? -1 : this.names.indexOf(name);
      const index = byName >= 0 || name === undefined ? byName : this.keyNames.indexOf(name);
      if (index < 0 || this.fixed(index)) continue;
      const spec = raw.spec as Partial<KeySpec> | undefined;
      if (!spec || typeof spec.key !== 'string' || typeof spec.ctrl !== 'boolean' || typeof spec.shift !== 'boolean') continue;
      if (!spec.key || pseudo(spec as KeySpec) || browserReserved(spec as KeySpec)) continue;
      const binding = proposed[index] as Binding;
      proposed[index] = { ...binding, spec: Keymap.capture((this.defaults[index] as Binding).spec, spec as KeySpec) };
      changed.add(index);
    }
    // Drop a rebinding that shares a key with a binding acting beside it, as a rebinding is refused;
    // of two rebindings the later in table order goes. Defaults never clash this way.
    let dropped = true;
    while (dropped) {
      dropped = false;
      for (const index of Array.from(changed).sort((a, b) => b - a)) {
        const binding = proposed[index] as Binding;
        const clash = proposed.some((other, k) => k !== index && (k < index || !changed.has(k)) &&
          (other.context === binding.context || coActive(binding.context, other.context, binding.spec, other.spec)) && collide(other.spec, binding.spec));
        if (clash) {
          proposed[index] = { ...binding, spec: { ...(this.defaults[index] as Binding).spec } };
          changed.delete(index);
          dropped = true;
          break;
        }
      }
    }
    this.current = proposed;
    this.changedCache = null;
  }

  /** Bindings of one context that share a key with another binding of it (none, after a refused rebinding). */
  conflicts(context: KeyContext): Binding[] {
    const list = this.of(context);
    return list.filter((binding) => list.some((other) => other !== binding && collide(other.spec, binding.spec)));
  }

  /** The index in `specs` of the binding of `context` a press means: an exact key, an accelerator, a key without Shift, any letter. */
  private find(context: KeyContext, press: KeyPress, specs: readonly Binding[]): number {
    const key = spelled(press.key);
    let accel = -1;
    let loose = -1;
    let any = -1;
    const reserved = this.panelLetters();
    for (let index = 0; index < specs.length; index += 1) {
      const b = specs[index] as Binding;
      if (b.context !== context) continue;
      const s = b.spec;
      if (s.key === 'any-letter') {
        if (any < 0 && !press.ctrl && isLetter(key)) any = index;
        continue;
      }
      if (s.accel === true) {
        if (accel < 0 && !press.alt && !press.meta && acceleratorOf({ ...press, key }, reserved) === s.key) accel = index;
        continue;
      }
      if (s.ctrl !== press.ctrl) continue;
      const exact = s.key === key || ((s.ctrl || s.shift) && sameKey(s.key, key));
      if (exact && s.shift === press.shift) return index;
      if (loose < 0 && !s.shift && sameKey(s.key, key)) loose = index;
    }
    return accel >= 0 ? accel : loose >= 0 ? loose : any;
  }

  /**
   * The action a press means in a context, or `null`. An exact modifier match wins, then an
   * accelerator; a binding without `Shift` also takes a shifted press (`?`, `<`, `+` are shifted
   * characters, and arrows with `Shift` pan by ten), unless the context binds the shifted key
   * itself (`Shift+Tab`).
   */
  resolve(context: KeyContext, press: KeyPress): UiAction | null {
    const index = this.find(context, press, this.current);
    const found = this.current[index];
    if (found === undefined) return null;
    if (found.spec.key === 'any-letter') return { id: found.id, arg: press.key.toLowerCase(), shift: press.shift };
    let arg = found.arg;
    if (found.id === 'field' && press.shift) arg = -1;
    return arg === undefined ? { id: found.id, shift: press.shift } : { id: found.id, arg, shift: press.shift };
  }

  /**
   * A press as code written against the default keys of `contexts` reads it (the first context
   * first): a rebound key becomes the default key it replaced, keeping a `Shift` that only modifies
   * it; a default key that was moved away gives `null`, unless a binding of `others` has it now; any
   * other press is returned as it is.
   */
  translate(contexts: readonly KeyContext[], press: KeyPress, others: readonly KeyContext[] = []): KeyPress | null {
    for (const context of contexts) {
      const index = this.find(context, press, this.current);
      // `[letter]` stands for every letter and claims none of them.
      if (index < 0 || pseudo((this.current[index] as Binding).spec)) continue;
      const now = (this.current[index] as Binding).spec;
      const was = (this.defaults[index] as Binding).spec;
      if (sameSpec(now, was)) return press;
      if (was.accel === true) return { ...press, key: was.key.toUpperCase(), shift: true, ctrl: false };
      const carry = !was.shift && !now.shift && now.accel !== true && press.shift && !isLetter(was.key);
      return { ...press, key: was.key, ctrl: was.ctrl, shift: was.shift || carry };
    }
    for (const context of contexts) {
      const index = this.find(context, press, this.defaults);
      if (index < 0 || pseudo((this.defaults[index] as Binding).spec) || !this.rebound(index)) continue;
      if (others.some((other) => this.find(other, press, this.current) >= 0)) return press;
      // A context that also reads every letter (the labor manager's jump) still gets the letter, in
      // the form its letter row reads: with Shift.
      const was = (this.defaults[index] as Binding).spec;
      if (isLetter(was.key) && !was.ctrl && this.defaults.some((b) => b.context === context && pseudo(b.spec))) {
        return { ...press, key: press.key.toUpperCase(), shift: true };
      }
      return null;
    }
    return press;
  }

  /**
   * A caption with the keys of its rebound bindings: each `[k]` token (`[S-t]`, `[Del]`, the `b` of
   * `[b > Workshops]`) names the default key of the first binding of `contexts` that has it, and
   * becomes that binding's key when it has been rebound. A token naming a panel letter makes that
   * panel's own keys come first for the tokens after it ("[m] then [3]"). With `words`, the key words
   * of prose (`Enter`, `↑↓`, a leading key column) are read the same way. Nothing changes while the
   * bindings are the defaults.
   */
  relabel(text: string, contexts: readonly KeyContext[], words = false): string {
    if (!this.anyRebound()) return text;
    let lead: KeyContext | null = null;
    const reserved = this.panelLetters();
    const lookup = (token: KeySpec): string | null => {
      const order = lead === null ? contexts : [lead, ...contexts];
      for (const context of order) {
        const index = this.defaults.findIndex((b) => b.context === context && names(token, b.spec, reserved));
        if (index < 0) continue;
        const binding = this.current[index] as Binding;
        if (binding.context === 'fortress_panel') lead = PANEL_CONTEXTS[binding.id] ?? null;
        if (!this.rebound(index)) return null;
        const shown = this.label(binding.spec);
        return shown.startsWith('[') && shown.endsWith(']') ? shown.slice(1, -1) : shown;
      }
      return null;
    };
    const bracketed = text.replace(/\[([^\]\s]{1,8})((?: [^\]]*)?)\]/g, (whole, key: string, rest: string) => {
      const token = tokenSpec(key);
      const shown = token === null ? null : lookup(token);
      return shown === null ? whole : `[${shown}${rest}]`;
    });
    if (!words) return bracketed;
    const word = (w: string): string => {
      if (w === '↑↓' || w === '←→') {
        const a = lookup({ key: w.charAt(0), ctrl: false, shift: false });
        const b = lookup({ key: w.charAt(1), ctrl: false, shift: false });
        return a === null && b === null ? w : `${a ?? w.charAt(0)} ${b ?? w.charAt(1)}`;
      }
      const token = tokenSpec(w);
      return token === null ? w : lookup(token) ?? w;
    };
    // A leading key column ("r  repeat", "+ = -  count") names keys before its two spaces.
    const gap = bracketed.indexOf('  ');
    const head = gap > 0 && !bracketed.slice(0, gap).includes('[') ? bracketed.slice(0, gap).split(' ').map(word).join(' ') : null;
    const body = head === null ? bracketed : bracketed.slice(gap);
    const pattern = new RegExp(`(^|[\\s(,;:/])((?:Ctrl|Shift)\\+[^\\s,;:)]+|${KEY_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=$|[\\s),;:/.])`, 'g');
    const relabeled = body.replace(pattern, (_whole, before: string, w: string) => `${before}${word(w)}`);
    return head === null ? relabeled : `${head}${relabeled}`;
  }
}
