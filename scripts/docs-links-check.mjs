#!/usr/bin/env node
// Fails on a relative Markdown link whose target file or folder does not exist.
// Scope: every `.md` file under `docs/`, `reports/` and `agents/`, and the root `README.md`.
// `docs/process/agent-workflow.md` § Verifying; part of `npm run gate` and CI.
//
// Checked: inline links and images `[text](target)` outside fenced code blocks and inline code
// spans. Not checked: absolute URLs (`scheme:`), pure in-page anchors (`#x`) and the anchor part
// of a file link (the file must exist; the heading is not resolved).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Folders scanned recursively, and single files, relative to the repository root. */
export const SCOPE = { folders: ['docs', 'reports', 'agents'], files: ['README.md'] };

/** Generated output that is not part of the documentation. */
const SKIPPED_FOLDERS = new Set(['node_modules', 'coverage', 'screenshots']);

export function markdownFiles(directory) {
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_FOLDERS.has(entry.name)) out.push(...markdownFiles(path));
    } else if (entry.name.endsWith('.md')) {
      out.push(path);
    }
  }
  return out.sort();
}

/** Replace inline code spans with spaces of the same length, so offsets and line counts hold. */
function blankCodeSpans(line) {
  return line.replace(/(`+)(?:(?!\1)[^])*?\1/g, (span) => ' '.repeat(span.length));
}

/**
 * The link targets of a Markdown text: `{ target, line }` for each inline link or image outside
 * code. A target in angle brackets or followed by a title keeps only the destination.
 */
export function linkTargets(markdown) {
  const out = [];
  let fence = null;
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(lines[i]);
    if (marker) {
      if (fence === null) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const text = blankCodeSpans(lines[i]);
    for (const match of text.matchAll(/\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
      // The destination is read from the original line: a link's own text may hold code spans.
      const at = match.index + match[0].indexOf(match[1]);
      const raw = lines[i].slice(at, at + match[1].length);
      out.push({ target: raw.replace(/^<|>$/g, ''), line: i + 1 });
    }
  }
  return out;
}

/** Whether a target is checked: a relative path, not a URL and not an in-page anchor. */
export function isRelative(target) {
  return target !== '' && !target.startsWith('#') && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target) &&
    !target.startsWith('//');
}

/** Broken links of one file: `{ file, line, target }` with `file` relative to `base`. */
export function brokenLinks(file, base = root) {
  const out = [];
  for (const { target, line } of linkTargets(readFileSync(file, 'utf8'))) {
    if (!isRelative(target)) continue;
    let path = target.split('#')[0].split('?')[0];
    if (path === '') continue;
    try {
      path = decodeURIComponent(path);
    } catch {
      // A malformed escape is checked as written.
    }
    const resolved = path.startsWith('/') ? join(base, path) : resolve(dirname(file), path);
    if (!existsSync(resolved)) {
      out.push({ file: relative(base, file).replaceAll('\\', '/'), line, target });
    }
  }
  return out;
}

export function check(base = root, scope = SCOPE) {
  const files = [
    ...scope.folders.filter((f) => existsSync(join(base, f))).flatMap((f) => markdownFiles(join(base, f))),
    ...scope.files.map((f) => join(base, f)).filter((f) => existsSync(f)),
  ];
  return { files: files.length, broken: files.flatMap((file) => brokenLinks(file, base)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = check();
  for (const b of result.broken) console.error(`  FAIL ${b.file}:${b.line} -> ${b.target}`);
  console.log(`docs-links-check: ${result.files} files, ${result.broken.length} broken links`);
  if (result.broken.length > 0) process.exitCode = 1;
}
