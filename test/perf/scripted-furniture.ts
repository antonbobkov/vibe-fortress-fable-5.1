/**
 * T-M6-18: the budget's standard year-three, 80-dwarf scripted load fixture, as it was built before T-283: the map,
 * the channel and the cavern, 80 dwarves, 120 animals, 60 small zones, 600 pieces of furniture and 25,000 items, with
 * no workshop, farm, squad, depot or gate. It is kept, under its own file, for the budgets measured on it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatedSpec, type HeadlessGame } from '@app/headless';
import { loadGame, saveGame } from '@app/game-save';
import { C } from '@core/components';
import { TICKS_PER_HOUR, TICKS_PER_YEAR } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../scenarios/test-world';
import { digWaterfall } from '../scenarios/waterfall';

export const FURNITURE_PATH = fileURLToPath(new URL('../fixtures/reference-fortress-furniture.deepholm', import.meta.url));
export const REFERENCE_SEED = 'perf-1';
const SEED = REFERENCE_SEED;

export function surfaceTiles(w: TestWorld): TileIndex[] {
  const tiles: TileIndex[] = [];
  for (let y = 3; y < w.map.h - 3; y += 1) {
    for (let x = 3; x < w.map.w - 3; x += 1) {
      const z = w.map.columnSurfaceZ(x, y);
      if (z < 0) continue;
      const at = w.index(x, y, z);
      if (w.map.kindAt(at) === TileKind.Floor && w.readers.map.isWalkable(at, 'walker')) tiles.push(at);
    }
  }
  return tiles;
}

/** Tame and wild animals up to 120, alternating tame and wild; `from` offsets the sites chosen. */
export function spawnAnimals(w: TestWorld, sites: readonly TileIndex[], from: number): void {
  const entities = w.game.world.entities;
  const tameSpecies = ['cow', 'sheep', 'chicken', 'goat'] as const;
  const wildSpecies = ['deer', 'rabbit', 'fox', 'wild_horse'] as const;
  const animalCount = (): number => entities.with(C.Tame).length + entities.with(C.Wild).length;
  for (let k = from; animalCount() < 120; k += 1) {
    const at = sites[(k * 47 + 211) % sites.length] as TileIndex;
    if (k % 2 === 0) w.spawnTame(tameSpecies[Math.floor(k / 2) % tameSpecies.length] as string, at);
    else w.spawnCreature(wildSpecies[Math.floor(k / 2) % wildSpecies.length] as string, at, 'wild');
  }

}

/**
 * The part both reference fortresses share: the generated map with its river, the running channel and the breached
 * cavern, 80 dwarves and 120 animals. `sites` are the walkable surface tiles the rest is spread over.
 */
export function buildReferenceBase(): { w: TestWorld; sites: TileIndex[] } {
  // perf-1's default region has no river; the reference workload explicitly includes one.
  const spec = { ...generatedSpec(SEED), river: { inflowEdges: ['n'] as const, outflowEdge: 's' as const, class: 'river' } };
  const w = new TestWorld({ seed: SEED, world: 'local', spec, embark: 'default',
    startTick: 2 * TICKS_PER_YEAR + 8 * TICKS_PER_HOUR });
  w.game.world.calendar.setTick(2 * TICKS_PER_YEAR + 8 * TICKS_PER_HOUR);
  const wagon = w.game.arrival?.wagon;
  if (wagon === undefined) throw new Error('reference fortress has no wagon');

  // The same authored running channel as the earlier performance smoke, plus a breached cavern.
  const y = Math.min(w.map.h - 12, wagon.y + 12);
  const x0 = Math.max(2, Math.min(w.map.w - 45, wagon.x - 20));
  let top = w.map.columnSurfaceZ(x0, y);
  for (let x = x0; x <= x0 + 40; x += 1) top = Math.min(top, w.map.columnSurfaceZ(x, y));
  const channelZ = Math.max(5, top - 2);
  digWaterfall(w, x0, y, channelZ, 40, 3);
  w.digRoom(x0 + 32, y - 12, channelZ - 3, 20, 20);
  const caveZ = Math.max(5, channelZ - 8);
  w.digRoom(x0 + 28, y - 8, caveZ, 18, 14);
  for (let z = caveZ + 1; z <= channelZ - 3; z += 1) w.carve(w.index(x0 + 40, y, z), TileKind.Open);

  const sites = surfaceTiles(w);
  if (sites.length < 1_000) throw new Error('reference fortress lacks surface sites');
  const entities = w.game.world.entities;
  let dwarfCount = entities.with(C.Brain).filter((id) => entities.get(id, C.Creature)?.faction === 'fortress').length;
  for (let k = 0; dwarfCount < 80; k += 1, dwarfCount += 1) {
    w.spawnDwarf({ at: sites[(k * 13 + 73) % sites.length] as TileIndex });
  }

  spawnAnimals(w, sites, 0);
  return { w, sites };
}

