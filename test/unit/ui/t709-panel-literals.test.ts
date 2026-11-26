/**
 * T-709: the fortress panels draw no text written in their code. `content-pipeline.md` § Strings:
 * player-facing text is a strings key; `strings:check` reads every string and template literal of
 * `src/ui/panels` and fails on one that reads as text for the player.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Strings } from '@ui/strings';
import { eligibilityText } from '@ui/panels/population';
import { deepQuote } from '@ui/panels/threats';
import { moodTierName } from '@ui/panels/mood';
import { squadPresetNames } from '@ui/panels/military';
// @ts-expect-error -- a plain .mjs script without type declarations
import { check, literalsIn, looksPlayerFacing, panelLiterals } from '../../../scripts/strings-check.mjs';

const P = '\u0000';

describe('T-709 panel texts are in the strings table', () => {
  it('finds no literal text in the panels of the repository', () => {
    const result = check() as { literals: string[] };
    expect(result.literals).toEqual([]);
  });

  it('reads string and template literals, not comments or regular expressions', () => {
    const source = [
      "// 'Not a literal'",
      '/* `nor this` */',
      "const a = 'Squads';",
      'const b = /it\'s (\\w+)/.exec(x);',
      'const c = `${n}: sealed ${`Inner ${m}`}`;',
    ].join('\n');
    const found = (literalsIn(source) as { line: number; text: string }[]).map((l) => [l.line, l.text]);
    expect(found).toEqual([[3, 'Squads'], [5, `Inner ${P}`], [5, `${P}: sealed ${P}`]]);
  });

  it('tells text for the player from keys, ids, command types and key names', () => {
    for (const text of ['Squads', `${P}: sealed`, '[h] hunt toggle', 'No squads yet: [+] makes one.', ' and ', `Peril ${P}`]) {
      expect(looksPlayerFacing(text), text).toBe(true);
    }
    for (const text of [`ui.zone.type.${P}`, `ui.units.fact.${P}_state`, 'SetSquadMode', 'Enter', 'ArrowUp', `item:${P}`, '../widgets', 'tool/pick', '▓', 'hall_spirit', `${P} · ${P}`, 'a']) {
      expect(looksPlayerFacing(text), text).toBe(false);
    }
  });

  it('fails on a literal planted in a panel, the creature view too (it skips no file)', () => {
    const dir = mkdtempSync(join(tmpdir(), 't709-'));
    try {
      mkdirSync(join(dir, 'src/ui/panels'), { recursive: true });
      writeFileSync(join(dir, 'src/ui/panels/planted.ts'), "label(s, 0, 0, strings.get('ui.depot.none'));\nlabel(s, 0, 1, 'No depot here.');\n");
      writeFileSync(join(dir, 'src/ui/panels/look.ts'), "label(s, 0, 0, 'Not yet moved');\n");
      expect(panelLiterals(dir).sort()).toEqual(['src/ui/panels/look.ts:1: "Not yet moved"', 'src/ui/panels/planted.ts:2: "No depot here."']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps the words the panels drew from their code', () => {
    const strings = new Strings();
    expect(eligibilityText(['spirit'], strings)).toBe('Eligible: no · hall spirit below Content');
    expect(eligibilityText(['winter'], strings)).toBe('Eligible: no · winter pass closed');
    expect(eligibilityText(['something_new'], strings)).toBe('Eligible: no · something_new');
    expect(deepQuote(1, strings)).toBe('The Deep stirs. Something has noticed the pale metal being taken.');
    expect(deepQuote(9, strings)).toBe('The Hollow does not forget.');
    expect([0, 1, 2, 3, 4].map((tier) => moodTierName(strings, tier))).toEqual(['Miserable', 'Unhappy', 'Fine', 'Content', 'Ecstatic']);
    expect(squadPresetNames(strings)[0]).toBe('The Hearthguard');
    expect(squadPresetNames(strings)).toHaveLength(8);
    expect(strings.get('ui.threats.pressure', { bar: '▓░', pressure: 12, next: 50, level: 0 })).toBe('Pressure ▓░ 12 / 50 (level 0)');
  });
});
