/**
 * T-802: peril grows with renown (18 § Schedule peril). Renown at each multiple of
 * RENOWN_PERIL_STEP reads the schedule one peril higher; a step is lost only RENOWN_PERIL_FALL below
 * it; peril 4 has nothing above it and `serene_vale` never steps.
 */
import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { createEntityStore } from '@core/components';
import type { GameEvent } from '@core/events';
import { RngStream } from '@core/rng';
import type { InitContext, TickContext } from '@core/system';
import type { World } from '@core/world';
import type { LocalMapSpec } from '@systems/embark/spec';
import { ThreatsSystem } from '@systems/threats';
import { RENOWN_PERIL_FALL, RENOWN_PERIL_STEP, RENOWN_WEALTH_DIVISOR } from '@systems/threats/constants';
import { calculatePartyComposition } from '@systems/threats/parties';
import type { ThreatsReader } from '@systems/threats/reader';
import { attentionText } from '@ui/panels/threats';
import { Strings } from '@ui/strings';
import {
  applyScheduleStep,
  earliestTickFromRow,
  initScheduleAtEmbark,
  nextRenownStep,
  renownForNextStep,
  type ThreatScheduleEntry,
} from '@systems/threats/schedule';

const registry = contentRegistry();
const YEAR = DAYS_PER_YEAR * TICKS_PER_DAY;
/** Day 1 of Spring, Year 4. */
const Y4 = 3 * YEAR;

describe('T-802 the schedule peril steps with renown', () => {
  it('steps at each multiple of RENOWN_PERIL_STEP, up to peril 4', () => {
    expect(RENOWN_PERIL_STEP).toBe(60);
    expect(nextRenownStep(2, [], 59.9, 0)).toBe(0);
    expect(nextRenownStep(2, [], 60, 0)).toBe(1);
    expect(nextRenownStep(2, [], 119, 0)).toBe(1);
    expect(nextRenownStep(2, [], 120, 0)).toBe(2);
    expect(nextRenownStep(1, [], 200, 0)).toBe(3);
    expect(nextRenownStep(3, [], 200, 0)).toBe(1);
    expect(nextRenownStep(4, [], 200, 0)).toBe(0);
    // Plain peril 0 steps as any other; a serene vale never does.
    expect(nextRenownStep(0, [], 60, 0)).toBe(1);
    expect(nextRenownStep(0, ['serene_vale'], 200, 0)).toBe(0);
  });

  it('keeps a step until renown falls RENOWN_PERIL_FALL below its threshold', () => {
    expect(nextRenownStep(2, [], RENOWN_PERIL_STEP - RENOWN_PERIL_FALL, 1)).toBe(1);
    expect(nextRenownStep(2, [], RENOWN_PERIL_STEP - RENOWN_PERIL_FALL - 0.1, 1)).toBe(0);
    expect(nextRenownStep(2, [], 2 * RENOWN_PERIL_STEP - 5, 2)).toBe(2);
    expect(nextRenownStep(2, [], 2 * RENOWN_PERIL_STEP - 15, 2)).toBe(1);
    expect(nextRenownStep(2, [], 5, 2)).toBe(0);
  });

  it('names the renown of the next step, or none', () => {
    expect(renownForNextStep(2, [], 0)).toBe(60);
    expect(renownForNextStep(2, [], 1)).toBe(120);
    expect(renownForNextStep(2, [], 2)).toBeNull();
    expect(renownForNextStep(3, [], 1)).toBeNull();
    expect(renownForNextStep(4, [], 0)).toBeNull();
    expect(renownForNextStep(0, ['serene_vale'], 0)).toBeNull();
  });
});

