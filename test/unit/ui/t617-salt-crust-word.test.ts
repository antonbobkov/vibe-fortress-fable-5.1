/** T-617: the site lists name the `salt` good "salt crust" on every site, apart from rock salt (02 § What a site has and lacks). */
import { describe, expect, it } from 'vitest';
import { WORLD_SIZE_SMALL } from '@core/constants';
import { WorldMapCompositor } from '@render/world-map';
import { generate, type WorldMap } from '@systems/worldgen';
import { WorldMapScreen } from '@ui/screens/world_map';
import { keymap, palette, registry, strings } from './ui-fixture';

/** The first world of these seeds with a desert and a sedimentary temperate forest, and those two regions. */
function sites(): { world: WorldMap; desert: number; forest: number } {
  for (let k = 0; k < 40; k += 1) {
    const world = generate(`t617-${k}`, WORLD_SIZE_SMALL, registry);
    const desert = world.regions.find((r) => r.biome === 'desert' && r.traits.length === 0);
    const forest = world.regions.find((r) => r.biome === 'temperate_forest' && r.geology === 'sedimentary' && r.traits.length === 0);
    if (desert !== undefined && forest !== undefined) return { world, desert: desert.id, forest: forest.id };
  }
  throw new Error('no world with both sites');
}

/** The has and lacks lines of a region, each joined over its wrapped rows. */
function lists(world: WorldMap, region: number): { has: string; lacks: string } {
  const screen = new WorldMapScreen(world, { embark: () => {}, back: () => {} }, keymap, strings, new WorldMapCompositor(registry, palette), registry);
  screen.cursor = { x: region % world.size, y: Math.floor(region / world.size) };
  const text = screen.regionLines(400).join(' ').replace(/\s+/g, ' ');
  const has = /This site has: (.*?)\. This site lacks:/.exec(text)?.[1] ?? '';
  const lacks = /This site lacks: (.*?)\./.exec(text)?.[1] ?? '';
  return { has, lacks };
}

describe('T-617 a desert\'s salt is not called sea salt', () => {
  const { world, desert, forest } = sites();

  it('a desert has "salt crust" and never "sea salt"', () => {
    const d = lists(world, desert);
    expect(d.has.split(', ')).toContain('salt crust');
    expect(`${d.has} ${d.lacks}`).not.toContain('sea salt');
  });

  it('a sedimentary temperate forest has rock salt and lacks salt crust: two different goods', () => {
    const f = lists(world, forest);
    expect(f.has.split(', ')).toContain('rock salt');
    expect(f.lacks.split(', ')).toContain('salt crust');
    expect(f.has.split(', ')).not.toContain('salt crust');
    expect(`${f.has} ${f.lacks}`).not.toContain('sea salt');
    expect(f.lacks.split(', ')).not.toContain('salt');
  });
});
