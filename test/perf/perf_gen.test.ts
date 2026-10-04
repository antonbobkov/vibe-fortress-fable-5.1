/** T-M8-01: acceptance-tests.md perf_gen, standard world and its actual local map. */
import { expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { WORLD_SIZE_STANDARD } from '@core/constants';
import { defaultRegionId } from '@app/headless';
import { localMapSpec } from '@systems/embark';
import { generate } from '@systems/worldgen';
import { generateLocalMap } from '@systems/terrain/generate';

it('T-M8-01 perf_gen: standard world plus local map takes at most 4 seconds', () => {
  const registry = contentRegistry();
  const began = performance.now();
  const world = generate('perf-1', WORLD_SIZE_STANDARD, registry);
  const spec = localMapSpec(world, defaultRegionId(world, registry), registry);
  const { map } = generateLocalMap(spec, registry);
  const elapsedMs = performance.now() - began;
  console.log(`perf_gen: ${elapsedMs.toFixed(3)} ms, world ${world.size}, local ${map.w}x${map.h}x${map.d}`);
  expect(world.size).toBe(WORLD_SIZE_STANDARD);
  expect(elapsedMs).toBeLessThanOrEqual(4_000);
});
