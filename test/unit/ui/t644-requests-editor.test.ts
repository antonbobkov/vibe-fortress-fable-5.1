/**
 * T-644: the Civilizations requests editor puts the selected civilization's own goods first, in its
 * list's order, and `/` filters the goods by name as the other panels' `/filter` does
 * (`panels.md` § Civilizations).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Command } from '@core/commands';
import { TICKS_PER_DAY } from '@core/constants';
import { computeLayout } from '@render/cellbuffer';
import { eligibleGoodsEntries, type TradeReader } from '@systems/trade';
import { drawCivilizationsPanel, requestCandidates, requestText, TRADE_CIVILIZATIONS } from '@ui/panels/civilizations';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: 60 * TICKS_PER_DAY });
  const sent: Command[] = [];
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (cmd) => { sent.push(cmd); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => computeLayout(80, 42, true), precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 0,
  };
  const f = new FortressScreen(host, keymap, strings);
  f.openPanel('civilizations');
  f.civilizations.selected = TRADE_CIVILIZATIONS.indexOf('mountainhome');
  return { w, f, sent };
}

function draw(f: FortressScreen): string {
  const s = surface(36, 40);
  drawCivilizationsPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, f.civilizations, f.ctx, () => {});
  return s.lines().join('\n');
}

describe('T-644 the requests editor finds a good without stepping through every item', () => {
  it('the Mountainhome\'s editor starts on a good of its list, its own goods first in the list\'s order', () => {
    const { w, f } = setup('t644-own-first');
    const registry = w.game.registry;
    const rep = w.readers.of<TradeReader>('20').reputation('mountainhome');
    const listed = new Set(eligibleGoodsEntries(registry, 'mountainhome', rep).flatMap((e) => Array.isArray(e.item) ? e.item : [e.item]));
    f.key(press('+'));
    expect(f.civilizations.choosingRequest).toBe(true);
    const candidates = f.civilizations.candidates(f.ctx);
    expect(candidates[0]).toBe('bar');
    expect(listed.has(candidates[0]!)).toBe(true);
    expect(draw(f)).toContain('Add: bar: any');
    // Its own goods, each once, then every other item in registry order.
    const own = candidates.slice(0, candidates.findIndex((id) => !listed.has(id)));
    expect(new Set(own).size).toBe(own.length);
    expect(own.slice(0, 4)).toEqual(['bar', 'pick', 'axe', 'short_sword']);
    expect(own).toContain('dog');
    const rest = candidates.slice(own.length);
    expect(rest).toEqual(registry.table('items').ids().filter((id) => !own.includes(id)));
    // Another civilization's list leads its editor.
    expect(requestCandidates(registry, 'hillfolk', 0)[0]).toBe('easy_meal');
  });

  it('typing "bar" after `/` leaves the bars, and `Enter` then `→` asks for iron bars', () => {
    const { w, f, sent } = setup('t644-filter');
    f.key(press('+'));
    f.key(press('/'));
    expect(f.civilizations.filter.focused).toBe(true);
    // Letters are text while the field has focus: `b` and `a` are not panel or command keys here.
    for (const ch of 'bar') expect(f.key(press(ch))).toBe(true);
    expect(f.ui.panel).toBe('civilizations');
    expect(f.civilizations.filter.value).toBe('bar');
    const shown = f.civilizations.candidates(f.ctx);
    expect(shown[0]).toBe('bar');
    for (const id of shown) expect(requestText(w.game.registry, strings, { itemType: id }).toLowerCase()).toContain('bar');
    expect(shown.length).toBeLessThan(f.civilizations.allCandidates(f.ctx).length / 10);
    expect(draw(f)).toContain('/filter: [ bar');
    // The title shows the filter, as Jobs' and Log's do.
    expect(f['panelTitle']('civilizations', 'Civilizations', surface(36, 40))).toBe(`Civilizations · ${shown.length} of ${f.civilizations.allCandidates(f.ctx).length} · filter: bar`);
    // `Enter` finishes typing; the editor stays open, and the arrows choose as before.
    f.key(press('Enter'));
    expect(f.civilizations.filter.focused).toBe(false);
    expect(f.civilizations.choosingRequest).toBe(true);
    for (let k = 0; k < 3; k += 1) f.key(press('ArrowRight'));
    expect(draw(f)).toContain('Add: bar: iron');
    f.key(press('Enter'));
    expect(sent).toEqual([{ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'bar', material: 'iron', priority: 1 }] }]);
  });

  it('a filter that matches nothing says so and adds nothing; the filter ends with the editor', () => {
    const { f, sent } = setup('t644-none');
    f.key(press('+'));
    f.key(press('/'));
    for (const ch of 'zzqq') f.key(press(ch));
    expect(f.civilizations.candidates(f.ctx)).toEqual([]);
    expect(draw(f)).toContain('Add: no good matches the filter');
    f.key(press('Esc'));
    expect(f.civilizations.filter.focused).toBe(false);
    expect(f.civilizations.choosingRequest).toBe(true);
    f.key(press('Enter'));
    expect(sent).toEqual([]);
    f.key(press('+'));
    expect(f.civilizations.filter.value).toBe('');
    expect(f.civilizations.candidates(f.ctx)[0]).toBe('bar');
  });
});
