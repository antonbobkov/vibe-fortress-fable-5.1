#!/usr/bin/env node
// Closes a task: moves docs/work/<id>-*.md to docs/archive/tasks/, adds the closing
// line, deletes the backlog row, and repoints every relative link to the moved file.
// Usage: node scripts/close-task.mjs T-123 [commit ...]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const [id, ...commits] = process.argv.slice(2);
if (!/^T-\d+$/.test(id ?? '')) {
  console.error('usage: node scripts/close-task.mjs T-123 [commit ...]');
  process.exit(2);
}

const workDir = join(root, 'docs', 'work');
const archiveDir = join(root, 'docs', 'archive', 'tasks');
const name = readdirSync(workDir).find((f) => f.startsWith(`${id}-`) && f.endsWith('.md'));
if (!name) {
  console.error(`close-task: no docs/work/${id}-*.md`);
  process.exit(1);
}
const oldPath = join(workDir, name);
const newPath = join(archiveDir, name);
const posix = (p) => p.split(sep).join('/');
const LINK = /\]\(([^)\s#]+)(#[^)\s]*)?\)/g;
const isRelative = (t) => !/^[a-z]+:/i.test(t) && !t.startsWith('/');

// 1. The moved file: its relative links gain one "../"; the closing line goes under the header.
let text = readFileSync(oldPath, 'utf8').replace(LINK, (m, t, frag = '') =>
  isRelative(t) ? `](${posix(relative(archiveDir, resolve(workDir, t)))}${frag})` : m);
const lines = text.split('\n');
const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const closing = `**Closed:** ${date}${commits.length ? `, in ${commits.join(', ')}` : ''}.`;
lines.splice(1, 0, '', closing);
text = lines.join('\n');
execFileSync('git', ['mv', oldPath, newPath], { cwd: root });
writeFileSync(newPath, text);

// 2. The backlog row.
const backlog = join(root, 'docs', 'backlog.md');
const rows = readFileSync(backlog, 'utf8').split('\n');
const kept = rows.filter((l) => !l.startsWith(`| ${id} |`));
if (kept.length === rows.length) console.warn(`close-task: no backlog row for ${id}`);
writeFileSync(backlog, kept.join('\n'));

// 3. Inbound links in docs/, reports/, agents/ and README.md.
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.md')) files.push(p);
  }
};
for (const d of ['docs', 'reports', 'agents']) walk(join(root, d));
files.push(join(root, 'README.md'));
let repointed = 0;
for (const f of files) {
  if (f === newPath) continue;
  const src = readFileSync(f, 'utf8');
  const out = src.replace(LINK, (m, t, frag = '') => {
    if (!isRelative(t) || resolve(dirname(f), t) !== oldPath) return m;
    repointed++;
    return `](${posix(relative(dirname(f), newPath))}${frag})`;
  });
  if (out !== src) writeFileSync(f, out);
}
console.log(`close-task: ${id} archived as docs/archive/tasks/${name}; ${repointed} inbound link(s) repointed`);
