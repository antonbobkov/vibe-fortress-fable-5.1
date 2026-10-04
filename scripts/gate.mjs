#!/usr/bin/env node
// Milestone gate: runs the verification scripts in order and writes reports/M<n>-gate.md.
// `01-testing-strategy.md` § Commands, § Coverage gates; `00-agent-workflow.md` § The milestone
// gate ("runs the full milestone test set, the performance smoke for that milestone, the e2e
// suite, and produces `reports/M<n>-gate.md` (test counts, timings, coverage)").

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function currentMilestone() {
  const arg = process.argv.slice(2).find((a) => /^\d+$/.test(a));
  if (arg) return Number(arg);
  const progress = readFileSync(join(root, 'docs/05-plan/PROGRESS.md'), 'utf8');
  const m = /^current-milestone:\s*(\d+)\s*$/m.exec(progress);
  if (!m) throw new Error('PROGRESS.md has no "current-milestone: n" header line');
  return Number(m[1]);
}

/** Gates M3, M6 and M8 also run the performance smoke (`01-testing-strategy.md` § Tiers). */
const PERF_GATES = new Set([3, 6, 8]);

function steps(milestone) {
  return [
    { name: 'lint', script: 'lint' },
    { name: 'typecheck', script: 'typecheck' },
    { name: 'content:check', script: 'content:check' },
    // T-M7-10: the strings audit fails on a missing or an unused key.
    { name: 'strings:check', script: 'strings:check' },
    { name: 'interface:check', script: 'interface:check' },
    // `--coverage` makes vitest enforce the thresholds of vitest.config.ts.
    { name: 'test', script: 'test', args: ['--coverage'] },
    // The e2e suite is part of every gate (M0: `boot`).
    { name: 'test:e2e', script: 'test:e2e' },
    ...(PERF_GATES.has(milestone) ? [{ name: 'test:perf', script: 'test:perf' }] : []),
  ];
}

/**
 * `01-testing-strategy.md` § Coverage gates. The same globs are enforced by `vitest.config.ts`
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
  });
  const ms = Date.now() - started;
  const raw = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  process.stdout.write(raw);
  // The runners colour their output when the terminal allows it; the report parses plain text.
  const output = stripAnsi(raw);
  return { name: step.name, ok: res.status === 0, ms, output };
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

function testCounts(output) {
  const files = /Test Files\s+(.*)$/m.exec(output);
  const tests = /\bTests\s+(.*)$/m.exec(output);
  return { files: files ? files[1].trim() : 'n/a', tests: tests ? tests[1].trim() : 'n/a' };
}

const milestone = currentMilestone();
const results = steps(milestone).map(run);
const testOutput = results.find((r) => r.name === 'test')?.output ?? '';
const counts = testCounts(testOutput);
const e2eOutput = results.find((r) => r.name === 'test:e2e')?.output ?? '';
const e2ePassed = /(\d+) passed/.exec(e2eOutput);
const e2eFailed = /(\d+) failed/.exec(e2eOutput);
const summary = coverageFile();
const cov = summary?.total ?? null;
const scenarios = scenarioLines(testOutput);

const lines = [
  `# M${milestone} gate report`,
  '',
  `Milestone: M${milestone}. Generated by \`npm run gate\` (scripts/gate.mjs).`,
  '',
  '## Steps',
  '',
  '| Step | Result | Duration |',
  '|---|---|---|',
  ...results.map((r) => `| \`npm run ${r.name}\` | ${r.ok ? 'pass' : 'FAIL'} | ${(r.ms / 1000).toFixed(1)} s |`),
  '',
  PERF_GATES.has(milestone) ? '' : `No performance smoke at M${milestone}; it runs at the M3, M6 and M8 gates.`,
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

mkdirSync(join(root, 'reports'), { recursive: true });
writeFileSync(join(root, `reports/M${milestone}-gate.md`), `${lines.join('\n')}\n`, 'utf8');

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`gate: ${failed.map((f) => f.name).join(', ')} failed`);
  process.exit(1);
}
console.log(`gate: wrote reports/M${milestone}-gate.md`);
