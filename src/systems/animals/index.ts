/**
 * 08 Animals & domestication: the system. `02-systems/08-animals-and-domestication.md`
 * § Perception and brains, § Wild behavior, § Wild spawning, § State, § Interfaces;
 * `04-implementation/algorithms/creature-brains.md` § Animal brain; `tick-order.md`
 * ("08 animals — every tick; think intervals inside").
 *
 * Tame behaviour, pastures, condition, breeding, products and slaughter arrive with T-M4-04; the
 * saved shape already carries their fields so the format does not move.
 */

import { C } from '@core/components';
import { reject, type Command, type CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import { CAVERN_1_Z_MAX, CAVERN_1_Z_MIN, CAVERN_2_Z_MAX, CAVERN_2_Z_MIN, CAVERN_3_Z_MAX, CAVERN_3_Z_MIN, TICKS_PER_DAY } from '@core/constants';
import type { EntityStore } from '@core/entities';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import { TileKind, type Map3D } from '@core/map3d';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext, type WorldLike } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { LocalMapSpec } from '@systems/embark/spec';
import type { TerrainReader } from '@systems/terrain';
import { BREEDING_CAP_DEFAULT, ANIMALS_CADENCE, ANIMALS_PHASE, PREDATOR_HUNGER_DAYS } from './constants';
import { AnimalFacts } from './facts';
import { tickAnimal, type BrainHost } from './brain';
import type { AnimalsReader } from './reader';
import { dailySpawn, leavers, surfaceCap, cavernCap, type SpawnHost } from './spawn';
import type { AnimalsStateV1, SpeciesCount } from './state';

export * from './constants';
export * from './brain';
export { AnimalFacts, type SpeciesRow, type Diet, type Temperament } from './facts';
export { cavernCap, dailySpawn, edgeSpawnTiles, farFromDwarves, groupSize, groupTiles, leavers, spawnPermille, surfaceCap, type SpawnHost } from './spawn';
export type { AnimalsReader } from './reader';

/** The id 08 registers its reader under. */
export const ANIMALS_ID = '08';

/** The z bands of the three caverns, by tier. */
const CAVERN_BAND: readonly (readonly [number, number])[] = Object.freeze([
  [CAVERN_1_Z_MIN, CAVERN_1_Z_MAX],
  [CAVERN_2_Z_MIN, CAVERN_2_Z_MAX],
  [CAVERN_3_Z_MIN, CAVERN_3_Z_MAX],
]);

interface BiomeRow {
  readonly id: string;
  readonly wildlifeDensity: number;
}

export interface AnimalsOptions {
  readonly spec: Pick<LocalMapSpec, 'biome' | 'traits'>;
}

export class AnimalsSystem extends BaseSystem<AnimalsStateV1> {
  readonly id = ANIMALS_ID;
  readonly order = 8;
  override readonly cadence = ANIMALS_CADENCE;
  override readonly phase = ANIMALS_PHASE;
  override readonly subscribes: readonly EventType[] = ['DayPassed', 'CreatureDied', 'AttackResolved'];
  override readonly ownsCommands: readonly CommandType[] = ['SetBreedingCap'];

  private readonly options: AnimalsOptions;
  private world: WorldLike | null = null;
  private factsRef: AnimalFacts | null = null;
  private rngRef: RngStream | null = null;
  private readersRef: InitContext['readers'] | null = null;
  private readerRef: AnimalsReader | null = null;
  private brainRef: BrainHost | null = null;
  private spawnRef: SpawnHost | null = null;
  private wildlifeDensity = 1000;
  private cavernTileCache: (TileIndex[] | null)[] = [null, null, null, null];

  // State (`08` § State, `schemas/system-state.md` `AnimalsState`).
  readonly breedingCaps = new Map<number, number>();
  readonly speciesCounts = new Map<number, SpeciesCount>();
  readonly nestBoxes: EntityId[] = [];
  readonly caged: [EntityId, EntityId][] = [];
  /** Who attacked whom; a `neutral` animal fears only its attacker (16 fills this in M6). */
  readonly provoked = new Map<EntityId, EntityId>();
  /** Tiles a grazer cleared, handed to 07 on the next tick (07 owns grass; D-089). */
  readonly grazedPending: TileIndex[] = [];
  dailyDue = false;

  constructor(options: AnimalsOptions = { spec: { biome: '', traits: [] } }) {
    super();
    this.options = options;
  }

  get facts(): AnimalFacts {
    if (this.factsRef === null) throw new Error('08 animals: used before init');
    return this.factsRef;
  }

  get rng(): RngStream {
    if (this.rngRef === null) throw new Error('08 animals: used before init');
    return this.rngRef;
  }

