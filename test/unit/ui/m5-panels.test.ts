import { describe, expect, it, vi } from 'vitest';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import { ItemFlag } from '@core/components';
import type { Command } from '@core/commands';
import type { ItemCore } from '@systems/items';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, surface } from './ui-fixture';
import { drawOrdersPanel, drawWorkshopPanel } from '@ui/panels/orders';
import { drawStocksPanel } from '@ui/panels/stocks';

async function game(): Promise<Game> {
  const g = new Game({ canvas: new MockCanvas(), seed: 'm5-ui', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
  await g.start({ embark: 'default' });
  return g;
}

describe('T-M5-08 Stocks, global orders and material dropdown', () => {
  it('selects a stocked type or one item and marks only metal items for melting', async () => {
    const g = await game();
    const registry = g.host.headless.registry;
    const core = g.host.world.services.items as ItemCore;
    const at = g.host.readers.map.index(40, 30, g.ui.z);
    const type = registry.table('items').index('stone_block');
    const metal = core.create(type, registry.table('materials').index('iron'), at);
    const stone = core.create(type, registry.table('materials').index('granite'), at);
    g.host.step(1);
    const panel = g.fortress.stocks;
    panel.tree.expanded.add('stone');
    panel.tree.expanded.add('stone/block');
    while (panel.selectedNode(g.fortress.ctx) !== `type:${type}`) panel.move(1, g.fortress.ctx);
    expect(panel.flagCommands(g.fortress.ctx, 'MeltItem')).toEqual([{ type: 'MeltItem', itemId: metal, on: true }]);
    expect(panel.flagCommands(g.fortress.ctx, 'DumpItem')).toEqual([{ type: 'DumpItem', typeId: type, on: true }]);
    panel.tree.expanded.add(`type:${type}`);
    while (panel.selectedNode(g.fortress.ctx) !== `item:${stone}`) panel.move(1, g.fortress.ctx);
    expect(panel.flagCommands(g.fortress.ctx, 'MeltItem')).toEqual([]);
    expect(panel.flagCommands(g.fortress.ctx, 'ForbidItem')).toEqual([{ type: 'ForbidItem', itemId: stone, on: true }]);
    const s = surface(36, 32);
    drawStocksPanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, panel, g.fortress.ctx);
    expect(s.lines().join('\n')).toContain('depot');
    expect(s.hitAt(29, 29)).toBeNull();
    expect((core.get(metal)?.flags ?? 0) & ItemFlag.Melt).toBe(0);
  });

  it('adds a global order and chooses steel in the material list', async () => {
    const g = await game();
    const spy = vi.spyOn(g.host, 'submit');
    g.handleKey(press('o'));
    // U-03 (D-U5): `[S-n]` opens the order picker (`+` now changes the selected order's count).
    g.handleKey(press('n', { shift: true }));
    const recipes = g.fortress.orders.pickerRecipes(g.fortress.ctx);
    const at = recipes.findIndex((r) => r.id === 'forge_battle_axe');
    expect(at).toBeGreaterThanOrEqual(0);
    g.fortress.orders.picker.list.selected = at;
    g.handleKey(press('Enter'));
    expect(spy.mock.lastCall?.[0]).toMatchObject({ type: 'AddWorkOrder', workshopId: 0 });
    g.host.step(1);
    // U-03 (D-U2): `f` opens Overlays; the material filter is `[S-f]`.
    g.handleKey(press('f', { shift: true }));
    expect(g.fortress.orders.materialOpen).toBe(true);
    const choices = g.fortress.orders.materialOptions(g.fortress.ctx);
    expect(choices.map((c) => c.id)).toContain('steel');
    const listSurface = surface(36, 32);
    drawOrdersPanel(listSurface, { col: 0, row: 0, cols: 36, rows: 32 }, g.fortress.orders, g.fortress.ctx);
    expect(listSurface.lines().join('\n')).toContain('Material filter');
    g.fortress.orders.materials.selected = choices.findIndex((c) => c.id === 'steel');
    g.handleKey(press('Enter'));
    expect(spy.mock.lastCall?.[0] as Command).toMatchObject({ type: 'EditWorkOrder', workshopId: 0, patch: { materialFilter: 'steel' } });
    g.host.step(1);
    expect(g.fortress.orders.selected(g.fortress.ctx)?.order.materialFilter).toBe(g.host.headless.registry.table('materials').index('steel'));
    const s = surface(36, 32);
    drawOrdersPanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, g.fortress.orders, g.fortress.ctx);
    expect(s.lines().join('\n')).toContain('[S-f] steel');
  });

  it('shows a workshop order and opens its material filter from the workshop panel', async () => {
    const g = await game();
    const map = g.host.readers.map;
    const reader = g.host.readers.of<BuildingsReader>('14');
    const system = g.host.world.scheduler.byId('14') as BuildingsSystem;
    let mason = 0;
    for (let y = 12; y < map.h - 12 && mason === 0; y += 1) for (let x = 12; x < map.w - 12 && mason === 0; x += 1) {
      const origin = map.index(x, y, g.ui.z);
      if (reader.ghost('mason', origin, 0).reason !== null) continue;
      const placed = g.host.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'mason', origin, orientation: 0, materialChoice: 0 });
      if (!placed.ok) continue;
      mason = system.lastPlacedBuilding;
      system.completeNow(mason, g.host.headless.registry.table('materials').index('granite'));
    }
    expect(mason).toBeGreaterThan(0);
    g.host.step(1);
    expect(g.host.world.applyCommand({ type: 'AddWorkOrder', workshopId: mason, order: { recipeId: 'make_stone_block', mode: 'once', remaining: 1, threshold: 0, priority: 5 } })).toEqual({ ok: true });
    g.host.step(1);
    const s = surface(36, 32);
    drawWorkshopPanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, mason, g.fortress.orders, g.fortress.ctx);
    expect(s.lines().join('\n')).toContain('x1 Blocks · '); // U-03 (D-U5): count, recipe, status
    g.fortress.workshopId = mason;
    g.ui.panel = 'workshop';
    g.handleKey(press('f', { shift: true }));
    expect(g.ui.panel).toBe('orders');
    expect(g.fortress.orders.materialOpen).toBe(true);
    expect(g.fortress.orders.workshopId).toBe(mason);
  });
});
