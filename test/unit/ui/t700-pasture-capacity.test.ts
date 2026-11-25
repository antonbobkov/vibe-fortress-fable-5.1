/**
 * T-700: a pasture too small for its grazers says so (`reports/data/2026-11-24-playtest.md`, finding 2).
 * The zone's capacity line leads with its verdict and fits the sidebar, `[p]` in Animals says what it
 * did and warns when the pasture cannot feed its grazers, the starving alert names the animal and the
 * pasture, and a species names its own plural ("2 sheep", "3 deer").
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { AnnouncementLog } from '@ui/announcements';
import { pluralName, speciesPlural } from '@ui/messages';
import { drawAnimalsPanel } from '@ui/panels/animals';
import { hostilesText } from '@ui/panels/threats';
import { drawZonesPanel } from '@ui/panels/zones';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, keymap, press, strings, surface, theme } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

/** A 51-tile pasture with 35 grass (as in the playtest), and the herd that was put on it. */
function setup(seed: string, assign = true) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 10 * TICKS_PER_DAY });
  const sent: Command[] = [];
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (cmd) => { sent.push(cmd); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => computeLayout(80, 42, true), precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 0,
  };
  const f = new FortressScreen(host, keymap, strings);
  const tiles = Array.from({ length: 51 }, (_, n) => w.index(30 + (n % 17), 30 + Math.floor(n / 17), z));
  tiles.forEach((tile, n) => w.map.setFlag(tile, TileFlag.Grass, n < 35));
  const pasture = w.zone('pasture', tiles);
  const herd = ['cow', 'cow', 'goat', 'goat', 'sheep', 'sheep'].map((species, k) => w.spawnTame(species, w.index(20 + k, 20, z)));
  if (assign) for (const id of herd) expect(w.game.world.applyCommand({ type: 'AssignPasture', animalId: id, zoneId: pasture }).ok).toBe(true);
  return { w, f, sent, pasture, herd };
}

/** The zones panel at the sidebar's width with the pasture selected, each row as drawn from the panel's first cell in. */
function drawPasture(f: FortressScreen, pasture: EntityId) {
  f.openPanel('zones');
  f.zones.selectZone(pasture);
  const s = surface(36, 24);
  drawZonesPanel(s, { col: 0, row: 0, cols: 36, rows: 24 }, f.zones, f.ctx);
  return { s, rows: s.lines().map((line) => line.slice(1).trimEnd()) };
}

describe('T-700 the pasture capacity line leads with its verdict and fits the sidebar', () => {
  it('35 grass for six grazers reads "Feeds 0 of 6 grazers" in the alert colour, then the grass and the allowance', () => {
    const { f, pasture } = setup('t700-capacity');
    const { s, rows } = drawPasture(f, pasture);
    const at = rows.findIndex((row) => row.startsWith('Feeds'));
    expect(rows[at]).toBe('Feeds 0 of 6 grazers');
    expect(fgOfText(s, at, 'Feeds 0 of 6 grazers')).toBe(hexOf(theme.alert));
    expect(rows[at + 1]).toBe('35 grass; 48 a grazer');
    expect(rows.join('\n')).not.toContain('»');
    expect(rows.join('\n')).not.toContain('Add animals');
  });

  it('an empty pasture says what it would feed and how to put animals on it', () => {
    const { f, pasture, w } = setup('t700-empty', false);
    // Two grazers' worth of grass.
    for (let n = 0; n < 96; n += 1) w.map.setFlag(w.index(10 + (n % 12), 10 + Math.floor(n / 12), z), TileFlag.Grass, true);
    const meadow = w.zone('pasture', Array.from({ length: 96 }, (_, n) => w.index(10 + (n % 12), 10 + Math.floor(n / 12), z)));
    const { s, rows } = drawPasture(f, meadow);
    const at = rows.findIndex((row) => row.startsWith('Feeds'));
    expect(rows[at]).toBe('Feeds 2 grazers');
    expect(fgOfText(s, at, 'Feeds 2 grazers')).toBe(hexOf(theme.value));
    expect(rows[at + 1]).toBe('96 grass; 48 a grazer');
    expect(rows[at + 2]).toBe('Add animals: Animals [n], [p].');
    void pasture;
  });
});