  get readers(): InitContext['readers'] {
    if (this.readersRef === null) throw new Error('08 animals: used before init');
    return this.readersRef;
  }

  get entities(): EntityStore {
    if (this.world === null) throw new Error('08 animals: used before init');
    return this.world.entities;
  }

  get map(): Map3D {
    if (this.world === null) throw new Error('08 animals: used before init');
    return this.world.map;
  }

  /** The brain's host, so tests can drive one think at a time. */
  get brain(): BrainHost {
    if (this.brainRef === null) throw new Error('08 animals: used before init');
    return this.brainRef;
  }

  /** The spawner's host. */
  get spawner(): SpawnHost {
    if (this.spawnRef === null) throw new Error('08 animals: used before init');
    return this.spawnRef;
  }

  override init(ctx: InitContext): void {
    this.world = ctx.world;
    this.rngRef = ctx.rng;
    this.readersRef = ctx.readers;
    this.factsRef = new AnimalFacts(ctx.registry);
    const biome = ctx.registry.table<BiomeRow>('biomes').byId(this.options.spec.biome);
    this.wildlifeDensity = biome?.wildlifeDensity ?? 1000;
    this.brainRef = this.makeBrainHost();
    this.spawnRef = this.makeSpawnHost();
    this.readerRef = this.makeReader();
    // `08` § Registrations (the job producer and the panel arrive with T-M4-04 and T-M4-17).
    ctx.register.announcement('AnimalStarving', { severity: 'alert', stringKey: 'announce.animal_starving' });
    ctx.register.announcement('PetAdopted', { severity: 'note', stringKey: 'announce.pet_adopted' });
    ctx.register.inspector('creature', { id: 'animal', order: 20 });
  }

  private makeBrainHost(): BrainHost {
    const world = this.world as WorldLike;
    return {
      map: world.map,
      entities: world.entities,
      facts: this.facts,
      rng: this.rng,
      readers: this.readers,
      get movement() {
        return world.services.movement;
      },
      isDaylight: () => this.readers.calendar.isDaylight,
      // 16 arrives in M6; until then the call is recorded so the wiring is testable.
      setTarget: (id, targetId) => this.targets.set(id, targetId),
      provokedBy: (id) => this.provoked.get(id) ?? 0,
      grazed: (tile) => {
        if (!this.grazedPending.includes(tile)) this.grazedPending.push(tile);
      },
      despawn: (id) => this.despawnQueue.push(id),
    };
  }

  /** `combat.setTarget(id, targetId)` as 08 calls it; 16 takes it over in M6. */
  readonly targets = new Map<EntityId, EntityId>();
  private readonly despawnQueue: EntityId[] = [];

  private makeSpawnHost(): SpawnHost {
    const world = this.world as WorldLike;
    const readers = this.readers;
    return {
      map: world.map,
      facts: this.facts,
      rng: this.rng,
      get pathing() {
        return readers.pathing;
      },
      biome: this.options.spec.biome,
      wildlifeDensity: this.wildlifeDensity,
      traits: [...this.options.spec.traits],
      countWild: (species) => this.countOf(species, true),
      creatureCount: () => world.entities.with(C.Creature).length,
      dwarfTiles: () => this.dwarfTiles(),
      breachedCaverns: () => this.breachedCaverns(),
      cavernTiles: (tier) => this.cavernTiles(tier),
      spawn: (species, at) => this.spawnCreature(species, at),
    };
  }

  // ---------- the per-tick brain pass ----------

  override tick(ctx: TickContext): void {
    this.flushGrazed(ctx);
    const wild = ctx.world.entities.with(C.Wild);
    for (const id of wild) tickAnimal(this.brain, ctx, id);
    for (const id of this.despawnQueue.splice(0)) this.despawn(ctx, id);
    if (this.dailyDue) {
      this.dailyDue = false;
      this.daily(ctx);
    }
  }

  /** `GrassGrazed { tile }` goes out from 08; 07 clears the flag in its own tick. */
  private flushGrazed(ctx: TickContext): void {
    for (const tile of this.grazedPending.splice(0)) ctx.emit({ type: 'GrassGrazed', tile });
  }

