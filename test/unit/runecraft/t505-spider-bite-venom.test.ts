/**
 * T-505: the giant cave spider's own bite carries its venom (`creatures.md` § Cavern monsters,
 * `16-combat.md` § Melee resolution, `25-runecraft.md` § Effects `pain`).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { GameEvent } from '@core/events';
import { C } from '@core/components';
import type { RngStream } from '@core/rng';
import type { TickContext } from '@core/system';
import { contentRegistry } from '@content/loader';
import { resolveMelee } from '@systems/combat';
import { effectsLine } from '@ui/panels/look';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const strings = new Strings(registry);
const Z = FLAT_TEST_SURFACE_Z;

/** Every hit roll (0..99) gives `roll`; every other draw its lowest value. */
function fixedRng(roll = 0): RngStream {
  return { int: (lo: number, hi: number) => (lo === 0 && hi === 99 ? roll : lo), chance: () => false } as unknown as RngStream;
}

function ctxOf(w: TestWorld, events: GameEvent[] = []): TickContext {
  return {
    world: w.game.world, registry, rng: fixedRng(0), tick: w.tick, readers: w.readers,
    emit: (e: GameEvent) => { events.push(e); },
  } as unknown as TickContext;
}

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

describe('T-505 the giant cave spider bites with its venom', () => {
  it('the row exports the bite with its venom; no other attack carries one', () => {
    const creatures = registry.table<{ id: string; attacks: { name: string; onHit?: unknown }[] }>('creatures');
    expect(creatures.byId('giant_cave_spider')?.attacks).toEqual([
      { name: 'bite', type: 'pierce', damage: 16, size: 4, onHit: { kind: 'pain', value: 20, ticks: 300 } },
    ]);
    const carriers = creatures.ids().filter((id) => creatures.byId(id)!.attacks.some((a) => a.onHit !== undefined));
    expect(carriers).toEqual(['giant_cave_spider']);
  });

  it('a bite that does damage pains the dwarf by 20 for 300 ticks; a cave crawler\'s bite adds nothing', () => {
    const w = arena('t505-bite');
    const dwarf = w.spawnDwarf({ at: w.index(30, 30, Z) });
    const spider = w.spawnCreature('giant_cave_spider', w.index(31, 30, Z), 'hostile:cavern');
    const events: GameEvent[] = [];
    const res = resolveMelee(ctxOf(w, events), spider, dwarf, new Map());
    expect(res.outcome).toBe('hit');
    expect(res.damage).toBeGreaterThan(0);
    expect(w.game.world.entities.get(dwarf, C.Spellbound)?.effects).toEqual([{ kind: 'pain', value: 20, until: w.tick + 300, sourceId: spider }]);
    expect(effectsLine(w.readers, strings, dwarf)).toBe('Under: venom, pain +20 (300 ticks).');

    const crawler = w.spawnCreature('cave_crawler', w.index(29, 30, Z), 'hostile:cavern');
    const other = w.spawnDwarf({ at: w.index(28, 30, Z) });
    expect(resolveMelee(ctxOf(w), crawler, other, new Map()).outcome).toBe('hit');
    expect(w.game.world.entities.has(other, C.Spellbound)).toBe(false);
  });

  it('a bite that does no damage carries no venom', () => {
    const w = arena('t505-no-damage');
    const dwarf = w.spawnDwarf({ at: w.index(30, 30, Z) });
    const spider = w.spawnCreature('giant_cave_spider', w.index(31, 30, Z), 'hostile:cavern');
    const res = resolveMelee(ctxOf(w), spider, dwarf, new Map(), { overrideDamage: 0 });
    expect(res).toMatchObject({ outcome: 'hit', damage: 0 });
    expect(w.game.world.entities.has(dwarf, C.Spellbound)).toBe(false);
  });
});
