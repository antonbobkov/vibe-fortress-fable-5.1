/** T-176: the audit field sweep and 40 deterministic random trials per command. */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { Registrations, type TickContext } from '@core/system';
import { spawnCaravan, type TradeSystem } from '@systems/trade';
import { COMMAND_TYPES, COMMAND_OWNERS, REJECT_REASONS } from '@core/command-types';
import type { Command, CommandResult } from '@core/commands';
import { roundTrip } from '@app/game-save';
import type { HeadlessGame } from '@app/headless';
import { TileFlag, TileKind } from '@core/map3d';
import { stageLength } from '@systems/plants/growth';
import type { PlantRow } from '@systems/plants';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../scenarios/test-world';
import { prepareBusyFortress } from '../scenarios/core_save_roundtrip.scenario';
import { checkInvariants } from '../scenarios/invariants';

const N = 40;
const Z = 32;

function completeTargets(w: TestWorld): void {
  const entities = w.game.world.entities;
  const buildings = w.readers.of<BuildingsReader>('14');
  const lever = buildings.byType('lever')[0]!;
  const door = buildings.byType('door')[0]!;
  expect(
    w.game.world.applyCommand({ type: 'LinkMechanism', sourceId: lever, targetId: door }),
  ).toEqual({ ok: true });
  w.setLabor(w.game.world.entities.with(C.Labors)[0]!, 'mechanics', true);
  w.until(() => buildings.get(lever)?.linkedIds.includes(door) === true, 3000);
  const crop = w.plantCrop(w.index(20, 70, Z), 'barley', 3);
  const data = entities.get(crop, C.Crop)!;
  const plant = w.game.registry.table<PlantRow>('plants').byId('barley')!;
  entities.add(crop, C.Crop, { ...data, growth: stageLength(plant) });
  const cage = w.spawnItem('cage', 'iron', w.index(62, 70, Z));
  const boar = w.spawnCreature('boar', w.index(62, 71, Z), 'wild');
  const creature = entities.get(boar, C.Creature)!;
  entities.remove(boar, C.Position);
  entities.add(boar, C.Creature, { ...creature, cagedIn: cage });
  w.game.world.services.items!.setOccupant!(cage, boar);
  w.game.world.emit({ type: 'CreatureCaged', creatureId: boar, cageItemId: cage });
  const cageBuilding = w.build('cage_building', w.index(80, 70, Z), 'iron');
  const fox = w.spawnCreature('fox', w.index(81, 71, Z), 'wild');
  const foxCreature = entities.get(fox, C.Creature)!;
  entities.remove(fox, C.Position);
  entities.add(fox, C.Creature, { ...foxCreature, cagedIn: cageBuilding });
  const building = entities.get(cageBuilding, C.Building)!;
  entities.add(cageBuilding, C.Building, {
    ...building,
    settings: { ...building.settings, occupantId: fox },
  });
}

const previouslyUnaccepted = [
  'DesignateHarvest',
  'AssignPasture',
  'TameCaged',
  'ReleaseCaged',
  'UnlinkMechanism',
  'SetHatchMode',
  'ReleaseCage',
  'AssignCoffin',
  'SetTrapMode',
] as const;

function validTarget(game: HeadlessGame, type: string): Command | null {
  const e = game.world.entities;
  const b = game.world.readers.of<BuildingsReader>('14');
  const dwarf = e.with(C.Labors)[0]!;
  const animal = e
    .with(C.Tame)
    .find((id) => game.registry.table('creatures').idOf(e.get(id, C.Creature)!.species) === 'cow')!;
  const cage = e.with(C.Item).find((id) => (e.get(id, C.Item)?.occupantId ?? 0) !== 0)!;
  const ready = e.with(C.Crop).find((id) => e.get(id, C.Crop)?.stage === 3)!;
  switch (type) {
    case 'DesignateHarvest':
      return { type, tiles: [e.get(ready, C.Crop)!.tile] };
    case 'AssignPasture':
      return {
        type,
        animalId: animal,
        zoneId: e.with(C.Zone).find((id) => e.get(id, C.Zone)?.type === game.registry.table('zoneTypes').index('pasture')),
      };
    case 'TameCaged':
      return { type, cageId: cage };
    case 'ReleaseCaged':
      return { type, cageId: cage };
    case 'UnlinkMechanism':
      return { type, sourceId: b.byType('lever')[0], targetId: b.byType('door')[0] };
    case 'SetHatchMode':
      return { type, buildingId: b.byType('hatch')[0], mode: 'open' };
    case 'ReleaseCage':
      return { type, cageBuildingId: b.byType('cage_building')[0] };
    case 'AssignCoffin':
      return { type, coffinId: b.byType('coffin')[0], dwarfId: dwarf };
    case 'SetTrapMode':
      return { type, trapId: b.byType('stone_fall_trap')[0], mode: 'all' };
    default:
      return null;
  }
}

