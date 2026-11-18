import { describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { InProcessHost } from '@app/sim-host';
import { FLAT_TEST_SURFACE_Z as z } from '@app/headless';
import { TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import type { TerrainReader } from '@systems/terrain';
import { stockpileName, waitingFor } from '@ui/messages';
import { tileSummary } from '@ui/panels/look';
import { drawMoodPanel, MoodPanel, thoughtText } from '@ui/panels/mood';
import { TestWorld } from '../../scenarios/test-world';
import { ZoneTool, drawZonesPanel } from '@ui/panels/zones';
import type { PanelContext } from '@ui/panels/context';
import { statusRight } from '@ui/status';
import { fgOfText, hexOf, keymap, strings, surface } from './ui-fixture';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';

async function game(seed: string): Promise<Game> {
  const g = new Game({ canvas: new MockCanvas(), seed, registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
  await g.start({ embark: 'default' });
  return g;
}

describe('T-605 a new player\'s first hour', () => {
  it('the Mood panel shows the hall spirit and each thought as a whole number', async () => {
    expect(thoughtText({ value: 3.77916666, text: 'Had a chat.' })).toBe('+4 Had a chat.');
    expect(thoughtText({ value: -10.4, text: 'I have nothing to do.' })).toBe('-10 I have nothing to do.');
    expect(thoughtText({ value: 0.3, text: 'I am thirsty.' })).toBe('0 I am thirsty.');
    const g = await game('t605-mood');
    g.host.step(2400);
    const s = surface(36, 20);
    drawMoodPanel(s, { col: 0, row: 0, cols: 36, rows: 20 }, new MoodPanel(), g.fortress.ctx);
    const lines = s.lines();
    expect(lines[0]).toMatch(/Hall spirit ♥ \w+ \(\d+\)/);
    for (const line of lines) expect(line).not.toMatch(/[+-]?\d+\.\d/);
  });

  it('an input with alternatives is waited for by name, with every alternative counted', async () => {
    const g = await game('t605-waiting');
    const waiting = waitingFor(g.fortress.ctx, 'waiting for fiber|straw|reed');
    expect(waiting?.item).toBe('fiber or straw or reed');
    expect(waiting?.item).not.toContain('|');
    expect(waitingFor(g.fortress.ctx, 'waiting for raw_stone')?.item).toBe('stone');
  });

  it('a tree, sapling or shrub tile names its species, never the content id', () => {
    const w = new TestWorld({ seed: 't605-plants', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const materials = w.game.registry.table('materials');
    const terrain = w.readers.of<TerrainReader>('03');
    const cases: readonly [TileKind, string, string][] = [
      [TileKind.Shrub, 'wild_nettle', 'Wild nettle shrub'],
      [TileKind.Shrub, 'rock_lichen', 'Rock lichen shrub'],
      [TileKind.Tree, 'oak', 'Oak tree'],
    ];
    cases.forEach(([kind, species, summary], k) => {
      const tile = w.readers.map.index(20 + k, 20, z);
      w.game.world.services.terrain.setKind(tile, kind, materials.index(species));
      expect(terrain.inspect(tile).material).not.toContain('_');
      expect(tileSummary(w.readers, strings, tile)).toBe(summary);
    });
  });

  it('status row 1 shortens [?] help to [?] rather than cut a word', () => {
    const wide = statusRight(strings, 50, 80);
    expect(wide.text).toBe('[Esc] menu  [?] help ');
    const narrow = statusRight(strings, 60, 80);
    expect(narrow.menu).toBe('[Esc]');
    expect(narrow.help).toBe('[?] help');
    const narrower = statusRight(strings, 64, 80);
    expect(narrower.menu).toBe('[Esc]');
    expect(narrower.help).toBe('[?]');
    expect(64 + 1 + Array.from(narrower.text).length).toBeLessThanOrEqual(80);
  });

  it('a new stockpile says it takes nothing until a preset is chosen', async () => {
    const h = new InProcessHost(() => 0);
    await h.newGame({ seed: 't605-stockpile', embark: 'none' });
    const tile = h.world.map.index(30, 30, z);
    h.submit({ type: 'CreateZone', zoneType: 'stockpile', tiles: [tile, tile + 1] });
    const zoneId = h.readers.of<BuildingsReader>('14').zoneAt(tile);
    const tool = new ZoneTool();
    tool.selected = zoneId;
    const ctx: PanelContext = { readers: h.readers, registry: h.headless.registry, strings, panelLetters: keymap.panelLetters(),
      submit: (cmd) => h.submit(cmd), focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false, notice: () => {} };
    const draw = () => {
      const s = surface(36, 40);
      drawZonesPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, tool, ctx);
      return s;
    };
    h.step(1);
    const s = draw();
    const lines = s.lines();
    expect(lines.join('\n')).toContain('Preset [Nothing');
    const warn = lines.findIndex((l) => l.includes('Takes nothing: choose a Preset.'));
    expect(warn).toBeGreaterThan(0);
    expect(fgOfText(s, warn, 'Takes nothing')).toBe(hexOf(s.theme.alert));
    expect(stockpileName({ readers: h.readers, strings }, zoneId)).toMatch(/\(Nothing\)$/);
    h.submit({ type: 'SetStockpileFilter', zoneId, filter: 'wood' });
    const after = draw().lines().join('\n');
    expect(after).toContain('Preset [Wood');
    expect(after).not.toContain('Takes nothing');
  });

  it('the map view stays inside the map when the sidebar shuts', async () => {
    const g = await game('t605-camera');
    const map = g.host.readers.map;
    g.fortress.openPanel('units');
    g.ui.camX = map.w;
    g.render();
    const open = g.ui.camX;
    expect(open).toBe(map.w - g.compositor.layout.map.cols);
    g.fortress.openPanel(null);
    g.render();
    expect(g.ui.camX).toBe(map.w - g.compositor.layout.map.cols);
    expect(g.ui.camX).toBeLessThan(open);
    expect(g.ui.camX + g.compositor.layout.map.cols).toBe(map.w);
    // Opened again with the camera unmoved, the view is back where it was.
    g.fortress.openPanel('units');
    g.render();
    expect(g.ui.camX).toBe(open);
    // A pan while the sidebar is shut keeps the player's camera.
    g.fortress.openPanel(null);
    g.render();
    g.pan(-3, 0);
    const panned = g.ui.camX;
    g.fortress.openPanel('units');
    g.render();
    expect(g.ui.camX).toBe(panned);
  });
});
