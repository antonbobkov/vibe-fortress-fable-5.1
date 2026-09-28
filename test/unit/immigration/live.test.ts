import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import { RngStream, seedFor } from '@core/rng';
import { contentRegistry } from '@content/loader';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import { guaranteedSize, planWave } from '@systems/immigration/waves';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M7-04 live immigrant arrival', () => {
  it('spawns planned children as children with clothing, needs 30, unique names, and a 20-tick trickle', () => {
    const registry = contentRegistry();
    let seed = '';
    for (let n = 1; n <= 200; n += 1) {
      const candidate = `im-child-${n}`;
      const rng = new RngStream(seedFor(candidate, '21'));
      const size = guaranteedSize(rng, 80);
      if (planWave(registry, rng, size, new Set(), new Set()).some((member) => member.record.ageYears < ADULT_AGE_YEARS)) { seed = candidate; break; }
    }
    expect(seed).not.toBe('');
    const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick: 28 * TICKS_PER_DAY - 2 });
    for (let n = 0; n < 7; n += 1) w.spawnDwarf();
    w.until((world) => world.events('ImmigrantsArrived').length > 0, 200);
    const event = w.events('ImmigrantsArrived')[0];
    const ids = event?.['ids'] as number[];
    expect(ids.length).toBeGreaterThanOrEqual(2);
    const names = ids.map((id) => w.game.world.entities.get(id, C.Creature)?.name);
    expect(new Set(names).size).toBe(ids.length);
    const children = ids.filter((id) => (w.game.world.entities.get(id, C.Creature)?.ageTicks ?? 0) < ADULT_AGE_YEARS * TICKS_PER_YEAR);
    expect(children.length).toBeGreaterThan(0);
    expect(event?.['children']).toBe(children.length);
    for (const id of ids) {
      const needs = w.game.world.entities.get(id, C.Needs);
      expect(needs?.hunger).toBeGreaterThanOrEqual(30);
      const equipment = w.game.world.entities.get(id, C.Equipment);
      expect(equipment?.clothing.body).toBeGreaterThan(0);
      expect(equipment?.clothing.legs).toBeGreaterThan(0);
      expect(equipment?.clothing.feet).toBeGreaterThan(0);
    }
    expect(w.tick).toBeGreaterThanOrEqual(28 * TICKS_PER_DAY + (ids.length - 1) * 20);
  });
});
