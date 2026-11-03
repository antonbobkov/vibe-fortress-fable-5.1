/**
 * T-483: a launcher with ammunition holds its shot while one of the shooter's own faction stands on
 * the projectile's ray before the target, and shoots the nearest other hostile it can reach with a
 * clear line, or waits (16 § Ranged resolution). The same rule as a caster's bolt (25 § Casting),
 * for every faction's shooters; a natural ranged attack has none.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Equipment } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import { assignHostileSkills } from '@systems/threats/gear';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

/** Hand `id` a launcher and its ammunition, carried and owned. */
function arm(w: TestWorld, id: EntityId, launcher: [string, string], ammo: [string, string]): void {
  const p = w.game.world.entities.get(id, C.Position)!;
  const at = w.index(p.x, p.y, p.z);
  const bow = w.spawnItem(launcher[0], launcher[1], at, 1, 1);
  const shots = w.spawnItem(ammo[0], ammo[1], at, 25, 1);
  for (const item of [bow, shots]) {
    w.game.world.services.items?.attachToCarrier(item, id);
    w.game.world.services.items?.setOwner(item, id);
  }
  const old = w.game.world.entities.get(id, C.Equipment);
  const eq: Equipment = {
    weapon: bow, shield: 0,
    armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
    clothing: old?.clothing ?? { body: 0, legs: 0, feet: 0, over: 0 }, quiver: shots,
  };
  w.game.world.entities.add(id, C.Equipment, eq);
}

/** A Proficient marksdwarf in a ranged squad of its own, on duty at its tile. */
function marksdwarf(w: TestWorld, x: number, y: number): EntityId {
  const id = w.spawnDwarf({ at: w.index(x, y, Z), skills: { crossbow: 10, dodge: 2 } });
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Bolts' });
  const squads = w.readers.of<CombatReader>('16').squads();
  const s = squads[squads.length - 1] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members: [id] });
  w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { weaponClass: 'any', armor: 'any', ranged: true } });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: w.index(x, y, Z) });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
  w.step(1);
  arm(w, id, ['crossbow', 'oak'], ['bolt', 'iron']);
  return id;
}

/**
 * A goblin shut in a stone cell with a fortification on one side (`fx`, `fy` from its tile): it
 * cannot come out, and a shooter sees it through the fortification beside it.
 */
function caged(w: TestWorld, x: number, y: number, fx: number, fy: number): EntityId {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx === 0 && dy === 0) continue;
      w.carve(w.index(x + dx, y + dy, Z), dx === fx && dy === fy ? TileKind.Fortification : TileKind.Wall);
    }
  }
  const g = w.spawnCreature('gloam_warrior', w.index(x, y, Z), 'hostile:gloam');
  assignHostileSkills(w.game.world.entities, w.game.registry, g, 1, false);
  return g;
}

/** A creature lying senseless on `x`, `y`: it stays on the ray. */
function downed(w: TestWorld, x: number, y: number, species?: string, faction?: string): EntityId {
  const id = species === undefined ? w.spawnDwarf({ at: w.index(x, y, Z) }) : w.spawnCreature(species, w.index(x, y, Z), faction as never);
  const body = w.game.world.entities.get(id, C.Body)!;
  w.game.world.entities.add(id, C.Body, { ...body, conscious: false });
  return id;
}

function shotsBy(w: TestWorld, shooter: EntityId): EntityId[] {
  return w.events('ProjectileFired').filter((e) => Number(e['shooterId']) === shooter).map((e) => Number(e['targetId']));
}

