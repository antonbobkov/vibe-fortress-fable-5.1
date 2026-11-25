/**
 * T-743: a Hillfolk bandit's death costs the fortress −1 with the Hillfolk only when the fortress
 * caused it, by the caravan member's blame rule (20 § Movement step 5, `caravan-goods.md`
 * § Reputation events): a dwarf's blow costs 1; another bandit's, a wild animal's or no killer
 * at all costs nothing.
 */
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import { killCreature } from '@systems/health/tick';
import { REP_BANDIT_KILLED, type TradeSystem } from '@systems/trade';
import { TestWorld } from '../../scenarios/test-world';

function context(w: TestWorld): TickContext {
  const world = w.game.world;
  return {
    world,
    registry: world.registry,
    rng: world.rngFor('16'),
    readers: world.readers,
    register: world.registrations,
    tick: world.calendar.tick,
    emit: (event: GameEvent) => world.emit(event),
    terrain: world.services.terrain,
    jobs: world.services.jobs,
    spawn: world.services.spawn,
  };
}

/** A bandit at 20, 20 killed by `killer` (or by nothing); the Hillfolk's reputation change. */
function banditDeath(seed: string, killer: (w: TestWorld) => EntityId): { change: number; reasons: string[] } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const reader = (w.game.world.scheduler.byId('20') as TradeSystem).reader();
  const bandit = w.spawnCreature('hillfolk_bandit', w.index(20, 20, 32), 'hostile:hillfolk');
  const killerId = killer(w);
  const before = reader.reputation('hillfolk');
  expect(killCreature(context(w), bandit, 'killed', killerId)).toBe(true);
  w.step(2);
  return {
    change: reader.reputation('hillfolk') - before,
    reasons: reader.reputationLog('hillfolk').map((e) => e.reason),
  };
}

describe('T-743 a Hillfolk bandit\'s death is blamed on the fortress only when the fortress caused it', () => {
  it('a bandit a dwarf kills costs 1', () => {
    const { change, reasons } = banditDeath('t743-dwarf', (w) => w.spawnDwarf({ at: w.index(21, 20, 32) }));
    expect(REP_BANDIT_KILLED).toBe(-1);
    expect(change).toBe(REP_BANDIT_KILLED);
    expect(reasons).toContain('bandit_killed');
  });

  it('a bandit another bandit kills costs nothing', () => {
    const { change, reasons } = banditDeath('t743-bandit',
      (w) => w.spawnCreature('hillfolk_bandit', w.index(21, 20, 32), 'hostile:hillfolk'));
    expect(change).toBe(0);
    expect(reasons).not.toContain('bandit_killed');
  });

  it('a bandit a wild animal kills costs nothing', () => {
    const { change, reasons } = banditDeath('t743-wolf', (w) => w.spawnCreature('wolf', w.index(21, 20, 32), 'wild'));
    expect(change).toBe(0);
    expect(reasons).not.toContain('bandit_killed');
  });

  it('a bandit that dies with no killer (a fall, a drowning) costs nothing', () => {
    const { change, reasons } = banditDeath('t743-none', () => 0);
    expect(change).toBe(0);
    expect(reasons).not.toContain('bandit_killed');
  });
});
