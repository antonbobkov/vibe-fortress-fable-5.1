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
import { dirname, join } from 'node:path';

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
  return { keys: keys.size, content: Object.keys(content).length, ui: ui.length, missing, unused, mismatched: [...mismatched, ...rejectMismatch], namespaces };
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
  if (result.missing.length > 0 || result.unused.length > 0 || result.mismatched.length > 0) {
    console.error(`strings:check: ${result.missing.length} missing, ${result.unused.length} unused, ${result.mismatched.length} mismatched`);
    process.exit(1);
    return;
  }
  console.log(`strings:check: ${result.keys} keys (${result.content} in strings.json, ${result.ui} UI defaults), no issues`);
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) main();
