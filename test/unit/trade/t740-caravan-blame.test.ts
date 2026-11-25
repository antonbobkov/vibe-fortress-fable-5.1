/**
 * T-740: a caravan member's death counts against the fortress only when the fortress caused it
 * (20 § Movement step 5): a guard's arrow through its own merchant, or a raider's blow, costs
 * nothing, the caravan lost to it too; a dwarf's blow or a trap costs −50 and a ban.
 */
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@core/events';
import { TICKS_PER_DAY } from '@core/constants';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import { killCreature } from '@systems/health/tick';
import { CARAVAN_BAN_YEARS, REP_CARAVAN_LOST, REP_FORTRESS_KILL, type TradeSystem } from '@systems/trade';
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

function atDepot(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
  w.build('trade_depot', w.index(45, 8, 32), 'granite');
  w.until(() => w.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
  const trade = w.game.world.scheduler.byId('20') as TradeSystem;
  const caravan = trade.serialize().activeCaravan!;
  const reader = trade.reader();
  const kill = (victim: EntityId, killer: EntityId) => {
    expect(killCreature(context(w), victim, 'killed', killer)).toBe(true);
    // The death is handled this tick; what the caravan does about it is heard the next.
    w.step(2);
  };
  return { w, trade, reader, caravan, kill };
}

describe('T-740 a caravan member\'s death is blamed on the fortress only when the fortress caused it', () => {
  it('a guard\'s arrow killing its own merchant costs nothing, though the caravan is lost', () => {
    const { w, reader, caravan, kill } = atDepot('t740-friendly');
    const before = reader.reputation(caravan.civ);
    kill(caravan.merchants[0]!, caravan.guards[0]!);
    expect(w.events('CaravanLost')).toHaveLength(1);
    expect(reader.reputation(caravan.civ)).toBe(before);
    expect(reader.reputationLog(caravan.civ).filter((e) => e.reason === 'caravan_member_killed' || e.reason === 'caravan_lost')).toEqual([]);
    expect(reader.isBanned(caravan.civ)).toBe(false);
  });

  it('a raider\'s blow costs the fortress nothing', () => {
    const { w, reader, caravan, kill } = atDepot('t740-raider');
    const raider = w.spawnCreature('gloam_warrior', w.index(40, 40, 32), 'hostile:gloam');
    const before = reader.reputation(caravan.civ);
    kill(caravan.guards[0]!, raider);
    kill(caravan.merchants[0]!, raider);
    expect(reader.reputation(caravan.civ)).toBe(before);
    expect(reader.isBanned(caravan.civ)).toBe(false);
  });

  it('a dwarf\'s blow costs the fortress dearly and bans the caravans', () => {
    const { w, trade, reader, caravan, kill } = atDepot('t740-dwarf');
    const dwarf = w.spawnDwarf({ at: w.index(40, 40, 32) });
    const before = reader.reputation(caravan.civ);
    kill(caravan.guards[0]!, dwarf);
    expect(reader.reputation(caravan.civ)).toBe(Math.max(-100, before + REP_FORTRESS_KILL));
    expect(reader.reputationLog(caravan.civ).at(-1)).toMatchObject({ reason: 'caravan_member_killed', delta: reader.reputation(caravan.civ) - before });
    expect(trade.serialize().schedule[caravan.civ]?.banUntilYear).toBeGreaterThanOrEqual(CARAVAN_BAN_YEARS);
    expect(reader.isBanned(caravan.civ)).toBe(true);
  });

  it('a merchant the fortress kills loses the caravan at a cost', () => {
    const { w, reader, caravan, kill } = atDepot('t740-merchant');
    const dwarf = w.spawnDwarf({ at: w.index(40, 40, 32) });
    const before = reader.reputation(caravan.civ);
    kill(caravan.merchants[0]!, dwarf);
    expect(w.events('CaravanLost')).toHaveLength(1);
    // −50 for the member, then −10 for the caravan, each held at the floor.
    expect(reader.reputation(caravan.civ)).toBe(Math.max(-100, Math.max(-100, before + REP_FORTRESS_KILL) + REP_CARAVAN_LOST));
  });

  it('a trap\'s kill is the fortress\'s doing', () => {
    const { w, reader, caravan, kill } = atDepot('t740-trap');
    const trap = w.build('spike_trap', w.index(40, 40, 32), 'granite');
    const before = reader.reputation(caravan.civ);
    kill(caravan.guards[0]!, trap);
    expect(reader.reputation(caravan.civ)).toBe(Math.max(-100, before + REP_FORTRESS_KILL));
  });
});
