/**
 * T-796: a threat a dwarf cannot reach, and that cannot reach it, does not drop its job
 * (16 § Threat detection, 11 § Assignment and § Job steps, `panels.md` § Jobs).
 */

import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { EntityId, Tick, TileIndex } from '@core/types';
import { threatScan } from '@systems/combat/threats';
import type { JobsSystem } from '@systems/jobs';
import type { Job } from '@systems/jobs/state';
import { jobBlockText } from '@ui/messages';
import { jobWait } from '@ui/job-wait';
import { strings } from '../ui/ui-fixture';
import { TestWorld } from '../../scenarios/test-world';

const Y = 28;

function world(seed: string): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  return w;
}

function scan(w: TestWorld): GameEvent[] {
  const events: GameEvent[] = [];
  const ctx = { tick: 100, world: w.game.world, registry: w.game.registry, readers: w.game.world.readers, emit: (e: GameEvent) => events.push(e), jobs: {} as never };
  threatScan(ctx as never, new Map<EntityId, Tick>());
  return events.filter((e) => e.type === 'ThreatNearby');
}

function board(w: TestWorld) {
  return (w.game.world.scheduler.byId('11') as JobsSystem).board;
}

function env(w: TestWorld) {
  return { readers: w.game.world.readers, registry: w.game.registry, strings };
}

describe('T-796 a threat must be able to come', () => {
  it('a crawler sealed in rock at Chebyshev 8 sends no ThreatNearby; one in the open sends one', () => {
    const w = world('t796-scan-sealed');
    w.digRoom(20, 20, Y, 3, 3);
    w.digRoom(29, 21, Y, 1, 1);
    const dwarf = w.spawnCreature('dwarf', w.index(21, 21, Y), 'fortress');
    const crawler = w.spawnCreature('cave_crawler', w.index(29, 21, Y), 'hostile:cavern');
    w.pathing.connectivity.rebuildDirty();
    expect(w.readers.pathing.reachable(w.index(21, 21, Y), w.index(29, 21, Y), 'walker')).toBe(false);
    expect(scan(w)).toHaveLength(0);

    // Dig the rock between them: the crawler can come now.
    w.digRoom(23, 21, Y, 6, 1);
    w.pathing.connectivity.rebuildDirty();
    const events = scan(w);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: dwarf, hostileId: crawler });
  });

  it('a crawler on the open surface at Chebyshev 8 sends one', () => {
    const w = world('t796-scan-open');
    const z = 32;
    w.spawnCreature('dwarf', w.index(20, 20, z), 'fortress');
    w.spawnCreature('cave_crawler', w.index(28, 20, z), 'hostile:cavern');
    expect(scan(w)).toHaveLength(1);
  });

  it('a shooter behind no wall but across a gap it cannot walk still threatens by its line of fire', () => {
    const w = world('t796-scan-archer');
    const z = 32;
    // A trench the archer cannot cross: open space from top to the floor two levels down, both sides solid.
    for (let y = 0; y < w.map.h; y += 1) for (let dz = 0; dz <= 2; dz += 1) w.carve(w.index(24, y, z - dz), TileKind.Open);
    const at = w.index(28, 20, z);
    const archer = w.spawnCreature('gloam_archer', at, 'hostile:gloam');
    const bow = w.spawnItem('bow', 'oak', at);
    w.game.world.services.items!.attachToCarrier(bow, archer);
    w.game.world.entities.add(archer, C.Equipment, {
      weapon: bow, shield: 0, quiver: 0,
      armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 },
    });
    w.spawnCreature('dwarf', w.index(20, 20, z), 'fortress');
    w.pathing.connectivity.rebuildDirty();
    expect(w.readers.pathing.reachable(at, w.index(20, 20, z), 'walker')).toBe(false);
    expect(scan(w)).toHaveLength(1);
  });
});

describe('T-796 the avoidance filter reads the stand tiles', () => {
  it('a stair job one level below a remembered threat is skipped; one far from it is not', () => {
    const w = world('t796-avoid-stand');
    w.digRoom(18, 18, Y, 8, 8);
    const stair = w.index(21, 21, Y - 1);
    for (const t of [w.index(21, 21, Y), stair]) w.discover(t);
    // The level above is carved, as in the playtest: the stair is cut from it.
    w.carve(w.index(21, 21, Y), TileKind.StairsDown);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'stairs_up', tiles: [stair], priority: 5 }).ok).toBe(true);
    w.step(1);
    const b = board(w);
    const job = [...b.jobs.values()].find((j) => j.target.kind === 'tile' && j.target.ref === stair) as Job;
    expect(job).toBeDefined();
    // The job's anchor is one level below the threat; its stand tile is on the threat's level.
    const threat = w.index(25, 25, Y);
    expect(b.avoidsThreat(job, threat)).toBe(true);
    expect(b.avoidsThreat(job, w.index(40, 40, Y))).toBe(false);
    expect(b.avoidsThreat(job, w.index(25, 25, Y - 2))).toBe(false);
  });
});

