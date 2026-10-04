/** T-M8-02: clock policy, real expansion budgets, animal cadence and accessible status cells. */
import { describe, expect, it } from 'vitest';
import { LoadShedding, type SheddingRule } from '@app/load-shedding';
import { FrameDriver, InProcessHost, type SimulationHost, type Speed } from '@app/sim-host';
import { FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { Game } from '@app/game';
import { C } from '@core/components';
import { Map3D, TileKind } from '@core/map3d';
import { PATH_NODES_PER_TICK } from '@core/path-constants';
import { Pathfinder, TileGraph } from '@core/pathfinding';
import { AnimalsSystem, thinkInterval } from '@systems/animals';
import { TAME_THINK_TICKS, WILD_THINK_TICKS } from '@systems/animals/constants';
import { contentRegistry } from '@content/loader';
import { TestWorld } from '../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from './render/canvas-mock';

function policy() {
  const changes: [SheddingRule, boolean][] = [];
  const controller = new LoadShedding((rule, active) => changes.push([rule, active]));
  return { controller, changes };
}

describe('T-M8-02 load shedding: simulated clock', () => {
  it('engages once at two seconds strictly below 80%, and relaxes in reverse after five healthy seconds', () => {
    const { controller: c, changes } = policy();
    c.observe(0, 63.99, 80);
    c.observe(1999, 63.99, 80);
    expect(c.active).toBe(false);
    c.observe(2000, 63.99, 80);
    expect(changes).toEqual([[1, true], [2, true], [3, true]]);
    c.observe(3000, 10, 80);
    expect(changes).toHaveLength(3);
    c.observe(4000, 64, 80);
    c.observe(8999, 64, 80);
    expect(c.active).toBe(true);
    c.observe(9000, 64, 80);
    expect(c.active).toBe(false);
    expect(changes.slice(3)).toEqual([[3, false], [2, false], [1, false]]);
  });

  it('requires continuous low and healthy intervals, with equality treated as recovery', () => {
    const { controller: c } = policy();
    c.observe(0, 0, 20);
    c.observe(1500, 16, 20);
    c.observe(2000, 0, 20);
    c.observe(3999, 0, 20);
    expect(c.active).toBe(false);
    c.observe(4000, 0, 20);
    c.observe(5000, 20, 20);
    c.observe(9999, 15, 20);
    c.observe(10000, 20, 20);
    c.observe(14999, 20, 20);
    expect(c.active).toBe(true);
    c.observe(15000, 20, 20);
    expect(c.active).toBe(false);
  });

  it('interrupts streaks on pause and resets the switches on world replacement', () => {
    const { controller: c, changes } = policy();
    c.observe(0, 0, 20);
    c.observe(1900, 0, 0);
    c.observe(10000, 0, 20);
    c.observe(11999, 0, 20);
    expect(c.active).toBe(false);
    c.observe(12000, 0, 20);
    c.observe(13000, 20, 20);
    c.interrupt();
    c.observe(30000, 20, 20);
    expect(c.active).toBe(true);
    c.reset();
    expect(c.active).toBe(false);
    expect(changes.slice(-3)).toEqual([[3, false], [2, false], [1, false]]);
    c.reset();
    expect(changes).toHaveLength(6);
  });
});

function frameFixture(initial: Speed = 4) {
  const { controller, changes } = policy();
  let speed = initial;
  let tick = 0;
  let epoch = 0;
  const host = {
    speed: () => speed,
    setSpeed: (value: Speed) => { if (value !== speed) { epoch += 1; controller.interrupt(); } speed = value; },
    get tick() { return tick; },
    get rateEpoch() { return epoch; },
    step: (n: number) => { tick += n; },
    observeTickRate: (now: number, actual: number, requested: number) => controller.observe(now, actual, requested),
    interruptTickRate: () => controller.interrupt(),
  } as unknown as SimulationHost;
  const driver = new FrameDriver({ host, render: () => {} });
  driver.reset(0);
  return { host, driver, controller, changes };
}

describe('T-M8-02 load shedding: frame rate measurement', () => {
  it('engages after two stalled real seconds and recovers after five seconds at the requested 4x rate', () => {
    const { driver, controller } = frameFixture();
    driver.onFrame(1000, false);
    expect(controller.active).toBe(false);
    driver.onFrame(2000, false);
    expect(controller.active).toBe(true);
    for (let now = 2025; now < 7000; now += 25) driver.onFrame(now, false);
    expect(controller.active).toBe(true);
    driver.onFrame(7000, false);
    expect(controller.active).toBe(false);
  });

  it.each([1, 2, 4] as const)('does not mistake 60fps frames with zero ticks for underperformance at %sx', (speed) => {
    const { driver, controller, changes } = frameFixture(speed);
    for (let frame = 1; frame <= 600; frame += 1) driver.onFrame(frame * 1000 / 60, false);
    expect(controller.active).toBe(false);
    expect(changes).toEqual([]);
  });

  it('counts explicit host steps as actual completed simulation progress', () => {
    const { host, driver, controller } = frameFixture();
    for (let now = 1000; now <= 4000; now += 1000) {
      host.step(80);
      driver.onFrame(now, false);
    }
    expect(controller.active).toBe(false);
  });

  it('does not count a hidden interval when RAF stops and visibility resets the frame clock', () => {
    const { driver, controller } = frameFixture();
    driver.onFrame(1000, false);
    driver.reset(1500); // visibilitychange: hidden; no animation frames for the whole gap.
    driver.reset(40000); // visibilitychange: visible again.
    driver.onFrame(40000, false);
    expect(driver.lastFrameTicks).toBe(0);
    driver.onFrame(41000, false);
    expect(controller.active).toBe(false);
    driver.onFrame(42000, false);
    expect(controller.active).toBe(true);
  });

  it.each(['hidden', 'pause', 'speed'] as const)('%s interrupts a low-rate streak', (reason) => {
    const { host, driver, controller } = frameFixture();
    driver.onFrame(1000, false);
    if (reason === 'hidden') driver.onFrame(1500, true);
    if (reason === 'pause') { host.setSpeed(0); driver.onFrame(1500, false); host.setSpeed(4); }
    if (reason === 'speed') host.setSpeed(2);
    driver.onFrame(2000, false);
    expect(controller.active).toBe(false);
    driver.onFrame(3000, false);
    expect(controller.active).toBe(false);
    driver.onFrame(4000, false);
    expect(controller.active).toBe(true);
  });
});

function searchQueue(entities: number[], nonDwarf: (id: number) => boolean, enabled: boolean) {
  const map = new Map3D(96, 96, 1);
  map.kind.fill(TileKind.Floor);
  const goal = map.index(95, 95, 0);
  map.setKind(goal, TileKind.Wall, 1);
  const paths = new Pathfinder(map, new TileGraph(map));
  paths.setLoadShedding(enabled, nonDwarf);
  for (const id of entities) paths.requestPath(id, map.index(1, 1, 0), goal, 'walker', id <= 2 ? 'combat' : 'job', { nearest: true });
  return { paths, map, goal };
}

describe('T-M8-02 load shedding: actual path expansions', () => {
  it('halves the aggregate non-dwarf pool and keeps unfinished searches for the next tick', () => {
    const normal = searchQueue([1, 2, 3], () => true, false).paths;
    const shed = searchQueue([1, 2, 3], () => true, true).paths;
    expect(normal.tick()).toBe(PATH_NODES_PER_TICK);
    expect(shed.tick()).toBe(PATH_NODES_PER_TICK / 2);
    const snapshot = shed.saveState();
    expect(snapshot.requests.map((r) => r.expanded)).toEqual([8000, 4000, 0]);
    expect(snapshot.requests[1]?.state).toBe('running');
    expect(shed.tick()).toBe(12000);
    expect(shed.openRequests).toBe(0);
    for (let id = 4; id <= 6; id += 1) shed.requestPath(id, snapshot.requests[0]!.from, snapshot.requests[0]!.to, 'walker', 'job', { nearest: true });
    shed.setLoadShedding(false);
    expect(shed.tick()).toBe(PATH_NODES_PER_TICK);
  });

  it('leaves the whole global pool available to dwarves, including after high-urgency non-dwarf requests', () => {
    const mixed = searchQueue([1, 2, 3, 4], (id) => id <= 2, true).paths;
    expect(mixed.tick()).toBe(PATH_NODES_PER_TICK);
    const requests = mixed.saveState().requests;
    expect(requests.filter((r) => r.entity <= 2).reduce((sum, r) => sum + r.expanded, 0)).toBe(12000);
    expect(requests.filter((r) => r.entity > 2).reduce((sum, r) => sum + r.expanded, 0)).toBe(12000);
    expect(searchQueue([1, 2, 3], () => false, true).paths.tick()).toBe(PATH_NODES_PER_TICK);
  });

  it('does not serialize the policy switch or classifier', () => {
    const { paths } = searchQueue([1], () => true, false);
    const before = paths.saveState();
    paths.setLoadShedding(true);
    expect(paths.saveState()).toEqual(before);
  });
});

describe('T-M8-02 load shedding: host, animals and status', () => {
  it('changes only far wild cadence, preserves near and tame cadence, then recovers', () => {
    const w = new TestWorld({ seed: 'shedding-animals', map: buildFlatTestMap(undefined, 64, 64), embark: 'none' });
    const far = w.spawnCreature('deer', w.index(50, 50, FLAT_TEST_SURFACE_Z), 'wild');
    const near = w.spawnCreature('deer', w.index(10, 10, FLAT_TEST_SURFACE_Z), 'wild');
    w.spawnDwarf({ at: w.index(12, 10, FLAT_TEST_SURFACE_Z) });
    const tame = w.spawnTame('dog', w.index(8, 10, FLAT_TEST_SURFACE_Z));
    w.step(1);
    const hash = w.hash();
    w.animals.setLoadShedding(true);
    expect(w.hash()).toBe(hash);
    expect(thinkInterval(w.animals.brain, far)).toBe(20);
    expect(thinkInterval(w.animals.brain, near)).toBe(1);
    w.step(9);
    expect(w.game.world.entities.get(far, C.Wild)?.lastThinkTick).toBe(0);
    expect(w.game.world.entities.get(near, C.Wild)?.lastThinkTick).toBe(w.tick - 1);
    expect(w.animals.serialize().lastTameThink.find(([id]) => id === tame)?.[1]).toBe(0);
    w.step(1);
    expect(w.animals.serialize().lastTameThink.find(([id]) => id === tame)?.[1]).toBe(10);
    w.step(10);
    expect(w.game.world.entities.get(far, C.Wild)?.lastThinkTick).toBe(20);
    expect(w.animals.serialize().lastTameThink.find(([id]) => id === tame)?.[1]).toBe(20);
    w.animals.setLoadShedding(false);
    expect(thinkInterval(w.animals.brain, far)).toBe(WILD_THINK_TICKS);
    w.step(TAME_THINK_TICKS);
    expect(w.game.world.entities.get(far, C.Wild)?.lastThinkTick).toBe(30);
  });

  it('classifies dwarves by species, including merchants without a fortress brain, and resets on load/new game', async () => {
    const host = new InProcessHost(() => 0);
    await host.newGame({ seed: 'shedding-host', embark: 'none' });
    const game = host.headless;
    const from = game.map.index(5, 5, FLAT_TEST_SURFACE_Z);
    const trader = game.world.services.spawn.creature(game.registry.table('creatures').index('dwarf'), from, 'mountainhome');
    expect(game.world.entities.has(trader, C.Brain)).toBe(false);
    const deer = game.world.services.spawn.creature(game.registry.table('creatures').index('deer'), from, 'wild');
    const hash = game.hash();
    host.observeTickRate(0, 0, 80);
    host.observeTickRate(2000, 0, 80);
    expect(host.loadSheddingActive).toBe(true);
    expect(game.hash()).toBe(hash);
    expect(thinkInterval((game.world.scheduler.byId('08') as AnimalsSystem).brain, deer)).toBe(20);
    const paths = game.pathing.pathfinder;
    for (let k = 0; k < 3; k += 1) {
      const goal = game.map.index(90 + k, 90, FLAT_TEST_SURFACE_Z);
      game.map.setKind(goal, TileKind.Wall, 1);
      paths.requestPath(trader, from, goal, 'walker', 'job', { nearest: true });
    }
    expect(paths.tick()).toBe(PATH_NODES_PER_TICK);
    for (let k = 0; k < 3; k += 1) {
      const goal = game.map.index(94, 90 + k, FLAT_TEST_SURFACE_Z);
      game.map.setKind(goal, TileKind.Wall, 1);
      paths.requestPath(deer, from, goal, 'walker', 'job', { nearest: true });
    }
    expect(paths.tick()).toBe(PATH_NODES_PER_TICK / 2);
    const blob = await host.save({ kind: 'manual' });
    await host.load(blob);
    expect(host.loadSheddingActive).toBe(false);
    expect(host.speed()).toBe(0);
    expect(thinkInterval((host.world.scheduler.byId('08') as AnimalsSystem).brain, deer)).toBe(10);
    host.observeTickRate(3000, 0, 80);
    host.observeTickRate(5000, 0, 80);
    await host.newGame({ seed: 'shedding-replacement', embark: 'none' });
    expect(host.loadSheddingActive).toBe(false);
  });

  it.each([false, true])('draws the speed yellow with the word slow and restores it (colorblind=%s)', async (colorblind) => {
    const game = new Game({ canvas: new MockCanvas(), createCanvas: mockCanvasFactory(), registry: contentRegistry(), seed: 'shedding-ui',
      devicePixelRatio: 1, width: 1920, height: 800, colorblind });
    await game.start();
    game.host.setSpeed(4);
    game.render();
    const normal = game.cellBuffer()!;
    const arrow = game.glyphs.index('►');
    const column = Array.from(normal.glyph).indexOf(arrow);
    expect(column).toBeGreaterThan(0);
    const normalColor = normal.fg[column];
    game.host.observeTickRate(0, 0, 80);
    game.host.observeTickRate(2000, 0, 80);
    game.render();
    expect(game.cellBuffer()!.fg[column]).toBe(game.palette.color('yellow'));
    expect(game.textRows().join('\n')).toContain('►►► 4x slow');
    game.host.observeTickRate(3000, 80, 80);
    game.host.observeTickRate(8000, 80, 80);
    game.render();
    expect(game.cellBuffer()!.fg[column]).toBe(normalColor);
    expect(game.textRows().join('\n')).not.toContain('slow');
  });
});
