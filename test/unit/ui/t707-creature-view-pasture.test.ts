/**
 * T-707: a tame grazer's view in Look has a "Pasture" action (08 § Player-facing behavior, 24 §
 * Inspection): `[p]` opens a picker of Off pasture and every pasture with what it will feed once the
 * animal is on it, choosing one sends `AssignPasture` and says on the status row what it did as the
 * Animals panel's `[p]` does, and a dwarf's, a wild animal's or a dog's view has no such action (there
 * `p` opens Population).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Command } from '@core/commands';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, keymap, press, strings, surface, theme } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);

/**
 * T-700's playtest pasture (51 tiles, 35 grass: it feeds no grazer) with five of the herd on it, the
 * cow off it, and a 96-grass meadow that feeds two.
 */
function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 10 * TICKS_PER_DAY });
  const sent: Command[] = [];
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (cmd) => { sent.push(cmd); w.game.world.applyCommand(cmd); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => LAYOUT, precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 0,
  };
  const f = new FortressScreen(host, keymap, strings);
  const small = Array.from({ length: 51 }, (_, n) => w.index(30 + (n % 17), 30 + Math.floor(n / 17), z));
  small.forEach((tile, n) => w.map.setFlag(tile, TileFlag.Grass, n < 35));
  const pasture = w.zone('pasture', small);
  const big = Array.from({ length: 96 }, (_, n) => w.index(10 + (n % 12), 10 + Math.floor(n / 12), z));
  for (const tile of big) w.map.setFlag(tile, TileFlag.Grass, true);
  const meadow = w.zone('pasture', big);
  const herd = ['cow', 'cow', 'goat', 'goat', 'sheep', 'sheep'].map((species, k) => w.spawnTame(species, w.index(20 + k, 20, z)));
  for (const id of herd.slice(1)) expect(w.game.world.applyCommand({ type: 'AssignPasture', animalId: id, zoneId: pasture }).ok).toBe(true);
  return { w, f, sent, pasture, meadow, cow: herd[0] as EntityId };
}

/** The screen drawn, and its sidebar as text from the panel's first cell in. */
function draw(f: FortressScreen) {
  const s = surface(80, 42);
  f.draw(s);
  const col = (LAYOUT.sidebar?.col ?? 0) + 2;
  return { s, col, rows: s.lines().map((line) => Array.from(line).slice(col).join('').trimEnd()) };
}

const assigned = (sent: readonly Command[]) => sent.filter((c) => c.type === 'AssignPasture').map((c) => [c['animalId'], c['zoneId']]);

