/** T-M4-17: command paths and shortcuts of the M4 fortress panels. */
import { describe, expect, it, vi } from 'vitest';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import type { Command } from '@core/commands';
import type { WorkOrder } from '@core/components';
import type { BuildingsReader } from '@systems/buildings';
import type { WorkshopsReader } from '@systems/workshops';
import { outputFilter, type RecipeRow } from '@systems/workshops';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, surface } from './ui-fixture';
import { drawZonesPanel } from '@ui/panels/zones';

async function game(): Promise<Game> {
  const g = new Game({ canvas: new MockCanvas(), seed: 'm4-ui', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
  await g.start({ embark: 'default' });
  return g;
}

describe('T-M4-17 panels: shortcuts and commands', () => {
  it('tracks a dimcap brew order against dimcap ale while filtering its inputs to dimcap', () => {
    const registry = loadContent();
    const recipe = registry.table<RecipeRow>('recipes').byId('brew') as RecipeRow;
    const order: WorkOrder = { recipe: registry.table('recipes').index('brew'), mode: 'maintain', remaining: 1, threshold: 20, priority: 5, materialFilter: 'dimcap' };
    expect(outputFilter(registry, recipe, order)).toEqual({ type: registry.table('items').index('drink'), materialId: registry.table('materials').index('dimcap_ale') });
  });
  it('opens orders, animals, mood and population through their documented hotkeys', async () => {
    const g = await game();
    for (const [key, panel] of [['o', 'orders'], ['n', 'animals'], ['e', 'mood'], ['p', 'population']]) {
      g.handleKey(press(key as string));
      expect(g.ui.panel).toBe(panel);
      expect(g.textRows().join('\n')).toContain(panel === 'mood' ? 'Hall spirit' : panel === 'animals' ? 'Tame' : panel === 'orders' ? 'Standing orders' : 'dwarves');
    }
  });

  it('adds a global order, edits its mode and toggles a standing order', async () => {
    const g = await game();
    const spy = vi.spyOn(g.host, 'submit');
    g.handleKey(press('o'));
    // U-03 (D-U5): `[S-n]` opens the order picker.
    g.handleKey(press('n', { shift: true }));
    expect(g.fortress.orders.adding).toBe(true);
    g.handleKey(press('Enter'));
    const add = spy.mock.lastCall?.[0] as Command;
    expect(add.type).toBe('AddWorkOrder');
    expect(add['workshopId']).toBe(0);
    g.host.step(1);
    expect(g.host.readers.of<WorkshopsReader>('12').globalOrders()).toHaveLength(1);
    // U-03 (D-U2): `m` opens Military; the mode toggle is `[S-m]`.
    g.handleKey(press('m', { shift: true }));
    expect(spy.mock.lastCall?.[0]).toMatchObject({ type: 'EditWorkOrder', workshopId: 0, patch: { mode: 'maintain' } });
    g.render();
    expect(g.textRows().join('\n')).toContain('Standing orders');
  });

  it('filters farm choices by light, submits the selected season and shows seed and crop rows', async () => {
    const g = await game();
    const map = g.host.readers.map;
    const tile = map.index(40, 30, g.ui.z);
    g.host.submit({ type: 'CreateZone', zoneType: 'farm_plot', tiles: [tile, map.index(41, 30, g.ui.z)] });
    g.host.step(1);
    const zoneId = g.host.readers.of<BuildingsReader>('14').zoneAt(tile);
    expect(zoneId).toBeGreaterThan(0);
    g.fortress.zones.selected = zoneId;
    const options = g.fortress.zones.farmOptions(g.fortress.ctx).map((o) => o.id);
    expect(options).toContain('barley');
    expect(options).not.toContain('dimcap');
    const spy = vi.spyOn(g.host, 'submit');
    const s = surface(36, 32);
    drawZonesPanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, g.fortress.zones, g.fortress.ctx);
    expect(s.lines().join('\n')).toContain('Spring');
    const row = s.lines().findIndex((line) => line.includes('Spring'));
    s.hitAt(10, row)?.action();
    expect(g.fortress.zones.farmMenus[0]?.open).toBe(true);
    g.ui.panel = 'zones';
    const barley = options.indexOf('barley');
    for (let i = 0; i < barley; i += 1) g.handleKey(press('↓'));
    g.handleKey(press('Enter'));
    expect(spy.mock.lastCall?.[0]).toEqual({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'barley' });
  });
});
