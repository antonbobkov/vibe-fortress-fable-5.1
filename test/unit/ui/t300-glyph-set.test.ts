import { describe, expect, it } from 'vitest';
import { UI_STRINGS } from '@ui/strings';
import { glyphs, registry } from './ui-fixture';

describe('T-300 every player-facing string is drawable', () => {
  it('holds no character outside the glyph set, in the UI defaults, strings.json and the hint table', () => {
    const content = registry.derived<Readonly<Record<string, string>>>('strings');
    const hintTable = registry.table<{ id: string; text: string }>('hints');
    const hints = hintTable.ids().map((id) => [`hints.${id}`, hintTable.byId(id)!.text] as const);
    const missing: string[] = [];
    for (const [key, text] of [...Object.entries(UI_STRINGS), ...Object.entries(content), ...hints]) {
      for (const ch of text) if (ch !== '?' && glyphs.index(ch) === glyphs.unknown) missing.push(`${key}: U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} ${ch}`);
    }
    expect(missing).toEqual([]);
  });
});