describe('T-802 a step moves the schedule to the next peril\'s rows', () => {
  const p2 = (): Map<string, ThreatScheduleEntry> => initScheduleAtEmbark(registry, 2, [], new RngStream(802));

  it('at embark the schedule is the region\'s, as before', () => {
    const a = p2();
    expect(a.get('siege')?.earliestTick).toBe(-1);
    expect(a.get('raid')?.max).toBe(16);
    expect([...a.values()].every((e) => e.peril === 2)).toBe(true);
  });

  it('a siege becomes possible from today; a raid keeps its date and next roll and takes peril 3\'s interval and sizes', () => {
    const s = p2();
    const raid = { ...s.get('raid')! };
    applyScheduleStep(s, registry, 3, [], Y4 + 5 * TICKS_PER_DAY, new RngStream(1));
    const siege = s.get('siege')!;
    expect(siege.peril).toBe(3);
    // Peril 3's sieges come from Spring, Year 3: already past, so from today.
    expect(siege.earliestTick).toBe(Y4 + 5 * TICKS_PER_DAY);
    expect(siege.nextTick).toBeGreaterThan(siege.earliestTick);
    expect(siege.nextTick).toBeLessThanOrEqual(siege.earliestTick + 20 * TICKS_PER_DAY);
    expect([siege.base, siege.max, siege.intervalMin, siege.intervalMax]).toEqual([14, 32, 224, 336]);
    const r = s.get('raid')!;
    expect(r.earliestTick).toBe(raid.earliestTick);
    expect(r.nextTick).toBe(raid.nextTick);
    expect([r.base, r.max, r.intervalMin, r.intervalMax]).toEqual([8, 20, 56, 112]);
    expect(s.get('ambush')?.max).toBe(8);
  });

  it('a kind not yet possible that the higher row allows sooner comes sooner; a fall stops a siege and keeps its next roll', () => {
    const s = p2();
    // In Autumn of Year 1 a peril 2 raid is not yet possible (Spring, Year 2); peril 3's are, from Autumn, Year 1.
    const autumnY1 = earliestTickFromRow({ year: 1, season: 2 });
    applyScheduleStep(s, registry, 3, [], autumnY1, new RngStream(2));
    expect(s.get('raid')?.earliestTick).toBe(autumnY1);
    expect(s.get('raid')?.nextTick).toBeLessThanOrEqual(autumnY1 + 20 * TICKS_PER_DAY);

    const later = p2();
    applyScheduleStep(later, registry, 3, [], Y4, new RngStream(3));
    const siege = later.get('siege')!;
    siege.nextTick = Y4 + 250 * TICKS_PER_DAY; // a siege came, and the next is far off
    applyScheduleStep(later, registry, 2, [], Y4 + 30 * TICKS_PER_DAY, new RngStream(4));
    expect(siege.earliestTick).toBe(-1);
    expect(siege.nextTick).toBe(Y4 + 250 * TICKS_PER_DAY);
    expect(later.get('raid')?.max).toBe(16);
    // A rise soon after does not bring the next siege sooner than it was due.
    applyScheduleStep(later, registry, 3, [], Y4 + 40 * TICKS_PER_DAY, new RngStream(5));
    expect(siege.earliestTick).toBe(Y4 + 40 * TICKS_PER_DAY);
    expect(siege.nextTick).toBe(Y4 + 250 * TICKS_PER_DAY);
  });

  it('a siege read at peril 3 has peril 3\'s trollkin and hexers', () => {
    const ofRole = (peril: number, role: string): number =>
      calculatePartyComposition('siege', 30, 65, peril, false, 4).filter((m) => m.role === role || m.species === role).length;
    expect(ofRole(3, 'trollkin')).toBe(6);
    expect(ofRole(3, 'hexer')).toBe(2);
  });
});

describe('T-802 the Threats panel says what renown does to the schedule', () => {
  const strings = new Strings(registry);
  const reader = (now: number, at: number | null): ThreatsReader =>
    ({ schedulePeril: () => now, nextPerilRenown: () => at }) as unknown as ThreatsReader;

  it('names the next step, the step taken, both, or neither', () => {
    expect(attentionText(strings, 2, reader(2, 60))).toBe('Wealth and population draw attention: at renown 60, the Gloam come as at peril 3.');
    expect(attentionText(strings, 2, reader(3, 120))).toBe('Wealth and population have drawn the Gloam: they come as at peril 3, and at renown 120 as at peril 4.');
    expect(attentionText(strings, 3, reader(4, null))).toBe('Wealth and population have drawn the Gloam: they come as at peril 4.');
    expect(attentionText(strings, 4, reader(4, null))).toBe('Wealth and population draw attention.');
    expect(attentionText(strings, 0, null)).toBe('Wealth and population draw attention.');
  });

  it('the rise is an alert naming the peril', () => {
    expect(strings.get('announce.peril_rose', { peril: 3 })).toBe(
      'Word of the fortress\'s riches has spread. The Gloam will come as they do at peril 3: more often, and more of them.');
  });
});

