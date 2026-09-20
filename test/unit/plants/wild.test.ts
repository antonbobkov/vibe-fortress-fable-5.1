/**
 * T-M4-02 unit tests for the wild plants: chop yields per species range, gather yields and the
 * `wildSeedPermille` statistics, grass regrowth needing a cardinal grass neighbour, and ash
 * blocking regrowth for its duration.
 */

import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import { RngStream } from '@core/rng';
import { ASH_DURATION_DAYS } from '@systems/materials/constants';
import { TREE_LOGS_MAX, TREE_LOGS_MIN } from '@systems/terrain/constants';
import type { TerrainSystem } from '@systems/terrain';
import { GRASS_REGROW_PERMILLE, PlantFacts, clearOfTrees, hasGrassNeighbor, plantable, weighted, type PlantRow, type PlantsReader, type WildHost } from '@systems/plants';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const facts = new PlantFacts(registry);
const materials = registry.table<{ id: string; class: string }>('materials');

function newWorld(seed: string): TestWorld {
  return new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 24, 24), embark: 'none' });
}

function rollsOf(w: TestWorld): ReturnType<NonNullable<TerrainSystem['producer']>['rolls']> {
  const terrain = w.game.world.scheduler.byId('03') as unknown as TerrainSystem;
  const producer = terrain.producer;
  if (producer === null) throw new Error('03 has no producer');
  return producer.rolls();
}

describe('T-M4-02 wild plants: chop yields', () => {
  it('every tree species drops its own wood, `logs` in range, clamped to TREE_LOGS_MIN … TREE_LOGS_MAX', () => {
    const w = newWorld('chop-yields');
    const rolls = rollsOf(w);
    for (let p = 1; p <= facts.size; p += 1) {
      const row = facts.row(p) as PlantRow;
      if (!facts.isTree(p)) continue;
      const material = facts.materialOf(p);
      expect([row.id, material > 0]).toEqual([row.id, true]);
      // The wood a felled tree becomes is the species' own material row.
      expect([row.id, rolls.logMaterial(material)]).toEqual([row.id, row.id]);
      const [lo, hi] = row.logs as readonly [number, number];
      const seen = new Set<number>();
      for (let k = 0; k < 200; k += 1) seen.add(rolls.logs(material));
      for (const n of Array.from(seen)) {
        expect([row.id, n >= Math.max(TREE_LOGS_MIN, lo), n <= Math.min(TREE_LOGS_MAX, hi)]).toEqual([row.id, true, true]);
      }
      expect([row.id, Math.min(...seen)]).toEqual([row.id, Math.max(TREE_LOGS_MIN, lo)]);
      expect([row.id, Math.max(...seen)]).toEqual([row.id, Math.min(TREE_LOGS_MAX, hi)]);
    }
  });
});

describe('T-M4-02 wild plants: gather yields and wild seeds', () => {
  it('a shrub yields its product in range, and a seed at about its wildSeedPermille', () => {
    const w = newWorld('gather-yields');
    const rolls = rollsOf(w);
    const TRIALS = 4000;
    for (const id of ['wild_barley', 'dimcap_patch', 'bramble']) {
      const plant = facts.indexOf(id);
      const row = facts.row(plant) as PlantRow;
      const material = facts.materialOf(plant);
      const [lo, hi] = row.yield as readonly [number, number];
      let seeds = 0;
      let counts = 0;
      for (let k = 0; k < TRIALS; k += 1) {
        const got = rolls.gather(material);
        expect([id, got !== null]).toEqual([id, true]);
        const product = got as NonNullable<typeof got>;
        expect([id, product.type, product.material]).toEqual([id, row.yieldItem, row.yieldMaterial]);
        expect([id, product.count >= lo, product.count <= hi]).toEqual([id, true, true]);
        counts += product.count;
        if (product.seed !== undefined) {
          expect([id, product.seed]).toEqual([id, row.seedOf]);
          seeds += 1;
        }
      }
      const permille = row.wildSeedPermille ?? 0;
      const rate = (seeds * 1000) / TRIALS;
      expect([id, Math.abs(rate - permille) <= 40]).toEqual([id, true]);
      // The mean yield sits inside the row's range.
      const mean = counts / TRIALS;
      expect([id, mean >= lo, mean <= hi]).toEqual([id, true, true]);
    }
  });

  it('a gathered shrub stays and starts its regrow timer for regrowDays', () => {
    const w = newWorld('gather-timer');
    const tile = w.index(10, 10, FLAT_TEST_SURFACE_Z);
    const bramble = facts.indexOf('bramble');
    w.game.world.services.terrain.setKind(tile, TileKind.Shrub, facts.materialOf(bramble));
    const plants = w.readers.of<PlantsReader>('07');
    expect(plants.speciesAt(tile)).toBe('bramble');
    expect(plants.shrubReady(tile)).toBe(true);
    // The `JobCompleted` of a gather is what starts the timer (07 § Shrubs).
    w.game.world.emit({ type: 'JobCompleted', jobId: 1, jobType: 'gather', workerId: 0, target: tile } as never);
    w.step(2);
    expect(w.map.kindAt(tile)).toBe(TileKind.Shrub);
    expect(plants.shrubReady(tile)).toBe(false);
    const days = facts.row(bramble)?.regrowDays ?? 0;
    expect(days).toBe(28);
    w.step(days * TICKS_PER_DAY - 2 * TICKS_PER_DAY);
    expect(plants.shrubReady(tile)).toBe(false);
    w.step(3 * TICKS_PER_DAY);
    expect(plants.shrubReady(tile)).toBe(true);
    expect(w.events('ShrubRegrown').map((e) => e['tile'])).toContain(tile);
  });
});

