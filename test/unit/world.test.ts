import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Scheduler, isDue } from '@core/scheduler';
import { BaseSystem, NotYetImplementedError, Registrations, type InitContext, type SystemId, type TickContext } from '@core/system';
import { Map3D, TileFlag, TileKind } from '@core/map3d';
import { loadContent } from '@content/loader';
import { TICKS_PER_DAY, TICKS_PER_HOUR, TICKS_PER_YEAR } from '@core/constants';
import type { Command, CommandResult } from '@core/commands';
import type { GameEvent } from '@core/events';
import type { EventType } from '@core/event-types';
import type { CommandType } from '@core/command-types';

const registry = loadContent();

/** A recording system used in place of the real ones, which arrive in M1 and later. */
class FakeSystem extends BaseSystem<{ ticks: number[] }> {
  readonly id: SystemId;
  readonly order: number;
  override readonly cadence: number;
  override readonly phase: number;
  override readonly subscribes: readonly EventType[];
  override readonly ownsCommands: readonly CommandType[];

  ticks: number[] = [];
  handled: { tick: number; type: string }[] = [];
  initCalls = 0;
  onTick: ((ctx: TickContext) => void) | null = null;
  onHandle: ((event: GameEvent, ctx: TickContext) => void) | null = null;
  onCommand: ((cmd: Command) => CommandResult) | null = null;

  constructor(
    id: SystemId,
    order: number,
    options: {
      cadence?: number;
      phase?: number;
      subscribes?: EventType[];
      ownsCommands?: CommandType[];
    } = {},
  ) {
    super();
    this.id = id;
    this.order = order;
    this.cadence = options.cadence ?? 1;
    this.phase = options.phase ?? 0;
    this.subscribes = options.subscribes ?? [];
    this.ownsCommands = options.ownsCommands ?? [];
  }

  override init(_ctx: InitContext): void {
    this.initCalls += 1;
  }

  override tick(ctx: TickContext): void {
    this.ticks.push(ctx.tick);
    this.onTick?.(ctx);
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    this.handled.push({ tick: ctx.tick, type: event.type });
    this.onHandle?.(event, ctx);
  }

  override applyCommand(cmd: Command, _ctx: TickContext): CommandResult {
    return this.onCommand?.(cmd) ?? { ok: true };
  }

  override reader(): unknown {
    return { id: this.id };
  }

  serialize(): { ticks: number[] } {
    return { ticks: this.ticks.slice() };
  }

  deserialize(state: { ticks: number[] }): void {
    this.ticks = state.ticks.slice();
  }
}

function makeWorld(map?: Map3D): World {
  return new World({ seed: 'test-seed', registry, map: map ?? new Map3D(16, 16, 4) });
}

