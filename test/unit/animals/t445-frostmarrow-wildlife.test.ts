/**
 * T-445: `frostmarrow` adds the wild yak (groups of 2–4) to the region's surface species and raises
 * the snow leopard's cap by 2 (`regions-biomes-and-traits.md` § Region traits; 08 § Wild spawning).
 */
import { describe, expect, it } from 'vitest';
import { regionSpec } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { RngStream } from '@core/rng';
import { AnimalFacts, groupSize, regionSurfaceSpecies, surfaceCap, type SpawnHost } from '@systems/animals';
import { FROSTMARROW_YAK_WEIGHT } from '@systems/animals/constants';
import { siteSummary } from '@systems/embark/site';

const facts = new AnimalFacts(contentRegistry());
const yak = facts.indexOf('yak');
const leopard = facts.indexOf('snow_leopard');

function host(traits: string[]): SpawnHost {
  return { facts, biome: 'tundra', traits, wildlifeDensity: 1000, rng: RngStream.forStream('t445', 'spawn') } as unknown as SpawnHost;
}

describe('T-445 frostmarrow wildlife', () => {
  it('adds the wild yak to the surface species in every season, only on frostmarrow', () => {
    for (let season = 0; season < 4; season += 1) {
      expect(regionSurfaceSpecies(host(['frostmarrow']), season)).toContainEqual([yak, FROSTMARROW_YAK_WEIGHT]);
      expect(regionSurfaceSpecies(host([]), season).some(([s]) => s === yak)).toBe(false);
    }
    const list = regionSurfaceSpecies(host(['frostmarrow']), 0).map(([s]) => s);
    expect(list).toEqual([...list].sort((a, b) => a - b));
  });

  it('spawns frostmarrow yaks in groups of 2 to 4', () => {
    const h = host(['frostmarrow']);
    const sizes = new Set<number>();
    for (let k = 0; k < 200; k += 1) sizes.add(groupSize(h, yak));
    expect([...sizes].sort()).toEqual([2, 3, 4]);
    expect(groupSize(host([]), yak)).toBe(1);
  });

  it('raises the snow leopard cap by 2', () => {
    expect(surfaceCap(host(['frostmarrow']), leopard, 10)).toBe(surfaceCap(host([]), leopard, 10) + 2);
  });

  it('names the wild yak in the site summary of a frostmarrow region', () => {
    const registry = contentRegistry();
    const frost = siteSummary(regionSpec('t445', { biome: 'tundra', peril: 0, wealth: 2, traits: ['frostmarrow'] }, registry), registry);
    expect(frost.wildlife.other).toContain('yak');
    const plain = siteSummary(regionSpec('t445', { biome: 'tundra', peril: 0, wealth: 2, traits: [] }, registry), registry);
    expect(plain.wildlife.other).not.toContain('yak');
  });
});
