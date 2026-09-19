/**
 * `we_transitions` of `04-implementation/acceptance-tests.md` § 06 Weather: "10 years at temper 0
 * and temper 4 | temper 0 never `storm`, `heatwave`, `cold_snap`; temper 4 has ≥ 1 of each per
 * year on average".
 *
 * Temper 0 is the `flat-test` region ("a `serene_vale`-like region (peril 0, wealth 2, temper 0)
 * unless the test says otherwise"), temper 4 the same region with temper 4 and no trait. Ten years
 * are 1,344,000 ticks each, so each run is a statistical trial on the compact `flat-test` columns
 * (32 × 32, D-059) with only 03 terrain and 06 weather registered: the weather rules read only the
 * region, the calendar and the outdoor tiles, which the compact map has as the full one does.
 */

import { expect } from 'vitest';
import { FLAT_TEST_LAYERS, FLAT_TEST_SPEC, HeadlessGame, buildFlatTestMap } from '@app/headless';
import { TICKS_PER_YEAR } from '@core/constants';
import { TerrainSystem } from '@systems/terrain';
import { WeatherSystem } from '@systems/weather';
import type { LocalMapSpec } from '@systems/embark/spec';
import type { Scenario } from './runner';

const YEARS = 10;

/** Weather states entered over `YEARS` years (the initial `clear` is not counted). */
function run(seed: string, spec: LocalMapSpec, registry: HeadlessGame['registry']): Map<string, number> {
  const game = new HeadlessGame({
    seed,
    registry,
    map: buildFlatTestMap(registry, 32, 32),
    systems: [new TerrainSystem({ spec, layerStack: FLAT_TEST_LAYERS }), new WeatherSystem({ spec })],
  });
  const counts = new Map<string, number>();
  game.world.onEvents((batch) => {
    for (const e of batch) if (e.type === 'WeatherChanged') counts.set(e['to'] as string, (counts.get(e['to'] as string) ?? 0) + 1);
  });
  game.step(YEARS * TICKS_PER_YEAR);
  return counts;
}

const scenario: Scenario = {
  id: 'we_transitions',
  milestone: 3,
  seed: 'we-transitions',
  world: 'flat-test',
  embark: 'none',
  run: (w) => {
    const registry = w.game.registry;
    const calm = run('we-transitions-0', FLAT_TEST_SPEC, registry);
    expect(FLAT_TEST_SPEC.temper).toBe(0);
    expect(calm.get('storm') ?? 0).toBe(0);
    expect(calm.get('heatwave') ?? 0).toBe(0);
    expect(calm.get('cold_snap') ?? 0).toBe(0);
    expect(calm.get('rain') ?? 0).toBeGreaterThan(0);
    const harsh = run('we-transitions-4', { ...FLAT_TEST_SPEC, temper: 4, traits: [] }, registry);
    for (const state of ['storm', 'heatwave', 'cold_snap']) {
      expect([state, (harsh.get(state) ?? 0) >= YEARS]).toEqual([state, true]);
    }
  },
};

export default scenario;
