/**
 * T-636: a Broker on duty with a squad works no job (10 § Behavior selection, step 5), so the trade
 * job is not held for them: another trading dwarf trades in their place, and the job goes back to
 * the Broker when the squad goes off duty. A stay that ends with the request still waiting says so
 * (`TradeMissed`).
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { Registrations, type TickContext } from '@core/system';
import type { CombatReader } from '@systems/combat';
import type { JobsReader } from '@systems/jobs';
import { CARAVAN_STAY_DAYS, type TradeSystem } from '@systems/trade';
import { TestWorld } from '../../scenarios/test-world';

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
  const depot = w.build('trade_depot', w.index(45, 8, 32), 'granite');
  w.until(() => w.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
  const broker = w.spawnDwarf({ at: w.index(60, 40, 32) });
  const other = w.spawnDwarf({ at: w.index(61, 40, 32) });
  w.step(1);
  const command = w.game.world.applyCommand.bind(w.game.world);
  expect(command({ type: 'AssignTitle', dwarfId: broker, title: 'broker' })).toEqual({ ok: true });
  expect(command({ type: 'CreateSquad', name: 'Gate Guard' })).toEqual({ ok: true });
  const combat = w.readers.of<CombatReader>('16');
  const squad = combat.squads()[0]!;
  expect(command({ type: 'SetSquadMembers', squadId: squad.id, members: [broker] })).toEqual({ ok: true });
  const jobs = w.readers.of<JobsReader>('11');
  const trade = w.game.world.scheduler.byId('20') as TradeSystem;
  const pending = () => jobs.byKey(`trade:${depot}`);
  const atDepot = w.game.world.entities.get(depot, C.Building)!.footprint[0]!;
  return { w, depot, broker, other, squad, combat, jobs, trade, pending, command, atDepot };
}

function context(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('20'), register: new Registrations(),
    jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain,
    spawn: w.game.world.services.spawn, emit: (event) => w.game.world.emit(event) };
}

/** Ends the caravan's stay on the next tick. */
function endStay(w: TestWorld, trade: TradeSystem): void {
  const state = trade.serialize();
  state.activeCaravan!.stateSince = w.tick - CARAVAN_STAY_DAYS * TICKS_PER_DAY;
  trade.deserialize(state, context(w));
}

describe('T-636 a trade does not wait for a Broker on squad duty', () => {
  it('opens the trade for any trading dwarf while the Broker drills, and that dwarf trades', () => {
    const { w, depot, broker, other, squad, combat, pending, command, atDepot, trade } = setup('t636-stand-in');
    expect(command({ type: 'SetSquadMode', squadId: squad.id, mode: 'train' })).toEqual({ ok: true });
    w.step(1);
    expect(combat.onDuty(broker)).toBe(true);
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    expect(pending()?.data['assignedWorker']).toBe(0);
    w.movement.teleport(other, atDepot);
    w.until(() => trade.reader().sessionOpen(), 300);
    expect(trade.reader().session()?.traderId).toBe(other);
  });

  it('takes a waiting job from the Broker when the squad goes on duty, and gives it back when it goes off', () => {
    const { w, depot, broker, squad, pending, command } = setup('t636-back');
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    expect(pending()?.data['assignedWorker']).toBe(broker);
    expect(command({ type: 'SetJobPriority', jobId: pending()!.id, priority: 2 })).toEqual({ ok: true });
    expect(command({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' })).toEqual({ ok: true });
    w.step(2);
    expect(pending()?.data['assignedWorker']).toBe(0);
    expect(pending()?.workerId).not.toBe(broker);
    expect(pending()?.priority).toBe(2);
    expect(command({ type: 'SetSquadMode', squadId: squad.id, mode: 'off' })).toEqual({ ok: true });
    w.step(2);
    expect(pending()?.data['assignedWorker']).toBe(broker);
    expect(pending()?.priority).toBe(2);
  });

  it('says so when the stay ends with the request still waiting, and not when no trade was asked for', () => {
    const { w, depot, other, squad, command, trade } = setup('t636-missed');
    expect(command({ type: 'SetLabor', dwarfId: other, labor: 'trading', on: false })).toEqual({ ok: true });
    expect(command({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' })).toEqual({ ok: true });
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    w.step(10);
    expect(w.events('TradeMissed')).toHaveLength(0);
    endStay(w, trade);
    w.step(1);
    expect(trade.reader().activeCaravan()?.state).toBe('leave');
    expect(w.events('TradeMissed')).toEqual([expect.objectContaining({ civ: trade.reader().activeCaravan()!.civ, depotId: depot, traderId: 0 })]);
  });

  it('raises nothing when the caravan leaves and nobody asked to trade', () => {
    const { w, trade } = setup('t636-unasked');
    endStay(w, trade);
    w.step(1);
    expect(trade.reader().activeCaravan()?.state).toBe('leave');
    expect(w.events('TradeMissed')).toHaveLength(0);
  });
});
