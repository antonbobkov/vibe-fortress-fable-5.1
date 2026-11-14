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
import { TileFlag, TileKind, type Map3D } from '@core/map3d';
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
  KENNEL_WORKSHOP,
  NEST_BOX_TAG,
  NOISE_FIGHT_PERMILLE,
  NOISE_MISS_PERMILLE,
  PREDATOR_HUNGER_DAYS,
  PASTURE_ZONE,
  PET_PILE_MAX,
  PET_PILE_SIZE_MAX,
  TAME_THINK_TICKS,
  WILD_THINK_TICKS,
  WILD_LOAD_SHEDDING_THINK_TICKS,
  TERRITORY_AVOID_RADIUS,
} from './constants';
import { AnimalFacts } from './facts';
import { chunkCentre, fightNoise, hearsNoise, isHeavySleeperId, packOf, strikeBack, tickAnimal, tileOf, wakeStruck, type BrainHost } from './brain';
import { CONDITION_MAX, STARVE_TICKS, breedRadiusOk, conditionRise, isAdult, isDoorTile, stepOffDoor, thinkTame, type TameHost } from './tame';
import { AnimalsProducer, productKey, slaughterKey, trainKey, type AnimalsProducerHost } from './producer';
import type { AnimalsReader } from './reader';
import { initialCavernSpawn, dailySpawn, leavers, regionSurfaceSpecies, surfaceCap, cavernCap, type SpawnHost } from './spawn';
import type { AnimalsStateV1, EggRecord, SpeciesCount } from './state';

