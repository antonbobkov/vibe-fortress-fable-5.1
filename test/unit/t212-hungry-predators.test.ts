/**
 * T-212: a hungry predator prefers animal prey and its pack shares one quarry (08 § Wild
 * behavior); a civilian caught as it flees fights back with what it carries (10 § Behavior
 * selection).
 */

import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SPEC, FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { C } from '@core/components';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import { thinkWild, type AnimalsReader } from '@systems/animals';
import { findFleeTile } from '@systems/dwarves/brain';
import type { CombatReader } from '@systems/combat';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;

function newWorld(seed: string, size = 64): TestWorld {
  return new TestWorld({
    seed,
    registry,
    map: buildFlatTestMap(registry, size, size),
    embark: 'none',
    surfaceWildlife: 'none',
    spec: { ...FLAT_TEST_SPEC, traits: [] },
  });
}

function ctxOf(w: TestWorld): TickContext {
  return { tick: w.tick, emit: () => {}, world: w.game.world } as unknown as TickContext;
}

/** One think of the wild brain, as `tickAnimal` runs it. */
function think(w: TestWorld, id: EntityId): string {
  const wild = w.game.world.entities.get(id, C.Wild);
  if (wild === undefined) throw new Error('not a wild animal');
  w.game.world.entities.add(id, C.Wild, thinkWild(w.animals.brain, ctxOf(w), id, wild));
  return w.readers.of<AnimalsReader>('08').state(id);
}

/** Setup: the predator is hungry and idle, as the daily hunger roll leaves it. */
function hungry(w: TestWorld, id: EntityId): void {
  const wild = w.game.world.entities.get(id, C.Wild);
  if (wild === undefined) throw new Error('not a wild animal');
  w.game.world.entities.add(id, C.Wild, { ...wild, state: 'idle', stateUntil: 0, hungry: true, lastThinkTick: 0 });
}

function targetOf(w: TestWorld, id: EntityId): EntityId {
  return w.readers.of<CombatReader>('16').targetOf(id);
}

describe('T-212 08 a hungry predator prefers animal prey', () => {
  it('a hungry wolf with a dog and a dwarf in perception takes the dog, though the dwarf is nearer', () => {
    const w = newWorld('t212-dog');
    w.game.world.calendar.isDaylight = true;
    const wolf = w.spawnCreature('wolf', w.index(30, 30, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(33, 30, Z) });
    const dog = w.spawnTame('dog', w.index(30, 38, Z));
    w.step(1);
    hungry(w, wolf);
    expect(think(w, wolf)).toBe('hunt');
    expect(targetOf(w, wolf)).toBe(dog);
    expect(targetOf(w, wolf)).not.toBe(dwarf);
  });

  it('wild prey counts too, and the nearest animal prey is the quarry', () => {
    const w = newWorld('t212-rabbit');
    w.game.world.calendar.isDaylight = true;
    const wolf = w.spawnCreature('wolf', w.index(30, 30, Z), 'wild');
    w.spawnDwarf({ at: w.index(32, 30, Z) });
    const far = w.spawnCreature('rabbit', w.index(30, 40, Z), 'wild');
    const near = w.spawnCreature('rabbit', w.index(36, 30, Z), 'wild');
    w.step(1);
    hungry(w, wolf);
    expect(think(w, wolf)).toBe('hunt');
    expect(targetOf(w, wolf)).toBe(near);
    expect(targetOf(w, wolf)).not.toBe(far);
  });

  it('a dwarf is the quarry only when no animal prey is in perception', () => {
    const w = newWorld('t212-dwarf-last');
    w.game.world.calendar.isDaylight = true;
    const wolf = w.spawnCreature('wolf', w.index(30, 30, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(35, 30, Z) });
    // A dog well outside the wolf's perception (12) is not in the choice.
    w.spawnTame('dog', w.index(30, 50, Z));
    w.step(1);
    hungry(w, wolf);
    expect(think(w, wolf)).toBe('hunt');
    expect(targetOf(w, wolf)).toBe(dwarf);
  });
});

