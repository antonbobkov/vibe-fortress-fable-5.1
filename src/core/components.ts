/**
 * Component definitions.
 *
 * Every component interface of `04-implementation/schemas/components.md`, and a `ComponentType`
 * registry carrying the owner metadata of that document's § Component ownership table.
 * `test/unit/components.test.ts` parses the table and fails on any drift.
 *
 * `Idx<...>` is a dense registry index; the content definition types arrive with T-M0-06, so the
 * type argument is a name tag until then. It is erased either way: `Idx<T>` is `number`.
 */

import {
  EntityStore,
  MapComponentStore,
  SoaComponentStore,
  growInt16,
  growInt32,
  growInt8,
  growUint16,
  growUint8,
  type ComponentStore,
  type ComponentType,
} from './entities';
import type {
  Alert,
  DamageType,
  EntityId,
  Fixed,
  Idx,
  MoodTier,
  MovementClass,
  Priority,
  Quality,
  RoomTier,
  Severity,
  Tick,
  TileIndex,
  WoundType,
} from './types';

export type { ComponentStore, ComponentType } from './entities';

// ---------- component interfaces ----------

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Motion {
  pathId: number;
  stepIndex: number;
  progress: Fixed;
  speed: Fixed;
  movementClass: MovementClass;
  repathCount: number;
  waitUntil: Tick;
}

export interface Creature {
  species: Idx<'SpeciesDef'>;
  name: string;
  sex: 0 | 1;
  ageTicks: number;
  faction: string;
  /** `species.size` */
  sizeClass: number;
  bodyPlan: Idx<'BodyPlanDef'>;
  /** Installed cage item holding this dormant creature (19). */
  cagedIn?: EntityId;
}

export interface Wound {
  type: WoundType;
  severity: Severity;
  bleed: Fixed;
  pain: number;
  healRemaining: number;
  damage: number;
  bandaged: boolean;
  sutured: boolean;
  splinted: boolean;
  cleaned: boolean;
  dressed: boolean;
  infected: boolean;
  infectedSince: Tick;
  createdTick: Tick;
  curedAt?: Tick;
}

export interface BodyPart {
  hp: number;
  maxHp: number;
  wounds: Wound[];
  destroyed: boolean;
}

export interface Body {
  /** Length 6, in {@link BodySlot} order. */
  parts: BodyPart[];
  blood: number;
  maxBlood: number;
  pain: number;
  conscious: boolean;
  permanent: string[];
  diagnosed: boolean;
}

export interface Attributes {
  str: number;
  agi: number;
  tou: number;
  end: number;
  wil: number;
  wit: number;
  cha: number;
}

export interface Skills {
  level: Uint8Array;
  xp: Uint16Array;
  lastRaised: Idx<'SkillDef'>;
}

export interface Needs {
  hunger: number;
  thirst: number;
  rest: number;
  social: number;
  comfort: number;
  purpose: number;
  joy: number;
}

export interface Personality {
  traits: [Idx<'TraitDef'>, Idx<'TraitDef'>, Idx<'TraitDef'>];
}

export interface Schedule {
  sleepStartHour: number;
  sleepHours: number;
}

export interface Relationships {
  friends: EntityId[];
  grudges: { id: EntityId; untilTick: Tick }[];
  talkCount: [EntityId, number][];
  spouse: EntityId;
  pets: EntityId[];
}

export interface Title {
  title: 'none' | 'thane' | 'warden' | 'broker' | 'chief_medic';
}

export interface Brain {
  behavior: 'flee' | 'retreat' | 'patient' | 'need' | 'duty' | 'work' | 'social' | 'idle';
  behaviorUntil: Tick;
  targetTile: TileIndex;
  activity: string;
  lastMistTick: Tick;
  lastOutdoorThoughtHour: number;
  daysUnderground: number;
}

export interface Labors {
  /** Bitset over labor indices. */
  enabled: Uint8Array;
}

export interface Worker {
  jobId: number;
  phase: number;
  carrying: EntityId;
  toolId: EntityId;
}

export interface ActiveThought {
  thought: Idx<'ThoughtDef'>;
  startTick: Tick;
  baseValue: number;
}

export interface Mood {
  value: number;
  tier: MoodTier;
  thoughts: ActiveThought[];
  sulkCounterDays: number;
}

export interface Equipment {
  weapon: EntityId;
  shield: EntityId;
  armor: Record<'head' | 'body' | 'arms' | 'legs' | 'feet', EntityId>;
  clothing: Record<'body' | 'legs' | 'feet' | 'over', EntityId>;
  quiver: EntityId;
}

