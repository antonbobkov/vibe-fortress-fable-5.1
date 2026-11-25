#!/usr/bin/env node
// The strings table audit of `archive/build-plan/M7-outside-world.md` T-M7-10: "`strings.json` complete;
// `scripts/strings-check.mjs` fails on a missing key or an unused key", over
// `03-content/ui-keymap-and-screens.md` § Strings ("Every player-facing string is a key in
// `strings.json`") and `01-architecture/content-pipeline.md` § Strings.
//
// The table the UI reads is `strings.json` plus the `UI_STRINGS` defaults of `src/ui/strings.ts`,
// which a row of the content table with the same key overrides (D-061). This script checks both
// halves against every reference in `src/`:
//
//   missing  a `get('k')` of a strings namespace, or an announcement `stringKey`, that neither
//            table answers;
//   unused   a key of either table that no reference can reach.
//
// A reference is a literal in a strings namespace (`strings.get('ui.load.title')`, or a key chosen
// in code), a template prefix (`ui.zone.type.${id}` reaches every `ui.zone.type.*` key), or an
// announcement's `stringKey`, which reaches the key itself and, with a `keyField`, the keys under
// it. The `confirm`, `hint`, `tutorial`, `milestone` and `thought` namespaces are the canonical values of
// content rows (`ui-keymap-and-screens.md` § Strings), so each of their keys is reached by its row,
// and the script also checks the two copies against each other in both directions.
//
// Usage: node scripts/strings-check.mjs [--fixture <dir>]

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every `.ts` file under a directory, sorted, so the report is deterministic. */
function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (entry.name.endsWith('.ts')) out.push(path);
  }
  return out;
}

/** The keys of the `UI_STRINGS` object of `src/ui/strings.ts`. */
export function uiStringKeys(text) {
  const body = text.slice(text.indexOf('UI_STRINGS'));
  const end = body.indexOf('\n});');
  if (end < 0) throw new Error('strings-check: UI_STRINGS is not an object literal ending in "});"');
  const out = [];
  for (const match of body.slice(0, end).matchAll(/^ {2}'([^']+)':/gm)) out.push(match[1]);
  if (out.length === 0) throw new Error('strings-check: no UI_STRINGS keys parsed');
  return out;
}

/**
 * The references a source file makes. `exact` must exist; `soft` may (a `has()` probe); `prefixes`
 * reach every key under them.
 */
