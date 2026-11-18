/**
 * T-588: the three-year fortress plays a little of Making Do (reports/designs/2026-11-06-making-do-
 * content-and-scarcity.md), as a player of a temperate forest would. T-583's audit found the script
 * ordered nothing of it but the straw bed, so no gate that plays a fortress measured the kiln, the
 * cellar, bedding, spirits, compost or the Thane's whim.
 *
 * From the second year (`MAKING_DO_FROM_DAY`), so the first year the sweep measures is played as before
 * (the cellar is set in the first year, where it ages nothing yet):
 * - a kiln crushes the fossils the miners dig to bone ash, fires the clay into bricks and mugs for the
 *   tables, and burns a little potash; the Hillfolk are asked for clay, which the peril-0 maps lack;
 * - a loom spins the gatherers' nettle fiber and reeds into thread and cloth, and a clothier stuffs the
 *   cloth the hospital can spare with straw into bedding and pillows, so the beds are made up;
 * - the still distils spirits behind its brew, and the larder's drink stockpile is a cellar;
 * - a compost heap beside the pasture, every farm plot fertilized, and the Hillfolk's dung bought;
 * - a candle stand in the dining hall, burning the Hillfolk's tallow candles (asked for and bought);
 * - the Thane's whim answered when it is something the fortress makes: fine meals, spirits, or mead
 *   from the honey it buys. Once the fortress has the spirits or the mead the Thane asked for, the
 *   player sets them aside (forbids them) so the dwarves do not drink them, and gives them back to the
 *   stocks just before the season's end, when the whim is judged on what is in stock. Fine meals are
 *   not set aside: forbidden, they are hauled to no barrel, and rot (T-588's probe: 23 set aside on day
 *   143 of `three-years-p2-1`, 5 left on day 157); the kitchen keeps them in stock instead.
 * The strand's orders stand behind the script's own at a workshop they share (the still's distilling
 * behind its brew), except single jobs: one chest for the clothier, and a whim's fine meals or mead.
 */
