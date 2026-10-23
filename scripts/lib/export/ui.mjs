// docs/03-content/glyphs-and-colors.md and ui-keymap-and-screens.md -> palette, glyphs, patterns,
// hints, milestones, confirmations, keymap, strings.

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  CONTENT_DIR,
  asObjects,
  compact,
  findTable,
  id,
  int,
  isBlank,
  plain,
  readTables,
  ticked,
} from '../md-tables.mjs';
import { exportIntroCaptions } from './intro.mjs';

export function exportPalette() {
  const tables = readTables(join(CONTENT_DIR, 'glyphs-and-colors.md'));
  const out = [];
  const push = (rawId, hex, alt) => {
    const cid = plain(rawId).replace(/\s*\(.*\)$/, '').replace(/`/g, '');
    if (cid === '' || cid === 'id') return;
    const entry = { id: cid, hex: plain(hex) };
    if (!isBlank(alt)) entry.alt = plain(alt);
    out.push(entry);
  };

  for (const heading of ['Base 16', 'State and UI colors', 'Fluid ramps', 'Designation and zone tints']) {
    const table = findTable(tables, heading, 'id');
    for (const row of table.rows) push(row[0], row[1], row[2]);
  }
  // "Material and nature colors" carries an alternate for each id/hex pair.
  const pairs = findTable(tables, 'Material and nature colors');
  for (const row of pairs.rows) {
    push(row[0], row[1], row[2]);
    if (!isBlank(row[4])) push(row[4], row[5], row[6]);
  }
  const seen = new Set();
  for (const c of out) {
    if (seen.has(c.id)) throw new Error(`glyphs-and-colors.md: duplicate color ${c.id}`);
    seen.add(c.id);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function exportGlyphs() {
  const tables = readTables(join(CONTENT_DIR, 'glyphs-and-colors.md'));
  const table = findTable(tables, 'Glyph set', 'Index');
  return asObjects(table).map((row) => {
    const char = ticked(row.Glyph)[0] ?? plain(row.Glyph);
    const cp = /U\+([0-9A-Fa-f]+)/.exec(plain(row['Code point']));
    return {
      index: int(row.Index),
      char,
      codePoint: cp === null ? char.codePointAt(0) : parseInt(cp[1], 16),
    };
  });
}

/** The 3x3 workshop patterns from the fenced block of § Workshop patterns. */
export function exportPatterns() {
  const text = readFileSync(join(CONTENT_DIR, 'glyphs-and-colors.md'), 'utf8');
  const block = /### Workshop patterns[^\n]*\n[^\n]*\n```\n([\s\S]*?)```/.exec(text);
  if (block === null) throw new Error('glyphs-and-colors.md: no workshop pattern block');
  const lines = block[1].split('\n').filter((l) => l.trim().length > 0);
  const out = [];
  for (let i = 0; i + 3 < lines.length + 1; i += 4) {
    const names = lines[i].trim().split(/\s+/);
    const rows = [lines[i + 1], lines[i + 2], lines[i + 3]];
    if (rows.some((r) => r === undefined)) break;
    const split = rows.map((r) => r.trim().split(/\s{2,}/).map((chunk) => chunk.replace(/\s+/g, '')));
    names.forEach((name, col) => {
      const r0 = split[0][col];
      const r1 = split[1][col];
      const r2 = split[2][col];
      if (r0 === undefined || r1 === undefined || r2 === undefined) return;
      out.push({ id: name, rows: [r0, r1, r2] });
    });
  }
  if (out.length === 0) throw new Error('glyphs-and-colors.md: no patterns parsed');
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function textOf(cell) {
  const s = String(cell ?? '').trim();
  const q = /^"([\s\S]*)"$/.exec(s);
  return q === null ? plain(s) : q[1];
}

export function exportHints() {
  const tables = readTables(join(CONTENT_DIR, 'ui-keymap-and-screens.md'));
  const table = findTable(tables, 'Hints', 'Trigger');
  return asObjects(table).map((row) =>
    compact({ id: id(row.id), trigger: plain(row.Trigger), text: textOf(row.Text) }),
  );
}

export function exportMilestones() {
  const tables = readTables(join(CONTENT_DIR, 'ui-keymap-and-screens.md'));
  const table = findTable(tables, 'Milestones (legend record)', 'Trigger');
  return asObjects(table).map((row) =>
    compact({ id: id(row.id), trigger: plain(row.Trigger), text: textOf(row.Text) }),
  );
}

export function exportConfirmations() {
  const tables = readTables(join(CONTENT_DIR, 'ui-keymap-and-screens.md'));
  const table = findTable(tables, 'Confirmations', 'Default');
  return asObjects(table).map((row) =>
    compact({
      id: id(row.id),
      text: textOf(row.Text),
      default: plain(row.Default).toLowerCase() === 'yes' ? 'yes' : 'no',
    }),
  );
}

/** The `### <heading>` of each § Keymap table and the context `ui/keymap.ts` gives it, in table order. */
const KEY_CONTEXTS = [
  ['Global', 'global'],
  ['Map', 'map'],
  ['Panels', 'panel'],
  ['Map selection', 'selection'],
  ['Designate panel', 'designate_panel'],
  ['Build panel', 'build_panel'],
  ['Zones panel', 'zones_panel'],
  ['Zone inspector', 'zone_inspector'],
  ['Units panel', 'units_panel'],
  ['Labors panel', 'labors_panel'],
  ['Jobs panel', 'jobs_panel'],
  ['Orders panel', 'orders_panel'],
  ['Workshop panel', 'workshop_panel'],
  ['Building panel', 'building_panel'],
  ['Stocks panel', 'stocks_panel'],
  ['Depot panel', 'depot_panel'],
  ['Military panel', 'military_panel'],
  ['Animals panel', 'animals_panel'],
  ['Civilizations panel', 'civilizations_panel'],
  ['Population panel', 'population_panel'],
  ['Mood panel', 'mood_panel'],
  ['Log panel', 'log_panel'],
  ['Look panel', 'look_panel'],
  ['Help panel', 'help_panel'],
  ['Debug panel', 'debug_panel'],
  ['Labor manager', 'labor_manager'],
  ['Profession templates', 'labor_templates'],
  ['Trade session', 'trade_session'],
  ['Game menu', 'game_menu'],
  ['Confirmation', 'confirm'],
  ['Main menu', 'main_menu'],
  ['World generation', 'world_gen'],
  ['World map', 'world_map'],
  ['Embark', 'embark'],
  ['Load', 'load'],
];

export function exportKeymap() {
  const tables = readTables(join(CONTENT_DIR, 'ui-keymap-and-screens.md'));
  const out = [];
  for (const [heading, context] of KEY_CONTEXTS) {
    const table = tables.find(
      (t) => t.headings[t.headings.length - 1] === heading && t.header.map(plain)[0] === 'Key',
    );
    if (table === undefined) throw new Error(`ui-keymap-and-screens.md: no "${heading}" key table`);
    for (const row of asObjects(table)) {
      const keys = ticked(row.Key);
      const action = plain(row.Action);
      if (keys.length === 0) out.push({ context, key: plain(row.Key), action });
      else for (const key of keys) out.push({ context, key, action });
    }
  }
  return out;
}

/**
 * `content-pipeline.md` § Strings: every player-facing string is a key in `strings.json`. The
 * canonical values are the announcement, hint, milestone, confirmation and thought texts, and the
 * intro's captions (`intro.md` § Captions).
 */
export function exportStrings(thoughts) {
  const strings = {};
  for (const h of exportHints()) strings[`hint.${h.id}`] = h.text;
  for (const m of exportMilestones()) strings[`milestone.${m.id}`] = m.text;
  for (const c of exportConfirmations()) strings[`confirm.${c.id}`] = c.text;
  for (const t of thoughts) strings[`thought.${t.id}`] = t.text;
  for (const c of exportIntroCaptions()) strings[`intro.${c.id}`] = c.text;
  const announcements = findTable(readTables(join(CONTENT_DIR, 'ui-keymap-and-screens.md')), 'Announcement strings', 'Key');
  // Announcement rows retain their source order ahead of the sorted legacy groups.
  const sorted = {};
  for (const row of asObjects(announcements)) sorted[plain(row.Key)] = textOf(row.Text);
  for (const key of Object.keys(strings).sort()) sorted[key] = strings[key];
  return sorted;
}
