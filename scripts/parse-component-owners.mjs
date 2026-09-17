#!/usr/bin/env node
// Parses the "Component ownership table" of docs/04-implementation/schemas/components.md.
//
// T-M0-05 requires that the component ownership metadata in src/core/components.ts matches the
// document, so this parser is the single reader of that table and the unit test compares against
// what it returns.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const COMPONENTS_DOC = join(root, 'docs/04-implementation/schemas/components.md');

const HEADING = '## Component ownership table';

/**
 * @param {string} [docPath]
 * @returns {{ component: string, owner: string, ownerNote: string, alsoWrittenBy: string[] }[]}
 */
export function parseComponentOwners(docPath = COMPONENTS_DOC) {
  const text = readFileSync(docPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === HEADING);
  if (start < 0) throw new Error(`components.md: no "${HEADING}" section`);

  /** @type {{ component: string, owner: string, ownerNote: string, alsoWrittenBy: string[] }[]} */
  const rows = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('## ')) break;
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    if (!cells[0].includes('`')) continue; // header and separator rows

    const components = cells[0]
      .split(',')
      .map((s) => s.trim().replace(/`/g, ''))
      .filter((s) => s.length > 0);

    // "18 (caravan parties: 20)" -> owner "18", note "caravan parties: 20"
    const ownerCell = cells[1];
    const paren = /^([^(]+?)\s*\(([^)]*)\)\s*$/.exec(ownerCell);
    const owner = (paren ? paren[1] : ownerCell).trim();
    const ownerNote = paren ? paren[2].trim() : '';

    const alsoCell = cells[2];
    const alsoWrittenBy =
      alsoCell === '' || alsoCell === '—' || alsoCell === '-'
        ? []
        : alsoCell.split(',').map((s) => s.trim()).filter((s) => s.length > 0);

    for (const component of components) rows.push({ component, owner, ownerNote, alsoWrittenBy });
  }
  if (rows.length === 0) throw new Error('components.md: the ownership table is empty');
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.component)) throw new Error(`components.md: duplicate component ${r.component}`);
    seen.add(r.component);
  }
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rows = parseComponentOwners();
  for (const r of rows) {
    console.log(
      `${r.component.padEnd(16)} owner=${r.owner}${r.ownerNote ? ` (${r.ownerNote})` : ''}` +
        `${r.alsoWrittenBy.length ? `  also=${r.alsoWrittenBy.join(' / ')}` : ''}`,
    );
  }
  console.log(`${rows.length} components`);
}