import { C, ItemFlag } from '@core/components';
import { DAYS_PER_SEASON, DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';
import type { ItemsReader } from '@systems/items';
import type { PlantsReader } from '@systems/plants';
import type { TradeReader } from '@systems/trade/reader';
import { command } from './script-commands';
import { BED_CLOTH_KEPT, BUILD, owned, placeEconomyBuilding, ROUTINE } from './three_years_economy';
import { siteTiles, standingOrders, type FortressState, type StandingOrder } from './three_years_fortress';
import type { TestWorld } from './test-world';

/** The day (0-based) the strand starts: the first day of year 2. */
export const MAKING_DO_FROM_DAY = DAYS_PER_YEAR;

/** The strand's workshops and where they go, from the fortress centre (below ground once the workshop hall stands). */
const WORKSHOPS: readonly (readonly [string, number, number])[] = [['kiln', 16, 10], ['loom', 16, 14], ['clothier', 20, 12]];

/** The kiln: bone ash from fossils, mugs and bricks from clay, a little potash from a log. */
const KILN_ORDERS: readonly StandingOrder[] = [
  { recipeId: 'crush_fossil', threshold: 6 },
  { recipeId: 'make_mugs_clay', threshold: 3 },
  { recipeId: 'fire_bricks', threshold: 6 },
  { recipeId: 'burn_potash', threshold: 2 },
];

/**
 * The loom: coarse thread from nettle fiber and reeds, then cloth while the fortress has little (the
 * hospital's and a bed's worth). A function: the economy module, which this one and the fortress's
 * import in a cycle, may not have set BED_CLOTH_KEPT when this module is first read.
 */
function loomOrders(): readonly StandingOrder[] {
  return [
    { recipeId: 'spin_coarse_thread', threshold: 2 },
    { recipeId: 'weave_cloth', threshold: BED_CLOTH_KEPT + 4 },
  ];
}

/** Deepfire the still keeps behind its brew, and while the Thane wishes for something strong. */
const SPIRITS_KEPT = 10;
const SPIRITS_FOR_WHIM = 20;
/** The kitchen's fine meals (its own order keeps 10), and while the Thane wishes for fine meals for everyone (20). */
const FINE_MEALS_KEPT = 10;
const FINE_MEALS_FOR_WHIM = 25;
/** Honey a mead brew takes, and the honey bought for a mead whim. */
const MEAD_HONEY = 4;
const HONEY_KEPT = 10;
/** Candles bought while the fortress has fewer: two fillings of the stand. */
const CANDLES_KEPT = 10;
/** Fertilizer (dung, compost, bone ash) under which the Hillfolk's dung is bought. */
const FERTILIZER_KEPT = 20;
/** The whims the strand answers: things the fortress makes. */
const ANSWERED_WHIMS: ReadonlySet<string> = new Set(['whim_fine_meal', 'whim_spirits', 'whim_mead']);
const SEASON_TICKS = DAYS_PER_SEASON * TICKS_PER_DAY;
/**
 * The Thane's share goes back to the stocks this many ticks before the season ends and the whim is
 * judged: more than two of the script's looks (300 ticks apart), so one falls in the window, and
 * half a day of drinking and eating at most.
 */
const RELEASE_TICKS = 600;

/** Whether the strand has started (a stub state without phases, as T-141's trade test passes, has not). */
export function makingDo(state: FortressState): boolean {
  return (state.economy.phases as ReadonlySet<string> | undefined)?.has('making do') === true;
}

/**
 * The goods the strand buys from a caravan, by item type, with the trade's wish-list priority: tallow
 * candles for the stand while fewer than CANDLES_KEPT, dung while the fertilizer runs low, and honey
 * for the Thane's mead (first, while a mead whim stands).
 */
export function makingDoPurchases(w: TestWorld, state: FortressState): Map<string, number> {
  const wants = new Map<string, number>();
  if (!makingDo(state)) return wants;
  if (owned(w, 'candle') < CANDLES_KEPT) wants.set('candle', 5);
  if (owned(w, 'dung') + owned(w, 'compost') + owned(w, 'bone_ash') < FERTILIZER_KEPT) wants.set('dung', 5);
  if (w.readers.of<DwarvesReader>('10').whim()?.id === 'whim_mead') wants.set('honey', 3);
  else if (owned(w, 'honey') < HONEY_KEPT) wants.set('honey', 5);
  return wants;
}

function orderIndex(w: TestWorld, workshopId: number, recipeId: string): number {
  const recipe = w.game.registry.table('recipes').index(recipeId);
  return (w.game.world.entities.get(workshopId, C.Workshop)?.orders ?? []).findIndex((o) => o.recipe === recipe);
}

/** Keeps a `maintain` order of a workshop at a threshold. */
function keepThreshold(w: TestWorld, workshopId: number, recipeId: string, threshold: number): void {
  const at = orderIndex(w, workshopId, recipeId);
  const order = at < 0 ? undefined : w.game.world.entities.get(workshopId, C.Workshop)?.orders[at];
  if (order && order.mode === 'maintain' && order.threshold !== threshold) command(w, { type: 'EditWorkOrder', workshopId, index: at, patch: { threshold } });
}

/** Moves a workshop's order of a recipe to the front, or (`first` false) to the back. */
function moveOrder(w: TestWorld, workshopId: number, recipeId: string, first: boolean): void {
  const at = orderIndex(w, workshopId, recipeId);
  const last = (w.game.world.entities.get(workshopId, C.Workshop)?.orders.length ?? 0) - 1;
  const to = first ? 0 : last;
  if (at >= 0 && at !== to) command(w, { type: 'ReorderWorkOrder', workshopId, from: at, to });
}

/** The fortress's own items of a type (and material) that nothing holds: not forbidden, reserved, owned, installed or carried. */
function freeItems(w: TestWorld, typeId: string, materialId?: string): { id: number; count: number }[] {
  const ent = w.game.world.entities;
  const type = w.game.registry.table('items').index(typeId);
  const material = materialId === undefined ? -1 : w.game.registry.table('materials').index(materialId);
  const held = ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Installed | ItemFlag.Merchant | ItemFlag.Foreign;
  const out: { id: number; count: number }[] = [];
  for (const id of ent.with(C.Item)) {
    const it = ent.get(id, C.Item)!;
    if (it.type !== type || (material >= 0 && it.material !== material) || (it.flags & held) !== 0 || it.carriedBy) continue;
    out.push({ id, count: it.count });
  }
  return out.sort((a, b) => a.id - b.id);
}

function forbid(w: TestWorld, ids: readonly number[], on: boolean): void {
  for (const itemId of ids) if (w.game.world.entities.alive(itemId)) command(w, { type: 'ForbidItem', itemId, on }, ['not_found']);
}

/**
 * The Thane's share, at every look of the script: once the fortress has what an answered whim asks
 * for, it is set aside (forbidden), and it goes back to the stocks RELEASE_TICKS before the season
 * ends, so the judgement finds it in stock. Only what does not rot is set aside.
 */
export function keepThanesShare(w: TestWorld, state: FortressState): void {
  if (!makingDo(state)) return;
  const economy = state.economy;
  const whim = w.readers.of<DwarvesReader>('10').whim();
  const closing = (Math.floor(w.tick / SEASON_TICKS) + 1) * SEASON_TICKS - w.tick <= RELEASE_TICKS;
  const share = economy.thaneShare;
  if (share !== undefined && (closing || whim?.id !== share.whim)) {
    forbid(w, share.items, false);
    delete economy.thaneShare;
  }
  if (whim === null || !ANSWERED_WHIMS.has(whim.id) || economy.thaneShare !== undefined || closing) return;
  const row = w.game.registry.table<{ id: string; item: string; material?: string; count: number }>('whims').byId(whim.id);
  if (!row || (w.game.registry.table<{ id: string; rotDays: number }>('items').byId(row.item)?.rotDays ?? 0) > 0) return;
  const free = freeItems(w, row.item, row.material);
  if (free.reduce((n, it) => n + it.count, 0) < row.count) return;
  const items: number[] = [];
  let units = 0;
  for (const it of free) {
    if (units >= row.count) break;
    items.push(it.id);
    units += it.count;
  }
  forbid(w, items, true);
  economy.thaneShare = { whim: whim.id, items };
}

export function checkMakingDo(w: TestWorld, state: FortressState, day: number): void {
  const { phases } = state.economy;
  const buildings = w.readers.of<BuildingsReader>('14');
  // The larder's drink stockpile, dark and below ground, is a cellar from the day it is zoned (in the
  // first year): a drink ages after a year in it, so the setting changes nothing in the first year, and
  // set only from the second it would age nothing before the third year's end.
  const larder = state.economy.larder;
  if (larder !== undefined && larder.drinkZoneId > 0 && !phases.has('cellar') && buildings.zone(larder.drinkZoneId) !== undefined) {
    phases.add('cellar');
    command(w, { type: 'SetStockpileCellar', zoneId: larder.drinkZoneId, on: true });
  }
  if (day < MAKING_DO_FROM_DAY) return;
  const items = w.readers.of<ItemsReader>('13');
  const built = (key: string): number => {
    const id = state.placedIds[key];
    return id !== undefined && buildings.get(id)?.state === 'built' ? id : 0;
  };
  if (!phases.has('making do')) {
    phases.add('making do');
    // Clay for the kiln, which the peril-0 maps lack, and tallow candles for the stand.
    const asked = w.readers.of<TradeReader>('20').requests('hillfolk').map((r) => ({ ...r }));
    command(w, { type: 'SetRequests', civ: 'hillfolk', entries: [...asked, { itemType: 'soil_load', material: 'clay', priority: 1 }, { itemType: 'candle', material: 'tallow', priority: 1 }] });
    // Honey for the Thane's mead.
    const wildwood = w.readers.of<TradeReader>('20').requests('wildwood').map((r) => ({ ...r }));
    command(w, { type: 'SetRequests', civ: 'wildwood', entries: [...wildwood, { itemType: 'honey', material: 'honey', priority: 1 }] });
  }

  for (const [type, dx, dy] of WORKSHOPS) placeEconomyBuilding(w, state, type, dx, dy);
  for (const [key, orders] of [['kiln', KILN_ORDERS], ['loom', loomOrders()]] as const) {
    const id = built(key);
    if (id === 0 || state.orderedWorkshops.has(key)) continue;
    state.orderedWorkshops.add(key);
    standingOrders(w, id, orders);
  }

  // The clothier is built of a table and a chest: one chest, first at the carpenter (its beds and
  // barrels never run out, and a chest behind them waited for months).
  const carpenter = built('carpenter');
  const clothier = state.placedIds['clothier'];
  if (clothier !== undefined && buildings.get(clothier)?.state !== 'built' && carpenter !== 0 && !phases.has('clothier chest') && items.available('chest') === 0) {
    phases.add('clothier chest');
    command(w, { type: 'AddWorkOrder', workshopId: carpenter, order: { recipeId: 'make_chest_wood', mode: 'once', remaining: 1, priority: ROUTINE } });
    moveOrder(w, carpenter, 'make_chest_wood', true);
  }
  // Bedding and a pillow for a bed that has none, from the cloth the hospital leaves over.
  const clothierId = built('clothier');
  if (clothierId !== 0 && orderIndex(w, clothierId, 'make_bedding') < 0) {
    const beds = buildings.byType('bed').filter((id) => buildings.get(id)?.state === 'built').length;
    if (beds > owned(w, 'bedding') && items.available('cloth') >= BED_CLOTH_KEPT + 3) {
      command(w, { type: 'AddWorkOrder', workshopId: clothierId, order: { recipeId: 'make_bedding', mode: 'once', remaining: 1, priority: ROUTINE } });
      if (orderIndex(w, clothierId, 'make_pillow') < 0) command(w, { type: 'AddWorkOrder', workshopId: clothierId, order: { recipeId: 'make_pillow', mode: 'once', remaining: 1, priority: ROUTINE } });
    }
  }

  // Spirits behind the brew, and the Thane's whim when it is something the fortress makes: until its
  // share is set aside, more spirits, the kitchen's fine meals first, or the honey bought brewed to mead.
  const whim = w.readers.of<DwarvesReader>('10').whim();
  const wanting = (id: string): boolean => whim?.id === id && state.economy.thaneShare === undefined;
  const still = built('still');
  if (still !== 0) {
    if (!state.orderedWorkshops.has('distill')) {
      state.orderedWorkshops.add('distill');
      standingOrders(w, still, [{ recipeId: 'distill', threshold: SPIRITS_KEPT }]);
    }
    keepThreshold(w, still, 'distill', wanting('whim_spirits') ? SPIRITS_FOR_WHIM : SPIRITS_KEPT);
    if (wanting('whim_mead') && items.available('honey') >= MEAD_HONEY && orderIndex(w, still, 'brew_mead') < 0) {
      if (command(w, { type: 'AddWorkOrder', workshopId: still, order: { recipeId: 'brew_mead', mode: 'once', remaining: 1, priority: ROUTINE } }).ok) moveOrder(w, still, 'brew_mead', true);
    }
  }
  const kitchen = built('kitchen');
  if (kitchen !== 0) {
    const fine = wanting('whim_fine_meal');
    keepThreshold(w, kitchen, 'cook_fine_meal', fine ? FINE_MEALS_FOR_WHIM : FINE_MEALS_KEPT);
    if (fine !== phases.has('fine meals first')) {
      moveOrder(w, kitchen, 'cook_fine_meal', fine);
      if (fine) phases.add('fine meals first');
      else phases.delete('fine meals first');
    }
  }

  // A compost heap beside the pasture, for its dung and the fortress's spoiled food; every plot fertilized.
  if (!phases.has('compost')) {
    const tiles = siteTiles(w, 'compost', state.cx + 8, state.cy + 16, 3, 3, state.z, { x: state.cx + 6, y: state.cy + 6 }, 4);
    if (tiles.length >= 4 && command(w, { type: 'CreateZone', zoneType: 'compost', tiles }).ok) phases.add('compost');
  }
  const plants = w.readers.of<PlantsReader>('07');
  for (const zoneId of buildings.zonesOfType('farm_plot')) {
    if (!plants.plotFertilize(zoneId)) command(w, { type: 'SetZoneSetting', zoneId, key: 'fertilize', value: true });
  }

  // A candle stand between the dining hall's two tables lights every seat.
  if (state.diningHallSetup && !phases.has('candle stand')) {
    const origin = w.index(state.cx + 2, state.cy + 6, state.hallZ);
    if (buildings.at(origin) === 0 && buildings.ghost('candle_stand', origin, 0).reason === null &&
        command(w, { type: 'PlaceBuilding', buildingType: 'candle_stand', origin, orientation: 0, materialChoice: 0, priority: BUILD }).ok) {
      phases.add('candle stand');
      (state.hallFurniture ??= []).push({ type: 'candle_stand', origin, priority: BUILD });
    }
  }
}