describe('T-483 a launcher holds its shot while an ally is on the ray', () => {
  it('a marksdwarf shoots its target when the ray is clear', () => {
    const w = arena('t483-clear');
    const shooter = marksdwarf(w, 40, 40);
    const g = caged(w, 40, 50, 0, -1);
    w.game.world.services.combat?.setTarget(shooter, g);
    w.step(60);
    expect(shotsBy(w, shooter).length).toBeGreaterThan(0);
    expect(new Set(shotsBy(w, shooter))).toEqual(new Set([g]));
  });

  it('a marksdwarf with a fortress creature on the ray and no other target waits', () => {
    const w = arena('t483-wait');
    const shooter = marksdwarf(w, 40, 40);
    const g = caged(w, 40, 50, 0, -1);
    downed(w, 40, 45);
    w.game.world.services.combat?.setTarget(shooter, g);
    w.step(120);
    expect(shotsBy(w, shooter)).toEqual([]);
    expect(w.readers.of<CombatReader>('16').targetOf(shooter)).toBe(g);
  });

  it('a marksdwarf whose ray is blocked by an ally shoots the nearest other hostile with a clear line', () => {
    const w = arena('t483-other');
    const shooter = marksdwarf(w, 40, 40);
    const held = caged(w, 40, 50, 0, -1);
    downed(w, 40, 45);
    // Behind a fortress dog, nearer: not taken. Clear, farther: taken.
    const blocked = caged(w, 46, 40, -1, 0);
    downed(w, 43, 40, 'dog', 'fortress');
    const clear = caged(w, 47, 47, -1, -1);
    w.game.world.services.combat?.setTarget(shooter, held);
    w.step(60);
    const shots = shotsBy(w, shooter);
    expect(shots.length).toBeGreaterThan(0);
    expect(new Set(shots)).toEqual(new Set([clear]));
    expect(shots).not.toContain(blocked);
    expect(w.readers.of<CombatReader>('16').targetOf(shooter)).toBe(held);
  });

  it('a hostile archer holds its shot while one of its own party stands on the ray', () => {
    const w = arena('t483-archer');
    const archer = w.spawnCreature('gloam_archer', w.index(40, 40, Z), 'hostile:gloam');
    assignHostileSkills(w.game.world.entities, w.game.registry, archer, 1, false);
    arm(w, archer, ['bow', 'yew'], ['arrow', 'oak']);
    // The dwarf sits in a cell of its own; a fellow gloam lies on the ray.
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        w.carve(w.index(40 + dx, 50 + dy, Z), dx === 0 && dy === -1 ? TileKind.Fortification : TileKind.Wall);
      }
    }
    const dwarf = w.spawnDwarf({ at: w.index(40, 50, Z) });
    const friend = downed(w, 40, 45, 'gloam_warrior', 'hostile:gloam');
    w.game.world.services.combat?.setTarget(archer, dwarf);
    w.step(80);
    expect(shotsBy(w, archer)).toEqual([]);
    // With the fellow gone the line is clear, and it shoots.
    w.game.world.services.movement?.teleport(friend, w.index(30, 30, Z));
    w.step(40);
    expect(shotsBy(w, archer)).toContain(dwarf);
  });

  it('the fireAt service (a hunt) waits while an ally is on the ray, and shoots when it is clear', () => {
    const w = arena('t483-hunt');
    const hunter = w.spawnDwarf({ at: w.index(40, 40, Z), skills: { crossbow: 6, hunting: 3 } });
    arm(w, hunter, ['crossbow', 'oak'], ['bolt', 'iron']);
    const deer = w.spawnCreature('deer', w.index(40, 48, Z), 'wild');
    const dog = downed(w, 40, 44, 'dog', 'fortress');
    const combat = w.game.world.services.combat!;
    expect(combat.fireAt(hunter, deer)).toBe(false);
    w.game.world.services.movement?.teleport(dog, w.index(30, 30, Z));
    expect(combat.fireAt(hunter, deer)).toBe(true);
  });

  it('a natural ranged attack has no such rule', () => {
    const w = arena('t483-breath');
    const wyrm = w.spawnCreature('magma_wyrm', w.index(40, 40, Z), 'deep');
    const dwarf = w.spawnDwarf({ at: w.index(40, 45, Z) });
    downed(w, 40, 42, 'magma_wyrm', 'deep');
    expect(w.game.world.services.combat?.fireAt(wyrm, dwarf)).toBe(true);
  });
});
