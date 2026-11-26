/**
 * T-783: the world map's cursor passed over a site with frostbite from the first night, and still
 * started thirteen of thirty probe worlds on alpine rock with no soil, trees or water. It now prefers
 * the nearest site that has neither frostbite from the first night nor a missing essential, within
 * the world's size / `START_SITE_REACH_DIVISOR` of the centre; else the frostbite rule as before
 * (`ui-screens/menus-and-world.md` § World map).
 */
import { describe, expect, it, vi } from 'vitest';
import { WORLD_SIZE_SMALL, WORLD_SIZE_STANDARD } from '@core/constants';
import { WorldMapCompositor } from '@render/world-map';
import { localMapSpec, siteFrostbite, siteLacks, siteSummary } from '@systems/embark';
import { generate, type RegionRecord, type WorldMap } from '@systems/worldgen';
import { START_SITE_REACH_DIVISOR } from '@ui/constants';
import { WorldMapScreen } from '@ui/screens/world_map';
import { keymap, palette, registry, strings } from './ui-fixture';

const compositor = new WorldMapCompositor(registry, palette);
const base: WorldMap = generate('t783', WORLD_SIZE_SMALL, registry);
const size = base.size;
const mid = Math.floor(size / 2);
const id = (x: number, y: number): number => y * size + x;

type Site = Partial<RegionRecord>;
/** Frostbite from the first night, and no soil, trees or water: alpine rock at −30 °C. */
const ROCK: Site = { biome: 'alpine', tempC: -30, temper: 3, traits: [], river: null, lake: false };
/** No frostbite, soil and trees, but no surface water. */
const DRY: Site = { biome: 'temperate_forest', tempC: 12, temper: 1, traits: [], river: null, lake: false };
/** No frostbite and nothing missing: the same forest by a lake. */
const LAKE: Site = { ...DRY, lake: true };
/** Nothing missing, but frostbite from the first night: a taiga by a lake at −30 °C. */
const FROZEN_LAKE: Site = { biome: 'taiga', tempC: -30, temper: 3, traits: [], river: null, lake: true };

/** The world as an ocean but for the regions given. */
function world(sites: ReadonlyMap<number, Site>): WorldMap {
  return { ...base, regions: base.regions.map((r) => (sites.has(r.id) ? { ...r, ...sites.get(r.id) } : { ...r, biome: 'ocean' })) };
}

function start(w: WorldMap): number {
  return new WorldMapScreen(w, { embark: vi.fn(), back: vi.fn() }, keymap, strings, compositor, registry).regionId;
}

const lacks = (w: WorldMap, region: number): readonly string[] => siteLacks(localMapSpec(w, region, registry), registry);
const arrival = (w: WorldMap, region: number): boolean => siteFrostbite(localMapSpec(w, region, registry), registry)?.arrival === true;

describe('T-783 the world map starts on a site that lacks nothing, near the centre', () => {
  const centre = id(mid, mid);
  const near = id(mid + 1, mid);
  const far = id(mid + 3, mid);
  const farTie = id(mid - 3, mid - 3);

  it('passes over the bare rock and the dry forest to the nearest site with nothing missing', () => {
    const w = world(new Map([[centre, ROCK], [near, DRY], [far, LAKE]]));
    expect(lacks(w, centre)).toEqual(['soil', 'trees', 'water']);
    expect(arrival(w, centre)).toBe(true);
    expect(lacks(w, near)).toEqual(['water']);
    expect(arrival(w, near)).toBe(false);
    expect(lacks(w, far)).toEqual([]);
    expect(arrival(w, far)).toBe(false);
    expect(start(w)).toBe(far);
  });

  it('ties go to the lowest id, as before', () => {
    expect(farTie).toBeLessThan(far);
    expect(start(world(new Map([[centre, DRY], [far, LAKE], [farTie, LAKE]])))).toBe(farTie);
  });

  it('a site with nothing missing but frostbite from the first night is passed over', () => {
    const w = world(new Map([[centre, FROZEN_LAKE], [far, LAKE]]));
    expect(lacks(w, centre)).toEqual([]);
    expect(arrival(w, centre)).toBe(true);
    expect(start(w)).toBe(far);
  });

  it('with no site that lacks nothing, the frostbite rule alone: the nearest site without frostbite', () => {
    expect(start(world(new Map([[centre, ROCK], [near, FROZEN_LAKE], [far, DRY]])))).toBe(far);
  });

  it('looks no farther than the reach for a site that lacks nothing', () => {
    const reach = Math.floor(size / START_SITE_REACH_DIVISOR);
    const beyond = id(mid + reach + 1, mid);
    const within = id(mid + reach, mid);
    expect(start(world(new Map([[near, DRY], [beyond, LAKE]])))).toBe(near);
    expect(start(world(new Map([[near, DRY], [within, LAKE]])))).toBe(within);
  });

  it('siteLacks is the summary\'s lacks line', () => {
    const w = generate('probe-3', WORLD_SIZE_STANDARD, registry);
    for (let r = 0; r < w.regions.length; r += 37) {
      if (w.regions[r]?.biome === 'ocean' || w.regions[r]?.biome === 'glacier') continue;
      const spec = localMapSpec(w, r, registry);
      expect(siteLacks(spec, registry)).toEqual(siteSummary(spec, registry).lacks);
    }
  });

  it('on probe-5 it starts on a temperate grassland that lacks nothing, nine regions from the centre', () => {
    const w = generate('probe-5', WORLD_SIZE_STANDARD, registry);
    const region = start(w);
    expect(region).toBe(1577);
    expect(w.regions[region]?.biome).toBe('temperate_grassland');
    expect(lacks(w, region)).toEqual([]);
    expect(siteFrostbite(localMapSpec(w, region, registry), registry)).toBeNull();
    expect(Math.max(Math.abs((region % w.size) - 32), Math.abs(Math.floor(region / w.size) - 32))).toBe(9);
  });
});
