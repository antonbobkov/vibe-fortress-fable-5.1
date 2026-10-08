import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import { Registrations, type TickContext } from '@core/system';
import { roundTrip } from '@app/game-save';
import type { CombatReader } from '@systems/combat/reader';
import type { CombatSystem } from '@systems/combat';
import type { DwarvesSystem } from '@systems/dwarves';
import { findFleeTile, tickDwarf, type BrainHost } from '@systems/dwarves/brain';
import { CIVILIAN_COMBAT_TIMEOUT_TICKS } from '@systems/dwarves/constants';
import { TestWorld } from '../scenarios/test-world';
import { runScenario } from '../scenarios/runner';
import stairFlee from '../scenarios/dw_stair_flee.scenario';

function cornered(seed: string): { w: TestWorld; id: number; enemy: number } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none' });
  const at = w.index(48, 48, 30);
  const there = w.index(50, 48, 30);
  w.carve(at, TileKind.Floor);
  w.carve(there, TileKind.Floor);
  const id = w.spawnDwarf({ at });
  const enemy = w.spawnCreature('gloam_warrior', there, 'hostile:gloam');
  w.step(2);
  expect(w.game.world.entities.get(id, C.Brain)?.activity).toBe('Fighting');
  return { w, id, enemy };
}
function context(w: TestWorld, tick = w.tick): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers,
    tick, emit: (event) => w.game.world.emit(event), jobs: w.game.world.services.jobs,
    terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
    rng: w.game.world.rngFor('10'), register: new Registrations() };
}

describe('T-122 civilian escape and combat interruption', () => {
  it('takes stairs toward the hearth hall and satisfies thirst through the real loop', () => {
    runScenario(stairFlee);
  });

  it('finds a legal vertical escape when there is no hearth, respecting a locked hatch', () => {
    const { w, id, enemy } = cornered('flee-no-hall');
    w.carve(w.index(48, 48, 30), TileKind.StairsUpDown);
    w.carve(w.index(48, 48, 31), TileKind.StairsUpDown);
    w.step(1);
    expect(findFleeTile(context(w), id, enemy)).toBe(w.index(48, 48, 31));
    const hatch = w.build('hatch', w.index(48, 48, 31), 'oak');
    expect(w.game.world.applyCommand({ type: 'SetHatchMode', buildingId: hatch, mode: 'locked' })).toEqual({ ok: true });
    expect(findFleeTile(context(w), id, enemy)).toBe(-1);
  });

  it('finishes critical eating while repeated threat scans cannot restart the activity', () => {
    const { w, id } = cornered('cornered-eat');
    w.spawnItem('easy_meal', 'dimcap', w.movement.tileOf(id), 1);
    w.setNeed(id, 'hunger', 90);
    w.step(1);
    expect(w.game.world.entities.get(id, C.Brain)?.behavior).toBe('need');
    expect(w.readers.of<CombatReader>('16').targetOf(id)).toBe(0);
    w.until(() => w.events('MealEaten').some((e) => e['id'] === id), 100);
    expect(w.game.world.entities.get(id, C.Needs)?.hunger).toBeLessThan(50);
    expect(w.events('ThreatNearby').filter((e) => e['id'] === id).length).toBeGreaterThanOrEqual(2);
  });

  it('passes out at critical rest instead of remaining in a cornered fight', () => {
    const { w, id } = cornered('cornered-sleep');
    w.setNeed(id, 'rest', 100);
    w.step(2);
    expect(w.game.world.entities.get(id, C.Brain)).toMatchObject({ behavior: 'need', activity: 'sleep' });
    expect(w.readers.of<CombatReader>('16').targetOf(id)).toBe(0);
    expect((w.game.world.scheduler.byId('10') as DwarvesSystem).activities.plans.get(id)?.phase).toBe('use');
  });

  it('leaves a fight after its saved deadline despite repeated out-of-reach threats', () => {
    const { w, id } = cornered('cornered-timeout');
    const until = w.game.world.entities.get(id, C.Brain)!.behaviorUntil;
    expect(until - (w.tick - 1)).toBe(CIVILIAN_COMBAT_TIMEOUT_TICKS);
    w.step(20);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    w.step(until - w.tick + 1);
    loaded.step(until - loaded.tick + 1);
    expect(loaded.hash()).toBe(w.hash());
    expect(w.game.world.entities.get(id, C.Brain)?.activity).toBe('No job');
    expect(w.readers.of<CombatReader>('16').targetOf(id)).toBe(0);
    expect(w.events('ThreatNearby').filter((e) => e['id'] === id).length).toBeGreaterThanOrEqual(4);
  });

  it('refreshes a cornered deadline from a recorded ranged attack opportunity', () => {
    const { w, id, enemy } = cornered('cornered-ranged-deadline');
    const combat = w.game.world.scheduler.byId('16') as CombatSystem;
    const tick = w.game.world.entities.get(id, C.Brain)!.behaviorUntil;
    combat.deserialize({ ...combat.serialize(), engagements: [[id, tick - 1]] });
    const dwarfSystem = w.game.world.scheduler.byId('10') as DwarvesSystem;
    const host = {
      hasJobs: false, idleGoal: () => -1, jobName: () => '', activities: dwarfSystem.activities,
      dayOff: () => false, takeInterrupt: () => false, dwarfIds: () => [id],
      idleAnnounced: () => false, markIdle: () => {}, clearIdle: () => {},
      threatOf: () => enemy, clearThreat: () => {}, setCombatTarget: () => {},
    } satisfies BrainHost;
    tickDwarf(host, context(w, tick), id);
    expect(w.game.world.entities.get(id, C.Brain)).toMatchObject({ activity: 'Fighting', behaviorUntil: tick - 1 + CIVILIAN_COMBAT_TIMEOUT_TICKS });
  });

  it('keeps fighting an enemy in melee reach and refreshes the deadline', () => {
    const { w, id, enemy } = cornered('cornered-melee');
    const at = w.index(49, 48, 30);
    w.carve(at, TileKind.Floor);
    w.movement.teleport(enemy, at);
    const dwarfSystem = w.game.world.scheduler.byId('10') as DwarvesSystem;
    const host = {
      hasJobs: false, idleGoal: () => -1, jobName: () => '', activities: dwarfSystem.activities,
      dayOff: () => false, takeInterrupt: () => false, dwarfIds: () => [id],
      idleAnnounced: () => false, markIdle: () => {}, clearIdle: () => {},
      threatOf: () => enemy, clearThreat: () => {}, setCombatTarget: () => {},
    } satisfies BrainHost;
    // Isolate the brain's deadline decision; the combat system would injure both actors.
    const tick = w.game.world.entities.get(id, C.Brain)!.behaviorUntil;
    tickDwarf(host, context(w, tick), id);
    expect(w.game.world.entities.get(id, C.Brain)).toMatchObject({ activity: 'Fighting', behaviorUntil: tick + CIVILIAN_COMBAT_TIMEOUT_TICKS });
  });
});
