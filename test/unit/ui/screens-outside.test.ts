/**
 * T-M1-12 screens outside the fortress: the main menu, world generation and the world map
 * (`ui-screens/menus-and-world.md`, 24 § Screens outside the fortress, `01` § Player-facing
 * behavior), and the world-map compositor.
 */

import { describe, it, expect, vi } from 'vitest';
import { WORLD_SIZE_SMALL } from '@core/constants';
import { WorldMapCompositor } from '@render/world-map';
import { generate, type WorldMap } from '@systems/worldgen';
import { MainMenuScreen, type MainMenuHost } from '@ui/screens/main_menu';
import { WorldGenScreen, worldStats } from '@ui/screens/world_gen';
import { WorldMapScreen, defaultFilter, regionFilterOf } from '@ui/screens/world_map';
import { keymap, palette, press, registry, strings, surface } from './ui-fixture';

const compositor = new WorldMapCompositor(registry, palette);
const world: WorldMap = generate('ui-test', WORLD_SIZE_SMALL, registry);

function menuHost(save: string | null): MainMenuHost & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    newestSave: () => save,
    newWorld: () => calls.push('new'),
    continueGame: () => calls.push('continue'),
    available: () => false,
    open: (id) => calls.push(`open:${id}`),
  };
}

describe('T-M1-12 main menu', () => {
  it('hides Continue when there is no save', () => {
    const screen = new MainMenuScreen(menuHost(null), keymap, strings);
    const s = surface(80, 30);
    screen.draw(s);
    const text = s.lines().join('\n');
    expect(text).toContain('D E E P H O L M');
    expect(text).toContain('[n] New world');
    expect(text).not.toContain('Continue');
    expect(screen.key(press('c'))).toBe(false);
  });

  it('shows Continue with the newest save and runs it', () => {
    const host = menuHost('Emberhall · Year 2');
    const screen = new MainMenuScreen(host, keymap, strings);
    const s = surface(80, 30);
    screen.draw(s);
    expect(s.lines().join('\n')).toContain('[c] Continue   (Emberhall · Year 2)');
    screen.key(press('c'));
    expect(host.calls).toEqual(['continue']);
  });

  it('moves the selection with the arrows over the entries it can open, activates with Enter, and clicks', () => {
    const host = menuHost('Emberhall · Year 2');
    const screen = new MainMenuScreen(host, keymap, strings);
    screen.key(press('↓'));
    expect(screen.selected).toBe('continue');
    screen.key(press('↓'));
    expect(screen.selected).toBe('new_world');
    screen.key(press('Enter'));
    expect(host.calls).toEqual(['new']);
    // Entries whose screens do not exist yet do nothing.
    screen.key(press('l'));
    expect(host.calls).toEqual(['new']);
    const s = surface(80, 30);
    screen.draw(s);
    const row = s.lines().findIndex((l) => l.includes('[n] New world'));
    const col = (s.lines()[row] as string).indexOf('[n]');
    screen.pointerDown({ col, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    expect(host.calls).toEqual(['new', 'new']);
  });
});

describe('T-M1-12 world generation screen', () => {
  function screenWith(): { screen: WorldGenScreen; generated: { seed: string; size: number }[]; continued: WorldMap[]; back: number[] } {
    const generated: { seed: string; size: number }[] = [];
    const continued: WorldMap[] = [];
    const back: number[] = [];
    const screen = new WorldGenScreen(
      {
        randomSeed: () => 'random-1',
        generate: (seed, size, onProgress) => {
          generated.push({ seed, size });
          const w = generate(seed, WORLD_SIZE_SMALL, registry, { onProgress: (stage, pct) => onProgress(stage, pct) });
          return w;
        },
        back: () => back.push(1),
        continueTo: (w) => continued.push(w),
      },
      keymap,
      strings,
      compositor,
    );
    return { screen, generated, continued, back };
  }

  it('starts with a random seed in the focused field; typing replaces it through Backspace', () => {
    const { screen } = screenWith();
    expect(screen.seed.value).toBe('random-1');
    expect(screen.seed.focused).toBe(true);
    for (let k = 0; k < 20; k += 1) screen.key(press('Backspace'));
    for (const ch of 'e2e-1') screen.key(press(ch));
    expect(screen.seed.value).toBe('e2e-1');
    // A letter that is also an accelerator types while the field has focus.
    screen.key(press('g'));
    expect(screen.seed.value).toBe('e2e-1g');
  });

  it('generates with the seed and size, shows the stage and the figures, and continues with Enter', () => {
    const { screen, generated, continued } = screenWith();
    screen.key(press('Enter'));
    expect(screen.focus).toBe('size');
    screen.key(press('←'));
    expect(screen.size).toBe(WORLD_SIZE_SMALL);
    screen.key(press('g'));
    expect(generated).toEqual([{ seed: 'random-1', size: WORLD_SIZE_SMALL }]);
    expect(screen.stage).toBe('names');
    expect(screen.stagePct).toBe(100);
    const s = surface(100, 40);
    screen.draw(s);
    const text = s.lines().join('\n');
    expect(text).toContain('Stage: names');
    expect(text).toContain('Land ');
    expect(text).toContain('[Enter] Continue to the map');
    screen.key(press('Enter'));
    expect(continued).toHaveLength(1);
  });

  it('draws a new seed with r and goes back with Esc', () => {
    const { screen, back } = screenWith();
    screen.key(press('Tab'));
    screen.key(press('r'));
    expect(screen.seed.value).toBe('random-1');
    expect(screen.world).toBeNull();
    screen.key(press('Esc'));
    expect(back).toEqual([1]);
  });

  it('counts land, mountains, rivers and volcanoes', () => {
    const st = worldStats(world);
    expect(st.landPct).toBeGreaterThan(0);
    expect(st.landPct).toBeLessThanOrEqual(100);
    expect(st.rivers).toBe(world.rivers.length);
  });
});

describe('T-M1-12 world map screen', () => {
  function mapScreen(): { screen: WorldMapScreen; embarked: number[] } {
    const embarked: number[] = [];
    const screen = new WorldMapScreen(world, { embark: (_w, id) => embarked.push(id), back: vi.fn() }, keymap, strings, compositor, registry);
    return { screen, embarked };
  }

  it('moves the cursor with the arrows, by eight with Shift, inside the map', () => {
    const { screen } = mapScreen();
    const start = { ...screen.cursor };
    screen.key(press('→'));
    expect(screen.cursor).toEqual({ x: start.x + 1, y: start.y });
    screen.key(press('↓', { shift: true }));
    expect(screen.cursor.y).toBe(start.y + 8);
    for (let k = 0; k < 10; k += 1) screen.key(press('←', { shift: true }));
    expect(screen.cursor.x).toBe(0);
  });

  it('states the region in words, with the ratings, and says when a region cannot be embarked on', () => {
    const { screen, embarked } = mapScreen();
    const land = world.regions.find((r) => r.biome !== 'ocean' && r.biome !== 'glacier');
    const sea = world.regions.find((r) => r.biome === 'ocean');
    expect(land).toBeDefined();
    expect(sea).toBeDefined();
    screen.cursor = { x: land!.id % world.size, y: Math.floor(land!.id / world.size) };
    const s = surface(80, 45);
    screen.draw(s);
    const text = s.lines().join('\n');
    expect(text).toContain('Wealth');
    expect(text).toContain('Peril');
    expect(text).toContain('Temper');
    expect(text).toContain('[Enter] Embark here');
    screen.key(press('Enter'));
    expect(embarked).toEqual([land!.id]);

    screen.cursor = { x: sea!.id % world.size, y: Math.floor(sea!.id / world.size) };
    expect(screen.regionLines().join(' ')).toContain('No embark here');
    screen.key(press('Enter'));
    expect(embarked).toEqual([land!.id]);
  });

  it('draws the cursor inverted and the biome glyph of each region', () => {
    const { screen } = mapScreen();
    const s = surface(80, 45);
    screen.draw(s);
    const cell = s.cells.get(screen.cursor.x - screen.camX, screen.cursor.y - screen.camY);
    const plain = compositor.regionCell(world, screen.regionId);
    expect(cell).toEqual({ glyph: plain.glyph, fg: plain.bg, bg: plain.fg });
  });

  it('filters regions: the panel toggles rows, matching regions keep their color, the rest dim', () => {
    const { screen } = mapScreen();
    screen.key(press('f'));
    expect(screen.mode).toBe('filter');
    const all = screen.matchCount();
    expect(all).toBe(world.regions.length);
    // The first row is the first biome; Enter excludes it.
    screen.key(press('Enter'));
    expect(screen.filter.excludedBiomes).toHaveLength(1);
    expect(screen.matchCount()).toBeLessThan(all);
    const s = surface(80, 45);
    screen.draw(s);
    expect(s.lines().join('\n')).toContain('regions match');
    const f = regionFilterOf(screen.filter, ['a', 'b']);
    expect(f.biomes).toBeDefined();
    expect(regionFilterOf(defaultFilter(), ['a']).biomes).toBeUndefined();
    screen.key(press('Esc'));
    expect(screen.mode).toBe('region');
    screen.key(press('?', { shift: true }));
    expect(screen.mode).toBe('legend');
    screen.draw(s);
    expect(s.lines().join('\n')).toContain('Legend');
  });

  it('moves the cursor to a clicked region', () => {
    const { screen } = mapScreen();
    const s = surface(80, 45);
    screen.draw(s);
    screen.pointerDown({ col: 3, row: 4, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    expect(screen.cursor).toEqual({ x: screen.camX + 3, y: screen.camY + 4 });
  });
});

describe('T-M1-12 world-map compositor', () => {
  it('draws homes with their civilization glyph, rivers in blue, other regions by biome', () => {
    const home = world.civHomes.mountainhome;
    expect(compositor.regionCell(world, home).fg).toBe(palette.color('trader_mountainhome'));
    const river = world.regions.find((r) => r.river !== null && !Object.values(world.civHomes).includes(r.id));
    if (river !== undefined) expect(compositor.regionCell(world, river.id)).toEqual(compositor.riverCell());
    const plain = world.regions.find((r) => r.river === null && !Object.values(world.civHomes).includes(r.id));
    expect(compositor.regionCell(world, plain!.id)).toEqual(compositor.biomeCell(plain!.biome));
  });
});
