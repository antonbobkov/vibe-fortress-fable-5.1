/**
 * `10-dwarves.md` § The Thane's whim: what the Thane wishes for in a season (`personality-and-
 * thoughts.md` § Whims), whether the fortress could meet it, and whether it has. All face: 15 reads
 * only `WhimJudged`.
 */
import type { Registry } from '@core/registry';
import type { ReaderSetLike } from '@core/system';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemFilter, ItemsReader } from '@systems/items';
import { C, ItemFlag, type WorkOrder } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { DwarvesReader } from './reader';
import { recipeInputFilter, type RecipeRow as OperateRecipe } from '@systems/workshops/operate';
import { bestQuality } from '@systems/workshops/quality';

/** The whim's draw: a stream of its own, so a game without a Thane draws the same numbers. */
export const WHIMS_STREAM = '10.whims';

/** A row of `whims.json`. */
export interface WhimRow {
  readonly id: string;
  readonly kind: WhimKind;
  /** An item id (a room whim's building type, which is also its item), or `any`; none for `tier` and `engraved`. */
  readonly item?: string;
  /** A room whim's second building type, wanted beside the first. */
  readonly also?: string;
  readonly material?: string;
  readonly quality?: number;
  readonly bedding?: 'feather';
  readonly zone?: string;
  /** The zone is the Thane's own. */
  readonly thane?: boolean;
  readonly count: number;
  readonly text: string;
}

/** `stock`, `room`, `tier` (the hall a tier up) and `engraved` (the Thane's bedroom engraved). */
export type WhimKind = 'stock' | 'room' | 'tier' | 'engraved';

/** The highest room tier (royal): a `tier` whim is not possible at it. */
const TOP_ROOM_TIER = 5;

/**
 * The saved whim of the season: its row, the tick it was set and, for a `tier` whim, the tier wished
 * for (the hall's tier at the draw, plus one) (`DwarvesState.whim`).
 */
export interface Whim {
  readonly id: string;
  readonly setTick: number;
  readonly target?: number;
}

interface ItemRow { readonly id: string; readonly tags?: readonly string[] }
type RecipeInput = OperateRecipe['inputs'][number];
/** A recipe row as the draw reads it: 12's, with its outputs' material rule read as one shape. */
interface RecipeRow {
  readonly id: string;
  readonly workshop: string;
  readonly skill: string;
  readonly quality: boolean;
  readonly inputs: readonly RecipeInput[];
  readonly outputs: readonly {
    readonly item: string;
    readonly material: { readonly fixed?: string; readonly alloy?: string; readonly plantDrink?: boolean; readonly from?: string; readonly index?: number; readonly stage?: string };
  }[];
}

/** The whims of the content, in registry order; [] without the table. */
export function whimRows(registry: Registry): WhimRow[] {
  if (!registry.hasTable('whims')) return [];
  const table = registry.table<WhimRow>('whims');
  return table.ids().map((id) => table.byId(id) as WhimRow);
}

/** The stock a whim counts: its item type, of its material and quality when it names them. */
function stockFilter(registry: Registry, row: WhimRow): ItemFilter | null {
  if (row.item === undefined) return null;
  const items = registry.table<ItemRow>('items');
  const materials = registry.table('materials');
  const filter: ItemFilter = {};
  if (row.item !== 'any') {
    if (!items.has(row.item)) return null;
    filter.type = items.index(row.item);
  }
  if (row.material !== undefined) {
    if (!materials.has(row.material)) return null;
    filter.materialId = materials.index(row.material);
  }
  if (row.quality !== undefined) filter.minQuality = row.quality;
  return filter;
}

/**
 * The built buildings that answer a room whim: of its type and material, made up as it says, of its
 * quality or better (the building's item), in its zone; with a second type, the fewer of the two.
 */
function roomMatches(readers: ReaderSetLike, registry: Registry, row: WhimRow, thaneId: EntityId): number {
  const first = row.item === undefined ? 0 : roomMatchesOf(readers, registry, row, row.item, thaneId);
  return row.also === undefined ? first : Math.min(first, roomMatchesOf(readers, registry, row, row.also, thaneId));
}

