/** T-136: a command-only version of the browser year's opening and wildlife response. */
import { HeadlessGame, regionSpec } from '@app/headless';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { DAYS_PER_YEAR, PRIORITY_DEFAULT, TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { AnimalsReader } from '@systems/animals';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
import type { ItemsReader } from '@systems/items';

export const WILDLIFE_CASES = ['temperate_forest', 'taiga', 'temperate_grassland'].flatMap((biome) =>
  [1, 2, 3, 4].map((n) => ({ biome, seed: `wildlife-${biome}-${n}` })));

export interface WildlifeDeath {
  tick: number;
  day: number;
  id: number;
  kind: string;
  name: string;
  cause: string;
  killerId: number;
  killerSpecies: string;
  wildlife: boolean;
  tile: number;
  /** Dry variant only: horizontal tiles from the wagon, and from the nearest tile a dwarf drank at (-1 when none drank). */
  wagonDistance?: number;
  bankDistance?: number;
}

/** What the dry variant records of the brook (T-360). */
export interface BrookRecord {
  drinks: number;
  alcohol: number;
  firstDrinkDay: number | null;
  drinkers: number;
  /** Horizontal distance from the wagon of each drink, sorted. */
  distances: number[];
  /** The tiles dwarves drank at, with the drinks taken at each. */
  tiles: { tile: number; x: number; y: number; z: number; drinks: number }[];
  outdoors: number;
  wagon: { x: number; y: number; z: number };
}

/**
 * T-448: the relief of the instrument's regions. In twelve standard worlds (`world-0` to `world-11`)
 * the median relief of every embarkable biome is 1, temperate forest, taiga and grassland included.
 */
export const WILDLIFE_RELIEF = 1;

/** The variants of the opening. `dry`: the embark drink is destroyed and no still is built, so every drink is the brook's. */
export interface WildlifeOptions {
  dry?: boolean;
  /** A brook crosses the map: from the west edge (where the wagon stands) to the south edge, or from the north edge to the south edge. */
  brook?: 'west' | 'north';
  /** The region's relief (T-448); `WILDLIFE_RELIEF` when absent. */
  relief?: 0 | 1 | 2 | 3;
  /** Called after every look (20 ticks) of the year with the alert level; a probe's hook, absent in the instrument. */
  observe?: (game: HeadlessGame, level: string) => void;
}

export interface WildlifeYear {
  seed: string;
  biome: string;
  tick: number;
  living: number;
  arrivals: number;
  deaths: WildlifeDeath[];
  starving: number;
  shelter: { longest: number; maxHunger: number; maxThirst: number; maxRest: number };
  sleepAttacks: { tick: number; dwarf: number; attacker: number; nearby: { id: number; behavior: string; activity: string }[] }[];
  livestockLost: number;
  spawns: Record<string, number>;
  alerts: { tick: number; level: string }[];
  stocks: { drink: number; meal: number; plantFood: number };
  harvests: number;
  hunts: number;
  hash: string;
  /** `siteSteps` (T-481): walker steps from the camp's stockpile to the middle of each building site, -1 when none reach it. */
  setup: { caveDepth: number; surfacePlots: number[]; caveTiles: number; buildings: number[]; commands: number; siteSteps: number[] };
  brook?: BrookRecord;
}

/** Same alert timings and proximity check as test/e2e/full-year.spec.ts, including its opening. */
const LOOK_EVERY = 20;
const NEAR = 40;
const CALM_AFTER = 600;
const HEARTH_HOLD = 300;
const HEARTH_PAUSE = 1500;
/** T-410: the longest a hearth alert stands after its last wild attack, whatever lies near the wagon (three days). */
const HEARTH_HOLD_MAX = 3600;

export function playWildlifeYear(seed: string, biome: string, options: WildlifeOptions = {}): WildlifeYear {
  // Standard-sized generated map, west embark like the browser sample. No serene_vale
  // wildlife suppression; biome, soil, plants, weather and all natural arrivals are real.
  const spec = regionSpec(seed, { biome, peril: 0, wealth: 2, temper: 0, traits: [], relief: options.relief ?? WILDLIFE_RELIEF,
    ...(options.brook === undefined ? {} : { river: { class: 'brook' as const, inflow: [options.brook === 'west' ? 'w' as const : 'n' as const], outflow: 's' as const } }),
    nearestEdgeTo: { mountainhome: 'w', hillfolk: 'w', wildwood: 'w', gloam: 'w' } });
  const game = new HeadlessGame({ seed, world: 'local', spec, embark: 'default' });
  const world = game.world;
  const entities = world.entities;
  const map = game.map;
  const buildings = world.readers.of<BuildingsReader>('14');
  const buildingSystem = world.scheduler.byId('14') as BuildingsSystem;
  const animals = world.readers.of<AnimalsReader>('08');
  const combat = world.readers.of<CombatReader>('16');
  const items = world.readers.of<ItemsReader>('13');
  const species = game.registry.table<{ id: string; temper: string }>('creatures');
  const dwarf = species.index('dwarf');
  const aggressive = species.rows.filter((row) => row.temper === 'aggressive').map((row) => row.id);
  const living = (): number[] => entities.with(C.Labors).filter((id) => entities.get(id, C.Creature)?.faction === 'fortress');
  const wagon = buildings.get(buildings.wagon())!;
  const wx = map.xOf(wagon.origin);
  const wy = map.yOf(wagon.origin);
  const z = map.zOf(wagon.origin);
  const result: WildlifeYear = { seed, biome, tick: 0, living: 0, arrivals: living().length,
    deaths: [], starving: 0, shelter: { longest: 0, maxHunger: 0, maxThirst: 0, maxRest: 0 }, sleepAttacks: [], livestockLost: 0, spawns: {}, alerts: [],
    stocks: { drink: 0, meal: 0, plantFood: 0 }, harvests: 0, hunts: 0, hash: '',
    setup: { caveDepth: Math.min(2, spec.soilDepth - 1), surfacePlots: [], caveTiles: 0, buildings: [], commands: 0, siteSteps: [] } };
  if (options.dry === true) {
    // T-360: no drink in the fortress and no still; the first thirst walks to the brook. The barrels stay.
    const drinkType = game.registry.table<{ id: string }>('items').index('drink');
    for (const id of entities.with(C.Item)) {
      if (entities.get(id, C.Item)?.type === drinkType && entities.has(id, C.Item)) world.services.items?.destroy(id, 'probe');
    }
  }
  const brookTiles = new Map<number, number>();
  const drinkers = new Set<number>();
  const knownWild = new Map<number, string>();
  let attacked = false;
  let lastAttack = 0;
  let lastThreat = 0;
  let level = 'calm';
  let raisedAt = 0;
  let noHearthUntil = 0;
  world.onEvents((batch) => {
    for (const event of batch) {
      if (event.type === 'AnimalSpawned') {
        const name = String(event['species']);
        knownWild.set(Number(event['id']), name);
        result.spawns[name] = (result.spawns[name] ?? 0) + 1;
      } else if (event.type === 'ImmigrantsArrived') result.arrivals += Number(event['count']);
      else if (event.type === 'Starving') result.starving += 1;
      else if (event.type === 'DrankWater' || event.type === 'DrankAlcohol') {
        const brook = (result.brook ??= { drinks: 0, alcohol: 0, firstDrinkDay: null, drinkers: 0, distances: [], tiles: [], outdoors: 0, wagon: { x: wx, y: wy, z } });
        if (event.type === 'DrankAlcohol') brook.alcohol += 1;
        else {
          const at = game.movement.tileOf(Number(event['id']) as EntityId);
          brook.drinks += 1;
          brook.firstDrinkDay ??= Math.floor(game.tick / TICKS_PER_DAY) + 1;
          if (event['outdoors'] === true) brook.outdoors += 1;
          if (at >= 0) {
            brook.distances.push(Math.max(Math.abs(map.xOf(at) - wx), Math.abs(map.yOf(at) - wy)));
            brookTiles.set(at, (brookTiles.get(at) ?? 0) + 1);
          }
          drinkers.add(Number(event['id']));
        }
      }
      else if (event.type === 'CropHarvested') result.harvests += 1;
      else if (event.type === 'HuntKill') result.hunts += 1;
      else if (event.type === 'AttackResolved' && animals.isWild(Number(event['attackerId'])) && !animals.isWild(Number(event['defenderId']))) {
        attacked = true;
        lastAttack = game.tick;
        lastThreat = game.tick;
        const victim = Number(event['defenderId']);
        const brain = entities.get(victim, C.Brain);
        const at = game.movement.tileOf(victim);
        if (entities.has(victim, C.Labors) && brain?.activity === 'sleep') {
          const nearby = living().filter((id) => {
            const other = game.movement.tileOf(id);
            return at >= 0 && other >= 0 && map.zOf(at) === map.zOf(other)
              && Math.max(Math.abs(map.xOf(at) - map.xOf(other)), Math.abs(map.yOf(at) - map.yOf(other))) <= 8;
          }).map((id) => ({ id, behavior: entities.get(id, C.Brain)?.behavior ?? '', activity: entities.get(id, C.Brain)?.activity ?? '' }));
          result.sleepAttacks.push({ tick: game.tick, dwarf: victim, attacker: Number(event['attackerId']), nearby });
        }
      } else if (event.type === 'CreatureDied' && event['faction'] === 'fortress' && event['cause'] !== 'slaughter') {
        const killerId = Number(event['killerId'] ?? 0);
        const kind = Number(event['species']) === dwarf ? 'dwarf' : species.idOf(Number(event['species']));
        result.deaths.push({ tick: game.tick, day: Math.floor(game.tick / TICKS_PER_DAY) + 1,
          id: Number(event['id']), kind, name: String(event['name'] ?? ''), cause: String(event['cause']),
          killerId, killerSpecies: killerId === 0 ? 'none' : knownWild.get(killerId) ?? species.idOf(entities.get(killerId, C.Creature)?.species ?? dwarf),
          wildlife: knownWild.has(killerId), tile: Number(event['tile'] ?? -1) });
        if (kind !== 'dwarf') result.livestockLost += 1;
      }
    }
  });
  const command = (cmd: Command): void => {
    world.submit(cmd);
    world.commandPhase(true);
    const ok = world.commandLog.all()[world.commandLog.length - 1]!.result;
    if (!ok.ok) throw new Error(`${seed} tick ${game.tick}: ${JSON.stringify(cmd)} rejected: ${ok.reason}`);
    result.setup.commands += 1;
  };
  const rect = (x: number, y: number, width: number, height: number, atZ = z): number[] => {
    const tiles: number[] = [];
    for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) tiles.push(map.index(x + dx, y + dy, atZ));
    return tiles;
  };
  /** The tiles of the six building sites the opening has chosen (T-481). */
  const sites = new Set<number>();
  const zone = (zoneType: string, tiles: number[], need = 1): number => {
    // The UI's green-tile selection: keep only qualifying, unzoned tiles. T-481: the player does not
    // draw a zone over the wagon or another building, nor over a site chosen for a workshop.
    const qualifying = (list: number[]): number[] => list.filter((at) => buildings.zoneTileQualifies(zoneType, at) && buildings.zoneAt(at) === 0 &&
      buildings.at(at) === 0 && !sites.has(at));
    let selected = qualifying(tiles);
    // T-448: on relief the designed rectangle may lie on another level; the player draws the same
    // rectangle at the nearest place within 12 tiles where most of it qualifies. `need` is how little
    // of the rectangle the player settles for where it was drawn.
    if (selected.length < need && tiles.length > 0) {
      const xs = tiles.map((t) => map.xOf(t)); const ys = tiles.map((t) => map.yOf(t));
      const x0 = Math.min(...xs); const y0 = Math.min(...ys); const tz = map.zOf(tiles[0]!);
      const width = Math.max(...xs) - x0 + 1; const height = Math.max(...ys) - y0 + 1;
      for (const level of [tz, tz - 1, tz + 1, tz - 2, tz + 2]) {
        if (selected.length >= need) break;
        let bestD = Number.MAX_SAFE_INTEGER;
        for (let dy = -12; dy <= 12; dy += 1) for (let dx = -12; dx <= 12; dx += 1) {
          if (x0 + dx < 1 || y0 + dy < 1 || x0 + dx + width >= map.w || y0 + dy + height >= map.h) continue;
          const here = qualifying(rect(x0 + dx, y0 + dy, width, height, level));
          const d = Math.abs(dx) + Math.abs(dy);
          if (here.length > selected.length || (here.length === selected.length && here.length > 0 && d < bestD)) { selected = here; bestD = d; }
        }
      }
    }
    command({ type: 'CreateZone', zoneType, tiles: selected });
    return buildingSystem.lastCreatedZone;
  };
  const plot = (tiles: number[], crop: string, seasons: number[], need = 1): number => {
    const id = zone('farm_plot', tiles, need);
    game.step(1); // Same editor handshake as the browser opening.
    for (const season of seasons) command({ type: 'SetPlotCrop', zoneId: id, season, speciesId: crop });
    return buildings.zone(id)!.tiles.length;
  };
  const build = (buildingType: string, origin: number): void => {
    command({ type: 'PlaceBuilding', buildingType, origin, orientation: 0, materialChoice: 0, priority: PRIORITY_DEFAULT });
    result.setup.buildings.push(buildingSystem.lastPlacedBuilding);
  };
  const order = (recipeId: string, mode: string, quantity: number): void => command({ type: 'AddWorkOrder', workshopId: 0,
    order: { recipeId, mode, remaining: mode === 'maintain' ? 1 : quantity, threshold: mode === 'maintain' ? quantity : 0,
      priority: PRIORITY_DEFAULT, materialFilter: null } });
  const advance = (target: number, respond = false): void => {
    const near = (): boolean => aggressive.some((name) => animals.bySpecies(name, true).some((id) => {
      const at = game.movement.tileOf(id as EntityId);
      return at >= 0 && Math.max(Math.abs(at % map.w - wx), Math.abs(Math.floor(at / map.w) % map.h - wy)) <= NEAR;
    }));
    while (game.tick < target && living().length > 0) {
      game.step(Math.min(respond ? LOOK_EVERY : 300, target - game.tick));
      if (!respond) continue;
      options.observe?.(game, level);
      const tick = game.tick;
      let next = level;
      if (level === 'hearth') {
        result.shelter.longest = Math.max(result.shelter.longest, tick - raisedAt);
        for (const id of living()) {
          const needs = entities.get(id, C.Needs);
          if (needs === undefined) continue;
          result.shelter.maxHunger = Math.max(result.shelter.maxHunger, needs.hunger);
          result.shelter.maxThirst = Math.max(result.shelter.maxThirst, needs.thirst);
          result.shelter.maxRest = Math.max(result.shelter.maxRest, needs.rest);
        }
        if ((tick - raisedAt >= HEARTH_HOLD && !near()) || tick - Math.max(raisedAt, lastAttack) >= HEARTH_HOLD_MAX) next = 'watchful';
      } else if (attacked && tick >= noHearthUntil) next = 'hearth';
      else if (near()) {
        lastThreat = tick;
        if (level === 'calm') next = 'watchful';
      } else if (level === 'watchful' && tick - lastThreat >= CALM_AFTER) next = 'calm';
      if (next === level) continue;
      command({ type: 'SetAlert', level: next });
      result.alerts.push({ tick, level: next });
      if (next === 'hearth') { raisedAt = tick; attacked = false; }
      else if (level === 'hearth') noHearthUntil = tick + HEARTH_PAUSE;
      level = next;
    }
  };

  const patches: { x: number; y: number; z: number }[] = [];
  const camY = Math.max(0, wy - 21);
  for (let y = camY + 2; y <= camY + 36 && patches.length < 8; y += 1) {
    for (let x = 2; x <= 38 && patches.length < 8; x += 1) {
      if (x <= 14 && y >= wy - 7 && y <= wy + 7) continue;
      if (patches.some((p) => Math.abs(p.x - x) < 4 && Math.abs(p.y - y) < 4)) continue;
      if (rect(x, y, 3, 3).every((at) => map.kindAt(at) === TileKind.Floor && buildings.zoneAt(at) === 0)) patches.push({ x, y, z });
    }
  }
  // T-448: on a map with relief the camp window may hold fewer than eight level patches at the
  // wagon's level; the rest are elsewhere on the wagon's level or one or two levels down or up.
  // T-481: they are the nearest by walk from the camp's stockpile, whatever their level (ties: the
  // wagon's level first, then one and two levels down and up), as a player builds beside the camp.
  const levels = [z, z - 1, z + 1, z - 2, z + 2];
  const steps = new Map<number, number>();
  const walk: number[] = [];
  for (const at of rect(wx + 3, wy + 2, 4, 4)) if (game.pathing.graph.passable(at, 'walker')) { steps.set(at, 0); walk.push(at); }
  for (let head = 0; head < walk.length; head += 1) {
    const at = walk[head]!;
    const next = steps.get(at)! + 1;
    const visit = (to: number): void => {
      if (steps.has(to) || !levels.includes(map.zOf(to))) return;
      steps.set(to, next);
      walk.push(to);
    };
    game.pathing.graph.forEachHorizontalEdge(at, 'walker', visit);
    game.pathing.graph.forEachVerticalEdge(at, 'walker', visit);
  }
  if (patches.length < 8) {
    const more: { x: number; y: number; z: number; d: number; level: number }[] = [];
    for (const [li, level] of levels.entries()) for (let y = 2; y <= map.h - 5; y += 1) for (let x = 2; x <= map.w - 5; x += 1) {
      if (x <= wx + 12 && x >= wx - 2 && y >= wy - 7 && y <= wy + 7) continue;
      if (!rect(x, y, 3, 3, level).every((at) => map.kindAt(at) === TileKind.Floor && buildings.zoneAt(at) === 0 && buildings.at(at) === 0)) continue;
      // An unreachable patch comes after every reachable one, nearest first as the crow flies.
      const d = steps.get(map.index(x + 1, y + 1, level)) ?? map.w * map.h + Math.abs(x - wx) + Math.abs(y - wy);
      more.push({ x, y, z: level, d, level: li });
    }
    more.sort((a, b) => a.d - b.d || a.level - b.level || a.y - b.y || a.x - b.x);
    for (const m of more) {
      if (patches.length >= 8) break;
      if (patches.some((p) => Math.abs(p.x - m.x) < 4 && Math.abs(p.y - m.y) < 4)) continue;
      patches.push({ x: m.x, y: m.y, z: m.z });
    }
  }
  if (patches.length < 8) throw new Error(`${seed}: opening needs eight 3x3 floor patches`);
  for (const p of patches.slice(0, 6)) for (const at of rect(p.x, p.y, 3, 3, p.z)) sites.add(at);
  result.setup.siteSteps = patches.slice(0, 6).map((p) => steps.get(map.index(p.x + 1, p.y + 1, p.z)) ?? -1);
  const pile = zone('stockpile', rect(wx + 3, wy + 2, 4, 4));
  game.step(1);
  command({ type: 'SetStockpileFilter', zoneId: pile, filter: 'everything' });
  // T-454: a slope may leave little of a plot's rectangle farmable (ramps qualify for no plot); no
  // player farms the one tile left, so a plot with under half its tiles moves as an empty one does.
  result.setup.surfacePlots.push(plot(rect(wx + 2, wy - 5, 4, 3), 'turnip', [0, 1, 2], 6));
  result.setup.surfacePlots.push(plot(rect(wx + 6, wy - 5, 4, 3), 'barley', [0, 1], 6));
  let sx = wx + 4;
  let sy = wy - 1;
  let found = false;
  findEntrance: for (let dy = -2; dy <= 5; dy += 1) for (let dx = 2; dx <= 6; dx += 1) {
    const x = wx + dx; const y = wy + dy;
    if (x <= wx + 2 && y >= wy && y <= wy + 2) continue;
    if (x >= wx + 3 && x <= wx + 6 && y >= wy + 2 && y <= wy + 5) continue;
    if (x >= wx + 2 && x <= wx + 9 && y >= wy - 5 && y <= wy - 3) continue;
    if (map.kindAt(map.index(x, y, z)) === TileKind.Floor && buildings.zoneAt(map.index(x, y, z)) === 0) { sx = x; sy = y; found = true; break findEntrance; }
  }
  // T-448: on relief the stair's usual spot may be another level; the nearest floor of the wagon's
  // level within 10 tiles, outside the camp's rectangles, with rock to dig below it.
  if (!found) {
    let bestD = Number.MAX_SAFE_INTEGER;
    for (let dy = -10; dy <= 10; dy += 1) for (let dx = -10; dx <= 10; dx += 1) {
      const x = wx + dx; const y = wy + dy;
      if (x < 2 || y < 2 || x >= map.w - 10 || y >= map.h - 6) continue;
      if (x >= wx - 1 && x <= wx + 9 && y >= wy - 5 && y <= wy + 5) continue;
      const at = map.index(x, y, z);
      if (map.kindAt(at) !== TileKind.Floor || buildings.zoneAt(at) !== 0 || map.kindAt(map.index(x, y, z - 1)) !== TileKind.Wall) continue;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < bestD) { bestD = d; sx = x; sy = y; }
    }
  }
  command({ type: 'DesignateStairwell', x: sx, y: sy, zTop: z, zBottom: z - 6, priority: PRIORITY_DEFAULT });
  // Taiga has only two soil layers: its same-sized dimcap plot must be one level down.
  // This is a new instrument's explicit site rule, not extra farm capacity or a fixture repair.
  // T-448: on relief the ground beside the stair may fall away and leave the cave under open sky.
  // The cave goes on the side of the stair, and at the first level down the stair, with soil and
  // roof for at least half of it, else wherever most of it has (east and the shallowest when tied).
  const materialsTable = game.registry.table<{ id: string; class: string }>('materials');
  const coverable = (tiles: number[]): number => tiles.filter((at) => !map.hasFlag(at, TileFlag.Outdoor) && map.kindAt(at) === TileKind.Wall &&
    materialsTable.byIndex(map.materialAt(at))?.class === 'soil').length;
  const caveOrigins = ([[sx + 1, sy], [sx - 8, sy], [sx - 3, sy + 1], [sx - 4, sy - 4]] as const)
    .filter(([x, y]) => x >= 1 && y >= 1 && x + 8 < map.w - 1 && y + 4 < map.h - 1);
  let cave = rect(sx + 1, sy, 8, 4, z - result.setup.caveDepth);
  let caveScore = -1;
  for (let level = z - result.setup.caveDepth; level >= z - 5 && caveScore < 16; level -= 1) {
    for (const [x, y] of caveOrigins) {
      const tiles = rect(x, y, 8, 4, level);
      if (coverable(tiles) > caveScore) { cave = tiles; caveScore = coverable(tiles); }
    }
  }
  // T-448: on relief a designed rectangle may cross open ground; only what can be dug is designated.
  const diggable = (at: number): boolean => !map.hasFlag(at, TileFlag.Discovered) ||
    ((map.kindAt(at) === TileKind.Wall || map.kindAt(at) === TileKind.Boulder) && !map.hasFlag(at, TileFlag.Constructed));
  const caveDig = cave.filter(diggable);
  if (caveDig.length > 0) command({ type: 'Designate', kind: 'dig', tiles: caveDig, priority: PRIORITY_DEFAULT });
  const lowerDig = rect(sx + 1, sy, 5, 5, z - 3).filter(diggable);
  if (lowerDig.length > 0) command({ type: 'Designate', kind: 'dig', tiles: lowerDig, priority: PRIORITY_DEFAULT });
  const trees: number[] = [];
  for (let dy = -12; dy <= 12; dy += 1) for (let dx = 1; dx <= 30; dx += 1) {
    const at = map.index(wx + dx, wy + dy, z);
    if (map.kindAt(at) === TileKind.Tree) trees.push(at);
  }
  trees.sort((a, b) => {
    return (map.xOf(a) - wx) ** 2 + (map.yOf(a) - wy) ** 2 - ((map.xOf(b) - wx) ** 2 + (map.yOf(b) - wy) ** 2);
  });
  const depot = patches[5]!;
  const chopped = new Set([...trees.slice(0, 10), ...rect(0, 16, 4, 5), ...rect(depot.x - 2, depot.y - 2, 7, 7, depot.z)]);
  const actualTrees = [...chopped].filter((at) => map.kindAt(at) === TileKind.Tree);
  if (actualTrees.length > 0) command({ type: 'Designate', kind: 'chop', tiles: actualTrees, priority: PRIORITY_DEFAULT });
  for (const [i, type] of ['carpenter', 'mason', 'still'].entries()) if (options.dry !== true || type !== 'still') build(type, map.index(patches[i]!.x, patches[i]!.y, patches[i]!.z));
  order('make_barrel', 'maintain', 20);
  order('make_stone_block', 'once', 4);
  if (options.dry !== true) order('brew', 'maintain', 100);
  advance(3 * TICKS_PER_DAY);
  build('hearth', map.index(patches[3]!.x, patches[3]!.y, patches[3]!.z));
  build('kitchen', map.index(patches[4]!.x, patches[4]!.y, patches[4]!.z));
  order('cook_easy_meal', 'maintain', 60);
  zone('meeting_area', rect(patches[6]!.x, patches[6]!.y, 3, 3, patches[6]!.z));
  zone('bedroom', rect(patches[7]!.x, patches[7]!.y, 3, 3, patches[7]!.z));
  command({ type: 'CreateSquad', name: 'Wildlife guard' });
  game.step(1);
  command({ type: 'SetSquadMembers', squadId: combat.squads()[0]!.id, members: living().slice(0, 3) });
  game.step(1);
  advance(10 * TICKS_PER_DAY);
  // T-448: on relief part of the designed cave may lie under open sky; the dimcap plot is the dug part.
  result.setup.caveTiles = plot(cave.filter((at) => !map.hasFlag(at, TileFlag.Outdoor)), 'dimcap', [0, 1, 2, 3]);
  build('trade_depot', map.index(depot.x, depot.y, depot.z));
  command({ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'anvil', priority: 1 }] });
  advance(20 * TICKS_PER_DAY);
  advance(DAYS_PER_YEAR * TICKS_PER_DAY, true);
  result.tick = game.tick;
  result.living = living().length;
  result.stocks = { drink: items.count('drink'), meal: items.count('easy_meal') + items.count('fine_meal') + items.count('lavish_meal'), plantFood: items.count('plant_food') };
  result.hash = game.hash();
  if (options.dry === true || options.brook !== undefined) {
    const brook = (result.brook ??= { drinks: 0, alcohol: 0, firstDrinkDay: null, drinkers: 0, distances: [], tiles: [], outdoors: 0, wagon: { x: wx, y: wy, z } });
    brook.drinkers = drinkers.size;
    brook.distances.sort((a, b) => a - b);
    brook.tiles = [...brookTiles].map(([tile, drinks]) => ({ tile, x: map.xOf(tile), y: map.yOf(tile), z: map.zOf(tile), drinks }));
    for (const death of result.deaths) {
      if (death.tile < 0) continue;
      death.wagonDistance = Math.max(Math.abs(map.xOf(death.tile) - wx), Math.abs(map.yOf(death.tile) - wy));
      death.bankDistance = brook.tiles.length === 0 ? -1 : Math.min(...brook.tiles.map((b) => Math.max(Math.abs(b.x - map.xOf(death.tile)), Math.abs(b.y - map.yOf(death.tile)))));
    }
  }
  // T-481: no plot tile lies under a building, where nothing can be sown.
  for (const id of buildings.zonesOfType('farm_plot')) {
    const covered = (buildings.zone(id)?.tiles ?? []).filter((at) => buildings.at(at) !== 0).length;
    if (covered > 0) throw new Error(`${seed}: ${covered} farm plot tiles under a building`);
  }
  // Confirm this instrument did not reveal crops being planted in open air.
  if (buildings.zoneAt(cave[0]!) !== 0 && map.hasFlag(cave[0]!, TileFlag.Lit)) throw new Error(`${seed}: cave plot is lit`);
  return result;
}