describe('T-M0-08 scheduler: cadence and phase', () => {
  it('(tick - phase) mod cadence == 0', () => {
    expect(isDue(0, 1, 0)).toBe(true);
    expect(isDue(3, 10, 3)).toBe(true);
    expect(isDue(13, 10, 3)).toBe(true);
    expect(isDue(23, 10, 3)).toBe(true);
    expect(isDue(4, 10, 3)).toBe(false);
    // The phase must not make early ticks fire through a negative modulo.
    expect(isDue(0, 50, 31)).toBe(false);
    expect(isDue(31, 50, 31)).toBe(true);
    expect(() => isDue(0, 0, 0)).toThrow(RangeError);
  });

  it('a system with cadence 10 phase 3 ticks at 3, 13 and 23', () => {
    const world = makeWorld();
    const system = new FakeSystem('05', 5, { cadence: 10, phase: 3 });
    world.addSystem(system);
    world.init();
    world.run(30);
    expect(system.ticks).toEqual([3, 13, 23]);
  });

  it('a cadence-1 system ticks every tick', () => {
    const world = makeWorld();
    const system = new FakeSystem('03', 3);
    world.addSystem(system);
    world.init();
    world.run(5);
    expect(system.ticks).toEqual([0, 1, 2, 3, 4]);
  });

  it('every documented cadence and phase of simulation-core.md fires when expected', () => {
    // A sample of the scheduler table: 04 fluids (2, 0), 15 morale (50, 23), 21 immigration
    // (1200, 600).
    expect(isDue(0, 2, 0)).toBe(true);
    expect(isDue(1, 2, 0)).toBe(false);
    expect(isDue(23, 50, 23)).toBe(true);
    expect(isDue(73, 50, 23)).toBe(true);
    expect(isDue(600, 1200, 600)).toBe(true);
    expect(isDue(1800, 1200, 600)).toBe(true);
    expect(isDue(0, 1200, 600)).toBe(false);
  });

  it('systems are held in ascending order whatever the registration order', () => {
    const scheduler = new Scheduler();
    scheduler.add(new FakeSystem('16', 16));
    scheduler.add(new FakeSystem('03', 3));
    scheduler.add(new FakeSystem('10', 10));
    expect(scheduler.inOrder().map((s) => s.id)).toEqual(['03', '10', '16']);
    expect(scheduler.size).toBe(3);
    expect(scheduler.byId('10')?.order).toBe(10);
    expect(scheduler.has('99')).toBe(false);
    expect(() => scheduler.add(new FakeSystem('03', 4))).toThrow(/duplicate/);
  });

  it('due() returns the due systems in system order', () => {
    const scheduler = new Scheduler();
    scheduler.add(new FakeSystem('13', 13, { cadence: 10, phase: 1 }));
    scheduler.add(new FakeSystem('04', 4, { cadence: 2, phase: 0 }));
    scheduler.add(new FakeSystem('03', 3));
    expect(scheduler.due(0).map((s) => s.id)).toEqual(['03', '04']);
    expect(scheduler.due(1).map((s) => s.id)).toEqual(['03', '13']);
  });

  it('timings accumulate through the injected clock', () => {
    let now = 0;
    const scheduler = new Scheduler(() => {
      now += 1;
      return now;
    });
    const system = new FakeSystem('03', 3);
    scheduler.add(system);
    scheduler.runTick(system, () => {});
    const stats = scheduler.stats();
    expect(stats[0]?.runs).toBe(1);
    expect(stats[0]?.lastMs).toBe(1);
    scheduler.resetStats();
    expect(scheduler.stats()[0]?.runs).toBe(0);
  });
});

describe('T-M0-08 world: system order is respected', () => {
  it('systems tick in ascending order within one tick', () => {
    const world = makeWorld();
    const order: string[] = [];
    for (const [id, n] of [
      ['16', 16],
      ['03', 3],
      ['10', 10],
    ] as [string, number][]) {
      const system = new FakeSystem(id, n);
      system.onTick = () => order.push(id);
      world.addSystem(system);
    }
    world.init();
    world.step();
    expect(order).toEqual(['03', '10', '16']);
  });

  it('init runs once per system and registers its reader', () => {
    const world = makeWorld();
    const a = new FakeSystem('03', 3);
    world.addSystem(a);
    world.init();
    world.init();
    expect(a.initCalls).toBe(1);
    expect(world.readers.of<{ id: string }>('03').id).toBe('03');
    expect(world.readers.has('04')).toBe(false);
    expect(() => world.addSystem(new FakeSystem('04', 4))).toThrow(/before init/);
  });

  it('each system gets its own rng stream, stable per id', () => {
    const world = makeWorld();
    const a = world.rngFor('03');
    expect(world.rngFor('03')).toBe(a);
    const b = world.rngFor('04');
    expect(a.nextU32()).not.toBe(b.nextU32());
    expect(world.rngState().map((s) => s.id)).toEqual(['03', '04']);
  });
});

