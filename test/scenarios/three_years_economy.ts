/** Player economy for T-M8-06. All changes go through commands and ordinary jobs. */
import { C, ItemFlag } from '@core/components';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { TerrainReader } from '@systems/terrain/reader';
import type { TradeReader } from '@systems/trade/reader';
import { requiredValue } from '@systems/trade/valuation';
import type { JobsReader } from '@systems/jobs';
import { HALL_Z, type FortressState } from './three_years_fortress';
import type { TestWorld } from './test-world';
import { threeYearsMeasurements } from './three_years_measurements';

export interface EconomyState {
  lastDay: number;
  readonly phases: Set<string>;
  readonly traded: Set<string>;
  readonly mined: Set<number>;
}

function order(w: TestWorld, workshopId: number, recipeId: string, threshold: number, materialFilter?: string): void {
  const result = w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId,
    order: { recipeId, mode: 'maintain', threshold, priority: 3, ...(materialFilter ? { materialFilter } : {}) } });
  if (!result.ok) throw new Error(`economy order ${recipeId}: ${result.reason}`);
}

/** Dig an upper-rock mine, above the cavern bands. */
function mine(w: TestWorld, state: FortressState, wanted: (id: string, cls: string) => boolean, limit: number, priority = 3): void {
  const { cx, cy, economy } = state;
  const map = w.map;
  const materials = w.game.registry.table<{ id: string; class: string }>('materials');
  const candidates: number[] = [];
  for (let z = 23; z <= HALL_Z; z += 1) {
    for (let y = 2; y < map.h - 2; y += 1) {
      for (let x = 2; x < map.w - 2; x += 1) {
        const t = w.index(x, y, z);
        const mat = materials.byIndex(map.materialAt(t));
        if (map.kindAt(t) === TileKind.Wall && mat && wanted(mat.id, mat.class) && !economy.mined.has(t)) candidates.push(t);
      }
    }
  }
  // Generation's own tile data chooses the nearest accessible deposit, never a reseeded map.
  candidates.sort((a, b) => {
    const distance = (t: number): number => Math.abs(map.xOf(t) - cx - 6) + Math.abs(map.yOf(t) - cy - 15) + (HALL_Z - map.zOf(t)) * 4;
    return distance(a) - distance(b) || a - b;
  });
  const targets = candidates.slice(0, limit);
  const dig = new Set<number>();
  for (const t of targets) {
    const x = map.xOf(t), y = map.yOf(t), z = map.zOf(t);
    // A separate mine shaft south of the entrance keeps the farm stair free.
    const sx = cx + 6, sy = Math.min(map.h - 3, cy + 15);
    for (let xx = Math.min(sx, x); xx <= Math.max(sx, x); xx += 1) dig.add(w.index(xx, sy, z));
    for (let yy = Math.min(sy, y); yy <= Math.max(sy, y); yy += 1) dig.add(w.index(x, yy, z));
    economy.mined.add(t);
  }
  const tiles = [...dig].filter((t) => map.kindAt(t) === TileKind.Wall && map.fluidLevelAt(t) === 0 && !map.hasFlag(t, TileFlag.Constructed) &&
    !(map.xOf(t) === cx + 6 && map.yOf(t) === Math.min(map.h - 3, cy + 15)));
  if (tiles.length) {
    const result = w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority, tiles });
    if (!result.ok) throw new Error(`economy mine: ${result.reason}`);
  }
}

