/**
 * Unit tests for threats schedule, renown, party composition, gear, and rules.
 * `05-plan/M6-steel-and-blood.md` § T-M6-08:
 * "unit: size formula caps; composition fractions; gear per tier; no winter raids at peril ≤ 2."
 */

import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { TICKS_PER_DAY } from '@core/constants';
import { C, createEntityStore } from '@core/components';
import type { GameEvent } from '@core/events';
import { RngStream } from '@core/rng';
import type { InitContext, TickContext } from '@core/system';
import type { World } from '@core/world';
import type { LocalMapSpec } from '@systems/embark/spec';
import { ThreatsSystem } from '@systems/threats';
import {
  calculateGearTier,
  assignHostileSkills,
  equipHostileCreature,
} from '@systems/threats/gear';
import {
  calculatePartyComposition,
} from '@systems/threats/parties';
import {
  calculatePartySize,
  calculateRenown,
  earliestTickFromRow,
  initScheduleAtEmbark,
  type ThreatScheduleEntry,
} from '@systems/threats/schedule';

describe('Threats schedule and renown (T-M6-08)', () => {
  const registry = contentRegistry();

  describe('size formula caps', () => {
    it('computes renown from wealth and population per the formula', () => {
      // renown = wealth / 2000 + population * 0.2
      expect(calculateRenown(0, 0)).toBe(0);
      expect(calculateRenown(6000, 13)).toBeCloseTo(5.6, 2);
      expect(calculateRenown(18000, 28)).toBeCloseTo(14.6, 2);
      expect(calculateRenown(40000, 45)).toBeCloseTo(29.0, 2);
      expect(calculateRenown(120000, 70)).toBeCloseTo(74.0, 2);
    });

    it('scales size with renown and respects base and max caps', () => {
      // calculatePartySize(base, perRenownFixed, max, renown)
      // peril 1 raid: base 5, perRenown 200 (0.20), max 12
      expect(calculatePartySize(5, 200, 12, 0)).toBe(5);
      expect(calculatePartySize(5, 200, 12, 5)).toBe(6); // 5 + 5 * 0.2 = 6
      expect(calculatePartySize(5, 200, 12, 10)).toBe(7); // 5 + 10 * 0.2 = 7
      expect(calculatePartySize(5, 200, 12, 20)).toBe(9); // 5 + 20 * 0.2 = 9
      expect(calculatePartySize(5, 200, 12, 35)).toBe(12); // 5 + 35 * 0.2 = 12 (at cap)
      expect(calculatePartySize(5, 200, 12, 100)).toBe(12); // capped at max 12

      // minimum size is at least 1
      expect(calculatePartySize(0, 0, 10, 0)).toBe(1);
    });

    it('computes earliest tick from row', () => {
      expect(earliestTickFromRow(null)).toBe(-1);
      // year 1, season 0, day 1 -> day 0 -> tick 0
      expect(earliestTickFromRow({ year: 1, season: 0, day: 1 })).toBe(0);
      // year 2, season 2, day 1 -> day (112 + 56) = 168 -> 168 * 1200 = 201,600
      expect(earliestTickFromRow({ year: 2, season: 2 })).toBe(168 * TICKS_PER_DAY);
    });
  });

  describe('composition fractions', () => {
    it('generates ambush composition (60% warriors, 40% archers, no captain)', () => {
      const comp = calculatePartyComposition('ambush', 10, 10, 2);
      expect(comp).toHaveLength(10);
      const archers = comp.filter((m) => m.role === 'archers');
      const warriors = comp.filter((m) => m.role === 'warriors');
      const captains = comp.filter((m) => m.isCaptain);
      expect(archers).toHaveLength(4);
      expect(warriors).toHaveLength(6);
      expect(captains).toHaveLength(0);
    });

    it('generates raid composition with captain added on top', () => {
      // size 5 raid: 30% archers = 2, 70% warriors = 3, plus 1 captain = total 6
      const comp5 = calculatePartyComposition('raid', 5, 10, 1);
      expect(comp5).toHaveLength(6);
      expect(comp5.filter((m) => m.isCaptain)).toHaveLength(1);
      expect(comp5.filter((m) => m.role === 'archers')).toHaveLength(2);
      expect(comp5.filter((m) => m.role === 'warriors')).toHaveLength(3);

      // size 10 raid: 30% archers = 3, 70% warriors = 7, plus 1 captain = total 11
      const comp10 = calculatePartyComposition('raid', 10, 10, 1);
      expect(comp10).toHaveLength(11);
      expect(comp10.filter((m) => m.isCaptain)).toHaveLength(1);
      expect(comp10.filter((m) => m.role === 'archers')).toHaveLength(3);
      expect(comp10.filter((m) => m.role === 'warriors')).toHaveLength(7);
    });

    it('generates siege composition with captains and trollkin', () => {
      const comp = calculatePartyComposition('siege', 20, 30, 3);
      // Captains: 1 + floor(20/20) = 2
      // Trollkin peril 3: min(6, floor(2 + 30/15)) = 4
      // Archers: round(20 * 0.3) = 6
      // Warriors: 20 - 6 = 14
      // Total = 2 + 4 + 6 + 14 = 26
      expect(comp).toHaveLength(26);
      expect(comp.filter((m) => m.isCaptain)).toHaveLength(2);
      expect(comp.filter((m) => m.species === 'trollkin')).toHaveLength(4);
      expect(comp.filter((m) => m.role === 'archers')).toHaveLength(6);
      expect(comp.filter((m) => m.role === 'warriors' && m.species === 'gloam_warrior')).toHaveLength(14);
    });

    it('generates bandits composition (100% hillfolk_bandit, no captain)', () => {
      const comp = calculatePartyComposition('bandits', 4, 10, 1);
      expect(comp).toHaveLength(4);
      expect(comp.every((m) => m.species === 'hillfolk_bandit')).toBe(true);
      expect(comp.every((m) => !m.isCaptain)).toBe(true);
    });

    it('generates thief composition (1 snatcher, 2 with twilight_pass)', () => {
      const comp1 = calculatePartyComposition('thief', 1, 0, 1, false);
      expect(comp1).toHaveLength(1);
      expect(comp1[0]?.species).toBe('gloam_snatcher');

      const comp2 = calculatePartyComposition('thief', 1, 0, 1, true);
      expect(comp2).toHaveLength(2);
      expect(comp2.every((m) => m.species === 'gloam_snatcher')).toBe(true);
    });
  });

  describe('gear per tier', () => {
    it('calculates hostile gear tier correctly', () => {
      // Bandits and restless dead are always tier 0
      expect(calculateGearTier(1, 'bandits', false)).toBe(0);
      expect(calculateGearTier(3, 'bandits', true)).toBe(0);
      expect(calculateGearTier(2, 'restless_dead', false)).toBe(0);

      // Warriors / archers: min(peril, 3)
      expect(calculateGearTier(0, 'raid', false)).toBe(0);
      expect(calculateGearTier(1, 'raid', false)).toBe(1);
      expect(calculateGearTier(2, 'raid', false)).toBe(2);
      expect(calculateGearTier(3, 'raid', false)).toBe(3);
      expect(calculateGearTier(4, 'raid', false)).toBe(3); // capped at 3

      // Captains get +1
      expect(calculateGearTier(1, 'raid', true)).toBe(2);
      expect(calculateGearTier(2, 'raid', true)).toBe(3);
      expect(calculateGearTier(3, 'raid', true)).toBe(4);
      expect(calculateGearTier(4, 'raid', true)).toBe(4); // capped at 4

      // Sieges get +1
      expect(calculateGearTier(3, 'siege', false)).toBe(4); // 3 + 1 = 4
      expect(calculateGearTier(3, 'siege', true)).toBe(4); // 3 + 1 + 1 = 5 -> capped at 4
    });

    it('assigns hostile skills based on gear tier', () => {
      const entities = createEntityStore();
      const id1 = entities.create('creature');
      // Tier 1 warrior: 2 + 2 * 1 = 4
      assignHostileSkills(entities, registry, id1, 1, false);
      const skills1 = entities.get(id1, C.Skills);
      expect(skills1).toBeDefined();
      expect(skills1?.level[1]).toBe(4);

      // Tier 1 captain: 2 + 2 * 1 + 2 = 6
      const id2 = entities.create('creature');
      assignHostileSkills(entities, registry, id2, 1, true);
      const skills2 = entities.get(id2, C.Skills);
      expect(skills2?.level[1]).toBe(6);

      // Tier 3 warrior: 2 + 2 * 3 = 8
      const id3 = entities.create('creature');
      assignHostileSkills(entities, registry, id3, 3, false);
      const skills3 = entities.get(id3, C.Skills);
      expect(skills3?.level[1]).toBe(8);

      // Tier 4 captain: 2 + 2 * 4 + 2 = 12
      const id4 = entities.create('creature');
      assignHostileSkills(entities, registry, id4, 4, true);
      const skills4 = entities.get(id4, C.Skills);
      expect(skills4?.level[1]).toBe(12);
    });

    it('equips hostile creatures with appropriate gear', () => {
      const entities = createEntityStore();
      const spawnedItems: number[] = [];
      const worldMock = {
        entities,
        services: {
          spawn: {
            item: (_type: number, _material: number, _at: number) => {
              const itemId = entities.create('item');
              entities.add(itemId, C.Item, {
                type: _type,
                material: _material,
                quality: 1,
                count: 1,
                flags: 0,
                carriedBy: 0,
                containerId: 0,
                wear: 0,
                ownerId: 0,
                crafterId: 0,
                rotStart: 0,
                rotStage: 0,
                reservedBy: 0,
              });
              spawnedItems.push(itemId);
              return itemId;
            },
          },
        },
      };

      const rng = new RngStream(12345);
      const creatureId = entities.create('creature');

      equipHostileCreature(worldMock, registry, rng, creatureId, 100, 'warriors', 2, false);
      const eq = entities.get(creatureId, C.Equipment);
      expect(eq).toBeDefined();
      expect(eq?.weapon).toBeGreaterThan(0);
      expect(spawnedItems.length).toBeGreaterThan(0);
    });
  });

  describe('schedule initialization and trait modifiers', () => {
    it('disables non-thief threats under serene_vale', () => {
      const rng = new RngStream(54321);
      const sched = initScheduleAtEmbark(registry, 2, ['serene_vale'], rng);
      expect(sched.get('thief')?.earliestTick).toBeGreaterThanOrEqual(0);
      expect(sched.get('raid')?.earliestTick).toBe(-1);
      expect(sched.get('ambush')?.earliestTick).toBe(-1);
      expect(sched.get('siege')?.earliestTick).toBe(-1);
      expect(sched.get('bandits')?.earliestTick).toBe(-1);
    });

    it('halves intervals under twilight_pass', () => {
      const rng = new RngStream(67890);
      const normalSched = initScheduleAtEmbark(registry, 2, [], rng);
      const twilightSched = initScheduleAtEmbark(registry, 2, ['twilight_pass'], rng);

      const normalRaid = normalSched.get('raid')!;
      const twilightRaid = twilightSched.get('raid')!;

      expect(twilightRaid.intervalMin).toBe(Math.round(normalRaid.intervalMin * 0.5));
      expect(twilightRaid.intervalMax).toBe(Math.round(normalRaid.intervalMax * 0.5));
    });

    it('enables threats according to peril rating', () => {
      const rng = new RngStream(99999);
      // Peril 0: no ambushes, raids, sieges
      const p0 = initScheduleAtEmbark(registry, 0, [], rng);
      expect(p0.get('thief')?.earliestTick).toBeGreaterThanOrEqual(0);
      expect(p0.get('bandits')?.earliestTick).toBeGreaterThanOrEqual(0);
      expect(p0.get('ambush')?.earliestTick).toBe(-1);
      expect(p0.get('raid')?.earliestTick).toBe(-1);
      expect(p0.get('siege')?.earliestTick).toBe(-1);

      // Peril 1: raids enabled from year 2 autumn, no ambushes or sieges
      const p1 = initScheduleAtEmbark(registry, 1, [], rng);
      expect(p1.get('raid')?.earliestTick).toBe(168 * TICKS_PER_DAY);
      expect(p1.get('ambush')?.earliestTick).toBe(-1);
      expect(p1.get('siege')?.earliestTick).toBe(-1);

      // Peril 2: ambushes enabled, raids enabled from spring year 2, no sieges
      const p2 = initScheduleAtEmbark(registry, 2, [], rng);
      expect(p2.get('ambush')?.earliestTick).toBeGreaterThanOrEqual(0);
      expect(p2.get('raid')?.earliestTick).toBe(112 * TICKS_PER_DAY);
      expect(p2.get('siege')?.earliestTick).toBe(-1);

      // Peril 3: sieges enabled
      const p3 = initScheduleAtEmbark(registry, 3, [], rng);
      expect(p3.get('siege')?.earliestTick).toBeGreaterThanOrEqual(0);
    });
  });

  describe('no winter raids at peril <= 2 rule', () => {
    it('suppresses raids during winter at peril <= 2 but permits them in other seasons', () => {
      // Peril 1: earliest raid is Autumn year 2 (day 168..195).
      // Winter year 2 is days 196..223.
      // Spring year 3 starts at day 224.
      const winterTick = 200 * TICKS_PER_DAY; // day 200 is Winter (season 3)
      const springTick = 224 * TICKS_PER_DAY; // day 224 is Spring (season 0)

      // Test with ThreatsSystem
      const sys1 = new ThreatsSystem({ spec: { peril: 1, traits: [] } as unknown as LocalMapSpec });
      const emittedEvents: GameEvent[] = [];
      const entities1 = createEntityStore();
      const worldMock = {
        entities: entities1,
        fortress: { wealthCached: 50000, name: 'TestFort' },
        emit: (e: GameEvent) => emittedEvents.push(e),
        map: {
          w: 48,
          h: 48,
          columnSurfaceZ: () => 32,
          index: (x: number, y: number, z: number) => (z * 48 + y) * 48 + x,
          kindAt: () => 1, // TileKind.Floor
        },
        services: {
          spawn: {
            creature: () => entities1.create('creature'),
            item: () => entities1.create('item'),
          },
        },
      } as unknown as World;

      const ctxInit = {
        rng: new RngStream(42),
        registry,
        world: worldMock,
        register: { panel: () => {} },
      } as unknown as InitContext;
      sys1.init(ctxInit);

      // Force raid nextTick to be winterTick
      const sched = (sys1 as unknown as { schedule: Map<string, ThreatScheduleEntry> }).schedule.get('raid');
      expect(sched).toBeDefined();
      if (sched) sched.nextTick = winterTick;

      // Emit DayPassed in winter
      const ctxWinter = {
        tick: winterTick,
        world: worldMock,
        registry,
        readers: { has: () => false },
        emit: (e: GameEvent) => emittedEvents.push(e),
      } as unknown as TickContext;
      sys1.handle({ type: 'DayPassed', dayOfSeason: 4, season: 3, year: 2 }, ctxWinter);

      // No warning should have been emitted because passes are closed in winter
      expect(emittedEvents.filter((e) => e.type === 'ThreatWarning' && (e as { kind?: string }).kind === 'raid')).toHaveLength(0);

      // Advance to Spring: DayPassed in Spring year 3
      const ctxSpring = {
        tick: springTick,
        world: worldMock,
        registry,
        readers: { has: () => false },
        emit: (e: GameEvent) => emittedEvents.push(e),
      } as unknown as TickContext;
      sys1.handle({ type: 'DayPassed', dayOfSeason: 1, season: 0, year: 3 }, ctxSpring);

      // Now warning IS emitted
      expect(emittedEvents.filter((e) => e.type === 'ThreatWarning' && (e as { kind?: string }).kind === 'raid')).toHaveLength(1);
    });

    it('permits winter raids at peril >= 3', () => {
      const winterTick = 200 * TICKS_PER_DAY;
      const sys3 = new ThreatsSystem({ spec: { peril: 3, traits: [] } as unknown as LocalMapSpec });
      const emittedEvents: GameEvent[] = [];
      const entities3 = createEntityStore();
      const worldMock = {
        entities: entities3,
        fortress: { wealthCached: 50000, name: 'TestFort' },
        emit: (e: GameEvent) => emittedEvents.push(e),
        map: {
          w: 48,
          h: 48,
          columnSurfaceZ: () => 32,
          index: (x: number, y: number, z: number) => (z * 48 + y) * 48 + x,
          kindAt: () => 1,
        },
        services: {
          spawn: {
            creature: () => entities3.create('creature'),
            item: () => entities3.create('item'),
          },
        },
      } as unknown as World;

      const ctxInit = {
        rng: new RngStream(42),
        registry,
        world: worldMock,
        register: { panel: () => {} },
      } as unknown as InitContext;
      sys3.init(ctxInit);

      const sched = (sys3 as unknown as { schedule: Map<string, ThreatScheduleEntry> }).schedule.get('raid');
      if (sched) sched.nextTick = winterTick;

      const ctxWinter = {
        tick: winterTick,
        world: worldMock,
        registry,
        readers: { has: () => false },
        emit: (e: GameEvent) => emittedEvents.push(e),
      } as unknown as TickContext;
      sys3.handle({ type: 'DayPassed', dayOfSeason: 4, season: 3, year: 2 }, ctxWinter);

      // At peril 3, raids CAN arrive in winter
      expect(emittedEvents.filter((e) => e.type === 'ThreatWarning' && (e as { kind?: string }).kind === 'raid')).toHaveLength(1);
    });
  });

  describe('serialization roundtrip', () => {
    it('serializes and restores threats state faithfully', () => {
      const sys = new ThreatsSystem({ spec: { peril: 2, traits: [] } as unknown as LocalMapSpec });
      const worldMock = {
        entities: createEntityStore(),
        fortress: { wealthCached: 10000, name: 'TestFort' },
      } as unknown as World;
      const ctxInit = {
        rng: new RngStream(9876),
        registry,
        world: worldMock,
        register: { panel: () => {} },
      } as unknown as InitContext;
      sys.init(ctxInit);

      const serialized = sys.serialize();
      expect(serialized.stateVersion).toBe(1);
      expect(serialized.schedule.length).toBeGreaterThan(0);

      const restored = new ThreatsSystem({ spec: { peril: 2, traits: [] } as unknown as LocalMapSpec });
      restored.init({ ...ctxInit, rng: new RngStream(1) });
      restored.deserialize(serialized, ctxInit);

      const serialized2 = restored.serialize();
      expect(serialized2.renown).toBe(serialized.renown);
      expect(serialized2.schedule).toEqual(serialized.schedule);
    });
  });
});