const FIELDS: Record<string, string[]> = {
  '03': ['tiles', 'kind', 'priority', 'mode', 'x', 'y', 'zTop', 'zBottom'],
  '07': ['zoneId', 'season', 'speciesId', 'tiles'],
  '08': [
    'animalId',
    'zoneId',
    'kind',
    'cageId',
    'dwarfId',
    'chainId',
    'squadId',
    'species',
    'cap',
    'name',
  ],
  '09': ['species', 'on'],
  '10': ['dwarfId', 'title', 'name', 'sleepStartHour'],
  '11': ['dwarfId', 'labor', 'on', 'priority', 'jobId', 'name'],
  '12': ['workshopId', 'order', 'index', 'patch', 'to', 'from', 'dwarfId', 'on'],
  '13': [
    'itemId',
    'tiles',
    'typeId',
    'on',
    'zoneId',
    'filter',
    'wants',
    'priority',
    'sourceZoneId',
  ],
  '14': [
    'buildingType',
    'origin',
    'orientation',
    'materialChoice',
    'priority',
    'width',
    'height',
    'buildingId',
    'zoneType',
    'tiles',
    'zoneId',
    'key',
    'value',
    'dwarfId',
    'sourceId',
    'targetId',
    'mode',
    'plateId',
    'trigger',
    'cageBuildingId',
    'coffinId',
  ],
  '16': [
    'name',
    'squadId',
    'members',
    'leaderId',
    'mode',
    'equipment',
    'tile',
    'tiles',
    'order',
    'level',
  ],
  '17': ['zoneId', 'wants'],
  '19': ['trapId', 'mode', 'leverId'],
  '20': ['itemIds', 'depotId', 'give', 'take', 'civ', 'entries'],
  '21': ['n'],
  core: ['name'],
};
/** The documented fields of each command, so the single-field sweep starts from the right shape. */
const OWN: Record<string, string[]> = {
  Designate: ['tiles', 'kind', 'priority'],
  UndoDesignation: ['tiles'],
  SetDesignationPriority: ['tiles', 'priority'],
  SetTraffic: ['tiles', 'mode'],
  DesignateStairwell: ['x', 'y', 'zTop', 'zBottom'],
  DesignateHarvest: ['tiles'],
  ConfirmDeepsilver: [],
  SetPlotCrop: ['zoneId', 'season', 'speciesId'],
  AssignPasture: ['animalId', 'zoneId'],
  MarkSlaughter: ['animalId'],
  UnmarkSlaughter: ['animalId'],
  TrainAnimal: ['animalId', 'kind'],
  TameCaged: ['cageId'],
  AssignAnimal: ['animalId', 'dwarfId', 'chainId', 'squadId'],
  SetBreedingCap: ['species', 'cap'],
  ReleaseCaged: ['cageId'],
  SetHuntable: ['species', 'on'],
  SetLabor: ['dwarfId', 'labor', 'on'],
  SetLaborPriority: ['labor', 'priority'],
  CancelJob: ['jobId'],
  SetJobPriority: ['jobId', 'priority'],
  SetStandingOrder: ['name', 'on'],
  AssignTitle: ['dwarfId', 'title'],
  RenameDwarf: ['dwarfId', 'name'],
  SetSchedule: ['dwarfId', 'sleepStartHour'],
  AddWorkOrder: ['workshopId', 'order'],
  EditWorkOrder: ['workshopId', 'index', 'patch'],
  RemoveWorkOrder: ['workshopId', 'index'],
  ReorderWorkOrder: ['workshopId', 'index', 'to', 'from'],
  SetWorkshopWorker: ['workshopId', 'dwarfId'],
  SuspendWorkshop: ['workshopId', 'on'],
  ForbidItem: ['itemId', 'tiles', 'typeId', 'on'],
  ClaimItem: ['itemId', 'tiles', 'typeId', 'on'],
  DumpItem: ['itemId', 'tiles', 'typeId', 'on'],
  MeltItem: ['itemId', 'tiles', 'typeId', 'on'],
  SetStockpileFilter: ['zoneId', 'filter'],
  SetStockpileContainers: ['zoneId', 'wants'],
  SetStockpilePriority: ['zoneId', 'priority'],
  LinkStockpile: ['zoneId', 'sourceZoneId', 'on'],
  PlaceBuilding: [
    'buildingType',
    'origin',
    'orientation',
    'materialChoice',
    'priority',
    'width',
    'height',
  ],
  CancelBuilding: ['buildingId'],
  DeconstructBuilding: ['buildingId'],
  SetBuildingPriority: ['buildingId', 'priority'],
  CreateZone: ['zoneType', 'tiles'],
  ResizeZone: ['zoneId', 'tiles'],
  RemoveZone: ['zoneId'],
  SetZoneSetting: ['zoneId', 'key', 'value'],
  AssignRoom: ['zoneId', 'dwarfId'],
  LinkMechanism: ['sourceId', 'targetId'],
  UnlinkMechanism: ['sourceId', 'targetId'],
  SetDoorMode: ['buildingId', 'mode'],
  SetHatchMode: ['buildingId', 'mode'],
  SetPlateTrigger: ['plateId', 'trigger'],
  ReleaseCage: ['cageBuildingId'],
  AssignCoffin: ['coffinId', 'dwarfId'],
  CreateSquad: ['name'],
  DisbandSquad: ['squadId'],
  SetSquadMembers: ['squadId', 'members'],
  SetSquadLeader: ['squadId', 'leaderId'],
  SetSquadMode: ['squadId', 'mode'],
  SetSquadEquipment: ['squadId', 'equipment'],
  SetSquadStation: ['squadId', 'tile'],
  SetSquadPatrol: ['squadId', 'tiles'],
  SquadOrder: ['squadId', 'order'],
  SetAlert: ['level'],
  SetHospitalSupplies: ['zoneId', 'wants'],
  SetTrapMode: ['trapId', 'mode'],
  PullLever: ['leverId'],
  MoveToDepot: ['itemIds'],
  RemoveFromDepot: ['itemIds'],
  TradeOpen: ['depotId'],
  TradeOffer: ['give', 'take'],
  TradeCancel: [],
  SetRequests: ['civ', 'entries'],
  SetPopulationCap: ['n'],
  NameAnimal: ['animalId', 'name'],
  RenameSquad: ['squadId', 'name'],
  RenameFortress: ['name'],
};

