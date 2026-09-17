// Shared reader for the Markdown tables of docs/03-content.
//
// `content-pipeline.md` § Principle: "The Markdown tables in 03-content/ are the source of truth;
// the JSON files in src/content/ mirror them one to one with identical field names."
//
// This module turns a Markdown file into a list of tables tagged with their heading path, and
// supplies the cell converters the column conventions of `content-pipeline.md` § Row conventions
// need (decimals to Fixed, hours and days to ticks, ranges, id lists, weighted lists).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const CONTENT_DIR = join(ROOT, 'docs/03-content');

/** Scale of a `Fixed`, matching src/core/fixed.ts. */
export const FIXED_SCALE = 1000;

export const EM_DASHES = ['—', '–', '-', ''];

/** True for a cell that means "nothing here". */
export function isBlank(cell) {
  return cell === undefined || EM_DASHES.includes(cell.trim());
}

/** Strip backticks, collapse whitespace. */
export function plain(cell) {
  return String(cell ?? '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The backticked tokens of a cell, in order. */
export function ticked(cell) {
  return Array.from(String(cell ?? '').matchAll(/`([^`]+)`/g)).map((m) => m[1]);
}

const ESCAPED_PIPE = '\u0001';

/** Split a Markdown table row, honouring the `\|` escapes cells use for a literal pipe. */
export function splitRow(line) {
  return line
    .replace(/\\\|/g, ESCAPED_PIPE)
    .split('|')
    .slice(1, -1)
    .map((c) => c.split(ESCAPED_PIPE).join('|').trim());
}

/**
 * Every pipe table of a Markdown document.
 * @returns {{ headings: string[], header: string[], rows: string[][] }[]}
 */
export function readTables(docPath) {
  const text = readFileSync(docPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const headings = [];
  const tables = [];
  let pending = null;
  let inFence = false;

  const flush = () => {
    if (pending && pending.rows.length > 0) tables.push(pending);
    pending = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      flush();
      continue;
    }
    if (inFence) continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = h[1].length;
      headings.length = Math.max(0, level - 1);
      headings[level - 1] = h[2].trim();
      continue;
    }
    if (!line.startsWith('|')) {
      flush();
      continue;
    }
    const cells = splitRow(line);
    if (/^:?-{2,}:?$/.test(cells[0] ?? '') || cells.every((c) => /^:?-+:?$/.test(c))) {
      continue; // separator row
    }
    if (pending === null) {
      pending = { headings: headings.filter(Boolean).slice(), header: cells, rows: [] };
    } else {
      pending.rows.push(cells);
    }
  }
  flush();
  return tables;
}

/** Find one table by the heading it sits under and (optionally) a header cell it must contain. */
export function findTable(tables, headingSuffix, mustHaveHeader) {
  const matches = tables.filter((t) => {
    const path = t.headings.join(' / ');
    if (!path.endsWith(headingSuffix) && !path.includes(headingSuffix)) return false;
    if (mustHaveHeader !== undefined && !t.header.some((h) => plain(h) === mustHaveHeader)) return false;
    return true;
  });
  if (matches.length === 0) {
    throw new Error(`no table under heading "${headingSuffix}"${mustHaveHeader ? ` with column "${mustHaveHeader}"` : ''}`);
  }
  return matches[0];
}

/** Turn a table into objects keyed by its own header names. */
export function asObjects(table) {
  const keys = table.header.map((h) => plain(h));
  return table.rows.map((cells) => {
    const o = {};
    keys.forEach((k, i) => {
      o[k] = cells[i] ?? '';
    });
    o.__cells = cells;
    return o;
  });
}

// ---------- cell converters ----------

/** A plain integer. Accepts thousands separators. */
export function int(cell, fallback = 0) {
  if (isBlank(cell)) return fallback;
  const m = /-?[\d,]+/.exec(plain(cell).replace(/−/g, '-'));
  if (m === null) return fallback;
  return Number(m[0].replace(/,/g, ''));
}

/** A decimal written in the table, as a `Fixed` (scale 1000). */
export function fixed(cell, fallback = 0) {
  if (isBlank(cell)) return fallback;
  const m = /-?[\d,]*\.?\d+/.exec(plain(cell).replace(/−/g, '-'));
  if (m === null) return fallback;
  return Math.round(Number(m[0].replace(/,/g, '')) * FIXED_SCALE);
}

/** A percentage written as "+30%" or "30" into an integer percent. */
export function percent(cell, fallback = 0) {
  if (isBlank(cell)) return fallback;
  const m = /-?\d+/.exec(plain(cell).replace(/−/g, '-'));
  return m === null ? fallback : Number(m[0]);
}

/** "yes" / "no". */
export function bool(cell, fallback = false) {
  if (isBlank(cell)) return fallback;
  const v = plain(cell).toLowerCase();
  if (v.startsWith('yes') || v === 'true' || v === 'on') return true;
  if (v.startsWith('no') || v === 'false' || v === 'off') return false;
  return fallback;
}

/** A single backticked id, or the first word. */
export function id(cell, fallback = null) {
  if (isBlank(cell)) return fallback;
  const t = ticked(cell);
  if (t.length > 0) return t[0];
  const w = /[a-z0-9_]+/i.exec(plain(cell));
  return w === null ? fallback : w[0];
}

/** Every backticked id in the cell. */
export function idList(cell) {
  if (isBlank(cell)) return [];
  const t = ticked(cell);
  if (t.length > 0) return t;
  return plain(cell)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** "3–5" or "2-4" or "4" into [min, max]. */
export function range(cell, fallback = null) {
  if (isBlank(cell)) return fallback;
  const s = plain(cell).replace(/−/g, '-');
  const m = /(-?[\d.]+)\s*[–—-]\s*(-?[\d.]+)/.exec(s);
  if (m) return [Number(m[1]), Number(m[2])];
  const one = /-?[\d.]+/.exec(s);
  return one === null ? fallback : [Number(one[0]), Number(one[0])];
}

/**
 * "temperate_forest 30, temperate_hills 25" into [{ key, weight }].
 * Parenthesised notes are dropped; a missing weight counts as 1.
 */
export function weighted(cell) {
  if (isBlank(cell)) return [];
  return plain(cell)
    .replace(/\([^)]*\)/g, ' ')
    .split(',')
    .map((part) => part.trim())
    .filter((p) => p.length > 0)
    .map((part) => {
      // The key is the last identifier before the weight, so "glacier-adjacent tundra 15" is
      // tundra at 15 and "riverbank 30" is riverbank at 30.
      const withWeight = /([A-Za-z_][A-Za-z0-9_]*)\s+([\d.]+)\s*$/.exec(part);
      if (withWeight !== null) return { key: withWeight[1], weight: Number(withWeight[2]) };
      const bare = /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(part);
      return bare === null ? null : { key: bare[1], weight: 1 };
    })
    .filter((x) => x !== null);
}

/** A comma-separated list of words. */
export function words(cell) {
  if (isBlank(cell)) return [];
  return plain(cell)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** The glyph character inside a cell such as "`▒` material". */
export function glyph(cell, fallback = null) {
  if (isBlank(cell)) return fallback;
  const t = ticked(cell);
  if (t.length > 0) return t[0];
  const s = plain(cell);
  return s.length > 0 ? s[0] : fallback;
}

/** Seasons named in a cell ("spring, summer" or "spring–autumn" or "all"). */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

export function seasons(cell, fallback = null) {
  if (isBlank(cell)) return fallback;
  const s = plain(cell).toLowerCase();
  if (s === 'all') return [0, 1, 2, 3];
  const span = /(spring|summer|autumn|winter)\s*[–—-]\s*(spring|summer|autumn|winter)/.exec(s);
  if (span) {
    const a = SEASONS.indexOf(span[1]);
    const b = SEASONS.indexOf(span[2]);
    const out = [];
    for (let i = a; i !== (b + 1) % 4; i = (i + 1) % 4) out.push(i);
    return out;
  }
  const found = SEASONS.map((n, i) => (s.includes(n) ? i : -1)).filter((i) => i >= 0);
  return found.length > 0 ? found : fallback;
}

/** Sort rows by id, the order the registry assigns indices in. */
export function byId(rows) {
  return rows.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Remove undefined-valued keys so the JSON stays close to the table. */
export function compact(obj) {
  const out = {};
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = v;
  }
  return out;
}
