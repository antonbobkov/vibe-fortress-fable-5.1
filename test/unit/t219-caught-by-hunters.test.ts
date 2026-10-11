/**
 * T-219: a fleeing civilian is caught, and turns to fight, only when the attacker that hit it is
 * a wild animal hunting it (10 § Behavior selection; 08 § Wild behavior).
 */

import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SPEC, FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;

function newWorld(seed: string): TestWorld {
  return new TestWorld({
    seed,
    registry,
    map: buildFlatTestMap(registry, 96, 96),
    embark: 'none',
    surfaceWildlife: 'none',
    spec: { ...FLAT_TEST_SPEC, traits: [] },
  });
}

interface Bite {
  readonly tick: number;
  readonly attacker: EntityId;
}

/** The ticks at which `attacker` hit `defender`, in order. */
function hits(w: TestWorld, attacker: EntityId, defender: EntityId): Bite[] {
  return w.events('AttackResolved')
    .filter((e) => e['attackerId'] === attacker && e['defenderId'] === defender && e['outcome'] === 'hit')
    .map((e) => ({ tick: Number(e['tick'] ?? 0), attacker }));
}

function strikes(w: TestWorld, attacker: EntityId, defender: EntityId): number {
  return w.events('AttackResolved').filter((e) => e['attackerId'] === attacker && e['defenderId'] === defender).length;
}

function wildState(w: TestWorld, id: EntityId): string {
  return w.game.world.entities.get(id, C.Wild)?.state ?? '';
}

describe('T-219 10 a civilian bitten by a defending animal keeps fleeing', () => {
  for (const seed of ['t219-boar-b', 't219-boar-c', 't219-boar-d', 't219-boar-e']) {
    it(`${seed}: a boar defending its ground bites it, it never fights back, and the boar lets it go`, () => {
      const w = newWorld(seed);
      w.game.world.calendar.isDaylight = true;
      const boar = w.spawnCreature('boar', w.index(40, 40, Z), 'wild');
      const dwarf = w.spawnDwarf({ at: w.index(41, 40, Z) });
      let bitten = false;
      let fought = false;
      let letGo = false;
      for (let t = 0; t < 900 && w.game.world.entities.alive(dwarf); t += 1) {
        w.step(1);
        const brain = w.game.world.entities.get(dwarf, C.Brain);
        if (hits(w, boar, dwarf).length > 0) bitten = true;
        if (bitten && brain?.activity === 'Fighting') fought = true;
        if (bitten && wildState(w, boar) !== 'attack') { letGo = true; break; }
      }
      expect(bitten, 'the boar bit the dwarf').toBe(true);
      expect(fought, 'a bitten civilian did not stop to fight a defending boar').toBe(false);
      expect(strikes(w, dwarf, boar), 'the dwarf never struck the boar').toBe(0);
      expect(letGo, 'the boar let the dwarf go when it left the ground').toBe(true);
      expect(w.game.world.entities.alive(dwarf)).toBe(true);
    });
  }
});

describe('T-219 10 a civilian hit by a hostile of a party keeps fleeing', () => {
  it('a bandit that hits a fleeing civilian does not catch it', () => {
    for (const seed of ['t219-bandit-b', 't219-bandit-c', 't219-bandit-d']) {
      const w = newWorld(seed);
      const bandit = w.spawnCreature('hillfolk_bandit', w.index(40, 40, Z), 'hostile:hillfolk');
      const dwarf = w.spawnDwarf({ at: w.index(42, 40, Z) });
      let hit = false;
      let fought = false;
      for (let t = 0; t < 400 && w.game.world.entities.alive(dwarf); t += 1) {
        // A raid's party sets its members' targets every threats tick (18); it holds this one.
        if (t % 10 === 0) w.game.world.services.combat?.setTarget(bandit, dwarf);
        w.step(1);
        if (hits(w, bandit, dwarf).length > 0) hit = true;
        if (hit && w.game.world.entities.get(dwarf, C.Brain)?.activity === 'Fighting') fought = true;
      }
      expect(hit, `${seed}: the bandit hit the fleeing civilian`).toBe(true);
      expect(fought, `${seed}: the civilian did not turn on the bandit`).toBe(false);
      expect(strikes(w, dwarf, bandit), `${seed}: it never struck the bandit`).toBe(0);
    }
  });
});

describe('T-219 10 a civilian bitten by a hunting wolf still turns and fights', () => {
  it('the wolf that hunts a civilian and bites it is struck back', () => {
    let struck = 0;
    for (const seed of ['t219-wolf-a', 't219-wolf-b', 't219-wolf-c']) {
      const w = newWorld(seed);
      w.game.world.calendar.isDaylight = true;
      const wolf = w.spawnCreature('wolf', w.index(40, 40, Z), 'wild');
      const dwarf = w.spawnDwarf({ at: w.index(46, 40, Z) });
      w.step(1);
      const wild = w.game.world.entities.get(wolf, C.Wild);
      if (wild === undefined) throw new Error('not a wild animal');
      w.game.world.entities.add(wolf, C.Wild, { ...wild, state: 'idle', stateUntil: 0, hungry: true, lastThinkTick: 0 });
      w.step(600);
      expect(hits(w, wolf, dwarf).length, `${seed}: the wolf bit the dwarf`).toBeGreaterThan(0);
      struck += strikes(w, dwarf, wolf);
    }
    expect(struck, 'the dwarf struck back at the hunting wolf').toBeGreaterThan(0);
  });
});