let seed = 987654321;
const rnd = (): number => {
  seed ^= seed << 13;
  seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed >>>= 0;
  return seed / 0x100000000;
};
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;

function buildWorld(): TestWorld {
  const w = new TestWorld({ seed: 't176-fuzz', world: 'flat-test', embark: 'default' });
  prepareBusyFortress(w);
  w.zone('farm_plot', [w.index(20, 70, Z), w.index(21, 70, Z)]);
  const grass = [w.index(24, 70, Z), w.index(25, 70, Z)];
  for (const tile of grass) w.map.setFlag(tile, TileFlag.Grass, true);
  w.zone('pasture', grass);
  w.spawnTame('cow', w.index(24, 71, Z));
  w.spawnTame('dog', w.index(26, 71, Z));
  for (const [type, x, y, material] of [
    ['carpenter', 15, 15, 'oak'],
    ['forge', 15, 22, 'granite'],
    ['kennel', 15, 29, 'oak'],
    ['stone_fall_trap', 65, 65, 'granite'],
    ['cage_trap', 63, 65, 'iron'],
    ['lever', 67, 65, 'granite'],
    ['pressure_plate', 69, 65, 'granite'],
    ['wall', 71, 64, 'granite'],
    ['wall', 71, 66, 'granite'],
    ['door', 71, 65, 'granite'],
    ['coffin', 75, 65, 'granite'],
    ['chain_post', 77, 65, 'granite'],
    ['bed', 60, 70, 'pine'],
    ['trade_depot', 45, 8, 'granite'],
  ] as const)
    w.build(type, w.index(x, y, Z), material);
  w.game.world.services.terrain.setKind(
    w.index(73, 65, Z),
    TileKind.StairsDown,
    w.map.materialAt(w.index(73, 65, Z)),
  );
  w.build('hatch', w.index(73, 65, Z), 'granite');
  w.zone('bedroom', [w.index(60, 70, Z), w.index(61, 70, Z)]);
  w.zone('hospital', [w.index(70, 70, Z)]);
  w.zone('dump', [w.index(72, 70, Z)]);
  w.zone('barracks', [w.index(74, 70, Z), w.index(75, 70, Z)]);
  w.spawnItem('axe', 'iron', w.index(18, 17, Z));
  w.spawnItem('bar', 'iron', w.index(19, 17, Z), 10);
  w.spawnItem('mechanism', 'granite', w.index(20, 17, Z), 4);
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Fuzz Guard' })).toEqual({
    ok: true,
  });
  const dwarves = w.game.world.entities.with(C.Labors);
  expect(
    w.game.world.applyCommand({
      type: 'SetSquadMembers',
      squadId: w.game.world.entities.with(C.Squad)[0],
      members: dwarves.slice(0, 2),
    }),
  ).toEqual({ ok: true });
  expect(
    w.game.world.applyCommand({ type: 'AssignTitle', dwarfId: dwarves[2], title: 'broker' }),
  ).toEqual({ ok: true });
  for (const workshopId of w.game.world.entities.with(C.Workshop))
    for (const recipe of ['make_bed', 'make_barrel', 'forge_battle_axe', 'forge_pick'])
      w.game.world.applyCommand({
        type: 'AddWorkOrder',
        workshopId,
        order: { recipeId: recipe, mode: 'once', remaining: 2, threshold: 0, priority: 5 },
      });
  const ctx: TickContext = {
    world: w.game.world,
    registry: w.game.registry,
    readers: w.readers,
    tick: w.tick,
    rng: w.game.world.rngFor('20'),
    register: new Registrations(),
    terrain: w.game.world.services.terrain,
    jobs: w.game.world.services.jobs,
    spawn: w.game.world.services.spawn,
    emit: (e) => w.game.world.emit(e),
  };
  const caravan = spawnCaravan(ctx, 'wildwood', 'n', 0, false, 50, [], ctx.rng);
  caravan.state = 'atDepot';
  caravan.depotId = w.readers.of<BuildingsReader>('14').depots()[0]!;
  const trade = w.game.world.scheduler.byId('20') as TradeSystem;
  trade.deserialize({ ...trade.serialize(), activeCaravan: caravan }, ctx);
  completeTargets(w);
  w.step(2);
  return w;
}