export * from './constants';
export * from './brain';
export * from './tame';
export { AnimalsProducer, trainKey, type AnimalsProducerHost } from './producer';
export { AnimalFacts, type SpeciesRow, type Diet, type Temperament } from './facts';
export { cavernCap, dailySpawn, dangerousQuiet, edgeSpawnTiles, farFromDwarves, groupSize, groupTiles, leavers, regionSurfaceSpecies, spawnPermille, surfaceCap, type SpawnHost } from './spawn';
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
  private loadShedding = false;

  /** Pace only; the app owns the clock and the switch is absent from saved simulation state. */
  setLoadShedding(enabled: boolean): void { this.loadShedding = enabled; }
  readonly id = ANIMALS_ID;
  readonly order = 8;
  override readonly cadence = ANIMALS_CADENCE;
  override readonly phase = ANIMALS_PHASE;
  override readonly subscribes: readonly EventType[] = ['HourPassed', 'DayPassed', 'SeasonChanged', 'CreatureDied', 'CorpseCreated', 'AttackResolved', 'BuildingCompleted', 'BuildingRemoved', 'ZoneChanged', 'ThreatNearby', 'CreatureCaged', 'TilesChanged'];
  override readonly ownsCommands: readonly CommandType[] = [
    'SetBreedingCap',
    'AssignPasture',
    'MarkSlaughter',
    'UnmarkSlaughter',
    'AssignAnimal',
    'NameAnimal',
    'TrainAnimal',
    'TameCaged',
    'ReleaseCaged',
  ];

  private readonly options: AnimalsOptions;
  private world: WorldLike | null = null;
  private factsRef: AnimalFacts | null = null;
  private rngRef: RngStream | null = null;
  private readersRef: InitContext['readers'] | null = null;
  private readerRef: AnimalsReader | null = null;
  private brainRef: BrainHost | null = null;
  private spawnRef: SpawnHost | null = null;
  private initialTiers: number[] = [];
  private readonly initializedCaverns = new Set<number>();
  /** T-545: the tick the last dangerous surface group arrived, -1 for none (`08` § Wild spawning). */
  private lastDangerousTick = -1;
  private wildlifeDensity = 1000;
  private cavernTileCache: (TileIndex[] | null)[] = [null, null, null, null];

  // State (`08` § State, `schemas/system-state.md` `AnimalsState`).
  readonly breedingCaps = new Map<number, number>();
  readonly speciesCounts = new Map<number, SpeciesCount>();
  readonly nestBoxes: EntityId[] = [];
  readonly caged: [EntityId, EntityId][] = [];
  readonly pendingTrain = new Map<EntityId, 'war' | 'hunting'>();
  readonly pendingTame = new Map<EntityId, EntityId>();
  /** Who attacked whom; a `neutral` animal fears only its attacker (16 fills this in M6). */
  readonly provoked = new Map<EntityId, EntityId>();
  /** Tiles a grazer cleared, handed to 07 on the next tick (07 owns grass; D-089). */
  readonly grazedPending: TileIndex[] = [];
  /** Tiles whose `GrassGrazed` went out and whose grass flag 07 has not yet cleared (08 § Pastures and feeding). */
  readonly grazeEmitted: TileIndex[] = [];
  /** The grass tile each grazer passes over until the tick, after its walk there came back unreachable (08 § Pastures and feeding). */
  readonly grazeSkips = new Map<EntityId, { tile: TileIndex; until: number }>();
  /** Material indices of the shrub species a tame grazer eats (`plants.md` `graze`), read on first use. */
  private grazableSpecies: Set<number> | null = null;
  private registryRef: InitContext['registry'] | null = null;
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
    this.registryRef = ctx.registry;
    this.grazableSpecies = null;
    this.initialTiers = [1, 2, 3].filter((tier) => this.facts.cavernSpecies(tier)
      .some(([species]) => (this.facts.row(species)?.cavern?.initial ?? 0) > 0));
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
    // `08` § Player-facing behavior: "A pack of wolves has arrived from the north" (note) (T-M7-10).
    // A dangerous surface species is an alert (08 § Player-facing behavior); the first row that matches wins.
    const dangerous: string[] = [];
    for (let s = 1; s <= this.facts.size; s += 1) if (this.facts.isDangerous(s)) dangerous.push(this.facts.idOf(s));
    if (dangerous.length > 0) ctx.register.announcement('AnimalSpawned', { severity: 'alert', stringKey: 'announce.dangerous_arrived', oneOf: { field: 'species', values: dangerous } });
    ctx.register.announcement('AnimalSpawned', { severity: 'note', stringKey: 'announce.animal_spawned' });
    ctx.register.inspector('creature', { id: 'animal', order: 20 });
  }

  private makeBrainHost(): BrainHost {
    const world = this.world as WorldLike;
    return {
      map: world.map,
      farWildThinkTicks: () => this.loadShedding ? WILD_LOAD_SHEDDING_THINK_TICKS : WILD_THINK_TICKS,
      entities: world.entities,
      facts: this.facts,
      rng: this.rng,
      readers: this.readers,
      get movement() {
        return world.services.movement;
      },
      isDaylight: () => this.readers.calendar.isDaylight,
      // 16 arrives in M6; forward to combat system and record in targets.
      setTarget: (id, targetId) => {
        this.targets.set(id, targetId);
        world.services.combat?.setTarget(id, targetId);
      },
      targetOf: (id) => world.services.combat?.targetOf(id) ?? this.targets.get(id) ?? 0,
      provokedBy: (id) => this.provoked.get(id) ?? 0,
      grazed: (tile) => {
        this.claimGraze(tile);
      },
      despawn: (id) => this.despawnQueue.push(id),
      homeAwayFromFortress: (chunk) => this.homeAwayFromFortress(chunk),
      wearsMetal: (id) => this.wearsMetal(id),
    };
  }

  /** T-540: any armour piece or shield the creature wears is of a `metal` material. */
  private wearsMetal(id: EntityId): boolean {
    const entities = (this.world as WorldLike).entities;
    const equip = entities.get(id, C.Equipment);
    if (equip === undefined) return false;
    const a = equip.armor;
    for (const piece of [a.head, a.body, a.arms, a.legs, a.feet, equip.shield]) {
      if (piece === 0) continue;
      const item = entities.get(piece, C.Item);
      if (item !== undefined && this.facts.isMetal(item.material)) return true;
    }
    return false;
  }

  /** T-446: per chunk column (`chunk % per level`), 1 when its centre lies within `TERRITORY_AVOID_RADIUS` of the fortress; rebuilt when null. */
  private fortressNear: Uint8Array | null = null;

  /** The column flags of `fortressNear`: the wagon, built buildings' footprints and zone tiles, horizontally, any level. */
  private fortressColumns(): Uint8Array {
    if (this.fortressNear !== null) return this.fortressNear;
    const world = this.world as WorldLike;
    const map = world.map;
    const per = map.chunksPerRow * map.chunksPerCol;
    const near = new Uint8Array(per);
    const xs: number[] = []; const ys: number[] = [];
    const add = (t: TileIndex): void => { xs.push(map.xOf(t)); ys.push(map.yOf(t)); };
    for (const id of world.entities.with(C.Building)) {
      const b = world.entities.get(id, C.Building);
      if (b !== undefined && b.state === 'built') for (const t of b.footprint) add(t);
    }
    for (const id of world.entities.with(C.Zone)) for (const t of world.entities.get(id, C.Zone)?.tiles ?? []) add(t);
    for (let c = 0; c < per; c += 1) {
      const centre = chunkCentre(map, c);
      const cx = map.xOf(centre); const cy = map.yOf(centre);
      for (let k = 0; k < xs.length; k += 1) {
        if (Math.max(Math.abs((xs[k] as number) - cx), Math.abs((ys[k] as number) - cy)) <= TERRITORY_AVOID_RADIUS) { near[c] = 1; break; }
      }
    }
    this.fortressNear = near;
    return near;
  }

  /** `BrainHost.homeAwayFromFortress` (T-446): nearest free chunk on the level by chunk distance, ties by index. */
  private homeAwayFromFortress(chunk: number): number {
    const map = (this.world as WorldLike).map;
    const per = map.chunksPerRow * map.chunksPerCol;
    if (chunk < 0) return chunk;
    const near = this.fortressColumns();
    const rest = chunk % per;
    if (near[rest] === 0) return chunk;
    const level = chunk - rest;
    const rx = rest % map.chunksPerRow; const ry = Math.floor(rest / map.chunksPerRow);
    let best = -1; let bestD = Number.MAX_SAFE_INTEGER;
    for (let c = 0; c < per; c += 1) {
      if (near[c] !== 0) continue;
      const d = Math.max(Math.abs((c % map.chunksPerRow) - rx), Math.abs(Math.floor(c / map.chunksPerRow) - ry));
      if (d < bestD) { bestD = d; best = c; }
    }
    return best < 0 ? -1 : level + best;
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
      standTile: (animalId) => this.standTile(animalId),
      petSpot: (animalId) => {
        const buildings = this.readers.has('14') ? this.readers.of<BuildingsReader>('14') : null;
        return buildings === null ? -1 : this.clubSpot(animalId, buildings);
      },
      byHall: (tile) => {
        const buildings = this.readers.has('14') ? this.readers.of<BuildingsReader>('14') : null;
        return tile >= 0 && buildings !== null && this.hallArea(buildings).has(tile);
      },
      claimGraze: (tile) => this.claimGraze(tile),
      grazeClaimed: (tile) => this.grazeClaimed(tile),
      grazeSkipped: (animalId, tile, tick) => {
        const skip = this.grazeSkips.get(animalId);
        if (skip === undefined) return false;
        if (skip.until <= tick) {
          this.grazeSkips.delete(animalId);
          return false;
        }
        return skip.tile === tile;
      },
      skipGraze: (animalId, tile, until) => void this.grazeSkips.set(animalId, { tile, until }),
      grazableShrub: (tile) => this.grazableShrub(tile),
      isColdSnap: () => this.readers.has('06') && this.readers.of<{ state(): string }>('06').state() === 'cold_snap',
      stationTile: (animalId, assignedTo) => {
        if (assignedTo === 0) {
          if (this.world?.fortress.alert !== 'hearth') return this.tileOf(animalId);
          const buildings = this.readers.has('14') ? this.readers.of<BuildingsReader>('14') : null;
          const entry = buildings?.hearthHallTiles().find((tile) => this.map.neighbors(tile).some((next) => buildings.doorAt(next)));
          return entry ?? this.homeTile();
        }
        const direct = this.tileOf(assignedTo);
        if (direct >= 0) return direct;
        if (this.readers.has('14')) {
          const building = this.readers.of<BuildingsReader>('14').get(assignedTo);
          if (building?.state === 'built') return building.origin;
        }
        if (this.readers.has('16')) {
          const squad = this.readers.of<{ squad(id: EntityId): { station: TileIndex | null; leaderId: EntityId } | undefined }>('16').squad(assignedTo);
          if (squad !== undefined) return this.tileOf(squad.leaderId) >= 0 ? this.tileOf(squad.leaderId) : (squad.station ?? -1);
        }
        return -1;
      },
    };
  }

  private makeProducerHost(): AnimalsProducerHost {
    return {
      ready: this.ready,
      eggs: this.eggs,
      marked: () => this.entities.with(C.Tame).filter((id) => this.entities.get(id, C.Tame)?.slaughter === true),
      pendingTrain: this.pendingTrain,
      pendingTame: this.pendingTame,
      clearPendingTrain: (id) => this.pendingTrain.delete(id),
      clearPendingTame: (cageId) => this.pendingTame.delete(cageId),
      releaseCagedRecord: (cageId, creatureId) => {
        const idx = this.caged.findIndex(([c, cr]) => c === cageId || cr === creatureId);
        if (idx >= 0) this.caged.splice(idx, 1);
      },
      buildings: () => (this.readers.has('14') ? this.readers.of<BuildingsReader>('14') : null),
      jobs: () => (this.readers.has('11') ? this.readers.of<JobsReader>('11') : null),
      alive: (id) => this.entities.alive(id),
      animalNear: (id, tile) => {
        const at = this.tileOf(id);
        return at >= 0 && Math.max(Math.abs(this.map.xOf(at) - this.map.xOf(tile)), Math.abs(this.map.yOf(at) - this.map.yOf(tile))) <= 1 && this.map.zOf(at) === this.map.zOf(tile);
      },
    };
  }

  /**
   * 08 § Tame behavior: an idle tame animal near the hall stands on a tile of the hall or beside it.
   * It stays where it is unless another idle tame animal of a lower id stands there too; when it
   * moves, it takes the hall tile with the fewest creatures on it or walking to it, ties by lowest
   * index, and only if that is fewer than it has now; a tile beside the hall only if that is fewer
   * still, since beside the hall can be the far side of its wall. A dwarf walking past does not move it.
   */
  private standTile(id: EntityId): TileIndex {
    const movement = this.world?.services.movement ?? null;
    const buildings = this.readers.has('14') ? this.readers.of<BuildingsReader>('14') : null;
    const hall = buildings?.hearthHallTiles() ?? [];
    if (movement === null || buildings === null || hall.length === 0) return this.homeTile();
    const at = movement.tileOf(id);
    const heading = movement.walkTarget(id);
    const label = this.readers.pathing.labelOf(at, 'walker');
    const near = this.hallArea(buildings);
    // A walk that has arrived is not cleared until it is asked for again: one that ends here is over.
    if (heading >= 0 && heading !== at && near.has(heading)) return heading;
    const entities = movement === null ? null : this.world?.entities;
    if (!entities) return this.homeTile();
    const creaturesOn = (tile: TileIndex): EntityId[] => this.readers.entities.at(tile).filter((other) => other !== id && entities.kind(other) === 'creature');
    const standing = (other: EntityId): boolean => movement.walkTarget(other) < 0 || movement.walkTarget(other) === movement.tileOf(other);
    const headed = new Map<TileIndex, number>();
    for (const other of entities.with(C.Tame)) {
      const target = other === id ? -1 : movement.walkTarget(other);
      if (target >= 0 && target !== movement.tileOf(other)) headed.set(target, (headed.get(target) ?? 0) + 1);
    }
    // T-482, a fun feature: an idle pet heaps on its club's spot (T-510: the pets' spot beside the hearth, or
    // the cats' corner for a cat) while it holds fewer than `PET_PILE_MAX` of the club; one already there
    // stays unless that many of the club of lower ids lie there with it.
    const club = this.clubSpot(id, buildings);
    if (club >= 0 && this.readers.pathing.labelOf(club, 'walker') === label) {
      const piled = creaturesOn(club).filter((other) => this.clubSpot(other, buildings) === club && standing(other));
      if (at === club ? piled.filter((other) => other < id).length < PET_PILE_MAX : piled.length + (headed.get(club) ?? 0) < PET_PILE_MAX) return club;
    }
    // The spots are the clubs': a creature that is not piled there moves off one, and none spreads onto one.
    const spot = this.hearthSpot(buildings);
    const corner = this.catsCorner(buildings);
    const spots = (tile: TileIndex): boolean => tile >= 0 && (tile === spot || tile === corner);
    const here = near.has(at) && !spots(at) && !buildings.doorAt(at) ? creaturesOn(at) : null;
    if (here !== null && !here.some((other) => other < id && entities.has(other, C.Tame) && standing(other))) return at;
    let best: TileIndex = -1;
    let least = here === null ? Infinity : here.length;
    const inHall = new Set(hall);
    const byIndex = (a: TileIndex, b: TileIndex): number => a - b;
    for (const tile of [...[...inHall].sort(byIndex), ...[...near].filter((t) => !inHall.has(t)).sort(byIndex)]) {
      if (tile === at || spots(tile) || buildings.doorAt(tile) || !this.readers.pathing.passable(tile, 'walker') || this.readers.pathing.labelOf(tile, 'walker') !== label) continue;
      const count = creaturesOn(tile).length + (headed.get(tile) ?? 0);
      if (count < least) {
        least = count;
        best = tile;
      }
    }
    return best >= 0 ? best : here !== null ? at : this.homeTile();
  }

  /** 08 § Tame behavior: a pet heaps (T-482): a tame animal that is no grazer and no larger than `PET_PILE_SIZE_MAX`. */
  private isPet(id: EntityId): boolean {
    if (!this.entities.has(id, C.Tame)) return false;
    const species = this.entities.get(id, C.Creature)?.species ?? 0;
    return species !== 0 && this.facts.dietOf(species) !== 'grazer' && this.facts.sizeOf(species) <= PET_PILE_SIZE_MAX;
  }

  /** 08 § Tame behavior, T-510: a cat is a pet of a species that adopts a dwarf (§ Pets). */
  private isCat(id: EntityId): boolean {
    return this.isPet(id) && this.facts.adopts(this.entities.get(id, C.Creature)?.species ?? 0);
  }

  /** The spot where this pet heaps: the cats' corner for a cat, the pets' spot for another pet, else -1. */
  private clubSpot(id: EntityId, buildings: BuildingsReader): TileIndex {
    if (!this.isPet(id)) return -1;
    return this.isCat(id) ? this.catsCorner(buildings) : this.hearthSpot(buildings);
  }

  /** The hearth hall's tiles and the tiles beside them (08 § Tame behavior, "in or beside the hall"). */
  private hallArea(buildings: BuildingsReader): Set<TileIndex> {
    const near = new Set<TileIndex>();
    for (const tile of buildings.hearthHallTiles()) {
      near.add(tile);
      for (const beside of this.map.neighbors8(tile)) near.add(beside);
    }
    return near;
  }

  /**
   * 08 § Tame behavior, the cats' corner (T-510, a fun feature): the walkable tile of the hearth hall that
   * is not a door, beside no door, holds no building and is not the pets' spot, with the most of its eight
   * neighbours taken by a wall or furniture; ties by the farthest from the hall's ways in (a hall tile with
   * a walkable tile outside the hall beside it), then by the lowest index; or -1.
   */
  private catsCorner(buildings: BuildingsReader): TileIndex {
    const hall = buildings.hearthHallTiles();
    if (hall.length === 0) return -1;
    const inHall = new Set(hall);
    const pathing = this.readers.pathing;
    const taken = (tile: TileIndex): boolean => !pathing.passable(tile, 'walker') || buildings.at(tile) !== 0;
    const ways = hall.filter((tile) => this.map.neighbors8(tile).some((beside) => !inHall.has(beside) && pathing.passable(beside, 'walker')));
    const spot = this.hearthSpot(buildings);
    let best: TileIndex = -1;
    let most = -1;
    let farthest = -1;
    for (const tile of [...hall].sort((a, b) => a - b)) {
      if (tile === spot || taken(tile) || this.map.neighbors(tile).some((next) => buildings.doorAt(next))) continue;
      const nook = this.map.neighbors8(tile).filter(taken).length;
      const x = this.map.xOf(tile);
      const y = this.map.yOf(tile);
      let away = ways.length === 0 ? 0 : Infinity;
      for (const way of ways) away = Math.min(away, Math.max(Math.abs(this.map.xOf(way) - x), Math.abs(this.map.yOf(way) - y)));
      if (nook > most || (nook === most && away > farthest)) {
        most = nook;
        farthest = away;
        best = tile;
      }
    }
    return best;
  }

  /**
   * 08 § Tame behavior, the pets' spot (T-482): the walkable tile beside the hearth hall's hearth, not a
   * door, beside no door and with no building on it, that has the most of its eight neighbours taken by
   * a wall, the hearth or furniture (a nook off the walking lines), ties by the lowest index; or -1.
   */
  private hearthSpot(buildings: BuildingsReader): TileIndex {
    const hall = new Set(buildings.hearthHallTiles());
    let hearth: TileIndex = -1;
    for (const bid of buildings.byType('hearth')) {
      const b = buildings.get(bid);
      if (b?.state === 'built' && hall.has(b.origin)) {
        hearth = b.origin;
        break;
      }
    }
    if (hearth < 0) return -1;
    const pathing = this.readers.pathing;
    const taken = (tile: TileIndex): boolean => !pathing.passable(tile, 'walker') || buildings.at(tile) !== 0;
    let best: TileIndex = -1;
    let most = -1;
    for (const tile of [...this.map.neighbors8(hearth)].sort((a, b) => a - b)) {
      if (taken(tile) || this.map.neighbors(tile).some((next) => buildings.doorAt(next))) continue;
      const nook = this.map.neighbors8(tile).filter(taken).length;
      if (nook > most) {
        most = nook;
        best = tile;
      }
    }
    return best;
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
    const lastDangerous = (tick?: number): number => (tick === undefined ? this.lastDangerousTick : (this.lastDangerousTick = tick));
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
      get lastDangerousTick() {
        return lastDangerous();
      },
      set lastDangerousTick(tick: number) {
        lastDangerous(tick);
      },
    };
  }

  // ---------- the per-tick brain pass ----------

  override tick(ctx: TickContext): void {
    this.flushGrazed(ctx);
    if (this.initialTiers.some((tier) => !this.initializedCaverns.has(tier))) {
      const breached = this.spawner.breachedCaverns();
      for (const tier of this.initialTiers) {
        if (this.initializedCaverns.has(tier) || !breached.includes(tier)) continue;
        this.initializedCaverns.add(tier);
        this.cavernTileCache[tier] = null;
        for (const group of initialCavernSpawn(this.spawner, tier)) {
          for (const id of group.ids) ctx.emit({ type: 'AnimalSpawned', id, species: this.facts.idOf(group.species) });
        }
      }
    }
    const wild = ctx.world.entities.with(C.Wild);
    for (const id of wild) if (!ctx.world.entities.get(id, C.Creature)?.cagedIn) tickAnimal(this.brain, ctx, id);
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
      if (ctx.world.entities.get(id, C.Creature)?.cagedIn) continue;
      const t = ctx.world.entities.get(id, C.Tame);
      if (t === undefined) continue;
      if (this.readers.has('11')) {
        const jobs = this.readers.of<JobsReader>('11');
        const job = (t.slaughter ? jobs.byKey(slaughterKey(id)) : undefined)
          ?? jobs.byKey(productKey(id, 'milk')) ?? jobs.byKey(productKey(id, 'wool'))
          ?? jobs.byKey(trainKey(id));
        if (job !== undefined && job.workerId !== 0) {
          const worker = this.tileOf(job.workerId);
          if (worker >= 0 && !this.producerHostAnimalNear(id, worker)) ctx.world.services.movement?.walkTo(id, worker, 'wander', ctx);
          ctx.world.services.movement?.moveAlongPath(id, ctx);
          continue;
        }
      }
      const at = this.tileOf(id);
      const onDoor = at >= 0 && isDoorTile(host, at);
      const last = this.lastTameThink.get(id) ?? -TAME_THINK_TICKS;
      if (onDoor || ctx.tick - last >= TAME_THINK_TICKS) {
        this.lastTameThink.set(id, ctx.tick);
        ctx.world.entities.add(id, C.Tame, thinkTame(host, ctx, id, t));
      }
      ctx.world.services.movement?.moveAlongPath(id, ctx);
      const posAfter = this.tileOf(id);
      if (posAfter >= 0 && isDoorTile(host, posAfter)) {
        const walkTarget = ctx.world.services.movement?.walkTarget(id) ?? -1;
        if (walkTarget < 0 || walkTarget === posAfter) {
          const headingTo = (t.petOf !== 0 || t.assignedTo !== 0) ? this.tileOf(t.petOf || t.assignedTo) : -1;
          stepOffDoor(host, id, posAfter, headingTo, ctx);
        }
      }
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
      if (ctx.tick - (this.starvingSince.get(id) as number) >= STARVE_TICKS) {
        this.starvingSince.delete(id);
        ctx.emit({ type: 'Starvation', id });
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

  /**
   * `08` § Grazing shrubs: a mature shrub of a species whose plant row has `graze`. The species are
   * read once from the plant rows; readiness is 07's (`plants.shrubReady`).
   */
  private grazableShrub(tile: TileIndex): boolean {
    const map = this.map;
    if (!map.validIndex(tile) || map.kindAt(tile) !== TileKind.Shrub) return false;
    if (this.grazableSpecies === null) {
      const registry = this.registryRef;
      const plants = registry?.table<{ id: string; kind: string; graze?: boolean }>('plants');
      const materials = registry?.table('materials');
      this.grazableSpecies = new Set();
      for (const id of plants?.ids() ?? []) {
        const row = plants?.byId(id);
        if (row?.kind === 'shrub' && row.graze === true && materials?.has(id) === true) this.grazableSpecies.add(materials.index(id));
      }
    }
    if (!this.grazableSpecies.has(map.materialAt(tile))) return false;
    return this.readers.has('07') && this.readers.of<{ shrubReady(i: TileIndex): boolean }>('07').shrubReady(tile);
  }

  /** True while a grazer holds the tile: its event is pending or 07 has not yet cleared the flag. */
  private grazeClaimed(tile: TileIndex): boolean {
    return this.grazedPending.includes(tile) || this.grazeEmitted.includes(tile);
  }

  /** One grass tile feeds one grazer: the first to ask holds it; `false` when it is already held. */
  private claimGraze(tile: TileIndex): boolean {
    if (this.grazeClaimed(tile)) return false;
    this.grazedPending.push(tile);
    return true;
  }

  /**
   * `GrassGrazed { tile }` goes out from 08; 07 clears the flag in its own tick, and the claim ends with it.
   * A grazed shrub is `ShrubGrazed { tile }`: 07 sets it regrowing, and the claim ends when it is no longer ready.
   */
  private flushGrazed(ctx: TickContext): void {
    const map = this.map;
    const held = this.grazeEmitted.filter((tile) => map.kindAt(tile) === TileKind.Shrub ? this.grazableShrub(tile) : map.hasFlag(tile, TileFlag.Grass));
    this.grazeEmitted.length = 0;
    this.grazeEmitted.push(...held);
    for (const tile of this.grazedPending.splice(0)) {
      ctx.emit({ type: map.kindAt(tile) === TileKind.Shrub ? 'ShrubGrazed' : 'GrassGrazed', tile });
      if (!this.grazeEmitted.includes(tile)) this.grazeEmitted.push(tile);
    }
  }

  /** `creature-brains.md`: "Daily: spawning per 08 …, lifetime and cap checks (`leave`)." */
  private daily(ctx: TickContext): void {
    const season = ctx.readers.calendar.season;
    this.cavernTileCache = [null, null, null, null];
    for (const group of dailySpawn(this.spawner, season, ctx.tick)) {
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
    // A loose summon keeps to its own day: no cap or lifetime sends it off (25 § Summons).
    const going = leavers(this.spawner, season, ctx.tick, this.unsummoned(wild), {
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
    const id = world.services.spawn.creature(species, at, 'wild');
    // T-540: a heavy sleeper or not, once, from its id (no stream moves).
    const w = world.entities.get(id, C.Wild);
    if (w !== undefined && isHeavySleeperId(id)) world.entities.add(id, C.Wild, { ...w, heavySleeper: true });
    return id;
  }

  private hasKennel(): boolean {
    if (!this.readers.has('14')) return false;
    const buildings = this.readers.of<BuildingsReader>('14');
    return buildings.byType(KENNEL_WORKSHOP).some((id) => buildings.get(id)?.state === 'built');
  }

  private findOccupant(cageId: EntityId): EntityId {
    const item = this.entities.get(cageId, C.Item);
    if (item?.occupantId) return item.occupantId;
    const pair = this.caged.find(([c]) => c === cageId);
    if (pair) return pair[1];
    if (this.readers.has('14')) {
      const b = this.readers.of<BuildingsReader>('14').get(cageId);
      if (b) {
        if (typeof b.settings['occupantId'] === 'number' && b.settings['occupantId'] > 0) {
          return b.settings['occupantId'];
        }
        if (b.itemId) {
          const linked = this.entities.get(b.itemId, C.Item);
          if (linked?.occupantId) return linked.occupantId;
        }
      }
    }
    for (const crId of this.entities.with(C.Creature)) {
      if (this.entities.get(crId, C.Creature)?.cagedIn === cageId) return crId;
    }
    return 0;
  }

  // ---------- events and commands ----------

  override handle(event: GameEvent, ctx: TickContext): void {
    // T-446: the fortress's extent changes with its buildings and zones.
    if (event.type === 'BuildingCompleted' || event.type === 'BuildingRemoved' || event.type === 'ZoneChanged') this.fortressNear = null;
    if (event.type === 'TilesChanged') {
      // 07 has written its change to these tiles (a grazed tile cleared, or later regrown): their claims end.
      if (this.grazeEmitted.length > 0) {
        const changed = new Set((event['tiles'] as readonly TileIndex[] | undefined) ?? []);
        const kept = this.grazeEmitted.filter((tile) => !changed.has(tile));
        this.grazeEmitted.length = 0;
        this.grazeEmitted.push(...kept);
      }
      return;
    }
    if (event.type === 'CreatureCaged') {
      const creatureId = event['creatureId'] as EntityId;
      const cageId = event['cageItemId'] as EntityId;
      if (typeof creatureId === 'number' && typeof cageId === 'number') {
        if (!this.caged.some(([c, cr]) => c === cageId && cr === creatureId)) {
          this.caged.push([cageId, creatureId]);
        }
      }
      return;
    }
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
    if (event.type === 'ThreatNearby') {
      const animalId = event['id'] as EntityId;
      const hostileId = event['hostileId'] as EntityId;
      const tame = ctx.world.entities.get(animalId, C.Tame);
      if (tame?.trained === 'war') {
        this.targets.set(animalId, hostileId);
        (this.world as WorldLike).services.combat?.setTarget(animalId, hostileId);
      }
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
    if (event.type === 'CorpseCreated') {
      const creatureId = event['creatureId'] as EntityId, itemId = event['itemId'] as EntityId;
      for (const animalId of ctx.world.entities.with(C.Wild)) {
        const wild = ctx.world.entities.get(animalId, C.Wild);
        if (wild === undefined || wild.pendingMeal !== creatureId) continue;
        const next = { ...wild };
        delete next.pendingMeal;
        if (ctx.world.entities.has(itemId, C.Corpse)) {
          next.mealId = itemId;
          const target = this.brain.targetOf?.(animalId) ?? 0;
          const defending = wild.state === 'attack' && wild.defendFrom !== undefined && ctx.world.entities.alive(target);
          if (!defending && wild.state !== 'flee' && wild.state !== 'leave') {
            next.state = 'eat'; next.stateUntil = 0;
            delete next.defendFrom; delete next.unseenSince;
            this.brain.setTarget(animalId, 0); ctx.world.services.movement?.stopWalking(animalId);
          }
        }
        ctx.world.entities.add(animalId, C.Wild, next);
      }
      return;
    }
    if (event.type === 'CreatureDied') {
      const id = event['id'] as EntityId;
      for (const animalId of ctx.world.entities.with(C.Tame)) {
        const tame = ctx.world.entities.get(animalId, C.Tame);
        if (tame !== undefined && tame.petOf === id) ctx.world.entities.add(animalId, C.Tame, { ...tame, petOf: 0 });
      }
      // "Predators … stop hunting after a kill" (08 § Wild behavior): the pack shares the kill.
      const killer = (event['killerId'] ?? 0) as EntityId;
      const killerWild = killer === 0 ? undefined : ctx.world.entities.get(killer, C.Wild);
      if (killerWild?.hungry === true) {
        for (const member of [killer, ...packOf(this.brain, killer)]) {
          const w = ctx.world.entities.get(member, C.Wild);
          if (w?.hungry !== true) continue;
          ctx.world.entities.add(member, C.Wild, { ...w, hungry: false });
          // A fed hunting attack must not become a territorial defence on its next think.
          // Keep genuine defending attacks; only the hunt's quarry and path end here.
          if (w.state === 'hunt' || (w.state === 'attack' && w.defendFrom === undefined)) {
            this.brain.setTarget(member, 0);
            ctx.world.services.movement?.stopWalking(member);
          }
        }
        const fed = ctx.world.entities.get(killer, C.Wild);
        if (fed !== undefined && ctx.world.services.items !== null) {
          ctx.world.entities.add(killer, C.Wild, { ...fed, pendingMeal: id });
        }
      }
      this.targets.delete(id);
      this.provoked.delete(id);
      this.starvingSince.delete(id);
      this.starvingAnnounced.delete(id);
      this.lastTameThink.delete(id);
      for (const key of Array.from(this.ready.keys())) if (this.ready.get(key) === id) this.ready.delete(key);
      for (let i = this.caged.length - 1; i >= 0; i--) {
        const entry = this.caged[i];
        if (entry !== undefined && (entry[0] === id || entry[1] === id)) {
          this.caged.splice(i, 1);
        }
      }
      this.pendingTrain.delete(id);
      for (const [cageId, creatureId] of Array.from(this.pendingTame.entries())) {
        if (cageId === id || creatureId === id) this.pendingTame.delete(cageId);
      }
      if (ctx.world.entities.alive(id) && (ctx.world.entities.has(id, C.Tame) || ctx.world.entities.has(id, C.Wild))) {
        ctx.world.entities.destroy(id);
      }
      return;
    }
    if (event.type === 'AttackResolved') {
      // "for `neutral`, anything that attacked it" (16 emits this from M6 on).
      const target = event['targetId'];
      const attacker = event['attackerId'];
      if (typeof target === 'number' && typeof attacker === 'number' && ctx.world.entities.alive(target)) {
        this.provoked.set(target, attacker);
        const wild = ctx.world.entities.get(target, C.Wild);
        if (wild !== undefined) {
          // T-535: an animal struck (hit) in its sleep wakes; T-540: a miss, parry or block on
          // it is the loudest noise short of a hit and wakes it the same way on a roll; T-538: an
          // aggressive animal struck awake strikes back (08 § Wild behavior, `sleep` and *Struck*).
          const next = wild.state === 'sleep'
            ? (event['outcome'] === 'hit' || hearsNoise(this.brain, wild, NOISE_MISS_PERMILLE, 0)
              ? wakeStruck(this.brain, ctx, target, wild, attacker) : wild)
            : strikeBack(this.brain, ctx, target, wild, attacker);
          if (next !== wild) ctx.world.entities.add(target, C.Wild, next);
        }
      }
      // T-540: a fight wakes the sleepers near it on a roll, falling with distance.
      if (typeof target === 'number' && typeof attacker === 'number') {
        const at = tileOf(this.brain, target);
        const where = at >= 0 ? at : tileOf(this.brain, attacker);
        for (const [sleeper, next] of fightNoise(this.brain, ctx, where, NOISE_FIGHT_PERMILLE, [target, attacker], attacker)) {
          ctx.world.entities.add(sleeper, C.Wild, next);
        }
      }
    }
  }

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    // 25 § Summons: a summon is never slaughtered, named, assigned, pastured or trained.
    const subject = cmd['animalId'];
    if (typeof subject === 'number' && ctx.world.entities.has(subject, C.Summoned)) return reject('not_found');
    if (cmd.type === 'SetBreedingCap') {
      const raw = cmd['species'];
      const species = typeof raw === 'string' ? this.facts.indexOf(raw) : typeof raw === 'number' ? raw : 0;
      if (species === 0 || this.facts.row(species) === undefined) return reject('not_found');
      const cap = cmd['cap'];
      if (typeof cap !== 'number' || !Number.isInteger(cap) || cap < 0 || cap > 100) return reject('out_of_range');
      this.breedingCaps.set(species, cap);
      return OK;
    }
    if (cmd.type === 'TrainAnimal') {
      const animalId = cmd['animalId'];
      const t = typeof animalId === 'number' ? ctx.world.entities.get(animalId, C.Tame) : undefined;
      if (t === undefined || typeof animalId !== 'number') return reject('not_tame');
      const kind = cmd['kind'];
      if (kind !== 'war' && kind !== 'hunting') return reject('precondition_failed');
      const species = ctx.world.entities.get(animalId, C.Creature)?.species ?? 0;
      if (!this.facts.isTrainable(species, kind)) return reject('not_trainable');
      if (!this.hasKennel()) return reject('no_kennel');
      this.pendingTrain.set(animalId, kind);
      return OK;
    }
    if (cmd.type === 'TameCaged') {
      const cageId = cmd['cageId'];
      if (typeof cageId !== 'number') return reject('not_found');
      const occupantId = this.findOccupant(cageId);
      if (occupantId === 0 || !ctx.world.entities.alive(occupantId)) return reject('not_found');
      const creature = ctx.world.entities.get(occupantId, C.Creature);
      if (creature === undefined || ctx.world.entities.has(occupantId, C.Summoned)) return reject('not_found');
      if (!this.facts.isTameable(creature.species)) return reject('precondition_failed');
      if (!this.hasKennel()) return reject('no_kennel');
      this.pendingTame.set(cageId, occupantId);
      return OK;
    }
    if (cmd.type === 'ReleaseCaged') {
      const cageId = cmd['cageId'];
      if (typeof cageId !== 'number') return reject('not_found');
      const occupantId = this.findOccupant(cageId);
      if (occupantId === 0 || !ctx.world.entities.alive(occupantId)) return reject('precondition_failed');

      let originTile = -1;
      const b = ctx.world.entities.get(cageId, C.Building);
      if (b !== undefined) {
        originTile = b.origin;
      } else {
        const pos = ctx.world.entities.get(cageId, C.Position);
        if (pos !== undefined) {
          originTile = this.map.index(pos.x, pos.y, pos.z);
        } else {
          for (const bId of ctx.world.entities.with(C.Building)) {
            const bld = ctx.world.entities.get(bId, C.Building);
            if (bld !== undefined && bld.itemId === cageId) {
              originTile = bld.origin;
              break;
            }
          }
        }
      }

      if (originTile < 0) return reject('precondition_failed');

      let releaseTile = -1;
      for (const n of this.map.neighbors(originTile)) {
        if (this.readers.pathing.passable(n, 'walker') && this.map.kindAt(n) === TileKind.Floor) {
          releaseTile = n;
          break;
        }
      }
      if (releaseTile < 0 && this.readers.pathing.passable(originTile, 'walker') && this.map.kindAt(originTile) === TileKind.Floor) {
        releaseTile = originTile;
      }
      if (releaseTile < 0) return reject('precondition_failed');

      ctx.world.services.movement?.teleport(occupantId, releaseTile);

      ctx.world.services.items?.setOccupant?.(cageId, 0);

      for (const bId of ctx.world.entities.with(C.Building)) {
        const bld = ctx.world.entities.get(bId, C.Building);
        if (bld !== undefined && (bId === cageId || bld.itemId === cageId || bld.settings['occupantId'] === occupantId)) {
          ctx.world.entities.add(bId, C.Building, { ...bld, settings: { ...bld.settings, occupantId: 0 } });
          if (bld.itemId && bld.itemId !== cageId) {
            ctx.world.services.items?.setOccupant?.(bld.itemId, 0);
          }
        }
      }

      const creature = ctx.world.entities.get(occupantId, C.Creature);
      if (creature !== undefined) ctx.world.entities.add(occupantId, C.Creature, { ...creature, cagedIn: 0 });

      const idx = this.caged.findIndex(([c, cr]) => c === cageId || cr === occupantId);
      if (idx >= 0) this.caged.splice(idx, 1);
      this.pendingTame.delete(cageId);
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
      if (this.facts.dietOf(species) !== 'grazer') return reject('not_grazer');
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
      const chainId = cmd['chainId'];
      const squadId = cmd['squadId'];
      const target = typeof chainId === 'number' ? chainId : typeof squadId === 'number' ? squadId : dwarfId;
      if (target === 0) return write({ assignedTo: 0 });
      if (typeof target !== 'number') return reject('not_found');
      if (typeof chainId === 'number') {
        if (!this.readers.has('14') || !this.readers.of<BuildingsReader>('14').byTag('chain').includes(chainId)) return reject('not_found');
      } else if (typeof squadId === 'number') {
        if (!this.readers.has('16') || this.readers.of<{ squad(id: EntityId): unknown }>('16').squad(squadId) === undefined) return reject('not_found');
      } else if (!ctx.world.entities.has(target, C.Brain)) return reject('not_found');
      return write({ assignedTo: target });
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

  /** The ids that are no summon; the list itself when the game has none. */
  private unsummoned(ids: EntityId[]): EntityId[] {
    if (this.entities.store(C.Summoned).size === 0) return ids;
    return ids.filter((id) => !this.entities.has(id, C.Summoned));
  }

  private makeReader(): AnimalsReader {
    const facts = this.facts;
    const asSpecies = (s: number | string): number => (typeof s === 'number' ? s : facts.indexOf(s));
    return {
      isWild: (id) => this.entities.has(id, C.Wild),
      isTame: (id) => this.entities.has(id, C.Tame),
      state: (id) => this.entities.get(id, C.Wild)?.state ?? '',
      // 25 § Summons: the lists the panels show leave summons out.
      tameList: () => this.unsummoned(this.entities.with(C.Tame)),
      wildList: () => this.unsummoned(this.entities.with(C.Wild)),
      bySpecies: (s, wild) => {
        const species = asSpecies(s);
        return this.unsummoned(this.entities.with(C.Creature)).filter((id) => {
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
        const biomeWeight = row.biomes?.reduce((acc, b) => (b.biome === this.options.spec.biome ? acc + b.weight : acc), 0) ?? 0;
        const weight = biomeWeight > 0 ? biomeWeight : regionSurfaceSpecies(this.spawner, 0).find(([sp]) => sp === species)?.[1] ?? 0;
        return weight <= 0 ? 0 : surfaceCap(this.spawner, species, weight);
      },
      breedingCap: (s) => this.breedingCaps.get(asSpecies(s)) ?? BREEDING_CAP_DEFAULT,
      isDangerous: (s) => this.facts.isDangerous(asSpecies(s)),
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
      ...(this.initializedCaverns.size > 0 ? { initializedCaverns: Array.from(this.initializedCaverns).sort((a, b) => a - b) } : {}),
      ...(this.lastDangerousTick < 0 ? {} : { lastDangerousTick: this.lastDangerousTick }),
      breedingCaps: sortedPairs(this.breedingCaps),
      speciesCounts: sortedPairs(this.speciesCounts).map(([s, c]): [number, SpeciesCount] => [s, { ...c }]),
      nestBoxes: this.nestBoxes.slice(),
      caged: this.caged.map((p): [EntityId, EntityId] => [p[0], p[1]]),
      rng: this.rng.state(),
      dailyDue: this.dailyDue,
      provoked: sortedPairs(this.provoked),
      grazedPending: this.grazedPending.slice(),
      ...(this.grazeEmitted.length === 0 ? {} : { grazeEmitted: this.grazeEmitted.slice() }),
      ...(this.grazeSkips.size === 0 ? {} : {
        grazeSkips: Array.from(this.grazeSkips.keys())
          .filter((id) => this.world?.entities.alive(id) !== false)
          .sort((a, b) => a - b)
          .map((id): [EntityId, number, number] => [id, (this.grazeSkips.get(id) as { tile: number }).tile, (this.grazeSkips.get(id) as { until: number }).until]),
      }),
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
      pendingTrain: Array.from(this.pendingTrain.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([k, v]): [EntityId, 'war' | 'hunting'] => [k, v]),
      pendingTame: Array.from(this.pendingTame.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([k, v]): [EntityId, EntityId] => [k, v]),
    };
  }

  deserialize(state: AnimalsStateV1, ctx: InitContext): void {
    if (this.world === null) this.init(ctx);
    this.fortressNear = null;
    this.initializedCaverns.clear();
    for (const tier of state.initializedCaverns ?? []) this.initializedCaverns.add(tier);
    this.lastDangerousTick = state.lastDangerousTick ?? -1;
    this.breedingCaps.clear();
    for (const [s, cap] of state.breedingCaps) this.breedingCaps.set(s, cap);
    this.speciesCounts.clear();
    for (const [s, c] of state.speciesCounts) this.speciesCounts.set(s, { ...c });
    this.nestBoxes.length = 0;
    this.nestBoxes.push(...state.nestBoxes);
    this.caged.length = 0;
    this.caged.push(...state.caged.map((p): [EntityId, EntityId] => [p[0], p[1]]));
    this.pendingTrain.clear();
    for (const [id, kind] of state.pendingTrain ?? []) this.pendingTrain.set(id, kind);
    this.pendingTame.clear();
    for (const [cageId, crId] of state.pendingTame ?? []) this.pendingTame.set(cageId, crId);
    this.grazeSkips.clear();
    for (const [id, tile, until] of state.grazeSkips ?? []) this.grazeSkips.set(id, { tile, until });
    this.rng.setState(state.rng);
    this.dailyDue = state.dailyDue;
    this.provoked.clear();
    for (const [a, b] of state.provoked ?? []) this.provoked.set(a, b);
    this.grazedPending.length = 0;
    this.grazedPending.push(...(state.grazedPending ?? []));
    this.grazeEmitted.length = 0;
    this.grazeEmitted.push(...(state.grazeEmitted ?? []));
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
