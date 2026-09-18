/**
 * The keymap loader.
 *
 * `02-systems/24-ui-and-input.md` § Input model: "Every key is rebindable in settings; the keymap
 * is a data table (`keymap.json`) with defaults from Wave 3", and § Interfaces: "the keymap
 * resolves to `UiAction`s". `keymap.json` is exported from `03-content/ui-keymap-and-screens.md`
 * § Keymap: rows of `{ context, key, action }` whose `action` is the table's own wording. This
 * module names each wording with an action id, parses the key column (`Ctrl+S`, `Shift+Tab`,
 * `arrows`, `[letter]`, the `1`–`9` range) and resolves a key press in a context to an action.
 */

import type { KeyPress } from '@platform/input';

export type KeyContext = 'global' | 'map' | 'panel' | 'world_map' | 'embark' | 'trade_session';

export const KEY_CONTEXTS: readonly KeyContext[] = ['global', 'map', 'panel', 'world_map', 'embark', 'trade_session'];

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
  readonly bindings: readonly Binding[];

  constructor(bindings: readonly Binding[]) {
    this.bindings = bindings;
  }

  /**
   * Build the keymap from the table rows. The table writes the priority range `1`–`9` as its two
   * ends (rows `1` and `9`); the digits between bind the same action (24 § Input model: "`1`–`9`
   * set the priority").
   */
  static fromRows(rows: readonly KeymapRow[]): Keymap {
    const out: Binding[] = [];
    for (const row of rows) {
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
          const binding: Binding = arg === undefined ? { context, spec: s, id } : { context, spec: s, id, arg };
          if (!out.some((b) => b.context === context && sameSpec(b.spec, s))) out.push(binding);
        }
      }
    }
    return new Keymap(out);
  }

  /** Every binding of a context. */
  of(context: KeyContext): Binding[] {
    return this.bindings.filter((b) => b.context === context);
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