function roomMatchesOf(readers: ReaderSetLike, registry: Registry, row: WhimRow, type: string, thaneId: EntityId): number {
  if (!readers.has('14')) return 0;
  const b14 = readers.of<BuildingsReader>('14');
  const items13 = readers.has('13') ? readers.of<ItemsReader>('13') : null;
  const materials = registry.table('materials');
  const material = row.material === undefined ? -1 : materials.has(row.material) ? materials.index(row.material) : -2;
  if (material === -2) return 0;
  let n = 0;
  for (const id of b14.byType(type)) {
    const b = b14.get(id);
    if (b === undefined || b.state !== 'built') continue;
    if (material >= 0 && b.material !== material) continue;
    if (row.quality !== undefined && (b.itemId === 0 || (items13?.get(b.itemId)?.quality ?? 0) < row.quality)) continue;
    if (row.bedding !== undefined && b14.bedding(id) !== row.bedding) continue;
    const zones = new Set(b.footprint.flatMap((t) => b14.zonesAt(t)));
    const inZone = Array.from(zones).some((z) => (row.zone === undefined || b14.zone(z)?.type === row.zone) &&
      (row.thane !== true || (thaneId !== 0 && b14.ownerOf(z) === thaneId)));
    if (inZone) n += 1;
  }
  return n;
}

/**
 * `10` § The Thane's whim, judged: a `stock` whim has at least `count` units of its item in stock
 * (available: not forbidden, reserved, owned or installed); a `room` whim has `count` built buildings
 * of its type in a zone of its type (the Thane's own when it says so); a `tier` whim's hall is of the
 * tier wished for or above; an `engraved` whim's bedroom has every smoothed tile engraved.
 */
export function whimMet(readers: ReaderSetLike, registry: Registry, row: WhimRow, thaneId: EntityId, whim?: Whim): boolean {
  const p = whimProgress(readers, registry, row, thaneId, whim);
  return p.count > 0 && p.have >= p.count;
}

/** The Thane's bedroom, or 0. */
function thaneBedroom(readers: ReaderSetLike, thaneId: EntityId): EntityId {
  return thaneId === 0 || !readers.has('14') ? 0 : readers.of<BuildingsReader>('14').bedroomOf(thaneId);
}

/**
 * How much of a whim the fortress has now, against what it asks, as the judgement counts them: units
 * of its item in stock (available) for a `stock` whim, built buildings that answer it for a `room`
 * whim, the hall's tier against the tier wished for for a `tier` whim, and the engraved tiles against
 * the engraved and smoothed ones of the Thane's bedroom for an `engraved` whim (0 of 0 without one).
 */
export function whimProgress(readers: ReaderSetLike, registry: Registry, row: WhimRow, thaneId: EntityId, whim?: Whim): { have: number; count: number } {
  if (row.kind === 'room') return { have: roomMatches(readers, registry, row, thaneId), count: row.count };
  if (row.kind === 'tier') {
    const have = readers.has('14') ? readers.of<BuildingsReader>('14').hearthHallTier() : 0;
    return { have, count: whim?.target ?? Math.min(TOP_ROOM_TIER, have + 1) };
  }
  if (row.kind === 'engraved') {
    const room = thaneBedroom(readers, thaneId);
    const d = room === 0 ? undefined : readers.of<BuildingsReader>('14').roomDiagnostics(room);
    return d === undefined ? { have: 0, count: 0 } : { have: d.engraved, count: d.engraved + d.plainSmoothed };
  }
  const filter = stockFilter(registry, row);
  if (filter === null || !readers.has('13')) return { have: 0, count: row.count };
  return { have: readers.of<ItemsReader>('13').countAvailable(filter), count: row.count };
}

/**
 * `10` § The Thane's whim, the Thane's drink: a standing `stock` whim of a drink of a named material
 * keeps its units from the fortress's throats while there are no more of them available than it asks
 * for. The materials kept now ([] or the whim's one).
 */
export function keptDrinkMaterials(readers: ReaderSetLike, registry: Registry, row: WhimRow): number[] {
  if (row.kind !== 'stock' || row.material === undefined || row.item === undefined || row.item === 'any') return [];
  const items = registry.table<ItemRow & { drinkable?: boolean }>('items');
  const materials = registry.table('materials');
  if (items.byId(row.item)?.drinkable !== true || !materials.has(row.material)) return [];
  const filter = stockFilter(registry, row);
  if (filter === null || !readers.has('13')) return [];
  return readers.of<ItemsReader>('13').countAvailable(filter) <= row.count ? [materials.index(row.material)] : [];
}

