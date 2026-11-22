/**
 * T-636: a waiting trade request says who it waits for and why (`panels.md` § Depot, §
 * Civilizations): the depot's line, the Civilizations line and the `[t]` notice; a caravan that
 * leaves with the request unserved raises an alert that says why (`TradeMissed`); the Jobs panel
 * names the job by its depot.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import { Registrations, type TickContext } from '@core/system';
import type { CombatReader } from '@systems/combat';
import { CARAVAN_STAY_DAYS, type TradeSystem } from '@systems/trade';
import { AnnouncementLog } from '@ui/announcements';
import { brokerOnWay, tradeWait } from '@ui/messages';
import { drawCivilizationsPanel, CivilizationsPanel, TRADE_CIVILIZATIONS } from '@ui/panels/civilizations';
import type { PanelContext } from '@ui/panels/context';
import { DepotPanel, drawDepotPanel } from '@ui/panels/depot';
import { drawJobsPanel, JobsPanel } from '@ui/panels/jobs';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', startTick: 31 * TICKS_PER_DAY });
  const depot = w.build('trade_depot', w.index(45, 8, 32), 'granite');
  w.until(() => w.events('CaravanAtDepot').length > 0, 20 * TICKS_PER_DAY);
  const broker = w.spawnDwarf({ at: w.index(60, 40, 32), name: 'Geir Ashsong' });
  const other = w.spawnDwarf({ at: w.index(61, 40, 32), name: 'Orm Ashbrow' });
  w.step(1);
  const command = w.game.world.applyCommand.bind(w.game.world);
  expect(command({ type: 'AssignTitle', dwarfId: broker, title: 'broker' })).toEqual({ ok: true });
  expect(command({ type: 'CreateSquad', name: 'Gate Guard' })).toEqual({ ok: true });
  const squad = w.readers.of<CombatReader>('16').squads()[0]!;
  expect(command({ type: 'SetSquadMembers', squadId: squad.id, members: [broker] })).toEqual({ ok: true });
  const ctx: PanelContext = {
    readers: w.readers, registry: w.game.registry, strings,
    submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
  const trade = w.game.world.scheduler.byId('20') as TradeSystem;
  return { w, depot, broker, other, squad, command, ctx, trade };
}

function context(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('20'), register: new Registrations(),
    jobs: w.game.world.services.jobs, terrain: w.game.world.services.terrain,
    spawn: w.game.world.services.spawn, emit: (event) => w.game.world.emit(event) };
}

function text(draw: (s: ReturnType<typeof surface>) => void, cols = 36, rows = 30): string {
  const s = surface(cols, rows);
  draw(s);
  return s.lines().map((line) => line.trimEnd()).join(' ').replace(/\s+/g, ' ');
}

const ON_DUTY_NOBODY = 'Geir Ashsong, the Broker, is on duty with Gate Guard, and no other dwarf has the trading labor: set the squad to Off [m], or turn on trading for another dwarf [l].';

describe('T-636 a waiting trade says who it waits for and why', () => {
  it('names the Broker on squad duty, with no one else to trade, in the notice, the depot panel and Civilizations', () => {
    const { w, depot, other, squad, command, ctx } = setup('t636-ui-duty');
    expect(command({ type: 'SetLabor', dwarfId: other, labor: 'trading', on: false })).toEqual({ ok: true });
    expect(command({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' })).toEqual({ ok: true });
    w.step(1);
    // The `[t]` notice, before the request's job exists.
    expect(brokerOnWay(ctx, depot, true)).toBe(`${ON_DUTY_NOBODY} · [Space] resumes`);
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    w.step(1);
    expect(tradeWait(ctx, depot)).toBe(ON_DUTY_NOBODY);
    const panel = new DepotPanel();
    panel.select(ctx, depot);
    expect(text((s) => drawDepotPanel(s, { col: 0, row: 0, cols: 36, rows: 30 }, panel, ctx, () => {}))).toContain('is on duty with Gate Guard, and no other dwarf has the trading labor');
    const civs = new CivilizationsPanel();
    civs.selected = TRADE_CIVILIZATIONS.indexOf(w.readers.of<{ activeCaravan(): { civ: string } | null }>('20').activeCaravan()!.civ as never);
    expect(text((s) => drawCivilizationsPanel(s, { col: 0, row: 0, cols: 36, rows: 30 }, civs, ctx, () => {}))).toContain('is on duty with Gate Guard, and no other dwarf has the trading labor');
  });

  it('says another dwarf trades while the Broker is on duty, and who is on the way once one comes', () => {
    const { w, depot, other, squad, command, ctx } = setup('t636-ui-stand-in');
    expect(command({ type: 'SetSquadMode', squadId: squad.id, mode: 'train' })).toEqual({ ok: true });
    w.step(1);
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    expect(tradeWait(ctx, depot)).toBe('Geir Ashsong, the Broker, is on duty with Gate Guard: another dwarf with the trading labor trades instead. Set the squad to Off [m] for the Broker.');
    w.until(() => w.readers.of<{ byKey(key: string): { workerId: number } | undefined }>('11').byKey(`trade:${depot}`)?.workerId === other, 200);
    expect(tradeWait(ctx, depot)).toBe('Orm Ashbrow is on the way to the depot, trading in place of the Broker.');
  });

  it('says the Broker will come after sleeping', () => {
    const { w, depot, broker, command, ctx } = setup('t636-ui-asleep');
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    const brain = w.game.world.entities.get(broker, C.Brain)!;
    w.game.world.entities.add(broker, C.Brain, { ...brain, behavior: 'need', activity: 'sleep' });
    expect(tradeWait(ctx, depot)).toBe('Geir Ashsong, the Broker, is asleep: on the way after.');
  });

  it('raises an alert when the caravan leaves with the request unserved, saying why', () => {
    const { w, depot, other, squad, command, trade } = setup('t636-ui-missed');
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    expect(command({ type: 'SetLabor', dwarfId: other, labor: 'trading', on: false })).toEqual({ ok: true });
    expect(command({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' })).toEqual({ ok: true });
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    w.step(1);
    const civ = trade.reader().activeCaravan()!.civ;
    const state = trade.serialize();
    state.activeCaravan!.stateSince = w.tick - CARAVAN_STAY_DAYS * TICKS_PER_DAY;
    trade.deserialize(state, context(w));
    w.step(1);
    const missed = w.events('TradeMissed')[0] as unknown as GameEvent;
    expect(missed).toBeDefined();
    const announced = log.announce(missed, w.readers, w.tick);
    expect(announced?.severity).toBe('alert');
    const name = w.game.registry.table<{ id: string; name: string }>('civilizations').byId(civ)!.name.replace(/^the /, '');
    expect(announced?.line.text).toBe(`The ${name.charAt(0).toUpperCase()}${name.slice(1)} caravan is leaving without trading. ${ON_DUTY_NOBODY}`);
  });

  it('names a trade job in the Jobs panel by its depot', () => {
    const { w, depot, command, ctx } = setup('t636-ui-jobs');
    expect(command({ type: 'TradeOpen', depotId: depot })).toEqual({ ok: true });
    expect(w.game.world.entities.has(depot, C.Building)).toBe(true);
    expect(text((s) => drawJobsPanel(s, { col: 0, row: 0, cols: 60, rows: 30 }, new JobsPanel(), ctx), 60)).toContain('5 Trade, depot #1 ');
  });
});
