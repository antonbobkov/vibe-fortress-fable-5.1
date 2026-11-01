/** T-457: any number of creatures share a tile, a door included; a crowded tile slows movement and actions. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { crowdEffort, crowdPercent, crowdTicks } from '@core/crowding';
import { TileKind } from '@core/map3d';
import { CROWD_FREE, CROWD_MAX_PERCENT, CROWD_STEP_PERCENT } from '@core/path-constants';
import type { EntityId, TileIndex } from '@core/types';
import { Compositor } from '@render/compositor';
import { Palette } from '@render/palette';
import type { BuildingsReader } from '@systems/buildings';
import { resolveMelee } from '@systems/combat';
import { EAT_TICKS } from '@systems/dwarves/constants';
import { TestWorld } from '../scenarios/test-world';

const Z = 32;
const world = (seed: string): TestWorld => new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });

/** A dwarf that stands where it is put: no brain, so it never moves. */
function standing(w: TestWorld, at: TileIndex): EntityId {
  const id = w.spawnDwarf({ at });
  w.game.world.entities.remove(id, C.Brain);
  return id;
}

function knockOut(w: TestWorld, id: EntityId): void {
  const body = w.game.world.entities.get(id, C.Body)!;
  body.conscious = false;
}

/** A wall across the map with a door in it. */
function doorway(w: TestWorld): TileIndex {
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 20, Z), TileKind.Wall, granite);
  const door = w.index(40, 20, Z);
  w.build('door', door, 'oak');
  w.step(1);
  return door;
}

/** The ticks a miner standing beside the target takes to dig it, with `others` standing on its tile. */
function digTicks(seed: string, others: number, lying = false): number {
  const w = world(seed);
  const target = w.index(44, 15, Z);
  w.carve(target, TileKind.Wall);
  const stand = w.index(43, 15, Z);
  const miner = w.spawnDwarf({ at: stand, skills: { mining: 0 } });
  const pick = w.spawnItem('pick', 'iron', stand);
  w.items.attachToCarrier(pick, miner);
  w.game.world.entities.add(miner, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: pick });
  for (let k = 0; k < others; k += 1) {
    const id = standing(w, stand);
    if (lying) knockOut(w, id);
  }
  expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [target] }).ok).toBe(true);
  const started = (): { tick: number } | undefined => w.events('JobStarted').find((e) => e['target'] === target) as never;
  w.until(() => started() !== undefined, 400);
  const from = w.tick;
  w.until((v) => v.map.kindAt(target) === TileKind.Floor, 2000);
  return w.tick - from;
}

describe('T-457 the crowding rule', () => {
  it('costs nothing up to CROWD_FREE, then CROWD_STEP_PERCENT for each one more, up to the cap', () => {
    expect(CROWD_FREE).toBe(2);
    expect(CROWD_STEP_PERCENT).toBe(25);
    expect(CROWD_MAX_PERCENT).toBe(100);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 40].map(crowdPercent)).toEqual([100, 100, 100, 125, 150, 175, 200, 200, 200]);
    expect(crowdTicks(60, 100)).toBe(60);
    expect(crowdTicks(60, 125)).toBe(75);
    expect(crowdTicks(61, 125)).toBe(77);
    expect(crowdEffort(1000, 100)).toBe(1000);
    expect(crowdEffort(1000, 200)).toBe(500);
  });
});

