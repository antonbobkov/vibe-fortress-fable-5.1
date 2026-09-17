#!/usr/bin/env node
// Validates src/content/*.json against the schemas and cross-references every id.
// The full implementation arrives with T-M0-06 (content-pipeline.md); until the tables exist
// this reports that there is nothing to check and exits 0.

import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'src/content');

if (!existsSync(contentDir) || readdirSync(contentDir).filter((f) => f.endsWith('.json')).length === 0) {
  console.log('content:check: no content tables yet (T-M0-06)');
  process.exit(0);
}

console.error('content:check: tables exist but the checker has not been implemented (T-M0-06)');
process.exit(1);
