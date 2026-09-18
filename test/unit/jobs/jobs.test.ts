import { describe, it, expect } from 'vitest';
import { HeadlessGame, FLAT_TEST_LAYERS, FLAT_TEST_SPEC } from '@app/headless';
import { C } from '@core/components';
import { PRIORITY_DEFAULT, TICKS_PER_YEAR } from '@core/constants';
import type { GameEvent } from '@core/events';
import { TileKind } from '@core/map3d';
import { BaseSystem, type JobProducer, type TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import {
  JobsSystem,
  choose,
  effectivePriority,
  estDistance,
  effortPerTick,
  effortRequired,
  progressOf,
  score,
  type ItemFilter,
  type ItemSource,
  type Job,
  type JobSink,
  type JobsReader,
  type Tool,
} from '@systems/jobs';
import * as J from '@systems/jobs/constants';
import * as D from '@systems/dwarves/constants';
import { TerrainSystem } from '@systems/terrain';
import { tuningConstants } from '../system-constants';

describe('T-M1-08 jobs: tuning constants', () => {
  it('every numeric row of 11 and 10 § Tuning constants is in the constants files with its value', () => {
    for (const [doc, code] of [
      ['02-systems/11-jobs-and-labor.md', J],
      ['02-systems/10-dwarves.md', D],
    ] as const) {
      const rows = tuningConstants(doc);
      expect(rows.length).toBeGreaterThanOrEqual(10);
      const values = code as unknown as Record<string, number>;
      for (const row of rows) expect([row.name, values[row.name]]).toEqual([row.name, row.value]);
    }
  });
});

describe('T-M1-08 jobs: the scoring formula', () => {
  it('effective priority shifts by the labor priority; the estimate weighs a z-level as Z_DISTANCE_WEIGHT tiles', () => {
    expect(effectivePriority(5, PRIORITY_DEFAULT)).toBe(5);
    // "raising mining's labor priority to 3 makes every mining job behave two steps more urgent"
    expect(effectivePriority(5, 3)).toBe(3);
    expect(effectivePriority(1, 9)).toBe(5);
    expect(estDistance({ x: 0, y: 0, z: 0 }, { x: 3, y: -7, z: 2 })).toBe(7 + 2 * J.Z_DISTANCE_WEIGHT);
  });

  it('score = eff × 1000 + distance × 10 − skill × 15 − workshop worker 500', () => {
    expect(score(5, 10, 0, false)).toBe(5100);
    expect(score(5, 10, 4, false)).toBe(5040);
    expect(score(5, 10, 4, true)).toBe(4540);
    expect(score(1, 0, 0, false)).toBe(1000);
  });

  it('the minimum score wins; priority beats distance; skill breaks near ties; ties go to the lower job id', () => {
    expect(choose([
      { jobId: 1, eff: 5, distance: 1, skill: 0, workshopWorker: false },
      { jobId: 2, eff: 4, distance: 90, skill: 0, workshopWorker: false },
    ])).toBe(2);
    expect(choose([
      { jobId: 1, eff: 5, distance: 3, skill: 0, workshopWorker: false },
      { jobId: 2, eff: 5, distance: 4, skill: 2, workshopWorker: false },
    ])).toBe(2);
    expect(choose([
      { jobId: 7, eff: 5, distance: 3, skill: 0, workshopWorker: false },
      { jobId: 4, eff: 5, distance: 3, skill: 0, workshopWorker: false },
    ])).toBe(4);
    expect(choose([])).toBe(0);
  });

  it('only the first CANDIDATE_LIMIT candidates by (priority, distance, skill) are scored', () => {
    const cands = Array.from({ length: 40 }, (_, k) => ({ jobId: k + 1, eff: 5, distance: k, skill: 0, workshopWorker: k === 35 }));
    expect(J.CANDIDATE_LIMIT).toBe(32);
    // The workshop worker's bonus would win (350 − 500 < 0), but it is 36th nearest.
    expect(choose(cands)).toBe(1);
    expect(choose(cands, 40)).toBe(36);
  });

  it('D-055: work is effort, so a job takes exactly its documented time (balance.md § Time and pace)', () => {
    const ticksFor = (centiTicks: number, skill: number): number => {
      const need = effortRequired(centiTicks);
      let done = 0;
      let t = 0;
      while (done < need) {
        done += effortPerTick(J.SKILL_TIME_BONUS_PERCENT, skill, 100);
        t += 1;
      }
      return t;
    };
    // A granite wall (hardness 150): DIG_BASE_TICKS × 150 / 100 = 90 ticks for a novice, 50 at level 10.
    expect(ticksFor(60 * 150, 0)).toBe(90);
    expect(ticksFor(60 * 150, 10)).toBe(50);
    // Level 20 works at 100 / 260 of the base time.
    expect(ticksFor(60 * 150, 20)).toBe(Math.ceil((90 * 100) / 260));
    expect(progressOf(4500, 9000)).toBe(500);
    expect(progressOf(99999, 9000)).toBe(1000);
  });
});

// ---------- the board over a world ----------

/** The part of the dwarf brain 11 needs: queue when free, step when working. */
class Driver extends BaseSystem<null> {
  readonly id = '10';
  readonly order = 10;
  readonly workers: EntityId[] = [];
  enabled = true;
  override tick(ctx: TickContext): void {
    if (!this.enabled) return;
    for (const w of this.workers) {
      const worker = ctx.world.entities.get(w, C.Worker);
      if (worker === undefined || worker.jobId === 0) ctx.jobs.assign(w);
      else ctx.jobs.stepWorker(w, ctx);
    }
  }
  override reader(): unknown {
    return { productivity: () => 100, isChild: (id: EntityId) => (this.children.includes(id)) };
  }
  readonly children: EntityId[] = [];
  serialize(): null {
    return null;
  }
  deserialize(): void {}
}

class TestProducer implements JobProducer {
  readonly completed: number[] = [];
  readonly events: string[] = [];
  pending: [string, Record<string, unknown>][] = [];
  centi = 9000;
  constructor(readonly id: string) {}
  produce(_ctx: TickContext, sink: unknown): void {
    const s = sink as JobSink;
    for (const [key, spec] of this.pending) if (!s.exists(key)) s.create(key, spec as never);
    this.pending = [];
  }
  onComplete(job: unknown): void {
    this.completed.push((job as Job).id);
  }
  onJobEvent(event: GameEvent): void {
    this.events.push(event.type);
  }
  workCentiTicks(): number {
    return this.centi;
  }
}

interface Rig {
  g: HeadlessGame;
  driver: Driver;
  jobs: JobsSystem;
  terrain: TestProducer;
  items: TestProducer;
  events: GameEvent[];
  reader: JobsReader;
  worker(x: number, y: number, opts?: { child?: boolean; skill?: number }): EntityId;
}

function rig(): Rig {
  const driver = new Driver();
  const jobs = new JobsSystem();
  const g = new HeadlessGame({
    seed: 'jobs-test',
    world: 'flat-test',
    systems: [new TerrainSystem({ spec: FLAT_TEST_SPEC, layerStack: FLAT_TEST_LAYERS }), jobs, driver],
  });
  const terrain = new TestProducer('terrain');
  const items = new TestProducer('items');
  g.world.registrations.jobProducer(terrain);
  g.world.registrations.jobProducer(items);
  const events: GameEvent[] = [];
  g.world.onEvents((batch) => events.push(...batch));
  const registry = g.registry;
  const skills = registry.table('skills');
  const labors = registry.table('labors');
  const worker = (x: number, y: number, opts: { child?: boolean; skill?: number } = {}): EntityId => {
    const e = g.world.entities;
    const id = e.create('creature');
    e.add(id, C.Creature, {
      species: registry.table('creatures').index('dwarf'),
      name: `W${id}`,
      sex: 0,
      ageTicks: opts.child === true ? TICKS_PER_YEAR * 5 : TICKS_PER_YEAR * 30,
      faction: 'fortress',
      sizeClass: 60,
      bodyPlan: 1,
    });
    const level = new Uint8Array(skills.size + 1);
    level[skills.index('mining')] = opts.skill ?? 0;
    e.add(id, C.Skills, { level, xp: new Uint16Array(skills.size + 1), lastRaised: 0 });
    const enabled = new Uint8Array((labors.size >> 3) + 1);
    for (let k = 1; k <= labors.size; k += 1) enabled[k >> 3] = (enabled[k >> 3] as number) | (1 << (k & 7));
    e.add(id, C.Labors, { enabled });
    e.add(id, C.Motion, { pathId: 0, stepIndex: 0, progress: 0, speed: 100, movementClass: 'walker', repathCount: 0, waitUntil: 0 });
    e.add(id, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: 0 });
    g.movement.teleport(id, g.map.index(x, y, 32));
    if (opts.child === true) driver.children.push(id);
    driver.workers.push(id);
    return id;
  };
  return { g, driver, jobs, terrain, items, events, reader: g.world.readers.of<JobsReader>('11'), worker };
}