describe('T-457 a doorway', () => {
  it('walkers pass a creature standing in it', () => {
    const w = world('t457-door');
    const door = doorway(w);
    standing(w, door);
    const walker = w.spawnDwarf({ at: w.index(40, 24, Z) });
    const movement = w.game.movement;
    const goal = w.index(40, 16, Z);
    const ctx = { tick: 0, emit: (): void => {} };
    w.until((v) => {
      w.game.world.entities.remove(walker, C.Brain);
      return movement.walkTo(walker, goal, 'job', { ...ctx, tick: v.tick }) === 'arrived';
    }, 400);
    expect(movement.tileOf(walker)).toBe(goal);
    expect(w.events('JobBlocked')).toHaveLength(0);
  });

  it('a job behind a door with someone standing in it is walked to and worked, never blocked', () => {
    const w = world('t457-job');
    const door = doorway(w);
    standing(w, door);
    const target = w.index(44, 15, Z);
    w.carve(target, TileKind.Wall);
    const at = w.index(40, 24, Z);
    const miner = w.spawnDwarf({ at, skills: { mining: 10 } });
    const pick = w.spawnItem('pick', 'iron', at);
    w.items.attachToCarrier(pick, miner);
    w.game.world.entities.add(miner, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: pick });
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [target] }).ok).toBe(true);
    w.until((v) => v.map.kindAt(target) === TileKind.Floor, 1500);
    expect(w.events('JobBlocked').filter((e) => e['reason'] === 'unreachable')).toHaveLength(0);
  });

  it('a locked door still stops walkers, and still waits for a clear doorway to lock', () => {
    const w = world('t457-locked');
    const door = doorway(w);
    const b = w.readers.of<BuildingsReader>('14');
    const doorId = b.at(door);
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: doorId, mode: 'locked' }).ok).toBe(true);
    w.step(1);
    expect(w.pathing.reader().passable(door, 'walker', { faction: 'fortress' })).toBe(false);
    expect(w.pathing.reader().reachable(w.index(40, 24, Z), w.index(40, 16, Z), 'walker')).toBe(false);
    const w2 = world('t457-locked-occupied');
    const door2 = doorway(w2);
    const guard = standing(w2, door2);
    const b2 = w2.readers.of<BuildingsReader>('14');
    expect(w2.game.world.applyCommand({ type: 'SetDoorMode', buildingId: b2.at(door2), mode: 'locked' }).ok).toBe(true);
    w2.step(5);
    expect(w2.pathing.reader().passable(door2, 'walker', { faction: 'fortress' })).toBe(true);
    expect(w2.game.movement.teleport(guard, w2.index(40, 24, Z))).toBe(true);
    w2.step(5);
    expect(w2.pathing.reader().passable(door2, 'walker', { faction: 'fortress' })).toBe(false);
  });
});

describe('T-457 how crowded a tile is', () => {
  it('counts standing creatures, hostile or not, and leaves out items and the ones lying down', () => {
    const w = world('t457-count');
    const tile = w.index(30, 30, Z);
    const movement = w.game.movement;
    expect(movement.crowdPercentAt(tile)).toBe(100);
    w.spawnItem('stone_block', 'granite', tile, 3);
    const ids = [standing(w, tile), standing(w, tile), standing(w, tile)];
    expect(movement.crowdPercentAt(tile)).toBe(125);
    // The mover about to step on counts as well.
    expect(movement.crowdPercentAt(tile, 1)).toBe(150);
    knockOut(w, ids[0] as EntityId);
    expect(movement.crowdPercentAt(tile)).toBe(100);
    const creature = w.game.world.entities.get(ids[1] as EntityId, C.Creature)!;
    w.game.world.entities.add(ids[1] as EntityId, C.Creature, { ...creature, faction: 'hostile:gloam' });
    expect(movement.crowdPercentAt(tile)).toBe(100);
    standing(w, tile);
    expect(movement.crowdPercentAt(tile)).toBe(125);
  });

  it('a step takes longer at each crowd size, up to the cap, and lying creatures add nothing', () => {
    const steps = (others: number, lying: boolean): number => {
      const w = world(`t457-step-${others}-${lying}`);
      const a = w.index(30, 30, Z);
      const b = w.index(31, 30, Z);
      const c = w.index(32, 30, Z);
      for (let k = 0; k < others; k += 1) {
        const id = standing(w, b);
        if (lying) knockOut(w, id);
      }
      const walker = w.spawnDwarf({ at: a });
      w.game.world.entities.remove(walker, C.Brain);
      const movement = w.game.movement;
      const ctx = { tick: 0, emit: (): void => {} };
      movement.walkTo(walker, c, 'job', ctx);
      w.step(1);
      let n = 0;
      while (movement.tileOf(walker) !== b && n < 1000) {
        movement.walkTo(walker, c, 'job', ctx);
        n += 1;
      }
      return n;
    };
    const free = steps(0, false);
    expect(steps(1, false)).toBe(free);
    expect(steps(2, false)).toBeGreaterThanOrEqual(Math.floor(free * 1.25) - 1);
    expect(steps(2, false)).toBeLessThanOrEqual(Math.ceil(free * 1.25) + 1);
    expect(steps(5, false)).toBeGreaterThanOrEqual(free * 2 - 1);
    expect(steps(5, false)).toBeLessThanOrEqual(free * 2 + 1);
    expect(steps(20, false)).toBe(steps(5, false));
    expect(steps(5, true)).toBe(free);
  });

  it('a job takes longer by the crowd on the worker\'s tile, up to the cap, and lying creatures add nothing', () => {
    const free = digTicks('t457-dig-0', 0);
    expect(digTicks('t457-dig-1', 1)).toBe(free);
    const four = digTicks('t457-dig-3', 3);
    expect(Math.abs(four - free * 1.5)).toBeLessThanOrEqual(2);
    const cap = digTicks('t457-dig-5', 5);
    expect(Math.abs(cap - free * 2)).toBeLessThanOrEqual(2);
    expect(digTicks('t457-dig-9', 9)).toBe(cap);
    expect(digTicks('t457-dig-lying', 5, true)).toBe(free);
  });
});

