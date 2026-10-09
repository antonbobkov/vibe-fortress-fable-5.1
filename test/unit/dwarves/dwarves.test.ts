import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { C } from '@core/components';
import { SKILL_MAX_LEVEL } from '@core/constants';
import type { GameEvent } from '@core/events';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import {
  NO_JOB,
  cumulativeXp,
  dwarfSpeed,
  grantXp,
  jobXp,
  levelForXp,
  tierName,
  xpToNext,
  type DwarvesReader,
} from '@systems/dwarves';
import type { JobsReader, JobSink } from '@systems/jobs';
import { DWARF_SPEED } from '@core/path-constants';
import { IDLE_TICKS } from '@systems/dwarves/constants';
import { TestWorld } from '../../scenarios/test-world';

/** `skills-and-professions.md` § Skill levels, read from the document. */
function ladder(): { level: number; tier: string; xp: number }[] {
  const path = fileURLToPath(new URL('../../../docs/03-content/skills-and-professions.md', import.meta.url));
  const text = readFileSync(path, 'utf8');
  const section = text.slice(text.indexOf('## Skill levels'), text.indexOf('## Labors'));
  const out: { level: number; tier: string; xp: number }[] = [];
  for (const line of section.split(/\r?\n/)) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 3 || !/^\d+$/.test(cells[0] as string)) continue;
    out.push({ level: Number(cells[0]), tier: cells[1] === '—' ? '' : (cells[1] as string), xp: Number((cells[2] as string).replace(/,/g, '')) });
  }
  return out;
}

describe('T-M1-09 dwarves: skills and experience', () => {
  it('the xp ladder is the cumulative table of skills-and-professions.md, tier names included', () => {
    const rows = ladder();
    expect(rows).toHaveLength(SKILL_MAX_LEVEL + 1);
    for (const row of rows) {
      expect([row.level, cumulativeXp(row.level)]).toEqual([row.level, row.xp]);
      expect([row.level, tierName(row.level)]).toEqual([row.level, row.tier]);
      expect(levelForXp(row.xp)).toBe(row.level);
      if (row.level > 0) expect(levelForXp(row.xp - 1)).toBe(row.level - 1);
    }
    expect(xpToNext(0)).toBe(100);
    expect(xpToNext(19)).toBe(1240);
    expect(levelForXp(60000)).toBe(SKILL_MAX_LEVEL);
  });

  it('a completed job grants xp × (100 + Wits) / 150', () => {
    expect(jobXp(8, 50)).toBe(8);
    expect(jobXp(8, 100)).toBe(10);
    expect(jobXp(15, 0)).toBe(10);
  });

  it('level-ups emit SkillLevelUp at every level (5, 10, 15, 20 among them), LegendaryReached at 20, and drift attributes', () => {
    const w = new TestWorld({ seed: 'xp', world: 'flat-test', embark: 'default' });
    const entities = w.game.world.entities;
    const mining = w.game.registry.table('skills').index('mining');
    // A dwarf the preset gave no mining.
    const id = (w.game.arrival?.dwarves ?? []).find((d) => entities.get(d, C.Skills)?.level[mining] === 0) as EntityId;
    expect(id).toBeGreaterThan(0);
    const before = { ...(entities.get(id, C.Attributes) as { str: number; end: number }) };
    const events: GameEvent[] = [];
    grantXp(entities, w.game.registry, id, 'mining', cumulativeXp(SKILL_MAX_LEVEL), (e) => events.push(e));
    const levels = events.filter((e) => e.type === 'SkillLevelUp').map((e) => e['level']);
    expect(levels).toEqual(Array.from({ length: SKILL_MAX_LEVEL }, (_, k) => k + 1));
    for (const l of [5, 10, 15, 20]) expect(levels).toContain(l);
    expect(events.filter((e) => e.type === 'LegendaryReached')).toEqual([{ type: 'LegendaryReached', id, skill: 'mining' }]);
    const after = entities.get(id, C.Attributes) as { str: number; end: number };
    // mining → Strength and Endurance, ATTRIBUTE_DRIFT per level-up, capped at ATTRIBUTE_MAX.
    expect(after.str).toBe(Math.min(100, before.str + 20));
    expect(after.end).toBe(Math.min(100, before.end + 20));
    expect(w.readers.of<DwarvesReader>('10').skillTier(id, 'mining')).toBe('Legendary');
  });

  it('TestWorld.setSkill sets the level with its cumulative xp', () => {
    const w = new TestWorld({ seed: 'xp', world: 'flat-test', embark: 'default' });
    const id = w.game.arrival?.dwarves[1] as EntityId;
    w.setSkill(id, 'mining', 10);
    expect(w.readers.of<DwarvesReader>('10').skill(id, 'mining')).toBe(10);
    const s = w.game.registry.table('skills').index('mining');
    expect(w.game.world.entities.get(id, C.Skills)?.xp[s]).toBe(3700);
  });
});