/** A wall on the surface to dig, at (x, y). */
function wallAt(r: Rig, x: number, y: number): TileIndex {
  const i = r.g.map.index(x, y, 32);
  r.g.world.services.terrain.setKind(i, TileKind.Wall, r.g.registry.table('materials').index('granite'));
  return i;
}

function digSpec(tile: TileIndex, priority = 5): Record<string, unknown> {
  return { type: 'dig', priority, target: { kind: 'tile', ref: tile }, workTile: 'adjacent', tool: 'pick' };
}

function types(r: Rig, t: string): GameEvent[] {
  return r.events.filter((e) => e.type === t);
}

describe('T-M1-08 jobs: the board, assignment and steps', () => {
  it('a job is created once per key, claimed, travelled to, worked for its time and completed', () => {
    const r = rig();
    const w = r.worker(10, 10);
    const target = wallAt(r, 20, 10);
    r.terrain.pending.push(['dig:t', digSpec(target)], ['dig:t', digSpec(target)]);
    r.g.step(1);
    expect(types(r, 'JobCreated')).toHaveLength(1);
    const job = r.reader.byKey('dig:t') as Job;
    expect(job.state).toBe('claimed');
    expect(job.workerId).toBe(w);
    r.g.step(400);
    expect(r.terrain.completed).toEqual([job.id]);
    expect(types(r, 'JobStarted')).toHaveLength(1);
    const started = r.events.indexOf(types(r, 'JobStarted')[0] as GameEvent);
    expect(types(r, 'JobCompleted')[0]).toMatchObject({ jobId: job.id, jobType: 'dig', workerId: w, target });
    expect(r.events.indexOf(types(r, 'JobCompleted')[0] as GameEvent)).toBeGreaterThan(started);
    // The worker stood on an 8-neighbour of the target on its level.
    const at = r.g.movement.tileOf(w);
    expect(r.g.map.neighbors8(target)).toContain(at);
    expect(r.reader.byKey('dig:t')).toBeUndefined();
    expect(r.g.world.entities.get(w, C.Worker)?.jobId).toBe(0);
    expect(r.terrain.events).toEqual(['JobCreated', 'JobClaimed', 'JobCompleted']);
  });

  it('the work lasts exactly the documented ticks: 90 for a novice on granite, 50 at level 10', () => {
    for (const [skill, ticks] of [
      [0, 90],
      [10, 50],
    ] as const) {
      const r = rig();
      r.worker(19, 10, { skill });
      const target = wallAt(r, 20, 10);
      r.terrain.centi = 60 * 150; // DIG_BASE_TICKS × granite hardness
      r.terrain.pending.push(['dig:t', digSpec(target)]);
      let guard = 0;
      while (r.reader.byKey('dig:t')?.state !== 'working' && guard < 100) {
        r.g.step(1);
        guard += 1;
      }
      let worked = 0;
      while (r.terrain.completed.length === 0 && worked < 500) {
        r.g.step(1);
        worked += 1;
      }
      expect(worked).toBe(ticks);
    }
  });

  it('priority 1 is claimed before priority 9 at equal distance (jb_priority rule)', () => {
    const r = rig();
    const w = r.worker(20, 20);
    const a = wallAt(r, 16, 20);
    const b = wallAt(r, 24, 20);
    r.terrain.pending.push(['dig:a', digSpec(a, 9)], ['dig:b', digSpec(b, 1)]);
    r.g.step(1);
    expect(r.reader.forWorker(w)?.key).toBe('dig:b');
  });

  it('a labor priority of 3 makes mining win over an equidistant haul at the same job priority', () => {
    const r = rig();
    const w = r.worker(20, 20);
    const a = wallAt(r, 16, 20);
    r.items.pending.push(['haul:x', { type: 'haul_to_stockpile', priority: 5, target: { kind: 'tile', ref: r.g.map.index(24, 20, 32) }, workTile: 'at' }]);
    r.terrain.pending.push(['dig:a', digSpec(a, 5)]);
    r.driver.enabled = false;
    r.g.step(1);
    expect(r.g.world.applyCommand({ type: 'SetLaborPriority', labor: 'hauling', priority: 3 })).toEqual({ ok: true });
    r.driver.enabled = true;
    r.g.step(1);
    expect(r.reader.forWorker(w)?.key).toBe('haul:x');
    r.g.world.applyCommand({ type: 'CancelJob', jobId: r.reader.forWorker(w)?.id });
    r.g.world.applyCommand({ type: 'SetLaborPriority', labor: 'hauling', priority: 5 });
    r.g.world.applyCommand({ type: 'SetLaborPriority', labor: 'mining', priority: 3 });
    r.items.pending.push(['haul:y', { type: 'haul_to_stockpile', priority: 5, target: { kind: 'tile', ref: r.g.map.index(24, 20, 32) }, workTile: 'at' }]);
    r.g.step(2);
    expect(r.reader.forWorker(w)?.key).toBe('dig:a');
    expect(r.reader.laborPriority('mining')).toBe(3);
    expect(r.g.world.applyCommand({ type: 'SetLaborPriority', labor: 'mining', priority: 0 })).toEqual({ ok: false, reason: 'out_of_range' });
  });

  it('interruption returns the job to open with its progress kept, and a worker resumes it', () => {
    const r = rig();
    const w = r.worker(19, 10);
    const target = wallAt(r, 20, 10);
    r.terrain.centi = 20000;
    r.terrain.pending.push(['dig:t', digSpec(target)]);
    let guard = 0;
    while (r.reader.byKey('dig:t')?.state !== 'working' && guard < 200) {
      r.g.step(1);
      guard += 1;
    }
    r.g.step(50);
    const before = r.reader.byKey('dig:t') as Job;
    expect(before.progress).toBeGreaterThan(200);
    r.g.world.services.jobs.interrupt(w, true);
    const open = r.reader.byKey('dig:t') as Job;
    expect(open.state).toBe('open');
    expect(open.progress).toBe(before.progress);
    expect(open.workerId).toBe(0);
    r.g.step(300);
    expect(r.terrain.completed).toEqual([before.id]);
  });

  it('children do hauling only; SetLabor refuses them with child_labor', () => {
    const r = rig();
    const child = r.worker(10, 10, { child: true });
    expect(r.reader.laborEnabled(child, 'hauling')).toBe(true);
    expect(r.reader.laborEnabled(child, 'mining')).toBe(false);
    expect(r.g.world.applyCommand({ type: 'SetLabor', dwarfId: child, labor: 'hauling', on: false })).toEqual({ ok: false, reason: 'child_labor' });
    const target = wallAt(r, 12, 10);
    r.terrain.pending.push(['dig:t', digSpec(target)]);
    r.g.step(3);
    expect(r.reader.byKey('dig:t')?.state).toBe('blocked');
    expect(r.reader.byKey('dig:t')?.blockedReason).toBe('no_worker');
  });
});

