/**
 * T-M0-13's app layer: the in-process host, the frame loop and the fortress screen's map keys.
 *
 * `boot()` itself needs a DOM and is covered by the e2e `boot` spec; everything it wires is
 * injected here instead (`01-architecture/architecture-overview.md` § Dependency rule).
 */

import { describe, it, expect } from 'vitest';
import { loadContent } from '@content/loader';
import { MAX_TICKS_PER_FRAME, SIM_TICKS_PER_SECOND, STATUS_ROWS } from '@core/constants';
import { TileKind } from '@core/map3d';
import { LOG_ROWS } from '@render/constants';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { FrameDriver, InProcessHost, type SimulationHost, type Speed } from '@app/sim-host';
import { Game, testHook } from '@app/game';
import { MockCanvas, mockCanvasFactory } from './render/canvas-mock';

const registry = loadContent();

function newGame(): Game {
  return new Game({
    canvas: new MockCanvas(),
    seed: 'app-test',
    registry,
    createCanvas: mockCanvasFactory(),
    devicePixelRatio: 1,
    width: 1280,
    height: 800,
  });
}

describe('T-M0-13 sim host: InProcessHost', () => {
  it('refuses every call until newGame has built a world', () => {
    const host = new InProcessHost();
    expect(host.started).toBe(false);
    expect(() => host.step(1)).toThrow(/newGame/);
    expect(() => host.readers).toThrow(/newGame/);
    expect(() => host.stats()).toThrow(/newGame/);
    expect(() => host.world).toThrow(/newGame/);
  });

  it('builds the flat-test world, starts paused and steps on demand', async () => {
    const host = new InProcessHost();
    await host.newGame({ seed: 'app-test' });
    expect(host.started).toBe(true);
    expect(host.speed()).toBe(0);
    expect(host.readers.calendar.tick).toBe(0);
    expect(host.readers.map.kindAt(host.readers.map.index(10, 10, FLAT_TEST_SURFACE_Z))).toBe(
      TileKind.Floor,
    );
    host.step(5);
    expect(host.readers.calendar.tick).toBe(5);
    host.step(0);
    host.step(-1);
    expect(host.readers.calendar.tick).toBe(5);
    expect(host.stats().tick).toBe(5);
  });

  it('carries commands, events and the speed', async () => {
    const host = new InProcessHost();
    await host.newGame({ seed: 'app-test', fortressName: 'Deepholm' });
    const seen: string[] = [];
    const off = host.onEvents((events) => {
      for (const event of events) seen.push(event.type);
    });
    host.submit({ type: 'RenameFortress', name: 'Ironvein' });
    host.step(1);
    expect(host.world.fortress.name).toBe('Ironvein');
    host.submit({ type: 'SetPopulationCap', n: 5 });
    host.step(1);
    expect(seen).toContain('CommandRejected');
    off();
    for (const speed of [1, 2, 4, 0] as Speed[]) {
      host.setSpeed(speed);
      expect(host.speed()).toBe(speed);
    }
  });

  it('T-M2-11: save and load, the stubs of T-M0-13, round-trip the running game paused', async () => {
    const host = new InProcessHost();
    await host.newGame({ seed: 'app-test', embark: 'default' });
    host.step(20);
    const hash = host.headless.hash();
    const blob = await host.save({ kind: 'manual' });
    host.step(5);
    host.setSpeed(2);
    await host.load(blob);
    expect(host.headless.hash()).toBe(hash);
    expect(host.speed()).toBe(0);
  });
});

