/** U-02, audit M1/S2: paused commands use the upcoming tick's command phase. */
import { describe, expect, it, vi } from 'vitest';
import { InProcessHost } from '@app/sim-host';
import { Game } from '@app/game';
import { HeadlessGame, FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { saveGame } from '@app/game-save';
import { replay } from '@app/replay';
import { C } from '@core/components';
import { Designation, TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { BuildingsReader } from '@systems/buildings';
import { MockCanvas, mockCanvasFactory } from './render/canvas-mock';
import { TestWorld } from '../scenarios/test-world';

const seed = 'U-02-paused-session';
const z = FLAT_TEST_SURFACE_Z;

async function host(): Promise<InProcessHost> {
  const out = new InProcessHost(() => 0);
  await out.newGame({ seed, embark: 'none' });
  return out;
}

function commands(h: InProcessHost): void {
  const at = (x: number, y: number, level = z): number => h.world.map.index(x, y, level);
  h.submit({ type: 'Designate', tiles: [at(20, 20, z - 1)], kind: 'dig', priority: 5 });
  h.submit({ type: 'PlaceBuilding', buildingType: 'wall', origin: at(25, 20), materialChoice: 'granite' });
  h.submit({ type: 'CreateZone', zoneType: 'stockpile', tiles: [at(30, 20), at(31, 20)] });
  h.submit({ type: 'RenameFortress', name: 'Paused hall' });
  h.submit({ type: 'Designate', tiles: [-1], kind: 'dig', priority: 5 });
}

describe('U-02 M1/S2 paused input', () => {
  it('shows designations, placements and zones immediately without running any other tick phase', async () => {
    const h = await host();
    const ticks = h.world.scheduler.inOrder().map((s) => vi.spyOn(s, 'tick'));
    const connectivity = vi.fn(h.world.connectivityPass ?? (() => {}));
    h.world.connectivityPass = connectivity;
    const after = vi.fn();
    h.afterTick = after;
    commands(h);
    expect(h.tick).toBe(0);
    expect(h.world.commands.size).toBe(0);
    expect(h.world.map.designationAt(h.world.map.index(20, 20, z - 1))).toBe(Designation.Dig);
    const buildings = h.readers.of<BuildingsReader>('14');
    expect(buildings.at(h.world.map.index(25, 20, z))).not.toBe(0);
    expect(buildings.zoneAt(h.world.map.index(30, 20, z))).not.toBe(0);
    expect(h.world.commandLog.all().map((e) => e.tick)).toEqual([0, 0, 0, 0, 0]);
    expect(h.world.commandLog.all().map((e) => e.result.ok)).toEqual([true, true, true, true, false]);
    for (const tick of ticks) expect(tick).not.toHaveBeenCalled();
    expect(connectivity).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it('reports a rejection once at submission and leaves command events for normal system dispatch', async () => {
    const h = await host();
    const seen: GameEvent[] = [];
    h.onEvents((batch) => seen.push(...batch));
    commands(h);
    expect(seen.map((e) => e.type)).toEqual(['CommandRejected']);
    expect(h.world.events.peek().some((e) => e.type === 'ZoneChanged')).toBe(true);
    h.step(1);
    expect(seen.filter((e) => e.type === 'CommandRejected')).toHaveLength(1);
    expect(seen.some((e) => e.type === 'ZoneChanged')).toBe(true);
  });

  it('records a mixed paused/running session and replays it with and without pauses to the same hash', async () => {
    const h = await host();
    commands(h);
    h.step(7);
    h.setSpeed(1);
    h.submit({ type: 'SetPopulationCap', n: 50 });
    h.step(4);
    h.setSpeed(0);
    h.submit({ type: 'RenameFortress', name: 'Resumed hall' });
    h.submit({ type: 'SetPopulationCap', n: 60 });
    h.step(9);
    const log = h.world.commandLog.serialize();
    const running = new HeadlessGame({ seed, embark: 'none' });
    replay(running, log, { until: h.tick });
    const paused = await host();
    for (let tick = 0; tick < h.tick; tick += 1) {
      for (const e of log.filter((e) => e.tick === tick)) paused.submit(e.command);
      paused.step(1);
    }
    expect(running.hash()).toBe(h.headless.hash());
    expect(paused.headless.hash()).toBe(h.headless.hash());
    expect(running.world.commandLog.all()).toEqual(log);
  });

  it('round-trips a save before the paused command events have been handled, then continues identically', async () => {
    const h = await host();
    commands(h);
    const pending = h.world.events.peek().slice();
    const log = h.world.commandLog.serialize();
    const hash = h.headless.hash();
    const blob = await h.save({ kind: 'manual' });
    const loaded = await host();
    await loaded.load(blob);
    expect(loaded.speed()).toBe(0);
    expect(loaded.tick).toBe(0);
    expect(loaded.headless.hash()).toBe(hash);
    expect(loaded.world.events.peek()).toEqual(pending);
    expect(loaded.world.commandLog.all()).toEqual(log);
    h.step(20);
    loaded.step(20);
    expect(loaded.headless.hash()).toBe(h.headless.hash());
  });

  it('keeps running commands queued and final saves read-only', async () => {
    const h = await host();
    h.setSpeed(1);
    h.submit({ type: 'RenameFortress', name: 'Running' });
    expect(h.world.fortress.name).toBe('Deepholm');
    h.step(1);
    expect(h.world.commandLog.all()[0]?.tick).toBe(0);
    h.setViewOnly(true);
    expect(h.submit({ type: 'RenameFortress', name: 'Forbidden' })).toBe(false);
    expect(h.world.fortress.name).toBe('Running');
  });

  it('keeps pending door connectivity across paused save/load, including the first resumed dwarf decision', async () => {
    const w = new TestWorld({ seed: 'U-02-paused-door', map: buildFlatTestMap(undefined, 32, 32), embark: 'none' });
    const granite = w.game.registry.table('materials').index('granite');
    for (let y = 0; y < w.map.h; y += 1) {
      if (y !== 15) w.game.world.services.terrain.setKind(w.index(20, y, z), TileKind.Wall, granite);
    }
    const door = w.build('door', w.index(20, 15, z), 'oak');
    const dwarf = w.spawnDwarf({ at: w.index(18, 15, z), name: 'Door probe' });
    w.step(1);
    w.setFluid(w.index(23, 15, z), 7, 'water', true);
    w.setNeed(dwarf, 'thirst', 80);
    const h = new InProcessHost(() => 0);
    await h.load(await saveGame(w.game, { kind: 'manual' }));
    h.submit({ type: 'SetDoorMode', buildingId: door, mode: 'locked' });
    const loaded = new InProcessHost(() => 0);
    await loaded.load(await h.save({ kind: 'manual' }));
    const from = w.index(18, 15, z); const to = w.index(22, 15, z);
    // The normal tick's connectivity pass has not run yet in either world.
    expect(h.readers.pathing.reachable(from, to, 'walker')).toBe(true);
    expect(loaded.readers.pathing.reachable(from, to, 'walker')).toBe(true);
    expect(loaded.headless.hash()).toBe(h.headless.hash());
    for (let tick = 0; tick < 20; tick += 1) {
      h.step(1); loaded.step(1);
      expect(loaded.headless.hash(), `resumed tick ${tick + 1}`).toBe(h.headless.hash());
      expect(loaded.world.entities.get(dwarf, C.Brain)).toEqual(h.world.entities.get(dwarf, C.Brain));
    }
    expect(h.readers.pathing.reachable(from, to, 'walker')).toBe(false);
    expect(loaded.readers.pathing.reachable(from, to, 'walker')).toBe(false);
  });

  it('keeps presentation listeners read-only when they submit during an immediate refusal batch', async () => {
    const h = await host();
    h.onEvents((batch) => {
      if (!batch.some((e) => e.type === 'CommandRejected')) return;
      expect(() => h.world.emit({ type: 'HourPassed', hour: 1 })).toThrow(/presentation listener/);
      h.submit({ type: 'RenameFortress', name: 'After the batch' });
      expect(h.world.fortress.name).toBe('Deepholm');
    });
    h.submit({ type: 'RenameFortress', name: '' });
    expect(h.world.commands.size).toBe(1);
    expect(h.world.events.isSealed).toBe(false);
    h.step(1);
    expect(h.world.fortress.name).toBe('After the batch');
    expect(h.world.commandLog.all().map((e) => e.tick)).toEqual([0, 0]);
  });

  it('shows the refusal in the status row and alert log with its focus before any tick', async () => {
    const game = new Game({ canvas: new MockCanvas(), createCanvas: mockCanvasFactory(), seed,
      width: 1280, height: 800 });
    await game.start({ embark: 'none' });
    const tile = game.host.world.map.index(20, 20, z);
    game.host.submit({ type: 'PlaceBuilding', buildingType: 'door', origin: tile });
    game.render();
    expect(game.host.tick).toBe(0);
    expect(game.textRows().join('\n')).toContain('Door needs walls on two opposite sides');
    const log = game.fortress.log.lines;
    const rejected = log.find((line) => line.text.includes('Door needs walls'));
    expect(rejected).toMatchObject({ severity: 'alert', focus: tile });
    expect(game.host.world.entities.with(C.Building)).toHaveLength(0);
  });
});
