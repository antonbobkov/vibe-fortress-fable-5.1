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
  it('speed = species speed × (50 + Agility) / 100: DWARF_SPEED 0.1 at Agility 50', () => {
    expect(dwarfSpeed(100, 50)).toBe(100);
    expect(dwarfSpeed(100, 0)).toBe(50);
    expect(dwarfSpeed(100, 100)).toBe(150);
    expect(dwarfSpeed(100, 50, 50)).toBe(50);
  });

  it('the brain writes each dwarf\'s speed into Motion from its Agility', () => {
    const w = new TestWorld({ seed: 'speed', world: 'flat-test', embark: 'default' });
    w.step(1);
    for (const id of w.game.arrival?.dwarves ?? []) {
      const agi = w.game.world.entities.get(id, C.Attributes)?.agi as number;
      expect(w.game.world.entities.get(id, C.Motion)?.speed).toBe(dwarfSpeed(100, agi));
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
    w.step(120);
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
    expect(reader.title(a as EntityId)).toBe('none');
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
