/**
 * T-283: the budget's standard year-three, 80-dwarf reference fortress, as a fortress and not a field of furniture:
 * every workshop that has recipes (twelve with a standing order its stock can feed), six farm plots with a crop for every
 * season and seeds, food, drink and a still, two squads of six with gear in stock and a barracks each (one on Train), a
 * hospital with beds, a chest and supplies, a trade depot, a gate with a door set to lock on alert, a drawbridge on a
 * lever and four cage traps, eight stockpiles of 5×5 with the presets a played fortress uses, and labors set by
 * profession templates. The map, the channel, the cavern, the dwarves and the animals are the base both fixtures share
 * (`scripted-furniture.ts`, which keeps the fixture the budgets were first measured on).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { HeadlessGame } from '@app/headless';
import { loadGame, saveGame } from '@app/game-save';
import { C } from '@core/components';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingRow, BuildingsReader } from '@systems/buildings';
import type { PlantRow } from '@systems/plants';
import { seasonAllows } from '@systems/plants/growth';
import type { WorkshopsReader } from '@systems/workshops';
import { LABOR_TEMPLATES } from '@ui/constants';
import type { TestWorld } from '../scenarios/test-world';
import { buildReferenceBase } from './scripted-furniture';

export const REFERENCE_PATH = fileURLToPath(new URL('../fixtures/reference-fortress.deepholm', import.meta.url));

/** What the fixture is built to hold; `reference_fortress.test.ts` asserts it from the saved file. */
export const REFERENCE_SHAPE = {
  dwarves: 80,
  stockpiles: 8,
  stockpileSide: 5,
  surfacePlots: 2,
  cavePlots: 4,
  squads: 2,
  squadSize: 6,
  cageTraps: 4,
  twelveOrders: 12,
} as const;

/** The presets of the eight stockpiles, in the order a played fortress makes them. */
const STOCKPILE_PRESETS = ['food', 'drink', 'seeds', 'stone', 'wood', 'furniture', 'ore_and_bars', 'weapons_and_armor'] as const;

/** One standing order per workshop: `keep ≥ N` of what its stock can feed for a season. */
const ORDERS: readonly (readonly [workshop: string, recipe: string, keep: number])[] = [
  ['carpenter', 'make_barrel', 20], ['mason', 'make_door_stone', 10], ['mechanic', 'make_mechanism', 20],
  ['wood_furnace', 'make_charcoal', 20], ['still', 'brew', 100], ['kitchen', 'cook_easy_meal', 100],
  ['craftdwarf', 'craft_wood', 10], ['bowyer', 'make_arrows_wood', 40], ['farmers_workshop', 'mill_flour', 30],
  ['tannery', 'tan_hide', 10], ['clothier', 'make_rope', 10], ['loom', 'spin_thread', 20],
];

interface Rect { readonly x: number; readonly y: number; readonly z: number; readonly w: number; readonly h: number }

/** Free surface tiles near the wagon, handed out as rectangles with a one-tile margin kept clear. */
class Ground {
  private readonly free: Set<TileIndex>;
  private readonly order: TileIndex[];

  constructor(private readonly w: TestWorld, sites: readonly TileIndex[], near: { x: number; y: number }) {
    this.free = new Set(sites);
    const d = (t: TileIndex): number => Math.abs(w.map.xOf(t) - near.x) + Math.abs(w.map.yOf(t) - near.y);
    this.order = [...sites].sort((a, b) => d(a) - d(b) || a - b);
  }

  /** The first rectangle of `cols × rows` free tiles, nearest the wagon, that `accept` takes; it is claimed. */
  claim(cols: number, rows: number, accept: (r: Rect) => boolean = () => true): Rect {
    const map = this.w.map;
    for (const at of this.order) {
      const r: Rect = { x: map.xOf(at), y: map.yOf(at), z: map.zOf(at), w: cols, h: rows };
      if (!this.fits(r) || !accept(r)) continue;
      this.take(r);
      return r;
    }
    throw new Error(`reference fortress: no ${cols}×${rows} site left`);
  }

  private fits(r: Rect): boolean {
    for (let dy = 0; dy < r.h; dy += 1) for (let dx = 0; dx < r.w; dx += 1) if (!this.free.has(this.w.index(r.x + dx, r.y + dy, r.z))) return false;
    return true;
  }

  private take(r: Rect): void {
    for (let dy = -1; dy <= r.h; dy += 1) for (let dx = -1; dx <= r.w; dx += 1) {
      if (r.x + dx < 0 || r.y + dy < 0 || r.x + dx >= this.w.map.w || r.y + dy >= this.w.map.h) continue;
      this.free.delete(this.w.index(r.x + dx, r.y + dy, r.z));
    }
  }

