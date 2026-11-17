/**
 * T-583's third probe: what Making Do puts on the map of each biome, before anyone plays.
 *
 * Generates a 48 × 48 site per land biome and geology (three seeds each), as the three-year fixture
 * does for its temperate forest, and counts the Making Do wild plants, soils and minerals in walls,
 * the giant bones on the surface, bat roosts and flowers; then plays the first two days to see which
 * wild animals arrive. With `starfall` and `glasslands` as traits on a temperate forest too.
 *
 * Runs locally in about a minute: `npx vitest run -c vitest.perf.config.ts test/perf/t583_making_do_sites.test.ts`
 * (`PROBE_OUT` names a JSON file for the figures). Not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { regionSpec, HeadlessGame } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { LOCAL_MAP_Z, TICKS_PER_DAY } from '@core/constants';
import { Map3D, TileKind } from '@core/map3d';
import type { PlantsReader } from '@systems/plants/reader';
import { generateLocal } from '@systems/terrain/generate';
import { TestWorld } from '../scenarios/test-world';
import { threeYearsEmbark } from '../scenarios/three_years_fortress';

const OUT = process.env['PROBE_OUT'];
const BIOMES = ['temperate_forest', 'temperate_hills', 'dark_forest', 'temperate_grassland', 'wetland', 'taiga', 'tundra', 'cold_steppe',
  'mountain', 'alpine', 'savanna', 'desert', 'badlands', 'tropical_forest'] as const;
const MAKING_DO_PLANTS = new Set(['reed_bed', 'barrel_cactus', 'wild_nettle', 'wild_rye', 'rock_lichen', 'wild_wyrmtongue', 'ironwood', 'salt_crust']);
const MAKING_DO_WALLS = new Set(['sand', 'clay', 'peat', 'halite', 'bog_iron', 'giant_bone', 'star_iron']);
const MAKING_DO_ANIMALS = new Set(['reindeer', 'camel', 'glow_beetle', 'giant_cave_spider', 'mammoth', 'yak', 'mountain_goat', 'elk', 'cave_ox', 'chicken', 'cave_crawler']);

interface SiteFigures { plants: Record<string, number>; walls: Record<string, number>; surfaceBone: number; roosts: number; flowers: number; animals: Record<string, number> }

function site(seed: string, biome: string, geology: string, traits: string[], days = 2): SiteFigures {
  const registry = contentRegistry();
  const spec = regionSpec(seed, { peril: 0, wealth: 2, biome, geology, traits, relief: 1, river: { class: 'brook', inflow: ['w'], outflow: 's' } } as never, registry);
  const map = new Map3D(48, 48, LOCAL_MAP_Z);
  const local = generateLocal(spec, map, registry);
  const systems = HeadlessGame.standardSystems(spec, local.layerStack, local);
  const w = new TestWorld({ seed, registry, map, spec, systems, embark: threeYearsEmbark(registry, seed, 0) });
  const mat = (i: number): string => registry.table<{ id: string }>('materials').byIndex(i)?.id ?? `#${i}`;
  const plants = w.readers.of<PlantsReader>('07');
  const f: SiteFigures = { plants: {}, walls: {}, surfaceBone: 0, roosts: w.animals.roosts.length, flowers: 0, animals: {} };
  for (let t = 0; t < map.tileCount; t += 1) {
    const sp = plants.speciesAt(t);
    if (MAKING_DO_PLANTS.has(sp)) f.plants[sp] = (f.plants[sp] ?? 0) + 1;
    if (plants.flowerAt(t)) f.flowers += 1;
    const k = map.kindAt(t);
    const m = mat(map.materialAt(t));
    if ((k === TileKind.Wall || k === TileKind.Boulder) && MAKING_DO_WALLS.has(m)) {
      f.walls[m] = (f.walls[m] ?? 0) + 1;
      if (m === 'giant_bone' && map.zOf(t) >= map.columnSurfaceZ(map.xOf(t), map.yOf(t)) - 1) f.surfaceBone += 1;
    }
  }
  const ent = w.game.world.entities;
  const unsub = w.game.world.onEvents((evs) => {
    for (const e of evs) {
      if (e.type !== 'AnimalSpawned') continue;
      const sp = registry.table<{ id: string }>('creatures').byIndex(Number(e['species']))?.id ?? String(e['species']);
      f.animals[sp] = (f.animals[sp] ?? 0) + 1;
    }
  });
  w.step(days * TICKS_PER_DAY);
  unsub();
  for (const id of ent.with(C.Creature)) {
    const c = ent.get(id, C.Creature)!;
    const sp = registry.table<{ id: string }>('creatures').byIndex(c.species)?.id ?? '';
    if (MAKING_DO_ANIMALS.has(sp) && c.faction !== 'fortress') f.animals[`${sp}@end`] = (f.animals[`${sp}@end`] ?? 0) + 1;
  }
  return f;
}

describe('T-583 probe: Making Do on the map', () => {
  it('counts each biome\'s Making Do features over three seeds', () => {
    const rows: Record<string, SiteFigures[]> = {};
    for (const biome of BIOMES) {
      for (const geology of ['sedimentary', 'igneous']) {
        rows[`${biome}/${geology}`] = [1, 2, 3].map((k) => site(`t583-${biome}-${k}`, biome, geology, []));
      }
    }
    // Wild herds come by the day's roll: a season of play on each herd biome.
    for (const biome of ['tundra', 'taiga', 'desert', 'badlands', 'savanna']) {
      rows[`${biome}/herds-56-days`] = [1, 2].map((k) => site(`t583-${biome}-${k}`, biome, 'sedimentary', [], 56));
    }
    for (const trait of ['starfall', 'glasslands']) {
      rows[`temperate_forest+${trait}`] = [1, 2, 3].map((k) => site(`t583-${trait}-${k}`, 'temperate_forest', 'mixed', [trait]));
    }
    for (const [key, list] of Object.entries(rows)) console.log(`[t583 site] ${key} ${JSON.stringify(list)}`);
    if (OUT) {
      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(OUT, JSON.stringify(rows, null, 1) + '\n');
    }
    expect(Object.keys(rows).length).toBeGreaterThan(0);
  });
});
