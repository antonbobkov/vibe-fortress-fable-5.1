/**
 * T-196: a wild animal that attacks a dwarf lets go (08 § Wild behavior), a kill order reaches a
 * target out of perception (16 § Squads), and a light wound stops bleeding by itself (17 § Bleeding).
 */

import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SPEC, FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { C } from '@core/components';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import * as K from '@systems/animals/constants';
import { thinkWild } from '@systems/animals';
import { PERCEPTION_RADIUS, type CombatReader } from '@systems/combat';
import { CLOT_TICKS } from '@systems/health/constants';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;

function newWorld(seed: string): TestWorld {
  return new TestWorld({
    seed,
    registry,
    map: buildFlatTestMap(registry, 64, 64),
    embark: 'none',
    surfaceWildlife: 'none',
    spec: { ...FLAT_TEST_SPEC, traits: [] },
  });
}

function ctxOf(w: TestWorld): TickContext {
  return { tick: w.tick, emit: () => {}, world: w.game.world } as unknown as TickContext;
}

function think(w: TestWorld, id: EntityId): string {
  const wild = w.game.world.entities.get(id, C.Wild);
  if (wild === undefined) throw new Error('not a wild animal');
  const next = thinkWild(w.animals.brain, ctxOf(w), id, wild);
  w.game.world.entities.add(id, C.Wild, next);
  return next.state;
}

function setState(w: TestWorld, id: EntityId, state: string, hungry = false): void {
  const wild = w.game.world.entities.get(id, C.Wild);
  if (wild === undefined) throw new Error('not a wild animal');
  w.game.world.entities.add(id, C.Wild, { ...wild, state, stateUntil: 0, hungry, lastThinkTick: 0 });
}

function targetOf(w: TestWorld, id: EntityId): EntityId {
  return w.readers.of<CombatReader>('16').targetOf(id);
}