describe('T-796 a job every stand tile of which a hostile threatens is blocked threatened', () => {
  function setup(seed: string) {
    const w = world(seed);
    w.digRoom(18, 18, Y, 14, 6);
    const rock = w.index(22, 17, Y);
    w.discover(rock);
    const miner = w.spawnDwarf({ at: w.index(20, 20, Y) });
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [rock], priority: 5 }).ok).toBe(true);
    w.step(1);
    const b = board(w);
    const job = [...b.jobs.values()].find((j) => j.target.ref === rock) as Job;
    return { w, b, job, miner, rock };
  }

  it('blocks on a threat that reaches every stand tile, names it, and reopens once the hostile is dead', () => {
    const { w, b, job, miner } = setup('t796-block');
    const crawler = w.spawnCreature('cave_crawler', w.index(26, 21, Y), 'hostile:cavern');
    w.pathing.connectivity.rebuildDirty();
    b.setWorker(miner, { jobId: job.id });
    job.state = 'working';
    job.workerId = miner;
    b.threatInterrupt(miner, crawler);
    expect(job.state).toBe('blocked');
    expect(job.blockedReason).toBe('threatened');
    expect(job.data['threatHits']).toBe(1);
    const text = jobBlockText(env(w), job);
    expect(text.short).toBe('threatened');
    expect(text.long).toBe('Threatened: a cave crawler at (26,21,z28). Nobody works here until it is gone.');

    // While it lives, the retry keeps it blocked.
    job.retryTick = 0;
    b.retryBlocked();
    expect(job.state).toBe('blocked');
    w.game.world.entities.destroy(crawler);
    job.retryTick = 0;
    b.retryBlocked();
    expect(job.state).toBe('open');
  });

  it('a threat that cannot reach the stand tiles leaves the job open; three in a day say so in the Jobs panel', () => {
    const { w, b, job, miner } = setup('t796-fled');
    // Within THREAT_RADIUS of the dig's east stand tile (23,18), not of its west one (21,18).
    const crawler = w.spawnCreature('cave_crawler', w.index(30, 20, Y), 'hostile:cavern');
    w.pathing.connectivity.rebuildDirty();
    for (let k = 0; k < 3; k += 1) {
      b.setWorker(miner, { jobId: job.id });
      job.state = 'working';
      job.workerId = miner;
      b.threatInterrupt(miner, crawler);
      expect(job.state).toBe('open');
    }
    expect(job.data['threatHits']).toBe(3);
    w.setLabor(miner, 'mining');
    const wait = jobWait(env(w), job);
    expect(wait?.reason).toBe('fled');
    expect(wait?.text).toBe('Interrupted: dwarves flee a cave crawler at (30,20,z28).');
  });
});

describe('T-796 a stair column beside a sealed pocket is carved to the bottom', () => {
  it('the miner is never frightened by the crawler in the rock and carves every level', () => {
    const w = world('t796-stair-pocket');
    w.digRoom(18, 18, Y, 5, 5);
    // The sealed pocket: a crawler two tiles of rock away from the room, Chebyshev 7 from the column.
    w.digRoom(28, 27, Y, 2, 2);
    const crawler = w.spawnCreature('cave_crawler', w.index(28, 28, Y), 'hostile:cavern');
    const column: TileIndex[] = [];
    for (let z = Y; z >= Y - 4; z -= 1) {
      const t = w.index(21, 21, z);
      column.push(t);
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) w.discover(w.index(21 + dx, 21 + dy, z));
    }
    const miner = w.spawnDwarf({ at: w.index(19, 19, Y), skills: { mining: 5 } });
    w.setLabor(miner, 'mining');
    const pick = w.spawnItem('pick', 'iron', w.index(19, 19, Y));
    w.game.world.services.items!.attachToCarrier(pick, miner);
    w.game.world.entities.add(miner, C.Worker, { ...w.game.world.entities.get(miner, C.Worker)!, toolId: pick });
    w.pathing.connectivity.rebuildDirty();
    const designate = (kind: string, tiles: TileIndex[]): void => {
      expect(w.game.world.applyCommand({ type: 'Designate', kind, tiles, priority: 1 } as never).ok).toBe(true);
    };
    designate('stairs_down', [column[0] as TileIndex]);
    designate('stairs_updown', column.slice(1, -1));
    designate('stairs_up', [column[column.length - 1] as TileIndex]);
    const bottom = column[column.length - 1] as TileIndex;
    w.until((t) => t.map.kindAt(bottom) === TileKind.StairsUp, 12000);
    expect(w.events('ThreatNearby').filter((e) => e['hostileId'] === crawler)).toHaveLength(0);
    expect(w.game.world.entities.alive(crawler)).toBe(true);
  });
});
