/** T-331: the four invariants added to the T-176 checker, each failing on a hand-built bad state. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../scenarios/test-world';
import { checkInvariants } from '../scenarios/invariants';

function fixture() {
  const w = new TestWorld({ seed: 't331-invariants', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const dwarf = w.spawnDwarf({ at: w.index(10, 10, Z) });
  return { w, dwarf };
}

const names = (w: TestWorld): string[] => checkInvariants(w.game).map((f) => f.inv);

describe('T-331 invariant 1: reservations, claims and held jobs have a live holder doing that thing', () => {
  it('reports a reservation whose holder is gone', () => {
    const { w } = fixture();
    const drink = w.spawnItem('drink', 'ale', w.index(12, 10, Z));
    expect(names(w)).toEqual([]);
    const it = w.game.world.entities.get(drink, C.Item)!;
    w.game.world.entities.add(drink, C.Item, { ...it, reservedBy: 987654321, flags: it.flags | ItemFlag.Reserved });
    expect(names(w)).toContain('holder.reservation-holder-gone');
  });

  it('reports a personal reservation of a living dwarf that has no plan for it', () => {
    const { w, dwarf } = fixture();
    const drink = w.spawnItem('drink', 'ale', w.index(12, 10, Z));
    expect(names(w)).toEqual([]);
    w.items.reserve(drink, dwarf);
    expect(names(w)).toContain('holder.reservation-elsewhere');
  });

  it('reports a job held by a worker whose brain is doing something else', () => {
    const { w, dwarf } = fixture();
    const target = w.index(14, 10, Z);
    w.carve(target, TileKind.Wall);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [target] }).ok).toBe(true);
    w.step(1);
    const board = w.game.world.services.jobs as JobBoard;
    const job = [...board.jobs.values()].find((j) => j.target.ref === target)!;
    expect(job).toBeDefined();
    // Hold it by hand: the job and the worker agree, and the brain is idle.
    job.state = 'working';
    job.workerId = dwarf;
    const entities = w.game.world.entities;
    entities.add(dwarf, C.Worker, { ...entities.get(dwarf, C.Worker)!, jobId: job.id });
    entities.add(dwarf, C.Brain, { ...entities.get(dwarf, C.Brain)!, behavior: 'work', activity: 'Digging' });
    expect(names(w).filter((n) => n.startsWith('holder.') || n.startsWith('job.worker'))).toEqual([]);
    entities.add(dwarf, C.Brain, { ...entities.get(dwarf, C.Brain)!, behavior: 'idle', activity: 'No job' });
    expect(names(w)).toContain('holder.job-held-while-elsewhere');
  });

  it('reports a patient whose bed is not a building', () => {
    const { w, dwarf } = fixture();
    w.game.world.entities.add(dwarf, C.Patient, { hospitalZoneId: 0, bedId: 123456789, needs: [], admittedTick: 0 });
    expect(names(w)).toContain('holder.patient-bed-gone');
  });
});

describe('T-331 invariant 2: no job stays blocked unreachable for a day while a path to its work tile exists', () => {
  function blockedDig() {
    const f = fixture();
    const target = f.w.index(14, 10, Z);
    f.w.carve(target, TileKind.Wall);
    expect(f.w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [target] }).ok).toBe(true);
    f.w.step(1);
    const board = f.w.game.world.services.jobs as JobBoard;
    const job = [...board.jobs.values()].find((j) => j.target.ref === target)!;
    expect(job).toBeDefined();
    return { ...f, board, job };
  }

  it('reports a failed walk that nothing retries, once it is a day old', () => {
    const { w, board, job } = blockedDig();
    board.unclaim(job, 'unreachable');
    expect(job.state).toBe('blocked');
    expect(job.failedWalk).toBe(true);
    expect(names(w)).not.toContain('job.unreachable-with-path');
    w.game.world.calendar.setTick(w.tick + TICKS_PER_DAY + 200);
    expect(names(w)).toContain('job.unreachable-with-path');
  });

  it('does not report a job that really has no path', () => {
    const { w, board, job } = blockedDig();
    const target = w.index(14, 10, Z);
    // Wall the target in on its own level; no stand tile of it is then reachable.
    for (const n of w.map.neighbors8(target)) w.carve(n, TileKind.Wall);
    w.step(1);
    board.unclaim(job, 'unreachable');
    w.game.world.calendar.setTick(w.tick + 2 * TICKS_PER_DAY);
    expect(names(w)).not.toContain('job.unreachable-with-path');
  });
});

describe('T-331 invariant 3: a built container with items or a slot has a work tile that is reachable', () => {
  function sealedChest(enclosed: boolean) {
    const { w, dwarf } = fixture();
    const at = w.index(30, 30, Z);
    w.zone('stockpile', [at]);
    const chest = w.build('chest', at, 'oak');
    const item = w.game.world.entities.get(chest, C.Building)!.itemId;
    const stuff = w.spawnItem('plant_food', 'barley', w.index(31, 31, Z));
    expect(w.items.putIn(stuff, item)).toBe(true);
    if (enclosed) for (const n of w.map.neighbors8(at)) w.carve(n, TileKind.Wall);
    w.step(1);
    return { w, dwarf, chest };
  }

  it('accepts a chest beside open floor', () => {
    const { w } = sealedChest(false);
    expect(names(w)).not.toContain('container.no-work-tile');
  });

  it('reports a chest with items that no tile beside it connects to a dwarf', () => {
    const { w } = sealedChest(true);
    expect(names(w)).toContain('container.no-work-tile');
  });
});

describe('T-331 invariant 4: every item has a place', () => {
  it('reports an item whose container lies nowhere', () => {
    const { w } = fixture();
    const barrel = w.spawnItem('barrel', 'oak', w.index(12, 10, Z));
    const food = w.spawnItem('plant_food', 'barley', w.index(13, 10, Z));
    expect(w.items.putIn(food, barrel)).toBe(true);
    expect(names(w)).toEqual([]);
    // The barrel loses its tile but the food still names it: the food is in a container that is nowhere.
    w.game.world.entities.remove(barrel, C.Position);
    const found = names(w);
    expect(found).toContain('item.nowhere');
    expect(found).toContain('item.no-place');
  });

  it('reports installed furniture that no building owns', () => {
    const { w } = fixture();
    const chair = w.spawnItem('chair', 'oak', w.index(12, 10, Z));
    const it = w.game.world.entities.get(chair, C.Item)!;
    w.game.world.entities.remove(chair, C.Position);
    w.game.world.entities.add(chair, C.Item, { ...it, flags: it.flags | ItemFlag.Installed });
    expect(names(w)).toContain('item.no-place');
  });
});
