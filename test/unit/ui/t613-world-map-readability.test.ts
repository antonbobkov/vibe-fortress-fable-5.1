/**
 * T-613: the world map's cursor has its own colours on every biome and blinks with the designation
 * blink (steady with Reduced motion); Temper has a line saying what it is; the salt a site lacks is
 * "sea salt", apart from rock salt; the filter counts the sites where one can embark; and About is
 * hidden until it has a screen (`ui-screens/menus-and-world.md` § World map, § Main menu).
 */

import { describe, expect, it, vi } from 'vitest';
import { WORLD_SIZE_SMALL } from '@core/constants';
import type { Cell } from '@render/cellbuffer';
import { WorldMapCompositor } from '@render/world-map';
import { generate, type WorldMap } from '@systems/worldgen';
import { MainMenuScreen } from '@ui/screens/main_menu';
import { WorldMapScreen, type WorldMapHost } from '@ui/screens/world_map';
import { keymap, palette, press, registry, strings, surface } from './ui-fixture';

const compositor = new WorldMapCompositor(registry, palette);
const world: WorldMap = generate('t613', WORLD_SIZE_SMALL, registry);

function mapScreen(animation?: WorldMapHost['animation']): WorldMapScreen {
  return new WorldMapScreen(world, { embark: vi.fn(), back: vi.fn(), ...(animation === undefined ? {} : { animation }) }, keymap, strings, compositor, registry);
}

/** The cursor's cell after a draw, with the cursor on the first region of `biome`. */
function cursorOn(screen: WorldMapScreen, biome: string): { cell: Cell; plain: Cell } {
  const region = world.regions.find((r) => r.biome === biome && r.river === null && !Object.values(world.civHomes).includes(r.id));
  if (region === undefined) throw new Error(`no ${biome} region`);
  screen.cursor = { x: region.id % world.size, y: Math.floor(region.id / world.size) };
  const s = surface(80, 45);
  screen.draw(s);
  return { cell: s.cells.get(screen.cursor.x - screen.camX, screen.cursor.y - screen.camY), plain: compositor.regionCell(world, region.id) };
}

describe('T-613 the world map shows where the cursor is and what its words mean', () => {
  it('draws the cursor in colours of its own on a forest and on a glacier, unlike any biome', () => {
    const biomes = registry.table<{ id: string }>('biomes').ids().map((id) => compositor.biomeCell(id));
    for (const biome of ['dark_forest', 'glacier']) {
      const { cell, plain } = cursorOn(mapScreen(), biome);
      expect(cell.glyph, biome).toBe(plain.glyph);
      expect(cell.fg, biome).toBe(palette.color('black'));
      expect(cell.bg, biome).toBe(palette.color('world_cursor'));
      for (const b of biomes) {
        expect(cell.fg === b.fg && cell.bg === b.bg, biome).toBe(false);
        expect(cell.bg, biome).not.toBe(b.fg);
      }
    }
  });

  it('blinks with the designation blink, and stays with Reduced motion', () => {
    const at = (animFrame: number, reducedMotion: boolean): { cell: Cell; plain: Cell } =>
      cursorOn(mapScreen(() => ({ animFrame, reducedMotion })), 'dark_forest');
    const on = at(0, false);
    expect(on.cell.bg).toBe(palette.color('world_cursor'));
    const off = at(1, false);
    expect(off.cell).toEqual(off.plain);
    expect(at(1, true).cell.bg).toBe(palette.color('world_cursor'));
    expect(at(2, false).cell.bg).toBe(palette.color('world_cursor'));
  });

  it('puts a dim line under the Temper bar saying what Temper is', () => {
    const screen = mapScreen();
    cursorOn(screen, 'temperate_forest');
    const lines = screen.panelLines(34);
    const temper = lines.findIndex((l) => 'rating' in l && l.rating === 'ui.worldmap.temper');
    expect(temper).toBeGreaterThan(0);
    const next = lines.slice(temper + 1, temper + 3);
    expect(next.map((l) => ('text' in l ? l.text : '')).join(' ')).toBe("Temper is the climate's harshness: cold, storms and heat.");
    expect(next.every((l) => 'fg' in l && l.fg === 'dim')).toBe(true);
  });

  it('names the salt a site lacks "sea salt", apart from rock salt', () => {
    const screen = mapScreen();
    cursorOn(screen, 'temperate_forest');
    const text = screen.regionLines(200).join('\n');
    const lacks = text.split('\n').find((l) => l.startsWith('This site lacks:')) ?? '';
    expect(lacks).toMatch(/^This site lacks: sea salt\b/);
    expect(lacks).not.toMatch(/(lacks: |, )salt\b/);
  });

  it('counts the sites that match, never an ocean or a glacier', () => {
    const screen = mapScreen();
    const seas = world.regions.filter((r) => r.biome === 'ocean' || r.biome === 'glacier').length;
    expect(seas).toBeGreaterThan(0);
    expect(screen.matchCount()).toBe(world.regions.length - seas);
    screen.key(press('f'));
    const s = surface(80, 45);
    screen.draw(s);
    expect(s.lines().join('\n')).toContain(`${world.regions.length - seas} sites match`);
    // Excluding a biome that one cannot embark on changes nothing; excluding one that one can lowers the count.
    screen.filter.excludedBiomes = ['ocean'];
    expect(screen.matchCount()).toBe(world.regions.length - seas);
    screen.filter.excludedBiomes = ['temperate_forest'];
    expect(screen.matchCount()).toBe(world.regions.length - seas - world.regions.filter((r) => r.biome === 'temperate_forest').length);
  });

  it('hides About from the main menu until the app has its screen', () => {
    const host = (about: boolean) => ({
      newestSave: () => null, newWorld: vi.fn(), continueGame: vi.fn(), open: vi.fn(),
      available: (id: string) => id !== 'about' || about,
    });
    const without = new MainMenuScreen(host(false), keymap, strings);
    const s = surface(80, 30);
    without.draw(s);
    expect(s.lines().join('\n')).not.toContain('About');
    expect(s.lines().join('\n')).toContain('[i] Intro');
    expect(without.key(press('a'))).toBe(false);
    const withAbout = new MainMenuScreen(host(true), keymap, strings);
    const t = surface(80, 30);
    withAbout.draw(t);
    expect(t.lines().join('\n')).toContain('[a] About');
  });
});
