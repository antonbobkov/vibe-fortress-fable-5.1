/**
 * T-444: the world map's region panel says "no land route" for a civilization no land route reaches,
 * and names the edge it still arrives from (`01` § Civilizations; 18 § Arrival and warning; 20 § Movement).
 */

import { describe, it, expect, vi } from 'vitest';
import { WORLD_SIZE_SMALL } from '@core/constants';
import { WorldMapCompositor } from '@render/world-map';
import { CIVS, generate, hasLandRoute } from '@systems/worldgen';
import { unreachableDistance } from '@systems/worldgen/stages/civilizations';
import { WorldMapScreen } from '@ui/screens/world_map';
import { keymap, palette, registry, strings } from './ui-fixture';

const world = generate('ui-test', WORLD_SIZE_SMALL, registry);
const unreachable = unreachableDistance(world.size);

function screenAt(id: number): WorldMapScreen {
  const compositor = new WorldMapCompositor(registry, palette);
  const screen = new WorldMapScreen(world, { embark: vi.fn(), back: vi.fn() }, keymap, strings, compositor, registry);
  screen.cursor = { x: id % world.size, y: Math.floor(id / world.size) };
  return screen;
}

function civName(civ: string): string {
  const name = registry.table<{ id: string; name: string }>('civilizations').byId(civ)?.name.replace(/^the /, '') ?? civ;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

describe('T-444 a civilization with no land route', () => {
  it('hasLandRoute is false only for the unreachable distance', () => {
    expect(hasLandRoute(world.size, 0)).toBe(true);
    expect(hasLandRoute(world.size, unreachable - 1)).toBe(true);
    expect(hasLandRoute(world.size, unreachable)).toBe(false);
  });

  it('the panel says "no land route" and the arrival edge, never the sentinel number', () => {
    const region = world.regions.find(
      (r) => r.biome !== 'ocean' && r.biome !== 'glacier' && CIVS.some((c) => r.civDistance[c] === unreachable),
    );
    expect(region).toBeDefined();
    const flat = screenAt(region!.id).regionLines().join(' ').replace(/\s+/g, ' ');
    expect(flat).not.toContain(String(unreachable));
    let noRoute = 0;
    for (const civ of CIVS) {
      const edge = region!.nearestEdgeTo[civ].toUpperCase();
      if (region!.civDistance[civ] === unreachable) {
        noRoute += 1;
        expect(flat).toContain(`${civName(civ)}: no land route; arrives from the ${edge} edge`);
      } else {
        expect(flat).toContain(`${civName(civ)} ${region!.civDistance[civ]} regions (${edge})`);
      }
    }
    expect(noRoute).toBeGreaterThan(0);
  });

  it('a region every civilization reaches keeps the distance form', () => {
    const land = world.regions.find((r) => r.biome !== 'ocean' && r.biome !== 'glacier') as (typeof world.regions)[number];
    const reached = { ...land, civDistance: { mountainhome: 9, gloam: 22, hillfolk: 5, wildwood: 3 } };
    const regions = world.regions.map((r) => (r.id === land.id ? reached : r));
    const compositor = new WorldMapCompositor(registry, palette);
    const screen = new WorldMapScreen({ ...world, regions }, { embark: vi.fn(), back: vi.fn() }, keymap, strings, compositor, registry);
    screen.cursor = { x: land.id % world.size, y: Math.floor(land.id / world.size) };
    const text = screen.regionLines().join(' ');
    expect(text).not.toContain('no land route');
    expect(text.match(/ regions \(/g)).toHaveLength(CIVS.length);
    expect(text).toContain(`Gloam 22 regions (${land.nearestEdgeTo.gloam.toUpperCase()})`);
  });
});