describe('T-196 08 an attacking wild animal lets go of its target', () => {
  it('returns to idle when its target dies, and does not take another dwarf in sight', () => {
    const w = newWorld('t196-dies');
    w.game.world.calendar.isDaylight = true;
    const badger = w.spawnCreature('badger', w.index(30, 30, Z), 'wild');
    const first = w.spawnDwarf({ at: w.index(31, 30, Z) });
    // Within perception (12) and outside TERRITORY_RADIUS (5).
    const other = w.spawnDwarf({ at: w.index(30 + K.TERRITORY_RADIUS + 3, 30, Z) });
    w.step(1);
    setState(w, badger, 'idle');
    expect(think(w, badger)).toBe('attack');
    expect(targetOf(w, badger)).toBe(first);
    w.game.world.entities.destroy(first);
    expect(think(w, badger)).not.toBe('attack');
    expect(targetOf(w, badger)).toBe(0);
    expect(targetOf(w, badger)).not.toBe(other);
  });

  it('a hungry hunter stops being hungry when its prey dies', () => {
    const w = newWorld('t196-kill-ends-hunger');
    w.game.world.calendar.isDaylight = true;
    const wolf = w.spawnCreature('wolf', w.index(30, 30, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(31, 30, Z) });
    w.step(1);
    setState(w, wolf, 'idle', true);
    expect(think(w, wolf)).toBe('hunt');
    expect(think(w, wolf)).toBe('attack');
    w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, part: 'head', damageType: 'edge', amount: 999, attackerId: wolf, weaponId: 0 });
    w.step(2);
    expect(w.game.world.entities.alive(dwarf)).toBe(false);
    expect(w.game.world.entities.get(wolf, C.Wild)?.hungry).toBe(false);
  });

  it('a defending animal breaks off when its target is farther than its provoke radius from where the attack began', () => {
    const w = newWorld('t196-break-off');
    w.game.world.calendar.isDaylight = true;
    const badger = w.spawnCreature('badger', w.index(30, 30, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(33, 30, Z) });
    w.step(1);
    setState(w, badger, 'idle');
    expect(think(w, badger)).toBe('attack');
    // The dwarf runs; the badger follows and is beside it, but the dwarf is still inside the territory.
    w.movement.teleport(dwarf, w.index(30 + K.TERRITORY_RADIUS, 30, Z));
    w.movement.teleport(badger, w.index(30 + K.TERRITORY_RADIUS - 1, 30, Z));
    expect(think(w, badger)).toBe('attack');
    expect(targetOf(w, badger)).toBe(dwarf);
    // One more step and the dwarf is out of it: the badger lets go and wanders off.
    w.movement.teleport(dwarf, w.index(30 + K.TERRITORY_RADIUS + 1, 30, Z));
    w.movement.teleport(badger, w.index(30 + K.TERRITORY_RADIUS, 30, Z));
    expect(think(w, badger)).toBe('wander');
    expect(targetOf(w, badger)).toBe(0);
    // A wander ignores the dwarf beside it.
    expect(think(w, badger)).not.toBe('attack');
  });

  it('an aggressive animal that was approached breaks off past APPROACH_RADIUS', () => {
    const w = newWorld('t196-approach');
    w.game.world.calendar.isDaylight = true;
    const wolf = w.spawnCreature('wolf', w.index(30, 30, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(32, 30, Z) });
    w.step(1);
    setState(w, wolf, 'idle');
    expect(think(w, wolf)).toBe('attack');
    w.movement.teleport(dwarf, w.index(30 + K.APPROACH_RADIUS + 1, 30, Z));
    w.movement.teleport(wolf, w.index(30 + K.APPROACH_RADIUS, 30, Z));
    expect(think(w, wolf)).toBe('wander');
    expect(targetOf(w, wolf)).toBe(0);
  });

  it('a defending animal leaves an unconscious target alone', () => {
    const w = newWorld('t196-unconscious');
    w.game.world.calendar.isDaylight = true;
    const boar = w.spawnCreature('boar', w.index(30, 30, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(31, 30, Z) });
    w.step(1);
    setState(w, boar, 'idle');
    expect(think(w, boar)).toBe('attack');
    const body = w.game.world.entities.get(dwarf, C.Body);
    if (body === undefined) throw new Error('no body');
    w.game.world.entities.add(dwarf, C.Body, { ...body, conscious: false });
    expect(think(w, boar)).toBe('wander');
    expect(targetOf(w, boar)).toBe(0);
  });

  it('a hungry hunter keeps its prey wherever it runs within perception', () => {
    const w = newWorld('t196-hunter');
    w.game.world.calendar.isDaylight = true;
    const wolf = w.spawnCreature('wolf', w.index(30, 30, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(31, 30, Z) });
    w.step(1);
    setState(w, wolf, 'idle', true);
    expect(think(w, wolf)).toBe('hunt');
    expect(think(w, wolf)).toBe('attack');
    w.movement.teleport(dwarf, w.index(40, 30, Z));
    w.movement.teleport(wolf, w.index(39, 30, Z));
    expect(think(w, wolf)).toBe('attack');
    expect(targetOf(w, wolf)).toBe(dwarf);
  });
});

describe('T-196 16 a kill order reaches a target out of perception', () => {
  it('the soldiers walk toward a kill target 25 tiles away and take it as their target once in perception', () => {
    const w = newWorld('t196-kill-order');
    const soldier = w.spawnDwarf({ at: w.index(30, 55, Z) });
    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard', leaderId: soldier });
    const squadId = w.readers.of<CombatReader>('16').squads()[0]?.id ?? 0;
    expect(w.game.world.applyCommand({ type: 'SetSquadMode', squadId, mode: 'active' }).ok).toBe(true);
    const deer = w.spawnCreature('deer', w.index(30, 30, Z), 'wild');
    expect(w.game.world.applyCommand({ type: 'SquadOrder', squadId, order: { kind: 'kill', targetId: deer } }).ok).toBe(true);
    const distance = (): number => {
      const a = w.game.world.entities.get(soldier, C.Position);
      const b = w.game.world.entities.get(deer, C.Position);
      return a === undefined || b === undefined ? 0 : Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    };
    expect(distance()).toBeGreaterThan(PERCEPTION_RADIUS);
    const spent = w.until(() => distance() <= PERCEPTION_RADIUS, 600);
    expect(spent).toBeLessThan(600);
    w.step(2);
    expect(targetOf(w, soldier)).toBe(deer);
  });
});

