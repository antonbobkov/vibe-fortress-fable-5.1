import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import { thinkWild } from '@systems/animals';
import { findHuntTarget } from '@systems/animals/brain';
import type { CombatReader } from '@systems/combat';
import { TestWorld } from '../../scenarios/test-world';

function setup(count: number, species = 'sheep') {
  const w = new TestWorld({ seed: `t218-${count}-${species}`, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const wolves = Array.from({ length: count }, (_, n) => w.spawnCreature('wolf', w.index(30 + n, 30, Z), 'wild'));
  const dwarf = w.spawnDwarf({ at: w.index(25, 30, Z) });
  const quarry = w.spawnTame(species, w.index(40, 30, Z));
  w.step(1);
  for (const id of wolves) {
    const wild = { ...w.game.world.entities.get(id, C.Wild)!, state: 'idle', stateUntil: 0, hungry: true };
    delete wild.defendFrom;
    w.game.world.entities.add(id, C.Wild, wild);
    w.animals.brain.setTarget(id, 0);
  }
  return { w, wolves, dwarf, quarry };
}

function think(w: TestWorld, id: EntityId): string {
  const ctx = { tick: w.tick, world: w.game.world, emit: () => {} } as unknown as TickContext;
  const wild = thinkWild(w.animals.brain, ctx, id, w.game.world.entities.get(id, C.Wild)!);
  w.game.world.entities.add(id, C.Wild, wild);
  return wild.state;
}

function target(w: TestWorld, id: EntityId): EntityId {
  return w.readers.of<CombatReader>('16').targetOf(id);
}

describe('T-218 packs judge animal prey against nearby living members, capped at three', () => {
  it.each(['sheep', 'goat', 'pig'])('three hungry wolves take a %s ahead of a nearer dwarf', (species) => {
    const { w, wolves, quarry, dwarf } = setup(3, species);
    expect(think(w, wolves[0]!)).toBe('hunt');
    expect(target(w, wolves[0]!)).toBe(quarry);
    expect(target(w, wolves[0]!)).not.toBe(dwarf);
    expect(think(w, wolves[1]!)).toBe('hunt');
    expect(target(w, wolves[1]!)).toBe(quarry);
  });

  it('a lone wolf still cannot take a sheep and chooses the dwarf', () => {
    const { w, wolves, dwarf } = setup(1);
    expect(findHuntTarget(w.animals.brain, wolves[0]!)).toBe(dwarf);
  });

  it.each([3, 4])('%s nearby wolves still cannot take a cow', (count) => {
    const { w, wolves, dwarf } = setup(count, 'cow');
    expect(findHuntTarget(w.animals.brain, wolves[0]!)).toBe(dwarf);
  });

  it('counts a packmate near the quarry even when it is outside the hunter\'s perception', () => {
    const { w, wolves, quarry } = setup(2);
    w.game.world.entities.add(wolves[1]!, C.Position, { x: 45, y: 30, z: Z });
    expect(findHuntTarget(w.animals.brain, wolves[0]!)).toBe(quarry);
  });

  it('does not count a packmate near the hunter but outside perception of the quarry', () => {
    const { w, wolves, dwarf } = setup(2);
    w.game.world.entities.add(wolves[1]!, C.Position, { x: 20, y: 30, z: Z });
    expect(findHuntTarget(w.animals.brain, wolves[0]!)).toBe(dwarf);
  });

  it('does not count a packmate that cannot see the quarry through a wall', () => {
    const { w, wolves, dwarf } = setup(2);
    w.game.world.entities.add(wolves[1]!, C.Position, { x: 46, y: 30, z: Z });
    w.map.setKind(w.index(43, 30, Z), TileKind.Wall, 1);
    expect(findHuntTarget(w.animals.brain, wolves[0]!)).toBe(dwarf);
  });

  it('does not count a packmate on another level', () => {
    const { w, wolves, dwarf } = setup(2);
    w.game.world.entities.add(wolves[1]!, C.Position, { x: 40, y: 30, z: Z - 1 });
    expect(findHuntTarget(w.animals.brain, wolves[0]!)).toBe(dwarf);
  });

  it('does not combine separate arrivals of the same species', () => {
    const { w, wolves, dwarf } = setup(2);
    const mate = w.game.world.entities.get(wolves[1]!, C.Wild)!;
    w.game.world.entities.add(wolves[1]!, C.Wild, { ...mate, arrivedTick: mate.arrivedTick + 1 });
    expect(findHuntTarget(w.animals.brain, wolves[0]!)).toBe(dwarf);
  });

  it.each(['hunt', 'attack'])('lets go of a held quarry when the pack shrinks during %s', (state) => {
    const { w, wolves, quarry } = setup(3, 'pig');
    const hunter = wolves[0]!;
    think(w, hunter);
    // The reproduction starts with the quarry already held, including on the old size rule.
    w.animals.brain.setTarget(hunter, quarry);
    const wild = w.game.world.entities.get(hunter, C.Wild)!;
    w.game.world.entities.add(hunter, C.Wild, { ...wild, state });
    for (const mate of wolves.slice(1)) w.game.world.entities.destroy(mate);
    expect(think(w, hunter)).toBe('idle');
    expect(target(w, hunter)).toBe(0);
  });

  it('rechecks the size of a shared quarry before a packmate joins it', () => {
    const { w, wolves, quarry } = setup(4, 'boar');
    const hunter = wolves[0]!;
    const joiner = wolves[3]!;
    think(w, hunter);
    w.animals.brain.setTarget(hunter, quarry);
    const wild = w.game.world.entities.get(hunter, C.Wild)!;
    w.game.world.entities.add(hunter, C.Wild, { ...wild, state: 'hunt' });
    for (const mate of wolves.slice(1, 3)) w.game.world.entities.destroy(mate);
    // Two wolves have a limit of 56; this boar is 60. A shared target cannot bypass it.
    expect(findHuntTarget(w.animals.brain, joiner)).toBe(0);
  });
});
