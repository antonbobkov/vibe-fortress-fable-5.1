#!/usr/bin/env node
// Validates src/content/*.json against the schemas and cross-references every id.
// `tooling.md` § package.json: `content:check` (node scripts/content-check.mjs).
//
// `src/content/schema.ts` and `src/content/generate.ts` import nothing, so Node's type stripping
// loads them directly and the checker shares exactly the loader's rules. See DECISIONS.md D-015.
//
// Usage: node scripts/content-check.mjs [--fixture <file.json>]
//   --fixture merges a JSON object of table overrides, used by the tests to feed a broken table.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateAll } from '../src/content/schema.ts';
import { applyGenerated } from '../src/content/generate.ts';
import { checkExport } from './content-export-check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'src/content');

function parseArgs(argv) {
  const out = { fixture: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--fixture') {
      out.fixture = argv[i + 1] ?? null;
      i += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (!existsSync(contentDir)) {
  console.error(`content:check: ${contentDir} does not exist`);
  process.exit(1);
}

const data = {};
for (const file of readdirSync(contentDir).sort()) {
  if (!file.endsWith('.json')) continue;
  const name = file.slice(0, -'.json'.length);
  try {
    data[name] = JSON.parse(readFileSync(join(contentDir, file), 'utf8'));
  } catch (err) {
    console.error(`content:check: ${file} is not valid JSON: ${String(err)}`);
    process.exit(1);
  }
}

if (args.fixture !== null) {
  const overrides = JSON.parse(readFileSync(args.fixture, 'utf8'));
  Object.assign(data, overrides);
}

const tableCount = Object.keys(data).length;
if (tableCount === 0) {
  console.error('content:check: no JSON tables found');
  process.exit(1);
}

applyGenerated(data);
const issues = validateAll(data);

if (issues.length > 0) {
  console.error(`content:check: ${issues.length} issue(s)`);
  for (const issue of issues.slice(0, 50)) {
    console.error(`  ${issue.table}[${issue.row}].${issue.field}: ${issue.message}`);
  }
  if (issues.length > 50) console.error(`  ... and ${issues.length - 50} more`);
  process.exit(1);
}

let rowCount = 0;
for (const value of Object.values(data)) if (Array.isArray(value)) rowCount += value.length;
console.log(`content:check: ${tableCount} tables, ${rowCount} rows, no issues`);

const { tableCount: exportedCount, differences } = checkExport();
if (differences.length > 0) {
  console.error(`content:export-check: ${differences.length} difference(s)`);
  for (const difference of differences) console.error(`  ${difference}`);
  process.exitCode = 1;
} else console.log(`content:export-check: ${exportedCount} tables match source exports byte for byte`);