describe('T-M1-08 jobs: blocking and retry', () => {
  it('no_worker blocks at creation and retries on SetLabor', () => {
    const r = rig();
    const w = r.worker(10, 10);
    expect(r.g.world.applyCommand({ type: 'SetLabor', dwarfId: w, labor: 'mining', on: false })).toEqual({ ok: true });
    const target = wallAt(r, 12, 10);
    r.terrain.pending.push(['dig:t', digSpec(target)]);
    r.g.step(2);
    expect(types(r, 'JobBlocked')[0]).toMatchObject({ reason: 'no_worker', jobType: 'dig' });
    expect(r.reader.counts()).toMatchObject({ blocked: 1, byReason: { no_worker: 1 } });
    r.g.world.submit({ type: 'SetLabor', dwarfId: w, labor: 'mining', on: true });
    r.g.step(2);
    expect(types(r, 'JobUnblocked')).toHaveLength(1);
    expect(r.reader.byKey('dig:t')?.workerId).toBe(w);
  });

  it('unreachable blocks until a route exists, and retries within BLOCKED_RETRY_TICKS without a trigger', () => {
    const r = rig();
    r.worker(5, 5);
    const map = r.g.map;
    const granite = r.g.registry.table('materials').index('granite');
    // A walled pen on the surface around (30..34, 30..34) with the dig target inside.
    const gate = map.index(32, 29, 32);
    for (let x = 29; x <= 35; x += 1) {
      for (const y of [29, 35]) r.g.world.services.terrain.setKind(map.index(x, y, 32), TileKind.Wall, granite);
    }
    for (let y = 29; y <= 35; y += 1) {
      for (const x of [29, 35]) r.g.world.services.terrain.setKind(map.index(x, y, 32), TileKind.Wall, granite);
    }
    const target = wallAt(r, 32, 32);
    r.g.step(1);
    r.terrain.pending.push(['dig:t', digSpec(target)]);
    r.g.step(2);
    expect(r.reader.byKey('dig:t')?.blockedReason).toBe('unreachable');
    // Open the gate directly in the grid: no TilesChanged, so only the periodic retry sees it.
    map.setKind(gate, TileKind.Floor, granite);
    r.g.step(J.BLOCKED_RETRY_TICKS + 1);
    expect(types(r, 'JobUnblocked')).toHaveLength(1);
    expect(r.reader.byKey('dig:t')?.state).not.toBe('blocked');
  });

  it('D-054: with no item system the tool is in hand; with one, a missing tool blocks no_tool', () => {
    const r = rig();
    r.worker(10, 10);
    const target = wallAt(r, 12, 10);
    r.jobs.board.items = stub([]);
    r.terrain.pending.push(['dig:t', digSpec(target)]);
    r.g.step(2);
    expect(r.reader.byKey('dig:t')?.blockedReason).toBe('no_tool');
  });
});

