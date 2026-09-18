/**
 * Reads the `## Tuning constants` table of a system document, so a system's `constants.ts` can be
 * checked against its document the way `constants.test.ts` checks `src/core/constants.ts`.
 *
 * Only rows whose value is a plain number (optionally with a `%` or a `/`-separated pair) are
 * returned; ranges written in prose ("0.25–0.55 by deepness") are left to the tests of the rule
 * that uses them.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface TuningRow {
  readonly name: string;
  readonly value: number;
}

function num(raw: string): number | null {
  const v = raw.replace(/`/g, '').replace(/−/g, '-').replace(/%$/, '').trim();
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null;
}

export function tuningConstants(docRelativePath: string): TuningRow[] {
  const path = fileURLToPath(new URL(`../../docs/${docRelativePath}`, import.meta.url));
  const text = readFileSync(path, 'utf8');
  const start = text.indexOf('## Tuning constants');
  if (start < 0) throw new Error(`${docRelativePath}: no "## Tuning constants" section`);
  const rest = text.slice(start + 3);
  const end = rest.indexOf('\n## ');
  const section = end < 0 ? rest : rest.slice(0, end);
  const out: TuningRow[] = [];
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2 || !(cells[0] as string).includes('`')) continue;
    const names = (cells[0] as string).split('/').map((n) => n.replace(/`/g, '').trim());
    const values = (cells[1] as string).split('/').map((v) => num(v));
    if (names.length !== values.length) continue;
    names.forEach((name, i) => {
      const value = values[i];
      if (value !== null && value !== undefined && /^[A-Z][A-Z0-9_]*$/.test(name)) out.push({ name, value });
    });
  }
  return out;
}