describe('T-802 the threats system steps on DayPassed', () => {
  const make = (peril: number, traits: string[], wealth: number): {
    sys: ThreatsSystem; events: GameEvent[]; day: (tick: number) => void; init: InitContext; fortress: { wealthCached: number };
  } => {
    const sys = new ThreatsSystem({ spec: { peril, traits } as unknown as LocalMapSpec });
    const events: GameEvent[] = [];
    const entities = createEntityStore();
    const fortress = { wealthCached: wealth, name: 'TestFort' };
    const world = {
      entities,
      fortress,
      emit: (e: GameEvent) => events.push(e),
      map: { w: 48, h: 48, columnSurfaceZ: () => 32, index: (x: number, y: number, z: number) => (z * 48 + y) * 48 + x, kindAt: () => 1 },
      services: { spawn: { creature: () => entities.create('creature'), item: () => entities.create('item') } },
    } as unknown as World;
    const init = { rng: new RngStream(42), registry, world, register: { panel: () => {}, announcement: () => {} } } as unknown as InitContext;
    sys.init(init);
    const day = (tick: number): void => {
      const ctx = { tick, world, registry, readers: { has: () => false }, emit: (e: GameEvent) => events.push(e) } as unknown as TickContext;
      sys.handle({ type: 'DayPassed', dayOfSeason: 1, season: 0, year: 4 }, ctx);
    };
    return { sys, events, day, init, fortress };
  };

  it('a renown of 60 at peril 2 announces the rise, reads peril 3 and previews sieges; a load keeps it', () => {
    const { sys, events, day, init, fortress } = make(2, [], 59 * RENOWN_WEALTH_DIVISOR);
    day(Y4);
    expect(sys.reader().schedulePeril()).toBe(2);
    expect(sys.reader().nextPerilRenown()).toBe(60);
    expect(sys.reader().schedulePreview()['siege']).toBeNull();
    fortress.wealthCached = 61 * RENOWN_WEALTH_DIVISOR;
    day(Y4 + TICKS_PER_DAY);
    expect(events.filter((e) => e.type === 'PerilRose')).toEqual([{ type: 'PerilRose', peril: 3 }]);
    expect(sys.reader().schedulePeril()).toBe(3);
    expect(sys.reader().nextPerilRenown()).toBe(120);
    expect(sys.reader().schedulePreview()['siege']).toEqual({ season: 'spring', year: 4 });

    const saved = sys.serialize();
    expect(saved.renownStep).toBe(1);
    const restored = new ThreatsSystem({ spec: { peril: 2, traits: [] } as unknown as LocalMapSpec });
    restored.init({ ...init, rng: new RngStream(7) });
    restored.deserialize(saved, init);
    expect(restored.reader().schedulePeril()).toBe(3);
    expect(restored.serialize()).toEqual(saved);
    const raid = (restored as unknown as { schedule: Map<string, ThreatScheduleEntry> }).schedule.get('raid');
    expect(raid?.max).toBe(20);

    // A fall below 50 turns it back, without a line.
    fortress.wealthCached = 49 * RENOWN_WEALTH_DIVISOR;
    day(Y4 + 2 * TICKS_PER_DAY);
    expect(sys.reader().schedulePeril()).toBe(2);
    expect(sys.reader().schedulePreview()['siege']).toBeNull();
    expect(events.filter((e) => e.type === 'PerilRose')).toHaveLength(1);
    expect(sys.serialize().renownStep).toBeUndefined();
  });

  it('a serene vale and peril 4 do not step', () => {
    for (const [peril, traits] of [[0, ['serene_vale']], [4, []]] as const) {
      const { sys, events, day } = make(peril, [...traits], 200 * RENOWN_WEALTH_DIVISOR);
      day(Y4);
      expect(sys.reader().schedulePeril()).toBe(peril);
      expect(sys.reader().nextPerilRenown()).toBeNull();
      expect(events.filter((e) => e.type === 'PerilRose')).toHaveLength(0);
    }
  });

  it('a siege read by a peril 2 region never comes in winter, the passes being closed', () => {
    const { sys, events, day } = make(2, [], 70 * RENOWN_WEALTH_DIVISOR);
    day(Y4);
    const siege = (sys as unknown as { schedule: Map<string, ThreatScheduleEntry> }).schedule.get('siege')!;
    const winter = Y4 + 3 * 28 * TICKS_PER_DAY;
    siege.nextTick = winter;
    day(winter);
    expect(events.filter((e) => e.type === 'ThreatWarning' && (e as { kind?: string }).kind === 'siege')).toHaveLength(0);
    day(Y4 + YEAR);
    expect(events.filter((e) => e.type === 'ThreatWarning' && (e as { kind?: string }).kind === 'siege')).toHaveLength(1);
  });
});
