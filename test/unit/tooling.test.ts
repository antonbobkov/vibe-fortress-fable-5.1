import { describe, it, expect, afterEach } from 'vitest';
import { ESLint } from 'eslint';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

const written: string[] = [];

/** Write a throwaway source file inside a real layer directory and lint it with the real config. */
async function lintFixture(relPath: string, source: string): Promise<ESLint.LintResult> {
  const abs = join(root, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, source, 'utf8');
  written.push(abs);
  const eslint = new ESLint({ cwd: root });
  const results = await eslint.lintFiles([abs]);
  const result = results[0];
  if (!result) throw new Error(`eslint returned no result for ${relPath}`);
  return result;
}

function ruleIds(result: ESLint.LintResult): string[] {
  return result.messages.map((m) => m.ruleId ?? '<fatal>');
}

afterEach(() => {
  for (const f of written.splice(0)) rmSync(f, { force: true });
});

describe('T-M0-01 tooling: ESLint layer boundaries', () => {
  it('src/render importing a system state module fails lint', async () => {
    const result = await lintFixture(
      'src/render/boundary.lintfixture.ts',
      `import { state } from '@systems/x/state';\nexport const s = state;\n`,
    );
    expect(ruleIds(result)).toContain('no-restricted-imports');
  });

  it('src/render importing a system reader is allowed', async () => {
    const result = await lintFixture(
      'src/render/allowed.lintfixture.ts',
      `import type { Reader } from '@systems/x/reader';\nexport type R = Reader;\n`,
    );
    expect(ruleIds(result)).not.toContain('no-restricted-imports');
  });

  it('src/core importing @systems fails lint', async () => {
    const result = await lintFixture(
      'src/core/boundary.lintfixture.ts',
      `import { thing } from '@systems/x/reader';\nexport const t = thing;\n`,
    );
    expect(ruleIds(result)).toContain('no-restricted-imports');
  });

  it('src/systems importing @render fails lint', async () => {
    const result = await lintFixture(
      'src/systems/boundary.lintfixture.ts',
      `import { draw } from '@render/renderer';\nexport const d = draw;\n`,
    );
    expect(ruleIds(result)).toContain('no-restricted-imports');
  });

  it('src/ui importing @app fails lint', async () => {
    const result = await lintFixture(
      'src/ui/boundary.lintfixture.ts',
      `import { game } from '@app/game';\nexport const g = game;\n`,
    );
    expect(ruleIds(result)).toContain('no-restricted-imports');
  });
});

describe('T-M0-01 tooling: determinism rules', () => {
  it('Math.random in src/core fails lint', async () => {
    const result = await lintFixture(
      'src/core/random.lintfixture.ts',
      `export function r(): number {\n  return Math.random();\n}\n`,
    );
    expect(ruleIds(result)).toContain('no-restricted-properties');
  });

  it('Date.now in src/systems fails lint', async () => {
    const result = await lintFixture(
      'src/systems/clock.lintfixture.ts',
      `export function t(): number {\n  return Date.now();\n}\n`,
    );
    expect(ruleIds(result)).toContain('no-restricted-properties');
  });

  it('new Date() in src/content fails lint', async () => {
    const result = await lintFixture(
      'src/content/clock.lintfixture.ts',
      `export function t(): number {\n  return new Date().getTime();\n}\n`,
    );
    expect(ruleIds(result)).toContain('no-restricted-globals');
  });

  it('Math.random in src/platform is allowed', async () => {
    const result = await lintFixture(
      'src/platform/random.lintfixture.ts',
      `export function r(): number {\n  return Math.random();\n}\n`,
    );
    expect(ruleIds(result)).not.toContain('no-restricted-properties');
  });

  it('for...of over a Map iterator method fails lint in src/core', async () => {
    const result = await lintFixture(
      'src/core/iterate.lintfixture.ts',
      `export function keys(m: Map<number, number>): number[] {\n` +
        `  const out: number[] = [];\n` +
        `  for (const k of m.keys()) out.push(k);\n` +
        `  return out;\n}\n`,
    );
    expect(ruleIds(result)).toContain('no-restricted-syntax');
  });
});