/** The ticks until a hungry dwarf, standing on its food, has eaten, with `others` standing beside it there. */
function mealTicks(seed: string, others: number): number {
  const w = world(seed);
  const tile = w.index(30, 30, Z);
  w.spawnItem('plant_food', 'barley', tile);
  const eater = w.spawnDwarf({ at: tile });
  for (const need of ['thirst', 'rest', 'social', 'comfort', 'purpose', 'joy'] as const) w.setNeed(eater, need, 0);
  w.setNeed(eater, 'hunger', 90);
  for (let k = 0; k < others; k += 1) standing(w, tile);
  w.until(() => w.events('MealEaten').length > 0, 1000);
  return w.tick;
}

describe('T-457 actions on a crowded tile', () => {
  it('eating takes longer, to twice its time at the cap', () => {
    const free = mealTicks('t457-meal-0', 0);
    expect(mealTicks('t457-meal-1', 1)).toBe(free);
    expect(mealTicks('t457-meal-5', 5)).toBe(free + EAT_TICKS);
  });

  it('an attack\'s cooldown takes longer by the crowd on the attacker\'s tile; a duel on separate tiles is untouched', () => {
    const cooldown = (others: number): number => {
      const w = world('t457-melee');
      const tile = w.index(30, 30, Z);
      const attacker = w.spawnDwarf({ at: tile });
      const defender = w.spawnDwarf({ at: w.index(31, 30, Z) });
      for (let k = 0; k < others; k += 1) standing(w, tile);
      const map = new Map<number, number>();
      const game = w.game;
      resolveMelee({ world: game.world, registry: game.registry, rng: game.world.rngFor('16'), tick: 0, emit: () => {} } as never, attacker, defender, map);
      return map.get(attacker) as number;
    };
    const free = cooldown(0);
    expect(cooldown(1)).toBe(free);
    expect(cooldown(5)).toBe(free * 2);
  });
});

describe('T-457 drawing a crowd', () => {
  it('cycles the creatures of a tile on the 1000 ms clock, from the topmost; Reduced motion keeps the topmost', () => {
    const w = world('t457-draw');
    const tile = w.index(30, 30, Z);
    const dwarf = w.spawnDwarf({ at: tile });
    const dog = w.spawnCreature('dog', tile, 'fortress');
    const glyphAt = (animFrame: number, reducedMotion = false): number => {
      const compositor = new Compositor({ registry: w.game.registry, palette: new Palette(w.game.registry) });
      return compositor.compose(w.readers, { camX: 30, camY: 30, z: Z, sidebarOpen: false, cursor: null, animFrame, reducedMotion }, 4, 9).get(0, 0).glyph;
    };
    expect(dwarf).toBeLessThan(dog);
    const top = glyphAt(0);
    const second = glyphAt(2);
    expect(second).not.toBe(top);
    expect(glyphAt(1)).toBe(top);
    expect(glyphAt(4)).toBe(top);
    expect(glyphAt(2, true)).toBe(top);
  });
});