  /** `creature-brains.md`: "Daily: spawning per 08 …, lifetime and cap checks (`leave`)." */
  private daily(ctx: TickContext): void {
    const season = ctx.readers.calendar.season;
    this.cavernTileCache = [null, null, null, null];
    for (const group of dailySpawn(this.spawner, season)) {
      for (const id of group.ids) ctx.emit({ type: 'AnimalSpawned', id, species: this.facts.idOf(group.species) });
    }
    const wild = ctx.world.entities.with(C.Wild);
    // "Predators are *hungry* every `PREDATOR_HUNGER_DAYS` days" (they stop after a kill, M6).
    const period = PREDATOR_HUNGER_DAYS * TICKS_PER_DAY;
    for (const id of wild) {
      const w = ctx.world.entities.get(id, C.Wild);
      const species = ctx.world.entities.get(id, C.Creature)?.species ?? 0;
      if (w === undefined || w.hungry || this.facts.dietOf(species) !== 'carnivore') continue;
      const age = ctx.tick - w.arrivedTick;
      if (age >= period && Math.floor(age / TICKS_PER_DAY) % PREDATOR_HUNGER_DAYS === 0) {
        ctx.world.entities.add(id, C.Wild, { ...w, hungry: true });
      }
    }
    const going = leavers(this.spawner, season, ctx.tick, wild, {
      get: (id) => {
        const creature = ctx.world.entities.get(id, C.Creature);
        const w = ctx.world.entities.get(id, C.Wild);
        return creature === undefined || w === undefined ? undefined : { species: creature.species, arrivedTick: w.arrivedTick };
      },
    });
    for (const id of going) {
      const w = ctx.world.entities.get(id, C.Wild);
      if (w === undefined || w.state === 'leave') continue;
      ctx.world.entities.add(id, C.Wild, { ...w, state: 'leave', stateUntil: ctx.tick });
    }
    this.recount();
  }

  private despawn(ctx: TickContext, id: EntityId): void {
    const creature = ctx.world.entities.get(id, C.Creature);
    if (creature === undefined) return;
    ctx.emit({ type: 'AnimalLeft', id, species: this.facts.idOf(creature.species) });
    this.targets.delete(id);
    this.provoked.delete(id);
    ctx.world.entities.destroy(id);
  }

  // ---------- counts and the world around the animals ----------

  private countOf(species: number, wild: boolean): number {
    let n = 0;
    for (const id of this.entities.with(C.Creature)) {
      if (this.entities.get(id, C.Creature)?.species !== species) continue;
      if (wild ? this.entities.has(id, C.Wild) : this.entities.has(id, C.Tame)) n += 1;
    }
    return n;
  }

  private recount(): void {
    this.speciesCounts.clear();
    for (const id of this.entities.with(C.Creature)) {
      const species = this.entities.get(id, C.Creature)?.species ?? 0;
      if (species === 0) continue;
      const row = this.speciesCounts.get(species) ?? { wild: 0, tame: 0 };
      if (this.entities.has(id, C.Wild)) row.wild += 1;
      else if (this.entities.has(id, C.Tame)) row.tame += 1;
      this.speciesCounts.set(species, row);
    }
  }

  private dwarfTiles(): TileIndex[] {
    const out: TileIndex[] = [];
    for (const id of this.entities.with(C.Brain, C.Creature)) {
      const p = this.entities.get(id, C.Position);
      if (p !== undefined) out.push(this.map.index(p.x, p.y, p.z));
    }
    return out;
  }

  private breachedCaverns(): number[] {
    if (!this.readers.has('03')) return [];
    const terrain = this.readers.of<TerrainReader>('03');
    const out: number[] = [];
    for (let tier = 1; tier <= 3; tier += 1) if (terrain.cavernBreached(tier)) out.push(tier);
    return out;
  }

  /** The walkable floors of a cavern band, cached for the day. */
  private cavernTiles(tier: number): TileIndex[] {
    const cached = this.cavernTileCache[tier];
    if (cached !== null && cached !== undefined) return cached;
    const band = CAVERN_BAND[tier - 1];
    const out: TileIndex[] = [];
    if (band !== undefined) {
      const map = this.map;
      for (let z = band[0]; z <= band[1]; z += 1) {
        for (let y = 0; y < map.h; y += 1) {
          for (let x = 0; x < map.w; x += 1) {
            const i = map.index(x, y, z);
            if (map.kindAt(i) !== TileKind.Floor || map.fluidLevelAt(i) > 0) continue;
            if (!this.readers.pathing.passable(i, 'walker')) continue;
            out.push(i);
          }
        }
      }
    }
    this.cavernTileCache[tier] = out;
    return out;
  }

  private spawnCreature(species: number, at: TileIndex): EntityId {
    const world = this.world as WorldLike;
    return world.services.spawn.creature(species, at, 'wild');
  }