/** An in-memory item seam: items with a type, a tile, a reservation and a carrier. */
interface StubItem {
  id: EntityId;
  type: number;
  tag?: Tool;
  tile: TileIndex;
  reservedBy: number;
  carrier: EntityId;
}

function stub(list: StubItem[], held: Tool[] = []): ItemSource & { list: StubItem[] } {
  return {
    list,
    findItems: (filter: ItemFilter, n: number): EntityId[] =>
      list
        .filter((it) => it.tag === undefined && it.reservedBy === 0 && (filter.type === undefined || it.type === filter.type) && !(filter.excludeIds ?? []).includes(it.id))
        .slice(0, n)
        .map((it) => it.id),
    findTool: (tool: Tool): EntityId => list.find((it) => it.tag === tool && it.reservedBy === 0)?.id ?? 0,
    hasTool: (_w: EntityId, tool: Tool): boolean => held.includes(tool),
    reserve: (id: EntityId, jobId: number): void => {
      const it = list.find((x) => x.id === id);
      if (it !== undefined) it.reservedBy = jobId;
    },
    release: (id: EntityId): void => {
      const it = list.find((x) => x.id === id);
      if (it !== undefined) it.reservedBy = 0;
    },
    tileOf: (id: EntityId): TileIndex => list.find((x) => x.id === id)?.tile ?? -1,
    pickUp: (id: EntityId, w: EntityId): void => {
      const it = list.find((x) => x.id === id);
      if (it !== undefined) it.carrier = w;
    },
    dropAt: (id: EntityId, tile: TileIndex): void => {
      const it = list.find((x) => x.id === id);
      if (it !== undefined) {
        it.carrier = 0;
        it.tile = tile;
      }
    },
    equip: (w: EntityId, id: EntityId): void => {
      const it = list.find((x) => x.id === id);
      if (it !== undefined) {
        it.carrier = w;
        if (it.tag !== undefined) held.push(it.tag);
      }
    },
  };
}

