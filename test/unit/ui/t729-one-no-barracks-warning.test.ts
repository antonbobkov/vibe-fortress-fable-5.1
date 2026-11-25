/**
 * T-729: a squad on Train with no barracks is warned of it once, by the mode line under its keys; the
 * barracks row reads as for any squad with none, in the alert colour (`ui-screens/panels.md` §
 * Military). The line keeps a key with the word after it when it wraps (`[z] Barracks`, no-break
 * spaces, as 24's rule keeps a number with its word).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { wrapHang } from '@ui/widgets/label';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, keymap, strings, surface, theme } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string, mode: 'off' | 'train') {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const dwarves = [0, 1, 2].map((k) => w.spawnDwarf({ at: w.index(10 + k, 10, z), name: `Dwarf${k} Stone` }));
  const layout = computeLayout(80, 50, true);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => { w.submit(c); },
    speed: () => 1, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
  w.step(1);
  const squadId = w.readers.of<{ squads(): { id: EntityId }[] }>('16').squads()[0]?.id ?? 0;
  w.submit({ type: 'SetSquadMembers', squadId, members: dwarves });
  w.submit({ type: 'SetSquadMode', squadId, mode });
  w.step(1);
  screen.openPanel('military');
  const draw = () => { const s = surface(80, 50); screen.draw(s); return s; };
  return { w, draw };
}

type Drawn = ReturnType<ReturnType<typeof setup>['draw']>;
/** The sidebar's rows, borders dropped. */
const sidebar = (s: Drawn): string[] => s.lines().map((l) => (l.split('│')[1] ?? '').trimEnd());
const rowOf = (s: Drawn, part: string): number => s.lines().findIndex((l) => l.includes(part));

describe('T-729 one warning of no barracks, and a key stays with its word', () => {
  it('a squad on Train with no barracks: one warning line, and the barracks row is the plain one in the alert colour', () => {
    const f = setup('t729-train', 'train');
    const s = f.draw();
    const text = sidebar(s).join(' ').replace(/\s+/g, ' ');
    expect(text.match(/cannot (drill|train)/g)).toEqual(['cannot drill']);
    expect(text.match(/\[z\] Barracks/g)).toHaveLength(1);
    expect(text).toContain('3 dwarves off work, and with no barracks they cannot drill: [z] Barracks, then [b], or [o] Off.');
    const row = rowOf(s, 'No barracks  [b] assign');
    expect(row).toBeGreaterThan(rowOf(s, 'cannot drill'));
    expect(fgOfText(s, row, 'No barracks')).toBe(hexOf(theme.alert));
    // A barracks made: the row names it, out of the alert colour.
    f.w.zone('barracks', [f.w.index(20, 20, z), f.w.index(21, 20, z)]);
    const after = f.draw();
    expect(rowOf(after, 'No barracks')).toBe(-1);
    expect(fgOfText(after, rowOf(after, 'Barracks #1'), 'Barracks #1')).toBe(hexOf(theme.dim));
  });

  it('a squad Off with no barracks has the plain row, dim', () => {
    const f = setup('t729-off', 'off');
    const s = f.draw();
    const row = rowOf(s, 'No barracks  [b] assign');
    expect(row).toBeGreaterThan(0);
    expect(fgOfText(s, row, 'No barracks')).toBe(hexOf(theme.dim));
  });

  it('[z] Barracks is never split by the wrap, at the sidebar width or any other', () => {
    const f = setup('t729-wrap', 'train');
    const rows = sidebar(f.draw());
    // At the sidebar's width the line used to break between `[z]` and `Barracks`.
    const at = rows.findIndex((r) => r.trim().startsWith('3 dwarves off work'));
    expect(rows.slice(at, at + 4).map((r) => r.trim())).toEqual(['3 dwarves off work, and with no', 'barracks they cannot drill:', '[z] Barracks, then [b], or', '[o] Off.']);
    const line = strings.get('ui.military.train_cost_no_barracks', { n: 3 });
    for (let width = 16; width <= 60; width += 1) {
      const lines = wrapHang(line, width, 2);
      expect(lines.some((l) => l.endsWith('[z]') || l.endsWith('[o]')), `width ${width}`).toBe(false);
      expect(lines.every((l) => Array.from(l).length <= width), `width ${width}`).toBe(true);
      expect(lines.map((l) => l.trim()).join(' '), `width ${width}`).toBe(line);
    }
  });
});
