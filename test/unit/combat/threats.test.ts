/**
 * Unit tests for T-M6-04: Combat: threats to civilians, fleeing, animals attacking.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z, HeadlessGame } from '@app/headless';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import type { EntityId, Tick } from '@core/types';
import { AnimalFacts } from '@systems/animals/facts';
import { perceivedThreats } from '@systems/animals/brain';
import { THREAT_THROTTLE_TICKS } from '@systems/combat/constants';
import { threatScan } from '@systems/combat/threats';
import { findFleeTile, select } from '@systems/dwarves/brain';

describe('T-M6-04 threats, fleeing, and animal attack: unit tests', () => {
  it('threatScan emits ThreatNearby throttled per creature across 50 ticks', () => {
    const game = new HeadlessGame({ seed: 'threat-throttle', world: 'flat-test', embark: 'none' });
    const registry = game.registry;
    const atGoblin = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);
    const atDwarf = game.map.index(12, 10, FLAT_TEST_SURFACE_Z);

    const goblin = game.world.services.spawn.creature(registry.table('creatures').index('gloam_warrior'), atGoblin, 'hostile:gloam');
    const dwarf = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), atDwarf, 'fortress');

    const throttles = new Map<EntityId, Tick>();
    const events: GameEvent[] = [];
    const ctx1 = {
      tick: 100,
      world: game.world,
      registry: game.registry,
      readers: game.world.readers,
      emit: (e: GameEvent) => events.push(e),
      jobs: {} as never,
    };

    threatScan(ctx1 as never, throttles);
    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({
      type: 'ThreatNearby',
      id: dwarf,
      hostileId: goblin,
    });

    // Before 50 ticks pass: throttled
    const ctx2 = { ...ctx1, tick: 120 };
    threatScan(ctx2 as never, throttles);
    expect(events.length).toBe(1);

    // After 50 ticks pass: emits again
    const ctx3 = { ...ctx1, tick: 100 + THREAT_THROTTLE_TICKS };
    threatScan(ctx3 as never, throttles);
    expect(events.length).toBe(2);
    expect(events[1]).toMatchObject({
      type: 'ThreatNearby',
      id: dwarf,
      hostileId: goblin,
    });
  });

  it('timid animals flee within perception radius and ignore outside', () => {
    const game = new HeadlessGame({ seed: 'timid-perception', world: 'flat-test', embark: 'none' });
    const registry = game.registry;
    const deerAt = game.map.index(20, 20, FLAT_TEST_SURFACE_Z);
    const deer = game.world.services.spawn.creature(registry.table('creatures').index('deer'), deerAt, 'wild');

    const host = {
      map: game.map,
      entities: game.world.entities,
      facts: new AnimalFacts(registry),
      rng: game.world.rngFor('08'),
      readers: game.world.readers,
      movement: game.world.services.movement,
      isDaylight: () => true,
      setTarget: () => {},
      provokedBy: () => 0,
      grazed: () => {},
      despawn: () => {},
    };

    // Dwarf within perception (e.g. at dist 5, perception is 12)
    const nearDwarfAt = game.map.index(25, 20, FLAT_TEST_SURFACE_Z);
    const nearDwarf = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), nearDwarfAt, 'fortress');
    game.world.entities.add(nearDwarf, C.Brain, {
      behavior: 'idle',
      behaviorUntil: 0,
      targetTile: -1,
      activity: 'idle',
      lastMistTick: 0,
      lastOutdoorThoughtHour: 0,
      daysUnderground: 0,
    });
    expect(perceivedThreats(host as never, deer)).toContain(nearDwarf);

    // Remove near dwarf, spawn dwarf outside perception (e.g. dist 16)
    game.world.entities.destroy(nearDwarf);
    const farDwarfAt = game.map.index(36, 20, FLAT_TEST_SURFACE_Z);
    const farDwarf = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), farDwarfAt, 'fortress');
    game.world.entities.add(farDwarf, C.Brain, {
      behavior: 'idle',
      behaviorUntil: 0,
      targetTile: -1,
      activity: 'idle',
      lastMistTick: 0,
      lastOutdoorThoughtHour: 0,
      daysUnderground: 0,
    });
    expect(perceivedThreats(host as never, deer)).not.toContain(farDwarf);
  });

  it('cornered civilian dwarf fights back when surrounded by walls', () => {
    const game = new HeadlessGame({ seed: 'civilian-cornered', world: 'flat-test', embark: 'none' });
    const registry = game.registry;
    const dwarfPos = { x: 5, y: 5, z: FLAT_TEST_SURFACE_Z };
    const dwarfAt = game.map.index(dwarfPos.x, dwarfPos.y, dwarfPos.z);
    const dwarf = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), dwarfAt, 'fortress');
    game.world.entities.add(dwarf, C.Brain, {
      behavior: 'idle',
      behaviorUntil: 0,
      targetTile: -1,
      activity: 'idle',
      lastMistTick: 0,
      lastOutdoorThoughtHour: 0,
      daysUnderground: 0,
    });

    const goblinPos = { x: 5, y: 6, z: FLAT_TEST_SURFACE_Z };
    const goblinAt = game.map.index(goblinPos.x, goblinPos.y, goblinPos.z);
    const goblin = game.world.services.spawn.creature(registry.table('creatures').index('gloam_warrior'), goblinAt, 'hostile:gloam');

    // Wall off all around dwarf except goblin tile, and behind goblin
    const map = game.map;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (dx === 0 && dy === 1) continue; // Goblin tile
        const t = map.index(dwarfPos.x + dx, dwarfPos.y + dy, dwarfPos.z);
        map.setKind(t, 1, map.materialAt(t)); // Wall (TileKind.Wall = 1)
      }
    }
    const behindGoblin = map.index(5, 7, FLAT_TEST_SURFACE_Z);
    map.setKind(behindGoblin, 1, map.materialAt(behindGoblin));

    const ctx = {
      tick: 1,
      world: game.world,
      registry: game.registry,
      readers: game.world.readers,
      emit: () => {},
      jobs: {} as never,
    };

    // findFleeTile should return -1 because no path increases distance
    const fleeTile = findFleeTile(ctx as never, dwarf, goblin);
    expect(fleeTile).toBe(-1);

    // In select, cornered civilian sets combat target to goblin and activity to Fighting
    let targeted = 0;
    const brainHost = {
      hasJobs: false,
      idleGoal: () => -1,
      jobName: () => '',
      activities: { start: () => false, cancel: () => {}, step: () => false, plans: new Map() },
      dayOff: () => false,
      takeInterrupt: () => false,
      dwarfIds: () => [dwarf],
      idleAnnounced: () => false,
      markIdle: () => {},
      clearIdle: () => {},
      threatOf: () => goblin,
      clearThreat: () => {},
      setCombatTarget: (_id: EntityId, tgt: EntityId) => { targeted = tgt; },
    };

    const brain = game.world.entities.get(dwarf, C.Brain)!;
    select(brainHost as never, ctx as never, dwarf, brain);
    expect(targeted).toBe(goblin);
    expect(brain.activity).toBe('Fighting');
  });

  it('animal flees when blood is below its species flee percent', () => {
    const game = new HeadlessGame({ seed: 'wolf-flee-percent', world: 'flat-test', embark: 'none' });
    const registry = game.registry;
    const combat = game.world.scheduler.byId('16') as unknown as {
      setTarget(id: EntityId, targetId: EntityId): void;
      targetOf(id: EntityId): EntityId;
      tick(ctx: unknown): void;
    };

    const wolfAt = game.map.index(10, 10, FLAT_TEST_SURFACE_Z);
    const dwarfAt = game.map.index(10, 11, FLAT_TEST_SURFACE_Z);
    const wolf = game.world.services.spawn.creature(registry.table('creatures').index('wolf'), wolfAt, 'wild');
    const dwarf = game.world.services.spawn.creature(registry.table('creatures').index('dwarf'), dwarfAt, 'fortress');

    combat.setTarget(wolf, dwarf);
    expect(combat.targetOf(wolf)).toBe(dwarf);

    // Wolf has 45% fleeBloodPercent. Set blood to 40% of maxBlood
    const body = game.world.entities.get(wolf, C.Body)!;
    expect(body.maxBlood).toBeGreaterThan(0);
    game.world.entities.add(wolf, C.Body, {
      ...body,
      blood: Math.floor((body.maxBlood * 40) / 100),
    });

    const events: GameEvent[] = [];
    const ctx = {
      tick: 50,
      world: game.world,
      registry: game.registry,
      readers: game.world.readers,
      emit: (e: GameEvent) => events.push(e),
      jobs: {} as never,
    };

    combat.tick(ctx);

    // Combat target should be cleared, CreatureFled emitted, Wild state set to flee
    expect(combat.targetOf(wolf)).toBe(0);
    const fledEvent = events.find((e) => e.type === 'CreatureFled');
    expect(fledEvent).toMatchObject({
      type: 'CreatureFled',
      id: wolf,
      from: dwarf,
    });

    const wild = game.world.entities.get(wolf, C.Wild);
    expect(wild?.state).toBe('flee');
  });
});