describe('T-212 08 a pack shares one quarry', () => {
  it('pack members take the quarry a packmate hunts; one that does not perceive it does not hunt', () => {
    const w = newWorld('t212-pack', 96);
    w.game.world.calendar.isDaylight = true;
    // Spawned in the same tick: one pack.
    const a = w.spawnCreature('wolf', w.index(30, 30, Z), 'wild');
    const b = w.spawnCreature('wolf', w.index(34, 30, Z), 'wild');
    const c = w.spawnCreature('wolf', w.index(70, 30, Z), 'wild');
    const dog = w.spawnTame('dog', w.index(28, 30, Z));
    // Nearer to b than the dog, and the only prey c perceives.
    const cat = w.spawnTame('cat', w.index(38, 30, Z));
    const rabbit = w.spawnCreature('rabbit', w.index(74, 30, Z), 'wild');
    w.step(1);
    for (const id of [a, b, c]) hungry(w, id);
    expect(think(w, a)).toBe('hunt');
    expect(targetOf(w, a)).toBe(dog);
    expect(think(w, b)).toBe('hunt');
    expect(targetOf(w, b)).toBe(dog);
    expect(targetOf(w, b)).not.toBe(cat);
    expect(think(w, c)).not.toBe('hunt');
    expect(targetOf(w, c)).not.toBe(rabbit);
  });

  it('the kill feeds the pack: no member hunts again after a packmate kills the quarry', () => {
    const w = newWorld('t212-pack-kill');
    w.game.world.calendar.isDaylight = true;
    const a = w.spawnCreature('wolf', w.index(30, 30, Z), 'wild');
    const b = w.spawnCreature('wolf', w.index(33, 30, Z), 'wild');
    const dog = w.spawnTame('dog', w.index(29, 30, Z));
    w.step(1);
    for (const id of [a, b]) hungry(w, id);
    expect(think(w, a)).toBe('hunt');
    expect(think(w, b)).toBe('hunt');
    expect(targetOf(w, b)).toBe(dog);
    w.game.world.emit({ type: 'DamageDealt', defenderId: dog, part: 'head', damageType: 'edge', amount: 999, attackerId: a, weaponId: 0 });
    w.step(2);
    expect(w.events('CreatureDied').some((e) => e['id'] === dog && e['killerId'] === a)).toBe(true);
    // A cat in sight of both after the kill: neither is hungry any more, so neither touches it.
    const cat = w.spawnTame('cat', w.index(31, 32, Z));
    w.step(300);
    expect(w.events('AttackResolved').filter((e) => e['defenderId'] === cat)).toEqual([]);
    expect(w.game.world.entities.alive(cat)).toBe(true);
  });
});

interface HaulRun {
  readonly dwarf: EntityId;
  readonly wolf: EntityId;
  readonly pick: EntityId;
  readonly w: TestWorld;
}

/**
 * A civilian who hauls stone past a hungry wolf on open ground (no door anywhere). With `pick`, the
 * hauler first digs one channel tile and so holds a pick, as a miner who also hauls does.
 */
function haulPastWolf(seed: string, pick: boolean, ticks: number): HaulRun {
  const w = newWorld(seed);
  const dwarf = w.spawnDwarf({ at: w.index(12, 30, Z) });
  let pickId = 0;
  if (pick) {
    pickId = w.spawnItem('pick', 'iron', w.index(13, 30, Z));
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'channel', tiles: [w.index(12, 33, Z)], priority: 1 })).toEqual({ ok: true });
    w.until((v) => v.events('ToolEquipped').some((e) => e['dwarfId'] === dwarf && e['itemId'] === pickId), 600);
    expect(w.events('ToolEquipped').some((e) => e['dwarfId'] === dwarf && e['itemId'] === pickId)).toBe(true);
  }
  for (let k = 0; k < 10; k += 1) w.spawnItem('raw_stone', 'granite', w.index(10 + (k % 5), 26 + Math.floor(k / 5), Z));
  const tiles: number[] = [];
  for (let y = 26; y < 30; y += 1) for (let x = 44; x < 48; x += 1) tiles.push(w.index(x, y, Z));
  const pile = w.zone('stockpile', tiles);
  w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: pile, filter: 'stone' });
  const wolf = w.spawnCreature('wolf', w.index(28, 27, Z), 'wild');
  w.step(1);
  hungry(w, wolf);
  w.step(ticks);
  return { dwarf, wolf, pick: pickId, w };
}

const SEEDS = ['t212-a', 't212-b', 't212-c', 't212-d', 't212-e', 't212-f', 't212-g', 't212-h'];

