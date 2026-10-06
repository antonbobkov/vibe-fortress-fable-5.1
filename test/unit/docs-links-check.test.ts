import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Broken = { file: string; line: number; target: string };
const api = await import(new URL('../../scripts/docs-links-check.mjs', import.meta.url).href) as {
  linkTargets(markdown: string): { target: string; line: number }[];
  isRelative(target: string): boolean;
  check(base?: string, scope?: { folders: string[]; files: string[] }): { files: number; broken: Broken[] };
};

describe('T-101 docs link check', () => {
  it('reads link targets outside code, with their line', () => {
    const text = [
      'See [a](a.md) and [`b.md`](sub/b.md#part "title").',
      'Not a link: `[c](c.md)`.',
      '```',
      '[d](d.md)',
      '```',
      '![shot](<my shot.png>)',
    ].join('\n');
    expect(api.linkTargets(text)).toEqual([
      { target: 'a.md', line: 1 },
      { target: 'sub/b.md#part', line: 1 },
      { target: 'my shot.png', line: 6 },
    ]);
  });

  it('checks relative paths only', () => {
    expect(api.isRelative('../x.md')).toBe(true);
    expect(api.isRelative('x.md#y')).toBe(true);
    expect(api.isRelative('#y')).toBe(false);
    expect(api.isRelative('https://example.org/x.md')).toBe(false);
    expect(api.isRelative('mailto:a@example.org')).toBe(false);
  });

  it('reports a link whose file is missing, and accepts files, folders and anchors', () => {
    const base = mkdtempSync(join(tmpdir(), 'docs-links-'));
    try {
      mkdirSync(join(base, 'docs/sub'), { recursive: true });
      writeFileSync(join(base, 'docs/sub/b.md'), '[up](../a.md#x) [gone](../gone.md)\n');
      writeFileSync(join(base, 'docs/a.md'), '[b](sub/b.md) [folder](sub/) [web](https://example.org)\n\n[lost](sub/c.md)\n');
      const result = api.check(base, { folders: ['docs'], files: ['README.md'] });
      expect(result.files).toBe(2);
      expect(result.broken).toEqual([
        { file: 'docs/a.md', line: 3, target: 'sub/c.md' },
        { file: 'docs/sub/b.md', line: 1, target: '../gone.md' },
      ]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('finds no broken link in the repository', () => {
    const result = api.check();
    expect(result.files).toBeGreaterThan(100);
    expect(result.broken).toEqual([]);
  });
});
