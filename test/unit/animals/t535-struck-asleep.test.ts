/**
 * T-535: an animal attacked in its sleep wakes (08 § Wild behavior, `sleep`). A territorial boar
 * defends against the striker from its own tile; one below its flee percent flees instead.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import { thinkWild } from '@systems/animals';
import { TestWorld } from '../../scenarios/test-world';

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function ctxOf(w: TestWorld, emitted: GameEvent[] = []): TickContext {
  return { tick: w.tick, world: w.game.world, emit: (e: GameEvent) => emitted.push(e) } as unknown as TickContext;
}

/** A boar asleep at (32, 32) with a dwarf beside it. */
function sleepingBoar(w: TestWorld): { boar: EntityId; dwarf: EntityId } {
  const boar = w.spawnCreature('boar', w.index(32, 32, Z), 'wild');
  const dwarf = w.spawnDwarf({ at: w.index(33, 32, Z) });
  const e = w.game.world.entities;
  e.add(boar, C.Wild, { ...e.get(boar, C.Wild)!, state: 'sleep', stateUntil: w.tick + 600 });
  return { boar, dwarf };
}

function strike(w: TestWorld, attacker: EntityId, target: EntityId, emitted: GameEvent[] = []): void {
  const event = { type: 'AttackResolved', attackerId: attacker, defenderId: target, targetId: target, part: null, damageType: 'pierce', amount: 3, outcome: 'hit' } as unknown as GameEvent;
  w.animals.handle(event, ctxOf(w, emitted));
}

describe('T-535 an animal struck in its sleep wakes', () => {
  it('a boar sleeps on beside a dwarf who does not strike it', () => {
    const w = world('t535-sleeps');
    const { boar } = sleepingBoar(w);
    const e = w.game.world.entities;
    const next = thinkWild(w.animals.brain, ctxOf(w), boar, e.get(boar, C.Wild)!);
    expect(next.state).toBe('sleep');
  });

  it('a boar struck in its sleep defends against the striker from its own tile', () => {
    const w = world('t535-defends');
    const { boar, dwarf } = sleepingBoar(w);
    strike(w, dwarf, boar);
    const wild = w.game.world.entities.get(boar, C.Wild)!;
    expect(wild.state).toBe('attack');
    expect(wild.defendFrom).toBe(w.index(32, 32, Z));
    expect(w.animals.brain.targetOf!(boar)).toBe(dwarf);
    // The next think keeps the defence: the striker stands on its ground.
    const next = thinkWild(w.animals.brain, ctxOf(w), boar, wild);
    expect(next.state).toBe('attack');
  });

  it('a boar struck in its sleep below its flee percent flees the striker', () => {
    const w = world('t535-flees');
    const { boar, dwarf } = sleepingBoar(w);
    const e = w.game.world.entities;
    const body = e.get(boar, C.Body)!;
    e.add(boar, C.Body, { ...body, blood: Math.floor(body.maxBlood * 0.4) });
    const emitted: GameEvent[] = [];
    strike(w, dwarf, boar, emitted);
    expect(['flee', 'leave']).toContain(e.get(boar, C.Wild)!.state);
    expect(w.animals.brain.targetOf!(boar)).toBe(0);
    expect(emitted.some((ev) => ev.type === 'CreatureFled' && ev['id'] === boar && ev['from'] === dwarf)).toBe(true);
  });

  it('a strike on a boar that is awake leaves its state to its own think', () => {
    const w = world('t535-awake');
    const { boar, dwarf } = sleepingBoar(w);
    const e = w.game.world.entities;
    e.add(boar, C.Wild, { ...e.get(boar, C.Wild)!, state: 'wander' });
    strike(w, dwarf, boar);
    expect(e.get(boar, C.Wild)!.state).toBe('wander');
  });
});