export interface Soldier {
  squadId: EntityId;
  onDuty: boolean;
  stance: 'hold' | 'pursue';
  targetId: EntityId;
  cooldownUntil: Tick;
  lastShiftTick: Tick;
}

export interface Patient {
  hospitalZoneId: EntityId;
  bedId: EntityId;
  /** Job kinds. */
  needs: string[];
  admittedTick: Tick;
}

/** `components.md` § ItemFlag. */
export enum ItemFlag {
  Forbidden = 1,
  Dump = 2,
  Melt = 4,
  Reserved = 8,
  Owned = 16,
  AtDepot = 32,
  Merchant = 64,
  /** Superset (D-074): linked to a built piece of furniture (`Building.itemId`); out of every search and count of available stock. */
  Installed = 128,
  /** D-219: created outside fortress possession; retained until actual loot recovery. */
  Foreign = 256,
}

export interface Item {
  type: Idx<'ItemTypeDef'>;
  material: Idx<'MaterialDef'>;
  quality: Quality;
  wear: number;
  count: number;
  containerId: EntityId;
  ownerId: EntityId;
  flags: number;
  crafterId: EntityId;
  rotStart: Tick;
  rotStage: 0 | 1 | 2 | 3;
  /** jobId */
  reservedBy: number;
  carriedBy: EntityId;
  /** Creature held by a cage item (19); 0 or absent for an empty cage. */
  occupantId?: EntityId;
  /** The named dead dwarf engraved on a memorial slab. */
  memorialDwarfId?: EntityId;
}

export interface Container {
  contents: EntityId[];
  capacity: number;
  /** `wagon` is the embark wagon's own container (a building; D-074). */
  classId: 'barrel' | 'bag' | 'bin' | 'chest' | 'bucket' | 'cage' | 'wagon';
}

export interface Corpse {
  species: Idx<'SpeciesDef'>;
  diedTick: Tick;
  wornItems: EntityId[];
  dwarfName: string | null;
  /** 13 § Corpses: creature size in weight units. */
  weight?: number;
  /** Whether a slaughtered animal had not reached adulthood (08 § Breeding). */
  juvenile?: boolean;
  /** A slab has resolved grief for these remains. */
  memorialized?: boolean;
}

export interface Building {
  type: Idx<'BuildingDef'>;
  material: Idx<'MaterialDef'>;
  state: 'planned' | 'constructing' | 'built';
  origin: TileIndex;
  footprint: TileIndex[];
  orientation: 0 | 1 | 2 | 3;
  itemId: EntityId;
  /** Door mode, hatch mode, trap mode. */
  mode: string;
  linkedIds: EntityId[];
  ownerId: EntityId;
  settings: Record<string, unknown>;
  /** Bridge raised, floodgate open, lever on. */
  toggled: boolean;
}

export interface WorkOrder {
  recipe: Idx<'RecipeDef'>;
  remaining: number;
  mode: 'once' | 'maintain';
  threshold: number;
  priority: Priority;
  materialFilter: Idx<'MaterialDef'> | string | null;
  /** Named dead dwarf for `make_memorial_slab`. */
  memorialDwarfId?: EntityId;
}

export interface Workshop {
  orders: WorkOrder[];
  currentJobId: number;
  suspended: boolean;
  assignedWorker: EntityId;
  magmaPowered: boolean;
  lastBlockedReason: string | null;
}

export interface Zone {
  type: Idx<'ZoneTypeDef'>;
  /** Sorted. */
  tiles: TileIndex[];
  settings: Record<string, unknown>;
}

export interface StockpileFilter {
  categories: string[];
  materialClasses: string[] | 'any';
  minQuality: Quality;
  maxQuality: Quality;
  allowRot: boolean;
}

export interface Stockpile {
  filter: StockpileFilter;
  containersWanted: { barrel: number; bag: number; bin: number };
  priority: Priority;
  linkedSources: EntityId[];
}

export interface Room {
  zoneId: EntityId;
  score: number;
  tier: RoomTier;
  ownerId: EntityId;
  enclosed: boolean;
  requirementsMet: boolean;
}

export type SquadOrder =
  | { kind: 'kill'; targetId: EntityId }
  | { kind: 'station'; tile: TileIndex }
  | { kind: 'patrol'; tiles: TileIndex[] }
  | { kind: 'follow'; dwarfId: EntityId };