describe('T-M0-08 world: applyCommand routing by owner', () => {
  it('routes a command to its owning system', () => {
    const world = makeWorld();
    const terrain = new FakeSystem('03', 3, { ownsCommands: ['Designate'] });
    const seen: Command[] = [];
    terrain.onCommand = (cmd) => {
      seen.push(cmd);
      return { ok: true };
    };
    world.addSystem(terrain);
    world.init();
    world.submit({ type: 'Designate', tiles: [1], kind: 1, priority: 5 });
    world.step();
    expect(seen.map((c) => c.type)).toEqual(['Designate']);
    expect(world.commandLog.length).toBe(1);
    expect(world.commandLog.all()[0]?.result).toEqual({ ok: true });
  });

  it('a command whose owner is not registered is rejected, not dropped', () => {
    const world = makeWorld();
    world.init();
    world.submit({ type: 'Designate', tiles: [1], kind: 1, priority: 5 });
    world.step();
    expect(world.commandLog.all()[0]?.result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('a system that does not claim the command rejects it', () => {
    const world = makeWorld();
    world.addSystem(new FakeSystem('03', 3, { ownsCommands: [] }));
    world.init();
    world.submit({ type: 'Designate', tiles: [1], kind: 1, priority: 5 });
    world.step();
    expect(world.commandLog.all()[0]?.result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('core owns RenameFortress and validates its length', () => {
    const world = makeWorld();
    world.init();
    world.submit({ type: 'RenameFortress', name: 'Ironvein' });
    world.step();
    expect(world.fortress.name).toBe('Ironvein');
    world.submit({ type: 'RenameFortress', name: '' });
    world.step();
    expect(world.fortress.name).toBe('Ironvein');
    expect(world.commandLog.all().at(-1)?.result).toEqual({ ok: false, reason: 'bad_name' });
  });

  it('commands are applied in submission order, before any system ticks', () => {
    const world = makeWorld();
    const order: string[] = [];
    const system = new FakeSystem('03', 3, { ownsCommands: ['Designate', 'SetTraffic'] });
    system.onCommand = (cmd) => {
      order.push(`cmd:${cmd.type}`);
      return { ok: true };
    };
    system.onTick = () => order.push('tick');
    world.addSystem(system);
    world.init();
    world.submit({ type: 'Designate', tiles: [1], kind: 1, priority: 5 });
    world.submit({ type: 'SetTraffic', tiles: [1], mode: 'restricted' });
    world.step();
    expect(order).toEqual(['cmd:Designate', 'cmd:SetTraffic', 'tick']);
  });
});

describe('T-M0-08 world: rejection produces CommandRejected', () => {
  it('a rejected command emits CommandRejected with the reason, dispatched next tick', () => {
    const world = makeWorld();
    const ui: GameEvent[] = [];
    world.onEvents((events) => ui.push(...events));
    const listener = new FakeSystem('03', 3, { subscribes: ['CommandRejected'] });
    world.addSystem(listener);
    world.init();
    world.submit({ type: 'SetPopulationCap', n: 5 });
    world.step();
    const rejected = ui.filter((e) => e.type === 'CommandRejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBe('not_found');
    expect(listener.handled.map((h) => h.type)).toEqual(['CommandRejected']);
  });

  it('an accepted command emits nothing', () => {
    const world = makeWorld();
    const ui: GameEvent[] = [];
    world.onEvents((events) => ui.push(...events));
    world.init();
    world.submit({ type: 'RenameFortress', name: 'Coldhammer' });
    world.step();
    expect(ui.filter((e) => e.type === 'CommandRejected')).toHaveLength(0);
  });
});

describe('T-M0-08 world: event dispatch', () => {
  it('handlers run in system order and see events in emission order', () => {
    const world = makeWorld();
    const seen: string[] = [];
    const emitter = new FakeSystem('03', 3);
    emitter.onTick = (ctx) => {
      if (ctx.tick !== 0) return;
      ctx.emit({ type: 'DwarfIdle', id: 1 });
      ctx.emit({ type: 'HourPassed', hour: 9 });
    };
    const late = new FakeSystem('16', 16, { subscribes: ['DwarfIdle', 'HourPassed'] });
    late.onHandle = (e) => seen.push(`16:${e.type}`);
    const early = new FakeSystem('10', 10, { subscribes: ['DwarfIdle', 'HourPassed'] });
    early.onHandle = (e) => seen.push(`10:${e.type}`);
    world.addSystem(emitter);
    world.addSystem(late);
    world.addSystem(early);
    world.init();
    world.step();
    expect(seen).toEqual([
      '10:DwarfIdle',
      '16:DwarfIdle',
      '10:HourPassed',
      '16:HourPassed',
    ]);
  });

  it('a system emitting during handle is delivered next tick', () => {
    const world = makeWorld();
    const reactor = new FakeSystem('10', 10, { subscribes: ['DwarfIdle'] });
    reactor.onHandle = (event, ctx) => {
      if (event.type === 'DwarfIdle') ctx.emit({ type: 'NeedCritical', id: 1, need: 'hunger' });
    };
    const observer = new FakeSystem('16', 16, { subscribes: ['NeedCritical'] });
    const emitter = new FakeSystem('03', 3);
    emitter.onTick = (ctx) => {
      if (ctx.tick === 0) ctx.emit({ type: 'DwarfIdle', id: 1 });
    };
    world.addSystem(emitter);
    world.addSystem(reactor);
    world.addSystem(observer);
    world.init();
    world.step();
    expect(observer.handled).toEqual([]);
    world.step();
    expect(observer.handled).toEqual([{ tick: 1, type: 'NeedCritical' }]);
  });

  it('boundary events emitted in step 5 are dispatched in the next tick', () => {
    const world = makeWorld();
    const system = new FakeSystem('06', 6, { subscribes: ['HourPassed'] });
    world.addSystem(system);
    world.init();
    world.run(TICKS_PER_HOUR);
    // calendar.advance emitted HourPassed at the end of tick TICKS_PER_HOUR - 1; not yet handled.
    expect(system.handled).toEqual([]);
    world.step();
    expect(system.handled).toEqual([{ tick: TICKS_PER_HOUR, type: 'HourPassed' }]);
  });

  it('a presentation listener may not emit events', () => {
    const world = makeWorld();
    world.onEvents(() => {
      world.events.emit({ type: 'DwarfIdle', id: 1 });
    });
    world.init();
    world.submit({ type: 'RenameFortress', name: '' });
    expect(() => world.step()).toThrow(/presentation listener/);
    // The queue is unsealed again even after the throw.
    expect(world.events.isSealed).toBe(false);
  });
});

describe('T-M0-08 world: core_calendar over a year', () => {
  it('a year of ticks yields one YearPassed, four SeasonChanged and 112 DayPassed', () => {
    const world = makeWorld();
    const counts = new Map<string, number>();
    world.onEvents((events) => {
      for (const e of events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    });
    world.init();
    world.run(TICKS_PER_YEAR + 1);
    expect(counts.get('YearPassed')).toBe(1);
    expect(counts.get('SeasonChanged')).toBe(4);
    expect(counts.get('DayPassed')).toBe(TICKS_PER_YEAR / TICKS_PER_DAY);
    expect(world.calendar.year).toBe(2);
  });
});

describe('T-M0-08 world: the tick context', () => {
  it('the terrain API writes through and batches one TilesChanged per tick', () => {
    const map = new Map3D(16, 16, 4);
    const world = makeWorld(map);
    const batches: GameEvent[] = [];
    world.onEvents((events) => batches.push(...events.filter((e) => e.type === 'TilesChanged')));
    const system = new FakeSystem('03', 3);
    system.onTick = (ctx) => {
      if (ctx.tick !== 0) return;
      ctx.terrain.setKind(5, TileKind.Wall, 1);
      ctx.terrain.setFlag(5, TileFlag.Discovered, true);
      ctx.terrain.setDesignation(6, 1, 5);
    };
    world.addSystem(system);
    world.init();
    world.step();
    world.step();
    expect(map.kindAt(5)).toBe(TileKind.Wall);
    expect(map.hasFlag(5, TileFlag.Discovered)).toBe(true);
    expect(map.designationAt(6)).toBe(1);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.tiles).toEqual([5, 6]);
  });

  it('the terrain API refuses an out-of-range tile', () => {
    const world = makeWorld();
    const system = new FakeSystem('03', 3);
    system.onTick = (ctx) => {
      if (ctx.tick === 0) ctx.terrain.setKind(999999, TileKind.Wall, 1);
    };
    world.addSystem(system);
    world.init();
    expect(() => world.step()).toThrow(RangeError);
  });

  it('the job and spawn APIs say plainly that they arrive later', () => {
    const world = makeWorld();
    const system = new FakeSystem('11', 11);
    let jobsError: unknown;
    let spawnError: unknown;
    system.onTick = (ctx) => {
      try {
        ctx.jobs.exists('dig:1');
      } catch (e) {
        jobsError = e;
      }
      try {
        ctx.spawn.item(1, 1, 0);
      } catch (e) {
        spawnError = e;
      }
    };
    world.addSystem(system);
    world.init();
    world.step();
    expect(jobsError).toBeInstanceOf(NotYetImplementedError);
    expect(spawnError).toBeInstanceOf(NotYetImplementedError);
  });

  it('the connectivity pass runs between the systems and the event dispatch', () => {
    const world = makeWorld();
    const order: string[] = [];
    world.connectivityPass = () => order.push('connectivity');
    const system = new FakeSystem('03', 3, { subscribes: ['DwarfIdle'] });
    system.onTick = (ctx) => {
      order.push('tick');
      if (ctx.tick === 0) ctx.emit({ type: 'DwarfIdle', id: 1 });
    };
    system.onHandle = () => order.push('handle');
    world.addSystem(system);
    world.init();
    world.step();
    expect(order).toEqual(['tick', 'connectivity', 'handle']);
  });
});

describe('T-M0-08 world: registration API', () => {
  it('collects every registration slot', () => {
    const registrations = new Registrations();
    registrations.jobProducer({ id: 'dig', produce: () => {} });
    registrations.recipeSet({ id: 'content', recipes: [] });
    registrations.thoughtSource({ on: ['MealEaten'], trigger: () => [] });
    registrations.overlay({ id: 'designations', label: 'Designations', defaultOn: true });
    registrations.panel({ id: 'designate', title: 'Designate', hotkey: 'd' });
    registrations.inspector('tile', { id: 'terrain', order: 1 });
    registrations.milestone({ id: 'm_hearth', trigger: 'HearthLit' });
    registrations.announcement('HearthLit', { severity: 'note', stringKey: 'milestone.m_hearth' });
    expect(registrations.jobProducers).toHaveLength(1);
    expect(registrations.recipeSets).toHaveLength(1);
    expect(registrations.thoughtSources).toHaveLength(1);
    expect(registrations.overlays).toHaveLength(1);
    expect(registrations.panels).toHaveLength(1);
    expect(registrations.inspectors).toHaveLength(1);
    expect(registrations.milestones).toHaveLength(1);
    expect(registrations.announcements).toHaveLength(1);
    registrations.clear();
    expect(registrations.jobProducers).toHaveLength(0);
  });

  it('systems register through ctx.register at init', () => {
    const world = makeWorld();
    const system = new FakeSystem('03', 3);
    system.init = (ctx: InitContext): void => {
      ctx.register.overlay({ id: 'designations', label: 'Designations', defaultOn: true });
    };
    world.addSystem(system);
    world.init();
    expect(world.registrations.overlays.map((o) => o.id)).toEqual(['designations']);
  });
});

describe('T-M0-08 world: core readers', () => {
  it('the map reader answers from the grids', () => {
    const map = new Map3D(16, 16, 4);
    const world = makeWorld(map);
    const i = map.index(3, 4, 2);
    map.setKind(i, TileKind.Floor, 7);
    map.setFlag(i, TileFlag.Outdoor, true);
    expect(world.readers.map.kindAt(i)).toBe(TileKind.Floor);
    expect(world.readers.map.materialAt(i)).toBe(7);
    expect(world.readers.map.isOutdoor(i)).toBe(true);
    expect(world.readers.map.isWalkable(i, 'walker')).toBe(true);
    expect(world.readers.map.neighbors(i)).toEqual(map.neighbors6(i));
    expect(world.readers.map.unpack(i)).toEqual({ x: 3, y: 4, z: 2 });
    expect(world.readers.map.columnSurfaceZ(3, 4)).toBe(2);
    expect(world.readers.map.chunkOf(i)).toBe(map.chunkOf(i));
  });

  it('passability and tile entities are pluggable, as 22 installs them', () => {
    const world = makeWorld();
    expect(world.readers.entities.at(0)).toEqual([]);
    world.readers.setPassability(() => true);
    world.readers.setTileEntities(() => [42]);
    expect(world.readers.map.isWalkable(0, 'walker')).toBe(true);
    expect(world.readers.entities.at(0)).toEqual([42]);
    expect(() => world.readers.of('pathing')).toThrow(RangeError);
  });

  it('the calendar and fortress readers follow the world', () => {
    const world = makeWorld();
    world.init();
    world.run(TICKS_PER_HOUR * 3);
    expect(world.readers.calendar.tick).toBe(TICKS_PER_HOUR * 3);
    expect(world.readers.calendar.hour).toBe(3);
    expect(world.readers.fortress.state.populationCap).toBe(80);
    expect(world.readers.fortress.state.alert).toBe('calm');
  });

  it('the entity reader mirrors the store', () => {
    const world = makeWorld();
    const id = world.entities.create('item');
    expect(world.readers.entities.alive(id)).toBe(true);
    expect(world.readers.entities.kind(id)).toBe('item');
    expect(world.readers.entities.count).toBe(1);
  });
});
