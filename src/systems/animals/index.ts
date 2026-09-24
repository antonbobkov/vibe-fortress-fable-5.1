/**
 * 08 Animals & domestication: the system. `02-systems/08-animals-and-domestication.md`
 * § Perception and brains, § Wild behavior, § Wild spawning, § State, § Interfaces;
 * `04-implementation/algorithms/creature-brains.md` § Animal brain; `tick-order.md`
 * ("08 animals — every tick; think intervals inside").
 *
 * Tame behaviour, pastures, condition, breeding, products and slaughter arrive with T-M4-04; the
 * saved shape already carries their fields so the format does not move.
 */

import { C, type Tame } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import { CAVERN_1_Z_MAX, CAVERN_1_Z_MIN, CAVERN_2_Z_MAX, CAVERN_2_Z_MIN, CAVERN_3_Z_MAX, CAVERN_3_Z_MIN, TICKS_PER_DAY } from '@core/constants';
import type { EntityStore } from '@core/entities';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import { TileKind, type Map3D } from '@core/map3d';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext, type WorldLike } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';
import { arrivalTame, type LocalMapSpec } from '@systems/embark';
import type { TerrainReader } from '@systems/terrain';
import {
  ADOPT_PERMILLE,
  ANIMALS_CADENCE,
  ANIMALS_PHASE,
  ANIMAL_NAME_MAX,
  BREEDING_CAP_DEFAULT,
  BREED_PERMILLE,
  EGG_ITEM,
  HATCH_DAYS,
  NEST_BOX_TAG,
  PREDATOR_HUNGER_DAYS,
  PASTURE_ZONE,
  TAME_THINK_TICKS,
} from './constants';
import { AnimalFacts } from './facts';
import { tickAnimal, type BrainHost } from './brain';
import { CONDITION_MAX, STARVE_TICKS, breedRadiusOk, conditionRise, isAdult, thinkTame, type TameHost } from './tame';
import { AnimalsProducer, productKey, slaughterKey, type AnimalsProducerHost } from './producer';
import type { AnimalsReader } from './reader';
import { dailySpawn, leavers, surfaceCap, cavernCap, type SpawnHost } from './spawn';
import type { AnimalsStateV1, EggRecord, SpeciesCount } from './state';

