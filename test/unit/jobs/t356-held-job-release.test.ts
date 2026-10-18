/** T-356: a job a worker holds while away from work goes back to the board after JOB_HOLD_TICKS. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { JobsReader } from '@systems/jobs';
import { JOB_HOLD_BACK_TICKS, JOB_HOLD_TICKS } from '@systems/jobs/constants';
import { TestWorld } from '../../scenarios/test-world';

describe('T-356 a job held through a long shelter goes back to the board', () => {
  it('releases a planting job (not interruptible) held under a hearth alert, and the alert end lets it be done', () => {
    const w = new TestWorld({ seed: 't356-hold', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const tile = w.index(30, 20, Z);
    const zoneId = w.zone('farm_plot', [tile]);
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: world.calendar.season, speciesId: 'barley' }).ok).toBe(true);
    w.spawnItem('seed', 'barley', w.index(36, 20, Z), 1);
    const dwarf = w.spawnDwarf({ at: w.index(24, 20, Z) });
    // A hearth hall to shelter in (as retreat.test.ts builds it).
    w.build('hearth', w.index(36, 30, Z), 'granite');
    for (let y = 27; y < 34; y += 1) for (let x = 34; x < 39; x += 1) world.services.terrain.setFlag(w.index(x, y, Z), TileFlag.Outdoor, false);
    const jobs = w.readers.of<JobsReader>('11');
    const key = `plant:${tile}`;
    for (let t = 0; t < 2 * TICKS_PER_HOUR && jobs.byKey(key)?.workerId !== dwarf; t += 1) w.step(1);
    expect(jobs.byKey(key)?.workerId, 'the dwarf took the planting job').toBe(dwarf);
    expect(world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(5);
    expect(world.entities.get(dwarf, C.Brain)?.behavior).not.toBe('work');
    // Held for a while: not interruptible, so the job stays the dwarf's.
    w.step(JOB_HOLD_TICKS - 20);
    expect(jobs.byKey(key)?.workerId).toBe(dwarf);
    w.step(40);
    const job = jobs.byKey(key);
    expect(job?.workerId, 'given back after JOB_HOLD_TICKS away').toBe(0);
    expect(job?.state).toBe('open');
    expect(jobs.forWorker(dwarf)).toBeUndefined();
    expect(world.applyCommand({ type: 'SetAlert', level: 'calm' }).ok).toBe(true);
    for (let t = 0; t < TICKS_PER_DAY && jobs.byKey(key) !== undefined; t += 50) w.step(50);
    expect(jobs.byKey(key), 'the job was taken again and done').toBeUndefined();
    expect(w.plants.cropAtTile.has(tile)).toBe(true);
  });

  it('T-370: a worker that bounces back to work for a moment does not restart the count', () => {
    const w = new TestWorld({ seed: 't370-bounce', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const tile = w.index(30, 20, Z);
    const zoneId = w.zone('farm_plot', [tile]);
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: world.calendar.season, speciesId: 'barley' }).ok).toBe(true);
    w.spawnItem('seed', 'barley', w.index(36, 20, Z), 1);
    const dwarf = w.spawnDwarf({ at: w.index(24, 20, Z) });
    const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;
    const quiet = (): void => { for (const need of NEEDS) w.setNeed(dwarf, need, 0); };
    w.build('hearth', w.index(36, 30, Z), 'granite');
    for (let y = 27; y < 34; y += 1) for (let x = 34; x < 39; x += 1) world.services.terrain.setFlag(w.index(x, y, Z), TileFlag.Outdoor, false);
    const jobs = w.readers.of<JobsReader>('11');
    const key = `plant:${tile}`;
    quiet();
    for (let t = 0; t < 2 * TICKS_PER_HOUR && jobs.byKey(key)?.workerId !== dwarf; t += 1) w.step(1);
    expect(jobs.byKey(key)?.workerId, 'the dwarf took the planting job').toBe(dwarf);
    expect(world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    quiet();
    w.step(JOB_HOLD_TICKS - 150);
    quiet();
    expect(jobs.byKey(key)?.workerId, 'still held').toBe(dwarf);
    // The alert lifts: the dwarf is at work for a few ticks (fewer than JOB_HOLD_BACK_TICKS), then the alert returns.
    expect(world.applyCommand({ type: 'SetAlert', level: 'calm' }).ok).toBe(true);
    let back = 0;
    for (let t = 0; t < 60 && world.entities.get(dwarf, C.Brain)?.behavior !== 'work'; t += 1) w.step(1);
    expect(world.entities.get(dwarf, C.Brain)?.behavior, 'the dwarf went back to work').toBe('work');
    while (back < 5 && jobs.byKey(key)?.workerId === dwarf) { w.step(1); back += 1; }
    expect(back).toBeLessThan(JOB_HOLD_BACK_TICKS);
    expect(world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    // The first absence began JOB_HOLD_TICKS - 150 + a few ticks ago: the count goes on, and the job is given back
    // well before JOB_HOLD_TICKS have passed since the second absence began.
    w.step(200);
    expect(jobs.byKey(key)?.workerId, 'given back on the count of the first absence').not.toBe(dwarf);
  });
});
