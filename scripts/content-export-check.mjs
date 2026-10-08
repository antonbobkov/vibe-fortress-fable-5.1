#!/usr/bin/env node
// Compare a temporary export of every source table with the committed JSON bytes.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib/md-tables.mjs';
import { exportTables } from './export-tables.mjs';

export function checkExport(contentDir = join(ROOT, 'src/content')) {
  const tempDir = mkdtempSync(join(ROOT, '.content-export-check-'));
  try {
    const tableCount = exportTables(tempDir, { quiet: true });
    const expected = readdirSync(tempDir).filter((name) => name.endsWith('.json')).sort();
    const actual = existsSync(contentDir) ? readdirSync(contentDir).filter((name) => name.endsWith('.json')).sort() : [];
    const differences = [];
    for (const name of expected) {
      if (!actual.includes(name)) differences.push(`${name}: missing committed table`);
      else if (!readFileSync(join(tempDir, name)).equals(readFileSync(join(contentDir, name)))) differences.push(`${name}: differs from source export`);
    }
    for (const name of actual) if (!expected.includes(name)) differences.push(`${name}: unexpected committed table`);
    return { tableCount, differences };
  } finally {
    const within = relative(ROOT, tempDir);
    if (isAbsolute(within) || within.startsWith('..')) throw new Error('Export temporary directory escaped the repository');
    rmSync(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { tableCount, differences } = checkExport();
  if (differences.length > 0) {
    console.error(`content:export-check: ${differences.length} difference(s)`);
    for (const difference of differences) console.error(`  ${difference}`);
    process.exitCode = 1;
  } else console.log(`content:export-check: ${tableCount} tables match source exports byte for byte`);
}