describe('T-M0-13 sim host: the frame loop', () => {
  function fakeHost(): SimulationHost & { ticks: number } {
    let speed: Speed = 1;
    const host = {
      ticks: 0,
      speed: () => speed,
      setSpeed: (s: Speed) => {
        speed = s;
      },
      step: (n: number) => {
        host.ticks += n;
      },
    } as unknown as SimulationHost & { ticks: number };
    return host;
  }

  it('steps whole ticks at the current speed and renders once per frame', () => {
    const host = fakeHost();
    let frames = 0;
    const driver = new FrameDriver({ host, render: () => (frames += 1) });
    driver.reset(0);
    // 1000 / (20 x 1) = 50 ms per tick.
    driver.onFrame(50, false);
    expect(host.ticks).toBe(1);
    expect(driver.lastFrameTicks).toBe(1);
    driver.onFrame(75, false);
    expect(host.ticks).toBe(1);
    expect(driver.accumulator).toBeCloseTo(25, 10);
    driver.onFrame(100, false);
    expect(host.ticks).toBe(2);
    expect(frames).toBe(3);
  });

  it('runs more ticks at a higher speed', () => {
    const host = fakeHost();
    host.setSpeed(4);
    const driver = new FrameDriver({ host, render: () => undefined });
    driver.reset(0);
    driver.onFrame(1000 / SIM_TICKS_PER_SECOND, false);
    expect(host.ticks).toBe(4);
  });

  it('never runs more than MAX_TICKS_PER_FRAME, and drops the rest instead of bursting', () => {
    const host = fakeHost();
    const driver = new FrameDriver({ host, render: () => undefined });
    driver.reset(0);
    // A one-second stall is capped at 250 ms, which is 5 ticks at 50 ms; a longer backlog would
    // still stop at MAX_TICKS_PER_FRAME.
    driver.onFrame(1000, false);
    expect(host.ticks).toBe(5);
    host.setSpeed(4);
    driver.reset(0);
    driver.onFrame(1000, false);
    expect(driver.lastFrameTicks).toBe(MAX_TICKS_PER_FRAME);
    expect(driver.accumulator).toBe(0);
  });

  it('simulates nothing while paused or hidden, and does not catch up afterwards', () => {
    const host = fakeHost();
    let frames = 0;
    const driver = new FrameDriver({ host, render: () => (frames += 1) });
    driver.reset(0);
    host.setSpeed(0);
    driver.onFrame(500, false);
    expect(host.ticks).toBe(0);
    expect(frames).toBe(1);
    host.setSpeed(1);
    driver.onFrame(1000, true);
    expect(host.ticks).toBe(0);
    // The first frame back runs only the time since that frame, not the whole pause.
    driver.onFrame(1050, false);
    expect(host.ticks).toBe(1);
  });
});

