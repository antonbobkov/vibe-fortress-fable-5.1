/**
 * T-M1-15 compositor step 6 and the overlay rule: "topmost by priority: dwarves > hostiles > tame >
 * wild > vermin"; species glyph, dwarves in their state color; "Overlays alter `bg` or replace the
 * glyph but never hide a creature" (`23-rendering.md` § Compositor).
 */

import { describe, it, expect } from 'vitest';
import { loadContent } from '@content/loader';
import { STATUS_ROWS } from '@core/constants';
import { LOG_ROWS } from '@render/constants';
import { Compositor, CreatureRank, OVERLAY_PRIORITY_DIGITS } from '@render/compositor';
import { Palette } from '@render/palette';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TestWorld } from '../../scenarios/test-world';

const registry = loadContent();
const palette = new Palette(registry);
const X = 30;
const Y = 30;
const Z = FLAT_TEST_SURFACE_Z;

function glyphOf(ch: string): number {
  const cp437 = ' ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼';
  const at = cp437.indexOf(ch);
  return at >= 0 ? at : ch.charCodeAt(0);
}

function cellAt(w: TestWorld, overlays?: string[]): { glyph: number; fg: number; bg: number } {
  const compositor = new Compositor({ registry, palette });
  const view = { camX: X, camY: Y, z: Z, sidebarOpen: false, cursor: null };
  const cells = compositor.compose(w.readers, overlays === undefined ? view : { ...view, overlays }, 4, 4 + LOG_ROWS + STATUS_ROWS);
  return cells.get(0, 0);
}

describe('T-M1-15 compositor: creatures', () => {
  it('draws the topmost creature by priority: dwarf > hostile > tame > wild, each by species glyph', () => {
    const w = new TestWorld({ seed: 'creature-order', world: 'flat-test', embark: 'none' });
    const at = w.index(X, Y, Z);
    const wolf = w.spawnCreature('wolf', at, 'wild');
    w.step(1);
    expect(cellAt(w)).toMatchObject({ glyph: glyphOf('w'), fg: palette.color('wolf_gray') });
    w.spawnCreature('dog', at, 'fortress');
    w.step(1);
    expect(cellAt(w).glyph).toBe(glyphOf('d'));
    w.spawnCreature('gloam_warrior', at, 'hostile:gloam');
    w.step(1);
    expect(cellAt(w)).toMatchObject({ glyph: glyphOf('G'), fg: palette.color('hostile') });
    const dwarf = w.spawnDwarf({ at });
    w.step(1);
    expect(cellAt(w)).toMatchObject({ glyph: glyphOf('☺'), fg: palette.color('dwarf_normal') });
    const compositor = new Compositor({ registry, palette });
    compositor.compose(w.readers, { camX: X, camY: Y, z: Z, sidebarOpen: false, cursor: null }, 4, 9);
    expect(compositor.rankOf(w.readers, dwarf)).toBe(CreatureRank.Dwarf);
    expect(compositor.rankOf(w.readers, wolf)).toBe(CreatureRank.Wild);
  });

  it('colors a child dwarf with dwarf_child', () => {
    const w = new TestWorld({ seed: 'creature-child', world: 'flat-test', embark: 'none' });
    w.spawnDwarf({ at: w.index(X, Y, Z), ageYears: 5 });
    w.step(1);
    expect(cellAt(w).fg).toBe(palette.color('dwarf_child'));
  });

  it('an overlay tints the background under a creature but never replaces its glyph', () => {
    const w = new TestWorld({ seed: 'creature-overlay', world: 'flat-test', embark: 'none' });
    const at = w.index(X, Y, Z);
    w.spawnCreature('wolf', at, 'wild');
    w.submit({ type: 'Designate', tiles: [at], kind: 'channel', priority: 6 });
    w.step(1);
    for (const overlays of [undefined, ['designations', 'zones', OVERLAY_PRIORITY_DIGITS]]) {
      const cell = cellAt(w, overlays);
      expect(cell.glyph).toBe(glyphOf('w'));
      expect(cell.bg).toBe(palette.color('des_channel'));
    }
    // With the designations overlay off, nothing is tinted.
    expect(cellAt(w, []).bg).not.toBe(palette.color('des_channel'));
  });
});
