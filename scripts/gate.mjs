#!/usr/bin/env node
// Milestone gate: runs the verification scripts in order and writes reports/M<n>-gate.md.
// `01-testing-strategy.md` § Commands, `00-agent-workflow.md` § The milestone gate.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function currentMilestone() {
  const progress = readFileSync(join(root, 'docs/05-plan/PROGRESS.md'), 'utf8');
  const m = /^current-milestone:\s*(\d+)\s*$/m.exec(progress);
  if (!m) throw new Error('PROGRESS.md has no "current-milestone: n" header line');
  return Number(m[1]);
}

const STEPS = [
  { name: 'lint', script: 'lint' },
  { name: 'typecheck', script: 'typecheck' },
  { name: 'content:check', script: 'content:check' },
  { name: 'test', script: 'test', args: ['--coverage'] },
  { name: 'test:e2e', script: 'test:e2e', optional: true },
];

function run(step) {
  const args = ['run', step.script, ...(step.args ? ['--', ...step.args] : [])];
  const started = Date.now();
  const res = spawnSync('npm', args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const ms = Date.now() - started;
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  process.stdout.write(output);
  return { name: step.name, ok: res.status === 0, ms, output, optional: step.optional === true };
}

function coverageSummary() {
  const file = join(root, 'reports/coverage/coverage-summary.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')).total ?? null;
  } catch {
    return null;
  }
}

function testCounts(output) {
  const files = /Test Files\s+(.*)$/m.exec(output);
  const tests = /\bTests\s+(.*)$/m.exec(output);
  return { files: files ? files[1].trim() : 'n/a', tests: tests ? tests[1].trim() : 'n/a' };
}

const milestone = currentMilestone();
const results = STEPS.map(run);
const counts = testCounts(results.find((r) => r.name === 'test')?.output ?? '');
const cov = coverageSummary();

const lines = [
  `# M${milestone} gate report`,
  '',
  `Milestone: M${milestone}`,
  '',
  '## Steps',
  '',
  '| Step | Result | Duration |',
  '|---|---|---|',
  ...results.map(
    (r) =>
      `| \`npm run ${r.name}\` | ${r.ok ? 'pass' : r.optional ? 'not run' : 'FAIL'} | ${(r.ms / 1000).toFixed(1)} s |`,
  ),
  '',
  '## Tests',
  '',
  `- Test files: ${counts.files}`,
  `- Tests: ${counts.tests}`,
  '',
  '## Coverage',
  '',
  cov
    ? [
        '| Metric | % |',
        '|---|---|',
        `| lines | ${cov.lines.pct} |`,
        `| statements | ${cov.statements.pct} |`,
        `| functions | ${cov.functions.pct} |`,
        `| branches | ${cov.branches.pct} |`,
      ].join('\n')
    : 'Coverage summary not produced.',
  '',
];

mkdirSync(join(root, 'reports'), { recursive: true });
writeFileSync(join(root, `reports/M${milestone}-gate.md`), `${lines.join('\n')}\n`, 'utf8');

const failed = results.filter((r) => !r.ok && !r.optional);
if (failed.length > 0) {
  console.error(`gate: ${failed.map((f) => f.name).join(', ')} failed`);
  process.exit(1);
}
console.log(`gate: wrote reports/M${milestone}-gate.md`);