describe('T-700 [p] in Animals says what it did', () => {
  it('two cows onto the pasture that feeds none of six: the status row warns in the alert colour', () => {
    const { f, sent, pasture, herd, w } = setup('t700-assign', false);
    // The goats and the sheep are on it already; the cows come last.
    for (const id of herd.slice(2)) w.game.world.applyCommand({ type: 'AssignPasture', animalId: id, zoneId: pasture });
    f.openPanel('animals');
    f.animals.list.selected = f.animals.groups(f.ctx).findIndex((ids) => ids.includes(herd[0]!));
    f.key(press('p'));
    expect(sent.filter((c) => c.type === 'AssignPasture').map((c) => c['animalId'])).toEqual([herd[0], herd[1]]);
    expect(f.statusRow2()).toBe('2 cows to Pasture #1: it feeds 0 of 6 grazers.');
    const s = surface(80, 42);
    f.draw(s);
    const row = s.lines().findIndex((line) => line.includes('2 cows to Pasture #1'));
    expect(fgOfText(s, row, '2 cows to Pasture #1')).toBe(hexOf(theme.alert));
  });

  it('onto a pasture that feeds them it says only where they went; off the last pasture, that they left it', () => {
    const { f, w, herd, pasture } = setup('t700-assign-fed', false);
    const tiles = Array.from({ length: 96 }, (_, n) => w.index(10 + (n % 12), 10 + Math.floor(n / 12), z));
    for (const tile of tiles) w.map.setFlag(tile, TileFlag.Grass, true);
    const meadow = w.zone('pasture', tiles);
    f.openPanel('animals');
    // The cows are on Pasture #1, the small one; the next is Pasture #2, the meadow, which feeds two.
    for (const id of herd.slice(0, 2)) w.game.world.applyCommand({ type: 'AssignPasture', animalId: id, zoneId: pasture });
    f.animals.list.selected = f.animals.groups(f.ctx).findIndex((ids) => ids.includes(herd[0]!));
    f.key(press('p'));
    expect(f.statusRow2()).toBe('2 cows to Pasture #2.');
    for (const id of herd.slice(0, 2)) w.game.world.applyCommand({ type: 'AssignPasture', animalId: id, zoneId: meadow });
    f.animals.list.selected = f.animals.groups(f.ctx).findIndex((ids) => ids.includes(herd[0]!));
    f.key(press('p'));
    expect(f.statusRow2()).toBe('2 cows off the pasture.');
  });
});

describe('T-700 the starving alert names the animal and its pasture', () => {
  it('"The cow is starving: Pasture #1 feeds 0 of 6 grazers." with the cow its subject', () => {
    const { w, herd } = setup('t700-alert');
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const cow = herd[0]!;
    const line = log.announce({ type: 'AnimalStarving', id: cow }, w.readers, w.tick);
    expect(line?.line.text).toBe('The cow is starving: Pasture #1 feeds 0 of 6 grazers.');
    expect(line?.severity).toBe('alert');
    const pos = w.readers.entities.get(cow, C.Position)!;
    expect(line?.focus).toBe(w.index(pos.x, pos.y, pos.z));
  });

  it('with no pasture, or one that feeds its grazers, it names the animal alone; a named one by its name', () => {
    const { w, herd } = setup('t700-alert-free', false);
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    expect(log.announce({ type: 'AnimalStarving', id: herd[4]! }, w.readers, w.tick)?.line.text).toBe('The sheep is starving.');
    expect(w.game.world.applyCommand({ type: 'NameAnimal', animalId: herd[2]!, name: 'Bramble' }).ok).toBe(true);
    expect(log.announce({ type: 'AnimalStarving', id: herd[2]! }, w.readers, w.tick)?.line.text).toBe('Bramble is starving.');
  });
});

describe('T-700 a species names its own plural', () => {
  it('"2 sheep" in the Animals panel, never "2 sheeps"', () => {
    const { f } = setup('t700-sheep');
    f.openPanel('animals');
    const groups = f.animals.groups(f.ctx);
    f.animals.list.selected = groups.findIndex((ids) => ids.length === 2 && f.ctx.readers.entities.get(ids[0]!, C.Creature)?.species === f.ctx.registry.table('creatures').index('sheep'));
    const s = surface(36, 40);
    drawAnimalsPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, f.animals, f.ctx);
    const text = s.lines().join('\n');
    expect(text).toContain('2 sheep · pasture #1');
    expect(text).not.toContain('sheeps');
  });

  it('"3 deer" among the hostiles, a row\'s plural before the rule, and the rule for the rest', () => {
    const { f, w } = setup('t700-deer', false);
    const deer = [0, 1, 2].map((k) => w.spawnCreature('deer', w.index(50 + k, 50, z), 'wild'));
    expect(hostilesText(f.ctx, deer)).toBe('3 deer');
    const creatures = w.game.registry.table<{ id: string; name: string; plural?: string }>('creatures');
    expect(['sheep', 'deer', 'reindeer', 'elk', 'cave_ox', 'trollkin', 'restless_dead'].map((id) => speciesPlural(creatures.byId(id))))
      .toEqual(['sheep', 'deer', 'reindeer', 'elk', 'cave oxen', 'trollkin', 'restless dead']);
    expect(['cow', 'wolf', 'lynx', 'dwarf'].map((id) => speciesPlural(creatures.byId(id)))).toEqual(['cows', 'wolves', 'lynxes', 'dwarves']);
    expect(pluralName('snow leopard')).toBe('snow leopards');
  });
});