describe('T-M1-09 dwarves: movement speed', () => {
  it('speed = species speed × (50 + Agility) / 100: DWARF_SPEED 0.15 at Agility 50', () => {
    expect(dwarfSpeed(DWARF_SPEED, 50)).toBe(150);
    expect(dwarfSpeed(DWARF_SPEED, 0)).toBe(75);
    expect(dwarfSpeed(DWARF_SPEED, 100)).toBe(225);
    expect(dwarfSpeed(DWARF_SPEED, 50, 50)).toBe(75);
  });

  it('the brain writes each dwarf\'s speed into Motion from its Agility', () => {
    const w = new TestWorld({ seed: 'speed', world: 'flat-test', embark: 'default' });
    w.step(1);
    for (const id of w.game.arrival?.dwarves ?? []) {
      const agi = w.game.world.entities.get(id, C.Attributes)?.agi as number;
      expect(w.game.world.entities.get(id, C.Motion)?.speed).toBe(dwarfSpeed(DWARF_SPEED, agi));
    }
  });
});

describe('T-M1-09 dwarves: behavior selection', () => {
  it('picks work when a job is assignable and idle otherwise', () => {
    const w = new TestWorld({ seed: 'brain', world: 'flat-test', embark: 'default' });
    const reader = w.readers.of<DwarvesReader>('10');
    w.step(3);
    const ids = w.game.arrival?.dwarves ?? [];
    for (const id of ids) {
      expect(reader.behavior(id)).toBe('idle');
      expect(reader.activityText(id)).toBe(NO_JOB);
    }
    expect(w.events('DwarfIdle')).toHaveLength(ids.length);
    // One dig job appears: the dwarf 11 gives it to is working the next time it chooses.
    const map = w.map;
    const tile = map.index(40, 10, 32);
    w.game.world.services.terrain.setKind(tile, TileKind.Wall, w.game.registry.table('materials').index('granite'));
    const producer = {
      id: 'terrain',
      done: false,
      produce(_ctx: unknown, sink: unknown): void {
        if (this.done) return;
        this.done = true;
        (sink as JobSink).create('dig:x', { type: 'dig', target: { kind: 'tile', ref: tile }, workTile: 'adjacent' });
      },
    };
    w.game.world.registrations.jobProducer(producer);
    const jobs = (w.game.world.scheduler.byId('11') as unknown as { board: { producers: unknown[] } }).board;
    jobs.producers.push(producer);
    w.step(10);
    const job = w.readers.of<JobsReader>('11').byKey('dig:x');
    expect(job?.workerId).toBeGreaterThan(0);
    const worker = job?.workerId as EntityId;
    expect(reader.behavior(worker)).toBe('work');
    expect(reader.activityText(worker)).toBe('Dig');
    for (const id of ids) if (id !== worker) expect(reader.behavior(id)).toBe('idle');
    expect(reader.population()).toBe(7);
    expect(reader.holder('thane')).toBe(w.game.arrival?.thane);
    expect(reader.productivity(worker)).toBe(100);
  });
});

describe('T-M1-09 dwarves: commands', () => {
  it('AssignTitle, RenameDwarf and SetSchedule validate as the catalog says', () => {
    const w = new TestWorld({ seed: 'titles', world: 'flat-test', embark: 'default' });
    const [a, b] = w.game.arrival?.dwarves ?? [];
    const reader = w.readers.of<DwarvesReader>('10');
    w.step(1);
    const apply = (cmd: Record<string, unknown>): unknown => w.game.world.applyCommand(cmd as never);
    expect(apply({ type: 'AssignTitle', dwarfId: a, title: 'warden' })).toEqual({ ok: true });
    expect(apply({ type: 'AssignTitle', dwarfId: b, title: 'warden' })).toEqual({ ok: true });
    expect(reader.title(a as EntityId)).toBe('thane');
    expect(reader.titles(a as EntityId)).toEqual(['thane']);
    expect(reader.holder('warden')).toBe(b);
    expect(apply({ type: 'AssignTitle', dwarfId: 0, title: 'warden' })).toEqual({ ok: true });
    expect(reader.holder('warden')).toBe(0);
    expect(apply({ type: 'AssignTitle', dwarfId: a, title: 'king' })).toEqual({ ok: false, reason: 'not_found' });
    expect(apply({ type: 'RenameDwarf', dwarfId: a, name: 'Urist' })).toEqual({ ok: true });
    expect(w.game.world.entities.get(a as EntityId, C.Creature)?.name).toBe('Urist');
    expect(apply({ type: 'RenameDwarf', dwarfId: a, name: 'x'.repeat(25) })).toEqual({ ok: false, reason: 'bad_name' });
    expect(apply({ type: 'SetSchedule', dwarfId: a, sleepStartHour: 22 })).toEqual({ ok: true });
    expect(apply({ type: 'SetSchedule', dwarfId: a, sleepStartHour: 24 })).toEqual({ ok: false, reason: 'out_of_range' });
  });

  it('D-057: every embarked dwarf has a schedule starting between 20:00 and 23:00 and a fresh brain', () => {
    const w = new TestWorld({ seed: 'sched', world: 'flat-test', embark: 'default' });
    for (const id of w.game.arrival?.dwarves ?? []) {
      const s = w.game.world.entities.get(id, C.Schedule);
      expect(s?.sleepHours).toBe(7);
      expect(s?.sleepStartHour).toBeGreaterThanOrEqual(20);
      expect(s?.sleepStartHour).toBeLessThanOrEqual(23);
      expect(w.game.world.entities.has(id, C.Brain)).toBe(true);
      expect(w.game.world.entities.has(id, C.Relationships)).toBe(true);
    }
  });
});

