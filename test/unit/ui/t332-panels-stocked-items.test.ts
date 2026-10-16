/**
 * T-332: what the Stocks tree, an order that cannot be made, and the material filter say. They were
 * stored cell buffers (T-M5-08); each assertion now names what a row means. The fortress: seed
 * `m5-panels` with one granite block and one steel axe added, a battle-axe order with no forge, and
 * the stone, stone/block, tool and tool/axe branches of the Stocks tree open.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import type { ItemCore } from '@systems/items';
import { drawOrdersPanel } from '@ui/panels/orders';
import { drawStocksPanel } from '@ui/panels/stocks';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { surface } from './ui-fixture';

let game: Game;

function render(which: 'stocks' | 'orders' | 'materials'): string[] {
  const s = surface(36, 32);
  const rect = { col: 0, row: 0, cols: 36, rows: 32 };
  if (which === 'stocks') drawStocksPanel(s, rect, game.fortress.stocks, game.fortress.ctx);
  else {
    game.fortress.orders.materialOpen = which === 'materials';
    drawOrdersPanel(s, rect, game.fortress.orders, game.fortress.ctx);
  }
  return s.lines().map((line) => line.trimEnd().replace(/^ /, ''));
}

describe('T-332 panels: stocked items and global material filter', () => {
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
  });

  it('Stocks shows an opened branch under its category, one level deeper each time, with the count and the value of the added items', () => {
    const rows = render('stocks');
    const at = (text: string): number => rows.findIndex((row) => row.includes(text));
    const stone = at('stone ');
    expect(rows[stone]).toMatch(/^▼ stone +1 +3 ☼$/);
    expect(rows[stone + 1]).toMatch(/^ {2}▼ block +1 +3 ☼$/);
    expect(rows[stone + 2]).toMatch(/^ {4}► block +1 +3 ☼$/);
    const tool = rows.findIndex((row) => /^▼ tool /.test(row));
    expect(rows[tool]).toMatch(/^▼ tool +\d+ +\d+ ☼$/);
    expect(rows[tool + 1]).toMatch(/^ {2}► pick +\d+ +\d+ ☼$/);
    expect(rows[tool + 2]).toMatch(/^ {2}▼ axe +2 +440 ☼$/);
    expect(rows[tool + 3]).toMatch(/^ {4}► axe +2 +440 ☼$/);
    // The branches that stay shut keep the closed arrow and the next category follows them.
    expect(rows[stone - 1]).toMatch(/^► seed /);
    expect(rows[tool + 4]).toMatch(/^► textile /);
    expect(rows.find((row) => row.startsWith('Wealth'))).toBe('Wealth 2,014 ☼   (buildings 2 ☼)');
    expect(rows[30]).toBe('[S-f] forbid  [S-d] dump');
    expect(rows[31]).toBe('[S-m] melt  [S-t] to depot');
  });

  it('an order that cannot be made says which workshop is missing and how to build it', () => {
    const rows = render('orders');
    expect(rows[0]).toBe('[S-n] new order  all workshops');
    expect(rows[1]).toMatch(/^─+ Any workshop ─+$/);
    expect(rows[2]).toBe('x1 Battle axe · no forge');
    expect(rows.slice(19, 21).join(' ')).toBe('No forge is built: [b] build > Workshops.');
    expect(rows[21]).toBe('Count [-] 1 [+] [+/-] Shift ±10');
    expect(rows[22]).toBe('[S-m] once  [S-p] priority 5');
  });

  it('the material filter offers any material and any metal first, then every metal and fuel by name in order', () => {
    const rows = render('materials');
    expect(rows[0]).toBe('Material filter');
    expect(rows[1]).toBe('any material');
    expect(rows[2]).toBe('any metal');
    const named = rows.slice(3, 20);
    expect(named).toHaveLength(17);
    expect(named).toEqual([...named].sort((a, b) => a.localeCompare(b)));
    for (const material of ['bronze', 'copper', 'gold', 'iron', 'steel', 'tin']) expect(named).toContain(material);
    expect(rows[31]).toBe('[Enter] choose  [Esc] back');
  });
});
