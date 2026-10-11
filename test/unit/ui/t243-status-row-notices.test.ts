import { describe, it, expect } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { BuildTool, type StockOffer } from '@ui/panels/build';
import { fill } from '@ui/strings';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, strings, surface } from './ui-fixture';

const registry = loadContent();

async function fortressGame(): Promise<Game> {
  const game = new Game({
    canvas: new MockCanvas(),
    seed: 'fortress-ui',
    registry,
    createCanvas: mockCanvasFactory(),
    devicePixelRatio: 1,
    width: 1280,
    height: 800,
  });
  await game.start();
  return game;
}

function key(game: Game, k: string, mods: Partial<{ shift: boolean; ctrl: boolean }> = {}): boolean {
  return game.handleKey(press(k, mods));
}

function cell(game: Game, col: number, row: number, button = 0): { x: number; y: number; button: number; shift: boolean; ctrl: boolean; alt: boolean; meta: boolean } {
  const c = game.cellCenter(col, row);
  return { x: c.x, y: c.y, button, shift: false, ctrl: false, alt: false, meta: false };
}

describe('T-243 status row notices and counts', () => {
  it('a drag after a notice shows the drag readout', async () => {
    const game = await fortressGame();
    key(game, 'd');
    expect(game.fortress.tool.active).toBe(true);
    expect(game.fortress.tool.kind).toBe('dig');

    key(game, '<'); // z 31: soil/rock can be dug
    game.fortress.notice('No tile here can be dug: dig marks rock walls and boulders.');
    expect(game.fortress.statusRow2()).toBe('No tile here can be dug: dig marks rock walls and boulders.');

    // Starting a drag replaces the notice immediately with the drag readout.
    game.pointerDown(cell(game, 10, 5));
    game.pointerMove(cell(game, 13, 7));
    expect(game.fortress.statusRow2()).toBe(`Dig 4×3 (12 tiles), priority ${game.fortress.tool.priority}`);

    // After release, the old notice does not return.
    game.pointerUp(cell(game, 13, 7));
    expect(game.fortress.statusRow2()).not.toBe('No tile here can be dug: dig marks rock walls and boulders.');
  });

  it('a long notice ends with … and its tooltip has the full text', async () => {
    const game = await fortressGame();
    const longNotice = 'No tile here can be dug: dig marks rock walls and boulders. Make sure you select rock or veins.';
    game.fortress.notice(longNotice);

    const layout = game.compositor.layout;
    const s = surface(layout.cols, layout.rows);
    game.fortress.draw(s);

    const statusRow2Idx = layout.status.row + 1; // row 2 of status bar
    const tip = s.tooltipAt(0, statusRow2Idx);
    expect(tip).not.toBeNull();
    expect(tip?.text).toBe(longNotice);

    // The last cell of the status row has the ellipsis glyph
    const lastCell = s.cells.get(layout.cols - 1, statusRow2Idx);
    expect(lastCell.glyph).toBe(s.glyphs.index('…'));

    // textRows also includes the ellipsis in the last row (mapped to » in CP437 surface)
    game.render();
    const rows = game.textRows();
    expect(rows[rows.length - 1]).toMatch(/[…»]$/);
  });

  it('1 table: singular and plural forms for counts in stock and string templates', () => {
    const tool = new BuildTool();
    const offer: StockOffer = {
      match: 'table',
      have: 1,
      waiting: 4,
      itemId: 'table',
      recipeId: 'craft_table',
      workshops: "a carpenter's workshop",
    };
    const ctx: import('@ui/panels/context').PanelContext = {
      registry,
      readers: {} as unknown as import('@ui/panels/context').PanelContext['readers'],
      strings,
      notice: () => {},
      openPanel: () => {},
      submit: () => {},
      focusOn: () => {},
      look: () => {},
      shiftClick: () => false,
    };
    const text = tool.offerText(ctx, offer, 'o');
    expect(text.stock).toBe('1 table in stock: 4 will wait');

    // Plural placeholder formatting
    expect(fill('{n|table|tables} in stock', { n: 1 })).toBe('1 table in stock');
    expect(fill('{n|table|tables} in stock', { n: 4 })).toBe('4 tables in stock');
    expect(fill('{n|table|tables} in stock', { n: 0 })).toBe('0 tables in stock');
  });
});
