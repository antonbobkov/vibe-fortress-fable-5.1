/**
 * The keymap loader.
 *
 * `02-systems/24-ui-and-input.md` § Input model: "Every key is rebindable in settings; the keymap
 * is a data table (`keymap.json`) with defaults from `03-content/ui-keymap-and-screens.md`", and § Interfaces: "the keymap
 * resolves to `UiAction`s". `keymap.json` is exported from `03-content/ui-keymap-and-screens.md`
 * § Keymap: rows of `{ context, key, action }` whose `action` is the table's own wording. This
 * module names each wording with an action id, parses the key column (`Ctrl+S`, `Shift+Tab`,
 * `arrows`, `[letter]`, the `1`–`9` range) and resolves a key press in a context to an action.
 */

import type { KeyPress } from '@platform/input';

export type KeyContext = 'global' | 'map' | 'panel' | 'world_map' | 'embark' | 'trade_session' | 'fortress_panel' | 'labor_manager' | 'units_panel' | 'military_panel';

export const KEY_CONTEXTS: readonly KeyContext[] = ['global', 'map', 'panel', 'world_map', 'embark', 'trade_session', 'fortress_panel', 'labor_manager', 'units_panel', 'military_panel'];

/**
 * The contexts added after v1.0.0 (U-06). Their bindings come after the panel hotkeys, so the
 * expanded row index of every older binding, which a saved rebinding is keyed by, stays the same.
 */
const LATE_CONTEXTS: readonly KeyContext[] = ['labor_manager', 'units_panel', 'military_panel'];

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
 * (see {@link argOf}). A wording missing here is a content error the tests catch.
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
  'pan by 1 cell (Shift: 10)': 'pan',
  'z-level down': 'z_down',
  'z-level up': 'z_up',
  'center on the hearth (or wagon)': 'home',
  'zoom in / out': 'zoom',
  'look cursor at the mouse (or map center)': 'look',
  'with a tool: start/end rectangle at the cursor': 'rect_point',
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
  'move the cursor (Shift: 8)': 'cursor',
  'filter panel': 'filter',
  'embark on the region': 'embark',
  'biome legend': 'legend',
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
  'mark the row (does not pause while the list is open)': 'mark',
  'give or take away a title': 'title',
  'rename the dwarf': 'rename_dwarf',
  'add the marked dwarves to a squad': 'to_squad',
  'sleep an hour earlier / later': 'sleep_hour',
  'add or remove every marked dwarf': 'commit',
  'choose the squad leader': 'leader',
  'assign a barracks zone': 'barracks',
  'rename the squad': 'rename_squad',
  'choose the squad weapon class': 'weapon',
  'choose the squad armor': 'armor',
});

/** A parsed key column. `key` is the keymap spelling; `any` stands for `[letter]`. */
export interface KeySpec {
  readonly key: string | 'any-letter';
  readonly ctrl: boolean;
  readonly shift: boolean;
}

export interface Binding {
  readonly context: KeyContext;
  readonly spec: KeySpec;
  readonly id: string;
  readonly arg?: string | number;
  /** The keymap table's own wording for this row (help and settings show it). */
  readonly text?: string;
}

/** Persist only changes from content defaults, keyed by the stable expanded row index. */
export interface KeyOverride { readonly index: number; readonly spec: KeySpec }

export function keyLabel(spec: KeySpec): string {
  return `${spec.ctrl ? 'Ctrl+' : ''}${spec.shift ? 'Shift+' : ''}${spec.key}`;
}

const ARROWS = ['←', '→', '↑', '↓'];

/**
 * Parse one key column into the specs it binds: `Ctrl+S`, `Shift+Tab`, `arrows` (the four
 * arrows), `[letter]` (any letter), a plain key.
 */
export function parseKeySpec(raw: string): KeySpec[] {
  if (raw === 'arrows') return ARROWS.map((key) => ({ key, ctrl: false, shift: false }));
  if (raw === '[letter]') return [{ key: 'any-letter', ctrl: false, shift: false }];
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
      return key;
    case 'zoom':
      return key === '↑' ? 1 : -1;
    case 'scroll':
      return key === 'PageUp' ? -1 : 1;
    case 'field':
      return 1;
    case 'priority':
      return Number(key);
    case 'tab':
      return Number(key) - 1;
    case 'adjust':
      return key === '-' ? -1 : 1;
    default:
      return undefined;
  }
}

export class Keymap {
  private readonly defaults: readonly Binding[];
  private current: Binding[];

  get bindings(): readonly Binding[] { return this.current; }

  constructor(bindings: readonly Binding[]) {
    this.defaults = bindings.map((binding) => ({ ...binding, spec: { ...binding.spec } }));
    this.current = this.defaults.map((binding) => ({ ...binding, spec: { ...binding.spec } }));
  }