export function placeEconomyBuilding(w: TestWorld, state: FortressState, type: string, dx: number, dy: number): void {
  if (state.placedIds[type]) {
    const built = w.readers.of<BuildingsReader>('14').get(state.placedIds[type]!);
    if (built?.state === 'built' && state.economy.phases.has(`traffic:${type}`)) {
      w.game.world.applyCommand({ type: 'SetTraffic', tiles: [0, 2, 6, 8].map((i) => built.footprint[i]!), mode: 'normal' });
      state.economy.phases.delete(`traffic:${type}`);
    }
    return;
  }
  const buildings = w.readers.of<BuildingsReader>('14');
  const candidates: number[] = [];
  for (let y = Math.max(2, state.cy + dy - 12); y <= Math.min(w.map.h - 4, state.cy + dy + 12); y += 1) {
    for (let x = Math.max(2, state.cx + dx - 12); x <= Math.min(w.map.w - 4, state.cx + dx + 12); x += 1) candidates.push(w.index(x, y, 32));
  }
  candidates.sort((a, b) => {
    const distance = (t: number): number => Math.abs(w.map.xOf(t) - state.cx - dx) + Math.abs(w.map.yOf(t) - state.cy - dy);
    return distance(a) - distance(b) || a - b;
  });
  const origin = candidates.find((t) => {
    const ghost = buildings.ghost(type, t, 0);
    return ghost.reason === null && ghost.tiles.every((tile) => buildings.zoneAt(tile) === 0 &&
      !w.game.world.entities.with(C.Creature).some((id) => {
        const p = w.game.world.entities.get(id, C.Position);
        return p && w.index(p.x, p.y, p.z) === tile;
      }));
  });
  if (origin === undefined) return;
  const result = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: type, origin, orientation: 0, materialChoice: 0, priority: 2 });
  if (result.ok) {
    state.placedIds[type] = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding;
    const b = buildings.get(state.placedIds[type]!)!;
    if (b.footprint.length === 9 && type !== 'trade_depot') {
      w.game.world.applyCommand({ type: 'SetTraffic', tiles: [0, 2, 6, 8].map((i) => b.footprint[i]!), mode: 'forbidden' });
      state.economy.phases.add(`traffic:${type}`);
    }
  }
}

function trade(w: TestWorld, state: FortressState): void {
  const reader = w.readers.of<TradeReader>('20');
  const buildings = w.readers.of<BuildingsReader>('14');
  const depot = buildings.depots()[0];
  if (!depot) return;
  const ent = w.game.world.entities;
  const types = w.game.registry.table<{ id: string; category: string }>('items');
  const items = w.readers.of<ItemsReader>('13');
  // Export crafts and surplus prepared meals, as balance.md's caravan arithmetic describes.
  const jobs = w.readers.of<JobsReader>('11');
  const population = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length;
  let mealSurplus = items.available('easy_meal') + items.available('fine_meal') + items.available('lavish_meal') - Math.ceil(population * 0.48 * 14);
  const exports = ent.with(C.Item).filter((id) => {
    const it = ent.get(id, C.Item);
    if (!it || it.carriedBy || jobs.byKey(`depot:${id}`) ||
      (it.flags & (ItemFlag.Foreign | ItemFlag.Merchant | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Installed | ItemFlag.AtDepot))) return false;
    const type = types.byIndex(it.type);
    if (type?.category.startsWith('craft/')) return true;
    if (type?.id === 'lavish_meal' && reader.activeCaravan() && mealSurplus >= it.count) { mealSurplus -= it.count; return true; }
    return false;
  }).slice(0, 20);
  if (exports.length) {
    const result = w.game.world.applyCommand({ type: 'MoveToDepot', depotId: depot, itemIds: exports });
    if (result.ok) for (const id of exports) {
      const job = jobs.byKey(`depot:${id}`);
      if (job) w.game.world.applyCommand({ type: 'SetJobPriority', jobId: job.id, priority: reader.activeCaravan() ? 1 : 3 });
    }
  }
  const caravan = reader.activeCaravan();
  if (!caravan || caravan.state !== 'atDepot') return;
  const day = Math.floor(w.tick / TICKS_PER_DAY);
  const key = `${Math.floor(day / DAYS_PER_YEAR)}:${caravan.civ}`;
  if (state.economy.traded.has(key)) return;
  if (!reader.sessionOpen()) {
    w.game.world.applyCommand({ type: 'TradeOpen', depotId: depot });
    const job = w.readers.of<JobsReader>('11').byKey(`trade:${depot}`);
    if (job) w.game.world.applyCommand({ type: 'SetJobPriority', jobId: job.id, priority: 1 });
    return;
  }
  const give = reader.depotItems().filter((id) => {
    const type = types.byIndex(ent.get(id, C.Item)?.type ?? -1);
    return (type?.category.startsWith('craft/') || type?.id === 'lavish_meal') && reader.valuation(caravan.civ, id) > 0;
  });
  const budget = give.reduce((s, id) => s + reader.valuation(caravan.civ, id), 0);
  if (budget === 0) return;
  const priority = (id: number): number => {
    const it = ent.get(id, C.Item);
    const type = types.byIndex(it?.type ?? -1)?.id ?? '';
    if (type === 'anvil' && items.count('anvil') === 0) return 0;
    if (type === 'log' && items.available('log') < 40) return 1;
    if (type === 'bar' || type === 'charcoal_bar') return 2;
    if (type === 'plant_food' || type === 'seed') return 3;
    if (type === 'cloth' || type === 'thread') return 4;
    if (type === 'rough_gem') return 5;
    return 6;
  };
  const goods = reader.merchantItems().filter((id) => ent.get(id, C.Item)?.containerId === depot && !ent.get(id, C.Item)?.occupantId)
    .sort((a, b) => priority(a) - priority(b) || a - b);
  const take: { itemId: number; count: number }[] = [];
  let cost = 0;
  for (const id of goods) {
    if (priority(id) === 6) continue;
    const it = ent.get(id, C.Item)!;
    const unitPrice = reader.price(caravan.civ, id) / it.count;
    const count = Math.min(it.count, Math.floor((budget / (1 + reader.marginPercent(caravan.civ) / 100) - cost) / unitPrice));
    if (count > 0) { take.push({ itemId: id, count }); cost += unitPrice * count; }
  }
  if (!take.length || requiredValue(cost, reader.marginPercent(caravan.civ)) > budget) return;
  // Offer just enough crafts, keeping surplus exports for the next caravan.
  let offered = 0;
  const selected: { itemId: number; count: number }[] = [];
  for (const id of give) {
    const it = ent.get(id, C.Item)!;
    const value = reader.valuation(caravan.civ, id) / it.count;
    const count = Math.min(it.count, Math.ceil((requiredValue(cost, reader.marginPercent(caravan.civ)) - offered) / value));
    if (count > 0) { selected.push({ itemId: id, count }); offered += count * value; }
    if (offered >= requiredValue(cost, reader.marginPercent(caravan.civ))) break;
  }
  const foreign = new Set(w.game.world.entities.with(C.Item).filter((id) => (w.game.world.entities.get(id, C.Item)!.flags & ItemFlag.Merchant) !== 0));
  const result = w.game.world.applyCommand({ type: 'TradeOffer', give: selected, take });
  const acquired = w.game.world.entities.with(C.Item).filter((id) => (foreign.has(id) && (ent.get(id, C.Item)!.flags & ItemFlag.Merchant) === 0) ||
    (!foreign.has(id) && !give.includes(id) && ent.get(id, C.Item)?.containerId === depot));
  if (result.ok && acquired.length > 0) {
    const purchasesNow = reader.depotItems().filter((id) => !give.includes(id) && ((foreign.has(id) && (ent.get(id, C.Item)!.flags & ItemFlag.Merchant) === 0) || !foreign.has(id)));
    for (const id of purchasesNow) threeYearsMeasurements(w).purchases.add(id);
    state.economy.traded.add(key);
    w.game.world.applyCommand({ type: 'TradeCancel' });
    const purchases = reader.depotItems().filter((id) => !types.byIndex(ent.get(id, C.Item)?.type ?? -1)?.category.startsWith('craft/'));
    if (purchases.length) w.game.world.applyCommand({ type: 'RemoveFromDepot', depotId: depot, itemIds: purchases });
  }
}