describe('T-196 17 a light wound stops bleeding by itself', () => {
  it('a light cut stops bleeding after CLOT_TICKS; a serious one bleeds on', () => {
    const w = newWorld('t196-clot');
    const light = w.spawnDwarf({ at: w.index(20, 20, Z) });
    const serious = w.spawnDwarf({ at: w.index(24, 20, Z) });
    w.step(1);
    w.game.world.emit({ type: 'DamageDealt', defenderId: light, part: 'left_leg', damageType: 'edge', amount: 5, attackerId: 0, weaponId: 0 });
    w.game.world.emit({ type: 'DamageDealt', defenderId: serious, part: 'torso', damageType: 'edge', amount: 15, attackerId: 0, weaponId: 0 });
    w.step(1);
    const woundsOf = (id: EntityId) => w.game.world.entities.get(id, C.Body)?.parts.flatMap((p) => p.wounds) ?? [];
    expect(woundsOf(light).map((x) => [x.severity, x.bleed])).toEqual([['light', 1]]);
    expect(woundsOf(serious).map((x) => [x.severity, x.bleed])).toEqual([['serious', 3]]);
    w.step(CLOT_TICKS + 10);
    expect(woundsOf(light).map((x) => [x.severity, x.bleed])).toEqual([['light', 0]]);
    expect(woundsOf(serious).map((x) => [x.severity, x.bleed])).toEqual([['serious', 3]]);
    // No longer bleeding, the dwarf is no longer a patient for bleeding and its blood comes back.
    const blood = w.game.world.entities.get(light, C.Body)?.blood ?? 0;
    w.step(100);
    expect(w.game.world.entities.get(light, C.Body)?.blood ?? 0).toBeGreaterThan(blood);
    expect(w.game.world.entities.get(light, C.Patient)?.needs ?? []).not.toContain('stop_bleeding');
  });

  it('an untreated light cut is not fatal', () => {
    const w = newWorld('t196-light-not-fatal');
    const dwarf = w.spawnDwarf({ at: w.index(20, 20, Z) });
    w.step(1);
    w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, part: 'left_arm', damageType: 'edge', amount: 5, attackerId: 0, weaponId: 0 });
    w.step(3000);
    expect(w.game.world.entities.alive(dwarf)).toBe(true);
  });
});

describe('T-196 17 one stop_bleeding bandages every bleeding wound', () => {
  it('a medic with one cloth stops two serious cuts with one job', () => {
    const w = new TestWorld({ seed: 't196-bandage-all', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const medic = w.spawnDwarf({ at: w.index(10, 10, Z), skills: { medicine: 20 } });
    w.setLabor(medic, 'medicine', true);
    const patient = w.spawnDwarf({ at: w.index(12, 10, Z) });
    for (const id of [medic, patient]) for (const labor of ['hauling', 'mining', 'woodcutting']) w.setLabor(id, labor, false);
    w.spawnItem('cloth', 'flax_cloth', w.index(10, 11, Z), 3);
    for (const part of ['torso', 'left_leg']) w.game.world.emit({ type: 'DamageDealt',
      defenderId: patient, attackerId: 0, part, damageType: 'edge', amount: 15 });
    w.step(2);
    const bleeding = (): number => (w.game.world.entities.get(patient, C.Body)?.parts.flatMap((p) => p.wounds) ?? [])
      .filter((x) => x.bleed > 0 && !x.bandaged).length;
    expect(bleeding()).toBe(2);
    w.until((v) => v.events('TreatmentDone').some((e) => e['patientId'] === patient && e['kind'] === 'stop_bleeding'), 900);
    expect(w.events('TreatmentDone').filter((e) => e['kind'] === 'stop_bleeding')).toHaveLength(1);
    expect(bleeding()).toBe(0);
  });
});
