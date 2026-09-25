import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contentRegistry } from '@content/loader';

describe('F-07: operate.ts names no content', () => {
  it('operates workshops with zero hard-coded recipe, item, material, or building ids', () => {
    const registry = contentRegistry();
    const contentIds = new Set<string>([
      ...registry.table('recipes').ids(),
      ...registry.table('items').ids(),
      ...registry.table('materials').ids(),
      ...registry.table('buildings').ids(),
    ]);

    const filePath = resolve(__dirname, '../../../src/systems/workshops/operate.ts');
    const code = readFileSync(filePath, 'utf8');

    // Extract all single-quoted string literals: '...'
    const matches = Array.from(code.matchAll(/'([^'\\\r\n]*(?:\\.[^'\\\r\n]*)*)'/g), (m) => m[1]!);
    const violations: string[] = [];

    for (const lit of matches) {
      if (contentIds.has(lit)) {
        violations.push(lit);
      }
    }

    expect(violations).toEqual([]);
  });
});
