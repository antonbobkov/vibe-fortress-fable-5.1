/**
 * T-332: what the Civilizations panel, the Depot panel and the trade session say. They were stored
 * cell buffers (T-M7-03); each assertion now names what a row means. The fortress: seed
 * `m7-trade-golden` with a finished trade depot holding ten easy meals, the Hillfolk selected, and a
 * trade session with the Hillfolk at the depot offering wool cloth for the meals.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import type { ReaderSet } from '@core/readers';
import type { BuildingsSystem } from '@systems/buildings';
import type { TradeReader } from '@systems/trade';
import { drawCivilizationsPanel } from '@ui/panels/civilizations';
import { drawDepotPanel } from '@ui/panels/depot';
import { TradeSessionScreen } from '@ui/screens/trade_session';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { surface } from './ui-fixture';

type Name = 'civilizations' | 'depot' | 'trade_session';
let game: Game;
let tradeScreen: TradeSessionScreen;

function render(which: Name): string[] {
  const s = surface(which === 'trade_session' ? 80 : 36, which === 'trade_session' ? 28 : 24);
  if (which === 'civilizations') drawCivilizationsPanel(s, { col: 0, row: 0, cols: 36, rows: 24 }, game.fortress.civilizations, game.fortress.ctx, () => {});
  else if (which === 'depot') drawDepotPanel(s, { col: 0, row: 0, cols: 36, rows: 24 }, game.fortress.depot, game.fortress.ctx, () => {});
  else tradeScreen.draw(s);
  return s.lines().map((line) => line.trimEnd());
}

describe('T-332 panels: civilizations, trade depot and trade session', () => {
  beforeAll(async () => {
    game = new Game({ canvas: new MockCanvas(), seed: 'm7-trade-golden', registry: loadContent(),
      createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const world = game.host.world;
    const registry = game.registry;
    const map = game.host.readers.map;
    const material = registry.table('materials').index('granite');
    const placed = world.applyCommand({ type: 'PlaceBuilding', buildingType: 'trade_depot', origin: map.index(45, 8, 32), orientation: 0, materialChoice: 'granite' });
    if (!placed.ok) throw new Error(placed.reason);
    const buildings = world.scheduler.byId('14') as BuildingsSystem;
    const depot = buildings.lastPlacedBuilding;
    buildings.completeNow(depot, material, 0);
    const tile = game.host.readers.of<{ get(id: number): { footprint: number[] } | undefined }>('14').get(depot)?.footprint[0] ?? 0;
    const meal = world.services.spawn.item(registry.table('items').index('easy_meal'), registry.table('materials').index('meal'), tile, 10, 1);
    const cloth = world.services.spawn.item(registry.table('items').index('cloth'), registry.table('materials').index('wool_cloth'), tile, 5, 1);
    const dwarf = game.host.readers.of<{ list(): number[] }>('10').list()[0] ?? 0;
    if (!dwarf || !world.services.movement?.teleport(dwarf, tile)) throw new Error('hauler fixture failed');
    game.host.submit({ type: 'MoveToDepot', depotId: depot, itemIds: [meal] });
    const trade = game.host.readers.of<TradeReader>('20');
    for (let n = 0; n < 100 && !trade.depotItems().includes(meal); n += 1) game.host.step(1);
    if (!trade.depotItems().includes(meal)) throw new Error('depot haul failed');
    game.fortress.depot.select(game.fortress.ctx, depot);
    game.fortress.civilizations.selected = 1;
    const mocked: TradeReader = {
      ...trade,
      activeCaravan: () => ({ civ: 'hillfolk', state: 'atDepot', daysRemaining: 3 }),
      merchantItems: () => [cloth],
      depotItems: () => [meal],
      reputation: () => 4,
      marginPercent: () => 12,
      price: () => 120,
      valuation: (_civ, id) => id === meal ? 80 : 100,
    };
    const readers = new Proxy(game.host.readers, {
      get(target, key) {
        if (key === 'of') return (id: string) => id === '20' ? mocked : target.of(id);
        return Reflect.get(target, key);
      },
    }) as ReaderSet;
    tradeScreen = new TradeSessionScreen({ readers, registry, submit: () => {}, commandTick: () => {}, back: () => {} });
    tradeScreen.setQuantity('merchant', cloth, 2);
    tradeScreen.setQuantity('fortress', meal, 5);
  });

  it('Civilizations lists each civilization with its reputation and visiting season, marks the selected one, and details it', () => {
    const rows = render('civilizations');
    expect(rows[0]).toMatch(/Mountainhome rep \+0 spring$/);
    expect(rows[1]).toMatch(/► Hillfolk rep \+0 summer$/);
    expect(rows[2]).toMatch(/Wildwood rep \+0 autumn$/);
    // Only the selected civilization has the cursor, and the detail below is its own.
    expect(rows.slice(0, 3).filter((row) => row.includes('►'))).toHaveLength(1);
    expect(rows[4]).toMatch(/── Hillfolk ──/);
    expect(rows[5]).toMatch(/Last brought: none$/);
    expect(rows[6]).toMatch(/Requests \[\+\]$/);
    expect(rows[7]).toMatch(/\[←→\] pick \[S-p\] prio \[x\] remove$/);
    expect(rows[8]).toMatch(/Reputation log$/);
    expect(rows[23]).toMatch(/\[S-d\] depot {2}\[S-t\] trade now$/);
  });

  it('Depot names the depot and the state of its goods, lists what stands in it with its worth, and names the keys', () => {
    const rows = render('depot');
    expect(rows[0]).toMatch(/Trade depot #\d+ · goods at depot$/);
    expect(rows[1]).toMatch(/► 10 easy meal +100 ☼$/);
    expect(rows[22]).toMatch(/\[S-m\] move \[r\] remove \[S-t\] trade$/);
  });

  it('the trade session names the civilization, broker and reputation, lists both sides with prices and chosen quantities, and totals the offer', () => {
    const rows = render('trade_session');
    expect(rows[1]).toMatch(/Trading with the Hillfolk · Broker: a trader \(Trading 0\) · Reputation \+4$/);
    expect(rows[3]).toMatch(/Their goods +price +Our goods at the depot +their value$/);
    // The merchant's side is on the left and ours on the right, with the cursor on the first row.
    expect(rows[4]).toMatch(/► 5 wool cloth +120 +10 easy meals +80$/);
    expect(rows[5]).toMatch(/\[-\] 2 \[\+\] +\[-\] 5 \[\+\]$/);
    expect(rows[23]).toMatch(/We take 48 ☼ · We give 40 ☼ · \+12%: 54 ☼$/);
    expect(rows[24]).toMatch(/Not enough\. Add 14 ☼ of goods\.$/);
    expect(rows[25]).toMatch(/\[Tab\] switch side {2}\[\+\]\/\[-\] quantity {2}\[Enter\] Offer {2}\[g\] Gift {2}\[Esc\] Close$/);
  });
});
