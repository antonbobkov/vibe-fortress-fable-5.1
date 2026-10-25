/**
 * T-443: a region where a river rises has the brook the world map promises
 * (`02-systems/01-world-generation.md` § Rivers; `03-terrain-and-mining.md` § Local map generation
 * stage 2; `02-embark-and-loadout.md` § Site summary).
 *
 * The local map has a river exactly when the world map draws the region as a river, the filter's
 * "River: yes" keeps it, and the site summary names one.
 */

import { describe, expect, it } from 'vitest';
import { WORLD_SIZE_SMALL } from '@core/constants';
import { WorldMapCompositor } from '@render/world-map';
import { localMapSpec, siteSummary } from '@systems/embark';
import { generateLocalMap } from '@systems/terrain/generate';
import { COL_RIVER, COL_SOURCE } from '@systems/terrain/generate/common';
import { generate, matchesFilter } from '@systems/worldgen';
import { WorldMapScreen } from '@ui/screens/world_map';
import { keymap, palette, registry, strings } from '../ui/ui-fixture';

describe('T-443 a river source region carves a brook from its spring', () => {
  it('the local map has a river exactly when the world map, the filter and the summary say it does', () => {
    const compositor = new WorldMapCompositor(registry, palette);
    // The river's cell: the blue `~` (a wetland draws `~` too, in its own colour).
    const river = compositor.riverCell();
    let sources = 0;
    for (const seed of ['t443-a', 't443-b']) {
      const world = generate(seed, WORLD_SIZE_SMALL, registry);
      const homes = new Set(Object.values(world.civHomes));
      const land = world.regions.filter((r) => r.biome !== 'ocean' && r.biome !== 'glacier' && !homes.has(r.id));
      // Every river region, and as many dry regions, in id order.
      const rivers = land.filter((r) => r.river !== null);
      const dry = land.filter((r) => r.river === null).slice(0, rivers.length);
      for (const region of [...rivers, ...dry]) {
        const spec = localMapSpec(world, region.id, registry);
        const { result } = generateLocalMap(spec, registry, { until: 'rivers' });
        const carved = result.columns.some((f) => (f & COL_RIVER) !== 0);
        const where = `${seed} region ${region.id}`;
        expect(matchesFilter(region, { river: true }), where).toBe(carved);
        const cell = compositor.regionCell(world, region.id);
        expect(cell.glyph === river.glyph && cell.fg === river.fg, where).toBe(carved);
        expect(siteSummary(spec, registry).water.river !== null, where).toBe(carved);
        if (region.river !== null && region.river.inflow.length === 0) {
          sources += 1;
          expect(result.columns.some((f) => (f & COL_SOURCE) !== 0), `${where}: the spring is a source`).toBe(true);
        }
      }
    }
    expect(sources).toBeGreaterThan(0);
  });

  it('the region panel says the brook rises from a spring', () => {
    const world = generate('t443-a', WORLD_SIZE_SMALL, registry);
    const region = world.regions.find((r) => r.river !== null && r.river.inflow.length === 0 && r.river.outflow !== null);
    expect(region).toBeDefined();
    const screen = new WorldMapScreen(world, { embark: () => {}, back: () => {} }, keymap, strings, new WorldMapCompositor(registry, palette), registry);
    screen.cursor = { x: region!.id % world.size, y: Math.floor(region!.id / world.size) };
    const text = screen.regionLines().join(' ').replace(/\s+/g, ' ');
    expect(text).toMatch(/Water a (brook|river|great river) rising from a spring, running to the (north|east|south|west)/);
    expect(text).not.toContain('No water on the surface');
  });
});
