/**
 * T-759: the world map's first screen shows its keys. The cursor starts on the region nearest the
 * centre where a fortress can embark (Chebyshev distance, ties to the lowest id); the region panel's
 * key rows show on every region, a move row above them, and off land the last row says so in
 * place of Embark (`ui-screens/menus-and-world.md` § World map).
 */

import { describe, expect, it, vi } from 'vitest';
import { SIDEBAR_COLS, WORLD_SIZE_SMALL } from '@core/constants';
import { WorldMapCompositor } from '@render/world-map';
import { generate, type WorldMap } from '@systems/worldgen';
import { WorldMapScreen } from '@ui/screens/world_map';
import type { Surface } from '@ui/surface';
import { keymap, palette, press, registry, strings, surface } from './ui-fixture';

const compositor = new WorldMapCompositor(registry, palette);
const base: WorldMap = generate('t759', WORLD_SIZE_SMALL, registry);
const size = base.size;
const mid = Math.floor(size / 2);
const id = (x: number, y: number): number => y * size + x;

/**
 * The world as an ocean but for three forest regions: two at distance 2 from the centre (the
 * lower id first) and one at distance 5.
 */
const near = id(mid + 2, mid + 1);
const nearTie = id(mid - 2, mid + 2);
const far = id(mid + 5, mid);
const world: WorldMap = {
  ...base,
  regions: base.regions.map((r) => ({ ...r, biome: [near, nearTie, far].includes(r.id) ? 'temperate_forest' : 'ocean' })),
};

const MOVE = strings.get('ui.worldmap.move');
const FILTER = '[f] filter  [?] legend';
const EMBARK = '[Enter] Embark here';
const NO_EMBARK = strings.get('ui.worldmap.no_embark_move');

function mapScreen(w: WorldMap = world): WorldMapScreen {
  return new WorldMapScreen(w, { embark: vi.fn(), back: vi.fn() }, keymap, strings, compositor, registry);
}

/** The region panel's first column: right of the map and its rule. */
const panelCol = (s: Surface): number => s.cols - Math.min(SIDEBAR_COLS, s.cols - 20);

/** The panel's rows, trimmed. */
function panelRows(screen: WorldMapScreen, s: Surface): string[] {
  screen.draw(s);
  return s.lines().map((l) => Array.from(l).slice(panelCol(s)).join('').trim());
}

describe('T-759 the world map shows its keys', () => {
  it('starts on the embarkable region nearest the centre, ties to the lowest id, not on the centre', () => {
    expect(world.regions[id(mid, mid)]?.biome).toBe('ocean');
    const screen = mapScreen();
    expect(screen.regionId).toBe(near);
    expect(screen.embarkable(screen.region())).toBe(true);
  });

  it('on land the panel ends with the move row, the filter row and Embark', () => {
    const screen = mapScreen();
    const rows = panelRows(screen, surface(96, 60));
    const n = rows.length;
    expect(rows[n - 3]).toBe(MOVE);
    expect(rows[n - 2]).toBe(FILTER);
    expect(rows[n - 1]).toBe(EMBARK);
  });

  it('on the ocean the panel keeps the move and filter rows, and the last says, dim, to move to land', () => {
    const screen = mapScreen();
    screen.key(press('←'));
    expect(screen.embarkable(screen.region())).toBe(false);
    const s = surface(96, 60);
    const rows = panelRows(screen, s);
    const n = rows.length;
    expect(rows[n - 3]).toBe(MOVE);
    expect(rows[n - 2]).toBe(FILTER);
    expect(rows[n - 1]).toBe(NO_EMBARK);
    expect(rows.join('\n')).not.toContain(EMBARK);
    expect(s.cells.get(panelCol(s) + 1, n - 1).fg).toBe(s.theme.dim);
    // `f` still opens the filter off land.
    screen.key(press('f'));
    expect(screen.mode).toBe('filter');
  });

  it('Shift + an arrow moves the cursor eight regions', () => {
    const screen = mapScreen();
    const start = { ...screen.cursor };
    screen.key(press('←', { shift: true }));
    expect(screen.cursor).toEqual({ x: start.x - 8, y: start.y });
    screen.key(press('↑', { shift: true }));
    expect(screen.cursor).toEqual({ x: start.x - 8, y: start.y - 8 });
  });

  it('in a panel too short for its text the move row gives way first; the filter and Embark rows stay', () => {
    const screen = mapScreen(base);
    const land = base.regions.find((r) => screen.embarkable(r));
    expect(land).toBeDefined();
    screen.focus(land!.id);
    const rows = panelRows(screen, surface(96, 20));
    const n = rows.length;
    expect(rows).not.toContain(MOVE);
    expect(rows[n - 2]).toBe(FILTER);
    expect(rows[n - 1]).toBe(EMBARK);
    expect(rows.join('\n')).toContain('▼');
  });

  it('on a world with no site at all the cursor starts at the centre', () => {
    const sea: WorldMap = { ...base, regions: base.regions.map((r) => ({ ...r, biome: 'ocean' })) };
    expect(mapScreen(sea).cursor).toEqual({ x: mid, y: mid });
  });
});
