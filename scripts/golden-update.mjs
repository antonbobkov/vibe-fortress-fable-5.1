#!/usr/bin/env node
// `npm run golden:update -- <name>`: rewrite one golden file and print the diff summary.
//
// `05-plan/01-testing-strategy.md` § Golden tests: "Update only through
// `npm run golden:update -- <name>`, which rewrites the file and prints the diff summary; the
// commit message must start with `golden:` and explain why."
//
// The golden tests themselves do the rewriting, so the values always come from the real code:
// this script sets DEEPHOLM_GOLDEN_UPDATE and runs them.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The golden files a name may address; `all` means every one of them. */
export function goldenNames() {
  const names = new Set(['all']);
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith('.json')) {
        names.add(`${prefix}${entry.name.replace(/\.json$/, '')}`);
      } else if (entry.name.endsWith('.test.ts')) {
        names.add(`${prefix}${entry.name.replace(/\.test\.ts$/, '')}`);
      }
    }
  };
  walk(join(root, 'test/golden'), '');
  return Array.from(names).sort();
}

function run(name) {
  const res = spawnSync('npm', ['run', 'test', '--', 'test/golden'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, DEEPHOLM_GOLDEN_UPDATE: name },
  });
  process.stdout.write(`${res.stdout ?? ''}${res.stderr ?? ''}`);
  return res.status === 0;
}

function diffSummary() {
  const res = spawnSync('git', ['diff', '--stat', '--', 'test/golden'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return (res.stdout ?? '').trim();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const name = process.argv[2] ?? 'all';
  const known = goldenNames();
  if (!known.includes(name)) {
    console.error(`golden:update: unknown golden "${name}". Known: ${known.join(', ')}`);
    process.exit(2);
  }
  const ok = run(name);
  const summary = diffSummary();
  console.log('');
  console.log(summary.length > 0 ? summary : 'golden:update: no golden file changed.');
  if (!ok) {
    console.error('golden:update: the golden tests reported a failure; see the output above.');
    process.exit(1);
  }
  console.log('golden:update: commit this with a message starting "golden:" that explains why.');
}
