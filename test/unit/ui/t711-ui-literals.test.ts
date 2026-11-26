/**
 * T-711: the UI's code outside the panels draws no text written in it either. `strings:check`
 * scans all of `src/ui` (the screens, the shared modules, the panels), and the screens' words are
 * strings keys that a `strings.json` row reaches; the threats reader gives its schedule as data.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Registry } from '@core/registry';
import { Strings } from '@ui/strings';
import { contextTitle } from '@ui/panels/help';
import { moodTierName } from '@ui/panels/mood';
import { chainText, civName, listText } from '@ui/messages';
import { GameMenuScreen, type GameMenuHost } from '@ui/screens/game_menu';
import { legendLines, type LegendRecord } from '@ui/screens/legend';
import { uiPanels } from '@ui/screens/fortress';
// @ts-expect-error -- a plain .mjs script without type declarations
import { check, LITERAL_DIRS, LITERAL_FILES_SKIPPED, panelLiterals } from '../../../scripts/strings-check.mjs';

/** A strings table with `rows` as its `strings.json` rows over the defaults. */
function withRows(rows: Readonly<Record<string, string>>): Strings {
  return new Strings({ hasDerived: () => true, derived: () => rows } as unknown as Registry);
}

const RECORD: LegendRecord = {
  id: 'final-x', name: 'Emberhall', seed: 's', region: 'Ashfold', biome: 'hills', wealthRating: 2, perilRating: 3,
  foundedTick: 0, endedTick: 0, yearsSurvived: 1, daysSurvived: 112, peakPopulation: 31, deepestLevel: 12,
  finalWealth: 12500, milestones: [], killsOfNote: [], lastWords: [], cause: 'Retired.',
};

describe('T-711 the UI outside the panels writes no text in its code', () => {
  it('scans all of src/ui and skips no file', () => {
    expect(LITERAL_DIRS).toEqual(['src/ui', 'src/app']);
    expect(LITERAL_FILES_SKIPPED.size).toBe(0);
    expect((check() as { literals: string[] }).literals).toEqual([]);
  });

  it('fails on a literal planted in a screen, a shared module or a widget, but not in the strings table', () => {
    const dir = mkdtempSync(join(tmpdir(), 't711-'));
    try {
      for (const sub of ['src/ui/screens', 'src/ui/widgets']) mkdirSync(join(dir, sub), { recursive: true });
      writeFileSync(join(dir, 'src/ui/screens/planted.ts'), "surface.text(2, 1, strings.get('ui.legend.title'));\nsurface.text(2, 3, 'No legends here.');\n");
      writeFileSync(join(dir, 'src/ui/shared.ts'), 'export const x = `${a} and ${b}`;\n');
      writeFileSync(join(dir, 'src/ui/widgets/planted.ts'), "label(s, 0, 0, 'Press any key');\n");
      writeFileSync(join(dir, 'src/ui/strings.ts'), "export const UI_STRINGS = Object.freeze({\n  'ui.legend.title': 'Legends',\n});\n");
      expect((panelLiterals(dir) as string[]).sort()).toEqual([
        'src/ui/screens/planted.ts:2: "No legends here."',
        'src/ui/shared.ts:1: "${} and ${}"',
        'src/ui/widgets/planted.ts:1: "Press any key"',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows the keymap's wording table, and nothing else in the keymap loader", () => {
    const dir = mkdtempSync(join(tmpdir(), 't711-'));
    try {
      mkdirSync(join(dir, 'src/ui'), { recursive: true });
      writeFileSync(join(dir, 'src/ui/keymap.ts'), [
        'export const ACTION_IDS = Object.freeze({',
        "  'pause / resume': 'pause',",
        "  'speed up (1× → 2× → 4×)': 'speed_up',",
        '});',
        "const TITLE = 'Global keys';",
      ].join('\n'));
      expect(panelLiterals(dir)).toEqual(['src/ui/keymap.ts:5: "Global keys"']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps the words the screens and shared modules drew from their code', () => {
    const strings = new Strings();
    expect(legendLines(RECORD, strings)).toEqual([
      'Emberhall',
      'Founded Spring, Year 1 at Ashfold (hills, wealth 2, peril 3)',
      'Retired.',
      'Years 1 · Days 112 · Peak population 31 · Deepest level 12 · Wealth 12,500 ☼',
      'Milestones',
      'Notable',
      'Last words (log)',
    ]);
    expect(contextTitle('labor_templates', strings)).toBe('Profession templates');
    expect(contextTitle('fortress_panel', strings)).toBe('Fortress panels');
    expect(contextTitle('no_such_context', strings)).toBe('no_such_context');
    expect(uiPanels(strings).map((p) => p.title)).toEqual(['Designate', 'Look', 'Log', 'Overlays', 'Calendar', 'Population', 'Civilizations', 'Help', 'Debug']);
    expect(listText(strings, ['Hillfolk', 'Wildwood', 'Gloam'], 'and')).toBe('Hillfolk, Wildwood and Gloam');
    expect(listText(strings, ['fiber', 'straw', 'reed'], 'or')).toBe('fiber, straw or reed');
    expect(listText(strings, ['a forge'], 'or')).toBe('a forge');
    expect(listText(strings, [], 'or')).toBe('');
    expect(chainText(strings, ['block', 'log', 'stone'], 'or')).toBe('block or log or stone');
    expect(chainText(strings, ['north', 'east'], 'and')).toBe('north and east');
    expect(civName('hillfolk', strings)).toBe('Hillfolk');
    expect(civName('bandits', strings)).toBe('Bandits');
  });

  it('lets a strings.json row reach what the screens draw', () => {
    const rows = withRows({
      'ui.game_menu.resume': 'Weiter',
      'ui.legend.milestones': 'Meilensteine',
      'ui.keymap.context.global': 'Allgemein',
      'ui.mood_tier.2': 'Gut',
      'ui.civ.name.hillfolk': 'Hügelvolk',
      'ui.list.and': '{rest} und {last}',
    });
    const host = { fortressName: () => 'Emberhall', viewOnly: () => false } as unknown as GameMenuHost;
    expect(new GameMenuScreen(host, rows).items()[0]?.label).toBe('Weiter');
    expect(new GameMenuScreen(host, new Strings()).items()[0]?.label).toBe('Resume');
    expect(legendLines(RECORD, rows)).toContain('Meilensteine');
    expect(contextTitle('global', rows)).toBe('Allgemein');
    expect(moodTierName(rows, 2)).toBe('Gut');
    expect(civName('hillfolk', rows)).toBe('Hügelvolk');
    expect(listText(rows, ['a', 'b', 'c'], 'and')).toBe('a, b und c');
  });
});
