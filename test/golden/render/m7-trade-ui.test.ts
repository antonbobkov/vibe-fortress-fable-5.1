/** T-M7-03: fixed cell buffers for the civilizations, depot, and trade session UI. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import type { ReaderSet } from '@core/readers';
import type { BuildingsSystem } from '@systems/buildings';
import type { TradeReader } from '@systems/trade';
import { drawCivilizationsPanel } from '@ui/panels/civilizations';
import { drawDepotPanel } from '@ui/panels/depot';
import { TradeSessionScreen } from '@ui/screens/trade_session';
import { MockCanvas, mockCanvasFactory } from '../../unit/render/canvas-mock';
import { cellRows, surface } from '../../unit/ui/ui-fixture';

const name = 'render/m7-trade-ui';
const file = fileURLToPath(new URL('./m7-trade-ui.json', import.meta.url));
const update = process.env['DEEPHOLM_GOLDEN_UPDATE'] === name || process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';
const names = ['civilizations', 'depot', 'trade_session'] as const;
type Name = typeof names[number];
interface Golden { text: string[]; cells: string[][] }
let golden: Record<string, Golden> = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { panels: Record<string, Golden> }).panels : {};
let game: Game;
let tradeScreen: TradeSessionScreen;

function render(which: Name): Golden {
  const s = surface(which === 'trade_session' ? 80 : 36, which === 'trade_session' ? 28 : 24);
  if (which === 'civilizations') drawCivilizationsPanel(s, { col: 0, row: 0, cols: 36, rows: 24 }, game.fortress.civilizations, game.fortress.ctx, () => {});
  else if (which === 'depot') drawDepotPanel(s, { col: 0, row: 0, cols: 36, rows: 24 }, game.fortress.depot, game.fortress.ctx, () => {});
  else tradeScreen.draw(s);
  return { text: s.lines(), cells: cellRows(s) };
}

describe('T-M7-03 golden trade panels and modal', () => {
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
    if (!dwarf || !world.services.movement?.teleport(dwarf, tile)) throw new Error('golden hauler fixture failed');
    game.host.submit({ type: 'MoveToDepot', depotId: depot, itemIds: [meal] });
    const trade = game.host.readers.of<TradeReader>('20');
    for (let n = 0; n < 100 && !trade.depotItems().includes(meal); n += 1) game.host.step(1);
    if (!trade.depotItems().includes(meal)) throw new Error('golden depot haul failed');
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
    if (update) {
      const next: Record<string, Golden> = {};
      for (const which of names) next[which] = render(which);
      writeFileSync(file, `${JSON.stringify({ $note: 'npm run golden:update -- render/m7-trade-ui', panels: next }, null, 2)}\n`, 'utf8');
      golden = next;
    }
  });

  for (const which of names) it(`${which} matches its cell buffer`, () => {
    expect(golden[which]).toBeDefined();
    expect(render(which)).toEqual(golden[which]);
  });
});
