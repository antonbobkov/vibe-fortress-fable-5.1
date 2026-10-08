#!/usr/bin/env node
// Generates the table of component fields that hold content indices (`Idx<…>`), from the
// component schemas of docs/04-implementation/schemas/components.md.
//
// `save-format.md` § Serialization helpers: "every component field typed `Idx<…>` is converted
// through `registry.idOf` on save and `registry.indexOf` on load (a table of which fields are
// indices is generated from the component schemas)". `src/core/id-fields.ts` holds the table;
// `test/unit/save-game.test.ts` compares it with what this parser returns, so the two cannot drift
// (the same arrangement as parse-component-owners.mjs, docs/04-implementation/save-format.md § Serialization helpers, D-080).
//
// Usage: node scripts/parse-id-fields.mjs   (prints the table as JSON)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const COMPONENTS_DOC = join(root, 'docs/04-implementation/schemas/components.md');

/** The content table each `…Def` type is loaded into (`content-pipeline.md`, `src/content/*.json`). */
export const DEF_TABLES = Object.freeze({
  SpeciesDef: 'creatures',
  BodyPlanDef: 'bodyPlans',
  SkillDef: 'skills',
  TraitDef: 'personality',
  ThoughtDef: 'thoughts',
  ItemTypeDef: 'items',
  MaterialDef: 'materials',
  BuildingDef: 'buildings',
  RecipeDef: 'recipes',
  ZoneTypeDef: 'zoneTypes',
  PlantDef: 'plants',
});

/** Every `interface Name { … }` of the entities block, as `[name, body]`. */
function interfaces(text) {
  const out = new Map();
  const pattern = /interface\s+(\w+)\s*\{/g;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    let depth = 1;
    let i = pattern.lastIndex;
    for (; i < text.length && depth > 0; i += 1) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') depth -= 1;
    }
    out.set(m[1], text.slice(pattern.lastIndex, i - 1));
  }
  return out;
}

/** Top-level `name: type` fields of an interface body (comments stripped, nested braces kept). */
function fields(body) {
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const out = [];
  let depth = 0;
  let current = '';
  for (const ch of clean) {
    if (ch === '{' || ch === '[' || ch === '(' || ch === '<') depth += 1;
    if (ch === '}' || ch === ']' || ch === ')' || ch === '>') depth -= 1;
    if (ch === ';' && depth === 0) {
      out.push(current);
      current = '';
    } else current += ch;
  }
  out.push(current);
  return out
    .map((f) => f.trim())
    .filter((f) => f.includes(':'))
    .map((f) => {
      const at = f.indexOf(':');
      return { name: f.slice(0, at).trim(), type: f.slice(at + 1).trim() };
    });
}

/**
 * @returns {{ component: string, path: string, table: string, orString: boolean }[]} in document
 * order: one row per `Idx<…>` field, `[]` marking an array step, `.` a nested record.
 */
export function parseIdFields(docPath = COMPONENTS_DOC) {
  const text = readFileSync(docPath, 'utf8');
  const start = text.indexOf('// ---------- entities ----------');
  const end = text.indexOf('## Component ownership table');
  if (start < 0 || end < 0) throw new Error('components.md: no entities block');
  const block = text.slice(start, end);
  const all = interfaces(block);
  const owners = new Set(
    Array.from(
      text.slice(end).matchAll(/^\|\s*(`[^|]+`)\s*\|/gm),
      (m) => m[1],
    ).flatMap((cell) => cell.split(',').map((s) => s.trim().replace(/`/g, ''))),
  );

  /** Walk an interface; `prefix` is the path so far. */
  function walk(name, prefix, rows, component) {
    for (const f of fields(all.get(name) ?? '')) {
      const idx = /Idx<(\w+)>/g;
      const hits = Array.from(f.type.matchAll(idx), (m) => m[1]);
      const isTuple = f.type.startsWith('[');
      const isArray = /\[\]\s*$/.test(f.type) || isTuple;
      if (hits.length > 0) {
        const def = hits[0];
        const table = DEF_TABLES[def];
        if (table === undefined) throw new Error(`components.md: no table for ${def}`);
        rows.push({
          component,
          path: `${prefix}${f.name}${isArray ? '[]' : ''}`,
          table,
          orString: /\|\s*string/.test(f.type),
        });
        continue;
      }
      const element = /^(\w+)\[\]$/.exec(f.type);
      if (element && all.has(element[1]) && !owners.has(element[1])) {
        walk(element[1], `${prefix}${f.name}[].`, rows, component);
      }
    }
  }

  const rows = [];
  for (const name of all.keys()) {
    if (!owners.has(name)) continue;
    walk(name, '', rows, name);
  }
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(parseIdFields(), null, 2));
}
