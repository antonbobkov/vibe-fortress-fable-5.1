/**
 * T-540: noise and closeness may wake a sleeping wild animal (08 § Wild behavior, `sleep`). A hit
 * always wakes it; a miss on it wakes it often but not always; a dwarf in metal armour close by
 * wakes it more often than one in leather; a sleeper far from any noise draws nothing; a heavy
 * sleeper wakes from noise far less often, and at once from a hit.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C, type Wild } from '@core/components';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import {
  HEAVY_SLEEPER_NOISE_DIVISOR,
  NOISE_LISTEN_TICKS,
  NOISE_MISS_PERMILLE,
  NOISE_RADIUS,
  isHeavySleeperId,
  noiseWakeChance,
  thinkWild,
} from '@systems/animals';
import { TestWorld } from '../../scenarios/test-world';

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function ctxOf(w: TestWorld, tick = w.tick): TickContext {
  return { tick, world: w.game.world, emit: (_e: GameEvent) => undefined } as unknown as TickContext;
}

/** Puts the animal to sleep afresh (a heavy sleeper or not), clearing any target. */
function sleep(w: TestWorld, id: EntityId, heavy = false, from = w.tick): void {
  const e = w.game.world.entities;
  const { defendFrom: _d, unseenSince: _u, heavySleeper: _h, ...rest } = e.get(id, C.Wild)!;
  const next: Wild = { ...rest, state: 'sleep', stateUntil: from + 600 };
  if (heavy) next.heavySleeper = true;
  e.add(id, C.Wild, next);
  w.animals.brain.setTarget(id, 0);
}

function strike(w: TestWorld, attacker: EntityId, target: EntityId, outcome = 'hit'): void {
  const event = { type: 'AttackResolved', attackerId: attacker, defenderId: target, targetId: target, part: null, damageType: 'pierce', amount: outcome === 'hit' ? 3 : 0, outcome } as unknown as GameEvent;
  w.animals.handle(event, ctxOf(w));
}

function asleep(w: TestWorld, id: EntityId): boolean {
  return w.game.world.entities.get(id, C.Wild)!.state === 'sleep';
}

/** How many of `n` misses on a fresh sleeper woke it. */
function wakesFromMisses(w: TestWorld, boar: EntityId, dwarf: EntityId, n: number, heavy: boolean): number {
  let woke = 0;
  for (let i = 0; i < n; i += 1) {
    sleep(w, boar, heavy);
    strike(w, dwarf, boar, i % 3 === 0 ? 'miss' : i % 3 === 1 ? 'parried' : 'blocked');
    if (!asleep(w, boar)) woke += 1;
  }
  return woke;
}

/** A dwarf two tiles from a sleeping elk, wearing one armour piece of `material`. */
function dwarfBeside(w: TestWorld, material: 'iron' | 'leather'): EntityId {
  const at = w.index(34, 32, Z);
  const dwarf = w.spawnDwarf({ at });
  const piece = w.spawnItem(material === 'iron' ? 'mail_shirt' : 'leather_jerkin', material, at);
  const e = w.game.world.entities;
  const equip = e.get(dwarf, C.Equipment);
  e.add(dwarf, C.Equipment, {
    weapon: 0, shield: 0, quiver: 0,
    clothing: equip?.clothing ?? { body: 0, legs: 0, feet: 0, over: 0 },
    armor: { head: 0, body: piece, arms: 0, legs: 0, feet: 0 },
  });
  return dwarf;
}

/** How many of `n` listens by a fresh sleeper woke it. */
function wakesFromListens(w: TestWorld, elk: EntityId, n: number): number {
  let woke = 0;
  const base = w.tick + NOISE_LISTEN_TICKS - ((w.tick + elk) % NOISE_LISTEN_TICKS);
  for (let i = 0; i < n; i += 1) {
    const tick = base + i * NOISE_LISTEN_TICKS;
    sleep(w, elk, false, tick);
    const next = thinkWild(w.animals.brain, ctxOf(w, tick), elk, w.game.world.entities.get(elk, C.Wild)!);
    if (next.state !== 'sleep') woke += 1;
  }
  return woke;
}

