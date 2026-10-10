import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { EAT_TICKS, HEARTH_VISIT_TICKS, TALK_TICKS } from '@systems/dwarves/constants';
import { SOCIAL_PER_HOUR } from '@systems/dwarves/needs';
import type { DwarvesStateV1 } from '@systems/dwarves/state';
import type { JobSink, JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

/** A hearth at (20, 20): its hall is the 5×5 around it. One table at (19, 19) with a chair on each side. */
function hall(seed: string): { w: TestWorld; west: number; east: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  w.build('hearth', w.index(20, 20, Z), 'granite');
  w.build('table', w.index(19, 19, Z), 'oak');
  w.build('chair', w.index(18, 19, Z), 'oak');
  w.build('chair', w.index(20, 19, Z), 'oak');
  return { w, west: w.index(18, 19, Z), east: w.index(20, 19, Z) };
}

const need = (w: TestWorld, id: EntityId, name: 'social' | 'comfort' | 'joy' | 'hunger'): number =>
  w.game.world.entities.get(id, C.Needs)?.[name] ?? -1;

/** Steps until the next `type` event and returns how far `name` fell in that one tick. */
function reliefAt(w: TestWorld, id: EntityId, name: 'comfort' | 'joy', type: 'MealEaten', max = 200): number {
  const seen = w.events(type).length;
  for (let tick = 0; tick < max; tick += 1) {
    const before = need(w, id, name);
    w.step(1);
    if (w.events(type).length > seen) return before - need(w, id, name);
  }
  throw new Error(`no ${type} within ${max} ticks`);
}

/** Every need but the named ones is held at zero so that only the rule under test acts. */
function quiet(w: TestWorld, id: EntityId, keep: readonly string[]): void {
  for (const name of ['hunger', 'thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) {
    if (!keep.includes(name)) w.setNeed(id, name, 0);
  }
}

describe('T-144 wants without errands', () => {
  it('a meal at a table in the hall is also a sit there; a meal at a table outside any hall is not', () => {
    const { w, west } = hall('t144-table-sit');
    const id = w.spawnDwarf({ at: w.index(17, 19, Z) });
    quiet(w, id, []);
    w.spawnItem('easy_meal', 'dimcap', w.index(17, 19, Z));
    w.setNeed(id, 'hunger', 55);
    // Below the comfort want threshold of 55: no sit of its own is due.
    w.setNeed(id, 'comfort', 54);
    expect(reliefAt(w, id, 'comfort', 'MealEaten')).toBe(20);
    expect(w.events('MealEaten')[0]).toMatchObject({ id, atTable: true });
    expect(w.game.world.services.movement?.tileOf(id)).toBe(west);
    expect(need(w, id, 'comfort')).toBeLessThan(40);
    expect(w.events('Sat')).toMatchObject([{ type: 'Sat', id }]);

    const bare = new TestWorld({ seed: 't144-table-outside', world: 'flat-test', embark: 'none' });
    bare.build('table', bare.index(19, 19, Z), 'oak');
    bare.build('chair', bare.index(18, 19, Z), 'oak');
    const other = bare.spawnDwarf({ at: bare.index(17, 19, Z) });
    quiet(bare, other, []);
    bare.spawnItem('easy_meal', 'dimcap', bare.index(17, 19, Z));
    bare.setNeed(other, 'hunger', 55);
    bare.setNeed(other, 'comfort', 54);
    expect(reliefAt(bare, other, 'comfort', 'MealEaten')).toBe(0);
    expect(bare.events('MealEaten')[0]).toMatchObject({ id: other, atTable: true });
    expect(bare.events('Sat')).toHaveLength(0);
  });

  it('eating in the hearth hall adds up to a hearth visit, once, and the count is saved', () => {
    const { w } = hall('t144-hearth-time');
    const id = w.spawnDwarf({ at: w.index(17, 19, Z) });
    quiet(w, id, []);
    w.spawnItem('easy_meal', 'dimcap', w.index(17, 19, Z), 3);
    // Below the joy want threshold of 60: no hearth visit of its own is due.
    w.setNeed(id, 'joy', 50);
    w.setNeed(id, 'hunger', 55);
    expect(reliefAt(w, id, 'joy', 'MealEaten')).toBe(0);
    expect(EAT_TICKS).toBeLessThan(HEARTH_VISIT_TICKS);
    expect(w.events('HearthVisited')).toHaveLength(0);
    expect(w.dwarves.activities.hearthTicks.get(id)).toBe(EAT_TICKS);

    const saved = w.dwarves.serialize() as DwarvesStateV1;
    expect(saved.hearthTicks).toEqual([[id, EAT_TICKS]]);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());

    for (const game of [w.game, loaded]) {
      const dwarves = game.world.scheduler.byId('10') as unknown as { setNeed(id: EntityId, name: string, value: number): void };
      dwarves.setNeed(id, 'hunger', 55);
    }
    let relief = 0;
    for (let tick = 0; tick < 200 && w.events('MealEaten').length < 2; tick += 1) {
      const before = need(w, id, 'joy');
      w.step(1);
      loaded.step(1);
      expect(loaded.hash()).toBe(w.hash());
      relief = before - need(w, id, 'joy');
    }
    expect(w.events('MealEaten')).toHaveLength(2);
    expect(2 * EAT_TICKS).toBeGreaterThanOrEqual(HEARTH_VISIT_TICKS);
    expect(w.events('HearthVisited')).toMatchObject([{ type: 'HearthVisited', id }]);
    expect(relief).toBe(30);
    expect(w.dwarves.activities.hearthTicks.has(id)).toBe(false);
    expect((w.dwarves.serialize() as DwarvesStateV1).hearthTicks).toBeUndefined();
  });

  it('two dwarves eating at one table talk without a trip, and the talk is saved', () => {
    const { w, west, east } = hall('t144-table-talk');
    const a = w.spawnDwarf({ at: w.index(17, 19, Z) });
    const b = w.spawnDwarf({ at: w.index(21, 19, Z) });
    quiet(w, a, []);
    quiet(w, b, []);
    w.spawnItem('easy_meal', 'dimcap', w.index(17, 19, Z));
    w.spawnItem('easy_meal', 'dimcap', w.index(21, 19, Z));
    w.setNeed(a, 'hunger', 55);
    w.setNeed(b, 'hunger', 55);
    w.setNeed(a, 'social', 55);
    const trips: number[] = [];
    const watch = (): void => {
      for (const id of [a, b]) {
        const p = w.dwarves.activities.plans.get(id);
        if (p?.need === 'social' && p.phase !== 'use') trips.push(id);
      }
    };
    for (let tick = 0; tick < 200 && w.dwarves.activities.talks.size === 0; tick += 1) { w.step(1); watch(); }
    // The talk began in the tick just stepped.
    const started = w.tick - 1;
    expect(w.dwarves.activities.talks.get(a)).toEqual({ partner: b, until: started + TALK_TICKS });
    expect(w.dwarves.activities.talks.get(b)).toEqual({ partner: a, until: started + TALK_TICKS });
    expect(w.game.world.services.movement?.tileOf(a)).toBe(west);
    expect(w.game.world.services.movement?.tileOf(b)).toBe(east);
    expect((w.dwarves.serialize() as DwarvesStateV1).talks).toEqual([[Math.min(a, b), Math.max(a, b), started + TALK_TICKS]]);

    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    let relief = 0;
    while (w.tick <= started + TALK_TICKS) {
      const before = need(w, a, 'social');
      w.step(1);
      relief = before - need(w, a, 'social');
      loaded.step(1);
      watch();
      expect(loaded.hash()).toBe(w.hash());
      // The meals are over before the talk is: both stay seated for it.
      if (w.tick <= started + TALK_TICKS) {
        expect(w.game.world.services.movement?.tileOf(a)).toBe(west);
        expect(w.game.world.services.movement?.tileOf(b)).toBe(east);
      }
    }
    expect(w.events('MealEaten')).toHaveLength(2);
    expect(w.events('Talked')).toMatchObject([{ type: 'Talked', a: Math.min(a, b), b: Math.max(a, b) }]);
    // The talk may end on an hour boundary, where the need also takes its hourly rise.
    expect([40, 40 - SOCIAL_PER_HOUR]).toContain(relief);
    expect(need(w, a, 'social')).toBeLessThan(50);
    expect(need(w, b, 'social')).toBeLessThan(5);
    expect(w.dwarves.activities.talks.size).toBe(0);
    expect(trips).toEqual([]);
    expect(w.game.world.entities.get(a, C.Relationships)?.talkCount).toEqual([[b, 1]]);
  });

  it('a sleeping neighbour, a distant one and a walking one are no partners', () => {
    const { w } = hall('t144-no-partner');
    const a = w.spawnDwarf({ at: w.index(17, 19, Z) });
    const sleeper = w.spawnDwarf({ at: w.index(18, 20, Z) });
    const far = w.spawnDwarf({ at: w.index(22, 19, Z) });
    for (const id of [a, sleeper, far]) quiet(w, id, []);
    w.setNeed(sleeper, 'rest', 100);
    w.step(3);
    expect(w.dwarves.activities.plans.get(sleeper)).toMatchObject({ need: 'rest', phase: 'use' });
    w.spawnItem('easy_meal', 'dimcap', w.index(17, 19, Z));
    w.spawnItem('easy_meal', 'dimcap', w.index(22, 19, Z));
    w.setNeed(a, 'hunger', 55);
    w.setNeed(far, 'hunger', 55);
    w.setNeed(a, 'social', 55);
    // `far` walks past to the east chair, two tiles from `a`'s chair, and is then a partner.
    let walkedPast = false;
    for (let tick = 0; tick < 300 && w.events('Talked').length === 0; tick += 1) {
      w.step(1);
      const talk = w.dwarves.activities.talks.get(a);
      if (talk === undefined) continue;
      expect(talk.partner).toBe(far);
      expect(w.game.world.services.movement?.walkTarget(far)).toBe(-1);
      expect(w.game.world.services.movement?.walkTarget(a)).toBe(-1);
      walkedPast = true;
    }
    expect(walkedPast).toBe(true);
    expect(w.dwarves.activities.plans.get(sleeper)).toMatchObject({ need: 'rest', phase: 'use' });
    expect(w.events('Talked')).toHaveLength(1);
  });

  it('social, comfort and joy wait for work to run out; hunger does not', () => {
    const w = new TestWorld({ seed: 't144-order', world: 'flat-test', embark: 'none' });
    w.build('hearth', w.index(20, 20, Z), 'granite');
    const at = w.index(12, 12, Z);
    const id = w.spawnDwarf({ at });
    quiet(w, id, []);
    w.game.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor: 'mining', on: true });
    w.spawnItem('pick', 'copper', at);
    const granite = w.game.registry.table('materials').index('granite');
    const targets = [w.index(14, 12, Z), w.index(14, 14, Z)];
    for (const target of targets) w.game.world.services.terrain.setKind(target, TileKind.Wall, granite);
    let made = 0;
    const producer = { id: 't144-dig', produce(_ctx: unknown, sink: JobSink): void {
      while (made < targets.length) {
        // The default priority: the old rule put a want before such a job.
        sink.create(`t144-dig-${made}`, { type: 'dig', target: { kind: 'tile', ref: targets[made] as number }, workTile: 'adjacent', priority: 5 });
        made += 1;
      }
    } };
    w.game.world.registrations.jobProducer(producer);
    w.step(2);
    w.setNeed(id, 'social', 90);
    w.setNeed(id, 'comfort', 90);
    w.setNeed(id, 'joy', 90);
    const jobs = w.readers.of<JobsReader>('11');
    const jobOf = (): number => w.game.world.entities.get(id, C.Worker)?.jobId ?? 0;
    expect(jobs.byKey('t144-dig-0')?.workerId).toBe(id);
    expect(jobs.byKey('t144-dig-1')?.state).toBe('open');
    let errandWhileDigging = false;
    let ticks = 0;
    // The first job was held when the wants rose; the second is taken before any of them.
    for (; ticks < 300 && jobs.byKey('t144-dig-1') !== undefined; ticks += 1) {
      w.step(1);
      if (w.dwarves.activities.plans.has(id)) errandWhileDigging = true;
    }
    expect(ticks).toBeLessThan(300);
    expect(errandWhileDigging).toBe(false);
    expect(w.events('HearthVisited')).toHaveLength(0);
    expect(w.events('Sat')).toHaveLength(0);
    // With the work done the wants are served, the highest first.
    w.until(() => w.events('HearthVisited').length === 1 && w.events('Sat').length === 1, 600);
    expect(jobOf()).toBe(0);
    expect(need(w, id, 'joy')).toBeLessThan(90);
    expect(need(w, id, 'comfort')).toBeLessThan(90);

    // A body want at default priority still goes before the job.
    const hungry = new TestWorld({ seed: 't144-order-hunger', world: 'flat-test', embark: 'none' });
    const start = hungry.index(12, 12, Z);
    const eater = hungry.spawnDwarf({ at: start });
    quiet(hungry, eater, []);
    hungry.game.world.applyCommand({ type: 'SetLabor', dwarfId: eater, labor: 'mining', on: true });
    hungry.spawnItem('pick', 'copper', start);
    hungry.spawnItem('easy_meal', 'dimcap', start);
    const wall = hungry.index(14, 12, Z);
    hungry.game.world.services.terrain.setKind(wall, TileKind.Wall, hungry.game.registry.table('materials').index('granite'));
    let created = false;
    hungry.game.world.registrations.jobProducer({ id: 't144-dig-hungry', produce(_ctx: unknown, sink: JobSink): void {
      if (created) return;
      created = true;
      sink.create('t144-dig-hungry', { type: 'dig', target: { kind: 'tile', ref: wall }, workTile: 'adjacent', priority: 5 });
    } });
    hungry.setNeed(eater, 'hunger', 55);
    let waited = 0;
    for (; waited < 200; waited += 1) {
      hungry.step(1);
      if (hungry.events('MealEaten').length === 1) break;
      if (waited > 0) expect(hungry.readers.of<JobsReader>('11').byKey('t144-dig-hungry')?.state).toBe('open');
    }
    expect(waited).toBeGreaterThanOrEqual(EAT_TICKS);
    expect(hungry.events('MealEaten')).toHaveLength(1);
  });
});