describe('F-11 idle responsiveness', () => {
  it('a dwarf standing idle claims a newly designated job within a handful of ticks rather than after 50', () => {
    const w = new TestWorld({ seed: 'f11-wake', world: 'flat-test', embark: 'default' });
    const reader = w.readers.of<DwarvesReader>('10');
    // Step until the dwarves enter idle with no work.
    w.step(3);
    const ids = w.game.arrival?.dwarves ?? [];
    for (const id of ids) {
      expect(reader.behavior(id)).toBe('idle');
      expect(reader.activityText(id)).toBe(NO_JOB);
    }
    // Pick an idle miner.
    const miner = ids[0] as EntityId;
    const brainBefore = w.game.world.entities.get(miner, C.Brain);
    expect(brainBefore?.behavior).toBe('idle');

    // Designate a dig adjacent to the wagon.
    const wagon = w.game.arrival?.wagon;
    expect(wagon).toBeDefined();
    const map = w.map;
    const tile = map.index((wagon?.x ?? 0) + 2, wagon?.y ?? 0, wagon?.z ?? 0);
    w.game.world.services.terrain.setKind(tile, TileKind.Wall, w.game.registry.table('materials').index('granite'));
    w.game.world.applyCommand({ type: 'Designate', tiles: [tile], kind: 'dig', priority: 5 });

    // Step until the job is active and worker is digging.
    let elapsed = 0;
    while (elapsed < IDLE_TICKS) {
      w.step(1);
      elapsed += 1;
      const jb = w.readers.of<JobsReader>('11').byKey(`dig:${tile}`);
      if (jb?.workerId === miner && reader.activityText(miner) === 'Dig') break;
    }
    // Must be claimed and working within a handful of ticks, well under IDLE_TICKS (50).
    expect(elapsed).toBeLessThanOrEqual(5);
    expect(elapsed).toBeLessThan(IDLE_TICKS);
    expect(reader.behavior(miner)).toBe('work');
    expect(reader.activityText(miner)).toBe('Dig');
  });

  it('with no job available, an idle dwarf re-evaluates on the IDLE_TICKS cadence and walks toward the idle goal', () => {
    const w = new TestWorld({ seed: 'f11-idle-cadence', world: 'flat-test', embark: 'default' });
    const reader = w.readers.of<DwarvesReader>('10');
    w.step(2);
    const miner = (w.game.arrival?.dwarves ?? [])[0] as EntityId;
    const brainInitial = w.game.world.entities.get(miner, C.Brain);
    expect(brainInitial?.behavior).toBe('idle');
    expect(reader.behavior(miner)).toBe('idle');
    expect(reader.activityText(miner)).toBe(NO_JOB);
    const initialUntil = brainInitial?.behaviorUntil as number;
    expect(initialUntil).toBe(w.game.world.calendar.tick - 1 + IDLE_TICKS);
    const goalTile = brainInitial?.targetTile as number;
    expect(goalTile).toBeGreaterThanOrEqual(0);

    // Across the 50-tick stretch, the dwarf stays idle with the same behaviorUntil.
    w.step(25);
    const brainMid = w.game.world.entities.get(miner, C.Brain);
    expect(brainMid?.behavior).toBe('idle');
    expect(brainMid?.behaviorUntil).toBe(initialUntil);

    // Step up to the re-evaluation tick.
    w.step(24);
    const brainAtEnd = w.game.world.entities.get(miner, C.Brain);
    expect(brainAtEnd?.behavior).toBe('idle');

    // On the tick after behaviorUntil, a new 50-tick cadence has started (D-057: 1 tick in work to query 11 + 50 idle).
    w.step(2);
    const brainNextCadence = w.game.world.entities.get(miner, C.Brain);
    expect(brainNextCadence?.behavior).toBe('idle');
    expect(brainNextCadence?.behaviorUntil).toBe(initialUntil + IDLE_TICKS + 1);

    // And dwarf walks toward or remains at the idle goal (wagon tile).
    const arrival = w.game.arrival;
    const wagonTile = w.index(arrival?.wagon.x ?? 0, arrival?.wagon.y ?? 0, arrival?.wagon.z ?? 0);
    expect(goalTile).toBe(wagonTile);
    expect(w.movement.tileOf(miner)).toBe(wagonTile);
  });
});
