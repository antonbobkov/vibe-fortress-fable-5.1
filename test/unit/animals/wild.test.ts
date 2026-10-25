/**
 * T-M4-03 unit tests for 08's wild animals: the tuning constants against the document, the state
 * transition table, the think interval by dwarf distance, the nocturnal rest window, spawning
 * against caps and `SPAWN_MIN_DISTANCE`, `leave` at the lifetime, and the `hunt` and `attack`
 * states setting `combat.setTarget` through the stub 16 replaces in M6.
 */

import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SPEC, FLAT_TEST_SURFACE_Z, buildFlatTestMap } from '@app/headless';
import { C } from '@core/components';
import { MAX_CREATURES, DAYS_PER_SEASON, TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import * as K from '@systems/animals/constants';
import {
  WILD_STATES,
  dailySpawn,
  edgeSpawnTiles,
  farFromDwarves,
  isRestTime,
  leavers,
  spawnPermille,
  surfaceCap,
  thinkInterval,
  thinkWild,
  type AnimalsReader,
} from '@systems/animals';
import { TestWorld } from '../../scenarios/test-world';
import { tuningConstants } from '../system-constants';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;

function newWorld(seed: string, traits: readonly string[] = FLAT_TEST_SPEC.traits, biome = FLAT_TEST_SPEC.biome, startTick = 0): TestWorld {
  const spec = { ...FLAT_TEST_SPEC, traits: [...traits], biome };
  return new TestWorld({ seed, registry, map: buildFlatTestMap(registry, 64, 64), embark: 'none', spec, startTick });
}

/** A tick context good enough for one `thinkWild` (it reads `tick` and the mover's `{tick, emit}`). */
function ctxOf(w: TestWorld): TickContext {
  return { tick: w.tick, emit: () => {}, world: w.game.world } as unknown as TickContext;
}

function think(w: TestWorld, id: EntityId): string {
  const system = w.animals;
  const wild = w.game.world.entities.get(id, C.Wild);
  if (wild === undefined) throw new Error('not a wild animal');
  const next = thinkWild(system.brain, ctxOf(w), id, wild);
  w.game.world.entities.add(id, C.Wild, next);
  return next.state;
}

function setState(w: TestWorld, id: EntityId, state: string, stateUntil = 0, hungry = false): void {
  const wild = w.game.world.entities.get(id, C.Wild);
  if (wild === undefined) throw new Error('not a wild animal');
  w.game.world.entities.add(id, C.Wild, { ...wild, state, stateUntil, hungry, lastThinkTick: 0 });
}

describe('T-M4-03 animals: tuning constants', () => {
  it('every row of 08 § Tuning constants is in src/systems/animals/constants.ts', () => {
    const rows = tuningConstants('02-systems/08-animals-and-domestication.md');
    expect(rows.length).toBe(29); // T-213 adds the attack perception-grace constant; T-341 adds GRAZE_SKIP_TICKS; T-446 adds TERRITORY_AVOID_RADIUS.
    const values = K as unknown as Record<string, number>;
    for (const r of rows) expect([r.name, values[r.name]]).toEqual([r.name, r.value]);
  });

  it('the nine states of 08 § Wild behavior', () => {
    expect([...WILD_STATES]).toEqual(['idle', 'graze', 'wander', 'flee', 'hunt', 'attack', 'eat', 'sleep', 'leave']);
  });
});

describe('T-M4-03 animals: perception and think interval', () => {
  it('a wild animal thinks every tick within NEAR_DWARF_RADIUS of a dwarf and every WILD_THINK_TICKS otherwise', () => {
    const w = newWorld('think');
    const deer = w.spawnCreature('deer', w.index(40, 40, Z), 'wild');
    expect(thinkInterval(w.animals.brain, deer)).toBe(K.WILD_THINK_TICKS);
    // A dwarf just outside the radius changes nothing; one inside it makes the deer think every tick.
    const far = w.spawnDwarf({ at: w.index(40 + K.NEAR_DWARF_RADIUS + 1, 40, Z) });
    expect(far).toBeGreaterThan(0);
    w.step(1);
    expect(thinkInterval(w.animals.brain, deer)).toBe(K.WILD_THINK_TICKS);
    w.movement.teleport(far, w.index(40 + K.NEAR_DWARF_RADIUS - 1, 40, Z));
    w.step(1);
    expect(thinkInterval(w.animals.brain, deer)).toBe(1);
  });

  it('a diurnal species rests at night and a nocturnal one by day', () => {
    const w = newWorld('rest');
    const facts = w.animals.facts;
    const deer = facts.indexOf('deer');
    const leopard = facts.indexOf('snow_leopard');
    expect(facts.isNocturnal(deer)).toBe(false);
    w.game.world.calendar.isDaylight = true;
    expect(isRestTime(w.animals.brain, deer)).toBe(false);
    w.game.world.calendar.isDaylight = false;
    expect(isRestTime(w.animals.brain, deer)).toBe(true);
    // `creatures.md` marks the snow leopard nocturnal (`N`), so its rest window is the day.
    expect(facts.isNocturnal(leopard)).toBe(true);
    expect(isRestTime(w.animals.brain, leopard)).toBe(false);
    w.game.world.calendar.isDaylight = true;
    expect(isRestTime(w.animals.brain, leopard)).toBe(true);
  });
});

describe('T-M4-03 animals: the wild state table', () => {
  it('idle chooses sleep, graze, wander or flee by the rules of 08 § Wild behavior', () => {
    const w = newWorld('states');
    w.game.world.calendar.isDaylight = true;
    const deer = w.spawnCreature('deer', w.index(30, 30, Z), 'wild');
    // No grass and no threat in daylight: the deer wanders.
    setState(w, deer, 'idle');
    expect(think(w, deer)).toBe('wander');
    // Grass within 6 makes a grazer graze.
    w.map.setFlag(w.index(32, 30, Z), (1 << 6) as never, true);
    setState(w, deer, 'idle');
    expect(think(w, deer)).toBe('graze');
    // At its rest time it sleeps instead.
    w.game.world.calendar.isDaylight = false;
    setState(w, deer, 'idle');
    expect(think(w, deer)).toBe('sleep');
    // A sleeping animal wakes and flees when a dwarf comes into perception.
    const dwarf = w.spawnDwarf({ at: w.index(36, 30, Z) });
    w.step(1);
    setState(w, deer, 'sleep', w.tick + 10_000);
    expect(think(w, deer)).toBe('flee');
    // With the dwarf gone, flee returns to idle once FLEE_TICKS have passed.
    w.game.world.entities.destroy(dwarf);
    w.step(1);
    setState(w, deer, 'flee', 0);
    expect(think(w, deer)).toBe('idle');
  });

  it('a territorial animal attacks a dwarf within TERRITORY_RADIUS and an aggressive one within APPROACH_RADIUS, through combat.setTarget', () => {
    const w = newWorld('attack');
    w.game.world.calendar.isDaylight = true;
    const boar = w.spawnCreature('boar', w.index(20, 20, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(20 + K.TERRITORY_RADIUS - 1, 20, Z) });
    w.step(1);
    setState(w, boar, 'idle');
    expect(think(w, boar)).toBe('attack');
    expect(w.animals.targets.get(boar)).toBe(dwarf);
    expect(w.readers.of<AnimalsReader>('08').threatTo(boar)).toBe(true);
    // A wolf ignores a dwarf farther than APPROACH_RADIUS, and attacks one closer.
    const wolf = w.spawnCreature('wolf', w.index(40, 40, Z), 'wild');
    const near = w.spawnDwarf({ at: w.index(40 + K.APPROACH_RADIUS + 2, 40, Z) });
    w.step(1);
    setState(w, wolf, 'idle');
    expect(think(w, wolf)).not.toBe('attack');
    w.movement.teleport(near, w.index(40 + K.APPROACH_RADIUS - 1, 40, Z));
    w.step(1);
    setState(w, wolf, 'idle');
    expect(think(w, wolf)).toBe('attack');
    expect(w.animals.targets.get(wolf)).toBe(near);
  });

  it('a hungry aggressive carnivore hunts prey and sets combat.setTarget', () => {
    const w = newWorld('hunt');
    w.game.world.calendar.isDaylight = true;
    const wolf = w.spawnCreature('wolf', w.index(50, 50, Z), 'wild');
    const rabbit = w.spawnCreature('rabbit', w.index(54, 50, Z), 'wild');
    w.step(1);
    setState(w, wolf, 'idle', 0, true);
    expect(think(w, wolf)).toBe('hunt');
    expect(w.animals.targets.get(wolf)).toBe(rabbit);
    // The prey gone, the hunt ends.
    w.game.world.entities.destroy(rabbit);
    w.step(1);
    expect(think(w, wolf)).toBe('idle');
  });

  it('an animal beside the map edge leaves instead of fleeing, and despawns with AnimalLeft', () => {
    const w = newWorld('leave');
    const deer = w.spawnCreature('deer', w.index(1, 30, Z), 'wild');
    const dwarf = w.spawnDwarf({ at: w.index(8, 30, Z) });
    expect(dwarf).toBeGreaterThan(0);
    w.step(1);
    setState(w, deer, 'idle');
    expect(think(w, deer)).toBe('leave');
    w.until((world) => !world.game.world.entities.alive(deer), 400);
    expect(w.events('AnimalLeft').map((e) => e['species'])).toContain('deer');
  });
});

describe('T-M4-03 animals: spawning', () => {
  it('spawns only on walkable outdoor edge tiles at least SPAWN_MIN_DISTANCE from a dwarf', () => {
    const w = newWorld('spawn-distance');
    const dwarf = w.spawnDwarf({ at: w.index(0, 32, Z) });
    expect(dwarf).toBeGreaterThan(0);
    w.step(1);
    const tiles = edgeSpawnTiles(w.animals.spawner, 'walker');
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) {
      expect(farFromDwarves(w.animals.spawner, t)).toBe(true);
      const x = w.map.xOf(t);
      const y = w.map.yOf(t);
      expect(x === 0 || y === 0 || x === w.map.w - 1 || y === w.map.h - 1).toBe(true);
    }
    // The dwarf's own corner of the edge is excluded.
    expect(tiles.includes(w.index(0, 32, Z))).toBe(false);
  });

  it('never spawns a species past its cap, and the cap follows creatures.md and the region traits', () => {
    const w = newWorld('spawn-cap', []);
    const system = w.animals;
    const facts = system.facts;
    const deer = facts.indexOf('deer');
    const weight = 20; // temperate_grassland
    // `cap = weight / 5`, rounded up, minimum 2, times the biome's wildlifeDensity (1.0 here).
    expect(facts.baseCap(weight)).toBe(4);
    const cap = surfaceCap(system.spawner, deer, weight);
    expect(cap).toBe(4);
    for (let day = 0; day < 200; day += 1) {
      dailySpawn(system.spawner, 0);
      const alive = w.readers.of<AnimalsReader>('08').bySpecies('deer', true).length;
      expect(alive).toBeLessThanOrEqual(cap);
      expect(w.game.world.entities.with(C.Creature).length).toBeLessThanOrEqual(MAX_CREATURES);
    }
    expect(w.readers.of<AnimalsReader>('08').bySpecies('deer', true).length).toBe(cap);
  });

  it('serene_vale removes wolves, bears and snow leopards and doubles herbivore caps; beastwood raises caps', () => {
    const vale = newWorld('vale', ['serene_vale']);
    const facts = vale.animals.facts;
    expect(surfaceCap(vale.animals.spawner, facts.indexOf('wolf'), 30)).toBe(0);
    expect(surfaceCap(vale.animals.spawner, facts.indexOf('bear'), 15)).toBe(0);
    expect(surfaceCap(vale.animals.spawner, facts.indexOf('rabbit'), 35)).toBe(2 * facts.baseCap(35));
    const beast = newWorld('beast', ['beastwood'], 'taiga');
    const bf = beast.animals.facts;
    const plain = newWorld('plain', [], 'taiga');
    const wolf = bf.indexOf('wolf');
    expect(surfaceCap(beast.animals.spawner, wolf, 30)).toBeGreaterThan(surfaceCap(plain.animals.spawner, wolf, 30));
  });

  it('D-110: the spawn chance is SPAWN_PERMILLE scaled by the species weight, never above certainty', () => {
    expect(spawnPermille(100)).toBe(K.SPAWN_PERMILLE);
    expect(spawnPermille(30)).toBe(45);
    expect(spawnPermille(0)).toBe(0);
    expect(spawnPermille(10_000)).toBe(1000);
  });

  it('an animal on the map longer than WILD_LIFETIME_DAYS is sent to leave', () => {
    const w = newWorld('lifetime');
    const deer = w.spawnCreature('deer', w.index(30, 30, Z), 'wild');
    const info = (id: EntityId): { species: number; arrivedTick: number } | undefined => {
      const creature = w.game.world.entities.get(id, C.Creature);
      const wild = w.game.world.entities.get(id, C.Wild);
      return creature === undefined || wild === undefined ? undefined : { species: creature.species, arrivedTick: wild.arrivedTick };
    };
    const lifetime = K.WILD_LIFETIME_DAYS * TICKS_PER_DAY;
    expect(leavers(w.animals.spawner, 0, lifetime, [deer], { get: info })).toEqual([]);
    expect(leavers(w.animals.spawner, 0, lifetime + 1, [deer], { get: info })).toEqual([deer]);
  });

  it('a species over its cap sends its surplus away, lowest id kept', () => {
    const w = newWorld('surplus');
    const tiles: TileIndex[] = [];
    for (let k = 0; k < 6; k += 1) tiles.push(w.index(20 + k, 20, Z));
    const ids = tiles.map((t) => w.spawnCreature('deer', t, 'wild'));
    const info = (id: EntityId): { species: number; arrivedTick: number } | undefined => {
      const creature = w.game.world.entities.get(id, C.Creature);
      const wild = w.game.world.entities.get(id, C.Wild);
      return creature === undefined || wild === undefined ? undefined : { species: creature.species, arrivedTick: wild.arrivedTick };
    };
    const going = leavers(w.animals.spawner, 0, 10, ids, { get: info });
    const cap = surfaceCap(w.animals.spawner, w.animals.facts.indexOf('deer'), 20);
    expect(going).toEqual(ids.slice(cap));
  });
});

