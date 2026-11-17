/**
 * T-441: designation by two points, a box that may span levels, and stair columns (24 § Input
 * model). The command stays 03's `Designate` (its tiles may lie on any level) and
 * `DesignateStairwell` per column.
 */

import { describe, expect, it, vi } from 'vitest';
import { loadContent } from '@content/loader';
import type { Command } from '@core/commands';
import { Designation } from '@core/map3d';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { Game } from '@app/game';
import { boxTiles } from '@ui/panels/designate';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press } from './ui-fixture';

const registry = loadContent();
const Z = FLAT_TEST_SURFACE_Z;

async function fortress(): Promise<{ game: Game; sent: Command[] }> {
  const game = new Game({ canvas: new MockCanvas(), seed: 't441', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
  await game.start();
  const sent: Command[] = [];
  const submit = game.host.submit.bind(game.host);
  vi.spyOn(game.host, 'submit').mockImplementation((cmd: Command) => { sent.push(cmd); return submit(cmd); });
  return { game, sent };
}

const key = (game: Game, k: string, shift = false): boolean => game.handleKey(press(k, { shift }));

function cell(game: Game, col: number, row: number): { x: number; y: number; button: number; shift: boolean; ctrl: boolean; alt: boolean; meta: boolean } {
  const c = game.cellCenter(col, row);
  return { x: c.x, y: c.y, button: 0, shift: false, ctrl: false, alt: false, meta: false };
}

function click(game: Game, col: number, row: number): void {
  game.pointerDown(cell(game, col, row));
  game.pointerUp(cell(game, col, row));
}

describe('T-441 two-click designation in 3D', () => {
  it('two presses of Enter with a level change between issue one Designate over every level of the box', async () => {
    const { game, sent } = await fortress();
    key(game, 'd');
    key(game, '<');
    const map = game.host.readers.map;
    const c = game.ui.cursor as { x: number; y: number };
    key(game, 'Enter');
    expect(sent).toEqual([]);
    key(game, '<');
    key(game, '<');
    for (let k = 0; k < 2; k += 1) { key(game, '→'); key(game, '↓'); }
    expect(game.fortress.statusRow2()).toContain('Dig 3×3×3 levels (27 tiles), priority 5');
    key(game, 'Enter');
    const designate = sent.filter((cmd) => cmd.type === 'Designate');
    expect(designate).toHaveLength(1);
    const want = boxTiles(map, { x: c.x, y: c.y, z: Z - 1 }, { x: c.x + 2, y: c.y + 2, z: Z - 3 });
    expect(want).toHaveLength(27);
    expect(designate[0]?.['tiles']).toEqual(want);
    for (const t of want) expect(map.designationAt(t)).toBe(Designation.Dig);
    expect(game.fortress.tool.anchor).toBeNull();
  });

  it('two clicks with a level change between do the same by mouse; Esc after the first corner drops it', async () => {
    const { game, sent } = await fortress();
    key(game, 'd');
    key(game, '<');
    click(game, 10, 10);
    expect(game.fortress.tool.anchor).not.toBeNull();
    key(game, 'Esc');
    expect(game.fortress.tool.anchor).toBeNull();
    expect(game.fortress.tool.active).toBe(true);
    expect(sent).toEqual([]);
    click(game, 10, 10);
    key(game, '<');
    click(game, 11, 10);
    const designate = sent.filter((cmd) => cmd.type === 'Designate');
    expect(designate).toHaveLength(1);
    expect(designate[0]?.['tiles']).toHaveLength(4);
    const levels = new Set((designate[0]?.['tiles'] as number[]).map((t) => Math.floor(t / (game.host.readers.map.w * game.host.readers.map.h))));
    expect([...levels].sort()).toEqual([Z - 2, Z - 1]);
  });

  it('a drag on one level is still the box at once', async () => {
    const { game, sent } = await fortress();
    key(game, 'd');
    key(game, '<');
    game.pointerDown(cell(game, 10, 10));
    game.pointerMove(cell(game, 12, 11));
    game.pointerUp(cell(game, 12, 11));
    expect(sent.filter((cmd) => cmd.type === 'Designate')[0]?.['tiles']).toHaveLength(6);
  });

  it('the stairs tool over ten levels is one stair column: down stairs on top, up/down between, up stairs at the bottom (T-589: one Designate per kind)', async () => {
    const { game, sent } = await fortress();
    key(game, 'd');
    key(game, 'w');
    const c = game.ui.cursor as { x: number; y: number };
    key(game, 'Enter');
    for (let k = 0; k < 9; k += 1) key(game, '<');
    key(game, 'Enter');
    const map = game.host.readers.map;
    const middle: number[] = [];
    for (let z = Z - 1; z > Z - 9; z -= 1) middle.push(map.index(c.x, c.y, z));
    expect(sent.filter((cmd) => cmd.type === 'Designate')).toEqual([
      { type: 'Designate', tiles: [map.index(c.x, c.y, Z)], kind: 'stairs_down', priority: 5 },
      { type: 'Designate', tiles: middle, kind: 'stairs_updown', priority: 5 },
      { type: 'Designate', tiles: [map.index(c.x, c.y, Z - 9)], kind: 'stairs_up', priority: 5 },
    ]);
    expect(map.designationAt(map.index(c.x, c.y, Z))).toBe(Designation.StairsDown);
    for (let z = Z - 1; z > Z - 9; z -= 1) expect(map.designationAt(map.index(c.x, c.y, z))).toBe(Designation.StairsUpDown);
    expect(map.designationAt(map.index(c.x, c.y, Z - 9))).toBe(Designation.StairsUp);
  });

  it('a stairs box over several levels makes a column on each of its tiles; on one level a floor takes down stairs and the up stairs beneath', async () => {
    const { game, sent } = await fortress();
    key(game, 'd');
    key(game, 'w');
    const c = game.ui.cursor as { x: number; y: number };
    key(game, 'Enter');
    key(game, '→');
    key(game, '<');
    key(game, '<');
    key(game, 'Enter');
    const map = game.host.readers.map;
    const kinds = sent.filter((cmd) => cmd.type === 'Designate').map((cmd) => [cmd['kind'], (cmd['tiles'] as number[]).length]);
    expect(kinds).toEqual([['stairs_down', 2], ['stairs_updown', 2], ['stairs_up', 2]]);
    sent.length = 0;
    key(game, '>');
    key(game, '>');
    key(game, '→');
    key(game, 'Enter');
    expect(game.fortress.statusRow2()).toContain(`Stairs from z ${Z}: click again`);
    key(game, 'Enter');
    expect(sent).toEqual([
      { type: 'Designate', tiles: [map.index(c.x + 2, c.y, Z)], kind: 'stairs_down', priority: 5 },
      { type: 'Designate', tiles: [map.index(c.x + 2, c.y, Z - 1)], kind: 'stairs_up', priority: 5 },
    ]);
  });
});
