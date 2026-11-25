/**
 * T-715: a trade does not wait behind the depot's hauls. The `trade` job comes at
 * `TRADE_JOB_PRIORITY`, above `haul_to_depot`, and calls its dwarf off interruptible work (11 §
 * Assignment), so the session opens while goods are still being carried; the depot's line says so
 * truthfully while no one holds the job; the trade screen counts the goods still on their way; and
 * goods left at the depot when the caravan departs go back to ordinary stock, with a note.
 */
import { describe, expect, it } from 'vitest';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import { Registrations, type TickContext } from '@core/system';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import { CARAVAN_LEAVE_DAYS, CARAVAN_STAY_DAYS, DEPOT_HAUL_PRIORITY, TRADE_JOB_PRIORITY, type TradeReader, type TradeSystem } from '@systems/trade';
import { AnnouncementLog } from '@ui/announcements';
import { tradeWait, tradeWaitFor } from '@ui/messages';
import type { PanelContext } from '@ui/panels/context';
import { drawLogPanel } from '@ui/panels/log';
import { TradeSessionScreen } from '@ui/screens/trade_session';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from '../ui/ui-fixture';

const Z = 32;

function setup(seed: string, goods: number) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
  const depot = w.build('trade_depot', w.index(45, 8, Z), 'granite');
  w.until(() => w.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
  const command = w.game.world.applyCommand.bind(w.game.world);
  // One dwarf trades; all four haul. No Broker.
  const trader = w.spawnDwarf({ at: w.index(70, 50, Z), name: 'Vali Hawktongue' });
  const haulers = [0, 1, 2].map((k) => w.spawnDwarf({ at: w.index(71 + k, 50, Z) }));
  for (const id of haulers) expect(command({ type: 'SetLabor', dwarfId: id, labor: 'trading', on: false })).toEqual({ ok: true });
  expect(command({ type: 'SetLabor', dwarfId: trader, labor: 'trading', on: true })).toEqual({ ok: true });
  const logs: number[] = [];
  for (let k = 0; k < goods; k += 1) logs.push(w.spawnItem('log', 'oak', w.index(60 + (k % 20), 52 + Math.floor(k / 20), Z)));
  w.step(1);
  const jobs = w.readers.of<JobsReader>('11');
  const trade = w.game.world.scheduler.byId('20') as TradeSystem;
  const reader = trade.reader();
  const ctx: PanelContext = {
    readers: w.readers, registry: w.game.registry, strings,
    submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
  return { w, depot, trader, haulers, logs, command, jobs, trade, reader, ctx };
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

function text(draw: (s: ReturnType<typeof surface>) => void, cols: number, rows: number): string {
  const s = surface(cols, rows);
  draw(s);
  return s.lines().map((line) => line.trimEnd()).join(' ').replace(/\s+/g, ' ');
}

describe('T-715 the trade does not wait behind the depot hauls', () => {
  it('opens the session within a day of TradeOpen while 60 goods are being hauled, the trader called off hauling', () => {
    const { w, depot, trader, logs, command, jobs, reader, ctx } = setup('t715-first', 60);
    expect(command({ type: 'MoveToDepot', depotId: depot, itemIds: logs })).toEqual({ ok: true });
    expect(jobs.byKey(`depot:${logs[0]}`)?.priority).toBe(DEPOT_HAUL_PRIORITY);
    w.until(() => jobs.typeOf(jobs.forWorker(trader)?.id ?? 0) === 'haul_to_depot', 600);
    expect(jobs.typeOf(jobs.forWorker(trader)!.id)).toBe('haul_to_depot');
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    const job = jobs.byKey(`trade:${depot}`)!;
    expect(job.priority).toBe(TRADE_JOB_PRIORITY);
    expect(TRADE_JOB_PRIORITY).toBeLessThan(DEPOT_HAUL_PRIORITY);
    // No one holds the job yet: the depot's line says so, and how many goods are still coming.
    const coming = reader.depotHauls(depot);
    expect(coming).toBeGreaterThan(50);
    expect(tradeWait(ctx, depot)).toBe(`No one has taken the trade yet: ${coming} goods are still being carried to the depot. No Broker: appoint one in Units [u].`);
    // The trader drops the haul and takes the trade at once.
    w.step(2);
    expect(jobs.byKey(`trade:${depot}`)?.workerId).toBe(trader);
    expect(tradeWait(ctx, depot)).toBe('Vali Hawktongue is on the way to the depot.');
    const opened = w.until(() => reader.sessionOpen(), TICKS_PER_DAY);
    expect(reader.sessionOpen()).toBe(true);
    expect(opened).toBeLessThan(TICKS_PER_DAY);
    expect(reader.session()?.traderId).toBe(trader);
    // The session opened before the haulers were done.
    expect(reader.depotHauls(depot)).toBeGreaterThan(0);
  });

  it('shows the goods at the depot so far, and those that arrive, with how many more are on the way', () => {
    const { w, depot, logs, command, reader } = setup('t715-screen', 30);
    expect(command({ type: 'MoveToDepot', depotId: depot, itemIds: logs })).toEqual({ ok: true });
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    w.until(() => reader.sessionOpen(), TICKS_PER_DAY);
    expect(reader.sessionOpen()).toBe(true);
    const screen = new TradeSessionScreen({ readers: w.readers, registry: w.game.registry, strings, submit: () => {}, commandTick: () => {}, back: () => {} });
    const before = reader.depotItems().length;
    const coming = reader.depotHauls(depot);
    expect(coming).toBeGreaterThan(0);
    expect(text((s) => screen.draw(s), 100, 40)).toContain(`${coming} more on the way`);
    w.until(() => reader.depotItems().length > before, TICKS_PER_DAY);
    const after = reader.depotItems().length;
    expect(after).toBeGreaterThan(before);
    const shown = text((s) => screen.draw(s), 100, 40);
    expect(shown.match(/ 1 oak log /g)?.length ?? 0).toBe(Math.min(after, 17));
    const left = reader.depotHauls(depot);
    if (left > 0) expect(shown).toContain(`${left} more on the way`);
    else expect(shown).not.toContain('more on the way');
  });

  it('gives back the goods left at the depot when the caravan departs, and says how many', () => {
    const { w, depot, logs, command, jobs, trade, reader } = setup('t715-return', 12);
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const items = w.readers.of<ItemsReader>('13');
    expect(command({ type: 'MoveToDepot', depotId: depot, itemIds: logs.slice(0, 8) })).toEqual({ ok: true });
    w.until(() => reader.depotItems().length === 8, 2 * TICKS_PER_DAY);
    expect(reader.depotItems()).toHaveLength(8);
    expect(items.available('log')).toBe(4);
    // Four more are marked; the caravan leaves before they are all carried.
    expect(command({ type: 'MoveToDepot', depotId: depot, itemIds: logs.slice(8) })).toEqual({ ok: true });
    endStay(w, trade);
    w.step(1);
    expect(reader.activeCaravan()?.state).toBe('leave');
    w.until(() => w.events('CaravanDeparted').length > 0, (CARAVAN_LEAVE_DAYS + 1) * TICKS_PER_DAY);
    expect(w.events('CaravanDeparted')).toHaveLength(1);
    const returned = w.events('DepotGoodsReturned');
    expect(returned).toHaveLength(1);
    const count = (returned[0] as unknown as { count: number }).count;
    expect(count).toBeGreaterThanOrEqual(8);
    expect(returned[0]).toEqual(expect.objectContaining({ depotId: depot }));
    // Nothing is at the depot or on its way there; every log is usable again.
    expect(reader.depotItems()).toHaveLength(0);
    expect(reader.depotHauls(depot)).toBe(0);
    expect(jobs.list().filter((job) => job.key.startsWith('depot:'))).toHaveLength(0);
    for (const id of logs) expect((w.game.world.entities.get(id, C.Item)!.flags & ItemFlag.AtDepot)).toBe(0);
    expect(items.available('log')).toBe(12);
    const line = log.announce(returned[0] as unknown as GameEvent, w.readers, w.tick);
    expect(line?.severity).toBe('note');
    expect(line?.line.text).toBe(`${count} goods taken back from Trade depot #1.`);
  });

  it('gives the missed trade its whole reason, hauls named, in a 36-column log', () => {
    const { w, depot, logs, command, reader, ctx } = setup('t715-missed', 20);
    expect(command({ type: 'MoveToDepot', depotId: depot, itemIds: logs })).toEqual({ ok: true });
    w.step(1);
    const coming = reader.depotHauls(depot);
    expect(coming).toBeGreaterThan(1);
    const why = tradeWaitFor(ctx, 0, 0, -1, true, depot);
    expect(why).toBe(`No one took the trade: ${coming} goods were still being carried to the depot.`);
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const civ = w.readers.of<TradeReader>('20').activeCaravan()!.civ;
    const missed = log.announce({ type: 'TradeMissed', civ, depotId: depot, traderId: 0 } as unknown as GameEvent, w.readers, w.tick);
    expect(missed?.severity).toBe('alert');
    expect(missed?.line.text).toMatch(new RegExp(`^The \\w+ caravan is leaving without trading\\. ${why.replace(/\./g, '\\.')}$`));
    const drawn = text((s) => drawLogPanel(s, { col: 0, row: 0, cols: 36, rows: 20 }, [missed!.line], 0, strings, w.tick, () => {}), 36, 20);
    expect(drawn).toContain('without trading. No one took the trade:');
    expect(drawn).toContain('still being carried to the depot.');
    expect(drawn).not.toContain('»');
  });
});
