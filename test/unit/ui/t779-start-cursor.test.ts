/**
 * T-779: the world map's cursor started on the embarkable region nearest the centre, and the centre
 * of a world is mountains: on eight of thirty probe worlds that site had frostbite from the first
 * night. The cursor now passes over such a site to the nearest one without it, ties to the lowest id
 * as before, and starts on the nearest site after all when every site the rule keeps has it
 * (`ui-screens/menus-and-world.md` § World map).
 */
import { describe, expect, it, vi } from 'vitest';
import { WORLD_SIZE_SMALL, WORLD_SIZE_STANDARD } from '@core/constants';
import { WorldMapCompositor } from '@render/world-map';
import { localMapSpec, siteFrostbite } from '@systems/embark';
import { generate, type WorldMap } from '@systems/worldgen';
import { WorldMapScreen } from '@ui/screens/world_map';
import { keymap, palette, registry, strings } from './ui-fixture';

const compositor = new WorldMapCompositor(registry, palette);
const base: WorldMap = generate('t779', WORLD_SIZE_SMALL, registry);
const size = base.size;
const mid = Math.floor(size / 2);
const id = (x: number, y: number): number => y * size + x;

/** Frostbite from the first night: an alpine region at −30 °C. */
const FROZEN = { biome: 'alpine', tempC: -30, temper: 3, traits: [] as string[] };
/** No frostbite in any season: a temperate forest at 12 °C. */
const MILD = { biome: 'temperate_forest', tempC: 12, temper: 1, traits: [] as string[] };

/** The world as an ocean but for the regions given. */
function world(sites: ReadonlyMap<number, typeof FROZEN>): WorldMap {
  return { ...base, regions: base.regions.map((r) => (sites.has(r.id) ? { ...r, ...sites.get(r.id) } : { ...r, biome: 'ocean' })) };
}

function start(w: WorldMap): number {
  return new WorldMapScreen(w, { embark: vi.fn(), back: vi.fn() }, keymap, strings, compositor, registry).regionId;
}

const arrival = (w: WorldMap, region: number): boolean => siteFrostbite(localMapSpec(w, region, registry), registry)?.arrival === true;

describe('T-779 the world map does not start on a site that freezes from the first night', () => {
  const centre = id(mid, mid);
  const near = id(mid + 1, mid);
  const farTie = id(mid - 3, mid - 3);
  const far = id(mid + 3, mid);

  it('passes over the frostbitten centre to the nearest site without frostbite, ties to the lowest id', () => {
    const w = world(new Map([[centre, FROZEN], [near, FROZEN], [far, MILD], [farTie, MILD]]));
    expect(arrival(w, centre)).toBe(true);
    expect(arrival(w, near)).toBe(true);
    expect(arrival(w, far)).toBe(false);
    expect(farTie).toBeLessThan(far);
    expect(start(w)).toBe(farTie);
  });

  it('a site without frostbite at the centre is the start, as before', () => {
    expect(start(world(new Map([[centre, MILD], [near, FROZEN]])))).toBe(centre);
  });

  it('when every site freezes from the first night the cursor starts on the nearest one', () => {
    expect(start(world(new Map([[near, FROZEN], [far, FROZEN]])))).toBe(near);
  });

  it('on probe-5 it does not start on the alpine site T-765 measured', () => {
    const w = generate('probe-5', WORLD_SIZE_STANDARD, registry);
    // The centre of the 64 × 64 standard world.
    expect(Math.floor(w.size / 2) * (w.size + 1)).toBe(2080);
    expect(w.regions[2080]?.biome).toBe('alpine');
    expect(arrival(w, 2080)).toBe(true);
    const region = start(w);
    expect(region).not.toBe(2080);
    expect(arrival(w, region)).toBe(false);
  });
});