export function referencesIn(text, namespaces) {
  const exact = new Set();
  const soft = new Set();
  const prefixes = new Set();
  const inNamespace = (key) => namespaces.some((ns) => key === ns || key.startsWith(`${ns}.`));
  // `get('k')`: the key must exist. `has('k')` is a probe, and any other literal in a namespace is
  // a key the code chooses (`announce.pet_died`), so both only mark the key as reached.
  for (const match of text.matchAll(/'([A-Za-z][A-Za-z0-9_.]*)'/g)) {
    if (inNamespace(match[1])) soft.add(match[1]);
  }
  for (const match of text.matchAll(/\.get\(\s*'([^']+)'/g)) {
    if (inNamespace(match[1])) exact.add(match[1]);
  }
  // Any template literal whose static head is a key namespace: `ui.zone.type.${id}`.
  for (const match of text.matchAll(/`([A-Za-z][A-Za-z0-9_.]*)\$\{/g)) {
    const head = match[1];
    if (inNamespace(head)) prefixes.add(head);
  }
  // An announcement's `stringKey` reaches the key and, with a `keyField`, the keys under it.
  for (const match of text.matchAll(/register\.announcement\(([\s\S]*?)\}\s*\)\s*;/g)) {
    const call = match[1];
    const key = /stringKey:\s*'([^']+)'/.exec(call)?.[1];
    if (key === undefined) continue;
    if (/keyField:/.test(call)) prefixes.add(key);
    else exact.add(key);
  }
  return { exact, soft, prefixes };
}

/**
 * The string and template literals of a TypeScript source, comments and regular expressions left
 * out: `{ line, text, at }`, each `${…}` of a template written as `\u0000`. `at` is where the literal
 * stands: the brackets around it, outermost first, each `{ open, callee, first, arg }` (`open` one
 * of `(`, `{`, `[` or `` ` `` for a template's `${…}`; a call's `callee` and its `first` argument
 * when that is a literal; `arg`, the argument or element the literal is in; a template's `text`),
 * and `assigned`, the name a plain `name = '…'` gives it.
 */
export function literalsIn(text, outer = []) {
  const out = [];
  let i = 0;
  let line = 1;
  // The last significant character, to tell a regular expression's `/` from a division's.
  let last = '';
  let word = '';
  // The brackets open at `i`; the last word (`.get` after a dot) and the character before it; the
  // run of operator characters just read; and the name being given a value (`name = …`, `name: …`)
  // at the depth `givenAt`, until the statement, the property or its bracket ends.
  const stack = [];
  let prevWord = '';
  let beforeWord = '';
  let ops = '';
  let given = '';
  let givenAt = -1;
  const regexAfter = '(,=:[!&|?{};+-*%<>~^';
  const where = () => [...outer, ...stack.map((f) => ({ open: f.open, callee: f.callee, first: f.first, arg: f.arg, frame: f }))];
  /** Whether the code after `j` compares with the literal: `'x' === a`, `'x' !== a`. */
  const comparedAfter = (j) => /^\s*[!=]==?[^>]/.test(text.slice(j, j + 5));
  const emit = (literal, end) => {
    const top = stack[stack.length - 1];
    if (top !== undefined && top.open === '(' && top.arg === 0 && top.first === undefined) top.first = literal.text;
    const compared = /^(?:[!=]==?)$/.test(ops) || comparedAfter(end);
    // Plain parentheses keep the name: `name = (row?.name ?? 'animal').toLowerCase()`.
    const plain = givenAt >= 0 && stack.slice(givenAt).every((f) => f.open === '(' && f.callee === '');
    out.push({ ...literal, at: where(), assigned: plain ? given : '', compared });
  };
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (c === '\n') { line += 1; i += 1; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i += 1; continue; }
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i += 1; continue; }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) { if (text[i] === '\n') line += 1; i += 1; }
      i += 2;
      continue;
    }
    if (c === '/' && (last === '' || regexAfter.includes(last) || word === 'return')) {
      let j = i + 1;
      let inClass = false;
      while (j < text.length && text[j] !== '\n' && (inClass || text[j] !== '/')) {
        if (text[j] === '\\') j += 1;
        else if (text[j] === '[') inClass = true;
        else if (text[j] === ']') inClass = false;
        j += 1;
      }
      i = j + 1;
      while (i < text.length && /[a-z]/.test(text[i])) i += 1;
      last = '/'; word = '';
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let s = '';
      while (j < text.length && text[j] !== c && text[j] !== '\n') {
        if (text[j] === '\\') { s += text[j + 1]; j += 2; } else { s += text[j]; j += 1; }
      }
      emit({ line, text: s }, j + 1);
      i = j + 1; last = c; word = '';
      continue;
    }
    if (c === '`') {
      const start = line;
      let j = i + 1;
      let s = '';
      const frame = { open: '`', text: '' };
      const inside = [...where(), { open: '`', frame }];
      while (j < text.length && text[j] !== '`') {
        if (text[j] === '\\') { s += text[j + 1]; j += 2; continue; }
        if (text[j] === '$' && text[j + 1] === '{') {
          // The expression inside is code: its own literals are read on their own.
          let depth = 1;
          let k = j + 2;
          while (k < text.length && depth > 0) {
            const d = text[k];
            if (d === '{') depth += 1;
            else if (d === '}') depth -= 1;
            else if (d === '`' || d === "'" || d === '"') {
              k += 1;
              while (k < text.length && text[k] !== d) { if (text[k] === '\\') k += 1; k += 1; }
            }
            k += 1;
          }
          for (const inner of literalsIn(text.slice(j + 2, k - 1), inside)) out.push({ ...inner, line: line + inner.line - 1 });
          for (const ch of text.slice(j, k)) if (ch === '\n') line += 1;
          s += '\u0000';
          j = k;
          continue;
        }
        if (text[j] === '\n') line += 1;
        s += text[j];
        j += 1;
      }
      frame.text = s;
      emit({ line: start, text: s }, j + 1);
      i = j + 1; last = '`'; word = '';
      continue;
    }
    if (/[A-Za-z0-9_$]/.test(c)) {
      let j = i;
      while (j < text.length && /[A-Za-z0-9_$]/.test(text[j])) j += 1;
      word = text.slice(i, j);
      prevWord = last === '.' ? `.${word}` : word;
      beforeWord = last;
      last = 'a';
      i = j;
      continue;
    }
    // A call's callee is the word before its `(`, or `>` for a generic call (`table<Row>('items')`).
    if (c === '(' || c === '{' || c === '[') stack.push({ open: c, callee: c === '(' && (last === 'a' || last === '>') ? (last === 'a' ? prevWord : '>') : '', first: undefined, arg: 0 });
    else if (c === ')' || c === '}' || c === ']') stack.pop();
    else if (c === ',' && stack.length > 0) stack[stack.length - 1].arg += 1;
    if (stack.length < givenAt || ((c === ';' || c === ',') && stack.length <= givenAt)) { given = ''; givenAt = -1; }
    // `name = …` (not `==`, `=>`, `!=`, `<=` or `>=`), and an object literal's `name: …`.
    const top = stack[stack.length - 1];
    if ((c === '=' && last === 'a' && n !== '=' && n !== '>') ||
      (c === ':' && last === 'a' && top !== undefined && top.open === '{' && (beforeWord === '{' || beforeWord === ','))) {
      given = `${prevWord.replace(/^\./, '')}${c === ':' ? ':' : ''}`;
      givenAt = stack.length;
    }
    ops = '=!<>&|?:+-*%^~'.includes(last) ? ops + c : c;
    last = c; word = '';
    i += 1;
  }
  return out;
}

/** The `KeyboardEvent.key` names a panel compares a key press with. */
const KEY_NAMES = new Set([
  'Enter', 'Esc', 'Escape', 'Tab', 'Space', 'Backspace', 'Delete', 'Del', 'Home', 'End', 'Insert',
  'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', 'Control', 'Alt', 'Meta',
]);

/**
 * Whether a literal reads as text for the player rather than as an identifier: it has a word of
 * two letters or more, and is not a key or id (`ui.zone.type.${id}`, `hall_spirit`), a command or
 * event type (`SetSquadMode`), a key name (`Enter`) or a module path.
 */
export function looksPlayerFacing(literal) {
  const plain = literal.replace(/\u0000/g, '');
  if (!/[A-Za-z]{2,}/.test(plain)) return false;
  if (KEY_NAMES.has(plain)) return false;
  if (/^[A-Z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/.test(plain)) return false;
  if (/^(?:\.{1,2}|@[a-z]+)\/[\w./-]+$/.test(plain)) return false;
  return !literal.split('\u0000').every((part) => /^(?:[a-z_][A-Za-z0-9_]*)?(?:[.:/-][A-Za-z0-9_]*)*$/.test(part));
}

/** The widgets' and the surface's drawing calls, each with the argument that is drawn as text. */
export const DRAWN_ARGS = new Map([
  ['label', 3], ['wrapLabel', 3], ['labelRow', 4], ['button', 4], ['toggle', 4], ['separator', 4],
  ['drawnCols', 1], ['keyCells', 1], ['cutText', 0], ['wrapHang', 0], ['.text', 2],
]);

/** Names whose value is drawn: a variable (`name = 'food'`) or a widget row's field (`label: 'none'`). */
export const TEXT_NAMES = new Set([
  'name', 'text', 'title', 'line', 'caption', 'what', 'word', 'words', 'label', 'noun',
  'label:', 'text:', 'caption:',
]);

/**
 * Whether a literal of one word (`food`, `none`, the article `a`), which reads like an id and so
 * passes {@link looksPlayerFacing}, stands where the code draws it, as `literalsIn` gives where it
 * stands: not compared (`kind === 'food'`), and
 *
 * - the text argument of a drawing call ({@link DRAWN_ARGS}): `label(s, 0, 0, 'none')`;
 * - a placeholder's value in a call whose first argument is a strings key:
 *   `strings.get('ui.creature.the_species', { species: name ?? 'animal' })`;
 * - a part of a template that builds text (a space in its own text): `` `${n === 1 ? 'a' : 'an'} ${noun}` ``;
 * - or the value given to a name of {@link TEXT_NAMES}: `name = 'food'`, `{ id: '0', label: 'none' }`.
 *
 * Plain parentheses between the literal and its place do not hide it: `(row?.name ?? 'animal')`.
 */
export function drawnWord(literal) {
  if (!/^[A-Za-z]+$/.test(literal.text) || literal.compared === true || literal.at === undefined) return false;
  if (TEXT_NAMES.has(literal.assigned)) return true;
  const at = literal.at;
  let k = at.length - 1;
  while (k >= 0 && at[k].open === '(' && at[k].callee === '') k -= 1;
  const place = at[k];
  if (place === undefined) return false;
  if (place.open === '(') return DRAWN_ARGS.get(place.callee) === place.arg;
  if (place.open === '`') return / /.test(place.frame.text.replace(/\u0000/g, ''));
  const call = at[k - 1];
  return place.open === '{' && call !== undefined && call.open === '(' && call.arg >= 1 &&
    typeof call.first === 'string' && /^[a-z]+(?:\.[a-z0-9_]+)+$/.test(call.first);
}

/**
 * The UI's code, where every player-facing text is a strings key (`content-pipeline.md` § Strings):
 * `strings:check` fails on a literal there that reads as text. The default table itself
 * (`LITERAL_TABLE`) is the one place the texts are written.
 */
export const LITERAL_DIRS = ['src/ui'];
const LITERAL_TABLE = 'src/ui/strings.ts';

/**
 * Files of those directories the scan leaves out, each with why. None: a literal that is not text
 * for the player despite its look is listed in `LITERAL_ALLOWED`, or its table in `LITERAL_TABLES_ALLOWED`.
 */
export const LITERAL_FILES_SKIPPED = new Map([]);

/** The stored values of the Settings rows (`ui-keymap-and-screens.md` § Settings), compared and saved; drawn through `ui.settings.value.*`. */
const SETTING_VALUES = ['hits only', 'first time', 'down a level', 'up a level'];

/** Literals that read as text but are not drawn for the player, by file: `file` → texts. */
export const LITERAL_ALLOWED = new Map([
  // The command type `Designate` (command-catalog.md), one word with one capital.
  ['src/ui/panels/designate.ts', ['Designate']],
  ['src/ui/screens/fortress.ts', ['Designate', ...SETTING_VALUES]],
  // The end 10 gives a recipe job's activity text, read to find the recipe; never drawn.
  ['src/ui/panels/units.ts', [' (recipe)']],
  // The hospital zone's setting key for its wanted supplies (17), never drawn.
  ['src/ui/panels/zones.ts', ['desired supplies']],
  // The settings store's values and defaults (24 § State).
  ['src/ui/constants.ts', SETTING_VALUES],
  ['src/ui/settings.ts', SETTING_VALUES],
  // Event types (`Starving` of 15, `Slept` of 14), one word with one capital.
  ['src/ui/announcements.ts', ['Starving']],
  ['src/ui/hints.ts', ['Starving', 'Slept']],
  // The world map's filter rows: `x` marks a ticked row (`[x]`), a mark like the stockpile editor's `■`, not a word.
  ['src/ui/screens/world_map.ts', ['x']],
  // A catalog row's `condition` (`embark.md` § Supplies), parsed; and the presets menu's option id.
  ['src/ui/screens/embark.ts', [' or ', '@loadouts']],
  // The close button's caption measured for its column; `button` draws it from the key and the string.
  ['src/ui/screens/labor_manager.ts', ['[Esc] ${}']],
  // The keymap loader: key names and the key column's notation (`Ctrl+`, `[letter]`, `Bksp`), the
  // binding names of older saves (`global/Ctrl+S`), its errors on a bad keymap row (a content error,
  // thrown, never drawn) and a regular expression's source.
  ['src/ui/keymap.ts', [
    'Fn', 'Dead', 'Process', 'Unidentified', 'Ctrl+', 'Shift+', 'Ctrl', '[letter]', 'Bksp',
    'global/+', 'global/=', 'global/Ctrl+S', 'global/?', 'global/Ctrl+Z', 'global/Shift+Y',
    'map/←', 'map/→', 'map/↑', 'map/↓', 'map/<', 'map/,', 'map/>', 'map/Ctrl+↑', 'map/Ctrl+↓',
    'panel/↑', 'panel/↓', 'panel/Shift+Tab',
    'world_map/←', 'world_map/→', 'world_map/↑', 'world_map/↓', 'world_map/?',
    'embark/+', 'trade_session/+',
    'labor_manager/←', 'labor_manager/→', 'labor_manager/↑', 'labor_manager/↓', 'labor_manager/*', 'labor_manager/+',
    'units_panel/*', 'units_panel/Shift+W', 'units_panel/Shift+T', 'units_panel/Shift+N', 'units_panel/Shift+M', 'units_panel/[', 'units_panel/]',
    'military_panel/*', 'military_panel/Shift+L', 'military_panel/Shift+B', 'military_panel/Shift+N',
    '${}/Shift+${}',
    'keymap: unknown modifier "${}" in "${}"', 'keymap: empty key in "${}"', 'keymap: unknown context "${}"', 'keymap: no action id for "${}"',
    '(^|[\\s(,;:/])((?:Ctrl|Shift)\\+[^\\s,;:)]+|${})(?=$|[\\s),;:/.])',
  ]],
]);

/**
 * Object tables whose every literal is allowed, by file, each with why: `file` → the table's name,
 * whose body runs from `<name>` to the first line `});` after it.
 */
export const LITERAL_TABLES_ALLOWED = new Map([
  // The keymap's action wordings are data: `keymap.json` carries each as its § Keymap row's own
  // text (`content:export`), and Help and the editor draw that row's text. `ACTION_IDS` only names
  // each wording with an action id, so its keys are the wordings, copied to be matched.
  ['src/ui/keymap.ts', 'ACTION_IDS'],
]);

/** The line span of a file's allowed table, `[first, last]`, or null. */
function tableLines(text, name) {
  const at = text.indexOf(`${name}:`) >= 0 ? text.indexOf(`${name}:`) : text.indexOf(`${name} =`);
  if (at < 0) return null;
  const end = text.indexOf('\n});', at);
  if (end < 0) return null;
  const lineOf = (index) => text.slice(0, index).split('\n').length;
  return [lineOf(at), lineOf(end + 1)];
}

/** Each literal of the scanned UI code that reads as player-facing text, or a single word it draws (`drawnWord`): `path:line: "text"`. */
export function panelLiterals(dir = root) {
  const out = [];
  for (const sub of LITERAL_DIRS) {
    let files;
    try {
      files = sourceFiles(join(dir, sub));
    } catch {
      continue;
    }
    for (const file of files) {
      const rel = relative(dir, file).replace(/\\/g, '/');
      if (rel === LITERAL_TABLE || LITERAL_FILES_SKIPPED.has(rel)) continue;
      const allowed = LITERAL_ALLOWED.get(rel) ?? [];
      const source = readFileSync(file, 'utf8');
      const table = LITERAL_TABLES_ALLOWED.has(rel) ? tableLines(source, LITERAL_TABLES_ALLOWED.get(rel)) : null;
      for (const literal of literalsIn(source)) {
        const { line, text } = literal;
        if (!(looksPlayerFacing(text) || drawnWord(literal)) || allowed.includes(text.replace(/\u0000/g, '${}'))) continue;
        if (table !== null && line >= table[0] && line <= table[1]) continue;
        out.push(`${rel}:${line}: ${JSON.stringify(text.replace(/\u0000/g, '${}'))}`);
      }
    }
  }
  return out;
}

/**
 * Each `new Strings()` of the game's code (`src`), outside comments: `path:line`. A table made with
 * no registry holds the defaults alone, so a `strings.json` row never reaches the text drawn
 * through it; the code draws with the game's strings (`Game.strings`, built with the registry),
 * passed to each helper that words a line.
 */
export function defaultTables(dir = root) {
  const out = [];
  let files;
  try {
    files = sourceFiles(join(dir, 'src'));
  } catch {
    return out;
  }
  for (const file of files) {
    const rel = relative(dir, file).replace(/\\/g, '/');
    readFileSync(file, 'utf8').split('\n').forEach((text, k) => {
      const code = text.trimStart();
      if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
      if (/\bnew\s+Strings\s*\(\s*\)/.test(code.replace(/\/\/.*$/, ''))) out.push(`${rel}:${k + 1}`);
    });
  }
  return out;
}

/** The namespaces whose keys are the canonical text of a content table's rows. */
export const MIRRORED = [
  { ns: 'confirm', table: 'confirmations' },
  { ns: 'hint', table: 'hints' },
  { ns: 'tutorial', table: 'tutorial' },
  { ns: 'milestone', table: 'milestones' },
  { ns: 'thought', table: 'thoughts' },
];

export function check(dir = root) {
  const content = JSON.parse(readFileSync(join(dir, 'src/content/strings.json'), 'utf8'));
  const ui = uiStringKeys(readFileSync(join(dir, 'src/ui/strings.ts'), 'utf8'));
  const keys = new Set([...Object.keys(content), ...ui]);
  const namespaces = Array.from(new Set(Array.from(keys, (key) => key.split('.')[0]))).sort();

  const exact = new Set();
  const soft = new Set();
  const prefixes = new Set();
  // The default table is not a reference to itself.
  const table = join(dir, 'src/ui/strings.ts');
  for (const file of sourceFiles(join(dir, 'src'))) {
    if (file === table) continue;
    const refs = referencesIn(readFileSync(file, 'utf8'), namespaces);
    for (const key of refs.exact) exact.add(key);
    for (const key of refs.soft) soft.add(key);
    for (const key of refs.prefixes) prefixes.add(key);
  }

  // `command-catalog.md` section Rejection reasons: one `reject.<reason>` key per reason, both ways.
  const reasonsSource = readFileSync(join(dir, 'src/core/command-types.ts'), 'utf8');
  const reasonsBody = reasonsSource.slice(reasonsSource.indexOf('REJECT_REASONS = ['));
  const reasons = Array.from(reasonsBody.slice(0, reasonsBody.indexOf(']')).matchAll(/'([a-z_]+)'/g), (m) => m[1]);
  const rejectMismatch = [];
  if (reasons.length === 0) rejectMismatch.push('no REJECT_REASONS parsed from src/core/command-types.ts');
  for (const reason of reasons) if (!keys.has(`reject.${reason}`)) rejectMismatch.push(`no strings key "reject.${reason}"`);
  for (const key of keys) {
    if (!key.startsWith('reject.')) continue;
    if (!reasons.includes(key.slice('reject.'.length))) rejectMismatch.push(`${key} names no rejection reason`);
  }

  // A mirrored namespace's keys are reached by their content rows, and must match them.
  const mismatched = [];
  const mirrored = new Set();
  for (const { ns, table } of MIRRORED) {
    let rows;
    try {
      rows = JSON.parse(readFileSync(join(dir, `src/content/${table}.json`), 'utf8'));
    } catch {
      continue;
    }
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const row of rows) {
      const key = `${ns}.${row.id}`;
      if (typeof row.text !== 'string') continue;
      if (!keys.has(key)) mismatched.push(`${table} row "${row.id}" has no strings key "${key}"`);
      else if (content[key] !== undefined && content[key] !== row.text) mismatched.push(`${key} differs from the ${table} row's text`);
    }
    for (const key of keys) {
      if (!key.startsWith(`${ns}.`)) continue;
      mirrored.add(key);
      if (!byId.has(key.slice(ns.length + 1))) mismatched.push(`${key} names no ${table} row`);
    }
  }

  const reaches = (key) => mirrored.has(key) || exact.has(key) || soft.has(key) ||
    Array.from(prefixes).some((prefix) => key === prefix || key.startsWith(prefix));
  const missing = Array.from(exact).filter((key) => !keys.has(key) &&
    !Array.from(keys).some((k) => k.startsWith(`${key}.`))).sort();
  const unused = Array.from(keys).filter((key) => !reaches(key)).sort();
  const literals = panelLiterals(dir);
  const defaults = defaultTables(dir);
  return { keys: keys.size, content: Object.keys(content).length, ui: ui.length, missing, unused, mismatched: [...mismatched, ...rejectMismatch], literals, defaults, namespaces };
}

function main() {
  const at = process.argv.indexOf('--fixture');
  const dir = at >= 0 ? process.argv[at + 1] : root;
  let result;
  try {
    result = check(dir);
  } catch (error) {
    console.error(`strings:check: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
    return;
  }
  for (const key of result.missing) console.error(`strings:check: missing key "${key}"`);
  for (const key of result.unused) console.error(`strings:check: unused key "${key}"`);
  for (const line of result.mismatched) console.error(`strings:check: ${line}`);
  for (const line of result.literals) console.error(`strings:check: text in code, not in the strings table: ${line}`);
  for (const line of result.defaults) console.error(`strings:check: new Strings() draws past the strings.json rows; pass the game's strings: ${line}`);
  if (result.missing.length > 0 || result.unused.length > 0 || result.mismatched.length > 0 || result.literals.length > 0 || result.defaults.length > 0) {
    console.error(`strings:check: ${result.missing.length} missing, ${result.unused.length} unused, ${result.mismatched.length} mismatched, ${result.literals.length} literal texts in ${LITERAL_DIRS.join(', ')}, ${result.defaults.length} default tables`);
    process.exit(1);
    return;
  }
  console.log(`strings:check: ${result.keys} keys (${result.content} in strings.json, ${result.ui} UI defaults), no issues`);
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) main();
