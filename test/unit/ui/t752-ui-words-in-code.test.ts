/**
 * T-752: the words the UI still wrote in code past the strings rows come from keys: the quality
 * words of the Look and gear names (`ui.item.quality.<n>`), the aged words of the Look panel's item
 * names, an item's flags, a match id that names no item (a tag) and a material class filter, and the
 * legend record's own cause and kill lines (`ui.legend.*`). A `strings.json` row reaches each.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z, HeadlessGame } from '@app/headless';
import { composeLegend, endText } from '@app/legend';
import { C } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import type { Registry } from '@core/registry';
import { filterText, itemName, matchName } from '@ui/messages';
import { gearName } from '@ui/panels/gear';
import { drawTileList, itemSummary, itemTitle, tileContents } from '@ui/panels/look';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';
import { registry, strings, surface } from './ui-fixture';

/** A strings table with `rows` as its `strings.json` rows over the defaults. */
function withRows(rows: Readonly<Record<string, string>>): Strings {
  return new Strings({ hasDerived: () => true, derived: () => rows } as unknown as Registry);
}

/** The game's registry with `rows` as its `strings.json` rows. */
function registryWithRows(base: Registry, rows: Readonly<Record<string, string>>): Registry {
  return Object.create(base, {
    hasDerived: { value: (name: string) => name === 'strings' || base.hasDerived(name) },
    derived: { value: (name: string) => (name === 'strings' ? rows : base.derived(name)) },
  }) as Registry;
}

const z = FLAT_TEST_SURFACE_Z;

describe('T-752 the UI words still written in code come from the strings rows', () => {
  it('the Look panel words an item\'s quality, its age and its flags from keys', () => {
    const w = new TestWorld({ seed: 't752-look', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const bed = w.spawnItem('bed', 'pine', w.index(10, 10, z), 1, 2);
    const barrel = w.spawnItem('barrel', 'oak', w.index(12, 10, z));
    const ale = w.spawnItem('drink', 'ale', { containerId: barrel }, 5);
    const rec = w.game.world.entities.get(ale, C.Item);
    if (rec !== undefined) rec.age = 1;
    const bedRec = w.game.world.entities.get(bed, C.Item);
    if (bedRec !== undefined) bedRec.flags |= 1;
    const rows = withRows({ 'ui.item.quality.2': 'fein', 'ui.item.aged': 'gereift', 'ui.look.item.flag.forbidden': 'verboten' });
    expect(itemSummary(w.readers, strings, bed)).toContain('fine');
    expect(itemSummary(w.readers, rows, bed)).toContain('fein');
    expect(itemTitle(w.readers, w.game.registry, strings, ale)).toBe('aged ale');
    expect(itemTitle(w.readers, w.game.registry, rows, ale)).toBe('gereift ale');
    const loose = w.spawnItem('drink', 'ale', w.index(14, 10, z), 3);
    const looseRec = w.game.world.entities.get(loose, C.Item);
    if (looseRec !== undefined) looseRec.age = 2;
    expect(tileContents(w.readers, w.game.registry, strings, w.index(14, 10, z))).toContain('3 vintage ale');
    expect(tileContents(w.readers, w.game.registry, withRows({ 'ui.item.vintage': 'alt' }), w.index(14, 10, z))).toContain('3 alt ale');
    // The tile list's row: the name with its quality, and its flags.
    const list = (s: Strings): string => {
      const out = surface(44, 10);
      drawTileList(out, { col: 0, row: 0, cols: 44, rows: 10 }, w.readers, w.game.registry, s, w.index(10, 10, z));
      return out.lines().join('\n');
    };
    expect(list(strings)).toContain('pine bed (fine)');
    expect(list(strings)).toContain('forbidden');
    expect(list(rows)).toContain('pine bed (fein)');
    expect(list(rows)).toContain('verboten');
    expect(list(rows)).not.toContain('forbidden');
  });

  it('a soldier\'s gear names its quality from the key', () => {
    const w = new TestWorld({ seed: 't752-gear', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const axe = w.spawnItem('axe', 'iron', w.index(10, 10, z), 1, 4);
    expect(gearName(w.readers, w.game.registry, strings, axe)).toBe('iron axe (exceptional)');
    expect(gearName(w.readers, w.game.registry, withRows({ 'ui.item.quality.4': 'herausragend' }), axe)).toBe('iron axe (herausragend)');
  });

  it('a match id with no item row is its tag\'s word, and a material class filter is its class\'s word', () => {
    const rows = withRows({ 'ui.item.tag.ingredient': 'Zutat', 'ui.item.material_class.metal': 'Metall' });
    expect(itemName(registry, strings, 'ingredient')).toBe('ingredient');
    expect(itemName(registry, rows, 'ingredient')).toBe('Zutat');
    expect(matchName(registry, 'salt|ingredient', 1, rows)).toContain('Zutat');
    const bar = registry.table('items').index('bar');
    expect(filterText(registry, { type: bar, materialClass: 'metal' }, 2, strings)).toBe('2 metal bars');
    expect(filterText(registry, { type: bar, materialClass: 'metal' }, 2, rows)).toBe('2 Metall bars');
    // A class with no row reads as its id.
    expect(filterText(registry, { type: bar, materialClass: 'star_stuff' }, 1, strings)).toBe('1 star stuff bar');
  });

  it('the legend record words its cause and its notable kills from keys, with the same words as before', () => {
    expect(endText(0, 7, { kind: 'retired' }, strings)).toBe('Retired in Year 1 with 7 dwarves.');
    expect(endText(TICKS_PER_YEAR, 3, { kind: 'abandoned' }, strings)).toBe('Abandoned in Year 2 by 3 dwarves.');
    expect(endText(0, 7, { kind: 'retired' }, withRows({ 'ui.legend.cause.retired': 'Im Jahr {year} mit {n} Zwergen aufgegeben.' })))
      .toBe('Im Jahr 1 mit 7 Zwergen aufgegeben.');
    const fell = withRows({ 'ui.legend.cause.fell': 'Stille am {date}. {how}', 'ui.legend.cause.last_dwarf': 'Der letzte Zwerg, {name},' });
    expect(endText(0, 0, { kind: 'all_dead', lastName: 'Solveig Deephand', lastCause: 'unknown_cause' }, fell))
      .toMatch(/^Stille am Day 1 of Spring, Year 1\. Der letzte Zwerg, Solveig Deephand,/);

    const game = new HeadlessGame({ seed: 't752-legend', fortressName: 'Coldvein Hold' });
    const journal = { peakPopulation: () => 7, deepestZ: () => 26, kills: () => [{ name: 'Orm', count: 14 }, { name: 'Asa', count: 1 }] };
    const plain = composeLegend(game, null, game.registry, journal, [], { kind: 'retired' });
    expect(plain.killsOfNote).toEqual(['Orm slew 14 enemies.', 'Asa slew 1 enemy.']);
    const rowsRegistry = registryWithRows(game.registry, { 'ui.legend.kill': '{name} erschlug {n|Feind|Feinde}.', 'ui.legend.cause.retired': 'Aufgegeben ({n}).' });
    const record = composeLegend(game, null, rowsRegistry, journal, [], { kind: 'retired' });
    expect(record.killsOfNote).toEqual(['Orm erschlug 14 Feinde.', 'Asa erschlug 1 Feind.']);
    expect(record.cause).toMatch(/^Aufgegeben \(\d+\)\.$/);
  });
});
