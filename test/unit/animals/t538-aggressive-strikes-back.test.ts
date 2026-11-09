/**
 * T-538: an `aggressive` animal fears no attacker (08 § Wild behavior, *Struck*). Struck while it
 * is awake and not already fighting, it attacks the striker back, defending the striker's tile, and
 * flees only below its species' own flee percent; a `neutral` animal still flees whoever attacked it.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import { perceivedThreats, thinkWild } from '@systems/animals';
import { TestWorld } from '../../scenarios/test-world';

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function ctxOf(w: TestWorld, emitted: GameEvent[] = []): TickContext {
  return { tick: w.tick, world: w.game.world, emit: (e: GameEvent) => emitted.push(e) } as unknown as TickContext;
}

function setState(w: TestWorld, id: EntityId, state: string): void {
  const e = w.game.world.entities;
  e.add(id, C.Wild, { ...e.get(id, C.Wild)!, state, stateUntil: w.tick + 100, hungry: false });
}

function strike(w: TestWorld, attacker: EntityId, target: EntityId, emitted: GameEvent[] = [], outcome = 'hit'): void {
  const event = { type: 'AttackResolved', attackerId: attacker, defenderId: target, targetId: target, part: null, damageType: 'slash', amount: outcome === 'hit' ? 3 : 0, outcome } as unknown as GameEvent;
  w.animals.handle(event, ctxOf(w, emitted));
}

function think(w: TestWorld, id: EntityId, emitted: GameEvent[] = []): string {
  const e = w.game.world.entities;
  const next = thinkWild(w.animals.brain, ctxOf(w, emitted), id, e.get(id, C.Wild)!);
  e.add(id, C.Wild, next);
  return next.state;
}

describe('T-538 an aggressive animal struck strikes back', () => {
  it('a wandering wolf struck by a dwarf attacks him back and keeps at it, defending his tile', () => {
    const w = world('t538-wolf');
    const wolf = w.spawnCreature('wolf', w.index(32, 32, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(33, 32, Z) });
    setState(w, wolf, 'wander');
    const emitted: GameEvent[] = [];
    strike(w, dwarf, wolf, emitted);
    const wild = w.game.world.entities.get(wolf, C.Wild)!;
    expect(wild.state).toBe('attack');
    expect(wild.defendFrom).toBe(w.index(33, 32, Z));
    expect(w.animals.brain.targetOf!(wolf)).toBe(dwarf);
    expect(perceivedThreats(w.animals.brain, wolf)).toEqual([]);
    expect(think(w, wolf, emitted)).toBe('attack');
    expect(emitted.some((ev) => ev.type === 'CreatureFled')).toBe(false);
  });

  it('a missed blow on a grazing-time bear provokes it too', () => {
    const w = world('t538-miss');
    const bear = w.spawnCreature('bear', w.index(32, 32, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(31, 32, Z) });
    setState(w, bear, 'idle');
    strike(w, dwarf, bear, [], 'miss');
    expect(w.game.world.entities.get(bear, C.Wild)!.state).toBe('attack');
    expect(w.animals.brain.targetOf!(bear)).toBe(dwarf);
  });

  it('a hurt wolf above its own flee percent strikes back; below it, it flees the striker', () => {
    const w = world('t538-hurt');
    const wolf = w.spawnCreature('wolf', w.index(32, 32, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(33, 32, Z) });
    const e = w.game.world.entities;
    const body = e.get(wolf, C.Body)!;
    // A wolf's `flee` is 45: at half its blood it still fights.
    e.add(wolf, C.Body, { ...body, blood: Math.floor(body.maxBlood * 0.5) });
    setState(w, wolf, 'idle');
    strike(w, dwarf, wolf);
    expect(e.get(wolf, C.Wild)!.state).toBe('attack');
    expect(think(w, wolf)).toBe('attack');
    // Below it, struck again while awake and idle, it runs from the striker.
    e.add(wolf, C.Body, { ...e.get(wolf, C.Body)!, blood: Math.floor(body.maxBlood * 0.3) });
    setState(w, wolf, 'idle');
    const emitted: GameEvent[] = [];
    strike(w, dwarf, wolf, emitted);
    expect(['flee', 'leave']).toContain(e.get(wolf, C.Wild)!.state);
    expect(emitted.some((ev) => ev.type === 'CreatureFled' && ev['id'] === wolf && ev['from'] === dwarf)).toBe(true);
  });

  it('a wolf shot from afar charges the archer, and lets go of one who runs from where he shot', () => {
    const w = world('t538-archer');
    const wolf = w.spawnCreature('wolf', w.index(20, 32, Z), 'wild');
    const archer = w.spawnDwarf({ at: w.index(30, 32, Z) });
    setState(w, wolf, 'idle');
    strike(w, archer, wolf);
    expect(w.game.world.entities.get(wolf, C.Wild)!.defendFrom).toBe(w.index(30, 32, Z));
    expect(think(w, wolf)).toBe('attack');
    w.movement.teleport(archer, w.index(36, 32, Z));
    expect(think(w, wolf)).toBe('wander');
    expect(w.animals.brain.targetOf!(wolf)).toBe(0);
  });

  it('a leaving wolf keeps leaving', () => {
    const w = world('t538-leave');
    const wolf = w.spawnCreature('wolf', w.index(32, 32, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(33, 32, Z) });
    setState(w, wolf, 'leave');
    strike(w, dwarf, wolf);
    expect(w.game.world.entities.get(wolf, C.Wild)!.state).toBe('leave');
  });

  it('a neutral elk still flees whoever attacked it', () => {
    const w = world('t538-elk');
    const elk = w.spawnCreature('elk', w.index(32, 32, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(33, 32, Z) });
    setState(w, elk, 'wander');
    strike(w, dwarf, elk);
    expect(w.game.world.entities.get(elk, C.Wild)!.state).toBe('wander');
    expect(perceivedThreats(w.animals.brain, elk)).toEqual([dwarf]);
    expect(['flee', 'leave']).toContain(think(w, elk));
  });
});