export interface Squad {
  name: string;
  leaderId: EntityId;
  members: EntityId[];
  mode: 'off' | 'train' | 'active';
  station: TileIndex | null;
  patrol: TileIndex[] | null;
  equipment: { weaponClass: string | 'any'; armor: 'metal' | 'leather' | 'any'; ranged: boolean };
  orders: SquadOrder[];
  barracksZoneId: EntityId;
}

export interface Party {
  civ: string;
  purpose: 'thief' | 'bandits' | 'ambush' | 'raid' | 'siege' | 'restless' | 'caravan';
  members: EntityId[];
  leaderId: EntityId;
  state: string;
  goalTile: TileIndex;
  goalEntity: EntityId;
  arrivedTick: Tick;
  stateSince: Tick;
  loot: EntityId[];
  edge: 'n' | 'e' | 's' | 'w';
  size: number;
  outcome?: string;
  despawnedCount?: number;
  /** Number of loot escapes actually emitted; missing in older saves means zero. */
  escapedLootCount?: number;
  goalUnreachable?: boolean;
  walkUnreachable?: boolean;
}

export interface Hostile {
  partyId: EntityId;
  role: string;
  behaviorState: string;
  stealthed: boolean;
  spotted: boolean;
  breakingDoorId: EntityId;
  breakingSince: Tick;
}

export interface Tame {
  pastureId: EntityId;
  condition: number;
  trained: 'none' | 'war' | 'hunting';
  assignedTo: EntityId;
  pregnantUntil: Tick;
  lastProductTick: Record<string, Tick>;
  juvenileUntil: Tick;
  slaughter: boolean;
  petOf: EntityId;
  noBreed: boolean;
}

export interface Wild {
  state: string;
  homeChunk: number;
  stateUntil: Tick;
  hungry: boolean;
  lastThinkTick: Tick;
  arrivedTick: Tick;
}

export interface Projectile {
  itemId: EntityId;
  from: TileIndex;
  to: TileIndex;
  progress: Fixed;
  shooterId: EntityId;
  targetId: EntityId;
  hitRoll: number;
  damage: number;
  damageType: DamageType;
  line: TileIndex[];
  skipXp?: boolean | undefined;
}

export interface Crop {
  plotZoneId: EntityId;
  plant: Idx<'PlantDef'>;
  stage: 0 | 1 | 2 | 3;
  growth: number;
  tile: TileIndex;
}

export interface Merchant {
  partyId: EntityId;
  goods: EntityId[];
}

/**
 * `Kind` is a component in the ownership table; the store keeps it in its own slot table
 * (`EntityStore.create(kind)` / `EntityStore.kind(id)`), so its component value is just the tag.
 */
export interface Kind {
  kind: string;
}

/** Fortress-level state, `components.md` § Fortress state. */
export interface FortressState {
  name: string;
  embarkTick: Tick;
  regionId: number;
  wealthCached: number;
  populationCached: number;
  hallSpiritCached: number;
  alert: Alert;
  deepPressure: number;
  deepLevel: number;
  reputation: Record<string, number>;
  populationCap: number;
  milestones: { id: string; tick: Tick }[];
  hintsShown: string[];
  deepsilverConfirmed: boolean;
}

// ---------- structure-of-arrays stores for the hot components ----------

/** `components.md`: "SoA: Int16Array x, y; Int8Array z". */
class PositionStore extends SoaComponentStore<Position> {
  private declare xs: Int16Array;
  private declare ys: Int16Array;
  private declare zs: Int8Array;

  protected override allocate(capacity: number): void {
    this.xs = growInt16(this.xs, capacity);
    this.ys = growInt16(this.ys, capacity);
    this.zs = growInt8(this.zs, capacity);
  }

  protected override readField(index: number): Position {
    return { x: this.xs[index] as number, y: this.ys[index] as number, z: this.zs[index] as number };
  }

  protected override writeField(index: number, value: Position): void {
    this.xs[index] = value.x;
    this.ys[index] = value.y;
    this.zs[index] = value.z;
  }

  protected override clearField(index: number): void {
    this.xs[index] = 0;
    this.ys[index] = 0;
    this.zs[index] = 0;
  }

  /** Field access without materialising a `Position`. */
  xAt(index: number): number {
    return this.xs[index] as number;
  }

  yAt(index: number): number {
    return this.ys[index] as number;
  }

  zAt(index: number): number {
    return this.zs[index] as number;
  }
}

/** The movement classes in code order; the SoA store keeps the code, not the string. */
export const MOVEMENT_CLASSES: readonly MovementClass[] = [
  'walker',
  'small',
  'large',
  'aquatic',
  'amphibious',
];

