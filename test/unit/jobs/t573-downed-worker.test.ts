/**
 * T-573: a job keeps no worker who is down. The sweep's invariant `job.worker-unconscious` found a `plant`
 * job in `fetching` (T-571, `three-years-p2-4`, shift 200) and a `craft` job (T-548, `three-years-p4-4`)
 * still naming a worker who had fallen unconscious: nothing gave the job back while the worker lay there,
 * and a worker freed while down was offered the next job. 11 § Job steps: a worker that is down
 * (unconscious, or with no tile) gives its job back as an interruption does, progress kept, and is
 * offered none until it is up.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { JobsReader, JobsSystem } from '@systems/jobs';
import type { Job } from '@systems/jobs/state';
import { TestWorld } from '../../scenarios/test-world';

const NEEDS = ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const;

function quiet(w: TestWorld, id: EntityId): void {
  for (const need of NEEDS) w.setNeed(id, need, 0);
}

function farm(seed: string): { w: TestWorld; dwarf: EntityId; tile: number; key: string; jobs: JobsReader } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const tile = w.index(30, 20, Z);
  const zoneId = w.zone('farm_plot', [tile]);
  expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: world.calendar.season, speciesId: 'barley' }).ok).toBe(true);
  w.spawnItem('seed', 'barley', w.index(40, 20, Z), 1);
  const dwarf = w.spawnDwarf({ at: w.index(24, 20, Z) });
  quiet(w, dwarf);
  return { w, dwarf, tile, key: `plant:${tile}`, jobs: w.readers.of<JobsReader>('11') };
}

/** Steps until the dwarf holds the planting job in `fetching` with the seed in hand. */
function midFetch(f: ReturnType<typeof farm>): Job {
  const { w, dwarf, key, jobs } = f;
  for (let t = 0; t < TICKS_PER_DAY; t += 1) {
    const job = jobs.byKey(key);
    if (job?.workerId === dwarf && job.state === 'fetching' && w.game.world.entities.get(dwarf, C.Worker)?.carrying !== 0) return job;
    w.step(1);
  }
  throw new Error('the dwarf never carried the seed to the plot');
}