export function checkEconomy(w: TestWorld, state: FortressState): void {
  const day = Math.floor(w.tick / TICKS_PER_DAY);
  if (state.economy.lastDay === day) return;
  state.economy.lastDay = day;
  const buildings = w.readers.of<BuildingsReader>('14');
  for (const [type, dx] of [['carpenter', -8], ['mason', -4], ['still', 0], ['kitchen', 4], ['craftdwarf', 8]] as const) placeEconomyBuilding(w, state, type, dx, 10);
  if (day >= 5) {
    placeEconomyBuilding(w, state, 'trade_depot', -9, 4);
    if (!state.economy.phases.has('requests')) {
      state.economy.phases.add('requests');
      w.game.world.applyCommand({ type: 'SetRequests', civ: 'mountainhome', entries: [{ itemType: 'anvil', material: 'iron', priority: 3 }, { itemType: 'log', priority: 2 }, { itemType: 'bar', material: 'iron', priority: 1 }] });
    }
    trade(w, state);
  }
  if (day >= 30) {
    placeEconomyBuilding(w, state, 'wood_furnace', -12, 10);
    placeEconomyBuilding(w, state, 'smelter', -16, 10);
    placeEconomyBuilding(w, state, 'jeweler', -20, 10);
    for (const type of ['wood_furnace', 'smelter', 'jeweler']) {
      const id = state.placedIds[type];
      if (!id || buildings.get(id)?.state !== 'built' || state.orderedWorkshops.has(type)) continue;
      state.orderedWorkshops.add(type);
      if (type === 'wood_furnace') order(w, id, 'make_charcoal', 40);
      if (type === 'jeweler') order(w, id, 'cut_gem', 30);
      if (type === 'smelter') for (const ore of ['hematite', 'limonite', 'magnetite']) order(w, id, `smelt_${ore}`, 40);
    }
  }
  for (const [start, name, count] of [[30, 'first mine', 30], [112, 'second mine', 60], [224, 'third mine', 60]] as const) {
    if (day < start || state.economy.phases.has(name)) continue;
    if (!state.economy.phases.has('shaft')) {
      const result = w.game.world.applyCommand({ type: 'DesignateStairwell', x: state.cx + 6, y: Math.min(w.map.h - 3, state.cy + 15), zTop: HALL_Z, zBottom: 23, priority: 3 });
      if (!result.ok) continue;
      state.economy.phases.add('shaft');
    }
    state.economy.phases.add(name);
    mine(w, state, (id) => ['hematite', 'limonite', 'magnetite'].includes(id), count);
    // Open the gem access ahead of the larger bulk-ore expansion, as a player
    // prioritizes the jeweler's small supply without abandoning the metal industry.
    mine(w, state, (_id, cls) => cls === 'gem', 15, 2);
    if (start === 224) mine(w, state, (id) => ['limestone', 'marble', 'dolomite', 'chalk'].includes(id), 20);
  }
  const still = state.placedIds['still'];
  if (still && state.orderedWorkshops.has('still')) {
    const population = w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress').length;
    const threshold = Math.max(80, Math.ceil(population * 0.77 * 14));
    const ws = w.game.world.entities.get(still, C.Workshop);
    if (ws?.orders[0]?.threshold !== threshold) w.game.world.applyCommand({ type: 'EditWorkOrder', workshopId: still, index: 0, patch: { threshold } });
  }
  const carpenter = state.placedIds['carpenter'];
  if (carpenter && state.orderedWorkshops.has('carpenter')) {
    const threshold = day >= 224 ? 100 : day >= 112 ? 50 : 20;
    const ws = w.game.world.entities.get(carpenter, C.Workshop);
    if (ws?.orders[0]?.threshold !== threshold) w.game.world.applyCommand({ type: 'EditWorkOrder', workshopId: carpenter, index: 0, patch: { threshold } });
  }
  const kitchen = state.placedIds['kitchen'];
  if (day >= 56 && kitchen && state.orderedWorkshops.has('kitchen') && !state.economy.phases.has('lavish')) {
    state.economy.phases.add('lavish');
    order(w, kitchen, 'cook_lavish_meal', 120);
  }
  const forge = state.placedIds['forge'];
  if (forge && state.orderedWorkshops.has('forge') && !state.economy.phases.has('iron goods')) {
    state.economy.phases.add('iron goods');
    order(w, forge, 'forge_pick', 2, 'iron');
    order(w, forge, 'forge_battle_axe', 3, 'iron');
    for (const recipe of ['forge_helm', 'forge_greaves', 'forge_gauntlets', 'forge_metal_boots']) order(w, forge, recipe, 3, 'iron');
    // Missing steel inputs keep this standing order idle until year 3; no live job is canceled.
    order(w, forge, 'forge_crafts', 60, 'steel');
    order(w, forge, 'forge_crafts', 60, 'iron');
  }
  const smelter = state.placedIds['smelter'];
  if (day >= 224 && smelter && state.orderedWorkshops.has('smelter') && !state.economy.phases.has('steel')) {
    state.economy.phases.add('steel');
    const result = w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: smelter,
      order: { recipeId: 'alloy_steel', mode: 'once', remaining: 30, priority: 3 } });
    if (!result.ok) throw new Error(`economy steel: ${result.reason}`);
  }

  if (day >= 224) {
    const terrain = w.readers.of<TerrainReader>('03');
    const tiles = [...state.hearthHallTiles, ...state.diningHallTiles];
    const borders = new Set(tiles);
    for (const t of tiles) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const n = w.map.offset(t, dx, dy, 0);
      if (n >= 0 && w.map.kindAt(n) === TileKind.Wall) borders.add(n);
    }
    const engrave = [...borders].filter((t) => w.map.hasFlag(t, TileFlag.Smoothed) && !w.map.hasFlag(t, TileFlag.Engraved) && !terrain.designationAt(t));
    if (engrave.length) w.game.world.applyCommand({ type: 'Designate', kind: 'engrave', tiles: engrave, priority: 4 });
  }
}
