import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as z } from '@app/headless';
import type { Command } from '@core/commands';
import { computeLayout } from '@render/cellbuffer';
import type { ItemsReader } from '@systems/items';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { Keymap, type KeymapRow } from '@ui/keymap';
import { helpKeyRows } from '@ui/panels/help';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, press, surface, registry } from './ui-fixture';

function fixture(linked = false, keys = keymap) {
  const w = new TestWorld({ seed: 't247-links', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const at = w.index(20, 20, z), a = w.index(30, 20, z), b = w.index(35, 20, z);
  const pile = w.zone('stockpile', [at]), source = w.zone('stockpile', [a]), other = w.zone('stockpile', [b]);
  w.zone('bedroom', [w.index(38, 22, z)]);
  if (linked) for (const sourceZoneId of [source, other]) expect(w.game.world.applyCommand({ type: 'LinkStockpile', zoneId: pile, sourceZoneId, on: true }).ok).toBe(true);
  const sent: Command[] = [], asked: string[] = [], focused: number[][] = [];
  const layout = computeLayout(80, 42, true);
  const host: FortressHost = { readers: w.readers, registry: w.game.registry, ui: defaultUiState(z),
    submit: cmd => { sent.push(cmd); expect(w.game.world.applyCommand(cmd).ok).toBe(true); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: (x,y,z) => { focused.push([x,y,z]); }, home: () => {}, zoom: () => {},
    layout: () => layout, precondition: () => true, registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements, now: () => 1000, confirm: id => { asked.push(id); } };
  const screen = new FortressScreen(host, keys, strings); screen.openPanel('zones'); screen.zones.selected = pile;
  return { screen, sent, asked, focused, pile, source, other, w, layout, items: w.readers.of<ItemsReader>('13') };
}
function clickText(f: ReturnType<typeof fixture>, text: string) {
  const s = surface(80, 42); f.screen.draw(s); const row = s.lines().findIndex(l => l.includes(text)); expect(row, text).toBeGreaterThanOrEqual(0);
  const col = s.lines()[row]!.indexOf(text); expect(s.hitAt(col, row), text).not.toBeNull();
  f.screen.pointerDown({ col, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
}
function clickTile(f: ReturnType<typeof fixture>, x: number, y: number) {
  f.screen.pointerDown({ col: f.layout.map.col + x - f.screen.ui.camX, row: f.layout.map.row + y - f.screen.ui.camY, button: 0, shift: false, ctrl: false, alt: false, meta: false });
}

describe('T-247 stockpile source links have keyboard and mouse controls', () => {
  it('i enters map picking and clicking another stockpile links it as the source', () => {
    const f = fixture(); f.screen.key(press('i')); expect(f.screen.statusRow2()).toContain('Link Stockpile #1: click the stockpile it takes from');
    clickTile(f, 30, 20); expect(f.sent).toEqual([{ type: 'LinkStockpile', zoneId: f.pile, sourceZoneId: f.source, on: true }]);
    expect(f.items.stockpile(f.pile)?.linkedSources).toEqual([f.source]); expect(f.asked).toEqual([]);
  });
  it('clicking the link action and Enter at the map cursor offer the other input paths', () => {
    const f = fixture(); clickText(f, '[i] link'); f.screen.ui.cursor = { x: 30, y: 20 };
    f.screen.key(press('Enter')); expect(f.sent).toEqual([{ type: 'LinkStockpile', zoneId: f.pile, sourceZoneId: f.source, on: true }]);
  });
  it.each([[38,22], [39,23], [20,20]])('refuses a non-source at %i,%i without changing selection or removing a zone', (x,y) => {
    const f = fixture(); f.screen.key(press('i')); clickTile(f,x,y);
    expect(f.screen.currentNotice).toBe('Only another stockpile can be a source.'); expect(f.screen.zones.selected).toBe(f.pile);
    expect(f.sent).toEqual([]); expect(f.asked).toEqual([]);
    clickTile(f,30,20); expect(f.items.stockpile(f.pile)?.linkedSources).toEqual([f.source]);
  });
  it('x opens linked sources, arrows select and Enter unlinks only the chosen source', () => {
    const f = fixture(true); f.screen.key(press('x')); expect(f.asked).toEqual([]);
    f.screen.key(press('ArrowDown')); f.screen.key(press('Enter'));
    expect(f.sent).toEqual([{ type: 'LinkStockpile', zoneId: f.pile, sourceZoneId: f.other, on: false }]);
    expect(f.items.stockpile(f.pile)?.linkedSources).toEqual([f.source]);
  });
  it('shows source names and offers a clickable list line that centres its source, plus an unlink button', () => {
    const f = fixture(true); const s = surface(80,42); f.screen.draw(s);
    expect(s.lines().join('\n')).toContain('Stockpile #2, Stockpile #3');
    clickText(f, '[x] unlink'); clickText(f, 'Stockpile #3'); expect(f.focused).toContainEqual([35,20,z]); expect(f.sent).toEqual([]);
    clickText(f, '[Enter] unlink'); expect(f.items.stockpile(f.pile)?.linkedSources).toEqual([f.source]);
  });
  it('explains an empty unlink list and retains Delete as confirmed stockpile removal', () => {
    const f = fixture(); f.screen.key(press('x')); expect(f.asked).toEqual([]);
    expect(f.screen.currentNotice).toBe('This stockpile has no source links.');
    f.screen.key(press('Delete')); expect(f.asked).toEqual(['c_remove_zone']); expect(f.sent).toEqual([]);
  });
  it('stockpile removal remains clickable and asks through the existing confirmation', () => {
    const f = fixture(); clickText(f, '[Del] remove zone'); expect(f.asked).toEqual(['c_remove_zone']); expect(f.sent).toEqual([]);
  });
  it('rebound panel letters still win and link captions and Help show the Shift accelerator', () => {
    const keys = Keymap.fromRows(registry.derived<readonly KeymapRow[]>('keymap'));
    const at = keys.bindings.findIndex(b => b.context === 'fortress_panel' && b.id === 'military');
    expect(keys.rebind(at, { key: 'i', ctrl: false, shift: false })).toBeNull();
    const f = fixture(false, keys); f.screen.key(press('i')); expect(f.screen.ui.panel).toBe('military');
    f.screen.openPanel('zones'); f.screen.key(press('I', { shift: true }));
    expect(f.screen.statusRow2()).toContain('Link Stockpile #1:');
    const s = surface(80,42); f.screen.draw(s); expect(s.lines().join('\n')).toContain('[S-i] link');
    expect(helpKeyRows(keys, strings).some(r => r.text.startsWith('[S-i]  link a source stockpile'))).toBe(true);
  });
  it.each(['pick', 'unlink'] as const)('x never removes the stockpile from the %s mode', mode => {
    const f = fixture(true); f.screen.key(press(mode === 'pick' ? 'i' : 'x')); f.screen.key(press('x'));
    expect(f.asked).toEqual([]); f.screen.key(press('Enter'));
    expect(f.sent).toEqual([{ type: 'LinkStockpile', zoneId: f.pile, sourceZoneId: f.source, on: false }]);
  });
  it('refuses a room source; overlapping stockpile creation cannot make the pick ambiguous', () => {
    const f = fixture(); const tile = f.w.index(40,20,z); f.w.zone('bedroom',[tile]);
    expect(f.w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'stockpile', tiles: [tile] })).toMatchObject({ ok: false, reason: 'overlap' });
    f.screen.key(press('i')); clickTile(f,40,20);
    expect(f.sent).toEqual([]); expect(f.screen.currentNotice).toBe('Only another stockpile can be a source.');
  });
  it('Esc cancels link picking and source choice without a command', () => {
    const f = fixture(true); f.screen.key(press('i')); f.screen.key(press('Esc'));
    expect(f.screen.ui.panel).toBe('zones'); expect(f.screen.statusRow2()).not.toContain('click the stockpile it takes from');
    f.screen.key(press('x')); f.screen.key(press('Esc')); expect(f.sent).toEqual([]); expect(f.asked).toEqual([]); expect(f.screen.ui.panel).toBe('zones');
  });
});
