import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import type { ItemCore } from '@systems/items';
import { drawOrdersPanel } from '@ui/panels/orders';
import { drawStocksPanel } from '@ui/panels/stocks';
import { MockCanvas, mockCanvasFactory } from '../../unit/render/canvas-mock';
import { cellRows, surface } from '../../unit/ui/ui-fixture';

const name = 'render/m5-panels';
const file = fileURLToPath(new URL('./m5-panels.json', import.meta.url));
const update = process.env['DEEPHOLM_GOLDEN_UPDATE'] === name || process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';
interface PanelGolden { text: string[]; cells: string[][] }
let game: Game;
let golden: Record<string, PanelGolden> = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { panels: Record<string, PanelGolden> }).panels : {};

function render(which: 'stocks' | 'orders' | 'materials'): PanelGolden {
  const s = surface(36, 32);
  const rect = { col: 0, row: 0, cols: 36, rows: 32 };
  if (which === 'stocks') drawStocksPanel(s, rect, game.fortress.stocks, game.fortress.ctx);
  else {
    game.fortress.orders.materialOpen = which === 'materials';
    drawOrdersPanel(s, rect, game.fortress.orders, game.fortress.ctx);
  }
  return { text: s.lines(), cells: cellRows(s) };
}

describe('T-M5-08 golden: stocked items and global material filter', () => {
  beforeAll(async () => {
    game = new Game({ canvas: new MockCanvas(), seed: 'm5-panels', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const registry = game.host.headless.registry;
    const core = game.host.world.services.items as ItemCore;
    const tile = game.host.readers.map.index(40, 30, game.ui.z);
    core.create(registry.table('items').index('stone_block'), registry.table('materials').index('granite'), tile);
    core.create(registry.table('items').index('axe'), registry.table('materials').index('steel'), tile);
    game.host.submit({ type: 'AddWorkOrder', workshopId: 0, order: { recipeId: 'forge_battle_axe', mode: 'once', remaining: 1, threshold: 0, priority: 5 } });
    game.host.step(1);
    game.fortress.stocks.tree.expanded.add('stone');
    game.fortress.stocks.tree.expanded.add('stone/block');
    game.fortress.stocks.tree.expanded.add('tool');
    game.fortress.stocks.tree.expanded.add('tool/axe');
    if (update) {
      const panels = { stocks: render('stocks'), orders: render('orders'), materials: render('materials') };
      writeFileSync(file, `${JSON.stringify({ $note: 'npm run golden:update -- render/m5-panels', panels }, null, 2)}\n`, 'utf8');
      golden = panels;
    }
  });
  for (const panel of ['stocks', 'orders', 'materials'] as const) it(`${panel} matches its cell buffer`, () => {
    expect(golden[panel]).toBeDefined();
    expect(render(panel)).toEqual(golden[panel]);
  });
});