/** A whim keeps its drink for the Thane: a `stock` whim of a drink of a named material. */
export function whimKeepsDrink(registry: Registry, row: WhimRow): boolean {
  if (row.kind !== 'stock' || row.material === undefined || row.item === undefined || row.item === 'any') return false;
  return registry.table<ItemRow & { drinkable?: boolean }>('items').byId(row.item)?.drinkable === true;
}

/** The item types whose id or tags answer a recipe input's `match` (alternatives split on `|`). */
function answering(registry: Registry, match: string): number[] {
  const items = registry.table<ItemRow>('items');
  const names = match.split('|');
  return items.ids().filter((id) => names.includes(id) || (items.byId(id)?.tags ?? []).some((t) => names.includes(t)))
    .map((id) => items.index(id));
}

/** What the draw reads beyond the readers: the dwarves' skills and the stuffing of the fortress's items. */
export interface WhimFacts {
  /** The highest level of a skill among the fortress's dwarves (0 with none). */
  bestSkill(skillId: string): number;
  /** Units of an item type stuffed with a material (`Item.stuffing`) in stock (available). */
  stuffedInStock(type: number, material: number): number;
}

const HELD = ItemFlag.Forbidden | ItemFlag.Reserved | ItemFlag.Owned | ItemFlag.Merchant | ItemFlag.Foreign | ItemFlag.Installed;

/** The draw's facts from the dwarves' reader and the entities. */
export function whimFacts(dwarves: Pick<DwarvesReader, 'list' | 'skill'>, entities: Pick<EntityStore, 'with' | 'get'>): WhimFacts {
  return {
    bestSkill: (skillId) => dwarves.list().reduce((best, id) => Math.max(best, dwarves.skill(id, skillId)), 0),
    stuffedInStock: (type, material) => {
      let n = 0;
      for (const id of entities.with(C.Item)) {
        const it = entities.get(id, C.Item);
        if (it === undefined || it.type !== type || it.stuffing !== material || (it.flags & HELD) !== 0 || it.carriedBy !== 0) continue;
        n += it.count;
      }
      return n;
    },
  };
}

/** An order for nothing in particular: a recipe input's filter with no material chosen. */
const NO_ORDER: WorkOrder = { recipe: 0, remaining: 1, mode: 'once', threshold: 0, priority: 5, materialFilter: null };

/** One look at the fortress for the draw: its stock, its built workshops' recipes and its dwarves. */
interface Hand {
  readonly registry: Registry;
  readonly items: ItemsReader;
  readonly recipes: readonly RecipeRow[];
  readonly facts: WhimFacts;
}

/** The recipes of the built workshops (a magma variant counts as its workshop), in registry order. */
function builtRecipes(readers: ReaderSetLike, registry: Registry): RecipeRow[] {
  const b14 = readers.of<BuildingsReader>('14');
  const builtTypes = new Set<string>();
  for (const type of b14.types()) {
    if (type.category !== 'workshop') continue;
    if (!b14.byType(type.id).some((id) => b14.get(id)?.state === 'built')) continue;
    builtTypes.add(type.id);
    const variantOf = (type as { magmaVariantOf?: string }).magmaVariantOf;
    if (variantOf !== undefined) builtTypes.add(variantOf);
  }
  if (builtTypes.size === 0) return [];
  const recipes = registry.table<RecipeRow>('recipes');
  return recipes.ids().map((id) => recipes.byId(id) as RecipeRow).filter((r) => builtTypes.has(r.workshop));
}

/** `count` units answering a recipe input are in stock (available), of one material when it asks for the same. */
function inStock(hand: Hand, input: RecipeInput): boolean {
  const filter = recipeInputFilter(hand.registry, input, NO_ORDER);
  if (input.sameMaterial !== true) return hand.items.countAvailable(filter) >= input.count;
  const materials = hand.registry.table('materials');
  const ids = filter.materialIds ?? (filter.materialId !== undefined ? [filter.materialId] : materials.ids().map((id) => materials.index(id)));
  const one: ItemFilter = { ...filter };
  delete one.materialIds;
  return ids.some((m) => hand.items.countAvailable({ ...one, materialId: m }) >= input.count);
}