describe('T-M1-08 jobs: reservations (in-memory item stub until M2)', () => {
  it('claim reserves inputs; a shortfall unclaims with missing_input; ItemCreated retries; cancel releases', () => {
    const r = rig();
    const w = r.worker(10, 10);
    const items = stub([{ id: 9001, type: 3, tile: r.g.map.index(14, 10, 32), reservedBy: 0, carrier: 0 }]);
    r.jobs.board.items = items;
    const site = r.g.map.index(12, 12, 32);
    r.items.pending.push(['haul:t', { type: 'haul_to_stockpile', target: { kind: 'tile', ref: site }, workTile: 'at', inputs: [{ filter: { type: 3 }, count: 2 }] }]);
    r.g.step(2);
    const job = r.reader.byKey('haul:t') as Job;
    expect(job.state).toBe('blocked');
    expect(job.blockedReason).toBe('missing_input');
    expect(items.list[0]?.reservedBy).toBe(0);
    items.list.push({ id: 9002, type: 3, tile: r.g.map.index(15, 10, 32), reservedBy: 0, carrier: 0 });
    r.g.world.emit({ type: 'ItemCreated', id: 9002, type_: 3 } as unknown as GameEvent);
    r.g.step(2);
    const claimed = r.reader.byKey('haul:t') as Job;
    expect(claimed.workerId).toBe(w);
    expect(claimed.inputs[0]?.reserved).toEqual([9001, 9002]);
    expect(items.list.map((i) => i.reservedBy)).toEqual([claimed.id, claimed.id]);
    expect(types(r, 'ItemReserved')).toHaveLength(2);
    expect(r.g.world.applyCommand({ type: 'CancelJob', jobId: claimed.id })).toEqual({ ok: true });
    expect(items.list.map((i) => i.reservedBy)).toEqual([0, 0]);
    expect(r.reader.byKey('haul:t')).toBeUndefined();
    expect(r.g.world.applyCommand({ type: 'CancelJob', jobId: claimed.id })).toEqual({ ok: false, reason: 'not_found' });
  });

  it('a needed tool is fetched and equipped first, then the job proceeds', () => {
    const r = rig();
    const w = r.worker(10, 10);
    const items = stub([{ id: 7001, type: 1, tag: 'pick', tile: r.g.map.index(10, 14, 32), reservedBy: 0, carrier: 0 }]);
    r.jobs.board.items = items;
    const target = wallAt(r, 20, 10);
    r.terrain.pending.push(['dig:t', digSpec(target)]);
    r.g.step(400);
    expect(types(r, 'ToolEquipped')[0]).toMatchObject({ dwarfId: w, itemId: 7001 });
    expect(r.terrain.completed).toHaveLength(1);
    expect(r.g.world.entities.get(w, C.Worker)?.toolId).toBe(7001);
  });
});

