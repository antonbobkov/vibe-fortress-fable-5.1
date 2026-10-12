/** T-244: the audited 80-column screens keep complete actions and numbers. */
import { describe, expect, it, vi } from 'vitest';
import { Game } from '@app/game';
import type { ReaderSet } from '@core/readers';
import { EmbarkScreen, marks, type CatalogRow } from '@ui/screens/embark';
import { TradeSessionScreen } from '@ui/screens/trade_session';
import { statusFields } from '@ui/status';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap, registry, strings, surface } from './ui-fixture';

function embark() {
  return new EmbarkScreen(registry, 't244-layout', { name: 'Greenhollow', peril: 0, tempC: 12 }, { embark: () => {}, back: () => {} }, keymap, strings);
}
function trade() {
  const reader = { activeCaravan: () => ({ civ: 'hillfolk' }), session: () => ({ traderId: 1 }), merchantItems: () => [], depotItems: () => [], reputation: () => 12, marginPercent: () => 15 };
  const readers = { entities: { get: () => ({ name: 'Rannveig Copperhammer' }) }, has: (id: string) => id === '10', of: (id: string) => id === '10' ? { skill: () => 12 } : reader } as unknown as ReaderSet;
  return new TradeSessionScreen({ registry, readers, strings, submit: () => {}, commandTick: () => {}, back: () => {} });
}
async function fortress() {
  const game = new Game({ canvas: new MockCanvas(), registry, seed: 't244-layout', createCanvas: mockCanvasFactory(), width: 1280, height: 800, devicePixelRatio: 1 });
  await game.start(); return game;
}

describe('T-244 complete text at eighty columns', () => {
  it('keeps the Presets caption and its mouse target in the header', () => {
    const e = embark(), s = surface(80, 50); e.draw(s);
    expect(s.lines()[0]).toContain('[p] Presets');
    const col = s.lines()[0]!.indexOf('[p]'); e.pointerDown({ col: col + 5, row: 0, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    expect(e.presets.open).toBe(true);
  });
  it('shows the full shortened reroll cost', () => {
    const e = embark(), s = surface(80, 50); e.draw(s);
    expect(s.lines().join('\n')).toContain('[r] reroll 25 ☼');
  });
  it('keeps all three Left digits after removing both picks', () => {
    const e = embark(); expect(e.apply({ type: 'SetSupply', entry: 'e_pick_iron', count: 0 })).toBe(true); e.setTab(1);
    expect(e.session.budget() - e.session.total()).toBe(236);
    const s = surface(80, 50); e.draw(s); expect(s.lines()[47]).toContain('Left 236');
  });
  it('keeps a large over-budget Left value whole', () => {
    const e = embark();
    const catalog = registry.table<CatalogRow>('embarkCatalog');
    for (const id of catalog.ids()) expect(e.apply({ type: 'SetSupply', entry: id, count: catalog.byId(id)!.max })).toBe(true);
    const left = e.session.budget() - e.session.total(); expect(left).toBeLessThan(0);
    const s = surface(80, 50); e.draw(s); expect(s.lines()[47]).toContain(`Left ${marks(left)}`);
  });
  it('keeps the final attribute number visible', () => {
    const e = embark(), s = surface(80, 50); e.draw(s);
    const line = s.lines().find(l => l.includes('End'))!;
    expect(line.trimEnd().endsWith(String(e.session.party[0]!.attributes.end))).toBe(true);
  });
  it('separates the trade headers and preserves their value labels', () => {
    const s = surface(80, 50); trade().draw(s);
    expect(s.lines()[3]!.slice(2, 39)).toContain('price'); expect(s.lines()[3]![39]).toBe(' ');
    expect(s.lines()[3]!.slice(41)).toContain('their value');
    expect(s.tooltipAt(42, 3)?.text).toContain('their valuation');
  });
  it('keeps reputation and the required trade value visible', () => {
    const s = surface(80, 50), t = trade();
    vi.spyOn(t, 'totals').mockReturnValue({ take: 1250000, give: 1350000, required: 1437500, shortfall: 87500 }); t.draw(s);
    expect(s.lines()[1]).toContain('+12');
    expect(s.lines()[45]).toContain('1437500 ☼');
  });
  it.each(['arriving', 'at_depot', 'leaving'])('shows the caravan marker while %s', state => {
    const readers = { calendar: { seasonName: 'spring', dayOfSeason: 1, year: 1 }, has: (id: string) => id === '20', of: () => ({ activeCaravan: () => ({ state }) }) } as unknown as ReaderSet;
    expect(statusFields(readers, strings, 32, 0)).toContain('$');
  });
  it('hides the caravan marker when no caravan exists', () => {
    const readers = { calendar: { seasonName: 'spring', dayOfSeason: 1, year: 1 }, has: (id: string) => id === '20', of: () => ({ activeCaravan: () => null }) } as unknown as ReaderSet;
    expect(statusFields(readers, strings, 32, 0)).not.toContain('$');
  });
  it('shows orders, military and labors as whole entries in the decided strip order', async () => {
    const g = await fortress(), s = surface(80, 50); g.fortress.draw(s);
    const row = s.lines()[g.compositor.layout.status.row + 1]!;
    expect(row).toMatch(/\[d\] dig  \[b\] build  \[z\] zones  \[o\] orders  \[m\] military  \[l\] labors/);
    expect(row.trimEnd()).toMatch(/\[[a-z]\] [a-z]+$/);
  });
  it('keeps the tile summary left of a complete prefix of shortcuts', async () => {
    const g = await fortress(), s = surface(80, 50); g.fortress.draw(s);
    const point = g.cellCenter(4, 4);
    g.pointerMove({ ...point, button: 0, shift: false, ctrl: false, alt: false, meta: false }); g.fortress.draw(s);
    const row = s.lines()[g.compositor.layout.status.row + 1]!.trim();
    expect(row).toContain(' · [d] dig');
    const entries = row.slice(row.indexOf(' · ') + 3).split('  ');
    expect(entries).toEqual(['[d] dig', '[b] build', '[z] zones', '[o] orders', '[m] military', '[l] labors', '[u] units', '[j] jobs', '[s] stocks', '[k] look'].slice(0, entries.length));
  });

});