/** The material ids an item filter takes (its material, materials or class), or null for any. */
function filterMaterials(registry: Registry, filter: ItemFilter): number[] | null {
  const materials = registry.table<{ id: string; class: string }>('materials');
  let ids: number[] | null = null;
  const keep = (next: number[]): void => { ids = ids === null ? next : ids.filter((m) => next.includes(m)); };
  if (filter.materialId !== undefined) keep([filter.materialId]);
  if (filter.materialIds !== undefined) keep([...filter.materialIds]);
  if (filter.materialClass !== undefined) keep(materials.ids().filter((id) => materials.byId(id)?.class === filter.materialClass).map((id) => materials.index(id)));
  return ids;
}

/**
 * A recipe's output answers an input: its type answers the match, and its material is one the input
 * takes. The recipe as it must run for that: unchanged when it fixes the output's material or the
 * input takes any; with its source input held to the materials the input takes when the output's
 * material comes from it; a brew's drink, the plant's, is taken as it is. Null when it does not answer.
 */
function madeFor(hand: Hand, recipe: RecipeRow, out: RecipeRow['outputs'][number], input: RecipeInput): RecipeRow | null {
  const registry = hand.registry;
  const items = registry.table<ItemRow>('items');
  if (!items.has(out.item) || !answering(registry, input.match).includes(items.index(out.item))) return null;
  const takes = filterMaterials(registry, recipeInputFilter(registry, input, NO_ORDER));
  if (takes === null) return recipe;
  const materials = registry.table('materials');
  const fixed = out.material.fixed ?? out.material.alloy;
  if (fixed !== undefined) return materials.has(fixed) && takes.includes(materials.index(fixed)) ? recipe : null;
  if (out.material.plantDrink === true) return recipe;
  if (out.material.from !== 'input' || out.material.stage !== undefined) return null;
  const index = out.material.index ?? 0;
  const source = recipe.inputs[index];
  if (source === undefined) return null;
  const own = filterMaterials(registry, recipeInputFilter(registry, source, NO_ORDER));
  const allowed = own === null ? takes : takes.filter((m) => own.includes(m));
  if (allowed.length === 0) return null;
  const held: RecipeInput = { match: source.match, count: source.count, materials: allowed.map((m) => materials.byIndex(m)?.id ?? ''), ...(source.sameMaterial === undefined ? {} : { sameMaterial: source.sameMaterial }) };
  return { ...recipe, inputs: recipe.inputs.map((i, k) => (k === index ? held : i)) };
}

/** An input is at hand: in stock, or (`depth` 1) made at a built workshop by a recipe whose own inputs are in stock. */
function inputAtHand(hand: Hand, input: RecipeInput, depth: number): boolean {
  if (inStock(hand, input)) return true;
  if (depth === 0) return false;
  return hand.recipes.some((r) => r.outputs.some((out) => {
    const made = madeFor(hand, r, out, input);
    return made !== null && recipeAtHand(hand, made, depth - 1);
  }));
}

/** Every input of a recipe is at hand; `stuffing`, a material its last input (the stuffing, 12 § Operation) must be of. */
function recipeAtHand(hand: Hand, recipe: RecipeRow, depth: number, stuffing?: string): boolean {
  const last = recipe.inputs.length - 1;
  return recipe.inputs.every((input, i) => {
    if (stuffing === undefined || i !== last) return inputAtHand(hand, input, depth);
    const stuffed: RecipeInput = { match: input.match, count: input.count, material: stuffing, ...(input.sameMaterial === undefined ? {} : { sameMaterial: input.sameMaterial }) };
    return inputAtHand(hand, stuffed, depth);
  });
}

/** A row of a quality takes a quality recipe and a dwarf whose highest roll there reaches it (`12` § Quality). */
function skilled(hand: Hand, recipe: RecipeRow, quality: number | undefined): boolean {
  if (quality === undefined) return true;
  return recipe.quality && bestQuality(hand.facts.bestSkill(recipe.skill)) >= quality;
}

