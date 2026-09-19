/**
 * T-M2-12 command log and replay: the log keeps the current season, a season's log replayed on the
 * save taken at its start reproduces the end hash, and the log a later save carries is readable
 * by the replay script's reader.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fc from 'fast-check';
import { HeadlessGame } from '@app/headless';
import { roundTrip, saveGame } from '@app/game-save';
import { readLog, replay, replayFiles } from '@app/replay';
import { TICKS_PER_DAY, DAYS_PER_SEASON } from '@core/constants';
import { TestWorld } from '../scenarios/test-world';
import { prepareBusyFortress } from '../scenarios/core_save_roundtrip.scenario';
import { commandStream, type ScheduledCommand } from '../property/command-generators';

const SEASON = TICKS_PER_DAY * DAYS_PER_SEASON;

function drive(game: HeadlessGame, stream: readonly ScheduledCommand[], ticks: number): void {
  let next = 0;
  for (let t = 0; t < ticks; t += 1) {
    while (next < stream.length && (stream[next] as ScheduledCommand).tick <= t) {
      if ((stream[next] as ScheduledCommand).tick === t) game.world.submit((stream[next] as ScheduledCommand).command);
      next += 1;
    }
    game.step(1);
  }
}

describe('T-M2-12 command log and replay', () => {
  it('the log keeps only the current season', () => {
    const game = new HeadlessGame({ seed: 'replay-season', world: 'flat-test', startTick: SEASON - 3 });
    game.world.submit({ type: 'RenameFortress', name: 'Before' });
    game.step(1);
    expect(game.world.commandLog.length).toBe(1);
    game.step(2);
    expect(game.tick).toBe(SEASON);
    expect(game.world.commandLog.length).toBe(0);
    game.world.submit({ type: 'RenameFortress', name: 'After' });
    game.step(1);
    expect(game.world.commandLog.all().map((e) => e.tick)).toEqual([SEASON]);
  });

  it('replaying a season log from a save reproduces the end hash', async () => {
    const w = new TestWorld({ seed: 'replay-log', world: 'flat-test', embark: 'default' });
    prepareBusyFortress(w);
    w.step(30);
    const save = await saveGame(w.game, { kind: 'auto' });
    const probe = new TestWorld({ seed: 'replay-log', world: 'flat-test', embark: 'default' });
    const stream = fc.sample(commandStream(probe, 1, 800), { numRuns: 1, seed: 11 })[0] ?? [];
    expect(stream.length).toBeGreaterThan(0);
    drive(w.game, stream, 800);
    const end = w.hash();
    const log = w.game.world.commandLog.all();
    expect(log.length).toBeGreaterThan(0);

    const later = await saveGame(w.game, { kind: 'manual' });
    const { points, start } = await replayFiles(save, later, { until: w.tick });
    expect(start).toBe(w.tick - 800);
    expect(points[points.length - 1]).toEqual({ tick: w.tick, hash: end });
    expect(points.filter((p) => p.tick % 100 === 0).length).toBeGreaterThanOrEqual(7);
    expect(await readLog(new TextEncoder().encode(JSON.stringify(log)))).toEqual(JSON.parse(JSON.stringify(log)));
  });

  it('replay skips entries from before the save and hashes every 100 ticks', () => {
    const a = new HeadlessGame({ seed: 'replay-skip', world: 'flat-test', embark: 'default' });
    a.world.submit({ type: 'RenameFortress', name: 'Early' });
    a.step(10);
    const b = roundTrip(a).game;
    a.world.submit({ type: 'RenameFortress', name: 'Later' });
    a.step(250);
    const points = replay(b, a.world.commandLog.all(), { until: a.tick });
    expect(b.world.fortress.name).toBe('Later');
    expect(points.map((p) => p.tick)).toEqual([...points.filter((p) => p.tick % 100 === 0).map((p) => p.tick), a.tick].filter((t, k, all) => all.indexOf(t) === k));
    expect(b.hash()).toBe(a.hash());
  });

  it('scripts/replay.mjs prints its usage without a save and a log', () => {
    const r = spawnSync(process.execPath, ['scripts/replay.mjs'], { encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('usage: node scripts/replay.mjs <save> <log>');
  });
});