describe('T-M1-08 jobs: commands and reader', () => {
  it('SetJobPriority, SetStandingOrder and the counts', () => {
    const r = rig();
    const target = wallAt(r, 12, 10);
    r.worker(10, 10);
    r.driver.enabled = false;
    r.terrain.pending.push(['dig:t', digSpec(target, 7)]);
    r.g.step(1);
    const job = r.reader.byKey('dig:t') as Job;
    expect(r.g.world.applyCommand({ type: 'SetJobPriority', jobId: job.id, priority: 2 })).toEqual({ ok: true });
    expect(r.reader.get(job.id)?.priority).toBe(2);
    expect(r.g.world.applyCommand({ type: 'SetJobPriority', jobId: 999, priority: 2 })).toEqual({ ok: false, reason: 'not_found' });
    expect(r.reader.standingOrder('autoHarvest')).toBe(true);
    expect(r.g.world.applyCommand({ type: 'SetStandingOrder', name: 'autoHarvest', on: false })).toEqual({ ok: true });
    expect(r.reader.standingOrder('autoHarvest')).toBe(false);
    expect(r.g.world.applyCommand({ type: 'SetStandingOrder', name: 'autoNothing', on: false })).toEqual({ ok: false, reason: 'not_found' });
    expect(r.reader.counts()).toEqual({ open: 1, claimed: 0, blocked: 0, byReason: {} });
    expect(r.reader.list('open').map((j) => j.key)).toEqual(['dig:t']);
    expect(r.reader.workersWithLabor('mining')).toHaveLength(1);
  });

  it('the board saves and restores its state', () => {
    const r = rig();
    const target = wallAt(r, 12, 10);
    r.worker(10, 10);
    r.terrain.pending.push(['dig:t', digSpec(target, 7)]);
    r.g.step(5);
    const saved = r.jobs.serialize();
    const other = rig();
    other.jobs.deserialize(saved, undefined as never);
    expect(other.jobs.serialize()).toEqual(saved);
  });
});