export * from './constants';
export * from './brain';
export * from './tame';
export { AnimalsProducer, type AnimalsProducerHost } from './producer';
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
  override readonly subscribes: readonly EventType[] = ['HourPassed', 'DayPassed', 'SeasonChanged', 'CreatureDied', 'AttackResolved', 'BuildingCompleted', 'BuildingRemoved', 'ZoneChanged'];
  override readonly ownsCommands: readonly CommandType[] = [
    'SetBreedingCap',
    'AssignPasture',
    'MarkSlaughter',
    'UnmarkSlaughter',
    'AssignAnimal',
    'NameAnimal',
  ];

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
  /** Eggs waiting in a nest box: item → the box, the tick it was laid and the species. */
  readonly eggs = new Map<EntityId, EggRecord>();
  /** Products waiting for their job, `<animalId>:<kind>`. */
  readonly ready = new Map<string, EntityId>();
  readonly announcedProducts = new Set<string>();
  /** Since when an animal has been at `CONDITION_MAX`, and the season its note went out. */
  readonly starvingSince = new Map<EntityId, number>();
  readonly starvingAnnounced = new Map<EntityId, number>();
  private readonly lastTameThink = new Map<EntityId, number>();
  dailyDue = false;
  hourlyDue = false;
  seasonDue = false;
  private tameHostRef: TameHost | null = null;
  private producerRef: AnimalsProducer | null = null;

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

  /** The tame brain's host. */
  get tameHost(): TameHost {
    if (this.tameHostRef === null) throw new Error('08 animals: used before init');
    return this.tameHostRef;
  }

  /** 08's job producer. */
  get producer(): AnimalsProducer {
    if (this.producerRef === null) throw new Error('08 animals: used before init');
    return this.producerRef;
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
    this.tameHostRef = this.makeTameHost();
    this.spawnRef = this.makeSpawnHost();
    this.producerRef = new AnimalsProducer(this.makeProducerHost());
    this.readerRef = this.makeReader();
    ctx.register.jobProducer(this.producer);
    ctx.register.panel({ id: 'animals', title: 'Animals', hotkey: 'n' });
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

  private makeTameHost(): TameHost {
    const brain = this.brain;
    return {
      ...brain,
      get movement() {
        return brain.movement;
      },
      pastureTiles: (zoneId) => {
        if (zoneId === 0 || !this.readers.has('14')) return [];
        const zone = this.readers.of<BuildingsReader>('14').zone(zoneId);
        return zone === undefined || zone.type !== PASTURE_ZONE ? [] : zone.tiles;
      },
      homeTile: () => this.homeTile(),
      isColdSnap: () => this.readers.has('06') && this.readers.of<{ state(): string }>('06').state() === 'cold_snap',
    };
  }

  private makeProducerHost(): AnimalsProducerHost {
    return {
      ready: this.ready,
      eggs: this.eggs,
      marked: () => this.entities.with(C.Tame).filter((id) => this.entities.get(id, C.Tame)?.slaughter === true),
      buildings: () => (this.readers.has('14') ? this.readers.of<BuildingsReader>('14') : null),
      jobs: () => (this.readers.has('11') ? this.readers.of<JobsReader>('11') : null),
      alive: (id) => this.entities.alive(id),
      animalNear: (id, tile) => {
        const at = this.tileOf(id);
        return at >= 0 && Math.max(Math.abs(this.map.xOf(at) - this.map.xOf(tile)), Math.abs(this.map.yOf(at) - this.map.yOf(tile))) <= 1 && this.map.zOf(at) === this.map.zOf(tile);
      },
    };
  }

  /** The idle anchor of a tame animal with no pasture: the hearth hall, else the wagon tile (D-057). */
  private homeTile(): TileIndex {
    if (this.readers.has('14')) {
      const buildings = this.readers.of<BuildingsReader>('14');
      for (const id of buildings.zonesOfType('hearth_hall')) {
        const zone = buildings.zone(id);
        if (zone !== undefined && zone.tiles.length > 0) return zone.tiles[0] as TileIndex;
      }
    }
    if (this.readers.has('10')) {
      const wagon = this.readers.of<{ wagonTile?: TileIndex }>('10').wagonTile;
      if (typeof wagon === 'number') return wagon;
    }
    return -1;
  }

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
    this.tickTame(ctx);
    for (const id of this.despawnQueue.splice(0)) this.despawn(ctx, id);
    if (this.hourlyDue) {
      this.hourlyDue = false;
      this.hourly(ctx);
    }
    if (this.dailyDue) {
      this.dailyDue = false;
      this.daily(ctx);
    }
    if (this.seasonDue) {
      this.seasonDue = false;
      this.seasonal(ctx);
    }
  }

  /** `08` § Tame behavior, through the same think interval as the wild brain. */
  private tickTame(ctx: TickContext): void {
    const host = this.tameHost;
    for (const id of ctx.world.entities.with(C.Tame)) {
      const t = ctx.world.entities.get(id, C.Tame);
      if (t === undefined) continue;
      if (this.readers.has('11')) {
        const jobs = this.readers.of<JobsReader>('11');
        const job = (t.slaughter ? jobs.byKey(slaughterKey(id)) : undefined)
          ?? jobs.byKey(productKey(id, 'milk')) ?? jobs.byKey(productKey(id, 'wool'));
        if (job !== undefined && job.workerId !== 0) {
          const worker = this.tileOf(job.workerId);
          if (worker >= 0 && !this.producerHostAnimalNear(id, worker)) ctx.world.services.movement?.walkTo(id, worker, 'wander', ctx);
          ctx.world.services.movement?.moveAlongPath(id, ctx);
          continue;
        }
      }
      const last = this.lastTameThink.get(id) ?? -TAME_THINK_TICKS;
      if (ctx.tick - last >= TAME_THINK_TICKS) {
        this.lastTameThink.set(id, ctx.tick);
        ctx.world.entities.add(id, C.Tame, thinkTame(host, ctx, id, t));
      }
      ctx.world.services.movement?.moveAlongPath(id, ctx);
    }
  }

  private producerHostAnimalNear(id: EntityId, tile: TileIndex): boolean {
    const at = this.tileOf(id);
    return at >= 0 && this.map.zOf(at) === this.map.zOf(tile) &&
      Math.max(Math.abs(this.map.xOf(at) - this.map.xOf(tile)), Math.abs(this.map.yOf(at) - this.map.yOf(tile))) <= 1;
  }

  /** `08` § Pastures and feeding: the hourly condition rise, the starving note and the death. */
  private hourly(ctx: TickContext): void {
    const entities = ctx.world.entities;
    const coldSnap = ctx.readers.has('06') && ctx.readers.of<{ state(): string }>('06').state() === 'cold_snap';
    const rise = conditionRise(coldSnap);
    const season = ctx.readers.calendar.season;
    for (const id of entities.with(C.Tame)) {
      const t = entities.get(id, C.Tame);
      const species = entities.get(id, C.Creature)?.species ?? 0;
      // "`none`-diet species … need no feeding; they forage abstractly."
      if (t === undefined || this.facts.dietOf(species) !== 'grazer') continue;
      const condition = Math.min(CONDITION_MAX, t.condition + rise);
      if (condition !== t.condition) entities.add(id, C.Tame, { ...t, condition });
      if (condition < CONDITION_MAX) {
        this.starvingSince.delete(id);
        continue;
      }
      if (!this.starvingSince.has(id)) this.starvingSince.set(id, ctx.tick);
      if (this.starvingAnnounced.get(id) !== season) {
        this.starvingAnnounced.set(id, season);
        ctx.emit({ type: 'AnimalStarving', id });
      }
      // Until 17 health exists, 08 kills the starving animal itself (T-M4-04).
      if (ctx.tick - (this.starvingSince.get(id) as number) >= STARVE_TICKS) {
        this.starvingSince.delete(id);
        ctx.emit({ type: 'CreatureDied', id, cause: 'starvation', tile: this.tileOf(id), faction: entities.get(id, C.Creature)?.faction ?? '', species, name: entities.get(id, C.Creature)?.name });
        entities.destroy(id);
      }
    }
  }

  /** `08` § Pets: "Each season, each `cat` not already a pet adopts a random dwarf with `ADOPT_PERMILLE`." */
  private seasonal(ctx: TickContext): void {
    const entities = ctx.world.entities;
    const dwarves = entities.with(C.Brain, C.Creature);
    if (dwarves.length === 0) return;
    for (const id of entities.with(C.Tame)) {
      const t = entities.get(id, C.Tame);
      const species = entities.get(id, C.Creature)?.species ?? 0;
      if (t === undefined || t.petOf !== 0 || !this.facts.adopts(species)) continue;
      if (!this.rng.chance(ADOPT_PERMILLE)) continue;
      const dwarfId = dwarves[this.rng.int(0, dwarves.length - 1)] as EntityId;
      entities.add(id, C.Tame, { ...t, petOf: dwarfId });
      const rel = entities.get(dwarfId, C.Relationships);
      if (rel !== undefined && !rel.pets.includes(id)) entities.add(dwarfId, C.Relationships, { ...rel, pets: [...rel.pets, id] });
      ctx.emit({ type: 'PetAdopted', animalId: id, dwarfId });
    }
  }

  /** `GrassGrazed { tile }` goes out from 08; 07 clears the flag in its own tick. */
  private flushGrazed(ctx: TickContext): void {
    for (const tile of this.grazedPending.splice(0)) ctx.emit({ type: 'GrassGrazed', tile });
  }

  /** `creature-brains.md`: "Daily: spawning per 08 …, lifetime and cap checks (`leave`)." */
  private daily(ctx: TickContext): void {
    const season = ctx.readers.calendar.year * 4 + ctx.readers.calendar.season;
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
    this.births(ctx);
    this.breeding(ctx);
    this.products(ctx);
    this.recount();
  }

  /** A pregnancy that has come due: `litter` young beside the mother, `Tame` and juvenile. */
  private births(ctx: TickContext): void {
    const entities = ctx.world.entities;
    for (const id of entities.with(C.Tame)) {
      const t = entities.get(id, C.Tame);
      if (t === undefined || t.pregnantUntil === 0 || ctx.tick < t.pregnantUntil) continue;
      entities.add(id, C.Tame, { ...t, pregnantUntil: 0 });
      const creature = entities.get(id, C.Creature);
      const row = creature === undefined ? undefined : this.facts.row(creature.species);
      const breeding = row?.breeding;
      if (creature === undefined || breeding === undefined) continue;
      const at = this.tileOf(id);
      const cap = this.breedingCaps.get(creature.species) ?? BREEDING_CAP_DEFAULT;
      const n = Math.min(this.rng.int(breeding.litter[0], breeding.litter[1]), Math.max(0, cap - this.countOf(creature.species, false)));
      for (const tile of this.tilesAround(at, n)) {
        const young = ctx.world.services.spawn.creature(creature.species, tile, 'fortress', { sex: this.rng.int(0, 1) as 0 | 1 });
        entities.add(young, C.Tame, {
          ...arrivalTame('none'),
          juvenileUntil: ctx.tick + breeding.growDays * TICKS_PER_DAY,
        });
        ctx.emit({ type: 'AnimalBorn', id: young, species: row?.id ?? '' });
      }
    }
  }

  /** `08` § Breeding: one roll per eligible female per day, under the species' breeding cap. */
  private breeding(ctx: TickContext): void {
    const entities = ctx.world.entities;
    const tame = entities.with(C.Tame);
    const bySpecies = new Map<number, EntityId[]>();
    for (const id of tame) {
      const species = entities.get(id, C.Creature)?.species ?? 0;
      if (species === 0) continue;
      const list = bySpecies.get(species) ?? [];
      list.push(id);
      bySpecies.set(species, list);
    }
    for (const species of Array.from(bySpecies.keys()).sort((a, b) => a - b)) {
      const row = this.facts.row(species);
      const breeding = row?.breeding;
      // "chickens … hatch instead of the pregnancy rule"; mules do not breed.
      if (breeding === undefined || breeding.hatch === true) continue;
      const herd = bySpecies.get(species) as EntityId[];
      const cap = this.breedingCaps.get(species) ?? BREEDING_CAP_DEFAULT;
      if (herd.length + herd.filter((id) => (entities.get(id, C.Tame)?.pregnantUntil ?? 0) > 0).length >= cap) continue;
      const males = herd.filter((id) => entities.get(id, C.Creature)?.sex === 1 && isAdult(entities.get(id, C.Tame) as Tame, ctx.tick));
      if (males.length === 0) continue;
      let expected = herd.length + herd.filter((id) => (entities.get(id, C.Tame)?.pregnantUntil ?? 0) > 0).length;
      for (const id of herd) {
        if (expected >= cap) break;
        const t = entities.get(id, C.Tame);
        const creature = entities.get(id, C.Creature);
        if (t === undefined || creature === undefined || creature.sex !== 0) continue;
        if (t.noBreed || t.slaughter || t.pregnantUntil !== 0 || !isAdult(t, ctx.tick)) continue;
        const mate = males.find((m) => breedRadiusOk(this.tameHost, id, m, t.pastureId !== 0 && entities.get(m, C.Tame)?.pastureId === t.pastureId));
        if (mate === undefined) continue;
        if (!this.rng.chance(BREED_PERMILLE)) continue;
        entities.add(id, C.Tame, { ...t, pregnantUntil: ctx.tick + breeding.gestationDays * TICKS_PER_DAY });
        expected += 1;
      }
    }
  }

  /** `08` § Products: milk, wool and the eggs a nest box holds, plus hatching. */
  private products(ctx: TickContext): void {
    const entities = ctx.world.entities;
    for (const id of entities.with(C.Tame)) {
      const t = entities.get(id, C.Tame);
      const creature = entities.get(id, C.Creature);
      const row = creature === undefined ? undefined : this.facts.row(creature.species);
      if (t === undefined || creature === undefined || row?.products === undefined) continue;
      if (!isAdult(t, ctx.tick) || t.slaughter) continue;
      let current = t;
      for (const product of row.products) {
        // "milk: adult females of milking species"; eggs likewise.
        if (product.kind !== 'wool' && creature.sex !== 0) continue;
        const last = current.lastProductTick[product.kind] ?? 0;
        if (ctx.tick - last < product.intervalDays * TICKS_PER_DAY) continue;
        if (product.kind !== 'eggs' && this.ready.has(productKey(id, product.kind))) continue;
        if (product.kind === 'eggs') {
          if (!this.layEgg(ctx, id)) continue;
        }
        current = { ...current, lastProductTick: { ...current.lastProductTick, [product.kind]: ctx.tick } };
        entities.add(id, C.Tame, current);
        if (product.kind !== 'eggs') this.ready.set(productKey(id, product.kind), id);
        if (!this.announcedProducts.has(product.kind)) {
          this.announcedProducts.add(product.kind);
          ctx.emit({ type: 'ProductReady', id, product: product.kind });
        }
      }
    }
    this.hatch(ctx);
  }

  /** "eggs are laid in a `nest_box` building; if no nest box exists, nothing is laid". */
  private layEgg(ctx: TickContext, id: EntityId): boolean {
    const free = this.freeNestBox(ctx);
    if (free === 0) return false;
    const creature = ctx.world.entities.get(id, C.Creature);
    const tile = this.buildingTile(ctx, free);
    if (creature === undefined || tile < 0) return false;
    const item = ctx.registry.table('items');
    const materials = ctx.registry.table('materials');
    const material = materials.index(EGG_ITEM);
    const egg = ctx.spawn.item(item.index(EGG_ITEM), material, tile, 1, 1);
    if (egg === 0) return false;
    // An uncollected egg must stay available to hatch, not join generic stockpile hauling.
    ctx.world.services.items?.reserve(egg, 0);
    this.eggs.set(egg, { box: free, laidTick: ctx.tick, species: creature.species });
    return true;
  }

  /** "a nest box with an egg left for `HATCH_DAYS` hatches a chick if a rooster exists". */
  private hatch(ctx: TickContext): void {
    if (this.eggs.size === 0) return;
    const entities = ctx.world.entities;
    for (const egg of Array.from(this.eggs.keys()).sort((a, b) => a - b)) {
      const record = this.eggs.get(egg) as EggRecord;
      if (!entities.alive(egg)) {
        this.eggs.delete(egg);
        continue;
      }
      if (ctx.tick - record.laidTick < HATCH_DAYS * TICKS_PER_DAY) continue;
      const rooster = entities
        .with(C.Tame, C.Creature)
        .some((id) => entities.get(id, C.Creature)?.species === record.species && entities.get(id, C.Creature)?.sex === 1 && isAdult(entities.get(id, C.Tame) as Tame, ctx.tick));
      if (!rooster) continue;
      if (this.countOf(record.species, false) >= (this.breedingCaps.get(record.species) ?? BREEDING_CAP_DEFAULT)) continue;
      const tile = this.buildingTile(ctx, record.box);
      this.eggs.delete(egg);
      ctx.world.services.items?.destroy(egg, 'hatched');
      if (tile < 0) continue;
      const row = this.facts.row(record.species);
      const chick = ctx.world.services.spawn.creature(record.species, tile, 'fortress', { sex: this.rng.int(0, 1) as 0 | 1 });
      entities.add(chick, C.Tame, {
        ...arrivalTame('none'),
        juvenileUntil: ctx.tick + (row?.breeding?.growDays ?? 0) * TICKS_PER_DAY,
      });
      ctx.emit({ type: 'AnimalBorn', id: chick, species: row?.id ?? '' });
    }
  }

  private freeNestBox(ctx: TickContext): EntityId {
    if (!ctx.readers.has('14')) return 0;
    const buildings = ctx.readers.of<BuildingsReader>('14');
    const taken = new Set<EntityId>();
    for (const key of Array.from(this.eggs.keys())) taken.add((this.eggs.get(key) as EggRecord).box);
    for (const id of buildings.byTag(NEST_BOX_TAG)) {
      if (buildings.get(id)?.state !== 'built' || taken.has(id)) continue;
      return id;
    }
    return 0;
  }

  private buildingTile(ctx: TickContext, id: EntityId): TileIndex {
    return ctx.readers.has('14') ? (ctx.readers.of<BuildingsReader>('14').get(id)?.origin ?? -1) : -1;
  }

  private tileOf(id: EntityId): TileIndex {
    const p = this.entities.get(id, C.Position);
    return p === undefined ? -1 : this.map.index(p.x, p.y, p.z);
  }

  /** Up to `n` walkable tiles beside `at`, the tile itself first. */
  private tilesAround(at: TileIndex, n: number): TileIndex[] {
    if (at < 0 || n <= 0) return [];
    const out: TileIndex[] = [at];
    for (const t of this.map.neighbors8(at)) {
      if (out.length >= n) break;
      if (this.readers.pathing.passable(t, 'walker')) out.push(t);
    }
    return out.slice(0, n);
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
    if (event.type === 'ZoneChanged' && event['zoneType'] === PASTURE_ZONE && event['change'] === 'removed') {
      const zoneId = event['zoneId'] as EntityId;
      for (const id of ctx.world.entities.with(C.Tame)) {
        const t = ctx.world.entities.get(id, C.Tame);
        if (t?.pastureId === zoneId) ctx.world.entities.add(id, C.Tame, { ...t, pastureId: 0 });
      }
      return;
    }
    if (event.type === 'BuildingCompleted') {
      const id = event['id'] as EntityId;
      if (this.readers.has('14') && this.readers.of<BuildingsReader>('14').byTag(NEST_BOX_TAG).includes(id) && !this.nestBoxes.includes(id)) {
        this.nestBoxes.push(id);
        this.nestBoxes.sort((a, b) => a - b);
      }
      return;
    }
    if (event.type === 'HourPassed') {
      this.hourlyDue = true;
      return;
    }
    if (event.type === 'DayPassed') {
      this.dailyDue = true;
      return;
    }
    if (event.type === 'SeasonChanged') {
      this.seasonDue = true;
      return;
    }
    if (event.type === 'BuildingRemoved') {
      // A nest box that goes takes its egg's hatching with it.
      const removed = event['id'] as EntityId;
      for (const egg of Array.from(this.eggs.keys())) if (this.eggs.get(egg)?.box === removed) this.eggs.delete(egg);
      const at = this.nestBoxes.indexOf(removed);
      if (at >= 0) this.nestBoxes.splice(at, 1);
      return;
    }
    if (event.type === 'CreatureDied') {
      const id = event['id'] as EntityId;
      this.targets.delete(id);
      this.provoked.delete(id);
      this.starvingSince.delete(id);
      this.starvingAnnounced.delete(id);
      this.lastTameThink.delete(id);
      for (const key of Array.from(this.ready.keys())) if (this.ready.get(key) === id) this.ready.delete(key);
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

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    if (cmd.type === 'SetBreedingCap') {
      const raw = cmd['species'];
      const species = typeof raw === 'string' ? this.facts.indexOf(raw) : typeof raw === 'number' ? raw : 0;
      if (species === 0 || this.facts.row(species) === undefined) return reject('not_found');
      const cap = cmd['cap'];
      if (typeof cap !== 'number' || !Number.isInteger(cap) || cap < 0 || cap > 100) return reject('out_of_range');
      this.breedingCaps.set(species, cap);
      return OK;
    }
    const animalId = cmd['animalId'];
    const t = typeof animalId === 'number' ? ctx.world.entities.get(animalId, C.Tame) : undefined;
    if (t === undefined || typeof animalId !== 'number') return reject('not_tame');
    const write = (next: Partial<Tame>): CommandResult => {
      ctx.world.entities.add(animalId, C.Tame, { ...t, ...next });
      return OK;
    };
    if (cmd.type === 'AssignPasture') {
      // "tame grazer; zone is a pasture".
      const species = ctx.world.entities.get(animalId, C.Creature)?.species ?? 0;
      if (this.facts.dietOf(species) !== 'grazer') return reject('not_tame');
      const zoneId = cmd['zoneId'];
      if (zoneId === 0) return write({ pastureId: 0 });
      if (typeof zoneId !== 'number') return reject('not_found');
      const zone = this.readers.has('14') ? this.readers.of<BuildingsReader>('14').zone(zoneId) : undefined;
      if (zone === undefined || zone.type !== PASTURE_ZONE) return reject('not_found');
      return write({ pastureId: zoneId });
    }
    if (cmd.type === 'MarkSlaughter') {
      // "tame; not assigned as war or hunting animal".
      if (t.assignedTo !== 0 || t.trained !== 'none') return reject('assigned');
      return write({ slaughter: true, pastureId: 0 });
    }
    if (cmd.type === 'UnmarkSlaughter') return write({ slaughter: false });
    if (cmd.type === 'AssignAnimal') {
      const dwarfId = cmd['dwarfId'];
      if (t.trained === 'none' && this.facts.idOf(ctx.world.entities.get(animalId, C.Creature)?.species ?? 0) !== 'dog') return reject('not_trainable');
      if (dwarfId === 0) return write({ assignedTo: 0 });
      if (typeof dwarfId !== 'number' || !ctx.world.entities.has(dwarfId, C.Brain)) return reject('not_found');
      return write({ assignedTo: dwarfId });
    }
    if (cmd.type === 'NameAnimal') {
      const name = cmd['name'];
      if (typeof name !== 'string' || name.length < 1 || name.length > ANIMAL_NAME_MAX) return reject('bad_name');
      const creature = ctx.world.entities.get(animalId, C.Creature);
      if (creature === undefined) return reject('not_found');
      ctx.world.entities.add(animalId, C.Creature, { ...creature, name });
      return OK;
    }
    return reject('not_found');
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
      nestBoxes: () => this.readers.has('14') ? this.readers.of<BuildingsReader>('14').byTag(NEST_BOX_TAG).filter((id) => this.readers.of<BuildingsReader>('14').get(id)?.state === 'built') : [],
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
      hourlyDue: this.hourlyDue,
      seasonDue: this.seasonDue,
      eggs: Array.from(this.eggs.keys())
        .sort((a, b) => a - b)
        .map((e): [EntityId, EggRecord] => [e, { ...(this.eggs.get(e) as EggRecord) }]),
      ready: Array.from(this.ready.keys())
        .sort()
        .map((k): [string, EntityId] => [k, this.ready.get(k) as EntityId]),
      announcedProducts: Array.from(this.announcedProducts).sort(),
      starvingSince: sortedPairs(this.starvingSince),
      starvingAnnounced: sortedPairs(this.starvingAnnounced),
      lastTameThink: sortedPairs(this.lastTameThink),
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
    this.hourlyDue = state.hourlyDue === true;
    this.seasonDue = state.seasonDue === true;
    this.eggs.clear();
    for (const [e, record] of state.eggs ?? []) this.eggs.set(e, { ...record });
    this.ready.clear();
    for (const [k, id] of state.ready ?? []) this.ready.set(k, id);
    this.announcedProducts.clear();
    for (const kind of state.announcedProducts ?? []) this.announcedProducts.add(kind);
    this.starvingSince.clear();
    for (const [a, b] of state.starvingSince ?? []) this.starvingSince.set(a, b);
    this.starvingAnnounced.clear();
    for (const [a, b] of state.starvingAnnounced ?? []) this.starvingAnnounced.set(a, b);
    this.lastTameThink.clear();
    for (const [a, b] of state.lastTameThink ?? []) this.lastTameThink.set(a, b);
    this.cavernTileCache = [null, null, null, null];
  }
}