  /** Whatever is still free, in the nearest-first order. */
  rest(): TileIndex[] { return this.order.filter((t) => this.free.has(t)); }

  release(tiles: readonly TileIndex[]): void { for (const t of tiles) this.free.delete(t); }
}

export function tilesOf(w: TestWorld, r: Rect): TileIndex[] {
  const out: TileIndex[] = [];
  for (let dy = 0; dy < r.h; dy += 1) for (let dx = 0; dx < r.w; dx += 1) out.push(w.index(r.x + dx, r.y + dy, r.z));
  return out;
}

/** The crop a plot grows in a season, or 0: a surface plot has none in winter. */
function cropFor(w: TestWorld, kind: 'surface' | 'cave', season: number, pick: number): string | 0 {
  const crops = w.game.registry.table<PlantRow>('plants').rows.filter((p) => (p.kind === 'crop' || p.kind === 'cave_crop')
    && (kind === 'surface' ? p.light === 'sun' : p.light === 'dark') && seasonAllows(p, p.kind === 'cave_crop', season));
  const chosen = crops[pick % Math.max(1, crops.length)];
  return chosen === undefined ? 0 : chosen.id;
}

export function buildScriptedReference(): TestWorld {
  const { w, sites } = buildReferenceBase();
  const wagon = w.game.arrival?.wagon;
  if (wagon === undefined) throw new Error('reference fortress has no wagon');
  const entities = w.game.world.entities;
  const buildings = w.readers.of<BuildingsReader>('14');
  const workshops = w.readers.of<WorkshopsReader>('12');
  const ground = new Ground(w, sites, wagon);
  const discover = (tiles: readonly TileIndex[]): void => { for (const t of tiles) w.discover(t); };
  const apply = (command: Parameters<TestWorld['submit']>[0]): void => {
    const r = w.game.world.applyCommand(command);
    if (!r.ok) throw new Error(`reference fortress: ${command.type} refused: ${r.reason}`);
  };

  // The single items of the 25,000-item load lie spread over the map, as in the first fixture, but forbidden: a played
  // fortress keeps such a load behind forbidden stock and held-back goods, and the job board neither hauls nor looks
  // again at an item that is forbidden (25,000 loose items ask it for 25,000 haul jobs in one tick, and every item
  // that waits for a barrel is looked at on every tick).
  const stock: readonly (readonly [type: string, material: string])[] = [
    ['raw_stone', 'granite'], ['raw_stone', 'granite'], ['raw_stone', 'granite'],
    ['log', 'oak'], ['plant_food', 'barley'], ['drink', 'ale'],
    ['stone_block', 'granite'], ['barrel', 'oak'],
  ];
  const loose = new Set<TileIndex>();
  let itemCount = entities.with(C.Item).length;
  for (let k = 0; itemCount < 25_000; k += 1, itemCount += 1) {
    const [type, material] = stock[k % stock.length] as readonly [string, string];
    const at = sites[(k * 67 + 17) % sites.length] as TileIndex;
    w.spawnItem(type, material, at);
    loose.add(at);
  }
  apply({ type: 'ForbidItem', tiles: [...loose], on: true });

  // --- workshops: one of each that has recipes (not the magma ones, which need magma below them)
  const rows = w.game.registry.table<BuildingRow>('buildings').rows.filter((b) => b.category === 'workshop' && !b.tags.includes('magma') && workshops.recipesFor(b.id).length > 0);
  const workshopIds = new Map<string, EntityId>();
  for (const row of rows) {
    const r = ground.claim(row.footprint.w, row.footprint.h, (c) => {
      discover(tilesOf(w, c));
      return buildings.ghost(row.id, w.index(c.x, c.y, c.z), 0).reason === null;
    });
    workshopIds.set(row.id, w.build(row.id, w.index(r.x, r.y, r.z), 'granite'));
  }

  // --- the trade depot
  const depot = ground.claim(3, 3, (c) => { discover(tilesOf(w, c)); return buildings.ghost('trade_depot', w.index(c.x, c.y, c.z), 0).reason === null; });
  w.build('trade_depot', w.index(depot.x, depot.y, depot.z), 'granite');

  // --- the gate: a door between two wall stubs, a lever, a drawbridge, and four cage traps in the passage
  const gate = ground.claim(3, 9);
  const gz = gate.z;
  const mid = gate.x + 1;
  discover(tilesOf(w, gate));
  w.carve(w.index(gate.x, gate.y + 2, gz), TileKind.Wall);
  w.carve(w.index(gate.x + 2, gate.y + 2, gz), TileKind.Wall);
  const door = w.build('door', w.index(mid, gate.y + 2, gz), 'oak');
  apply({ type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' });
  const lever = w.build('lever', w.index(gate.x, gate.y + 3, gz), 'oak');
  const bridge = w.build('drawbridge', w.index(mid, gate.y + 8, gz), 'oak');
  for (let k = 0; k < 4; k += 1) w.build('cage_trap', w.index(mid, gate.y + 3 + k, gz), 'oak');
  // The link a mechanic would make (a job that takes a mechanism and some work), made as that job leaves it.
  const oak = w.game.registry.table('materials').index('oak');
  const leverBuilding = entities.get(lever, C.Building);
  const bridgeBuilding = entities.get(bridge, C.Building);
  if (leverBuilding === undefined || bridgeBuilding === undefined) throw new Error('reference fortress: gate mechanism missing');
  entities.add(lever, C.Building, { ...leverBuilding, linkedIds: [bridge], settings: { ...leverBuilding.settings, linkMaterials: [[bridge, oak]] } });
  entities.add(bridge, C.Building, { ...bridgeBuilding, linkedIds: [lever] });

  // --- eight stockpiles of 5×5 with the presets a played fortress uses
  const stockpiles: { zone: EntityId; tiles: TileIndex[] }[] = [];
  for (const preset of STOCKPILE_PRESETS) {
    const r = ground.claim(REFERENCE_SHAPE.stockpileSide, REFERENCE_SHAPE.stockpileSide, (c) => { discover(tilesOf(w, c)); return tilesOf(w, c).every((t) => buildings.zoneTileQualifies('stockpile', t)); });
    const tiles = tilesOf(w, r);
    const zone = w.zone('stockpile', tiles);
    apply({ type: 'SetStockpileFilter', zoneId: zone, filter: preset });
    stockpiles.push({ zone, tiles });
  }

  // --- six farm plots: two on the surface, four in dark rooms dug into the soil below it; a crop for every season
  const plotTiles: { tiles: TileIndex[]; kind: 'surface' | 'cave' }[] = [];
  for (let k = 0; k < REFERENCE_SHAPE.surfacePlots; k += 1) {
    const r = ground.claim(4, 4, (c) => { discover(tilesOf(w, c)); return tilesOf(w, c).every((t) => buildings.zoneTileQualifies('farm_plot', t)); });
    plotTiles.push({ tiles: tilesOf(w, r), kind: 'surface' });
  }
  for (let k = 0; k < REFERENCE_SHAPE.cavePlots; k += 1) {
    const r = ground.claim(6, 4, (c) => {
      const below = { ...c, z: c.z - 1 };
      w.digRoom(below.x, below.y, below.z, below.w, below.h);
      discover(tilesOf(w, below));
      return tilesOf(w, below).every((t) => buildings.zoneTileQualifies('farm_plot', t));
    });
    const below = { ...r, z: r.z - 1 };
    // A stair from the surface into the room.
    w.carve(w.index(r.x - 1, r.y, r.z), TileKind.StairsDown);
    w.carve(w.index(r.x - 1, r.y, r.z - 1), TileKind.StairsUp);
    w.discover(w.index(r.x - 1, r.y, r.z - 1));
    plotTiles.push({ tiles: tilesOf(w, below), kind: 'cave' });
  }
  const plotZones: EntityId[] = [];
  plotTiles.forEach((plot, index) => {
    const zone = w.zone('farm_plot', plot.tiles);
    plotZones.push(zone);
    for (let season = 0; season < 4; season += 1) apply({ type: 'SetPlotCrop', zoneId: zone, season, speciesId: cropFor(w, plot.kind, season, index) });
    for (const crop of new Set([0, 1, 2, 3].map((season) => cropFor(w, plot.kind, season, index)))) if (crop !== 0) w.spawnItem('seed', crop, plot.tiles[0] as TileIndex, 40);
  });

  // --- the hospital: a room of beds and a chest, with the supplies its settings ask for
  const hospital = ground.claim(6, 4, (c) => { discover(tilesOf(w, c)); return tilesOf(w, c).every((t) => buildings.zoneTileQualifies('hospital', t)); });
  const hospitalTiles = tilesOf(w, hospital);
  w.zone('hospital', hospitalTiles);
  for (let k = 0; k < 4; k += 1) w.build('bed', hospitalTiles[k * 2] as TileIndex, 'oak');
  const chest = w.build('chest', hospitalTiles[hospitalTiles.length - 1] as TileIndex, 'oak');
  const supplyAt = hospitalTiles[hospitalTiles.length - 2] as TileIndex;
  void chest;
  w.spawnItem('cloth', 'wool_cloth', supplyAt, 30);
  w.spawnItem('thread', 'wool_thread', supplyAt, 20);
  w.spawnItem('brightleaf', 'oak', supplyAt, 20);
  w.spawnItem('splint', 'oak', supplyAt, 10);

  // --- two barracks and two squads of six, with their gear in stock
  const dwarves = entities.with(C.Brain).filter((id) => entities.get(id, C.Creature)?.faction === 'fortress').sort((a, b) => a - b);
  const squadIds: EntityId[] = [];
  for (let k = 0; k < REFERENCE_SHAPE.squads; k += 1) {
    const room = ground.claim(6, 4, (c) => { discover(tilesOf(w, c)); return tilesOf(w, c).every((t) => buildings.zoneTileQualifies('barracks', t)); });
    const zone = w.zone('barracks', tilesOf(w, room));
    apply({ type: 'CreateSquad', name: k === 0 ? 'The Hearthguard' : 'The Cold Bolts' });
    const squad = w.readers.of<{ squads(): { id: EntityId; name: string }[] }>('16').squads().find((s) => s.name === (k === 0 ? 'The Hearthguard' : 'The Cold Bolts'));
    if (squad === undefined) throw new Error('reference fortress: squad missing');
    squadIds.push(squad.id);
    apply({ type: 'SetSquadMembers', squadId: squad.id, members: dwarves.slice(k * REFERENCE_SHAPE.squadSize, (k + 1) * REFERENCE_SHAPE.squadSize) });
    apply({ type: 'SetSquadMode', squadId: squad.id, mode: k === 0 ? 'train' : 'active' });
    apply({ type: 'SetZoneSetting', zoneId: zone, key: 'squad', value: squad.id });
    const rack = tilesOf(w, room);
    for (let j = 0; j < 6; j += 1) {
      w.spawnItem('spear', 'iron', rack[j] as TileIndex, 1);
      w.spawnItem('mail_shirt', 'iron', rack[6 + j] as TileIndex, 1);
      w.spawnItem('helm', 'iron', rack[12 + j] as TileIndex, 1);
      w.spawnItem('shield', 'oak', rack[18 + j] as TileIndex, 1);
    }
  }

  // --- labors by profession template: no one does everything
  const squadMembers = new Set(squadIds.flatMap((id) => w.readers.of<{ squads(): { id: EntityId; members: EntityId[] }[] }>('16').squads().find((s) => s.id === id)?.members ?? []));
  const professions = ['miner', 'hauler', 'farmer', 'crafter', 'crafter', 'hauler', 'farmer', 'crafter'] as const;
  const laborIds = w.game.registry.table<{ id: string }>('labors').ids();
  dwarves.forEach((dwarf, index) => {
    const template = LABOR_TEMPLATES.find((t) => t.id === (squadMembers.has(dwarf) ? 'soldier' : professions[index % professions.length]));
    if (template === undefined) throw new Error('reference fortress: template missing');
    for (const labor of laborIds) w.setLabor(dwarf, labor, template.labors.includes(labor));
  });

  // --- stock: logs and stone and plants for the twelve standing orders, food and drink for a season
  const stockTiles = stockpiles.map((s) => s.tiles);
  const put = (stockpile: number, k: number): TileIndex => (stockTiles[stockpile] as TileIndex[])[k % 25] as TileIndex;
  w.spawnItem('log', 'oak', put(4, 0), 120);
  w.spawnItem('raw_stone', 'granite', put(3, 0), 200);
  w.spawnItem('stone_block', 'granite', put(3, 1), 60);
  // A season of eating and drinking for 80 dwarves, and then some.
  w.spawnItem('plant_food', 'barley', put(0, 0), 1_500);
  w.spawnItem('drink', 'ale', put(1, 0), 4_000);
  w.spawnItem('easy_meal', 'meal', put(0, 1), 4_000);
  w.spawnItem('raw_hide', 'leather', put(5, 0), 40);
  w.spawnItem('cloth', 'wool_cloth', put(5, 1), 40);
  w.spawnItem('thread', 'wool_thread', put(5, 2), 40);
  w.spawnItem('plant_food', 'flax', put(0, 2), 60);

  // The larder was laid in cold: no meal or plant food spoils during the season the fixture is checked over (meals
  // rot after 14 days, plant food after 20, and a season is 28).
  const keptCold = new Set([w.game.registry.table('items').index('easy_meal'), w.game.registry.table('items').index('plant_food')]);
  for (const id of entities.with(C.Item)) {
    const item = entities.get(id, C.Item);
    if (item !== undefined && keptCold.has(item.type)) entities.add(id, C.Item, { ...item, rotStart: item.rotStart + DAYS_PER_SEASON * TICKS_PER_DAY });
  }

  // --- the twelve standing orders (the workshops take their components on a tick)
  w.step(1);

  // The river cuts the map in two: every dwarf the base put on the far bank walks to the settlement's side, where the
  // food, the drink and the work are.
  const hub = put(0, 0);
  const near = sites.filter((t) => w.reachable(t, hub)).sort((a, b) => Math.abs(w.map.xOf(a) - wagon.x) + Math.abs(w.map.yOf(a) - wagon.y) - Math.abs(w.map.xOf(b) - wagon.x) - Math.abs(w.map.yOf(b) - wagon.y) || a - b);
  let moved = 0;
  for (const dwarf of dwarves) {
    const at = entities.get(dwarf, C.Position);
    if (at === undefined || w.reachable(w.index(at.x, at.y, at.z), hub)) continue;
    const to = near[(moved * 7 + 3) % Math.max(1, Math.min(near.length, 400))] as TileIndex;
    if (!w.game.world.services.movement?.teleport(dwarf, to)) throw new Error('reference fortress: a dwarf could not be moved to the settlement');
    moved += 1;
  }
  for (const [type, recipe, keep] of ORDERS) {
    const id = workshopIds.get(type);
    if (id === undefined) throw new Error(`reference fortress: no ${type}`);
    apply({ type: 'AddWorkOrder', workshopId: id, order: { recipeId: recipe, mode: 'maintain', threshold: keep, remaining: 1, priority: 5 } });
  }

  // --- zones of four tiles for bedrooms, meeting areas and dining halls, up to 60 in all
  const used = new Set<TileIndex>();
  const zoneTypes = ['bedroom', 'meeting_area', 'dining_hall'] as const;
  let zoneCount = entities.with(C.Zone).length;
  for (const at of ground.rest()) {
    if (zoneCount >= 60) break;
    const x = w.map.xOf(at);
    const y0 = w.map.yOf(at);
    const z = w.map.zOf(at);
    if (x % 3 !== 0 || y0 % 3 !== 0) continue;
    const group = [at, w.index(x + 1, y0, z), w.index(x, y0 + 1, z), w.index(x + 1, y0 + 1, z)];
    const type = zoneTypes[zoneCount % zoneTypes.length] as string;
    for (const tile of group) w.discover(tile);
    if (group.some((tile) => used.has(tile) || !buildings.zoneTileQualifies(type, tile) || buildings.zoneAt(tile) !== 0 || w.map.buildingAtTile(tile) !== 0)) continue;
    for (const tile of group) used.add(tile);
    w.zone(type, group);
    zoneCount += 1;
  }
  if (zoneCount < 60) throw new Error(`reference fortress has ${zoneCount} zones, expected at least 60`);

  // --- furniture to 600 buildings, as the first fixture had
  const buildingTypes = ['bed', 'chair', 'table', 'paved_floor', 'chain_post', 'statue'] as const;
  let buildingCount = entities.with(C.Building).length;
  for (const at of ground.rest()) {
    if (buildingCount >= 600) break;
    if (used.has(at)) continue;
    const type = buildingTypes[buildingCount % buildingTypes.length] as string;
    w.discover(at);
    if (buildings.zoneAt(at) !== 0 || buildings.ghost(type, at, 0).reason !== null) continue;
    w.build(type, at, type === 'statue' || type === 'paved_floor' ? 'granite' : 'oak');
    used.add(at);
    buildingCount += 1;
  }
  if (buildingCount < 600) throw new Error(`reference fortress has ${buildingCount} buildings, expected at least 600`);

  w.step(1);
  if (entities.with(C.Item).length < 25_000) throw new Error('reference fortress lost item entities during setup');
  return w;
}

export async function ensureScriptedReference(now: () => number): Promise<HeadlessGame> {
  if (existsSync(REFERENCE_PATH)) return (await loadGame(readFileSync(REFERENCE_PATH), { now })).game;
  const w = buildScriptedReference();
  const bytes = await saveGame(w.game, { kind: 'manual' });
  mkdirSync(fileURLToPath(new URL('../fixtures/', import.meta.url)), { recursive: true });
  writeFileSync(REFERENCE_PATH, bytes);
  return (await loadGame(bytes, { now })).game;
}