/**
 * A room whim made up with a stuffing (a featherbed): each item its building wants (a bedding, a
 * pillow) is in stock stuffed with it, or a built workshop makes it from inputs at hand, its stuffing
 * of that material.
 */
function stuffingAtHand(hand: Hand, readers: ReaderSetLike, row: WhimRow): boolean {
  if (row.bedding === undefined) return true;
  const materials = hand.registry.table('materials');
  if (!materials.has(row.bedding)) return false;
  const stuffing = materials.index(row.bedding);
  const items = hand.registry.table<ItemRow>('items');
  const type = readers.of<BuildingsReader>('14').types().find((t) => t.id === row.item) as { wants?: readonly { match: string; count: number }[] } | undefined;
  return (type?.wants ?? []).every((want) => {
    if (!items.has(want.match)) return false;
    if (hand.facts.stuffedInStock(items.index(want.match), stuffing) >= want.count) return true;
    return hand.recipes.some((r) => r.outputs.some((out) => out.item === want.match) && recipeAtHand(hand, r, 1, row.bedding));
  });
}

/**
 * `10` § The Thane's whim, possible: its item type is in the content, and one such item (of its
 * material and quality) is in stock, or a built workshop has a recipe that makes the type, of the
 * named material when there is one (the recipe fixes its output's material to it, or makes it from an
 * input of which an item of that material is in stock), whose inputs are at hand: each in stock, or
 * made at a built workshop from what is in stock. `any` item takes any quality recipe; a row of a
 * quality takes a quality recipe and a dwarf whose skill could roll that quality. A room whim made up
 * with a stuffing also needs the bedding and pillow of that stuffing at hand, and a bed already built
 * counts as its bed.
 */
export function whimPossible(readers: ReaderSetLike, registry: Registry, row: WhimRow, facts: WhimFacts, thaneId: EntityId = 0): boolean {
  if (!readers.has('14')) return false;
  if (row.kind === 'tier') {
    const b14 = readers.of<BuildingsReader>('14');
    return b14.hearthHallTiles().length > 0 && b14.hearthHallTier() < TOP_ROOM_TIER;
  }
  if (row.kind === 'engraved') {
    const room = thaneBedroom(readers, thaneId);
    return room !== 0 && (readers.of<BuildingsReader>('14').roomDiagnostics(room)?.plainSmoothed ?? 0) > 0;
  }
  if (row.also !== undefined && !itemPossible(readers, registry, { ...row, item: row.also }, facts)) return false;
  return itemPossible(readers, registry, row, facts);
}

/** A `stock` or `room` row's item could be had: in stock, or made from what is at hand. */
function itemPossible(readers: ReaderSetLike, registry: Registry, row: WhimRow, facts: WhimFacts): boolean {
  const filter = stockFilter(registry, row);
  if (filter === null || !readers.has('13') || !readers.has('14')) return false;
  const items13 = readers.of<ItemsReader>('13');
  const b14 = readers.of<BuildingsReader>('14');
  const hand: Hand = { registry, items: items13, recipes: builtRecipes(readers, registry), facts };
  if (!stuffingAtHand(hand, readers, row)) return false;
  if (items13.countAvailable(filter) > 0) return true;
  if (row.bedding !== undefined && b14.byType(row.item ?? '').some((id) => b14.get(id)?.state === 'built')) return true;
  const materials = registry.table('materials');
  for (const recipe of hand.recipes) {
    if (!skilled(hand, recipe, row.quality)) continue;
    if (row.item === 'any') {
      if (recipe.quality && recipeAtHand(hand, recipe, 1)) return true;
      continue;
    }
    for (const out of recipe.outputs) {
      if (out.item !== row.item) continue;
      let ofMaterial = row.material === undefined || out.material.fixed === row.material;
      if (!ofMaterial && row.material !== undefined && out.material.from === 'input' && materials.has(row.material)) {
        const input = recipe.inputs[out.material.index ?? 0];
        const types = input === undefined ? [] : answering(registry, input.match);
        ofMaterial = types.length > 0 && items13.countAvailable({ types, materialId: materials.index(row.material) }) > 0;
      }
      if (ofMaterial && recipeAtHand(hand, recipe, 1)) return true;
    }
  }
  return false;
}
