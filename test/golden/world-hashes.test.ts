/**
 * Golden world hashes (`process/testing-strategy.md` § Golden tests).
 *
 * `world-hashes.json` holds `{ seed, size } -> hash of WorldMap` (seeds `test-1`, `test-2`,
 * `test-3` at the standard size, T-M1-03) and `{ seed, ticks } -> hash of the world after N ticks of `flat-test` with no commands,
 * for N in {0, 1000, 5000}` with the default embark (the Balanced preset). Since T-M1-11 the arrival
 * spawns through the spawn API, so the runs take the default embark; the file records which embark
 * its values were taken with.
 *
 * The file is rewritten only by `npm run golden:update -- world-hashes`, which sets
 * DEEPHOLM_GOLDEN_UPDATE and re-runs this test.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { generatedSpec, hashesAt } from '@app/headless';
import { generateLocalMap } from '@systems/terrain/generate';
import { contentRegistry } from '@content/loader';
import { WORLD_SIZE_STANDARD } from '@core/constants';
import { StateHasher } from '@core/serialize';
import { generate } from '@systems/worldgen';

const GOLDEN_NAME = 'world-hashes';
const file = fileURLToPath(new URL('./world-hashes.json', import.meta.url));

interface GoldenFile {
  $note: string;
  worldMaps: Record<string, string>;
  /** T-M1-06: "local map hash for `test-1` region 0" (region 0 = the default region, D-046). */
  localMaps?: Record<string, string>;
  flatTest: { embark: string; ticks: Record<string, string> };
}

const SEEDS = ['deepholm', 'emberhall'];
/** `M1-ground.md` T-M1-03: "`world-hashes.json` entries for seeds `test-1`, `test-2`, `test-3` at standard size". */
const WORLD_SEEDS = ['test-1', 'test-2', 'test-3'];

const LOCAL_SEEDS = ['test-1'];

function localMapHashes(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const seed of LOCAL_SEEDS) {
    const spec = generatedSpec(seed, contentRegistry());
    const { map, result } = generateLocalMap(spec, contentRegistry());
    const h = new StateHasher();
    h.array(map.kind).array(map.material).array(map.fluid).array(map.flags);
    h.value(result.layerStack).value(result.spawns).value(result.warmSprings).value(result.sinks).value(result.waterSources);
    out[`${seed}|${spec.regionId}`] = h.digest();
  }
  return out;
}

function worldMapHashes(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const seed of WORLD_SEEDS) {
    const world = generate(seed, WORLD_SIZE_STANDARD, contentRegistry());
    out[`${seed}|${WORLD_SIZE_STANDARD}`] = new StateHasher().value(world).digest();
  }
  return out;
}
const TICKS = [0, 1_000, 5_000];
/** `testing-strategy.md` § Golden tests: "with the default embark and no commands" (T-M1-11). */
const EMBARK = 'default' as const;

const golden = JSON.parse(readFileSync(file, 'utf8')) as GoldenFile;
const update =
  process.env['DEEPHOLM_GOLDEN_UPDATE'] === GOLDEN_NAME || process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';

function computed(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const seed of SEEDS) {
    const hashes = hashesAt({ seed, world: 'flat-test', embark: EMBARK }, TICKS);
    for (const ticks of TICKS) out[`${seed}|${ticks}`] = hashes.get(ticks) as string;
  }
  return out;
}

describe('T-M0-11 golden: world hashes', () => {
  it('the flat-test world hashes match the golden file', () => {
    const now = computed();
    if (update) {
      const next: GoldenFile = { ...golden, flatTest: { embark: EMBARK, ticks: now } };
      writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      golden.flatTest.ticks = now;
      golden.flatTest.embark = EMBARK;
    }
    expect(Object.keys(golden.flatTest.ticks).sort()).toEqual(Object.keys(now).sort());
    expect(golden.flatTest.ticks).toEqual(now);
  });

  it('the hash follows the calendar and nothing else while no system ticks', () => {
    const hashes = hashesAt({ seed: 'deepholm', world: 'flat-test' }, TICKS);
    // The calendar is part of the world hash, so the checkpoints differ from each other even
    // though M0 has no system that changes the map or the entities.
    expect(new Set([hashes.get(0), hashes.get(1_000), hashes.get(5_000)]).size).toBe(TICKS.length);
    // Two runs of the same seed agree at every checkpoint; `core_determinism` is the full scenario.
    expect(hashesAt({ seed: 'deepholm', world: 'flat-test' }, TICKS)).toEqual(hashes);
  });

  it('T-M1-03: the generated world maps match the golden file', () => {
    const now = worldMapHashes();
    if (update) {
      const current = JSON.parse(readFileSync(file, 'utf8')) as GoldenFile;
      const next: GoldenFile = { ...current, worldMaps: now };
      writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      golden.worldMaps = now;
    }
    expect(Object.keys(golden.worldMaps).sort()).toEqual(WORLD_SEEDS.map((s) => `${s}|${WORLD_SIZE_STANDARD}`).sort());
    expect(golden.worldMaps).toEqual(now);
    expect(golden.flatTest.embark).toBe(EMBARK);
  });

  it('T-M1-06: the generated local map of test-1 region 0 matches the golden file', () => {
    const now = localMapHashes();
    if (update) {
      const current = JSON.parse(readFileSync(file, 'utf8')) as GoldenFile;
      const next: GoldenFile = { ...current, localMaps: now };
      writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      golden.localMaps = now;
    }
    expect(golden.localMaps).toEqual(now);
  });
});