describe('T-M4-02 wild plants: grass and ash', () => {
  function host(w: TestWorld, season = 0): WildHost {
    const soil = new Map<number, string>();
    for (let m = 1; m <= materials.size; m += 1) soil.set(m, materials.byIndex(m)?.class ?? '');
    return {
      map: w.map,
      facts,
      rng: RngStream.forStream('t', 'grass'),
      terrain: w.game.world.services.terrain,
      tick: 0,
      season,
      classOf: (m) => soil.get(m) ?? '',
      caveLoam: materials.index('cave_loam'),
      treeDensity: 0,
      treeWeights: [],
      fungusWeights: () => [],
      isReserved: () => false,
    };
  }

  it('grass regrows only next to grass, never in winter outdoors, never on ash or snow', async () => {
    const w = newWorld('grass');
    const { regrowGrass } = await import('@systems/plants/wild');
    const z = FLAT_TEST_SURFACE_Z;
    const lone = w.index(4, 4, z);
    const beside = w.index(6, 4, z);
    w.map.setFlag(w.index(7, 4, z), TileFlag.Grass, true);
    expect(hasGrassNeighbor(w.map, beside)).toBe(true);
    expect(hasGrassNeighbor(w.map, lone)).toBe(false);
    // With no grass neighbour nothing regrows however many days pass.
    const springHost = host(w);
    const winterHost = host(w, 3);
    const onlyLone = [lone];
    for (let d = 0; d < 200; d += 1) regrowGrass(springHost, onlyLone);
    expect(w.map.hasFlag(lone, TileFlag.Grass)).toBe(false);
    expect(onlyLone).toEqual([lone]);
    // Outdoors in winter nothing regrows either.
    const winter = [beside];
    for (let d = 0; d < 200; d += 1) regrowGrass(winterHost, winter);
    expect(w.map.hasFlag(beside, TileFlag.Grass)).toBe(false);
    // In spring it does, and it leaves `bareSoil`.
    const spring = [beside];
    let days = 0;
    while (days < 500 && !w.map.hasFlag(beside, TileFlag.Grass)) {
      regrowGrass(springHost, spring);
      days += 1;
    }
    expect(w.map.hasFlag(beside, TileFlag.Grass)).toBe(true);
    expect(spring).toEqual([]);
    expect(GRASS_REGROW_PERMILLE).toBe(120);
  });

  it('ash blocks regrowth until 07 clears it, ASH_DURATION_DAYS after the fire went out', () => {
    const w = newWorld('ash');
    const z = FLAT_TEST_SURFACE_Z;
    const burnt = w.index(9, 9, z);
    w.map.setFlag(w.index(10, 9, z), TileFlag.Grass, true);
    w.game.world.services.terrain.setFlag(burnt, TileFlag.Ash, true);
    w.game.world.emit({ type: 'FireOut', tiles: [burnt] } as never);
    w.step(2);
    const plants = w.readers.of<PlantsReader>('07');
    expect(plants.ashTiles()).toEqual([burnt]);
    // An ash tile is never plantable and never regrows grass.
    expect(plantable(host(w), burnt, false)).toBe(false);
    w.step(ASH_DURATION_DAYS * TICKS_PER_DAY - 3 * TICKS_PER_DAY);
    expect(w.map.hasFlag(burnt, TileFlag.Ash)).toBe(true);
    w.step(4 * TICKS_PER_DAY);
    expect(w.map.hasFlag(burnt, TileFlag.Ash)).toBe(false);
    expect(plants.ashTiles()).toEqual([]);
    // The cleared tile is bare soil again, so grass may come back by the normal rule.
    expect(plants.bareSoil()).toContain(burnt);
  });

  it('clearOfTrees keeps saplings two tiles apart; weighted picks inside its list', () => {
    const w = newWorld('clearance');
    const z = FLAT_TEST_SURFACE_Z;
    const centre = w.index(12, 12, z);
    expect(clearOfTrees(w.map, centre)).toBe(true);
    w.game.world.services.terrain.setKind(w.index(14, 12, z), TileKind.Tree, facts.materialOf(facts.indexOf('pine')));
    expect(clearOfTrees(w.map, centre)).toBe(false);
    expect(clearOfTrees(w.map, w.index(17, 12, z))).toBe(true);
    const rng = RngStream.forStream('t', 'w');
    const pairs: readonly (readonly [number, number])[] = [
      [3, 1],
      [7, 1],
    ];
    const seen = new Set<number>();
    for (let k = 0; k < 100; k += 1) seen.add(weighted(rng, pairs));
    expect(Array.from(seen).sort((a, b) => a - b)).toEqual([3, 7]);
    expect(weighted(rng, [])).toBe(0);
  });

  it('a sapling becomes a tree after its species saplingYears', () => {
    const w = newWorld('sapling');
    const z = FLAT_TEST_SURFACE_Z;
    const tile = w.index(15, 15, z);
    const pine = facts.indexOf('pine');
    w.game.world.services.terrain.setKind(tile, TileKind.Sapling, facts.materialOf(pine));
    w.plants.saplings.set(tile, 0);
    expect(facts.saplingYearsOf(pine)).toBe(2);
    w.step(2 * TICKS_PER_YEAR - TICKS_PER_DAY);
    expect(w.map.kindAt(tile)).toBe(TileKind.Sapling);
    w.step(2 * TICKS_PER_DAY);
    expect(w.map.kindAt(tile)).toBe(TileKind.Tree);
    expect(w.events('SaplingGrew').map((e) => [e['tile'], e['species']])).toContainEqual([tile, 'pine']);
  });
});
