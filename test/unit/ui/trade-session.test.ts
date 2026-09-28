import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import type { TradeReader } from '@systems/trade';
import { tradeTotals } from '@ui/screens/trade_session';
import { drawCivilizationsPanel } from '@ui/panels/civilizations';
import { drawDepotPanel } from '@ui/panels/depot';
import { surface, press } from './ui-fixture';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import type { BuildingsSystem } from '@systems/buildings';

describe('T-M7-03 trade session and civilization panels', () => {
  it('recomputes partial-stack price, valuation, margin, and shortfall', () => {
    const merchant = [{ id: 1, count: 10, price: 120 }];
    const fortress = [{ id: 2, count: 20, value: 200 }];
    expect(tradeTotals(merchant, fortress, new Map([[1, 5]]), new Map([[2, 6]]), 15)).toEqual({
      take: 60, give: 60, required: 69, shortfall: 9,
    });
    expect(tradeTotals(merchant, fortress, new Map(), new Map([[2, 6]]), 15)).toEqual({
      take: 0, give: 60, required: 0, shortfall: 0,
    });
  });

  it('edits next-year requests and shows the civilization reader', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 'm7-civilizations', registry: loadContent(),
      createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const panel = game.fortress.civilizations;
    game.fortress.openPanel('civilizations');
    expect(panel.key(game.fortress.ctx, press('ArrowDown'), () => {})).toBe(true);
    expect(panel.civ()).toBe('hillfolk');
    expect(panel.key(game.fortress.ctx, press('a'), () => {})).toBe(true);
    expect(panel.choosingRequest).toBe(true);
    expect(panel.key(game.fortress.ctx, press('Enter'), () => {})).toBe(true);
    game.host.step(1);
    const trade = game.host.readers.of<TradeReader>('20');
    expect(trade.requests('hillfolk')).toHaveLength(1);
    const s = surface(36, 24);
    drawCivilizationsPanel(s, { col: 0, row: 0, cols: 36, rows: 24 }, panel, game.fortress.ctx, () => {});
    expect(s.lines().join('\n')).toContain('Hillfolk');
    expect(s.lines().join('\n')).toContain('Requests');
    const depotSurface = surface(36, 12);
    drawDepotPanel(depotSurface, { col: 0, row: 0, cols: 36, rows: 12 }, game.fortress.depot, game.fortress.ctx, () => {});
    expect(depotSurface.lines().join('\n')).toContain('No built trade depot');
  });

  it('marks stock tree goods for a depot without changing speed', async () => {
    const game = new Game({ canvas: new MockCanvas(), seed: 'm7-depot-selection', registry: loadContent(),
      createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const world = game.host.world;
    const map = game.host.readers.map;
    const placed = world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin: map.index(45, 8, 32), orientation: 0, materialChoice: 'granite' });
    expect(placed.ok).toBe(true);
    const buildings = world.scheduler.byId('14') as BuildingsSystem;
    const depot = buildings.lastPlacedBuilding;
    buildings.completeNow(depot, game.registry.table('materials').index('granite'), 0);
    game.fortress.depot.select(game.fortress.ctx, depot);
    game.fortress.openPanel('depot');
    const speed = game.host.speed();
    expect(game.fortress.key(press('m'))).toBe(true);
    expect(game.fortress.stocks.depotSelection).toBe(depot);
    for (let n = 0; n < 30 && game.fortress.stocks.depotChoices(game.fortress.ctx).length === 0; n += 1) game.fortress.stocks.move(1, game.fortress.ctx);
    expect(game.fortress.stocks.depotChoices(game.fortress.ctx).length).toBeGreaterThan(0);
    expect(game.fortress.key(press('Space'))).toBe(true);
    expect(game.fortress.stocks.depotChosen.size).toBeGreaterThan(0);
    expect(game.host.speed()).toBe(speed);
    expect(game.fortress.key(press('t'))).toBe(true);
    expect(game.fortress.stocks.depotSelection).toBe(0);
    expect(game.ui.panel).toBe('depot');
  });
});
