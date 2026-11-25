/**
 * T-680: `z` opens a menu of the kinds of zone to make and the list of zones; a kind places a zone,
 * whose settings then show in the menu's place, where the kinds are no keys (so `b` opens Build at
 * once); `Esc` goes back to the menu; a click on a stockpile opens its settings
 * (`ui-screens/panels.md` § Zones).
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

function drag(g: Game, from: [number, number], to: [number, number]): void {
  g.pointerDown(cell(g, from[0], from[1]));
  g.pointerMove(cell(g, to[0], to[1]));
  g.pointerUp(cell(g, to[0], to[1]));
}

function clickAt(g: Game, at: [number, number]): void {
  g.pointerDown(cell(g, at[0], at[1]));
  g.pointerUp(cell(g, at[0], at[1]));
}

/** The map cell of the top-left of a `w` × `h` rectangle of tiles that may all join a new zone of `type`. */
function rectFor(g: Game, type: string, w: number, h: number, skip = 0): [number, number] {
  const map = g.host.readers.map;
  const z = g.ui.z;
  let found = 0;
  for (let y = g.ui.camY + 2; y < g.ui.camY + 40; y += 1) {
    for (let x = g.ui.camX + 2; x < g.ui.camX + 40; x += 1) {
      let ok = true;
      for (let dy = 0; dy < h && ok; dy += 1) for (let dx = 0; dx < w && ok; dx += 1) ok = g.fortress.zones.tileOk(g.fortress.ctx, type, map.index(x + dx, y + dy, z));
      if (ok && found++ === skip) return [x - g.ui.camX, y - g.ui.camY];
    }
  }
  throw new Error(`no ${w}x${h} rectangle for ${type}`);
}

function text(g: Game): string {
  g.render();
  return g.textRows().join('\n');
}

describe('T-680 the Zones menu', () => {
  it('z then a kind places a zone; its settings show, b opens Build, and Esc goes back to the menu, then closes', async () => {
    const g = await paused('t680-place');
    const zones = (): number[] => g.host.readers.of<BuildingsReader>('14').zonesOfType('stockpile');
    g.handleKey(press('z'));
    expect(g.ui.panel).toBe('zones');
    let shown = text(g);
    expect(shown).toContain('[s] Stockpile');
    expect(shown).toContain('Zones (0)');
    expect(shown).toContain('No zones yet.');
    g.handleKey(press('s'));
    expect(g.fortress.zones.kind).toBe('stockpile');
    const at = rectFor(g, 'stockpile', 3, 2);
    drag(g, at, [at[0] + 2, at[1] + 1]);
    expect(zones()).toHaveLength(1);
    expect(g.fortress.zones.selected).toBe(zones()[0]);
    shown = text(g);
    expect(shown).toContain('[y] zones menu');
    expect(shown).toContain('─── Stockpile #1 · ');
    expect(shown).not.toContain('[s] Stockpile');
    // The settings are not the menu: `Esc` goes back to it, and `Esc` again closes Zones.
    g.handleKey(press('Esc'));
    expect(g.ui.panel).toBe('zones');
    expect(g.fortress.zones.selected).toBe(0);
    expect(g.fortress.zones.chosen).toBe(false);
    shown = text(g);
    expect(shown).toContain('[s] Stockpile');
    expect(shown).toMatch(/Stockpile #1 +6 t/);
    g.handleKey(press('Esc'));
    expect(g.ui.panel).toBeNull();
  });

  it('over a just-made zone\'s settings the kinds are no keys: b opens Build at once, d Designate', async () => {
    const g = await paused('t680-build');
    g.handleKey(press('z'));
    g.handleKey(press('s'));
    const at = rectFor(g, 'stockpile', 2, 2);
    drag(g, at, [at[0] + 1, at[1] + 1]);
    expect(g.fortress.zones.selected).toBeGreaterThan(0);
    g.handleKey(press('b'));
    expect(g.ui.panel).toBe('build');
    g.handleKey(press('z'));
    expect(g.fortress.zones.selected, 'z opens the menu, not the last zone').toBe(0);
    g.handleKey(press('b'));
    expect(g.ui.panel, 'in the menu b is Bedroom').toBe('zones');
    expect(g.fortress.zones.kind).toBe('bedroom');
  });

  it('a click on a stockpile tile opens its settings; Esc closes them; z over them goes to the menu', async () => {
    const g = await paused('t680-click');
    const at = rectFor(g, 'stockpile', 2, 2);
    const map = g.host.readers.map;
    const tiles = [0, 1].flatMap((dy) => [0, 1].map((dx) => map.index(g.ui.camX + at[0] + dx, g.ui.camY + at[1] + dy, g.ui.z)));
    g.host.submit({ type: 'CreateZone', zoneType: 'stockpile', tiles });
    const pile = g.host.readers.of<BuildingsReader>('14').zoneAt(tiles[0] as number);
    expect(pile).toBeGreaterThan(0);
    clickAt(g, at);
    expect(g.ui.panel).toBe('zones');
    expect(g.fortress.zones.selected).toBe(pile);
    expect(text(g)).toContain('─── Stockpile #1 · ');
    g.handleKey(press('Esc'));
    expect(g.ui.panel, 'opened by a click, Esc closes').toBeNull();
    clickAt(g, at);
    g.handleKey(press('z'));
    expect(g.ui.panel).toBe('zones');
    expect(g.fortress.zones.selected).toBe(0);
    g.handleKey(press('z'));
    expect(g.ui.panel, 'z over the menu closes Zones').toBeNull();
  });

  it('Tab and Enter, or a click on a row, open a zone of the menu\'s list', async () => {
    const g = await paused('t680-list');
    g.handleKey(press('z'));
    g.handleKey(press('s'));
    const a = rectFor(g, 'stockpile', 2, 2);
    drag(g, a, [a[0] + 1, a[1] + 1]);
    g.handleKey(press('Esc'));
    g.handleKey(press('f'));
    const b = rectFor(g, 'farm_plot', 2, 2);
    drag(g, b, [b[0] + 1, b[1] + 1]);
    g.handleKey(press('Esc'));
    const reader = g.host.readers.of<BuildingsReader>('14');
    const [pile] = reader.zonesOfType('stockpile');
    const [plot] = reader.zonesOfType('farm_plot');
    expect(g.fortress.zones.selected).toBe(0);
    g.handleKey(press('Tab'));
    g.handleKey(press('Tab'));
    expect(g.ui.sidebar, 'Tab moves through the list, not the sidebar').toBe(true);
    g.handleKey(press('Enter'));
    expect(g.fortress.zones.selected).toBe(plot);
    expect(text(g)).toContain('─── Farm plot #1 · ');
    g.handleKey(press('Esc'));
    const rows = g.textRows();
    g.render();
    const row = g.textRows().findIndex((line) => line.includes('Stockpile #1 '));
    expect(row, rows.join('\n')).toBeGreaterThan(0);
    const col = (g.textRows()[row] as string).indexOf('Stockpile #1');
    g.pointerDown(cell(g, col, row));
    g.pointerUp(cell(g, col, row));
    expect(g.fortress.zones.selected).toBe(pile);
  });
});
