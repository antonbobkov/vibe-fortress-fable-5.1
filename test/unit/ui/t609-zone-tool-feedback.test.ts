/**
 * T-609: a zone drawn while paused answers at once (its made line and its inspector, before any
 * tick), a drag over a zone names "another zone" as the reason, and after a zone is made the tool
 * idles so its inspector takes the keys it names (`ui-screens/panels.md` § Zones).
 */
import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import type { BuildingsReader } from '@systems/buildings';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press } from './ui-fixture';

const registry = loadContent();

async function paused(seed: string): Promise<Game> {
  const g = new Game({ canvas: new MockCanvas(), seed, registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
  await g.start({ embark: 'default' });
  return g;
}

function cell(g: Game, col: number, row: number): { x: number; y: number; button: number; shift: boolean; ctrl: boolean; alt: boolean; meta: boolean } {
  const c = g.cellCenter(col, row);
  return { x: c.x, y: c.y, button: 0, shift: false, ctrl: false, alt: false, meta: false };
}

/** A drag on the map from one cell to another. */
function drag(g: Game, from: [number, number], to: [number, number]): void {
  g.pointerDown(cell(g, from[0], from[1]));
  g.pointerMove(cell(g, to[0], to[1]));
  g.pointerUp(cell(g, to[0], to[1]));
}

/** The top-left of a `w` × `h` rectangle of tiles that may all join a new zone of `type`, near the view. */
function rectFor(g: Game, type: string, w: number, h: number): { x: number; y: number } {
  const map = g.host.readers.map;
  const z = g.ui.z;
  for (let y = g.ui.camY + 2; y < g.ui.camY + 40; y += 1) {
    for (let x = g.ui.camX + 2; x < g.ui.camX + 40; x += 1) {
      let ok = true;
      for (let dy = 0; dy < h && ok; dy += 1) for (let dx = 0; dx < w && ok; dx += 1) ok = g.fortress.zones.tileOk(g.fortress.ctx, type, map.index(x + dx, y + dy, z));
      if (ok) return { x, y };
    }
  }
  throw new Error(`no ${w}x${h} rectangle for ${type}`);
}

describe('T-609 a zone answers at once, and its inspector has the keys it names', () => {
  it('a stockpile drawn while paused writes its made line and opens its inspector before any tick', async () => {
    const g = await paused('t609-paused');
    expect(g.host.speed()).toBe(0);
    const tick = g.host.readers.calendar.tick;
    g.handleKey(press('z'));
    g.handleKey(press('S', { shift: true }));
    drag(g, [10, 10], [13, 12]);
    expect(g.host.readers.calendar.tick).toBe(tick);
    const zones = g.host.readers.of<BuildingsReader>('14').zonesOfType('stockpile');
    expect(zones).toHaveLength(1);
    expect(g.fortress.zones.selected).toBe(zones[0]);
    expect(g.fortress.statusRow2()).toMatch(/^Stockpile #1 made: \d+ tiles?/);
    g.render();
    expect(g.textRows().join('\n')).toContain('Selected: Stockpile #1');
  });

  it('a second drag over the zone names another zone as the reason', async () => {
    const g = await paused('t609-again');
    g.handleKey(press('z'));
    g.handleKey(press('S', { shift: true }));
    const at = rectFor(g, 'stockpile', 5, 4);
    const from: [number, number] = [at.x - g.ui.camX, at.y - g.ui.camY];
    const to: [number, number] = [from[0] + 4, from[1] + 3];
    drag(g, from, to);
    expect(g.fortress.statusRow2()).toBe('Stockpile #1 made: 20 tiles.');
    drag(g, from, to);
    expect(g.fortress.statusRow2()).toBe('Stockpile: none of the 20 tiles qualify (20 belong to another zone).');
    expect(g.host.readers.of<BuildingsReader>('14').zonesOfType('stockpile')).toHaveLength(1);
  });

  it('after a farm plot is made, Enter opens the season\'s crop list and does not start a rectangle', async () => {
    const g = await paused('t609-farm');
    g.handleKey(press('z'));
    g.handleKey(press('F', { shift: true }));
    expect(g.fortress.zones.kind).toBe('farm_plot');
    const at = rectFor(g, 'farm_plot', 3, 2);
    g.ui.cursor = { x: at.x, y: at.y };
    g.handleKey(press('Enter'));
    g.ui.cursor = { x: at.x + 2, y: at.y + 1 };
    g.handleKey(press('Enter'));
    const plot = g.host.readers.of<BuildingsReader>('14').zonesOfType('farm_plot')[0];
    expect(plot).toBeDefined();
    expect(g.fortress.zones.selected).toBe(plot);
    expect(g.fortress.zones.kind).toBe('farm_plot');
    const season = g.host.readers.calendar.season;
    g.handleKey(press('Enter'));
    expect(g.fortress.zones.farmMenus[season]?.open).toBe(true);
    expect(g.fortress.zones.anchor).toBeNull();
    expect(g.fortress.statusRow2()).not.toMatch(/Farm plot \d+x\d+/);
    // The arrows move the season highlight, not the map cursor.
    g.handleKey(press('Esc'));
    expect(g.fortress.zones.farmMenus[season]?.open).toBe(false);
    const cursor = { ...g.ui.cursor };
    g.handleKey(press('↓'));
    expect(g.ui.cursor).toEqual(cursor);
    expect(g.fortress.zones.farmRow(g.fortress.ctx)).toBe(Math.min(3, season + 1));
    // T-680: Esc goes back to the menu, where the type key arms the tool again: Enter sets a corner.
    g.handleKey(press('Esc'));
    expect(g.fortress.zones.selected).toBe(0);
    g.handleKey(press('f'));
    g.handleKey(press('Enter'));
    expect(g.fortress.zones.anchor).not.toBeNull();
  });

  it('a drag on the map with the tool idle starts the next zone at once', async () => {
    const g = await paused('t609-next');
    g.handleKey(press('z'));
    g.handleKey(press('S', { shift: true }));
    const at = rectFor(g, 'stockpile', 5, 2);
    const col = at.x - g.ui.camX;
    const row = at.y - g.ui.camY;
    drag(g, [col, row], [col + 1, row + 1]);
    drag(g, [col + 3, row], [col + 4, row + 1]);
    const stockpiles = g.host.readers.of<BuildingsReader>('14').zonesOfType('stockpile');
    expect(stockpiles).toHaveLength(2);
    expect(g.fortress.zones.selected).toBe(stockpiles[1]);
    expect(g.fortress.statusRow2()).toBe('Stockpile #2 made: 4 tiles.');
    // Esc drops the idle tool and goes back to the menu (T-680); the next Esc closes the panel.
    g.handleKey(press('Esc'));
    expect(g.fortress.zones.kind).toBeNull();
    expect(g.fortress.zones.selected).toBe(0);
    expect(g.ui.panel).toBe('zones');
    g.handleKey(press('Esc'));
    expect(g.ui.panel).toBeNull();
  });

  it('the made line gives way when a building is picked next, as a new ghost state', async () => {
    const g = await paused('t609-then-build');
    g.handleKey(press('z'));
    g.handleKey(press('S', { shift: true }));
    const at = rectFor(g, 'stockpile', 2, 2);
    g.ui.cursor = { x: at.x, y: at.y };
    g.handleKey(press('Enter'));
    g.ui.cursor = { x: at.x + 1, y: at.y + 1 };
    g.handleKey(press('Enter'));
    expect(g.fortress.statusRow2()).toBe('Stockpile #1 made: 4 tiles.');
    // D-253: in Zones `b` is the bedroom; Esc, then `b`, opens Build.
    for (let k = 0; k < 3 && g.ui.panel !== null; k += 1) g.handleKey(press('Esc'));
    g.handleKey(press('b'));
    g.handleKey(press('w'));
    g.handleKey(press('Enter'));
    expect(g.fortress.build.active).toBe(true);
    expect(g.fortress.statusRow2()).not.toContain('made:');
    expect(g.fortress.statusRow2().toLowerCase()).toContain(g.fortress.build.name(g.fortress.ctx).toLowerCase());
  });
});
