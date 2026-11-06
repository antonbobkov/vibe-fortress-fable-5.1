/**
 * T-483: a launcher with ammunition holds its shot while one of the shooter's own faction stands on
 * the projectile's ray before the target, and shoots the nearest other hostile it can reach with a
 * clear line, or waits (16 § Ranged resolution), unless it is careless this time: below
 * `CARELESS_SAFE_SKILL` one draw on the shooter's own stream (16, or 25 for a caster) may send the
 * shot through. The same rule as a caster's bolt (25 § Casting), for every faction's shooters; a
 * natural ranged attack has none.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Equipment } from '@core/components';
import { TileKind } from '@core/map3d';
import { RngStream } from '@core/rng';
import type { EntityId } from '@core/types';
import { carelessPercent, carelessThisTime } from '@systems/combat/clear-shot';
import { CARELESS_SAFE_SKILL, CARELESS_SHOT_PERCENT } from '@systems/combat/constants';
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

/** A marksdwarf (Proficient by default) in a ranged squad of its own, on duty at its tile. */
function marksdwarf(w: TestWorld, x: number, y: number, crossbow = 10): EntityId {
  const id = w.spawnDwarf({ at: w.index(x, y, Z), skills: { crossbow, dodge: 2 } });
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

/**
 * Walls on every side of `x`, `y` but the south: the one open step is toward a target to the south,
 * so a held shooter there has no tile to step aside to (T-498) and waits.
 */
function nook(w: TestWorld, x: number, y: number): void {
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] as const) w.carve(w.index(x + dx, y + dy, Z), TileKind.Wall);
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

  it('a marksdwarf with a fortress creature on the ray, no other target and no step aside waits', () => {
    const w = arena('t483-wait');
    nook(w, 40, 40);
    const shooter = marksdwarf(w, 40, 40);
    const g = caged(w, 40, 50, 0, -1);
    downed(w, 40, 45);
    w.game.world.services.combat?.setTarget(shooter, g);
    const before = w.game.world.rngFor('16').state();
    w.step(120);
    expect(shotsBy(w, shooter)).toEqual([]);
    // At Proficient nothing is drawn for the held shot.
    expect(w.game.world.rngFor('16').state()).toEqual(before);
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

  it('a Proficient hostile archer holds its shot while one of its own party stands on the ray', () => {
    const w = arena('t483-archer');
    const archer = w.spawnCreature('gloam_archer', w.index(40, 40, Z), 'hostile:gloam');
    // Tier 4: bow 10, never careless.
    assignHostileSkills(w.game.world.entities, w.game.registry, archer, 4, false);
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
    const hunter = w.spawnDwarf({ at: w.index(40, 40, Z), skills: { crossbow: 10, hunting: 3 } });
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

describe('T-483 a careless shooter fires through an ally on the line', () => {
  it('the chance falls evenly from CARELESS_SHOT_PERCENT at skill 0 to 0 at CARELESS_SAFE_SKILL', () => {
    expect([CARELESS_SHOT_PERCENT, CARELESS_SAFE_SKILL]).toEqual([50, 10]);
    expect([0, 1, 2, 4, 6, 8, 9, 10, 12, 20].map(carelessPercent)).toEqual([50, 45, 40, 30, 20, 10, 5, 0, 0, 0]);
  });

  it('one draw a weighing: about 40 in 100 at Novice, none drawn at Proficient', () => {
    const rng = new RngStream(483);
    let careless = 0;
    for (let k = 0; k < 10_000; k += 1) {
      const r = carelessThisTime(rng, 2);
      expect(r.drew).toBe(true);
      if (r.careless) careless += 1;
    }
    expect(careless).toBeGreaterThan(3800);
    expect(careless).toBeLessThan(4200);
    const state = rng.state();
    expect(carelessThisTime(rng, 10)).toEqual({ drew: false, careless: false });
    expect(rng.state()).toEqual(state);
  });

  it('a Novice marksdwarf sometimes shoots its held target through the ally, on stream 16, once a cooldown at most', () => {
    const w = arena('t483-careless');
    nook(w, 40, 40);
    const shooter = marksdwarf(w, 40, 40, 2);
    const g = caged(w, 40, 50, 0, -1);
    downed(w, 40, 45);
    w.game.world.services.combat?.setTarget(shooter, g);
    const stream25 = w.game.world.rngFor('25').state();
    const ticks: number[] = [];
    let fired = w.events('ProjectileFired').length;
    for (let t = 0; t < 600; t += 1) {
      w.step(1);
      const now = w.events('ProjectileFired').length;
      if (now > fired) ticks.push(w.game.world.calendar.tick);
      fired = now;
    }
    const shots = shotsBy(w, shooter);
    expect(shots.length).toBeGreaterThan(0);
    expect(new Set(shots)).toEqual(new Set([g]));
    // A careful weighing takes the attack cooldown as a shot does: never two shots closer than it.
    for (let k = 1; k < ticks.length; k += 1) expect(ticks[k]! - ticks[k - 1]!).toBeGreaterThanOrEqual(12);
    // Far fewer shots than ticks: each weighing is one draw, about 40% careless.
    expect(shots.length).toBeLessThan(600 / 12);
    expect(w.game.world.rngFor('25').state()).toEqual(stream25);
  });

  it('a raid archer (tier 1, bow 4) peppers its own front now and then', () => {
    const w = arena('t483-careless-archer');
    const archer = w.spawnCreature('gloam_archer', w.index(40, 40, Z), 'hostile:gloam');
    assignHostileSkills(w.game.world.entities, w.game.registry, archer, 1, false);
    arm(w, archer, ['bow', 'yew'], ['arrow', 'oak']);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        w.carve(w.index(40 + dx, 50 + dy, Z), dx === 0 && dy === -1 ? TileKind.Fortification : TileKind.Wall);
      }
    }
    const dwarf = w.spawnDwarf({ at: w.index(40, 50, Z) });
    downed(w, 40, 45, 'gloam_warrior', 'hostile:gloam');
    w.game.world.services.combat?.setTarget(archer, dwarf);
    w.step(300);
    expect(shotsBy(w, archer).length).toBeGreaterThan(0);
    expect(new Set(shotsBy(w, archer))).toEqual(new Set([dwarf]));
  });

  /** A caster (runecraft `level`) with an iron staff of embers and rune to spare, in a squad of its own. */
  function caster(w: TestWorld, x: number, y: number, level: number): EntityId {
    const id = w.spawnDwarf({ at: w.index(x, y, Z), skills: { runecraft: level } });
    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Staves' });
    const squads = w.readers.of<CombatReader>('16').squads();
    const s = squads[squads.length - 1] as SquadWithId;
    w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members: [id] });
    w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: w.index(x, y, Z) });
    w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
    w.step(1);
    w.game.world.entities.add(id, C.Soldier, { ...w.game.world.entities.get(id, C.Soldier)!, stance: 'hold' });
    w.game.world.entities.add(id, C.Rune, { current: 1_000_000 });
    const staff = w.spawnItem('staff', 'iron', w.index(x, y, Z), 1, 1);
    const item = w.game.world.entities.get(staff, C.Item)!;
    w.game.world.entities.add(staff, C.Item, { ...item, stone: w.game.registry.table('materials').index('garnet') });
    w.game.world.services.items?.attachToCarrier(staff, id);
    w.game.world.services.items?.setOwner(staff, id);
    w.game.world.entities.add(id, C.Equipment, { ...w.game.world.entities.get(id, C.Equipment)!, weapon: staff });
    return id;
  }

  it('a Novice caster singes through its ally, weighing on stream 25; a Proficient one holds and draws nothing', () => {
    for (const [level, careless] of [[2, true], [10, false]] as const) {
      const w = arena(`t483-caster-${level}`);
      nook(w, 30, 30);
      const c = caster(w, 30, 30, level);
      const g = caged(w, 30, 38, 0, -1);
      downed(w, 30, 33);
      w.game.world.services.combat?.setTarget(c, g);
      const stream25 = w.game.world.rngFor('25').state();
      w.step(400);
      const casts = w.events('SpellCast').filter((e) => e['casterId'] === c);
      if (careless) {
        expect(casts.length).toBeGreaterThan(0);
        expect(casts.every((e) => e['targetId'] === g)).toBe(true);
        expect(w.game.world.rngFor('25').state()).not.toEqual(stream25);
      } else {
        expect(casts).toHaveLength(0);
        expect(w.game.world.rngFor('25').state()).toEqual(stream25);
      }
    }
  });

  it('a Novice hunter through fireAt weighs once a cooldown and sometimes shoots past its own dog', () => {
    const w = arena('t483-hunt-careless');
    const hunter = w.spawnDwarf({ at: w.index(40, 40, Z), skills: { crossbow: 2, hunting: 3 } });
    arm(w, hunter, ['crossbow', 'oak'], ['bolt', 'iron']);
    const deer = w.spawnCreature('deer', w.index(40, 48, Z), 'wild');
    w.game.world.entities.add(deer, C.Body, { ...w.game.world.entities.get(deer, C.Body)!, conscious: false });
    downed(w, 40, 44, 'dog', 'fortress');
    const combat = w.game.world.services.combat!;
    let fired = 0;
    for (let t = 0; t < 300; t += 1) {
      if (combat.fireAt(hunter, deer)) fired += 1;
      w.step(1);
    }
    expect(fired).toBeGreaterThan(0);
    expect(fired).toBeLessThan(300 / 12);
  });
});

