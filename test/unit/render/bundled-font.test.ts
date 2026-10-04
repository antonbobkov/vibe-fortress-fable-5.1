import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { glyphChars } from '@render/atlas';

const api = await import(pathToFileURL(resolve('scripts/font-coverage.mjs')).href) as {
  missingGlyphs(font: Buffer, chars: readonly string[]): string[];
};

describe('T-M8-09 bundled font', () => {
  it('covers every CP437 and content glyph without platform fallback', () => {
    const chars = glyphChars(loadContent());
    expect(chars).toHaveLength(280);
    expect(api.missingGlyphs(readFileSync('src/assets/unscii-8.ttf'), chars)).toEqual([]);
    expect(api.missingGlyphs(readFileSync('src/assets/unscii-8.ttf'), ['\u{10ffff}'])).toEqual(['\u{10ffff}']);
  });
});
