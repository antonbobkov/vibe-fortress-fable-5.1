/**
 * T-800: the trade stays open while the caravan does (20 § The session): closing the screen hides it
 * and the next `[t]` makes no new trip; `[x]` (`TradeCancel`) ends the trade for the visit. A sleeping
 * Broker leaves the trade to another trading dwarf; a job that completes with the merchants off the
 * depot is re-queued once.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { Registrations, type TickContext } from '@core/system';
import type { BuildingsReader } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';
import type { TradeReader, TradeSystem } from '@systems/trade';
import type { PanelContext } from '@ui/panels/context';
import { tradeWait } from '@ui/messages';
import { TradeSessionScreen } from '@ui/screens/trade_session';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from '../ui/ui-fixture';

const Z = 32;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
  const depot = w.build('trade_depot', w.index(45, 8, Z), 'granite');
  w.until(() => w.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
  const broker = w.spawnDwarf({ at: w.index(60, 40, Z), name: 'Bjarni Marblehammer' });
  const other = w.spawnDwarf({ at: w.index(61, 40, Z), name: 'Orm Ashbrow' });
  w.step(1);
  const command = w.game.world.applyCommand.bind(w.game.world);
  expect(command({ type: 'AssignTitle', dwarfId: broker, title: 'broker' })).toEqual({ ok: true });
  for (const id of [broker, other]) for (const need of ['hunger', 'thirst', 'rest'] as const) w.setNeed(id, need, 0);
  const jobs = w.readers.of<JobsReader>('11');
  const reader = w.readers.of<TradeReader>('20');
  const trade = w.game.world.scheduler.byId('20') as TradeSystem;
  const ctx: PanelContext = {
    readers: w.readers, registry: w.game.registry, strings,
    submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
  return { w, depot, broker, other, command, jobs, reader, trade, ctx };
}

function context(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('20'), register: new Registrations(),
    jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain,
    spawn: w.game.world.services.spawn, emit: (event) => w.game.world.emit(event) };
}

function onDepot(w: TestWorld, depot: number, id: number): boolean {
  const pos = w.game.world.entities.get(id, C.Position);
  return pos !== undefined && (w.readers.of<BuildingsReader>('14').get(depot)?.footprint ?? []).includes(w.index(pos.x, pos.y, pos.z));
}

describe('T-800 the trade stays open while the caravan does', () => {
  it('keeps the session through a hidden and reopened screen, with no new trip, until [x] ends the trade', () => {
    const { w, depot, broker, command, jobs, reader, ctx } = setup('t800-open');
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    w.until(() => reader.sessionOpen(), 2000);
    expect(reader.session()?.traderId).toBe(broker);
    // The screen is hidden (`Esc`) and the game runs a quarter day: the session stays open.
    let hidden = false;
    const screen = new TradeSessionScreen({ readers: w.readers, registry: w.game.registry, strings, submit: (c) => command(c),
      commandTick: () => w.step(1), back: () => {}, hide: () => { hidden = true; } });
    screen.key({ key: 'Escape', shift: false, ctrl: false, alt: false, meta: false } as never);
    expect(hidden).toBe(true);
    expect(w.events('CommandRejected')).toEqual([]);
    w.step(TICKS_PER_DAY / 4);
    expect(reader.sessionOpen()).toBe(true);
    expect(tradeWait(ctx, depot)).toBe('The trade is open, Bjarni Marblehammer, the Broker, trading: [t] shows it.');
    // `[t]` again: no new job, no new trip.
    const trips = (): number => w.events('JobCreated').filter((e) => e['jobType'] === 'trade').length;
    const before = trips();
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    w.step(1);
    expect(trips()).toBe(before);
    expect(jobs.byKey(`trade:${depot}`)).toBeUndefined();
    expect(reader.session()?.traderId).toBe(broker);
    // `[x]` done trading: the session ends for the visit.
    screen.key({ key: 'x', shift: false, ctrl: false, alt: false, meta: false } as never);
    expect(reader.sessionOpen()).toBe(false);
    void onDepot;
  });

  it('leaves the trade to another trading dwarf while the Broker sleeps, and keeps it with them when the Broker wakes', () => {
    const { w, depot, broker, other, command, jobs, reader, ctx } = setup('t800-asleep');
    w.setLabor(other, 'trading', true);
    const r10 = w.readers.of<{ behavior(id: number): string; activityText(id: number): string }>('10');
    w.setNeed(broker, 'rest', 95);
    w.until(() => r10.behavior(broker) === 'need' && r10.activityText(broker) === 'sleep', 400);
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    const job = jobs.byKey(`trade:${depot}`)!;
    expect(job.data['assignedWorker']).toBe(0);
    expect(job.data['brokerAway']).toBe(true);
    expect(tradeWait(ctx, depot)).toMatch(/^(Bjarni Marblehammer, the Broker, is asleep: another dwarf with the trading labor trades instead\.|Orm Ashbrow is on the way to the depot, trading in place of the Broker\.)$/);
    w.until(() => jobs.byKey(`trade:${depot}`)?.workerId === other, 600);
    expect(jobs.byKey(`trade:${depot}`)?.workerId).toBe(other);
    // The Broker wakes: the stand-in keeps the trade.
    w.setNeed(broker, 'rest', 0);
    w.until(() => reader.sessionOpen(), 2000);
    expect(reader.session()?.traderId).toBe(other);
  });

  it('re-queues once a trade job that completes with the merchants off the depot', () => {
    const { w, depot, broker, command, jobs, trade } = setup('t800-retry');
    // The merchants step off the depot for good: their places are cleared to tiles outside it.
    const state = trade.serialize();
    const a = state.activeCaravan!;
    const outside = w.index(40, 20, Z);
    for (const id of a.merchants) {
      a.destinations[id] = outside;
      w.game.world.services.movement?.teleport(id, outside);
    }
    trade.deserialize(state, context(w));
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    const first = jobs.byKey(`trade:${depot}`)!.id;
    w.until(() => jobs.byKey(`trade:${depot}`)?.id !== first, 2000);
    const second = jobs.byKey(`trade:${depot}`);
    expect(second?.data['retried']).toBe(true);
    w.until(() => jobs.byKey(`trade:${depot}`) === undefined, 2000);
    expect(jobs.byKey(`trade:${depot}`)).toBeUndefined();
    expect(w.readers.of<TradeReader>('20').sessionOpen()).toBe(false);
    void broker;
  });
});
