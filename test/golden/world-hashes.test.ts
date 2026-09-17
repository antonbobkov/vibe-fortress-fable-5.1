/**
 * Golden world hashes (`05-plan/01-testing-strategy.md` § Golden tests).
 *
 * `world-hashes.json` holds `{ seed, size } -> hash of WorldMap` (empty until 01 worldgen arrives
 * in M1) and `{ seed, ticks } -> hash of the world after N ticks of `flat-test` with no commands,
 * for N in {0, 1000, 5000}`. The embark is `none` while T-M1-04 has not built one; the file
 * records which embark its values were taken with.
 *
 * The file is rewritten only by `npm run golden:update -- world-hashes`, which sets
 * DEEPHOLM_GOLDEN_UPDATE and re-runs this test.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { hashesAt } from '@app/headless';

const GOLDEN_NAME = 'world-hashes';
const file = fileURLToPath(new URL('./world-hashes.json', import.meta.url));

interface GoldenFile {
  $note: string;
  worldMaps: Record<string, string>;
  flatTest: { embark: string; ticks: Record<string, string> };
}

const SEEDS = ['deepholm', 'emberhall'];
const TICKS = [0, 1_000, 5_000];

const golden = JSON.parse(readFileSync(file, 'utf8')) as GoldenFile;
const update =
  process.env['DEEPHOLM_GOLDEN_UPDATE'] === GOLDEN_NAME || process.env['DEEPHOLM_GOLDEN_UPDATE'] === 'all';

function computed(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const seed of SEEDS) {
    const hashes = hashesAt({ seed, world: 'flat-test' }, TICKS);
    for (const ticks of TICKS) out[`${seed}|${ticks}`] = hashes.get(ticks) as string;
  }
  return out;
}

describe('T-M0-11 golden: world hashes', () => {
  it('the flat-test world hashes match the golden file', () => {
    const now = computed();
    if (update) {
      const next: GoldenFile = { ...golden, flatTest: { ...golden.flatTest, ticks: now } };
      writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      golden.flatTest.ticks = now;
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

  it('the world-map goldens wait for 01 worldgen', () => {
    expect(golden.worldMaps).toEqual({});
    expect(golden.flatTest.embark).toBe('none');
  });
});