export function movementClassCode(mc: MovementClass): number {
  const i = MOVEMENT_CLASSES.indexOf(mc);
  if (i < 0) throw new RangeError(`unknown movement class: ${mc}`);
  return i;
}

class MotionStore extends SoaComponentStore<Motion> {
  private declare pathIds: Int32Array;
  private declare stepIndexes: Int32Array;
  private declare progresses: Int32Array;
  private declare speeds: Int32Array;
  private declare classes: Uint8Array;
  private declare repaths: Uint16Array;
  private declare waits: Int32Array;

  protected override allocate(capacity: number): void {
    this.pathIds = growInt32(this.pathIds, capacity);
    this.stepIndexes = growInt32(this.stepIndexes, capacity);
    this.progresses = growInt32(this.progresses, capacity);
    this.speeds = growInt32(this.speeds, capacity);
    this.classes = growUint8(this.classes, capacity);
    this.repaths = growUint16(this.repaths, capacity);
    this.waits = growInt32(this.waits, capacity);
  }

  protected override readField(index: number): Motion {
    return {
      pathId: this.pathIds[index] as number,
      stepIndex: this.stepIndexes[index] as number,
      progress: this.progresses[index] as number,
      speed: this.speeds[index] as number,
      movementClass: MOVEMENT_CLASSES[this.classes[index] as number] as MovementClass,
      repathCount: this.repaths[index] as number,
      waitUntil: this.waits[index] as number,
    };
  }

  protected override writeField(index: number, value: Motion): void {
    this.pathIds[index] = value.pathId;
    this.stepIndexes[index] = value.stepIndex;
    this.progresses[index] = value.progress;
    this.speeds[index] = value.speed;
    this.classes[index] = movementClassCode(value.movementClass);
    this.repaths[index] = value.repathCount;
    this.waits[index] = value.waitUntil;
  }

  protected override clearField(index: number): void {
    this.pathIds[index] = 0;
    this.stepIndexes[index] = 0;
    this.progresses[index] = 0;
    this.speeds[index] = 0;
    this.classes[index] = 0;
    this.repaths[index] = 0;
    this.waits[index] = 0;
  }
}

// ---------- the registry ----------

interface Spec {
  name: string;
  owner: string;
  ownerNote?: string;
  alsoWrittenBy?: string[];
  storage?: 'soa' | 'map';
  make?: () => ComponentStore<unknown>;
}

const SPECS: Spec[] = [
  { name: 'Kind', owner: 'core', alsoWrittenBy: ['spawn API', 'movement helper'] },
  {
    name: 'Position',
    owner: 'core',
    alsoWrittenBy: ['spawn API', 'movement helper'],
    storage: 'soa',
    make: () => new PositionStore() as ComponentStore<unknown>,
  },
  {
    name: 'Motion',
    owner: '22',
    alsoWrittenBy: ['brains set `speed` through `pathing.setSpeed`'],
    storage: 'soa',
    make: () => new MotionStore() as ComponentStore<unknown>,
  },
  { name: 'Creature', owner: 'spawner', alsoWrittenBy: ['10 (name', 'age)', '21'] },
  { name: 'Body', owner: '17' },
  { name: 'Patient', owner: '17' },
  { name: 'Attributes', owner: '10', alsoWrittenBy: ['02 and 21 at creation through the spawn API'] },
  { name: 'Skills', owner: '10', alsoWrittenBy: ['02 and 21 at creation through the spawn API'] },
  { name: 'Needs', owner: '10', alsoWrittenBy: ['02 and 21 at creation through the spawn API'] },
  { name: 'Personality', owner: '10', alsoWrittenBy: ['02 and 21 at creation through the spawn API'] },
  { name: 'Schedule', owner: '10', alsoWrittenBy: ['02 and 21 at creation through the spawn API'] },
  { name: 'Relationships', owner: '10', alsoWrittenBy: ['02 and 21 at creation through the spawn API'] },
  { name: 'Title', owner: '10', alsoWrittenBy: ['02 and 21 at creation through the spawn API'] },
  { name: 'Brain', owner: '10', alsoWrittenBy: ['02 and 21 at creation through the spawn API'] },
  { name: 'Labors', owner: '11' },
  { name: 'Worker', owner: '11' },
  { name: 'Mood', owner: '15' },
  { name: 'Equipment', owner: '16', alsoWrittenBy: ["09 sets the hunter's quiver through 16's API"] },
  { name: 'Soldier', owner: '16', alsoWrittenBy: ["09 sets the hunter's quiver through 16's API"] },
  { name: 'Squad', owner: '16', alsoWrittenBy: ["09 sets the hunter's quiver through 16's API"] },
  { name: 'Projectile', owner: '16', alsoWrittenBy: ["09 sets the hunter's quiver through 16's API"] },
  { name: 'Item', owner: '13', alsoWrittenBy: ['flags through the item API'] },
  { name: 'Container', owner: '13', alsoWrittenBy: ['flags through the item API'] },
  { name: 'Corpse', owner: '13', alsoWrittenBy: ['flags through the item API'] },
  { name: 'Stockpile', owner: '13', alsoWrittenBy: ['flags through the item API'] },
  {
    name: 'Building',
    owner: '14',
    alsoWrittenBy: ["`toggled` and `mode` through 14's commands and `MechanismTriggered`"],
  },
  {
    name: 'Zone',
    owner: '14',
    alsoWrittenBy: ["`toggled` and `mode` through 14's commands and `MechanismTriggered`"],
  },
  {
    name: 'Room',
    owner: '14',
    alsoWrittenBy: ["`toggled` and `mode` through 14's commands and `MechanismTriggered`"],
  },
  { name: 'Workshop', owner: '12' },
  { name: 'Party', owner: '18', ownerNote: 'caravan parties: 20' },
  { name: 'Hostile', owner: '18', ownerNote: 'caravan parties: 20' },
  { name: 'Tame', owner: '08' },
  { name: 'Wild', owner: '08' },
  { name: 'Crop', owner: '07' },
  { name: 'Merchant', owner: '20' },
];