describe('T-M0-13 game: the fortress screen', () => {
  it('opens on the flat-test surface with the map centered and the sidebar closed', async () => {
    const game = newGame();
    expect(game.screen).toBe('fortress');
    await game.start();
    expect(game.ui.z).toBe(FLAT_TEST_SURFACE_Z);
    expect(game.ui.panel).toBeNull();
    expect(game.viewCols).toBe(80);
    expect(game.viewRows).toBe(50);
    const cells = game.cellBuffer();
    expect(cells?.cols).toBe(80);
    expect(cells?.rows).toBe(50);
    // The map is 96 wide in an 80-wide viewport, so the camera sits inside the map.
    expect(game.ui.camX).toBe(8);
    expect(game.ui.camY).toBeGreaterThanOrEqual(0);
    expect(game.renderer.frameCount).toBeGreaterThan(0);
  });

  it('pans by one cell, by ten with shift, and never outside the map', async () => {
    const game = newGame();
    await game.start();
    const startX = game.ui.camX;
    expect(game.handleKey({ key: '→', repeat: false, shift: false, ctrl: false, alt: false, meta: false })).toBe(true);
    expect(game.ui.camX).toBe(startX + 1);
    game.handleKey({ key: '←', repeat: false, shift: true, ctrl: false, alt: false, meta: false });
    expect(game.ui.camX).toBe(Math.max(0, startX + 1 - 10));
    for (let n = 0; n < 20; n += 1) {
      game.handleKey({ key: '↑', repeat: false, shift: true, ctrl: false, alt: false, meta: false });
    }
    expect(game.ui.camY).toBe(0);
    for (let n = 0; n < 40; n += 1) {
      game.handleKey({ key: '↓', repeat: false, shift: true, ctrl: false, alt: false, meta: false });
    }
    const map = game.host.readers.map;
    expect(game.ui.camY).toBe(map.h - (game.viewRows - STATUS_ROWS - LOG_ROWS));
  });

  it('changes the z-level with < and >, keeps the camera, and clamps at both ends', async () => {
    const game = newGame();
    await game.start();
    const camX = game.ui.camX;
    game.handleKey({ key: '>', repeat: false, shift: false, ctrl: false, alt: false, meta: false });
    expect(game.ui.z).toBe(FLAT_TEST_SURFACE_Z + 1);
    expect(game.ui.camX).toBe(camX);
    game.handleKey({ key: '<', repeat: false, shift: false, ctrl: false, alt: false, meta: false });
    game.handleKey({ key: ',', repeat: false, shift: false, ctrl: false, alt: false, meta: false });
    expect(game.ui.z).toBe(FLAT_TEST_SURFACE_Z - 1);
    game.handleKey({ key: '.', repeat: false, shift: false, ctrl: false, alt: false, meta: false });
    expect(game.ui.z).toBe(FLAT_TEST_SURFACE_Z);
    for (let n = 0; n < 60; n += 1) {
      game.handleKey({ key: '<', repeat: false, shift: false, ctrl: false, alt: false, meta: false });
    }
    expect(game.ui.z).toBe(0);
    for (let n = 0; n < 100; n += 1) {
      game.handleKey({ key: '>', repeat: false, shift: false, ctrl: false, alt: false, meta: false });
    }
    expect(game.ui.z).toBe(game.host.readers.map.d - 1);
  });

  it('ignores a key it does not own, and keeps the screen stack at fortress', async () => {
    const game = newGame();
    await game.start();
    expect(game.handleKey({ key: 'q', repeat: false, shift: false, ctrl: false, alt: false, meta: false })).toBe(false);
    game.popScreen();
    expect(game.screen).toBe('fortress');
    game.pushScreen('fortress');
    game.popScreen();
    expect(game.screen).toBe('fortress');
  });

  it('refits the grid on resize', async () => {
    const game = newGame();
    await game.start();
    game.resize(960, 600, 1);
    // 960 x 600 at zoom 1 gives 60 x 37 cells, below the minimum, so the zoom steps down.
    expect(game.ui.zoom).toBe(0.75);
    expect(game.viewCols).toBe(80);
    game.render();
    expect(game.cellBuffer()?.cols).toBe(80);
  });
});

describe('T-M0-13 game: the e2e test hook', () => {
  it('exposes the readers, the cells, the commands and the keys', async () => {
    const game = newGame();
    await game.start();
    const hook = testHook(game);
    expect(hook.readers.ui.z).toBe(FLAT_TEST_SURFACE_Z);
    expect(hook.readers.map.d).toBe(game.host.readers.map.d);
    expect(hook.readers.calendar.tick).toBe(0);
    expect(hook.readers.entities.count).toBe(0);
    expect(hook.readers.fortress.state.name.length).toBeGreaterThan(0);

    const cells = hook.cells();
    expect(cells.cols * cells.rows).toBe(cells.glyph.length);
    expect(cells.glyph.some((g) => g !== 0)).toBe(true);

    hook.key('>');
    expect(hook.readers.ui.z).toBe(FLAT_TEST_SURFACE_Z + 1);
    hook.key('←', true);
    expect(hook.readers.ui.camX).toBe(game.ui.camX);

    hook.setSpeed(1);
    expect(hook.host.speed()).toBe(1);
    hook.step(3);
    expect(hook.readers.calendar.tick).toBe(3);
    hook.submit({ type: 'RenameFortress', name: 'Emberhall' });
    hook.step(1);
    expect(hook.readers.fortress.state.name).toBe('Emberhall');
    expect(hook.screenshotName('boot')).toBe('reports/screenshots/boot.png');
  });

  it('reports an empty buffer before the first frame', () => {
    const game = newGame();
    const hook = testHook(game);
    expect(hook.cells()).toEqual({ cols: 0, rows: 0, glyph: [], fg: [], bg: [] });
  });
});