describe('T-498 a held soldier steps aside to a clear line', () => {
  it('a Proficient marksdwarf with an ally on its ray and no other target steps aside, no nearer, and shoots its held target', () => {
    const w = arena('t498-step');
    const shooter = marksdwarf(w, 40, 40);
    const g = caged(w, 40, 50, 0, -1);
    // Near the shooter, so one step aside clears the line.
    downed(w, 40, 42);
    w.game.world.services.combat?.setTarget(shooter, g);
    const stream16 = w.game.world.rngFor('16').state();
    let firstShot = -1;
    let drawnBefore = false;
    for (let t = 0; t < 200 && firstShot < 0; t += 1) {
      const state = w.game.world.rngFor('16').state();
      w.step(1);
      if (shotsBy(w, shooter).length > 0) {
        firstShot = w.game.world.calendar.tick;
        drawnBefore = JSON.stringify(state) !== JSON.stringify(stream16);
      }
    }
    expect(firstShot).toBeGreaterThan(0);
    // The step draws nothing: stream 16 is untouched until the shot.
    expect(drawnBefore).toBe(false);
    expect(shotsBy(w, shooter)).toEqual([g]);
    const p = w.game.world.entities.get(shooter, C.Position)!;
    expect(p.x === 40 && p.y === 40).toBe(false);
    // It stays on its own side: no nearer its target than where it stood.
    expect(Math.max(Math.abs(p.x - 40), Math.abs(p.y - 50))).toBeGreaterThanOrEqual(10);
    expect(w.readers.of<CombatReader>('16').targetOf(shooter)).toBe(g);
  });

  it('a hostile archer does not step aside: it waits where it stands', () => {
    const w = arena('t498-archer');
    const archer = w.spawnCreature('gloam_archer', w.index(40, 40, Z), 'hostile:gloam');
    assignHostileSkills(w.game.world.entities, w.game.registry, archer, 4, false);
    arm(w, archer, ['bow', 'yew'], ['arrow', 'oak']);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        w.carve(w.index(40 + dx, 50 + dy, Z), dx === 0 && dy === -1 ? TileKind.Fortification : TileKind.Wall);
      }
    }
    const dwarf = w.spawnDwarf({ at: w.index(40, 50, Z) });
    downed(w, 40, 45, 'gloam_warrior', 'hostile:gloam');
    w.game.world.services.combat?.setTarget(archer, dwarf);
    w.step(120);
    expect(shotsBy(w, archer)).toEqual([]);
    const p = w.game.world.entities.get(archer, C.Position)!;
    expect([p.x, p.y]).toEqual([40, 40]);
  });
});