describe('T-192 wild animal season spawning', () => {
  it.each([1, 2].flatMap((year) => [0, 1, 2, 3].map((season) => [year, season]))) (
    'spawns seasonal wildlife in year %i, season %i',
    (year, season) => {
      const w = newWorld('year2', [], 'temperate_grassland', (year - 1) * TICKS_PER_YEAR + season * DAYS_PER_SEASON * TICKS_PER_DAY);
      expect(w.readers.calendar.year).toBe(year);
      expect(w.readers.calendar.season).toBe(season);
      const species = w.animals.facts.surfaceSpecies('temperate_grassland', season);
      expect(species.length).toBeGreaterThan(0);
      for (let day = 0; day < DAYS_PER_SEASON; day += 1) {
        w.step(TICKS_PER_DAY);
        if (w.events('AnimalSpawned').length > 0) break;
      }
      expect(w.events('AnimalSpawned').length).toBeGreaterThan(0);
      expect(w.readers.of<AnimalsReader>('08').wildList().length).toBeGreaterThan(0);
      for (const ev of w.events('AnimalSpawned')) expect(species.some(([s]) => w.animals.facts.idOf(s) === ev['species'])).toBe(true);
    },
  );
  it('can explicitly isolate a flat test world from natural surface spawns while keeping manually supplied animals', () => {
    const w = new TestWorld({ seed: 'year2', world: 'flat-test', map: buildFlatTestMap(registry, 64, 64), embark: 'none', surfaceWildlife: 'none' });
    w.step(DAYS_PER_SEASON * TICKS_PER_DAY);
    expect(w.events('AnimalSpawned')).toEqual([]);
    const deer = w.spawnCreature('deer', w.index(8, 8, Z), 'wild');
    expect(w.game.world.entities.has(deer, C.Wild)).toBe(true);
    const cow = w.spawnTame('cow', w.index(9, 8, Z));
    expect(w.game.world.entities.has(cow, C.Tame)).toBe(true);
  });
});
