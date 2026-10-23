/** T-272: a farm plot's crops are chosen by keyboard, and the Calendar opens by a key. */
import { describe, expect, it, vi } from 'vitest';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { PlantRow } from '@systems/plants';
import { seasonAllows } from '@systems/plants/growth';
import { drawZonesPanel } from '@ui/panels/zones';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { helpKeyRows } from '@ui/panels/help';
import { LEGACY_BINDINGS } from '@ui/keymap';
import { keymap, press, strings, surface } from './ui-fixture';

async function plot(): Promise<{ g: Game; zoneId: number }> {
  const g = new Game({ canvas: new MockCanvas(), seed: 't272', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
  await g.start({ embark: 'default' });
  const map = g.host.readers.map;
  const tile = map.index(40, 30, g.ui.z);
  g.host.submit({ type: 'CreateZone', zoneType: 'farm_plot', tiles: [tile, map.index(41, 30, g.ui.z)] });
  g.host.step(1);
  const zoneId = g.host.readers.of<BuildingsReader>('14').zoneAt(tile);
  g.fortress.zones.selected = zoneId;
  g.ui.panel = 'zones';
  g.ui.sidebar = true;
  return { g, zoneId };
}

function rows(g: Game): string[] {
  const s = surface(36, 40);
  drawZonesPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, g.fortress.zones, g.fortress.ctx);
  return s.lines().map((line) => line.trimEnd());
}

describe('T-272 farm plot crops by keyboard', () => {
  it('highlights the current season first, and the arrow keys move the highlight over the four rows', async () => {
    const { g } = await plot();
    const mark = (): number => rows(g).findIndex((line) => line.startsWith('►'));
    const spring = rows(g).findIndex((line) => line.includes('Spring'));
    expect(mark()).toBe(spring);
    expect(g.fortress.zones.farmRow(g.fortress.ctx)).toBe(g.host.readers.calendar.season);
    g.handleKey(press('↓'));
    expect(mark()).toBe(spring + 1);
    g.handleKey(press('↓')); g.handleKey(press('↓')); g.handleKey(press('↓'));
    expect(mark()).toBe(spring + 3);
    g.handleKey(press('↑'));
    expect(mark()).toBe(spring + 2);
    // Another plot starts on the current season again.
    g.fortress.zones.selected = 0;
    expect(g.fortress.zones.farmRow(g.fortress.ctx)).toBe(g.host.readers.calendar.season);
  });

  it('Enter opens the highlighted row, the arrows and Enter choose a crop for that season, and Esc closes without a change', async () => {
    const { g, zoneId } = await plot();
    const spy = vi.spyOn(g.host, 'submit');
    g.handleKey(press('↓'));
    g.handleKey(press('Enter'));
    expect(g.fortress.zones.farmMenus[1]?.open).toBe(true);
    const options = g.fortress.zones.farmOptions(g.fortress.ctx).map((o) => o.id);
    const barley = options.indexOf('barley');
    for (let i = 0; i < barley; i += 1) g.handleKey(press('↓'));
    g.handleKey(press('Enter'));
    expect(spy.mock.lastCall?.[0]).toEqual({ type: 'SetPlotCrop', zoneId, season: 1, speciesId: 'barley' });
    expect(g.fortress.zones.farmMenus[1]?.open).toBe(false);
    spy.mockClear();
    g.handleKey(press('Enter'));
    g.handleKey(press('↓'));
    g.handleKey(press('Esc'));
    expect(g.fortress.zones.farmMenus[1]?.open).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('Shift+A gives the highlighted row\'s crop to every season in which that crop can grow', async () => {
    const { g, zoneId } = await plot();
    g.host.submit({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'barley' });
    g.host.step(1);
    const barley = g.registry.table<PlantRow>('plants').byId('barley') as PlantRow;
    const spy = vi.spyOn(g.host, 'submit');
    g.handleKey(press('A', { shift: true }));
    const seasons = spy.mock.calls.map((call) => (call[0] as unknown as { season: number }).season).sort();
    const expected = [1, 2, 3].filter((s) => seasonAllows(barley, false, s));
    expect(seasons).toEqual(expected);
    for (const call of spy.mock.calls) expect(call[0]).toMatchObject({ type: 'SetPlotCrop', zoneId, speciesId: 'barley' });
    g.host.step(1);
    const set = g.host.readers.of<{ plotSettings(id: number): number[] }>('07').plotSettings(zoneId);
    expect(set.filter((id) => id !== 0).length).toBe(1 + expected.length);
  });

  it('lists a crop with no seeds with "(no seeds)", and labels the figure after a row with "seeds"', async () => {
    const { g, zoneId } = await plot();
    const plants = g.registry.table<PlantRow>('plants');
    const stock = g.host.readers.of<ItemsReader>('13');
    const options = g.fortress.zones.farmOptions(g.fortress.ctx);
    const crops = options.filter((o) => o.id !== '0');
    expect(crops.length).toBeGreaterThan(2);
    for (const option of crops) {
      const seeds = stock.countMatching({ type: g.registry.table<{ id: string }>('items').index('seed'), materialId: g.registry.table<{ id: string }>('materials').index(option.id) });
      const name = (plants.byId(option.id) as PlantRow).name;
      expect(option.label, option.id).toBe(seeds === 0 ? `${name} (no seeds)` : name);
    }
    expect(crops.some((o) => o.label.endsWith('(no seeds)'))).toBe(true);
    expect(crops.some((o) => !o.label.endsWith('(no seeds)'))).toBe(true);
    g.host.submit({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'barley' });
    g.host.step(1);
    expect(rows(g).find((line) => line.includes('Spring'))).toMatch(/barley.*\d+ seeds$/);
    expect(rows(g).join('\n')).toContain('↑↓ season · Enter choose crop');
    expect(rows(g).join('\n')).toContain('[S-a] all seasons');
  });
});

describe('T-272 the Calendar key', () => {
  it('Shift+Y opens the Calendar and a second press closes it, and the keymap and Help list it', async () => {
    const { g } = await plot();
    g.handleKey(press('Y', { shift: true }));
    expect(g.ui.panel).toBe('calendar');
    g.handleKey(press('Y', { shift: true }));
    expect(g.ui.panel).toBeNull();
    const binding = keymap.bindings.find((b) => b.id === 'calendar');
    expect(binding?.spec).toEqual({ key: 'Y', ctrl: false, shift: true });
    // A keymap saved by index before the bindings had names finds the row at its old place, the last.
    expect(LEGACY_BINDINGS[LEGACY_BINDINGS.length - 1]).toBe('global/Shift+Y');
    const help = helpKeyRows(keymap, strings).map((row) => row.text);
    expect(help.some((text) => text.includes('[S-y]') && text.includes('calendar panel'))).toBe(true);
    expect(help.some((text) => text.includes('Farm plot: ↑↓ season') && text.includes('[S-a]'))).toBe(true);
  });
});
