#!/usr/bin/env node
// Gate: runs every verification script in order and writes a frozen report under reports/gates/.
// `testing-strategy.md` § Commands, § Coverage gates; `agent-workflow.md` § The gate.
//
//   npm run gate                      writes reports/gates/<YYYY-MM-DD>-gate.md
//   npm run gate -- T-123             writes reports/gates/T-123-gate.md
//   npm run gate -- v1.1.0 --no-perf  skips the performance tier and says so in the report
//   npm run gate -- --where           prints the report path and the steps, runs nothing
//
// A gate report is never overwritten: a label that already has a report gets `-2`, `-3`, ….

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { seedHashes, previousSeedGate, compareSeedHashes } from './seed-hashes.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GATES_DIR = 'reports/gates';

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const unknown = flags.filter((f) => f !== '--no-perf' && f !== '--where');
if (unknown.length > 0 || positional.length > 1) {
  console.error('usage: npm run gate -- [label] [--no-perf] [--where]');
  process.exit(2);
}
const runPerf = !flags.includes('--no-perf');

function today() {
  const now = new Date();
  const two = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/** The report's label: the argument (a task id, a version, a bare milestone number) or the date. */
function gateLabel() {
  const arg = positional[0];
  if (arg === undefined) return today();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(arg)) {
    console.error(`gate: label "${arg}" may hold only letters, digits, ".", "_" and "-"`);
    process.exit(2);
  }
  // The build's gates were called by milestone number: `npm run gate -- 8` labels the report M8.
  return /^\d+$/.test(arg) ? `M${arg}` : arg;
}

/** `reports/gates/<label>-gate.md`, or the first `<label>-<n>-gate.md` that does not exist yet. */
function reportPath(label) {
  let path = `${GATES_DIR}/${label}-gate.md`;
  for (let n = 2; existsSync(join(root, path)); n += 1) path = `${GATES_DIR}/${label}-${n}-gate.md`;
  return path;
}

function steps() {
  return [
    { name: 'lint', script: 'lint' },
    { name: 'typecheck', script: 'typecheck' },
    { name: 'content:check', script: 'content:check' },
    // T-M7-10: the strings audit fails on a missing or an unused key.
    { name: 'strings:check', script: 'strings:check' },
    { name: 'interface:check', script: 'interface:check' },
    // A broken relative link in docs/, reports/, agents/ or the root README fails the gate.
    { name: 'docs:check', script: 'docs:check' },
    // `--coverage` makes vitest enforce the thresholds of vitest.config.ts.
    { name: 'test', script: 'test', args: ['--coverage'] },
    { name: 'test:e2e', script: 'test:e2e' },
    // T-M8-09: E2E builds test-mode dist; verify and leave production output for release.
    { name: 'build', script: 'build' },
    ...(runPerf ? [{ name: 'test:perf', script: 'test:perf' }] : []),
  ];
}

/**
 * `testing-strategy.md` § Coverage gates. The same globs are enforced by `vitest.config.ts`
 * (`coverage.thresholds`) during the `test --coverage` step; this table reports them.
 */
const COVERAGE_GATES = [
  { dir: 'src/core', match: (p) => p.startsWith('src/core/'), lines: 90 },
  { dir: 'src/systems/**/rules', match: (p) => /^src\/systems\/.+\/rules\//.test(p), lines: 90 },
  { dir: 'src/systems/**', match: (p) => p.startsWith('src/systems/'), lines: 75 },
  { dir: 'src/render', match: (p) => p.startsWith('src/render/'), lines: 60 },
  { dir: 'src/ui', match: (p) => p.startsWith('src/ui/'), lines: 50 },
];

/** Reported without a threshold, because the strategy documents none for them (D-037). */
const COVERAGE_REPORTED = ['src/app', 'src/content', 'src/platform'];

/** Remove ANSI escape sequences (colours) from a runner's output. */
function stripAnsi(text) {
  return text.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'), '');
}

function run(step) {
  const args = ['run', step.script, ...(step.args ? ['--', ...step.args] : [])];
  const started = Date.now();
  const res = spawnSync('npm', args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    // T-113: the performance tier prints more than spawnSync's 1 MiB default buffer, which killed
    // the step with ENOBUFS and no test failure; 1 GiB holds a five-hour run.
    maxBuffer: 1024 * 1024 * 1024,
  });
  const ms = Date.now() - started;
  // stdout and stderr are both kept; a step the runner could not finish says why (a spawn error,
  // a signal, or the exit status) at the end of its output, so the report names the failure.
  const why = res.error ? `spawn error: ${res.error.message}` : res.signal ? `killed by ${res.signal}` : res.status !== 0 ? `exit status ${res.status}` : '';
  const raw = `${res.stdout ?? ''}${res.stderr ?? ''}${why ? `\ngate: ${step.name}: ${why}\n` : ''}`;
  process.stdout.write(raw);
  // The runners colour their output when the terminal allows it; the report parses plain text.
  const output = stripAnsi(raw);
  return { name: step.name, ok: res.status === 0, ms, output, why };
}