function define<T>(spec: Spec, id: number): ComponentType<T> {
  const make = spec.make ?? ((): ComponentStore<unknown> => new MapComponentStore<unknown>());
  return {
    name: spec.name,
    id,
    owner: spec.owner,
    ownerNote: spec.ownerNote ?? '',
    alsoWrittenBy: Object.freeze(spec.alsoWrittenBy ?? []),
    storage: spec.storage ?? 'map',
    makeStore: make as () => ComponentStore<T>,
  };
}

/** Every component type, in declaration order; the array index is the component id. */
export const COMPONENT_TYPES: readonly ComponentType<unknown>[] = Object.freeze(
  SPECS.map((spec, id) => define<unknown>(spec, id)),
);

function typed<T>(name: string): ComponentType<T> {
  const found = COMPONENT_TYPES.find((t) => t.name === name);
  if (found === undefined) throw new RangeError(`no component type named ${name}`);
  return found as ComponentType<T>;
}

export const C = {
  Kind: typed<Kind>('Kind'),
  Position: typed<Position>('Position'),
  Motion: typed<Motion>('Motion'),
  Creature: typed<Creature>('Creature'),
  Body: typed<Body>('Body'),
  Patient: typed<Patient>('Patient'),
  Attributes: typed<Attributes>('Attributes'),
  Skills: typed<Skills>('Skills'),
  Needs: typed<Needs>('Needs'),
  Personality: typed<Personality>('Personality'),
  Schedule: typed<Schedule>('Schedule'),
  Relationships: typed<Relationships>('Relationships'),
  Title: typed<Title>('Title'),
  Brain: typed<Brain>('Brain'),
  Labors: typed<Labors>('Labors'),
  Worker: typed<Worker>('Worker'),
  Mood: typed<Mood>('Mood'),
  Equipment: typed<Equipment>('Equipment'),
  Soldier: typed<Soldier>('Soldier'),
  Squad: typed<Squad>('Squad'),
  Projectile: typed<Projectile>('Projectile'),
  Item: typed<Item>('Item'),
  Container: typed<Container>('Container'),
  Corpse: typed<Corpse>('Corpse'),
  Stockpile: typed<Stockpile>('Stockpile'),
  Building: typed<Building>('Building'),
  Zone: typed<Zone>('Zone'),
  Room: typed<Room>('Room'),
  Workshop: typed<Workshop>('Workshop'),
  Party: typed<Party>('Party'),
  Hostile: typed<Hostile>('Hostile'),
  Tame: typed<Tame>('Tame'),
  Wild: typed<Wild>('Wild'),
  Crop: typed<Crop>('Crop'),
  Merchant: typed<Merchant>('Merchant'),
} as const;

/** An entity store that knows every component type. `entities.ts` stays free of this module. */
export function createEntityStore(): EntityStore {
  return new EntityStore(COMPONENT_TYPES);
}
