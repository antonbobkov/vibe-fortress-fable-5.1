// The guard on row numbering: `01-architecture/content-pipeline.md` § Loading step 4.
//
// test/fixtures/content-row-baseline.json holds, per table, the ids in index order as they stood
// when the numbering rule began. It is never regenerated. `content:check` and the test
// test/unit/content-row-baseline.test.ts both run this check.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './md-tables.mjs';
import { orderRows } from '../../src/core/registry.ts';
import { SCHEMAS } from '../../src/content/schema.ts';

/** @returns {Record<string, string[]>} */
export function readRowBaseline() {
  return JSON.parse(readFileSync(join(ROOT, 'test/fixtures/content-row-baseline.json'), 'utf8')).tables;
}

/**
 * Every way the tables break the numbering, each as a message that says what to do.
 * @param {Record<string, unknown>} data every table, after `applyGenerated`
 * @param {Record<string, string[]>} baseline
 * @returns {string[]}
 */
export function rowBaselineIssues(data, baseline) {
  const issues = [];
  const appended = new Map();
  for (const { table, id } of data['rowOrder'] ?? []) appended.set(table, [...(appended.get(table) ?? []), id]);

  for (const table of Object.keys(baseline)) {
    if (SCHEMAS[table]?.shape !== 'rows') issues.push(`${table}: the table is gone. Saves hold its row numbers, so a table of rows stays`);
  }
  for (const [table, schema] of Object.entries(SCHEMAS)) {
    if (schema.shape !== 'rows') continue;
    const listed = appended.get(table) ?? [];
    const order = orderRows(table, data[table], listed).map((row) => row.id);
    const old = baseline[table] ?? [];
    const known = new Set(old);
    for (const id of order) {
      if (known.has(id) || listed.includes(id)) continue;
      issues.push(`${table}: new row "${id}" is not in rowOrder. A new row numbers after every older row: add the line "| ${table} | ${id} |" to the end of the table in docs/03-content/row-order.md, then run npm run content:export`);
    }
    // One line for a run of shifted rows: the first says it all.
    const moved = [];
    for (const [i, id] of old.entries()) {
      const at = order.indexOf(id);
      if (at === i) continue;
      if (at < 0) issues.push(`${table}: row "${id}" is gone. Saves hold its number ${i + 1}, so a row is never removed`);
      else if (listed.includes(id)) issues.push(`${table}: row "${id}" is older than the numbering rule, so it may not be in rowOrder`);
      else moved.push(`${table}: row "${id}" moved from number ${i + 1} to ${at + 1}. Saves hold these numbers raw, so it must not move`);
    }
    if (moved.length > 0) issues.push(moved.length === 1 ? moved[0] : `${moved[0]} (and ${moved.length - 1} more rows of this table)`);
  }
  return issues;
}