  /**
   * Build the keymap from the table rows. The table writes the priority range `1`–`9` as its two
   * ends (rows `1` and `9`); the digits between bind the same action (24 § Input model: "`1`–`9`
   * set the priority").
   */
  static fromRows(rows: readonly KeymapRow[]): Keymap {
    const out: Binding[] = [];
    const late = rows.filter((row) => LATE_CONTEXTS.includes(row.context as KeyContext));
    const add = (list: readonly KeymapRow[]): void => {
    for (const row of list) {
      if (!KEY_CONTEXTS.includes(row.context as KeyContext)) {
        throw new RangeError(`keymap: unknown context "${row.context}"`);
      }
      const id = ACTION_IDS[row.action];
      if (id === undefined) throw new RangeError(`keymap: no action id for "${row.action}"`);
      const context = row.context as KeyContext;
      for (const spec of parseKeySpec(row.key)) {
        const keys = id === 'priority' && row.key === '1' ? ['1', '2', '3', '4', '5', '6', '7', '8'] : [spec.key];
        for (const key of keys) {
          if (id === 'priority' && row.key === '9' && key !== '9') continue;
          const s = { ...spec, key };
          const arg = key === 'any-letter' ? undefined : argOf(id, key);
          const binding: Binding = arg === undefined ? { context, spec: s, id, text: row.action } : { context, spec: s, id, arg, text: row.action };
          if (!out.some((b) => b.context === context && sameSpec(b.spec, s))) out.push(binding);
        }
      }
    }
    };
    add(rows.filter((row) => !late.includes(row)));
    for (const panel of FORTRESS_PANEL_KEYS) out.push({ context: 'fortress_panel', spec: { key: panel.key, ctrl: false, shift: false }, id: panel.id });
    add(late);
    return new Keymap(out);
  }

  /** Every binding of a context. */
  of(context: KeyContext): Binding[] {
    return this.bindings.filter((b) => b.context === context);
  }

  /** The bare letters the fortress panels are bound to now (rebinding moves them). */
  panelLetters(): Set<string> {
    const out = new Set<string>();
    for (const b of this.of('fortress_panel')) if (!b.spec.ctrl && !b.spec.shift && /^[a-z]$/.test(b.spec.key)) out.add(b.spec.key);
    return out;
  }

  overrides(): KeyOverride[] {
    return this.current.flatMap((binding, index) => sameSpec(binding.spec, (this.defaults[index] as Binding).spec) ? [] : [{ index, spec: { ...binding.spec } }]);
  }

  reset(): void {
    this.current = this.defaults.map((binding) => ({ ...binding, spec: { ...binding.spec } }));
  }

  /** Return the existing conflicting row; preserve both bindings until a free key is chosen. */
  rebind(index: number, spec: KeySpec): Binding | null {
    const target = this.current[index];
    if (!target || !spec.key || spec.key === 'any-letter') return target ?? null;
    const conflict = this.current.find((binding, other) => other !== index &&
      (binding.context === target.context || binding.context === 'global' || target.context === 'global' ||
        (binding.context === 'map' && target.context === 'fortress_panel') || (binding.context === 'fortress_panel' && target.context === 'map')) &&
      binding.spec.ctrl === spec.ctrl && binding.spec.key === spec.key && binding.spec.shift === spec.shift && binding.spec.key !== 'any-letter');
    if (conflict) return conflict;
    this.current[index] = { ...target, spec: { ...spec } };
    return null;
  }

  loadOverrides(overrides: readonly KeyOverride[]): void {
    const proposed = this.defaults.map((binding) => ({ ...binding, spec: { ...binding.spec } }));
    for (const override of overrides) {
      if (!Number.isInteger(override.index) || override.index < 0 || override.index >= proposed.length) continue;
      if (!override.spec || typeof override.spec.key !== 'string' || typeof override.spec.ctrl !== 'boolean' || typeof override.spec.shift !== 'boolean') continue;
      if (!override.spec.key || override.spec.key === 'any-letter') continue;
      const binding = proposed[override.index] as Binding;
      proposed[override.index] = { ...binding, spec: { ...override.spec } };
    }
    const conflict = proposed.some((binding, index) => proposed.some((other, otherIndex) => otherIndex !== index && other.context === binding.context && other.spec.ctrl === binding.spec.ctrl && other.spec.key === binding.spec.key && other.spec.key !== 'any-letter' && other.spec.shift === binding.spec.shift));
    if (!conflict) this.current = proposed;
  }

  /**
   * The action a press means in a context, or `null`. An exact modifier match wins; a binding
   * without `Shift` also takes a shifted press (`?`, `<`, `+` are shifted characters, and arrows
   * with `Shift` pan by ten), unless the context binds the shifted key itself (`Shift+Tab`).
   */
  resolve(context: KeyContext, press: KeyPress): UiAction | null {
    const candidates = this.of(context).filter((b) => b.spec.ctrl === press.ctrl);
    const key = press.key;
    // The table writes `Ctrl+S`, `Ctrl+Z`; the browser reports the letter as typed (`z`).
    const match = (b: Binding): boolean =>
      b.spec.key === key ||
      (b.spec.ctrl && b.spec.key.length === 1 && b.spec.key.toLowerCase() === key.toLowerCase()) ||
      (b.spec.key === 'any-letter' && /^[a-zA-Z]$/.test(key));
    const exact = candidates.find((b) => match(b) && b.spec.shift === press.shift && b.spec.key !== 'any-letter');
    const loose = exact ?? candidates.find((b) => match(b) && !b.spec.shift && b.spec.key !== 'any-letter');
    const found = loose ?? candidates.find((b) => match(b) && b.spec.key === 'any-letter');
    if (found === undefined) return null;
    if (found.spec.key === 'any-letter') return { id: found.id, arg: key.toLowerCase(), shift: press.shift };
    let arg = found.arg;
    if (found.id === 'field' && press.shift) arg = -1;
    return arg === undefined ? { id: found.id, shift: press.shift } : { id: found.id, arg, shift: press.shift };
  }
}

function sameSpec(a: KeySpec, b: KeySpec): boolean {
  return a.key === b.key && a.ctrl === b.ctrl && a.shift === b.shift;
}
