/**
 * U-08: Tooltips (D-U7, M8), ghost glyphs and palette distances (D-U10, M12).
 * Tagged: U-08
 */

import { describe, it, expect } from 'vitest';
import { loadContent } from '@content/loader';
import { TileKind } from '@core/map3d';
import { Game } from '@app/game';
import { drawTooltip, label, table, type ListState } from '@ui/widgets';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, surface, theme } from './ui-fixture';

const registry = loadContent();

async function fortressGame(): Promise<Game> {
  const game = new Game({
    canvas: new MockCanvas(),
    seed: 'tooltips-u08',
    registry,
    createCanvas: mockCanvasFactory(),
    devicePixelRatio: 1,
    width: 1280,
    height: 800,
  });
  await game.start({ embark: 'default' });
  return game;
}

function key(game: Game, k: string): boolean {
  return game.handleKey(press(k));
}

function cell(game: Game, col: number, row: number, mods: Partial<{ button: number; shift: boolean }> = {}) {
  const c = game.cellCenter(col, row);
  return { x: c.x, y: c.y, button: mods.button ?? 0, shift: mods.shift ?? false, ctrl: false, alt: false, meta: false };
}

describe('U-08 tooltips and truncated cell inspection (D-U7, M8)', () => {
  it('label registers a tooltip only when text exceeds width', () => {
    const s = surface(40, 10);
    label(s, 2, 2, 'Short', { width: 10 });
    expect(s.tooltips).toHaveLength(0);
    expect(s.tooltipAt(2, 2)).toBeNull();

    label(s, 5, 4, 'Very long dwarf name that exceeds the width', { width: 15 });
    expect(s.tooltips).toHaveLength(1);
    expect(s.tooltipAt(4, 4)).toBeNull();
    expect(s.tooltipAt(5, 4)).toEqual({
      rect: { col: 5, row: 4, cols: 15, rows: 1 },
      text: 'Very long dwarf name that exceeds the width',
    });
    expect(s.tooltipAt(19, 4)).toEqual({
      rect: { col: 5, row: 4, cols: 15, rows: 1 },
      text: 'Very long dwarf name that exceeds the width',
    });
    expect(s.tooltipAt(20, 4)).toBeNull();
  });

  it('table registers tooltips for truncated column cells', () => {
    const s = surface(36, 10);
    const state: ListState = { selected: 0, scroll: 0 };
    table(
      s,
      { col: 0, row: 0, cols: 36, rows: 5 },
      [
        { title: 'Name', width: 10 },
        { title: 'Job', width: 8 },
        { title: 'Status', width: 18 },
      ],
      [
        ['Thurid Darkstone', 'Miner', 'Digging deep veins'],
        ['Short', 'Smith', 'OK'],
      ],
      state,
    );

    // Row 1 (index 0): Name 'Thurid Darkstone' is 16 chars in width 10 (content width 9) -> truncated
    const nameTip = s.tooltipAt(2, 1);
    expect(nameTip).not.toBeNull();
    expect(nameTip?.text).toBe('Thurid Darkstone');

    // Row 1: Job 'Miner' (5 chars) fits in width 8 (content width 7) -> not truncated
    const jobTip = s.tooltipAt(12, 1);
    expect(jobTip).toBeNull();

    // Row 2 (index 1): 'Short' fits in width 10 -> not truncated
    const row2NameTip = s.tooltipAt(2, 2);
    expect(row2NameTip).toBeNull();
  });

  it('drawTooltip renders an overlay box with the full text', () => {
    const s = surface(40, 10);
    s.tooltip({ col: 10, row: 5, cols: 8, rows: 1 }, 'Full Tooltip Text');

    // Outside tooltip region -> no-op
    drawTooltip(s, { col: 2, row: 2 });
    expect(s.cells.get(10, 4).glyph).toBe(0);

    // Over tooltip region -> renders overlay box above
    drawTooltip(s, { col: 12, row: 5 });
    // Row 4 should have '[' at col 10, text, ']'
    expect(s.glyphs.char(s.cells.get(10, 4).glyph)).toBe('[');
    expect(s.glyphs.char(s.cells.get(11, 4).glyph)).toBe('F');
    expect(s.glyphs.char(s.cells.get(12, 4).glyph)).toBe('u');
    expect(s.glyphs.char(s.cells.get(28, 4).glyph)).toBe(']');
  });

  it('statusRow2 returns tooltip text when hovering over a truncated sidebar cell', async () => {
    const game = await fortressGame();
    key(game, 'u'); // Open units panel
    game.host.step(1);

    const s = surface(80, 25);
    game.fortress.draw(s);

    // Find any truncated cell in the surface's tooltips
    expect(s.tooltips.length).toBeGreaterThan(0);
    const tip = s.tooltips[0]!;

    // Hover over the truncated cell
    game.pointerMove(cell(game, tip.rect.col, tip.rect.row));
    // The row's tooltip also carries the profession, so it starts with the cell's full text.
    expect(game.fortress.statusRow2()).toContain(tip.text);
  });
});

describe('U-08 ghosts: validity glyph difference (D-U10)', () => {
  it('drawGhost draws ▒ for valid placement and x for blocked placement', async () => {
    const game = await fortressGame();
    key(game, 'b'); // Open build panel
    key(game, 'w'); // Select workshops category
    game.handleKey(press('c', { shift: true })); // U-03 (D-U2): `c` opens Civilizations; `[S-c]` is the build panel's category accelerator

    const map = game.host.readers.map;
    const z = game.ui.z;

    // Hover over an open floor -> valid placement
    const floorX = game.ui.camX + 15;
    const floorY = game.ui.camY + 15;
    // Set 3x3 to floor
    for (let dy = 0; dy < 3; dy += 1) {
      for (let dx = 0; dx < 3; dx += 1) {
        game.host.headless.world.services.terrain.setKind(map.index(floorX + dx, floorY + dy, z), TileKind.Floor, 1);
      }
    }

    game.pointerMove(cell(game, 15, 15));
    const validSurface = surface(80, 25);
    game.fortress.draw(validSurface);

    // Check center of the valid ghost tile: should have ▒ and ghostOk bg
    const validCenterCell = validSurface.cells.get(15, 15);
    expect(validSurface.glyphs.char(validCenterCell.glyph)).toBe('▒');
    expect(validCenterCell.bg).toBe(theme.ghostOk);

    // Now place a wall tile inside the footprint to make it blocked
    game.host.headless.world.services.terrain.setKind(map.index(floorX, floorY, z), TileKind.Wall, 1);

    game.pointerMove(cell(game, 15, 15));
    const blockedSurface = surface(80, 25);
    game.fortress.draw(blockedSurface);

    // Check the blocked tile: should have 'x' and ghostBad bg
    const blockedCell = blockedSurface.cells.get(15, 15);
    expect(blockedSurface.glyphs.char(blockedCell.glyph)).toBe('x');
    expect(blockedCell.bg).toBe(theme.ghostBad);
  });
});