interface Pools {
  goodCount: Record<string, number>;
  ids: unknown[];
  tiles: unknown[];
  tileLists: unknown[];
  byField: Record<string, unknown[]>;
  garbage: unknown[];
}

function pools(game: HeadlessGame): Pools {
  const e = game.world.entities;
  const map = game.map;
  const reg = game.registry;
  const ids = (name: string): string[] => [...reg.table(name).ids()];
  const firstN = (xs: number[], n = 3): number[] => xs.slice(0, n);
  const dead = game.world.services.spawn.item(
    reg.table('items').index('raw_stone'),
    reg.table('materials').index('granite'),
    map.index(30, 40, Z),
    1,
    1,
  );
  (game.world.services.items as unknown as { destroy(id: number, reason: string): void }).destroy(
    dead,
    'test',
  );
  const jobs = game.world.readers
    .of<{ list(): { id: number }[] }>('11')
    .list()
    .map((j) => j.id);
  const real: number[] = [
    ...firstN(e.with(C.Labors), 4),
    ...firstN(e.with(C.Tame), 3),
    ...firstN(e.with(C.Hostile), 2),
    ...firstN(e.with(C.Item), 4),
    ...firstN(e.with(C.Container), 2),
    ...e.with(C.Building),
    ...e.with(C.Zone),
    ...e.with(C.Squad),
    ...firstN(e.with(C.Party), 2),
    ...firstN(e.with(C.Merchant), 2),
    ...firstN(jobs, 4),
    ...firstN(jobs.slice(-3), 3),
    ...firstN(
      e.with(C.Item).filter((id) => ((e.get(id, C.Item)?.flags ?? 0) & 64) !== 0),
      3,
    ),
  ];
  const badIds: unknown[] = [
    0,
    -1,
    1,
    2 ** 31 - 1,
    2 ** 32,
    16777216 + 999999,
    dead,
    NaN,
    Infinity,
    1.5,
    '5',
    null,
    undefined,
    {},
    [],
    true,
    'x',
  ];
  const t = (x: number, y: number, z: number): number => map.index(x, y, z);
  const goodTiles = [
    t(30, 30, Z),
    t(31, 30, Z),
    t(50, 50, Z),
    t(60, 70, Z),
    t(45, 8, Z),
    t(24, 70, Z),
    t(0, 0, Z),
    t(95, 95, Z),
    t(40, 40, Z - 1),
    t(40, 40, 5),
    t(40, 40, Z + 1),
    t(40, 40, 63),
    t(40, 40, 0),
  ];
  const badTiles: unknown[] = [
    -1,
    map.tileCount,
    map.tileCount + 5,
    1e12,
    NaN,
    Infinity,
    1.5,
    '7',
    null,
    undefined,
    {},
    [],
    true,
  ];
  const big: number[] = [];
  for (let k = 0; k < 60000; k += 1) big.push(t(k % 96, Math.floor(k / 96) % 96, Z));
  const tileLists: unknown[] = [
    [],
    [goodTiles[0]],
    goodTiles.slice(0, 4),
    [goodTiles[0], goodTiles[0], goodTiles[0]],
    [-1],
    [map.tileCount],
    [NaN],
    [1.5],
    ['a'],
    [null],
    [goodTiles[0], -1],
    [goodTiles[0], map.tileCount + 1],
    big,
    'tiles',
    7,
    null,
    undefined,
    {},
    { length: 3 },
    [[1, 2]],
    goodTiles.slice(8, 13),
    [t(40, 40, Z - 1), t(41, 40, Z - 1)],
  ];
  const numbers: unknown[] = [
    -1,
    0,
    1,
    2,
    3,
    4,
    5,
    9,
    10,
    23,
    24,
    63,
    64,
    95,
    96,
    100,
    200,
    201,
    999,
    1000,
    1e9,
    -1e9,
    NaN,
    Infinity,
    -Infinity,
    1.5,
    '3',
    null,
    undefined,
    true,
    {},
    [],
  ];
  const strings: unknown[] = [
    '',
    'x',
    '__proto__',
    'constructor',
    'toString',
    'hasOwnProperty',
    'a'.repeat(24),
    'a'.repeat(25),
    'a'.repeat(32),
    'a'.repeat(33),
    'a'.repeat(10000),
    ' ',
    '\n',
    '\u0000',
    '🙂'.repeat(20),
    0,
    1,
    null,
    undefined,
    {},
    [],
    true,
  ];
  const bools: unknown[] = [true, false, 0, 1, 'true', 'false', null, undefined, {}];
  const idPool = [...real, ...badIds];
  const bt = reg.table<{ id: string }>('buildings');
  const allB = e.with(C.Building);
  const ofType = (...names: string[]): number[] =>
    allB.filter((id) => names.includes(bt.byIndex(e.get(id, C.Building)?.type ?? -1)?.id ?? ''));
  const planned = allB.filter((id) => e.get(id, C.Building)?.state !== 'built');
  const front = (xs: number[]): number[] => [...xs, ...allB.filter((b) => !xs.includes(b))];
  const blds = front(planned);
  const idsFor: Record<string, number[]> = {
    zoneId: e.with(C.Zone),
    sourceZoneId: e.with(C.Zone),
    squadId: e.with(C.Squad),
    workshopId: [...e.with(C.Workshop), 0],
    buildingId: [...planned.slice(0, 2), ...ofType('door'), ...ofType('carpenter'), ...blds],
    sourceId: front(ofType('lever', 'pressure_plate')),
    targetId: front(ofType('door', 'cage_trap', 'stone_fall_trap', 'hatch')),
    plateId: front(ofType('pressure_plate')),
    cageBuildingId: front(ofType('cage_trap', 'cage_building')),
    coffinId: front(ofType('coffin')),
    trapId: front(ofType('stone_fall_trap', 'cage_trap')),
    leverId: front(ofType('lever')),
    depotId: front(ofType('trade_depot')),
    chainId: front(ofType('chain_post')),
    cageId: front(ofType('cage_trap', 'cage_building')),
    dwarfId: firstN(e.with(C.Labors), 5),
    leaderId: firstN(e.with(C.Labors), 5),
    animalId: firstN(e.with(C.Tame), 4),
    itemId: firstN(e.with(C.Item), 6),
    jobId: firstN(jobs, 8),
  };
  const recipes = ids('recipes');
  const orders: unknown[] = [
    { recipeId: 'make_bed', mode: 'once', remaining: 1, threshold: 0, priority: 5 },
    { recipeId: 'make_bed', mode: 'maintain', remaining: 0, threshold: 5, priority: 5 },
    { recipeId: 'make_bed', mode: 'once', remaining: 0, priority: 5 },
    { recipeId: 'make_bed', mode: 'once', remaining: 1000, priority: 5 },
    { recipeId: 'make_bed', mode: 'once', remaining: -1, priority: 5 },
    { recipeId: 'make_bed', mode: 'once', remaining: NaN, priority: 5 },
    { recipeId: 'make_bed', mode: 'once', remaining: 1.5, priority: 5 },
    { recipeId: 'make_bed', mode: 'once', remaining: 1, priority: 0 },
    { recipeId: 'make_bed', mode: 'once', remaining: 1, priority: 10 },
    { recipeId: 'make_bed', mode: 'once', remaining: 1, priority: NaN },
    { recipeId: 'make_bed', mode: 'maintain', remaining: 1, threshold: 1000, priority: 5 },
    { recipeId: 'make_bed', mode: 'maintain', remaining: 1, threshold: NaN, priority: 5 },
    { recipeId: 'make_bed', mode: 'forever', remaining: 1, priority: 5 },
    { recipeId: 'nope', mode: 'once', remaining: 1, priority: 5 },
    { recipeId: '__proto__', mode: 'once', remaining: 1, priority: 5 },
    {
      recipeId: 'forge_battle_axe',
      mode: 'once',
      remaining: 1,
      priority: 5,
      materialFilter: 'nope',
    },
    {
      recipeId: 'forge_battle_axe',
      mode: 'once',
      remaining: 1,
      priority: 5,
      materialFilter: 999999,
    },
    { recipeId: 'forge_battle_axe', mode: 'once', remaining: 1, priority: 5, materialFilter: {} },
    {
      recipeId: 'make_memorial_slab',
      mode: 'once',
      remaining: 1,
      priority: 5,
      memorialDwarfId: 12345,
    },
    { recipeId: 'make_bed', mode: 'once', remaining: 1, priority: 5, memorialDwarfId: 1 },
    { recipeId: pick(recipes), mode: 'once', remaining: 999, priority: 1 },
    {},
    null,
    undefined,
    'make_bed',
    5,
    [],
    { recipe: 1 },
    { recipeId: 1, mode: 1, remaining: '3', priority: '5' },
  ];
  const patches: unknown[] = [
    { priority: 3 },
    { priority: 0 },
    { priority: 10 },
    { priority: NaN },
    { remaining: 0 },
    { remaining: -5 },
    { remaining: 1e9 },
    { remaining: NaN },
    { mode: 'maintain' },
    { mode: 'x' },
    { threshold: 0 },
    { threshold: 1e9 },
    { recipeId: 'brew' },
    { recipe: 99999 },
    { materialFilter: 'x' },
    { materialFilter: null },
    {},
    null,
    undefined,
    5,
    'x',
    [],
    { __proto__: { priority: 3 } },
  ];
  const filters: unknown[] = [
    {
      categories: ['stone'],
      materialClasses: 'any',
      minQuality: 0,
      maxQuality: 5,
      allowRot: false,
    },
    { categories: [], materialClasses: 'any', minQuality: 0, maxQuality: 5, allowRot: false },
    { categories: ['nope'], materialClasses: 'any', minQuality: 0, maxQuality: 5, allowRot: false },
    {
      categories: ['stone'],
      materialClasses: ['nope'],
      minQuality: 0,
      maxQuality: 5,
      allowRot: false,
    },
    {
      categories: ['stone'],
      materialClasses: 'any',
      minQuality: 5,
      maxQuality: 0,
      allowRot: false,
    },
    {
      categories: ['stone'],
      materialClasses: 'any',
      minQuality: -1,
      maxQuality: 99,
      allowRot: false,
    },
    {
      categories: ['stone'],
      materialClasses: 'any',
      minQuality: NaN,
      maxQuality: NaN,
      allowRot: 'x',
    },
    { categories: 'stone' },
    { categories: [1, null, {}] },
    {},
    null,
    undefined,
    'all',
    'food',
    'none',
    5,
    [],
    { categories: ['food', 'food', 'food'] },
  ];
  const wants: unknown[] = [
    { barrel: 1, bag: 1, bin: 1 },
    { barrel: -1, bag: 0, bin: 0 },
    { barrel: 1e9, bag: 0, bin: 0 },
    { barrel: NaN, bag: NaN, bin: NaN },
    { barrel: 1.5 },
    { cloth: 5, thread: 5 },
    { cloth: -5, thread: 1e9 },
    { cloth: NaN },
    { nope: 1 },
    { __proto__: 1 },
    {},
    null,
    undefined,
    5,
    'x',
    [],
  ];
  const triggers: unknown[] = [
    { kind: 'creatures', minSize: 0, includeFortress: false },
    { kind: 'creatures', minSize: -1, includeFortress: true },
    { kind: 'creatures', minSize: NaN, includeFortress: 'x' },
    { kind: 'water', level: 1 },
    { kind: 'water', level: 0 },
    { kind: 'water', level: 8 },
    { kind: 'magma', level: 7 },
    { kind: 'magma', level: NaN },
    { kind: 'magma', level: 1.5 },
    { kind: 'x' },
    { kind: 'creatures' },
    {},
    null,
    undefined,
    'water',
    5,
    [],
  ];
  const equipment: unknown[] = [
    { weaponClass: 'any', armor: 'any', ranged: false },
    { weaponClass: 'axe', armor: 'metal', ranged: true },
    { weaponClass: 'nope', armor: 'nope', ranged: 'x' },
    { weaponClass: 5 },
    {},
    null,
    undefined,
    'any',
    5,
    [],
  ];
  const squadOrders: unknown[] = [
    { kind: 'station', tile: goodTiles[0] },
    { kind: 'station', tile: -1 },
    { kind: 'station', tile: map.tileCount },
    { kind: 'station', tile: NaN },
    { kind: 'station', tile: t(40, 40, 5) },
    { kind: 'station' },
    { kind: 'kill', targetId: e.with(C.Hostile)[0] ?? 0 },
    { kind: 'kill', targetId: e.with(C.Labors)[0] ?? 0 },
    { kind: 'kill', targetId: dead },
    { kind: 'kill', targetId: 0 },
    { kind: 'kill', targetId: e.with(C.Item)[0] ?? 0 },
    { kind: 'kill', targetId: e.with(C.Zone)[0] ?? 0 },
    { kind: 'kill' },
    { kind: 'patrol', tiles: goodTiles.slice(0, 3) },
    { kind: 'patrol', tiles: [] },
    { kind: 'patrol', tiles: [-1, NaN] },
    { kind: 'patrol', tiles: big },
    { kind: 'patrol' },
    { kind: 'follow', dwarfId: e.with(C.Labors)[0] ?? 0 },
    { kind: 'follow', dwarfId: dead },
    { kind: 'follow', dwarfId: e.with(C.Hostile)[0] ?? 0 },
    { kind: 'cancel' },
    { kind: 'nope' },
    {},
    null,
    undefined,
    'kill',
    5,
    [],
  ];
  const anItem = e.with(C.Item)[0] ?? 0;
  const merchantItem =
    e.with(C.Item).find((id) => ((e.get(id, C.Item)?.flags ?? 0) & 64) !== 0) ?? 0;
  const depotItems = e.with(C.Item).filter((id) => ((e.get(id, C.Item)?.flags ?? 0) & 32) !== 0);
  const lines: unknown[] = [
    [],
    [{ itemId: anItem, count: 1 }],
    [{ itemId: merchantItem, count: 1 }],
    [{ itemId: merchantItem, count: 0 }],
    [{ itemId: merchantItem, count: -1 }],
    [{ itemId: merchantItem, count: 1e9 }],
    [{ itemId: merchantItem, count: NaN }],
    [{ itemId: merchantItem, count: 1.5 }],
    [
      { itemId: merchantItem, count: 1 },
      { itemId: merchantItem, count: 1 },
    ],
    [{ itemId: depotItems[0] ?? 0, count: 1 }],
    [
      { itemId: depotItems[0] ?? 0, count: 1 },
      { itemId: depotItems[0] ?? 0, count: 1 },
    ],
    [{ itemId: dead, count: 1 }],
    [{ itemId: 0, count: 1 }],
    [{ itemId: e.with(C.Labors)[0] ?? 0, count: 1 }],
    [{ itemId: e.with(C.Merchant)[0] ?? 0, count: 1 }],
    [{}],
    [null],
    [5],
    'x',
    5,
    null,
    undefined,
    {},
  ];
  const entries: unknown[] = [
    [],
    [{ itemType: 'anvil', priority: 1 }],
    [{ category: 'metal', priority: 1 }],
    [{ typeId: 'anvil' }],
    [{ itemType: 'nope' }],
    [{}],
    [null],
    new Array(50).fill({ itemType: 'anvil', priority: 1 }),
    ['anvil'],
    [5],
    'x',
    5,
    null,
    undefined,
    {},
    [{ itemType: '__proto__' }],
  ];
  const values: unknown[] = [
    ...numbers.slice(0, 12),
    ...strings.slice(0, 8),
    true,
    false,
    {},
    [],
    null,
    undefined,
    e.with(C.Labors)[0] ?? 0,
    e.with(C.Squad)[0] ?? 0,
    dead,
    'any',
    'metal',
  ];
  const goodCount: Record<string, number> = {};
  const byField: Record<string, unknown[]> = {
    kind: [
      'dig',
      'channel',
      'ramp',
      'stairs_up',
      'stairs_down',
      'stairs_updown',
      'remove',
      'chop',
      'smooth',
      'engrave',
      'gather',
      'war',
      'hunting',
      'none',
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      99,
      -1,
      ...strings,
    ],
    mode: [
      'normal',
      'low',
      'high',
      'restricted',
      'open',
      'locked',
      'lock_on_alert',
      'pet_passable',
      'forbidden',
      'off',
      'train',
      'active',
      'armed',
      'disarmed',
      'safe',
      ...strings,
    ],
    level: ['calm', 'watchful', 'hearth', ...strings],
    title: ['none', 'thane', 'warden', 'broker', 'chief_medic', ...strings],
    labor: [...ids('labors'), 0, 1, 2, 99, -1, NaN, ...strings],
    name: [
      'Urist',
      'haul_refuse',
      'auto_butcher',
      'auto_collect_webs',
      ...Object.keys({}),
      ...strings,
    ],
    species: [
      ...ids('creatures').slice(0, 12),
      ...ids('plants').slice(0, 4),
      0,
      1,
      2,
      999,
      -1,
      NaN,
      ...strings,
    ],
    speciesId: [...ids('plants'), 0, 1, 2, 3, 999, -1, NaN, ...strings.slice(0, 6)],
    zoneType: ['stockpile', 'meeting_area', 'dump', ...ids('zoneTypes'), 0, 1, 99, ...strings],
    buildingType: [
      'wall',
      'floor',
      'door',
      'bed',
      'carpenter',
      'well',
      ...ids('buildings'),
      0,
      1,
      99,
      ...strings,
    ],
    civ: ['mountainhome', 'hillfolk', 'wildwood', 'gloam', ...strings],
    key: [
      'squad',
      'owner',
      'crop per season',
      'desired supplies',
      'priority',
      'crop_per_season',
      'desired_supplies',
      'name',
      'ownerId',
      'squadId',
      'allowPets',
      'target',
      'targets',
      'capacity',
      'pets',
      'species',
      'crops',
      'wants',
      'filter',
      'type',
      'tiles',
      'settings',
      ...strings,
    ],
    value: values,
    typeId: [...ids('items').slice(0, 10), 0, 1, 2, 9999, -1, NaN, ...strings.slice(0, 8)],
    materialChoice: [
      0,
      'granite',
      'pine',
      ...ids('materials').slice(0, 8),
      1,
      2,
      9999,
      -1,
      NaN,
      1.5,
      ...strings.slice(0, 6),
    ],
    on: bools,
    order: [...orders, ...squadOrders],
    patch: patches,
    filter: filters,
    wants,
    trigger: triggers,
    equipment,
    entries,
    give: lines,
    take: lines,
    tiles: tileLists,
    tile: [...goodTiles, ...badTiles],
    origin: [...goodTiles, ...badTiles],
    members: [
      [],
      e.with(C.Labors).slice(0, 2),
      e.with(C.Labors),
      [dead],
      [0],
      [-1],
      [NaN],
      [e.with(C.Hostile)[0] ?? 0],
      [e.with(C.Tame)[0] ?? 0],
      [e.with(C.Labors)[0] ?? 0, e.with(C.Labors)[0] ?? 0],
      new Array(40).fill(e.with(C.Labors)[0] ?? 0),
      'x',
      5,
      null,
      undefined,
      {},
      [e.with(C.Item)[0] ?? 0],
    ],
    itemIds: [
      [],
      [anItem],
      [anItem, anItem],
      [dead],
      [0],
      [-1, NaN],
      [merchantItem],
      depotItems.slice(0, 2),
      e.with(C.Item).slice(0, 200),
      [e.with(C.Labors)[0] ?? 0],
      [e.with(C.Building)[0] ?? 0],
      'x',
      5,
      null,
      undefined,
      {},
    ],
  };
  for (const [f, good] of Object.entries(idsFor)) {
    byField[f] = [...good, ...idPool];
    goodCount[f] = Math.max(1, good.length);
  }
  const goodNumbers: Record<string, unknown[]> = {
    priority: [5, 1, 9],
    cap: [10, 0, 100],
    n: [50, 20, 200],
    season: [0, 1, 2, 3],
    sleepStartHour: [20, 0, 23],
    orientation: [0, 1, 2, 3],
    width: [undefined],
    height: [undefined],
    x: [30, 31],
    y: [30, 31],
    zTop: [32],
    zBottom: [30, 31],
    index: [0, 1],
    from: [0, 1],
    to: [1, 0],
  };
  for (const [f, good] of Object.entries(goodNumbers)) {
    byField[f] = [...good, ...numbers];
    goodCount[f] = good.length;
  }
  goodCount['materialChoice'] = 3;
  goodCount['on'] = 2;
  goodCount['origin'] = 6;
  goodCount['tile'] = 6;
  goodCount['tiles'] = 4;
  goodCount['order'] = 2;
  goodCount['patch'] = 1;
  goodCount['filter'] = 2;
  goodCount['wants'] = 1;
  goodCount['trigger'] = 1;
  goodCount['equipment'] = 2;
  goodCount['members'] = 3;
  goodCount['itemIds'] = 2;
  goodCount['entries'] = 2;
  goodCount['civ'] = 3;
  goodCount['level'] = 3;
  goodCount['title'] = 5;
  return {
    ids: idPool,
    tiles: [...goodTiles, ...badTiles],
    tileLists,
    byField,
    goodCount,
    garbage: [...numbers, ...strings, ...bools, [], {}, [[]], [{}], () => 0],
  };
}

