/**
 * T-762: a chop waits because the fortress's only axe is with a dwarf who is at work or asleep, and
 * the other woodcutters, who have none, leave it to that dwarf (11 § Assignment). The Jobs panel says
 * so, naming the holder and what the holder is doing (`panels.md` § Jobs).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { NEED_MAX } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { JobsReader } from '@systems/jobs';
import { jobWait } from '@ui/job-wait';
import type { PanelContext } from '@ui/panels/context';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

function only(w: TestWorld, dwarf: EntityId, on: string[]): void {
  for (const name of w.game.world.registry.table('labors').ids()) w.setLabor(dwarf, name, on.includes(name));
}

function ctxOf(w: TestWorld): PanelContext {
  return {
    readers: w.readers, registry: w.game.registry, strings,
    submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
}

function giveAxe(w: TestWorld, dwarf: EntityId): EntityId {
  const world = w.game.world;
  const p = world.entities.get(dwarf, C.Position)!;
  const axe = w.spawnItem('axe', 'iron', w.index(p.x, p.y, p.z));
  world.services.items!.attachToCarrier(axe, dwarf);
  world.entities.add(dwarf, C.Worker, { ...world.entities.get(dwarf, C.Worker)!, toolId: axe });
  return axe;
}

/** `holders` woodcutters with an axe each, three without; eight trees marked for chopping. */
function setup(holders: string[]) {
  const w = new TestWorld({ seed: 't762-only-axe', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  w.spawnItem('easy_meal', 'dimcap', w.index(20, 20, Z), 60);
  w.spawnItem('drink', 'ale', w.index(21, 20, Z), 60);
  const named = holders.map((name, i) => w.spawnDwarf({ at: w.index(12 + i, 10, Z), name }));
  const idle = ['Bob', 'Kel', 'Lia'].map((name, i) => w.spawnDwarf({ at: w.index(12 + i, 14, Z), name }));
  for (const d of [...named, ...idle]) only(w, d, ['woodcutting']);
  for (const d of named) giveAxe(w, d);
  const trees: number[] = [];
  for (let i = 0; i < 8; i += 1) {
    const tree = w.index(16 + 2 * i, 24, Z);
    w.map.setKind(tree, TileKind.Tree, w.game.registry.table('materials').index('pine'));
    trees.push(tree);
  }
  w.step(2);
  expect(world.applyCommand({ type: 'Designate', kind: 'chop', tiles: trees, priority: 5 })).toEqual({ ok: true });
  const jobs = w.readers.of<JobsReader>('11');
  const openChop = () => jobs.list('open').find((j) => jobs.typeOf(j.id) === 'chop');
  return { w, world, jobs, named, idle, openChop };
}

describe('T-762 a job that waits on the only tool names who has it and what they are doing', () => {
  it('the only axe is with a dwarf at a chop: the line names the holder, "chopping", and the three without', () => {
    const { w, jobs, named, openChop } = setup(['Dis']);
    w.until(() => jobs.forWorker(named[0]!) !== undefined, 50);
    expect(jobWait(ctxOf(w), openChop()!)).toEqual({ reason: 'tool_short',
      text: 'Nobody takes it yet: the only axe is with Dis, chopping. The other 3 woodcutting dwarves have none: make or buy another axe.' });
  }, 60_000);

  it('with the holder asleep it says "sleeping"', () => {
    const { w, world, jobs, named, openChop } = setup(['Dis']);
    const dis = named[0]!;
    w.until(() => jobs.forWorker(dis) !== undefined, 50);
    world.entities.add(dis, C.Needs, { ...world.entities.get(dis, C.Needs)!, rest: NEED_MAX });
    w.until(() => w.readers.of<{ activityText(id: EntityId): string }>('10').activityText(dis) === 'sleep', 400);
    expect(jobs.forWorker(dis)).toBeUndefined();
    expect(jobWait(ctxOf(w), openChop()!)?.text).toBe(
      'Nobody takes it yet: the only axe is with Dis, sleeping. The other 3 woodcutting dwarves have none: make or buy another axe.');
  }, 60_000);

  it('with two axes held by two dwarves at work it gives the many line', () => {
    const { w, jobs, named, openChop } = setup(['Dis', 'Ulfar']);
    w.until(() => named.every((d) => jobs.forWorker(d) !== undefined), 50);
    expect(jobWait(ctxOf(w), openChop()!)).toEqual({ reason: 'tool_short',
      text: 'Nobody takes it yet: all 2 axes are in use (Dis, chopping, and others). The other 3 woodcutting dwarves have none: make or buy another axe.' });
  }, 60_000);

  it('with a free axe in stock there is no tool line', () => {
    const { w, jobs, named, openChop } = setup(['Dis']);
    w.until(() => jobs.forWorker(named[0]!) !== undefined, 50);
    w.spawnItem('axe', 'iron', w.index(30, 30, Z));
    const wait = jobWait(ctxOf(w), openChop()!);
    expect(wait?.reason).not.toBe('tool_short');
    expect(wait?.reason).not.toBe('tool_held');
  }, 60_000);
});