describe('T-573 a job keeps no worker who is down', () => {
  it('a stun mid-fetch gives the planting job back in that tick, drops the seed, offers the dwarf nothing until it wakes, and the job is done after', () => {
    const f = farm('t573-plant-stun');
    const { w, dwarf, tile, key, jobs } = f;
    const world = w.game.world;
    const id = midFetch(f).id;
    const seed = world.entities.get(dwarf, C.Worker)!.carrying;
    world.emit({ type: 'CreatureStunned', id: dwarf, until: w.tick + 300 });
    w.step(1);
    const job = jobs.get(id)!;
    expect(world.entities.get(dwarf, C.Body)?.conscious).toBe(false);
    expect(job.state, 'given back in the tick the stun lands').toBe('open');
    expect(job.workerId).toBe(0);
    expect(world.entities.get(dwarf, C.Worker)).toMatchObject({ jobId: 0, carrying: 0 });
    // The seed lies where the dwarf fell, still reserved to the job for RESERVE_KEEP_TICKS.
    const items = w.readers.of<ItemsReader>('13');
    expect(items.get(seed)?.carriedBy ?? 0).toBe(0);
    expect(items.tileOf(seed)).toBe(w.game.movement.tileOf(dwarf));
    // The open job is the only one, and the dwarf the only worker: it is not offered while the dwarf is out.
    for (let t = 0; t < 250; t += 1) {
      w.step(1);
      if (world.entities.get(dwarf, C.Body)?.conscious !== false) break;
      expect(world.entities.get(dwarf, C.Worker)?.jobId, `tick ${w.tick}`).toBe(0);
    }
    for (let t = 0; t < TICKS_PER_DAY && jobs.byKey(key) !== undefined; t += 10) {
      quiet(w, dwarf);
      w.step(10);
    }
    expect(jobs.byKey(key), 'taken again on waking and done').toBeUndefined();
    expect(w.plants.cropAtTile.has(tile)).toBe(true);
  });

  it('a worker knocked out with no event (an older save) gives its planting job back on the board\'s next tick', () => {
    const f = farm('t573-plant-silent');
    const { w, dwarf, jobs } = f;
    const id = midFetch(f).id;
    // 17 is not told: the body says unconscious, and nothing else does.
    w.game.world.entities.get(dwarf, C.Body)!.conscious = false;
    w.step(1);
    const job = jobs.get(id)!;
    expect(job.state).toBe('open');
    expect(job.workerId).toBe(0);
    expect(w.game.world.entities.get(dwarf, C.Worker)?.jobId).toBe(0);
  });

  it('a crafter bleeding out at the workshop gives the craft job back with its progress and its delivered stone', () => {
    const w = new TestWorld({ seed: 't573-craft', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const shop = w.build('craftdwarf', w.index(12, 12, Z));
    const crafter = w.spawnDwarf({ at: w.index(16, 14, Z), skills: { crafting: 2 } });
    quiet(w, crafter);
    w.spawnItem('raw_stone', 'granite', w.index(18, 14, Z));
    w.step(1);
    expect(world.applyCommand({ type: 'AddWorkOrder', workshopId: shop,
      order: { recipeId: 'craft_stone', remaining: 1, mode: 'once' } })).toEqual({ ok: true });
    const board = (world.scheduler.byId('11') as JobsSystem).board;
    const craft = (): Job | undefined => [...board.jobs.values()].find((j) => j.target.ref === shop);
    for (let t = 0; t < TICKS_PER_DAY && !(craft()?.state === 'working' && craft()!.progress >= 100); t += 1) {
      quiet(w, crafter);
      w.step(1);
    }
    const job = craft()!;
    expect(job.state).toBe('working');
    expect(job.workerId).toBe(crafter);
    const delivered = job.inputs.flatMap((input) => input.delivered);
    expect(delivered.length).toBeGreaterThan(0);
    // A cut and blood under 17's mark: its next health tick (every 5) takes the crafter unconscious.
    const body = world.entities.get(crafter, C.Body)!;
    body.blood = Math.floor(body.maxBlood * 0.3);
    world.emit({ type: 'DamageDealt', defenderId: crafter, attackerId: 0, part: 'torso', damageType: 'edge', amount: 1 });
    let progress = job.progress;
    for (let t = 0; t < 10 && body.conscious; t += 1) {
      progress = job.progress;
      w.step(1);
    }
    expect(body.conscious).toBe(false);
    expect(w.events('CreatureUnconscious').some((e) => e['id'] === crafter)).toBe(true);
    expect(job.state, 'given back in the tick the crafter fell').toBe('open');
    expect(job.workerId).toBe(0);
    expect(world.entities.get(crafter, C.Worker)?.jobId).toBe(0);
    // 11 § Job steps, interruptions: progress kept; inputs delivered to the workshop stay the job's.
    expect(job.progress).toBeGreaterThanOrEqual(progress);
    expect(job.progress).toBeGreaterThan(0);
    const items = w.readers.of<ItemsReader>('13');
    for (const id of delivered) expect(items.get(id)?.reservedBy).toBe(job.id);
    expect(job.inputs.flatMap((input) => input.delivered)).toEqual(delivered);
    // Down, the crafter is offered nothing, though the craft job is open.
    w.step(20);
    expect(world.entities.get(crafter, C.Worker)?.jobId).toBe(0);
    expect(job.workerId).toBe(0);
  });

  it('a worker that is down is offered no job though one is open', () => {
    const f = farm('t573-summon');
    const { w, dwarf } = f;
    midFetch(f);
    w.game.world.entities.get(dwarf, C.Body)!.conscious = false;
    w.step(1);
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    expect(board.isDown(dwarf)).toBe(true);
    expect(board.assignOne(dwarf)).toBe(0);
    expect(w.game.world.entities.get(dwarf, C.Worker)?.jobId).toBe(0);
  });
});