function poolFor(field: string, p: Pools): unknown[] {
  if (p.byField[field]) return p.byField[field] as unknown[];
  if (/Id$/.test(field)) return p.ids;
  return p.garbage;
}

function show(v: unknown): string {
  const s = JSON.stringify(v, (_k, x) =>
    typeof x === 'number' && !Number.isFinite(x)
      ? `#${String(x)}`
      : x === undefined
        ? '#undefined'
        : typeof x === 'function'
          ? '#fn'
          : Array.isArray(x) && x.length > 12
            ? `#array(${x.length})`
            : typeof x === 'string' && x.length > 40
              ? `#string(${x.length})`
              : x,
  );
  return s === undefined ? '#undefined' : s.length > 300 ? `${s.slice(0, 300)}…` : s;
}

describe('T-176 command fuzz', () => {
  it('sweeps every field and 40 random trials per command, then saves accepted states', () => {
    const base = buildWorld().game;
    expect(checkInvariants(base), 'the prepared fortress is valid').toEqual([]);
    const known = new Set<string>(REJECT_REASONS);
    const exercised = new Set<string>();
    let trials = 0,
      accepted = 0,
      saves = 0;
    for (const type of COMMAND_TYPES) {
      let game = roundTrip(base).game;
      expect(game.hash()).toBe(base.hash());
      const p = pools(game);
      const owner = COMMAND_OWNERS[type];
      const fields = FIELDS[owner] ?? [];
      const own = OWN[type] ?? fields;
      let acceptedSinceSave = 0;
      const save = (): void => {
        const copy = roundTrip(game).game;
        expect(copy.hash(), `save after ${type}`).toBe(game.hash());
        game = copy;
        acceptedSinceSave = 0;
        saves += 1;
      };
      const trial = (cmd: Record<string, unknown>): void => {
        trials += 1;
        let result: CommandResult = { ok: false, reason: 'not_found' };
        expect(() => {
          result = game.world.applyCommand(cmd as Command);
        }, show(cmd)).not.toThrow();
        if (!result.ok) expect(known.has(result.reason), show(cmd)).toBe(true);
        else {
          accepted += 1;
          acceptedSinceSave += 1;
          exercised.add(type);
          expect(() => game.step(2), show(cmd)).not.toThrow();
          expect(checkInvariants(game), show(cmd)).toEqual([]);
          if (acceptedSinceSave >= 15) save();
        }
      };
      const target = validTarget(game, type);
      if (target !== null) {
        expect(game.world.applyCommand(target), `valid target for ${type}`).toEqual({ ok: true });
        exercised.add(type);
        game.step(2);
        expect(checkInvariants(game), `accepted ${type}`).toEqual([]);
        // Restore its target before the field sweep (e.g. a just-released cage).
        game = roundTrip(base).game;
      }
      const baseCmd = (): Record<string, unknown> => {
        const cmd: Record<string, unknown> = { type };
        for (const field of own) cmd[field] = poolFor(field, p)[0];
        return target === null ? cmd : { ...cmd, ...target };
      };
      trial({ type });
      for (let b = 0; b < 6; b += 1) {
        const start = baseCmd();
        if (b > 0)
          for (const field of own)
            start[field] = pick(poolFor(field, p).slice(0, p.goodCount[field] ?? 6));
        for (const field of own)
          for (const value of poolFor(field, p)) trial({ ...start, [field]: value });
      }
      for (let k = 0; k < N; k += 1) {
        const cmd: Record<string, unknown> = { type };
        for (const field of own)
          if (rnd() < 0.92)
            cmd[field] =
              rnd() < 0.5
                ? pick(poolFor(field, p).slice(0, p.goodCount[field] ?? 6))
                : rnd() < 0.8
                  ? pick(poolFor(field, p))
                  : pick(p.garbage);
        if (rnd() < 0.15) {
          const extra = pick(fields);
          if (extra !== undefined) cmd[extra] = pick(poolFor(extra, p));
        }
        trial(cmd);
      }
      if (acceptedSinceSave > 0) save();
    }
    for (const type of previouslyUnaccepted)
      expect(exercised.has(type), `${type} was applied, not only rejected`).toBe(true);
    expect(saves).toBeGreaterThan(0);
    console.log(`T-176 fuzz: ${trials} trials, ${accepted} accepted, ${saves} save round trips`);
  }, 600_000);
});