describe('T-540 noise and closeness may wake a sleeper', () => {
  it('the wake chance falls with distance, is 0 beyond the radius, and a tenth for a heavy sleeper', () => {
    expect(noiseWakeChance(NOISE_MISS_PERMILLE, 0, false)).toBe(NOISE_MISS_PERMILLE);
    expect(noiseWakeChance(200, 1, false)).toBe(200);
    expect(noiseWakeChance(200, 2, false)).toBe(150);
    expect(noiseWakeChance(200, NOISE_RADIUS, false)).toBe(50);
    expect(noiseWakeChance(200, NOISE_RADIUS + 1, false)).toBe(0);
    expect(noiseWakeChance(200, 1, true)).toBe(200 / HEAVY_SLEEPER_NOISE_DIVISOR);
  });

  it('a hit always wakes a sleeper, a heavy one too', () => {
    const w = world('t540-hit');
    const boar = w.spawnCreature('boar', w.index(32, 32, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(33, 32, Z) });
    for (const heavy of [false, true]) {
      for (let i = 0; i < 30; i += 1) {
        sleep(w, boar, heavy);
        strike(w, dwarf, boar);
        expect(w.game.world.entities.get(boar, C.Wild)!.state).toBe('attack');
      }
    }
  });

  it('a miss, parry or block on a sleeper wakes it often but not always; a heavy sleeper seldom', () => {
    const w = world('t540-miss');
    const boar = w.spawnCreature('boar', w.index(32, 32, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(33, 32, Z) });
    const light = wakesFromMisses(w, boar, dwarf, 300, false);
    expect(light).toBeGreaterThan(300 * 0.45);
    expect(light).toBeLessThan(300 * 0.75);
    const heavy = wakesFromMisses(w, boar, dwarf, 300, true);
    expect(heavy).toBeGreaterThan(0);
    expect(heavy).toBeLessThan(300 * 0.15);
    // Woken by the miss, a territorial boar defends against the one who swung, as when struck.
    sleep(w, boar);
    for (let i = 0; i < 50 && asleep(w, boar); i += 1) strike(w, dwarf, boar, 'miss');
    expect(w.game.world.entities.get(boar, C.Wild)!.state).toBe('attack');
    expect(w.animals.brain.targetOf!(boar)).toBe(dwarf);
  });

  it('a dwarf in metal armour close by wakes a sleeper more often than one in leather', () => {
    const metal = world('t540-metal');
    const elkM = metal.spawnCreature('elk', metal.index(32, 32, Z), 'wild');
    dwarfBeside(metal, 'iron');
    const leather = world('t540-leather');
    const elkL = leather.spawnCreature('elk', leather.index(32, 32, Z), 'wild');
    dwarfBeside(leather, 'leather');
    const loud = wakesFromListens(metal, elkM, 400);
    const quiet = wakesFromListens(leather, elkL, 400);
    expect(quiet).toBeGreaterThan(0);
    expect(loud).toBeGreaterThan(quiet * 2);
  });

  it('a sleeper far from any noise never rolls', () => {
    const w = world('t540-far');
    const elk = w.spawnCreature('elk', w.index(32, 32, Z), 'wild');
    // Within NEAR_DWARF_RADIUS, so it thinks every tick, but beyond NOISE_RADIUS.
    const dwarf = w.spawnDwarf({ at: w.index(32 + NOISE_RADIUS + 2, 32, Z) });
    const other = w.spawnDwarf({ at: w.index(32 + NOISE_RADIUS + 3, 32, Z) });
    sleep(w, elk);
    const rng = w.animals.brain.rng;
    const before = rng.state();
    for (let t = 0; t < 3 * NOISE_LISTEN_TICKS; t += 1) {
      const next = thinkWild(w.animals.brain, ctxOf(w, w.tick + t), elk, w.game.world.entities.get(elk, C.Wild)!);
      expect(next.state).toBe('sleep');
    }
    // A fight between the two dwarves, beyond the radius.
    for (const outcome of ['hit', 'miss', 'blocked']) strike(w, dwarf, other, outcome);
    expect(asleep(w, elk)).toBe(true);
    expect(rng.state()).toEqual(before);
  });

  it('a fight close by wakes a sleeper on a roll, a heavy sleeper less often', () => {
    const w = world('t540-fight');
    const elk = w.spawnCreature('elk', w.index(32, 32, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(34, 30, Z) });
    const other = w.spawnDwarf({ at: w.index(34, 31, Z) });
    const count = (heavy: boolean): number => {
      let woke = 0;
      for (let i = 0; i < 300; i += 1) {
        sleep(w, elk, heavy);
        strike(w, dwarf, other, 'miss');
        if (!asleep(w, elk)) woke += 1;
      }
      return woke;
    };
    const light = count(false);
    const heavy = count(true);
    expect(light).toBeGreaterThan(300 * 0.08);
    expect(heavy).toBeLessThan(light / 3);
  });

  it('about one wild animal in five is a heavy sleeper, chosen by id', () => {
    let heavy = 0;
    for (let id = 1; id <= 5000; id += 1) if (isHeavySleeperId(id)) heavy += 1;
    expect(heavy).toBeGreaterThan(5000 * 0.15);
    expect(heavy).toBeLessThan(5000 * 0.25);
    expect(isHeavySleeperId(1234)).toBe(isHeavySleeperId(1234));
  });
});