describe('T-212 10 a civilian caught as it flees fights back', () => {
  it('a hauler with a pick, caught by a hungry wolf, wounds it with the pick', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const { w, dwarf, wolf, pick } = haulPastWolf(seed, true, 1500);
      const bitten = w.events('AttackResolved').some((e) => e['attackerId'] === wolf && e['defenderId'] === dwarf && e['outcome'] === 'hit');
      expect(bitten, `${seed}: the wolf caught the hauler`).toBe(true);
      const wounds = w.events('DamageDealt').filter((e) => e['attackerId'] === dwarf && e['defenderId'] === wolf && e['weaponId'] === pick);
      expect(wounds.length, `${seed}: the hauler struck the wolf with the pick`).toBeGreaterThan(0);
      expect(wounds.some((e) => Number(e['amount']) > 0), `${seed}: the pick wounded the wolf`).toBe(true);
    }
  });

  it('a hauler with nothing fights with its fists and still dies sometimes', () => {
    let deaths = 0;
    let punches = 0;
    for (const seed of SEEDS) {
      const { w, dwarf, wolf } = haulPastWolf(seed, false, 2500);
      punches += w.events('AttackResolved').filter((e) => e['attackerId'] === dwarf && e['defenderId'] === wolf).length;
      if (w.events('CreatureDied').some((e) => e['id'] === dwarf)) deaths += 1;
    }
    expect(punches, 'the caught hauler strikes back').toBeGreaterThan(0);
    expect(deaths, 'an unarmed hauler caught by a hungry wolf still dies sometimes').toBeGreaterThan(0);
  });

  it('a caught civilian does not chase: it never walks toward its attacker', () => {
    const { w, dwarf, wolf } = haulPastWolf('t212-chase', true, 0);
    let fought = false;
    let chased = 0;
    let before = -1;
    for (let t = 0; t < 1500 && w.game.world.entities.alive(dwarf) && w.game.world.entities.alive(wolf); t += 1) {
      const fighting = w.game.world.entities.get(dwarf, C.Brain)?.activity === 'Fighting';
      const d = (): number => {
        const a = w.game.world.entities.get(dwarf, C.Position);
        const b = w.game.world.entities.get(wolf, C.Position);
        return a === undefined || b === undefined ? 0 : Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      };
      const at = w.game.world.entities.get(dwarf, C.Position);
      const from = at === undefined ? -1 : w.index(at.x, at.y, at.z);
      if (fighting) before = d();
      w.step(1);
      const now = w.game.world.entities.get(dwarf, C.Position);
      const moved = now !== undefined && w.index(now.x, now.y, now.z) !== from;
      if (fighting) {
        fought = true;
        if (moved && before > 1 && d() < before) chased += 1;
      }
    }
    expect(fought, 'the hauler was caught and fought').toBe(true);
    expect(chased, 'a fighting civilian never stepped toward the wolf').toBe(0);
  });
});

function walledRoom(w: TestWorld, door: boolean): void {
  // A walled room east of x = 20 with one opening on its west side, at (20, 30): a door or a gap.
  for (let y = 26; y <= 34; y += 1) for (let x = 20; x <= 28; x += 1) {
    if (x !== 20 && x !== 28 && y !== 26 && y !== 34) continue;
    if (x === 20 && y === 30) continue;
    w.build('wall', w.index(x, y, Z));
  }
  if (door) w.build('door', w.index(20, 30, Z));
}

function escapeOf(w: TestWorld, dwarf: EntityId, wolf: EntityId): number {
  const ctx = { tick: w.tick, emit: () => {}, world: w.game.world, readers: w.readers, registry: w.game.registry } as unknown as TickContext;
  return findFleeTile(ctx, dwarf, wolf, true);
}

describe('T-212 10 a caught civilian runs only by a route its attacker cannot follow', () => {
  it('the escape is the first tile behind a door the wolf cannot pass', () => {
    const w = newWorld('t212-door');
    walledRoom(w, true);
    const dwarf = w.spawnDwarf({ at: w.index(19, 30, Z) });
    const wolf = w.spawnCreature('wolf', w.index(18, 30, Z), 'wild');
    w.step(1);
    const tile = escapeOf(w, dwarf, wolf);
    expect(tile).toBeGreaterThanOrEqual(0);
    expect(w.map.xOf(tile)).toBeGreaterThan(20);
    expect(w.map.xOf(tile)).toBeLessThan(28);
  });

  it('there is no escape through an open gap, which the wolf can follow', () => {
    const w = newWorld('t212-gap');
    walledRoom(w, false);
    const dwarf = w.spawnDwarf({ at: w.index(19, 30, Z) });
    const wolf = w.spawnCreature('wolf', w.index(18, 30, Z), 'wild');
    w.step(1);
    expect(escapeOf(w, dwarf, wolf)).toBe(-1);
  });
});
