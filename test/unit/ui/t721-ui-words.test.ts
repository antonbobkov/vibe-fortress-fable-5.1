/**
 * T-721: the single words the UI draws are strings keys too. `strings:check` reads a lone word as
 * an id, so it now also asks where a one-word literal stands (`drawnWord`); the list helpers take the
 * game's strings at every call, so a `strings.json` row of `ui.list.*` reaches every list; and 18's
 * reader gives a warned party's size as a band id, which the Threats panel words.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import { sizeBandOf, type ComingParty } from '@systems/threats';
import type { BuildingRow } from '@systems/buildings';
import { Strings } from '@ui/strings';
import { filterText, withArticle } from '@ui/messages';
import { inputText } from '@ui/panels/build';
import { whereWeaponMade } from '@ui/panels/gear';
import { careLine } from '@ui/panels/look';
import { comingText } from '@ui/raid-lines';
import { registry, strings } from './ui-fixture';
// @ts-expect-error -- a plain .mjs script without type declarations
import { check, panelLiterals } from '../../../scripts/strings-check.mjs';

/** A strings table with `rows` as its `strings.json` rows over the defaults. */
function withRows(rows: Readonly<Record<string, string>>): Strings {
  return new Strings({ hasDerived: () => true, derived: () => rows } as unknown as Registry);
}

/** A patient in a hospital bed whose treatment waits for one of two items (17 § Care line). */
function waitingPatient(types: readonly number[]): ReaderSet {
  const patient = { needs: ['suture'], bedId: 2, hospitalZoneId: 3 };
  const job = { state: 'blocked', blockedReason: 'missing_input', workerId: 0, inputs: [{ count: 1, delivered: [], filter: { types } }] };
  const of: Record<string, unknown> = {
    '11': { workersWithLabor: () => [9], byKey: (key: string) => (key === 'suture:1' ? job : undefined) },
    '13': { countAvailable: () => 0 },
    '14': { zonesOfType: () => [3] },
  };
  return {
    entities: { get: (id: number, type: unknown) => (id === 1 && type === C.Patient ? patient : undefined) },
    has: (id: string) => id in of,
    of: (id: string) => of[id],
  } as unknown as ReaderSet;
}

describe('T-721 single words the UI draws, and the lists, from the strings table', () => {
  it('finds no drawn single word in the code of the repository', () => {
    expect((check() as { literals: string[] }).literals).toEqual([]);
  });

  it('fails on a single word planted where it is drawn, and not on the same word as an id', () => {
    const dir = mkdtempSync(join(tmpdir(), 't721-'));
    try {
      mkdirSync(join(dir, 'src/ui/panels'), { recursive: true });
      writeFileSync(join(dir, 'src/ui/panels/planted.ts'), [
        "if (filter['edible'] === true) name = 'food';",
        "label(s, 0, 0, 'none');",
        "const said = `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;",
        "strings.get('ui.creature.the_species', { species: (row?.name ?? 'animal').toLowerCase() });",
        "const options = [{ id: '0', label: 'none' }];",
        // The same words as ids: compared, a key name of a button, a table, an id field, a key's part.
        "if (kind === 'food' || 'drink' !== kind) name = strings.get('ui.item.food');",
        "button(s, 0, 0, 'Enter', strings.get('ui.k.go'));",
        "const rows = registry.table<{ id: string }>('items').byId('food');",
        "const row = { id: 'food', kind: 'none' };",
        "const key = `ui.zone.${kind === 'farm' ? 'farm' : 'none'}`;",
      ].join('\n'));
      expect(panelLiterals(dir)).toEqual([
        'src/ui/panels/planted.ts:1: "food"',
        'src/ui/panels/planted.ts:2: "none"',
        'src/ui/panels/planted.ts:3: "an"',
        'src/ui/panels/planted.ts:3: "a"',
        'src/ui/panels/planted.ts:4: "animal"',
        'src/ui/panels/planted.ts:5: "none"',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lets a strings.json row of ui.list.* reach the creature view, the build list and the weapon line', () => {
    const rows = withRows({ 'ui.list.or': '{rest} oder {last}', 'ui.list.and': '{rest} und {last}' });
    const items = registry.table('items');
    // The creature view's care line names what a treatment waits for (look.ts, `filterText`).
    expect(careLine(waitingPatient([items.index('thread'), items.index('cloth')]), registry, rows, 1)?.text).toContain('thread oder cloth');
    // The build list's inputs (build.ts, `inputText`).
    const pallet = registry.table<BuildingRow>('buildings').byId('straw_pallet') as BuildingRow;
    expect(inputText(pallet, registry, rows)).toBe('3 fiber, straw oder reed');
    expect(inputText(pallet, registry, strings)).toBe('3 fiber, straw or reed');
    // Where a squad's weapon is made (gear.ts, `whereWeaponMade`).
    const weapon = ['axe', 'bow', 'crossbow', 'dagger', 'hammer', 'mace', 'spear', 'staff', 'sword'].find((c) => / or /.test(whereWeaponMade(strings, registry, c)));
    expect(weapon).toBeDefined();
    expect(whereWeaponMade(rows, registry, weapon as string)).toBe(whereWeaponMade(strings, registry, weapon as string).replace(' or ', ' oder '));
  });

  it('draws the words that were in the code from the table: articles, food and drink, a tiled input', () => {
    const rows = withRows({ 'ui.article.a': 'ein {noun}', 'ui.article.an': 'ein {noun}', 'ui.item.food': 'Essen', 'ui.item.drink': 'Trank', 'ui.build.input_tiles': 'je Feld {item}' });
    expect(withArticle(strings, 'ember newt')).toBe('an ember newt');
    expect(withArticle(strings, 'boar')).toBe('a boar');
    expect(withArticle(rows, 'ember newt')).toBe('ein ember newt');
    expect(filterText(registry, { edible: true }, 3, strings)).toBe('3 food');
    expect(filterText(registry, { edible: true }, 3, rows)).toBe('3 Essen');
    expect(filterText(registry, { drinkable: true }, 1, rows)).toBe('1 Trank');
    expect(filterText(registry, {}, 2, strings)).toBe('2 items');
    const tiled = registry.table<BuildingRow>('buildings').rows.find((row) => row?.inputs.some((i) => i.count === 'tiles')) as BuildingRow;
    expect(inputText(tiled, registry, strings)).toMatch(/^n /);
    expect(inputText(tiled, registry, rows)).toMatch(/^je Feld /);
  });

  it("words a warned party's size band, which 18's reader gives as an id", () => {
    expect([1, 5, 6, 15, 16, 40].map(sizeBandOf)).toEqual(['few', 'few', 'band', 'band', 'horde', 'horde']);
    const coming: ComingParty = { kind: 'raid', civ: 'gloam', sizeBand: 'horde', edge: 'n', arrivalTick: 20 };
    expect(comingText(strings, registry, coming, 10)).toBe('Coming: a horde of Gloam from the north, today.');
    const rows = withRows({ 'ui.threats.band_horde': 'eine Horde {civ}', 'ui.threats.band_few': 'ein paar {civ}' });
    expect(comingText(rows, registry, coming, 10)).toBe('Coming: eine Horde Gloam from the north, today.');
    expect(comingText(rows, registry, { ...coming, sizeBand: 'few' }, 10)).toBe('Coming: ein paar Gloam from the north, today.');
  });
});
