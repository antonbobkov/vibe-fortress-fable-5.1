import { describe, expect, it } from 'vitest';
import { Scheduler, TimingWindow } from '@core/scheduler';
import { BaseSystem } from '@core/system';
import { SIM_TICKS_PER_SECOND } from '@core/constants';
import { InProcessHost } from '@app/sim-host';
import { timingRows } from '@ui/panels/debug';

class Probe extends BaseSystem<null> {
  readonly id = '03';
  readonly order = 3;
  override readonly cadence = 2;
  serialize(): null { return null; }
  deserialize(): void {}
}

describe('T-M8-01 diagnostic moving timings', () => {
  it('host.stats uses the injected platform clock, including after a save/load', async () => {
    let time = 0;
    const host = new InProcessHost(() => { time += 0.1; return time; });
    await host.newGame({ seed: 'm801-timings', embark: 'none' });
    host.step(1);
    expect(host.stats().movingAverageTickMs).toBeGreaterThan(0);
    expect(host.stats().rollingWorstTickMs).toBe(host.stats().lastTickMs);
    expect(host.stats().systems.some((s) => s.movingAverageMs > 0)).toBe(true);
    const blob = await host.save({ kind: 'manual' });
    await host.load(blob);
    expect(host.stats().movingAverageTickMs).toBe(0);
    host.step(1);
    expect(host.stats().movingAverageTickMs).toBeGreaterThan(0);
  });
  it('expires the average and worst after one simulated second of ticks', () => {
    const window = new TimingWindow();
    expect(window.average).toBe(0);
    expect(window.worst).toBe(0);
    window.add(100);
    for (let n = 1; n < SIM_TICKS_PER_SECOND; n++) window.add(2);
    expect(window.average).toBe((100 + (SIM_TICKS_PER_SECOND - 1) * 2) / SIM_TICKS_PER_SECOND);
    expect(window.worst).toBe(100);
    window.add(2);
    expect(window.average).toBe(2);
    expect(window.worst).toBe(2);
  });

  it('amortizes cadences over world ticks, retains the lifetime worst, resets, and returns copies', () => {
    let time = 0;
    const scheduler = new Scheduler(() => time);
    const probe = new Probe();
    scheduler.add(probe);
    scheduler.runTick(probe, () => { time += 8; });
    scheduler.finishTick();
    scheduler.finishTick();
    expect(scheduler.stats()[0]).toMatchObject({ movingAverageMs: 4, rollingWorstMs: 8, worstMs: 8, totalMs: 8, runs: 1 });
    expect(timingRows({ tick: 2, lastTickMs: 0, systems: scheduler.stats() })[0])
      .toMatchObject({ avgMs: 4, worstMs: 8 });
    const copy = scheduler.stats()[0];
    if (copy !== undefined) copy.totalMs = 99;
    expect(scheduler.stats()[0]?.totalMs).toBe(8);
    for (let n = 0; n < SIM_TICKS_PER_SECOND; n++) scheduler.finishTick();
    expect(scheduler.stats()[0]).toMatchObject({ movingAverageMs: 0, rollingWorstMs: 0, worstMs: 8 });
    scheduler.resetStats();
    expect(scheduler.stats()[0]).toMatchObject({ movingAverageMs: 0, worstMs: 0, totalMs: 0, runs: 0 });
  });
});
