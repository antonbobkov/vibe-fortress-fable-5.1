/**
 * T-744: the texts that were drawn through a fresh `new Strings()` (the default table alone) take
 * the game's strings, so a `strings.json` row reaches them; `strings:check` fails on a `new Strings()`
 * in the game's code; 18's `ThreatWarning` carries its edge as an id, which the announcement words;
 * and a trade list's unnamed goods and a job input's category or tag filter are worded from keys.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { regionSpec } from '@app/headless';
import { lastWords } from '@app/legend';
import { TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { Registry } from '@core/registry';
import { AnnouncementLog, lineText, type LogLine } from '@ui/announcements';
import { bindingReset, categoryWord, filterText, tagWord } from '@ui/messages';
import { actionText, contextTitle, helpKeyRows, keysLabel } from '@ui/panels/help';
import { drawLogStrip } from '@ui/panels/log';
import { squadPresetNames } from '@ui/panels/military';
import { drawOverlaysPanel, OverlayMenu } from '@ui/panels/overlays';
import { eligibilityText } from '@ui/panels/population';
import { deepQuote } from '@ui/panels/threats';
import { uiPanels } from '@ui/screens/fortress';
import { GameMenuScreen, type GameMenuHost } from '@ui/screens/game_menu';
import { legendLines, type LegendRecord } from '@ui/screens/legend';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, registry, strings, surface } from './ui-fixture';
// @ts-expect-error -- a plain .mjs script without type declarations
import { check, defaultTables } from '../../../scripts/strings-check.mjs';

/** A strings table with `rows` as its `strings.json` rows over the defaults. */
function withRows(rows: Readonly<Record<string, string>>): Strings {
  return new Strings({ hasDerived: () => true, derived: () => rows } as unknown as Registry);
}

const RECORD: LegendRecord = {
  id: 'final-t744', name: 'Emberhall', seed: 's', region: 'Ashvale', biome: 'forest', wealthRating: 1, perilRating: 1,
  foundedTick: 0, endedTick: 0, yearsSurvived: 0, daysSurvived: 3, peakPopulation: 7, deepestLevel: 0,
  finalWealth: 0, milestones: [], killsOfNote: [], lastWords: [], cause: 'Retired.', testing: true,
};

function alert(text: string, days = 1): LogLine {
  return { tick: 0, severity: 'alert', category: 'other', text, count: 1, days } as LogLine;
}

