// T-819: two twenty-seed sweeps paired by seed and shift, or a sweep against master's drift reference.
//
//   npm run sweep:compare -- <base> <change> [--top N] [--md <file>] [--json <file>] [--title <text>]
//   npm run sweep:compare -- --set-reference <sweep> [--run <id>] [--note <text>] [--out <file>]
//
// <base> and <change> are each a Measure run id (its `sweep` artifact is downloaded with gh into
// .vite/sweep-runs/<id> once), a directory holding `shift-<n>/three-years-<seed>.json` files (a downloaded
// `sweep` artifact or a whole run's artifacts) or a `verdict.json`, a JSON file of either kind, or `reference`
// (reports/data/sweep-drift-reference.json, master's fixed drift reference). It prints the paired figures by
// shift, by peril and pooled, with the noise, the moved timelines, the rise/fall counts, the paired verdict and
// the largest movers (docs/04-implementation/tooling.md § Pairing two sweeps). It exits 0 whatever the verdict;
// 1 on a bad input.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSweeps, comparisonMarkdown, loadSweepDir, loadSweepJson } from './lib/sweep-pairs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REFERENCE_FILE = join(ROOT, 'reports/data/sweep-drift-reference.json');

function usage(message) {
  if (message) console.error(message);
  console.error('usage: npm run sweep:compare -- <base> <change> [--top N] [--md <file>] [--json <file>] [--title <text>]');
  console.error('       npm run sweep:compare -- --set-reference <sweep> [--run <id>] [--note <text>] [--out <file>]');
  console.error('  a sweep is a Measure run id, a directory of shift-<n>/three-years-<seed>.json (or a verdict.json), a JSON file, or "reference"');
  process.exit(1);
}

/** A run's `sweep` artifact, downloaded once into .vite/sweep-runs/<id>; a whole run's seed artifacts if it has none. */
function runDir(id) {
  const dir = join(ROOT, '.vite/sweep-runs', id);
  if (existsSync(dir)) return dir;
  mkdirSync(dir, { recursive: true });
  try {
    execFileSync('gh', ['run', 'download', id, '-n', 'sweep', '-D', dir], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch {
    execFileSync('gh', ['run', 'download', id, '-p', 'seed-*', '-D', dir], { stdio: ['ignore', 'ignore', 'inherit'] });
  }
  return dir;
}

/** @returns {{ name: string; rows: import('./lib/sweep-pairs.mjs').SeedShift[]; commits: string[]; fingerprint: string; run?: string }} */
function load(source) {
  if (source === 'reference') {
    const ref = JSON.parse(readFileSync(REFERENCE_FILE, 'utf8'));
    return { ...loadSweepJson(ref), name: `the drift reference ${String(ref.commit).slice(0, 8)} (run ${ref.run})`, run: String(ref.run) };
  }
  if (/^\d+$/.test(source) && !existsSync(source)) {
    const s = loadSweepDir(runDir(source));
    return { ...s, name: `${s.commits.map((c) => c.slice(0, 8)).join(', ') || '?'} (run ${source})`, run: source };
  }
  if (!existsSync(source)) usage(`${source}: no such run, directory or file`);
  const s = statSync(source).isDirectory() ? loadSweepDir(source) : loadSweepJson(JSON.parse(readFileSync(source, 'utf8')));
  return { ...s, name: `${s.commits.map((c) => c.slice(0, 8)).join(', ') || source}` };
}

const args = process.argv.slice(2);
const opt = (flag) => {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  const value = args[i + 1];
  if (value === undefined) usage(`${flag} needs a value`);
  args.splice(i, 2);
  return value;
};

const setReference = opt('--set-reference');
if (setReference !== undefined) {
  const run = opt('--run');
  const note = opt('--note');
  const out = opt('--out') ?? REFERENCE_FILE;
  const s = load(setReference);
  if (s.commits.length !== 1) usage(`a reference is one commit's sweep; this one holds ${s.commits.length}: ${s.commits.join(', ')}`);
  const head = { commit: s.commits[0], run: Number(run ?? s.run ?? 0), set: new Date().toISOString().slice(0, 10), note: note ?? '', fingerprint: s.fingerprint };
  // One seed-shift a line, so a renewal's diff reads row by row.
  writeFileSync(out, `${JSON.stringify(head, null, 2).slice(0, -2)},\n  "rows": [\n${s.rows.map((r) => `    ${JSON.stringify(r)}`).join(',\n')}\n  ]\n}\n`);
  console.log(`Drift reference set: ${head.commit.slice(0, 8)}, run ${head.run}, ${s.rows.length} seed-shifts -> ${out}`);
  process.exit(0);
}

const top = Number(opt('--top') ?? 8);
const mdOut = opt('--md');
const jsonOut = opt('--json');
const title = opt('--title');
if (args.length !== 2) usage();
const [base, change] = args.map(load);
const comparison = compareSweeps(base.rows, change.rows, { top });
if (comparison.pooled.pairs === 0) usage('the two sweeps share no seed-shift');
const fingerprint = base.fingerprint === 'full' && change.fingerprint === 'full' ? 'full' : 'rows';
const md = comparisonMarkdown(comparison, {
  title: title ?? (args[0] === 'reference' ? 'Drift from master\'s reference' : 'Paired sweep'), baseName: base.name, changeName: change.name, fingerprint,
});
console.log(md);
if (mdOut) writeFileSync(mdOut, md);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ base: { name: base.name, commits: base.commits }, change: { name: change.name, commits: change.commits }, ...comparison }, null, 2) + '\n');