export function buildScriptedFurniture(): TestWorld {
  const { w, sites } = buildReferenceBase();
  const entities = w.game.world.entities;
  // A mix of usable storage, living, gathering and dining zones, each four surface tiles.
  const buildings = w.readers.of<BuildingsReader>('14');
  const used = new Set<TileIndex>();
  const zoneTypes = ['stockpile', 'bedroom', 'meeting_area', 'dining_hall'] as const;
  let zoneCount = entities.with(C.Zone).length;
  for (const at of sites) {
    if (zoneCount >= 60) break;
    const x = w.map.xOf(at);
    const y0 = w.map.yOf(at);
    const z = w.map.zOf(at);
    if (x % 3 !== 0 || y0 % 3 !== 0) continue;
    const group = [at, w.index(x + 1, y0, z), w.index(x, y0 + 1, z), w.index(x + 1, y0 + 1, z)];
    const type = zoneTypes[zoneCount % zoneTypes.length] as string;
    for (const tile of group) w.discover(tile);
    if (group.some((tile) => used.has(tile) || !buildings.zoneTileQualifies(type, tile))) continue;
    for (const tile of group) used.add(tile);
    w.zone(type, group);
    zoneCount += 1;
  }
  if (zoneCount !== 60) throw new Error(`reference fortress has ${zoneCount} zones, expected 60`);

  // Furnish the explored settlement with varied one-tile buildings.
  const buildingTypes = ['bed', 'chair', 'table', 'paved_floor', 'chain_post', 'statue'] as const;
  let buildingCount = entities.with(C.Building).length;
  for (const at of sites) {
    if (buildingCount >= 600) break;
    if (used.has(at)) continue;
    const type = buildingTypes[buildingCount % buildingTypes.length] as string;
    w.discover(at);
    if (buildings.ghost(type, at, 0).reason !== null) continue;
    w.build(type, at, type === 'statue' || type === 'paved_floor' ? 'granite' : 'oak');
    used.add(at);
    buildingCount += 1;
  }
  if (buildingCount !== 600) throw new Error(`reference fortress has ${buildingCount} buildings, expected 600`);

  // Individual item entities exercise the 25,000-item reference load; spread stock across the map.
  const stock: readonly (readonly [string, string])[] = [
    ['raw_stone', 'granite'], ['raw_stone', 'granite'], ['raw_stone', 'granite'],
    ['log', 'oak'], ['plant_food', 'barley'], ['drink', 'ale'],
    ['stone_block', 'granite'], ['barrel', 'oak'],
  ];
  let itemCount = entities.with(C.Item).length;
  for (let k = 0; itemCount < 25_000; k += 1, itemCount += 1) {
    const [type, material] = stock[k % stock.length] as readonly [string, string];
    w.spawnItem(type, material, sites[(k * 67 + 17) % sites.length] as TileIndex);
  }
  w.step(1);
  if (entities.with(C.Item).length < 25_000) throw new Error('reference fortress lost item entities during setup');
  return w;
}

export async function ensureScriptedFurniture(now: () => number): Promise<HeadlessGame> {
  if (existsSync(FURNITURE_PATH)) return (await loadGame(readFileSync(FURNITURE_PATH), { now })).game;
  const w = buildScriptedFurniture();
  const bytes = await saveGame(w.game, { kind: 'manual' });
  mkdirSync(fileURLToPath(new URL('../fixtures/', import.meta.url)), { recursive: true });
  writeFileSync(FURNITURE_PATH, bytes);
  return (await loadGame(bytes, { now })).game;
}