describe('T-744 the UI words what it draws with the game strings', () => {
  it('finds no new Strings() in the game code, and fails on one planted in a panel', () => {
    expect((check() as { defaults: string[] }).defaults).toEqual([]);
    const dir = mkdtempSync(join(tmpdir(), 't744-'));
    try {
      mkdirSync(join(dir, 'src/ui/panels'), { recursive: true });
      writeFileSync(join(dir, 'src/ui/panels/planted.ts'), [
        "import { Strings } from '../strings';",
        'const PLAIN = new Strings();',
        '// A comment that names new Strings() is not code.',
        'const game = new Strings(registry);',
        'export const title = new Strings ( ).get(\'ui.panel.look.title\');',
      ].join('\n'));
      expect(defaultTables(dir)).toEqual(['src/ui/panels/planted.ts:2', 'src/ui/panels/planted.ts:5']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lets a strings.json row reach each line that drew past the rows', () => {
    const rows = withRows({
      'ui.legend.folded': '{line} [{n} Tage]',
      'ui.help.any_letter': '[Buchstabe]',
      'ui.keymap.context.global': 'Allgemein',
      'ui.help.panel_action': '{panel} öffnen',
      'ui.settings.binding_reset': '{action}: wieder {key}.',
      'ui.population.eligible_yes': 'Zuzug: ja',
      'ui.threats.deep_quote.0': 'Die Tiefe schläft.',
      'ui.overlay.debug': 'Fehlersuche:',
      'ui.legend.testing_note': 'Eine Probe.',
      'ui.game_menu.resume': 'Weiter',
      'ui.panel.look.title': 'Ansehen',
      'ui.military.squad_name.0': 'Die Herdwache',
    });
    // announcements.ts: the folded line of the strip, the log and the legend's last words.
    expect(lineText(alert('! Kalt.', 3), rows)).toBe('! ! Kalt. [3 Tage]');
    const strip = surface(40, 1);
    drawLogStrip(strip, { col: 0, row: 0, cols: 40, rows: 1 }, [alert('Kalt.', 3)], null, false, rows);
    expect(strip.lines()[0]).toContain('! Kalt. [3 Tage]');
    expect(lastWords([{ ...alert('Kalt.', 3), tick: 3 * TICKS_PER_DAY }], rows)).toEqual(['! Kalt. [3 Tage]']);
    // help.ts: a key label, a context heading, a panel letter's action, and the settings' reset line.
    expect(keysLabel(['any-letter'], rows)).toBe('[Buchstabe]');
    expect(contextTitle('global', rows)).toBe('Allgemein');
    const look = keymap.bindings.find((b) => b.context === 'fortress_panel' && b.id === 'look');
    expect(look !== undefined && actionText(look, rows)).toBe('Look öffnen');
    expect(look !== undefined && bindingReset(rows, look, 'k')).toBe('Look öffnen: wieder k.');
    expect(helpKeyRows(keymap, rows).some((row) => row.text === 'Allgemein')).toBe(true);
    // population.ts, threats.ts, overlays.ts, military.ts.
    expect(eligibilityText([], rows)).toBe('Zuzug: ja');
    expect(deepQuote(0, rows)).toBe('Die Tiefe schläft.');
    const s = surface(40, 16);
    drawOverlaysPanel(s, { col: 0, row: 0, cols: 40, rows: 16 }, new OverlayMenu(), [], rows);
    expect(s.lines().join('\n')).toContain('Fehlersuche:');
    expect(squadPresetNames(rows)[0]).toBe('Die Herdwache');
    // legend.ts, game_menu.ts, fortress.ts.
    expect(legendLines(RECORD, rows)).toContain('Eine Probe.');
    const host = { fortressName: () => 'Emberhall', viewOnly: () => false } as unknown as GameMenuHost;
    expect(new GameMenuScreen(host, rows).items()[0]?.label).toBe('Weiter');
    expect(uiPanels(rows).find((panel) => panel.id === 'look')?.title).toBe('Ansehen');
    expect(uiPanels(strings).find((panel) => panel.id === 'look')?.title).toBe('Look');
  });

  it("words a warning's edge, which 18 gives as an id", () => {
    const seed = 't744-warning';
    const w = new TestWorld({ seed, world: 'local', spec: regionSpec(seed, { peril: 2 }), embark: 'none', startTick: TICKS_PER_YEAR + 20 * TICKS_PER_DAY - 1 });
    w.forceWeather('clear');
    w.until((v) => v.events('ThreatWarning').some((e) => e['kind'] === 'raid'), 10);
    const warning = w.events('ThreatWarning').find((e) => e['kind'] === 'raid') as GameEvent;
    expect(['n', 'e', 's', 'w']).toContain(warning['edge' as keyof GameEvent]);
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    expect(log.announce(warning, w.readers, 1)?.line.text).toMatch(/^Gloam scouts have been seen at the (northern|eastern|southern|western) edge\. They will come tomorrow\.$/);
    const rows = withRows({ 'ui.edge.side.n': 'dem Nordrand', 'ui.edge.side.e': 'dem Nordrand', 'ui.edge.side.s': 'dem Nordrand', 'ui.edge.side.w': 'dem Nordrand' });
    const worded = new AnnouncementLog(rows, w.game.registry);
    worded.register(w.game.world.registrations.announcements);
    expect(worded.announce(warning, w.readers, 1)?.line.text).toBe('Gloam scouts have been seen at dem Nordrand. They will come tomorrow.');
  });

  it("words a job input's category and tag filters from keys, and an unknown one from its id", () => {
    const rows = withRows({ 'ui.item.category.food.meal': 'Mahlzeit', 'ui.item.tag.fuel': 'Brennstoff', 'ui.item.goods': 'Waren' });
    expect(filterText(registry, { category: 'food/meal' }, 2, strings)).toBe('2 meal');
    expect(filterText(registry, { category: 'food/meal' }, 2, rows)).toBe('2 Mahlzeit');
    expect(filterText(registry, { tag: 'fuel' }, 1, rows)).toBe('1 Brennstoff');
    expect(filterText(registry, { tag: 'fuel_half' }, 2, strings)).toBe('2 fuel half');
    expect(categoryWord(strings, 'tool/fishing_rod')).toBe('fishing rod');
    expect(tagWord(strings, 'rune_fuel')).toBe('rune fuel');
    expect(rows.get('ui.item.goods')).toBe('Waren');
    expect(strings.get('ui.item.goods')).toBe('goods');
  });
});
