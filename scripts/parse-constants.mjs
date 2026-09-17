#!/usr/bin/env node
// Parses the constant tables of docs/01-architecture/constants.md.
//
// `T-M0-03` requires that any drift between the document and `src/core/constants.ts` fails a
// test, so this parser is the single reader of the Markdown and both the CLI and
// `test/unit/constants.test.ts` use it.
//
// Row shapes handled:
//   | `NAME` | 42 | meaning |                        -> NAME = 42
//   | `A` / `B` | 5 / 8 | meaning |                   -> A = 5, B = 8
//   | `NAME` | 1, 2, 4 | meaning |                    -> NAME = [1, 2, 4]
//   | `NAME` | spring | meaning |                     -> NAME = 'spring'

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const CONSTANTS_DOC = join(root, 'docs/01-architecture/constants.md');

const NAME_RE = /^[A-Z][A-Z0-9_]*$/;

function scalar(raw) {
  const v = raw.replace(/`/g, '').trim();
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d*\.\d+$/.test(v)) return Number(v);
  return v;
}

/**
 * @param {string} [docPath]
 * @returns {{ name: string, value: number | string | (number|string)[], section: string }[]}
 */
export function parseConstants(docPath = CONSTANTS_DOC) {
  const text = readFileSync(docPath, 'utf8');
  /** @type {{ name: string, value: any, section: string }[]} */
  const rows = [];
  let section = '';
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      continue;
    }
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const nameCell = cells[0];
    const valueCell = cells[1];
    if (!nameCell.includes('`')) continue;
    const names = nameCell
      .split('/')
      .map((s) => s.trim().replace(/`/g, ''))
      .filter((s) => s.length > 0);
    if (names.length === 0 || !names.every((n) => NAME_RE.test(n))) continue;

    if (names.length > 1) {
      const values = valueCell.split('/').map((v) => scalar(v));
      if (values.length !== names.length) {
        throw new Error(`constants.md: "${nameCell}" has ${names.length} names but ${values.length} values`);
      }
      names.forEach((name, i) => rows.push({ name, value: values[i], section }));
      continue;
    }

    const only = names[0];
    const value = valueCell.includes(',')
      ? valueCell.split(',').map((v) => scalar(v))
      : scalar(valueCell);
    rows.push({ name: only, value, section });
  }
  if (rows.length === 0) throw new Error(`constants.md: no constant rows found in ${docPath}`);
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.name)) throw new Error(`constants.md: duplicate constant ${r.name}`);
    seen.add(r.name);
  }
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rows = parseConstants();
  for (const r of rows) console.log(`${r.name} = ${JSON.stringify(r.value)}   [${r.section}]`);
  console.log(`${rows.length} constants`);
}
