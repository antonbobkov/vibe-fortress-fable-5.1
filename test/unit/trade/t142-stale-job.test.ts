import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { roundTrip } from '@app/game-save';
import { Registrations, type TickContext } from '@core/system';
import type { JobsReader, JobsSystem } from '@systems/jobs';
import { CARAVAN_STAY_DAYS, type TradeSystem } from '@systems/trade';
import { TestWorld } from '../../scenarios/test-world';

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
  const depot = w.build('trade_depot', w.index(45, 8, 32), 'granite');
  w.until(() => w.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
  const broker = w.spawnDwarf({ at: w.index(60, 40, 32) });
  const next = w.spawnDwarf({ at: w.index(61, 40, 32) });
  w.step(1);
  const command = w.game.world.applyCommand.bind(w.game.world);
  expect(command({ type: 'AssignTitle', dwarfId: broker, title: 'broker' })).toEqual({ ok: true });
  expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
  const jobs = w.readers.of<JobsReader>('11');
  const trade = w.game.world.scheduler.byId('20') as TradeSystem;
  const pending = () => jobs.byKey(`trade:${depot}`);
  expect(pending()?.data['assignedWorker']).toBe(broker);
  const atDepot = w.game.world.entities.get(depot, C.Building)!.footprint[0]!;
  return { w, depot, broker, next, jobs, trade, pending, command, atDepot };
}
function context(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('20'), register: new Registrations(),
    jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain,
    spawn: w.game.world.services.spawn, emit: (event) => w.game.world.emit(event) };
}

describe('T-142 trade jobs belong to the caravan stay and current broker', () => {
  it('cancels the waiting job when the stay ends, before the caravan reaches the edge', () => {
    const { w, trade, pending } = setup('t142-depart');
    const state = trade.serialize();
    state.activeCaravan!.stateSince = w.tick - CARAVAN_STAY_DAYS * TICKS_PER_DAY;
    trade.deserialize(state, context(w));
    w.step(1);
    expect(trade.reader().activeCaravan()?.state).toBe('leave');
    expect(pending()).toBeUndefined();
    expect(w.events('JobCancelled').some((e) => e['jobType'] === 'trade')).toBe(true);
  });
  it('cancels the job immediately when an attack sends the caravan away', () => {
    const { w, trade, pending, broker } = setup('t142-attacked');
    const merchant = trade.serialize().activeCaravan!.merchants[0]!;
    w.game.world.emit({ type: 'AttackResolved', defenderId: merchant, attackerId: broker });
    w.step(1);
    expect(trade.reader().activeCaravan()?.state).toBe('leave');
    expect(pending()).toBeUndefined();
  });
  it('reissues a dead broker\'s job for a new broker and opens a session in the same stay', () => {
    const { w, broker, next, trade, pending, command, atDepot } = setup('t142-dead');
    w.game.world.emit({ type: 'CreatureDied', id: broker, cause: 'test' });
    w.step(1);
    expect(w.game.world.entities.alive(broker)).toBe(false);
    expect(command({ type: 'AssignTitle', dwarfId: next, title: 'broker' })).toEqual({ ok: true });
    w.movement.teleport(next, atDepot);
    w.step(1);
    expect(pending()?.data['assignedWorker']).toBe(next);
    w.until(() => trade.reader().sessionOpen(), 300);
    expect(trade.reader().session()?.traderId).toBe(next);
  });
  it('follows a title transfer and preserves the player\'s job priority', () => {
    const { w, next, pending, command } = setup('t142-title');
    expect(command({ type: 'SetJobPriority', jobId: pending()!.id, priority: 2 })).toEqual({ ok: true });
    expect(command({ type: 'AssignTitle', dwarfId: next, title: 'broker' })).toEqual({ ok: true });
    w.step(1);
    expect(pending()?.data['assignedWorker']).toBe(next);
    expect(pending()?.priority).toBe(2);
  });
  it('allows any trading worker when the broker\'s trading labor is disabled', () => {
    const { w, broker, pending, command } = setup('t142-labor');
    expect(command({ type: 'SetLabor', dwarfId: broker, labor: 'trading', on: false })).toEqual({ ok: true });
    w.step(1);
    expect(pending()?.data['assignedWorker']).toBe(0);
    expect(pending()?.workerId).not.toBe(broker);
  });
  it('repairs an existing worker when TradeOpen is repeated before event dispatch', () => {
    const { depot, next, pending, command } = setup('t142-repeat');
    expect(command({ type: 'AssignTitle', dwarfId: next, title: 'broker' })).toEqual({ ok: true });
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    expect(pending()?.data['assignedWorker']).toBe(next);
  });
  it('does not let a worker completing this tick open a session after trading is disabled', () => {
    const { w, broker, next, pending, command, atDepot, trade } = setup('t142-completion');
    w.movement.teleport(broker, atDepot);
    w.until(() => pending()?.workerId === broker, 100);
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const job = board.jobs.get(pending()!.id)!;
    expect(job.workerId).toBe(broker);
    job.state = 'working';
    job.data['effort'] = Number.MAX_SAFE_INTEGER;
    expect(command({ type: 'SetLabor', dwarfId: broker, labor: 'trading', on: false })).toEqual({ ok: true });
    w.step(1);
    expect(trade.reader().sessionOpen()).toBe(false);
    expect(pending()?.data['assignedWorker']).toBe(0);
    w.movement.teleport(next, atDepot);
    w.until(() => trade.reader().sessionOpen(), 300);
    expect(trade.reader().session()?.traderId).toBe(next);
  });
  it('keeps a waiting repaired job and subsequent simulation identical across save/load', () => {
    const { w, next, command } = setup('t142-save');
    command({ type: 'AssignTitle', dwarfId: next, title: 'broker' });
    w.step(1);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    w.step(100);
    loaded.step(100);
    expect(loaded.hash()).toBe(w.hash());
  });
});