function coverageFile() {
  const file = join(root, 'reports/coverage/coverage-summary.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Repository-relative `src/...` path of a coverage key (absolute, either slash). */
function srcPath(key) {
  const normal = key.split(String.fromCharCode(92)).join('/');
  const at = normal.lastIndexOf('/src/');
  return at < 0 ? null : normal.slice(at + 1);
}

/** Lines covered and total over the files a predicate selects. */
function linesWhere(summary, match) {
  let covered = 0;
  let total = 0;
  for (const [key, value] of Object.entries(summary)) {
    if (key === 'total') continue;
    const path = srcPath(key);
    if (path === null || !match(path)) continue;
    covered += value.lines.covered;
    total += value.lines.total;
  }
  return { covered, total, pct: total === 0 ? null : (100 * covered) / total };
}

function coverageTable(summary) {
  const rows = [
    '| Directory | Lines covered | Lines % | Threshold | Result |',
    '|---|---|---|---|---|',
  ];
  for (const gate of COVERAGE_GATES) {
    const c = linesWhere(summary, gate.match);
    const pct = c.pct === null ? 'no files yet' : c.pct.toFixed(2);
    const ok = c.pct === null || c.pct >= gate.lines;
    rows.push(`| \`${gate.dir}\` | ${c.covered}/${c.total} | ${pct} | ${gate.lines}% | ${ok ? 'pass' : 'FAIL'} |`);
  }
  for (const dir of COVERAGE_REPORTED) {
    const c = linesWhere(summary, (p) => p.startsWith(`${dir}/`));
    const pct = c.pct === null ? 'no files yet' : c.pct.toFixed(2);
    rows.push(`| \`${dir}\` | ${c.covered}/${c.total} | ${pct} | none documented | reported |`);
  }
  return rows.join('\n');
}

/**
 * The scenario lines of the vitest output. The milestone suites of F-09d name themselves
 * `Milestone <n> scenarios > <id> (M<n>)`; the M0 index used `T-M0-11 scenarios` (T-M7-12).
 */
function scenarioLines(output) {
  const out = [];
  const pattern = /([✓✔√×✖↓])\s+(?:test\/scenarios\/\S+ > )?(?:Milestone \d|T-M\d+-\d+) scenarios > (\w+) \(M(\d)\)/;
  for (const line of output.split(/\r?\n/)) {
    const m = pattern.exec(line);
    if (!m) continue;
    const result = (m[1] === '✓' || m[1] === '✔' || m[1] === '√') ? 'pass' : m[1] === '↓' ? 'skipped' : 'FAIL';
    out.push(`| \`${m[2]}\` | M${m[3]} | ${result} |`);
  }
  return out;
}

/**
 * T-113: the per-system timings of the performance tier. `measure-reference.ts` prints one
 * `perf_reference:` line per measured fixture; the budget table of `performance-budget.md` is
 * the allocation, and `per-system.test.ts` enforces each at most twice its budget on the
 * furniture fixture (the one the budgets were measured on).
 */
function perSystemSection(output) {
  const runs = [];
  for (const line of output.split(/\r?\n/)) {
    const at = line.indexOf('perf_reference: ');
    if (at < 0) continue;
    try { runs.push(JSON.parse(line.slice(at + 'perf_reference: '.length))); } catch { /* a cut line is skipped */ }
  }
  if (runs.length === 0) return 'No per-system timings in the performance output.';
  const doc = readFileSync(join(root, 'docs/01-architecture/performance-budget.md'), 'utf8');
  const budgets = [...doc.matchAll(/^\| (\d{2}|core)(?: [^|]*)? \| ([\d.]+) \|/gm)].map((m) => ({ id: m[1], budget: Number(m[2]) }));
  const name = (r) => String(r.fixture).split(/[\\/]/).pop();
  const value = (r, id) => (id === 'core' ? r.coreMs : id === '22' ? r.pathingMs : r.systems?.[id]);
  const ms = (v) => (typeof v === 'number' ? v.toFixed(3) : 'n/a');
  const furniture = runs.find((r) => /furniture/.test(String(r.fixture))) ?? runs[0];
  const rows = budgets.map(({ id, budget }) => {
    const v = value(furniture, id);
    const verdict = typeof v !== 'number' ? 'n/a' : v <= budget ? 'within' : v <= 2 * budget ? 'over, within 2×' : 'OVER 2×';
    return `| ${id} | ${budget.toFixed(2)} | ${runs.map((r) => ms(value(r, id))).join(' | ')} | ${verdict} |`;
  });
  return [
    `Average milliseconds per tick by system on each measured fixture; the verdict compares \`${name(furniture)}\` with its allocation (\`per-system.test.ts\` fails above twice it).`,
    '',
    `| System | Budget (ms) | ${runs.map(name).join(' | ')} | Verdict |`,
    `|---|---|${runs.map(() => '---|').join('')}---|`,
    ...rows,
    '',
    '| Fixture | Average tick (ms) | Worst tick (ms) | Steady worst tick (ms) |',
    '|---|---|---|---|',
    ...runs.map((r) => `| \`${name(r)}\` | ${ms(r.averageTickMs)} | ${ms(r.worstTickMs)} | ${ms(r.steadyWorstTickMs)} |`),
  ].join('\n');
}

function testCounts(output) {
  const files = /Test Files\s+(.*)$/m.exec(output);
  const tests = /\bTests\s+(.*)$/m.exec(output);
  return { files: files ? files[1].trim() : 'n/a', tests: tests ? tests[1].trim() : 'n/a' };
}

const label = gateLabel();
const report = reportPath(label);
if (flags.includes('--where')) {
  console.log(`gate: would write ${report}`);
  console.log(`gate: steps ${steps().map((s) => s.name).join(', ')}`);
  process.exit(0);
}

function commit() {
  const res = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : 'unknown';
}

const recorded = new Date().toISOString();
const previousSeeds = existsSync(join(root, GATES_DIR)) ? previousSeedGate(join(root, GATES_DIR)) : null;
const results = steps().map(run);
const hashes = seedHashes(results.find((r) => r.name === 'test:perf')?.output ?? '');
const comparisons = compareSeedHashes(hashes, previousSeeds?.records ?? []);
const testOutput = results.find((r) => r.name === 'test')?.output ?? '';
const counts = testCounts(testOutput);
const e2eOutput = results.find((r) => r.name === 'test:e2e')?.output ?? '';
const e2ePassed = /(\d+) passed/.exec(e2eOutput);
const e2eFailed = /(\d+) failed/.exec(e2eOutput);
const summary = coverageFile();
const cov = summary?.total ?? null;
const scenarios = scenarioLines(testOutput);

const lines = [
  `# Gate report: ${label}`,
  '',
  `Label: ${label}. Date: ${today()}. Commit: \`${commit()}\`. Generated by \`npm run gate\` (scripts/gate.mjs). Frozen: a later run writes a new report.`,
  '',
  `Recorded: ${recorded}`,
  '',
  '## Steps',
  '',
  '| Step | Result | Duration |',
  '|---|---|---|',
  ...results.map((r) => `| \`npm run ${r.name}\` | ${r.ok ? 'pass' : `FAIL (${r.why})`} | ${(r.ms / 1000).toFixed(1)} s |`),
  '',
  runPerf ? '' : 'The performance tier was not run (`--no-perf`).',
  '',
  '## Tests',
  '',
  `- Test files: ${counts.files}`,
  `- Tests: ${counts.tests}`,
  `- E2E: ${e2ePassed ? `${e2ePassed[1]} passed` : '0 passed'}${e2eFailed ? `, ${e2eFailed[1]} failed` : ''}`,
  '',
  '## Scenarios',
  '',
  scenarios.length > 0
    ? ['| Scenario | Milestone | Result |', '|---|---|---|', ...scenarios].join('\n')
    : 'No scenario lines found in the test output.',
  '',
  '## Seed determinism across processes',
  '',
  hashes.length === 0 ? 'No seed hashes produced; no determinism comparison was made.' : [
    previousSeeds ? `Compared with [${previousSeeds.name}](${previousSeeds.name}); changed hashes require review against intervening behavior and fixture changes.` : 'No previous gate contains seed hashes; this report establishes the baseline.',
    '',
    '| Seed | Peril | Tick | Hash | Previous hash | Comparison |',
    '|---|---|---|---|---|---|',
    ...comparisons.map((r) => `| ${r.seed} | ${r.peril} | ${r.tick} | ${r.hash} | ${r.previous ?? 'none'} | ${r.result} |`),
    '',
    '```text',
    ...hashes.map((r) => `[three_years_hash] ${JSON.stringify(r)}`),
    '```',
  ].join('\n'),
  '',
  '## Per-system timings',
  '',
  runPerf ? perSystemSection(results.find((r) => r.name === 'test:perf')?.output ?? '') : 'Not measured (`--no-perf`).',
  '',
  '## Coverage',
  '',
  summary ? coverageTable(summary) : 'Coverage summary not produced.',
  '',
  cov
    ? [
        '| Overall metric | % |',
        '|---|---|',
        `| lines | ${cov.lines.pct} |`,
        `| statements | ${cov.statements.pct} |`,
        `| functions | ${cov.functions.pct} |`,
        `| branches | ${cov.branches.pct} |`,
      ].join('\n')
    : '',
  '',
];

mkdirSync(join(root, GATES_DIR), { recursive: true });
writeFileSync(join(root, report), `${lines.join('\n')}\n`, 'utf8');

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`gate: ${failed.map((f) => f.name).join(', ')} failed`);
  process.exit(1);
}
console.log(`gate: wrote ${report}`);