describe('T-707 a tame grazer\'s view: [p] picks its pasture', () => {
  it('the foot names its pasture; [p] lists Off pasture and each pasture with what it will feed, the too-small one in the alert colour', () => {
    const { f, cow } = setup('t707-picker');
    f.inspectCreature(cow);
    expect(draw(f).rows).toContain('[p] pasture: none');
    expect(f.key(press('p'))).toBe(true);
    expect(f.ui.panel, 'p is the view\'s own key here, not Population').toBe('look');
    const { s, rows } = draw(f);
    const at = rows.indexOf('Pasture for the cow:');
    expect(at).toBeGreaterThan(0);
    // Off pasture is chosen: the cow has none. The verdicts count the cow on each pasture.
    expect(rows[at + 1]).toBe('► Off pasture');
    expect(rows[at + 2]).toMatch(/^ {2}Pasture #1 +Feeds 0 of 6 grazers$/);
    expect(rows[at + 3]).toMatch(/^ {2}Pasture #2 +Feeds 1 of 1 grazer$/);
    expect(rows[at + 4]).toBe('[Enter] choose  [Esc] cancel');
    expect(fgOfText(s, at + 2, 'Feeds 0 of 6 grazers')).toBe(hexOf(theme.alert));
    expect(fgOfText(s, at + 3, 'Feeds 1 of 1 grazer')).toBe(hexOf(theme.dim));
    expect(rows.join('\n')).not.toContain('»');
  });

  it('↓ and Enter put the cow on the pasture that cannot feed it, and the status row warns in the alert colour', () => {
    const { f, sent, cow, pasture } = setup('t707-over');
    f.inspectCreature(cow);
    f.key(press('p'));
    expect(f.key(press('↓'))).toBe(true);
    expect(f.key(press('Enter'))).toBe(true);
    expect(assigned(sent)).toEqual([[cow, pasture]]);
    expect(f.statusRow2()).toBe('1 cow to Pasture #1: it feeds 0 of 6 grazers.');
    const { s, rows } = draw(f);
    const row = s.lines().findIndex((line) => line.includes('1 cow to Pasture #1'));
    expect(fgOfText(s, row, '1 cow to Pasture #1')).toBe(hexOf(theme.alert));
    // The picker closed, the view is the cow's again, and the foot names its pasture.
    expect(f.lookAt).toMatchObject({ kind: 'creature', id: cow });
    expect(rows).not.toContain('Pasture for the cow:');
    expect(rows).toContain('[p] pasture: Pasture #1');
  });

  it('a click on a row chooses it; a named animal is called by its name; Off pasture takes it off', () => {
    const { w, f, sent, cow, meadow } = setup('t707-click');
    expect(w.game.world.applyCommand({ type: 'NameAnimal', animalId: cow, name: 'Bramble' }).ok).toBe(true);
    f.inspectCreature(cow);
    f.key(press('p'));
    let { s, rows, col } = draw(f);
    expect(rows).toContain('Pasture for Bramble:');
    const row = rows.findIndex((line) => line.includes('Pasture #2'));
    s.hits.find((h) => h.rect.row === row && h.rect.col >= col)?.action();
    expect(assigned(sent)).toEqual([[cow, meadow]]);
    expect(f.statusRow2()).toBe('Bramble to Pasture #2.');
    // Again: the picker opens on its pasture now, and Off pasture is one up.
    ({ s, rows, col } = draw(f));
    s.hits.find((h) => h.rect.row === rows.indexOf('[p] pasture: Pasture #2') && h.rect.col >= col)?.action();
    ({ rows } = draw(f));
    expect(rows.find((line) => line.startsWith('►'))).toMatch(/^► Pasture #2/);
    f.key(press('↑'));
    f.key(press('↑'));
    f.key(press('Enter'));
    expect(assigned(sent)).toEqual([[cow, meadow], [cow, 0]]);
    expect(f.statusRow2()).toBe('Bramble off the pasture.');
  });

  it('Esc and [p] close the picker without assigning, and leave Look on the animal', () => {
    const { f, sent, cow } = setup('t707-cancel');
    f.inspectCreature(cow);
    f.key(press('p'));
    expect(f.key(press('Esc'))).toBe(true);
    expect(f.ui.panel).toBe('look');
    expect(draw(f).rows).not.toContain('Pasture for the cow:');
    f.key(press('p'));
    f.key(press('p'));
    expect(draw(f).rows).not.toContain('Pasture for the cow:');
    expect(f.lookAt).toMatchObject({ kind: 'creature', id: cow });
    expect(assigned(sent)).toEqual([]);
  });
});

describe('T-707 only a tame grazer has the action', () => {
  it('a dwarf, a wild deer and a tame dog: no pasture row, and p opens Population', () => {
    const { w, f, sent } = setup('t707-others');
    const dwarf = w.spawnDwarf({ at: w.index(5, 5, z) });
    const deer = w.spawnCreature('deer', w.index(7, 5, z), 'wild');
    const dog = w.spawnTame('dog', w.index(9, 5, z));
    for (const id of [dwarf, deer, dog]) {
      f.inspectCreature(id);
      expect(f.lookAt, `${id}'s view`).toMatchObject({ kind: 'creature', id });
      expect(draw(f).rows.some((line) => line.startsWith('[p] pasture'))).toBe(false);
      expect(f.key(press('p'))).toBe(true);
      expect(f.ui.panel).toBe('population');
      f.openPanel(null);
    }
    expect(assigned(sent)).toEqual([]);
  });

  it('in the tile list p opens Population too', () => {
    const { f } = setup('t707-tile');
    f.look({ x: 40, y: 40, z });
    expect(f.lookAt.kind).toBe('tile');
    f.key(press('p'));
    expect(f.ui.panel).toBe('population');
  });
});
