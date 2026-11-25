/**
 * T-722: a job blocked for its inputs whose inputs are all in stock, but one of them lies where the
 * job's own retry cannot find it, says it is out of reach, not "to be brought" (`11` § Player-facing
 * behavior, `panels.md` § Jobs). The UI reads 11's `unfoundInput`, the retry's own search, so the
 * line and the job agree.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { JobsReader } from '@systems/jobs';
import { jobBlockText } from '@ui/messages';
import type { PanelContext } from '@ui/panels/context';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const Z = 32;

function ctxOf(w: TestWorld): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
}

/** A still placed at (30, 30), a stone beside it and a barrel at (40, 40), walled in or not; a builder. */
function setup(seed: string, walled: boolean): { w: TestWorld; jobs: JobsReader; walls: TileIndex[] } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const barrelAt = w.index(40, 40, Z);
  const walls = walled ? w.map.neighbors8(barrelAt).filter((t) => w.map.zOf(t) === Z) : [];
  for (const t of walls) w.carve(t, TileKind.Wall);
  // The labels are rebuilt at the tick's end, before anyone looks for the barrel.
  w.step(1);
  w.spawnItem('barrel', 'oak', barrelAt, 1);
  w.spawnItem('raw_stone', 'granite', w.index(33, 30, Z), 1);
  const dwarf = w.spawnDwarf({ at: w.index(34, 34, Z) });
  w.setLabor(dwarf, 'construction');
  expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'still', origin: w.index(30, 30, Z) })).toMatchObject({ ok: true });
  w.step(1);
  return { w, jobs: w.readers.of<JobsReader>('11'), walls };
}

function stillJob(jobs: JobsReader) {
  const job = jobs.list().find((j) => jobs.typeOf(j.id) === 'build');
  if (job === undefined) throw new Error('no build job for the still');
  return job;
}

describe('T-722 a job whose input is in stock but out of reach says so', () => {
  it('a still whose only barrel is walled in reads "out of reach", and its retry agrees', () => {
    const { w, jobs } = setup('t722-walled', true);
    w.until(() => stillJob(jobs).state === 'blocked', 400);
    const job = stillJob(jobs);
    expect(job.blockedReason).toBe('missing_input');
    expect(jobs.unfoundInput(job.id)).toBe(0);
    const text = jobBlockText(ctxOf(w), job);
    expect(text.short).toBe('waiting: 1 barrel, out of reach');
    expect(text.long).toBe('waiting: 1 barrel, out of reach — none in stock can be reached: open a door, unforbid a way, or move one within reach');
    // Past several retries the job is still blocked: the line said what the jobs see.
    w.step(300);
    expect(stillJob(jobs).state).toBe('blocked');
  });

  it('with the wall gone the same job reads "to be brought", and its retry opens it', () => {
    const { w, jobs, walls } = setup('t722-opened', true);
    w.until(() => stillJob(jobs).state === 'blocked', 400);
    expect(stillJob(jobs).blockedReason).toBe('missing_input');
    for (const t of walls) w.carve(t, TileKind.Floor);
    // The labels are rebuilt at the tick's end.
    w.step(1);
    const job = stillJob(jobs);
    expect(jobs.unfoundInput(job.id)).toBe(-1);
    expect(jobBlockText(ctxOf(w), { ...job, blockedReason: 'missing_input' }).short).toBe('waiting: 1 barrel to be brought');
    w.until(() => stillJob(jobs).state !== 'blocked', 300);
    expect(stillJob(jobs).state).not.toBe('blocked');
  });

  it('a barrel in reach from the start reads "to be brought"', () => {
    const { w, jobs } = setup('t722-open', false);
    const job = stillJob(jobs);
    expect(jobs.unfoundInput(job.id)).toBe(-1);
    expect(jobBlockText(ctxOf(w), { ...job, blockedReason: 'missing_input' }).short).toBe('waiting: 1 barrel to be brought');
  });
});
