import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import type { ThreatsSystem } from '@systems/threats';
import type { ThreatsReader } from '@systems/threats/reader';
import { caravanGuardCount } from '@systems/trade/caravan';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M7-05 threat reputation and caravan guard readers', () => {
  it('suppresses a due Hillfolk bandit party at reputation 50, but schedules it at 49', () => {
    const due = (reputation: number): number => {
      const w = new TestWorld({ seed: 'm7-bandit-suppression', world: 'flat-test', embark: 'none', startTick: 140 * TICKS_PER_DAY - 1 });
      const threats = w.game.world.scheduler.byId('18') as ThreatsSystem;
      const state = threats.serialize();
      state.schedule = state.schedule.map(([kind, entry]) => [kind, kind === 'bandits' ? { ...entry, earliestTick: 0, nextTick: w.tick } : entry]);
      threats.deserialize(state, { world: w.game.world, registry: w.game.registry, rng: w.game.world.rngFor('18'), readers: w.readers, register: w.game.world.registrations });
      w.game.world.fortress.reputation.hillfolk = reputation;
      w.step(3);
      return w.readers.of<ThreatsReader>('18').activeParties().filter((id) => w.readers.of<ThreatsReader>('18').party(id)?.purpose === 'bandits').length;
    };
    expect(due(50)).toBe(0);
    expect(due(49)).toBe(1);
  });

  it('counts guards from region peril and the twilight pass trait', () => {
    expect(caravanGuardCount(0, false)).toBe(2);
    expect(caravanGuardCount(3, false)).toBe(5);
    expect(caravanGuardCount(3, true)).toBe(6);
  });
});