  // ---------- events and commands ----------

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'DayPassed') {
      this.dailyDue = true;
      return;
    }
    if (event.type === 'CreatureDied') {
      const id = event['id'] as EntityId;
      this.targets.delete(id);
      this.provoked.delete(id);
      return;
    }
    if (event.type === 'AttackResolved') {
      // "for `neutral`, anything that attacked it" (16 emits this from M6 on).
      const target = event['targetId'];
      const attacker = event['attackerId'];
      if (typeof target === 'number' && typeof attacker === 'number' && ctx.world.entities.alive(target)) {
        this.provoked.set(target, attacker);
      }
    }
  }

  override applyCommand(cmd: Command, _ctx: TickContext): CommandResult {
    if (cmd.type !== 'SetBreedingCap') return reject('not_found');
    const raw = cmd['species'];
    const species = typeof raw === 'string' ? this.facts.indexOf(raw) : typeof raw === 'number' ? raw : 0;
    if (species === 0 || this.facts.row(species) === undefined) return reject('not_found');
    const cap = cmd['cap'];
    if (typeof cap !== 'number' || !Number.isInteger(cap) || cap < 0 || cap > 100) return reject('out_of_range');
    this.breedingCaps.set(species, cap);
    return { ok: true };
  }

  // ---------- the reader ----------

  private makeReader(): AnimalsReader {
    const facts = this.facts;
    const asSpecies = (s: number | string): number => (typeof s === 'number' ? s : facts.indexOf(s));
    return {
      isWild: (id) => this.entities.has(id, C.Wild),
      isTame: (id) => this.entities.has(id, C.Tame),
      state: (id) => this.entities.get(id, C.Wild)?.state ?? '',
      tameList: () => this.entities.with(C.Tame),
      wildList: () => this.entities.with(C.Wild),
      bySpecies: (s, wild) => {
        const species = asSpecies(s);
        return this.entities.with(C.Creature).filter((id) => {
          if (this.entities.get(id, C.Creature)?.species !== species) return false;
          if (wild === undefined) return this.entities.has(id, C.Wild) || this.entities.has(id, C.Tame);
          return wild ? this.entities.has(id, C.Wild) : this.entities.has(id, C.Tame);
        });
      },
      pastureOf: (id) => this.entities.get(id, C.Tame)?.pastureId ?? 0,
      condition: (id) => this.entities.get(id, C.Tame)?.condition ?? 0,
      assignedTo: (id) => this.entities.get(id, C.Tame)?.assignedTo ?? 0,
      threatTo: (id) => {
        const state = this.entities.get(id, C.Wild)?.state ?? '';
        return state === 'attack' || state === 'hunt';
      },
      def: (s) => facts.row(asSpecies(s)),
      capOf: (s) => {
        const species = asSpecies(s);
        const row = facts.row(species);
        if (row === undefined) return 0;
        if (row.cavern !== undefined) return cavernCap(this.spawner, species);
        const weight = row.biomes?.reduce((acc, b) => (b.biome === this.options.spec.biome ? acc + b.weight : acc), 0) ?? 0;
        return weight <= 0 ? 0 : surfaceCap(this.spawner, species, weight);
      },
      breedingCap: (s) => this.breedingCaps.get(asSpecies(s)) ?? BREEDING_CAP_DEFAULT,
      nestBoxes: () => this.nestBoxes.slice(),
    };
  }

  override reader(): AnimalsReader {
    if (this.readerRef === null) throw new Error('08 animals: reader before init');
    return this.readerRef;
  }

  serialize(): AnimalsStateV1 {
    const sortedPairs = <V>(m: Map<number, V>): [number, V][] =>
      Array.from(m.keys())
        .sort((a, b) => a - b)
        .map((k): [number, V] => [k, m.get(k) as V]);
    return {
      stateVersion: 1,
      breedingCaps: sortedPairs(this.breedingCaps),
      speciesCounts: sortedPairs(this.speciesCounts).map(([s, c]): [number, SpeciesCount] => [s, { ...c }]),
      nestBoxes: this.nestBoxes.slice(),
      caged: this.caged.map((p): [EntityId, EntityId] => [p[0], p[1]]),
      rng: this.rng.state(),
      dailyDue: this.dailyDue,
      provoked: sortedPairs(this.provoked),
      grazedPending: this.grazedPending.slice(),
    };
  }

  deserialize(state: AnimalsStateV1, ctx: InitContext): void {
    if (this.world === null) this.init(ctx);
    this.breedingCaps.clear();
    for (const [s, cap] of state.breedingCaps) this.breedingCaps.set(s, cap);
    this.speciesCounts.clear();
    for (const [s, c] of state.speciesCounts) this.speciesCounts.set(s, { ...c });
    this.nestBoxes.length = 0;
    this.nestBoxes.push(...state.nestBoxes);
    this.caged.length = 0;
    this.caged.push(...state.caged.map((p): [EntityId, EntityId] => [p[0], p[1]]));
    this.rng.setState(state.rng);
    this.dailyDue = state.dailyDue;
    this.provoked.clear();
    for (const [a, b] of state.provoked ?? []) this.provoked.set(a, b);
    this.grazedPending.length = 0;
    this.grazedPending.push(...(state.grazedPending ?? []));
    this.cavernTileCache = [null, null, null, null];
  }
}
