/**
 * What the player reads when something cannot be done (`docs/archive/ui-fixes/README.md` D-U4,
 * the UI audit § 4): every refusal and every block names the thing and why.
 *
 * - Command rejections: `command-catalog.md` § Rejection reasons gives each reason a
 *   `reject.<reason>` line; where the command tells more (which building, which kind of thing went
 *   missing) a more specific line is chosen: `ui.reject.<reason>.<CommandType>` for a reason whose
 *   cause depends on the command, `ui.reject.not_found.<subject>` for a thing that is gone, and the
 *   building's own placement rule for `bad_placement` ("Door needs walls on two opposite sides").
 * - Job and workshop blocks: `11` § Player-facing behavior ("the jobs panel names the reason"),
 *   `12` § Operation 3 ("waiting for <input>"): the missing item and count, and the workshop that
 *   makes it when the recipes name one to three.
 * - Building names: content names with a per-type ordinal ("Carpenter's workshop #1"), never an
 *   entity id.
 *
 * Presentation only: every function reads, none writes.
 */

import { C, type StockpileFilter } from '@core/components';
import { Designation } from '@core/map3d';
import type { Command } from '@core/commands';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings';
import { MAGMA_POWER_LEVEL } from '@systems/workshops/constants';
import type { ItemsReader, RotOutlook } from '@systems/items';
import { STOCKPILE_PRESETS } from '@systems/items';
import type { TradeReader } from '@systems/trade';
import type { JobsReader } from '@systems/jobs';
import type { DwarvesReader } from '@systems/dwarves';
import type { CombatReader } from '@systems/combat';
import { siteSummary, type LocalMapSpec } from '@systems/embark';
import type { TerrainReader } from '@systems/terrain';
import type { HealthReader } from '@systems/health';
import type { MagicReader } from '@systems/magic';
import { withSuffix } from '@content/generate';
import type { Strings } from './strings';
import type { Binding } from './keymap';
import { actionText, contextTitle } from './panels/help';

/** Parts in a line: "a, b and c" (`ui.list.and`) or "a, b or c" (`ui.list.or`); one part alone, '' for none. */
export function listText(strings: Strings, parts: readonly string[], conjunction: 'and' | 'or'): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return strings.get(`ui.list.${conjunction}`, { rest: parts.slice(0, -1).join(', '), last: parts[parts.length - 1] as string });
}

/** Every part joined by the conjunction alone: "a or b or c" (`ui.list.or` with each part as the last). */
export function chainText(strings: Strings, parts: readonly string[], conjunction: 'and' | 'or'): string {
  return parts.reduce((rest, last, i) => (i === 0 ? last : strings.get(`ui.list.${conjunction}`, { rest, last })), '');
}

/** A lower-case noun with its indefinite article: "an ember newt" (`ui.article.an`, before a vowel), "a boar" (`ui.article.a`). */
export function withArticle(strings: Strings, noun: string): string {
  return strings.get(/^[aeiou]/i.test(noun) ? 'ui.article.an' : 'ui.article.a', { noun });
}

/** What the message helpers read. A {@link PanelContext} is one. */
export interface MessageEnv {
  readonly readers: ReaderSet;
  readonly registry: Registry;
  readonly strings: Strings;
}

interface NamedRow {
  readonly id: string;
  readonly name: string;
  readonly plural?: string;
  readonly tags?: readonly string[];
}

interface RecipeRow {
  readonly id: string;
  readonly workshop: string;
  readonly outputs: readonly { readonly item: string }[];
}

/** Settings failures use the same action and context wording as Help. */
export function bindingConflict(strings: Strings, binding: Binding): string {
  return strings.get('ui.settings.binding_conflict', { context: contextTitle(binding.context, strings), action: actionText(binding, strings) });
}

export function invalidBindingModifiers(strings: Strings): string {
  return strings.get('ui.settings.binding_modifiers');
}

/** A fixed key (`ui-keymap-and-screens.md` § Fixed keys) refuses a rebinding by name. */
export function fixedBinding(strings: Strings, key: string): string {
  return strings.get('ui.settings.binding_fixed', { key });
}

/** A browser shortcut a page cannot keep (`Ctrl+W`, `Ctrl+Tab`) refuses a rebinding by name. */
export function browserBinding(strings: Strings, key: string): string {
  return strings.get('ui.settings.binding_browser', { key });
}

/** One binding back to its default: the Help wording and the key it has again. */
export function bindingReset(strings: Strings, binding: Binding, key: string): string {
  return strings.get('ui.settings.binding_reset', { action: actionText(binding), key });
}

/** Words into at most `maxLines` lines of `width` cells; the last line keeps what is left. */
export function wrapText(text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line !== '' && Array.from(line).length + 1 + Array.from(word).length > width && lines.length < maxLines - 1) {
      lines.push(line);
      line = word;
    } else line = line === '' ? word : `${line} ${word}`;
  }
  if (line !== '') lines.push(line);
  return lines;
}

export { wrapHang } from './widgets/label';

/** A line as it wraps: a count in brackets stays with the word before it ("plant (0)", "stocked (12)"). */
export function keepCounts(text: string): string {
  return text.replace(/ \((\d)/g, ' ($1');
}

/** "carpenter's workshop" → "Carpenter's workshop". */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildingsOf(readers: ReaderSet): BuildingsReader | null {
  return readers.has('14') ? readers.of<BuildingsReader>('14') : null;
}

/**
 * A building as the player knows it: its type's content name and its ordinal among the buildings
 * of that type ("Carpenter's workshop #1", "Trade depot #2").
 */
export function buildingName(env: Omit<MessageEnv, 'strings'>, id: EntityId): string {
  const b = buildingsOf(env.readers);
  const view = b?.get(id);
  if (b === null || view === undefined) return '';
  const row = env.registry.table<NamedRow>('buildings').byId(view.typeId);
  const name = capitalize(row?.name ?? view.typeId.replace(/_/g, ' '));
  const ordinal = b.byType(view.typeId).indexOf(id) + 1;
  return ordinal > 0 ? `${name} #${ordinal}` : name;
}

/** A zone as the player knows it: its type and ordinal among zones of that type ("Stockpile #2"). */
export function zoneName(env: Omit<MessageEnv, 'registry'>, zoneId: EntityId): string {
  const b = buildingsOf(env.readers);
  const zone = b?.zone(zoneId);
  if (b === null || zone === undefined) return '';
  const key = `ui.zone.type.${zone.type}`;
  const name = env.strings.has(key) ? env.strings.get(key) : capitalize(zone.type.replace(/_/g, ' '));
  return `${name} #${b.zonesOfType(zone.type).indexOf(zoneId) + 1}`;
}

/** The category/rot preset name used by both the editor and stockpile announcements. */
export function stockpilePreset(filter: StockpileFilter): string | null {
  const have = [...filter.categories].sort();
  for (const [name, preset] of Object.entries(STOCKPILE_PRESETS)) {
    const cats = [...preset.categories].sort();
    if (cats.length === have.length && cats.every((c, k) => have[k] === c) && preset.allowRot === filter.allowRot) return name;
  }
  return null;
}

/**
 * The preset as the editor and the announcements name it: the preset the filter equals, "Nothing"
 * for an empty filter (a new stockpile takes nothing, 13 § Stockpiles), otherwise "Custom".
 */
export function stockpilePresetName(strings: Strings, filter: StockpileFilter): string {
  const preset = stockpilePreset(filter);
  if (preset !== null) return strings.get(`ui.stockpile.preset.${preset}`);
  return strings.get(filter.categories.length === 0 ? 'ui.stockpile.nothing' : 'ui.stockpile.custom');
}

/** U-07 §4.4: identify a full stockpile by ordinal and the player's preset name. */
export function stockpileName(env: Omit<MessageEnv, 'registry'>, zoneId: EntityId): string {
  const name = zoneName(env, zoneId);
  const f = env.readers.has('13') ? env.readers.of<ItemsReader>('13').stockpile(zoneId)?.filter : undefined;
  // 13 § The compost heap: a heap's fixed filter names no preset; its name says what it is.
  if (f === undefined || buildingsOf(env.readers)?.zone(zoneId)?.type === 'compost') return name;
  return env.strings.get('ui.stockpile.name', { name, preset: stockpilePresetName(env.strings, f) });
}

/** The presentation-only reasons a zone editor action can do nothing. */
export function zoneEditorMessage(env: MessageEnv, reason: 'unavailable' | 'bounds' | 'quality' | 'no_bed' | 'pending_room' | 'no_zone' | 'link_source' | 'no_links'): string {
  return env.strings.get(`ui.zone.edit.${reason}`);
}

/** A civilization id as a name (`ui.civ.name.<civ>`: "hillfolk" → "Hillfolk"); an unknown one capitalised. */
export function civName(civ: string, strings: Strings): string {
  return strings.has(`ui.civ.name.${civ}`) ? strings.get(`ui.civ.name.${civ}`) : capitalize(civ);
}

/**
 * Why `[t] trade` cannot open a session (§4.2: "No caravan is at the depot (next: …)"), or null
 * when it can: no depot, a caravan still on its way, or none here and when each one comes.
 */
export function tradeBlocked(env: MessageEnv, depotId: EntityId): string | null {
  const s = env.strings;
  if (!depotId) return s.get('ui.status.no_depot');
  if (!env.readers.has('20')) return s.get('ui.status.no_caravan_soon');
  const trade = env.readers.of<TradeReader>('20');
  const active = trade.activeCaravan();
  if (active?.state === 'atDepot') return null;
  if (active !== null) return caravanUnreachable(env, depotId) ?? s.get('ui.status.caravan_coming', { civ: civName(active.civ, s) });
  const when = Object.entries(trade.schedule()).map(([civ, season]) => s.get('ui.status.caravan_when', { civ: civName(civ, s), season }));
  return when.length === 0 ? s.get('ui.status.no_caravan_soon') : s.get('ui.status.no_caravan', { when: when.join(', ') });
}

/**
 * 20 § Movement step 2: the waiting caravan's line when it cannot reach this depot from its edge
 * ("The Hillfolk caravan cannot reach Trade depot #1 from the west edge: …"), or null.
 */
export function caravanUnreachable(env: MessageEnv, depotId: EntityId): string | null {
  if (!env.readers.has('20')) return null;
  const trade = env.readers.of<TradeReader>('20');
  const active = trade.activeCaravan();
  const footprint = buildingsOf(env.readers)?.get(depotId)?.footprint;
  if (active?.state !== 'waiting' || footprint === undefined) return null;
  const reach = trade.caravanReach(footprint).find((r) => r.civ === active.civ);
  if (reach === undefined || reach.reaches) return null;
  return env.strings.get('announce.caravan_unreachable', {
    civ: civName(active.civ, env.strings), depot: buildingName(env, depotId), edge: env.strings.get(`ui.edge.${reach.edge}`),
  });
}

/**
 * The caravans that cannot reach `tiles` (a depot's footprint), by edge: "Hillfolk and Wildwood
 * caravans from the west edge", or '' when every caravan can (20 § Movement step 2).
 */
export function unreachableFrom(env: MessageEnv, tiles: readonly TileIndex[]): string {
  if (!env.readers.has('20') || tiles.length === 0) return '';
  const byEdge = new Map<string, string[]>();
  for (const r of env.readers.of<TradeReader>('20').caravanReach(tiles)) {
    if (r.reaches) continue;
    byEdge.set(r.edge, [...(byEdge.get(r.edge) ?? []), civName(r.civ, env.strings)]);
  }
  return Array.from(byEdge, ([edge, civs]) => env.strings.get('ui.depot.unreachable_from', {
    civs: listText(env.strings, civs, 'and'),
    edge: env.strings.get(`ui.edge.${edge}`),
  })).join('; ');
}

/** An item type's name, singular or plural ("door", "doors"); a raw match word reads as words. */
export function itemName(registry: Registry, id: string, n = 1): string {
  const row = registry.table<NamedRow>('items').byId(id);
  if (row === undefined) return id.replace(/_/g, ' ');
  return n === 1 ? row.name : row.plural ?? (row.name.endsWith('s') ? row.name : `${row.name}s`);
}

/** The first words of an item type in a cured or salted form (`items.md` § Food). */
const CURED_WORDS: readonly string[] = ['cured', 'salted'];

/**
 * Whether an item type is named by its material alone (`items.md` § Food): raw food (category
 * `food/<kind>/raw`: raw meat, raw fish, plants) and drink, whose type names only say what the
 * material already does ("boar meat", "turnip", "ale").
 */
function namedByMaterial(category: string | undefined): boolean {
  if (category === undefined) return false;
  if (category === 'drink') return true;
  const parts = category.split('/');
  return parts.length === 3 && parts[0] === 'food' && parts[2] === 'raw';
}

/**
 * An item as the lists name it: the material, then the item type's name ("oak log", "3 iron bars"). A word is
 * never said twice: a material that ends with the type's name ("wool cloth" for cloth) is the whole name; a type
 * whose name starts or ends with the material's ("easy meal" of meal, "leather boots" of leather) is named by the
 * type alone. Raw food and drink are named by the material alone, with no plural ("10 boar meat", "20 turnip",
 * "20 ale"), as the stocks panel names their stacks.
 */
export function materialItemName(material: string, type: { readonly name: string; readonly plural?: string | undefined; readonly category?: string | undefined }, n = 1): string {
  // A name that already ends in s ("boots") is its own plural when the table gives none.
  const typeName = n === 1 ? type.name : type.plural ?? (type.name.endsWith('s') ? type.name : `${type.name}s`);
  if (material === '') return typeName;
  if (namedByMaterial(type.category)) return material;
  const m = material.split(' ');
  const t = type.name.split(' ');
  // items.md § Food: an item of a cured or salted form names itself so: "cured boar meat", "cured trout", "salted boar hide".
  if (t.length > 1 && CURED_WORDS.includes(t[0] as string)) return `${t[0]} ${material}`;
  const ends = (long: readonly string[], short: readonly string[]): boolean => long.length >= short.length && long.slice(long.length - short.length).join(' ') === short.join(' ');
  if (m.length > t.length && ends(m, t)) return material;
  if (ends(t, m)) return typeName;
  for (let k = Math.min(m.length, t.length); k >= 1; k -= 1) {
    if (m.slice(m.length - k).join(' ') === t.slice(0, k).join(' ')) return [...m.slice(0, m.length - k), typeName].join(' ');
  }
  return `${material} ${typeName}`;
}

/**
 * 13 § Aging in a cellar: the stage word an aged item puts before its material ("aged bellwine"), or ''.
 * A caller with no strings table (the look panel's one-line names) gets the table's English words.
 */
export function ageWord(strings: Strings | null, age: number | undefined): string {
  if (age === 2) return strings?.get('ui.item.vintage') ?? 'vintage';
  return age === 1 ? strings?.get('ui.item.aged') ?? 'aged' : '';
}

/** A material name with the item's stage before it: "aged bellwine", "vintage cheese"; a young item's is unchanged. */
export function agedMaterial(strings: Strings | null, material: string, age: number | undefined): string {
  const word = ageWord(strings, age);
  return word === '' ? material : `${word} ${material}`;
}

/**
 * The stocks panel's note on an aged stack (24 § Panels): its stage and its years in the cellar,
 * "vintage, 2 years in the cellar". A stage is a year in an oak barrel or for a cheese, two in other wood.
 */
export function ageNote(strings: Strings, registry: Registry, item: { readonly type: number; readonly age?: number; readonly cellarDays?: number },
  container: { readonly material: number } | undefined): string {
  const age = item.age ?? 0;
  if (age === 0) return '';
  const cheese = registry.table<{ id: string }>('items').byIndex(item.type)?.id === 'cheese';
  const fine = container !== undefined && registry.table<{ id: string; tags?: readonly string[] }>('materials').byIndex(container.material)?.tags?.includes('fine_cask') === true;
  const span = cheese || fine ? DAYS_PER_YEAR : 2 * DAYS_PER_YEAR;
  const years = Math.floor((age * span + (item.cellarDays ?? 0)) / DAYS_PER_YEAR);
  return strings.get(years === 1 ? 'ui.item.age_note_one' : 'ui.item.age_note', { stage: ageWord(strings, age), n: years });
}

/**
 * An item's name with its enchantment's suffix (`25` § Setting stones): a suffix that begins with
 * "of" follows the name ("iron axe of embers"), any other goes before it ("keen iron axe").
 */
export function enchantedName(readers: ReaderSet, itemId: EntityId, name: string): string {
  if (!readers.has('25')) return name;
  const enchant = readers.of<MagicReader>('25').enchantOf(itemId);
  return enchant === undefined ? name : withSuffix(name, enchant.suffix);
}

/** A building input or recipe match ("block|log") as words: "block or log". */
export function matchName(registry: Registry, match: string, n: number, strings: Strings): string {
  return chainText(strings, match.split('|').map((part) => itemName(registry, part, n)), 'or');
}

/**
 * A building input with its alternatives as the build tool names it (`fortress-screen.md` § Build
 * tool): one item in the plural of `n` ("2 logs" names "logs"), several in the singular, every one
 * of them: "fiber, straw or reed".
 */
export function alternativesName(registry: Registry, match: string, n: number, strings: Strings): string {
  const parts = match.split('|');
  if (parts.length === 1) return itemName(registry, parts[0] as string, n);
  return listText(strings, parts.map((part) => itemName(registry, part, 1)), 'or');
}

/** A row of the `whims` table as the UI names it (`personality-and-thoughts.md` § Whims). */
interface WhimRowLike {
  readonly id: string;
  readonly kind: 'stock' | 'room';
  readonly item: string;
  readonly material?: string;
  readonly count: number;
  readonly text: string;
}

function whimRow(registry: Registry, whimId: string): WhimRowLike | undefined {
  return registry.hasTable('whims') ? registry.table<WhimRowLike>('whims').byId(whimId) : undefined;
}

/**
 * How far the fortress is with a whim (`10` § The Thane's whim): a `stock` whim by the units in stock
 * and its count of its item ("3 of 20 fine meals in stock", "0 of 20 mead in stock"; "0 of 1 in stock"
 * for any item), a `room` whim by the buildings in place ("0 of 1 in place").
 */
export function whimProgressText(strings: Strings, registry: Registry, whimId: string, have: number): string {
  const row = whimRow(registry, whimId);
  if (row === undefined) return strings.get('ui.whim.in_stock', { n: have, goal: '?' });
  if (row.kind === 'room') return strings.get('ui.whim.in_place', { n: have, count: row.count });
  const type = registry.table<NamedRow & { category?: string }>('items').byId(row.item);
  const material = row.material === undefined ? '' : registry.table<NamedRow>('materials').byId(row.material)?.name ?? row.material;
  const goal = type === undefined ? `${row.count}` : `${row.count} ${materialItemName(material, type, row.count)}`;
  return strings.get('ui.whim.in_stock', { n: have, goal });
}

/**
 * Where a whim's item is made (`10` § The Thane's whim): the workshops of the recipes that make its
 * item type, of its material when it names one; '' for any item, or none or more than three.
 */
export function whimWhereMade(registry: Registry, whimId: string, strings: Strings): string {
  const row = whimRow(registry, whimId);
  if (row === undefined || row.item === 'any') return '';
  const recipes = registry.table<{ id: string; workshop: string; outputs: readonly { item: string; material?: { fixed?: string } }[] }>('recipes');
  const workshops = new Set<string>();
  for (const id of recipes.ids()) {
    const recipe = recipes.byId(id);
    if (recipe?.outputs.some((o) => o.item === row.item && (row.material === undefined || o.material?.fixed === row.material)) === true) workshops.add(recipe.workshop);
  }
  const buildings = registry.table<NamedRow>('buildings');
  return workshopList(buildings.ids().filter((id) => workshops.has(id)).map((id) => buildings.byId(id)?.name ?? id), strings);
}

/** "a carpenter's workshop", "a carpenter's workshop or a forge"; empty for none or more than three. */
function workshopList(names: readonly string[], strings: Strings): string {
  if (names.length === 0 || names.length > 3) return '';
  return listText(strings, names.map((n) => withArticle(strings, n)), 'or');
}

/** The building types whose recipes make an item type, in the buildings table's order. */
export function producersOf(registry: Registry, itemId: string): string[] {
  const recipes = registry.table<RecipeRow>('recipes');
  const workshops = new Set<string>();
  for (const id of recipes.ids()) {
    const recipe = recipes.byId(id);
    if (recipe !== undefined && recipe.outputs.some((o) => o.item === itemId)) workshops.add(recipe.workshop);
  }
  const buildings = registry.table<NamedRow>('buildings');
  return buildings.ids().filter((id) => workshops.has(id)).map((id) => buildings.byId(id)?.name ?? id);
}

/** "a carpenter's workshop", "a carpenter's workshop or a forge"; empty for none or more than three. */
export function whereMade(registry: Registry, itemIds: readonly string[], strings: Strings): string {
  return workshopList(Array.from(new Set(itemIds.flatMap((id) => producersOf(registry, id)))), strings);
}

/** A building row's inputs as the buildings table gives them. */
interface BuildingInputsRow {
  readonly id: string;
  readonly name: string;
  readonly inputs?: readonly { readonly match: string; readonly count: number | 'tiles' }[];
}

/** Units of a building input in stock, every alternative counted (13 `countAvailable`). */
export function inputUnits(readers: ReaderSet, match: string): number {
  const b = buildingsOf(readers);
  const it = readers.has('13') ? readers.of<ItemsReader>('13') : null;
  if (b === null || it === null) return 0;
  const types = b.inputTypes(match);
  return types.length === 0 ? 0 : it.countAvailable({ types });
}

/** The soil depth of each site spec, from the site summary the world map shows (03 stage 3). */
const SOIL_DEPTHS = new WeakMap<LocalMapSpec, number>();

/**
 * Where stone comes from on this site (`fortress-screen.md` § Build tool): dig down through the
 * soil, as deep as the site panel says it is; dig into the rock where there is no soil; trade for
 * it on a map with no site.
 */
export function stoneAdvice(env: MessageEnv): string {
  const s = env.strings;
  const spec = env.readers.has('03') ? env.readers.of<TerrainReader>('03').spec() : null;
  if (spec === null) return s.get('ui.advice.stone_trade');
  let depth = SOIL_DEPTHS.get(spec);
  if (depth === undefined) {
    depth = siteSummary(spec, env.registry).soil?.depth ?? 0;
    SOIL_DEPTHS.set(spec, depth);
  }
  return depth > 0 ? s.get('ui.advice.stone_dig', { n: depth }) : s.get('ui.advice.stone_rock');
}

/**
 * Where a short item can come from (`fortress-screen.md` § Build tool, `panels.md` § Jobs): the
 * workshops whose recipes make it, leaving out one whose own building takes it unless it is built
 * or the stock can build it (a mason's workshop, a kiln and a forge for blocks, on a site with no
 * stone); `where` names them as {@link whereMade} does, `count` says how many there are. For stone
 * or blocks, when none of them is built and the stock cannot build one, `advice` says where the
 * rock is ({@link stoneAdvice}) and `where` is empty.
 */
export function sourceOf(env: MessageEnv, itemIds: readonly string[]): { where: string; count: number; advice: string } {
  const b = buildingsOf(env.readers);
  const items = env.registry.table<{ id: string; category?: string }>('items');
  const buildingRows = env.registry.table<BuildingInputsRow>('buildings');
  const recipes = env.registry.table<RecipeRow>('recipes');
  const wanted = new Set(itemIds);
  const makers = new Set<string>();
  for (const id of recipes.ids()) {
    const recipe = recipes.byId(id);
    if (recipe !== undefined && recipe.outputs.some((o) => wanted.has(o.item))) makers.add(recipe.workshop);
  }
  const wantedTypes = new Set(itemIds.filter((id) => items.has(id)).map((id) => items.index(id)));
  const takes = (row: BuildingInputsRow): boolean =>
    b !== null && (row.inputs ?? []).some((input) => b.inputTypes(input.match).some((t) => wantedTypes.has(t)));
  const built = (row: BuildingInputsRow): boolean => b !== null && b.byType(row.id).some((id) => b.get(id)?.state === 'built');
  const buildable = (row: BuildingInputsRow): boolean =>
    (row.inputs ?? []).every((input) => inputUnits(env.readers, input.match) >= (input.count === 'tiles' ? 1 : input.count));
  const listed = buildingRows.ids().filter((id) => makers.has(id)).map((id) => buildingRows.byId(id))
    .filter((row): row is BuildingInputsRow => row !== undefined && (!takes(row) || built(row) || buildable(row)));
  const stone = itemIds.some((id) => /^stone\/(raw|block)$/.test(items.byId(id)?.category ?? ''));
  if (stone && !listed.some((row) => built(row) || buildable(row))) return { where: '', count: 0, advice: stoneAdvice(env) };
  return { where: workshopList(listed.map((row) => row.name), env.strings), count: listed.length, advice: '' };
}

/** The tile a command is about, for the log line's focus (24 § Announcements: "jumps to the focus"). */
export function commandFocus(readers: ReaderSet, command: Command | undefined): TileIndex | undefined {
  if (command === undefined) return undefined;
  const map = readers.map;
  const valid = (t: number): boolean => Number.isInteger(t) && t >= 0 && t < map.w * map.h * map.d;
  const tiles = command['tiles'];
  if (Array.isArray(tiles) && typeof tiles[0] === 'number' && valid(tiles[0])) return tiles[0];
  for (const key of ['tile', 'origin'] as const) {
    const t = command[key];
    if (typeof t === 'number' && valid(t)) return t;
  }
  const { x, y } = command as { x?: unknown; y?: unknown };
  const z = command['zTop'];
  if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number' && map.inBounds(x, y, z)) return map.index(x, y, z);
  const b = buildingsOf(readers);
  const zone = command['zoneId'];
  if (b !== null && typeof zone === 'number') {
    const first = b.zone(zone)?.tiles[0];
    if (first !== undefined) return first;
  }
  for (const key of ['buildingId', 'workshopId', 'cageBuildingId', 'leverId', 'depotId'] as const) {
    const id = command[key];
    const origin = typeof id === 'number' && b !== null ? b.get(id)?.origin : undefined;
    if (origin !== undefined) return origin;
  }
  for (const key of ['dwarfId', 'animalId'] as const) {
    const id = command[key];
    const p = typeof id === 'number' ? readers.entities.get(id, C.Position) : undefined;
    if (p !== undefined) return map.index(p.x, p.y, p.z);
  }
  return undefined;
}

/** What a `not_found` rejection lost, by the command's subject (`ui.reject.not_found.<subject>`). */
const NOT_FOUND_SUBJECT: Readonly<Record<string, string>> = Object.freeze({
  SetPlotCrop: 'zone', AssignPasture: 'animal', MarkSlaughter: 'animal', UnmarkSlaughter: 'animal',
  TrainAnimal: 'animal', TameCaged: 'cage', AssignAnimal: 'animal', SetBreedingCap: 'species', ReleaseCaged: 'cage',
  SetHuntable: 'species', SetLabor: 'dwarf', SetLaborPriority: 'labor', CancelJob: 'job', SetJobPriority: 'job',
  AssignTitle: 'dwarf', RenameDwarf: 'dwarf', SetSchedule: 'squad', AddWorkOrder: 'workshop',
  EditWorkOrder: 'workshop', RemoveWorkOrder: 'workshop', ReorderWorkOrder: 'workshop', SetWorkshopWorker: 'workshop',
  SuspendWorkshop: 'workshop', ForbidItem: 'items', ClaimItem: 'items', DumpItem: 'items', MeltItem: 'items',
  SetStockpileFilter: 'zone', SetStockpileContainers: 'zone', SetStockpilePriority: 'zone', LinkStockpile: 'zone', SetStockpileCellar: 'zone',
  PlaceBuilding: 'building_type', CancelBuilding: 'building', DeconstructBuilding: 'building',
  SetBuildingPriority: 'building', ResizeZone: 'zone', RemoveZone: 'zone', SetZoneSetting: 'zone', AssignRoom: 'zone',
  LinkMechanism: 'building', UnlinkMechanism: 'building', SetDoorMode: 'building', SetHatchMode: 'building',
  SetPlateTrigger: 'building', ReleaseCage: 'building', AssignCoffin: 'building', ReleaseHeld: 'building', DisbandSquad: 'squad',
  SetSquadMembers: 'squad', SetSquadLeader: 'squad', SetSquadMode: 'squad', SetSquadEquipment: 'squad',
  SetSquadStation: 'squad', SetSquadPatrol: 'squad', SquadOrder: 'squad', SetHospitalSupplies: 'zone',
  SetTrapMode: 'building', PullLever: 'building', MoveToDepot: 'items', RemoveFromDepot: 'items',
  NameAnimal: 'animal', RenameSquad: 'squad', SetRequests: 'items',
});

/**
 * The reason a refused command gives (`ui.status.rejected`'s `{reason}`): the most specific line the
 * strings table has for this command, then the reason's own `reject.<reason>`.
 */
export function rejectionText(env: MessageEnv, command: Command | undefined, reason: string): string {
  const s = env.strings;
  const type = command?.type ?? '';
  if (reason === 'has_progress' && type === 'UndoDesignation') {
    const raw = command?.['tiles'];
    const tiles = new Set(Array.isArray(raw) ? raw.filter((i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < env.readers.map.w * env.readers.map.h * env.readers.map.d) : []);
    const n = [...tiles].filter(i => env.readers.map.designationAt(i) !== Designation.None).length;
    return s.get('ui.reject.has_progress.UndoDesignation', { n });
  }
  if (reason === 'fixed_footprint' && type === 'PlaceBuilding' && command !== undefined) {
    const table = env.registry.table<NamedRow>('buildings');
    const buildingType = command['buildingType'];
    const row = typeof buildingType === 'string' ? table.byId(buildingType) : typeof buildingType === 'number' ? table.byIndex(buildingType) : undefined;
    if (row !== undefined) return s.get('ui.reject.fixed_footprint.building', { name: capitalize(row.name) });
  }
  if (reason === 'bad_placement' && type === 'PlaceBuilding' && command !== undefined) {
    const rule = placementRule(env, command);
    if (rule !== null) return rule;
  }
  if (reason === 'not_found') {
    const subject = NOT_FOUND_SUBJECT[type];
    if (subject !== undefined && s.has(`ui.reject.not_found.${subject}`)) return s.get(`ui.reject.not_found.${subject}`);
  }
  if (s.has(`ui.reject.${reason}.${type}`)) return s.get(`ui.reject.${reason}.${type}`);
  if (s.has(`reject.${reason}`)) return s.get(`reject.${reason}`);
  return s.get('ui.reject.unknown');
}

/** "Door needs walls on two opposite sides": the building's rule where a placement failed. */
function placementRule(env: MessageEnv, command: Command): string | null {
  const b = buildingsOf(env.readers);
  const type = command['buildingType'];
  const origin = command['origin'];
  if (b === null || typeof type !== 'string' || typeof origin !== 'number') return null;
  const orientation = typeof command['orientation'] === 'number' ? command['orientation'] : 0;
  const width = typeof command['width'] === 'number' ? command['width'] : undefined;
  const height = typeof command['height'] === 'number' ? command['height'] : undefined;
  const ghost = b.ghost(type, origin, orientation, width, height);
  const rule = blockedText(env, type, ghost);
  if (rule === null) return null;
  const name = capitalize(env.registry.table<NamedRow>('buildings').byId(type)?.name ?? type.replace(/_/g, ' '));
  return env.strings.get('ui.reject.bad_placement.building', { name, rule });
}

/**
 * Why a footprint is blocked, as the build tool's status line and a refused `PlaceBuilding` say it:
 * the failing tile rule ("needs a floor"), or, when every tile passes, the building's own condition
 * (magma below a magma workshop, a floor at a bridge's hinge).
 */
export function blockedText(env: MessageEnv, typeId: string, ghost: { reason: string | null; rule: string; bad: readonly TileIndex[] }): string | null {
  const s = env.strings;
  const reason = ghost.reason;
  if (reason === null) return null;
  if (reason === 'bad_placement') {
    if (ghost.bad.length === 0) {
      const tags = env.registry.table<NamedRow>('buildings').byId(typeId)?.tags ?? [];
      if (tags.includes('magma')) return s.get('ui.build.rule.magma', { level: MAGMA_POWER_LEVEL });
      if (tags.includes('bridge')) return s.get('ui.build.rule.hinge');
    }
    if (s.has(`ui.build.rule.${ghost.rule}`)) return s.get(`ui.build.rule.${ghost.rule}`);
  }
  if (s.has(`ui.build.reason.${reason}`)) return s.get(`ui.build.reason.${reason}`);
  return s.has(`reject.${reason}`) ? s.get(`reject.${reason}`) : s.get('ui.reject.unknown');
}

/** The item filter of a job input as words, with its count: "1 door", "2 blocks or logs". */
export function filterText(registry: Registry, filter: Readonly<Record<string, unknown>>, n: number, strings: Strings): string {
  const items = registry.table<NamedRow>('items');
  const nameOf = (index: number): string => {
    const row = items.byIndex(index);
    return row === undefined ? '' : n === 1 ? row.name : row.plural ?? (row.name.endsWith('s') ? row.name : `${row.name}s`);
  };
  let name = '';
  if (typeof filter['type'] === 'number') name = nameOf(filter['type']);
  else if (Array.isArray(filter['types'])) {
    // Several alternatives are each named, in the singular, as the build tool names them: "3 fiber, straw or reed".
    const types = filter['types'] as number[];
    const names = types.map((t) => (types.length === 1 ? nameOf(t) : items.byIndex(t)?.name ?? '')).filter((x) => x !== '');
    name = listText(strings, names, 'or');
  }
  else if (typeof filter['emptyContainer'] === 'string') name = strings.get('ui.item.empty_container', { item: itemName(registry, filter['emptyContainer'], n) });
  else if (typeof filter['category'] === 'string') name = (filter['category'].split('/').pop() ?? '').replace(/_/g, ' ');
  else if (filter['edible'] === true) name = strings.get('ui.item.food');
  else if (filter['drinkable'] === true) name = strings.get('ui.item.drink');
  else if (typeof filter['tag'] === 'string') name = filter['tag'].replace(/_/g, ' ');
  if (name === '') name = strings.get(n === 1 ? 'ui.item.unnamed' : 'ui.item.unnamed_plural');
  const material = filter['materialId'];
  if (typeof material === 'number') {
    const m = registry.table<NamedRow>('materials').byIndex(material)?.name;
    const type = typeof filter['type'] === 'number' ? items.byIndex(filter['type']) : undefined;
    if (m !== undefined) name = type === undefined ? `${m} ${name}` : materialItemName(m, type, n);
  } else if (typeof filter['materialClass'] === 'string') name = `${filter['materialClass']} ${name}`;
  return `${n} ${name}`;
}

/** The item ids a filter names, for {@link whereMade}. */
function filterItemIds(registry: Registry, filter: Readonly<Record<string, unknown>>): string[] {
  const items = registry.table<NamedRow>('items');
  const ids: number[] = typeof filter['type'] === 'number' ? [filter['type']] : Array.isArray(filter['types']) ? (filter['types'] as number[]) : [];
  return ids.map((i) => items.byIndex(i)?.id ?? '').filter((id) => id !== '');
}

/** An item filter as 13's `countAvailable` takes it. */
type ItemFilterLike = Parameters<ItemsReader['countAvailable']>[0];

/** A job as the blocked-reason column reads it. */
export interface BlockedJob {
  /** The job's id, for 11's `unfoundInput` (a job without one is never read as out of reach). */
  readonly id?: number;
  readonly type: number;
  readonly blockedReason: string | null;
  readonly tool: string | null;
  readonly inputs: readonly { readonly filter: object; readonly count: number; readonly reserved?: readonly number[]; readonly delivered: readonly number[] }[];
}

/**
 * A blocked job's reason: `short` for the jobs table's cell ("waiting: 1 stone"), `long` for the
 * selected job's line, which also says where to get the missing item ("— order at a carpenter's
 * workshop", "— dig down to rock: …") or what to do. The input named is the first that is short:
 * fewer units available (13 `countAvailable`) than it still needs beyond what is reserved and
 * delivered; when none is, the first that the job's retry does not find within reach (11
 * `unfoundInput`: "waiting: 1 barrel, out of reach"), else the first not yet delivered, which waits
 * to be brought.
 */
export function jobBlockText(env: MessageEnv, job: BlockedJob): { short: string; long: string } {
  const s = env.strings;
  const reason = job.blockedReason ?? '';
  if (reason === 'missing_input') {
    const it = env.readers.has('13') ? env.readers.of<ItemsReader>('13') : null;
    const owed = (i: BlockedJob['inputs'][number]): number => i.count - i.delivered.length - (i.reserved?.length ?? 0);
    const short = it === null ? undefined : job.inputs.find((i) => owed(i) > 0 && it.countAvailable(i.filter as ItemFilterLike) < owed(i));
    const input = short ?? job.inputs.find((i) => i.count - i.delivered.length > 0) ?? job.inputs[0];
    if (input !== undefined) {
      const filter = input.filter as Readonly<Record<string, unknown>>;
      if (short === undefined && it !== null) {
        // Every input is counted available: one the job's own retry cannot find lies out of reach.
        const far = job.id !== undefined && env.readers.has('11') ? job.inputs[env.readers.of<JobsReader>('11').unfoundInput(job.id)] : undefined;
        if (far !== undefined) {
          const text = s.get('ui.jobs.reason.input_out_of_reach', { what: filterText(env.registry, far.filter as Readonly<Record<string, unknown>>, Math.max(1, owed(far)), s) });
          return { short: text, long: s.get('ui.jobs.reason_long.input_out_of_reach', { text }) };
        }
        const text = s.get('ui.jobs.reason.to_be_brought', { what: filterText(env.registry, filter, Math.max(1, input.count - input.delivered.length), s) });
        return { short: text, long: text };
      }
      const what = filterText(env.registry, filter, Math.max(1, owed(input)), s);
      const text = s.get('ui.jobs.reason.missing_input', { what });
      // Where it comes from is read only for the long line: the jobs table asks for the short one on every row.
      return {
        short: text,
        get long(): string {
          const source = sourceOf(env, filterItemIds(env.registry, filter));
          return source.advice !== '' ? s.get('ui.block.advice', { text, advice: source.advice })
            : source.where === '' ? text : s.get('ui.block.order_at', { text, where: source.where });
        },
      };
    }
  }
  if (reason === 'no_tool') {
    const tool = s.has(`ui.jobs.tool.${job.tool ?? ''}`) ? s.get(`ui.jobs.tool.${job.tool ?? ''}`) : s.get('ui.jobs.tool.any');
    const short = s.get('ui.jobs.reason.no_tool', { tool });
    return { short, long: s.get('ui.jobs.reason_long.no_tool', { tool }) };
  }
  if (reason === 'no_worker') {
    const laborId = env.registry.table<{ id: string; labor?: string }>('jobTypes').byIndex(job.type)?.labor ?? '';
    const labor = env.registry.table<NamedRow>('labors').byId(laborId)?.name;
    const short = s.get('ui.jobs.reason.no_worker');
    return { short, long: labor === undefined ? s.get('ui.jobs.reason_long.no_worker_any') : s.get('ui.jobs.reason_long.no_worker', { labor }) };
  }
  const short = s.has(`ui.jobs.reason.${reason}`) ? s.get(`ui.jobs.reason.${reason}`) : s.get('ui.jobs.reason.other');
  const long = s.has(`ui.jobs.reason_long.${reason}`) ? s.get(`ui.jobs.reason_long.${reason}`) : short;
  return { short, long };
}

/**
 * The input a `waiting for <match>` reason names and how many of it can be used now, or null for
 * any other reason (the order list's "waiting for stone (0)", D-U5).
 */
export function waitingFor(env: MessageEnv, reason: string | null): { match: string; item: string; n: number } | null {
  const waiting = reason === null ? null : /^waiting for (.+)$/.exec(reason);
  if (waiting === null) return null;
  const match = waiting[1] as string;
  const items = env.readers.has('13') ? env.readers.of<ItemsReader>('13') : null;
  const table = env.registry.table<NamedRow>('items');
  // An input with alternatives ("fiber|straw|reed") is named "fiber or straw or reed", and counts them all.
  let n = 0;
  for (const part of match.split('|')) if (items !== null && table.has(part)) n += items.countAvailable({ type: table.index(part) });
  return { match, item: matchName(env.registry, match, 1, env.strings), n };
}

/**
 * The inputs an `out of reach <ids>` reason names (`12` § Operation 2: an order whose inputs exist
 * but none within reach of the workshop's worker is skipped for a while): "charcoal", "charcoal or
 * coal"; null for any other reason.
 */
export function outOfReach(env: MessageEnv, reason: string | null): { match: string; item: string } | null {
  const far = reason === null ? null : /^out of reach (.+)$/.exec(reason);
  if (far === null) return null;
  const match = far[1] as string;
  return { match, item: matchName(env.registry, match, 1, env.strings) };
}

/**
 * A workshop order's waiting reason as words (`12` § Operation 3: "waiting for <input>"): the
 * reader's `isRunnable` reason, which names the input (`waiting for raw_stone`), or the fuel
 * shortage it reports as `missing_input`.
 */
export function workshopBlockText(env: MessageEnv, reason: string | null): string {
  const s = env.strings;
  if (reason === null) return '';
  const far = outOfReach(env, reason);
  if (far !== null) return s.get('ui.block.out_of_reach', { item: far.item });
  const waiting = waitingFor(env, reason);
  if (waiting !== null) {
    const text = s.get('ui.block.waiting_for', { item: waiting.item, n: waiting.n });
    // Where it comes from, as a blocked job's line says it (jobBlockText): stone says where the rock is.
    const source = sourceOf(env, waiting.match.split('|'));
    if (source.advice !== '') return s.get('ui.block.advice', { text, advice: source.advice });
    return source.where === '' ? text : s.get('ui.block.order_at', { text, where: source.where });
  }
  if (reason === 'missing_input') {
    const items = env.registry.table<NamedRow>('items');
    const fuels = items.ids().filter((id) => items.byId(id)?.tags?.includes('fuel') === true);
    const where = whereMade(env.registry, fuels, s);
    return where === '' ? s.get('ui.block.fuel') : s.get('ui.block.order_at', { text: s.get('ui.block.fuel'), where });
  }
  return s.has(`ui.block.${reason}`) ? s.get(`ui.block.${reason}`) : s.get('ui.jobs.reason.other');
}

/** Why a gear or member chooser cannot open. */
export function militaryNoSquad(env: MessageEnv): string {
  return env.strings.get('ui.military.no_squad');
}

/**
 * An accepted trade request as the status line says it: who the trade waits for and why
 * ({@link tradeWait}, before the job exists: the dwarf it will be for), and, while paused,
 * "· [Space] resumes".
 */
export function brokerOnWay(env: MessageEnv, depotId: EntityId, paused: boolean): string {
  const text = tradeWait(env, depotId, true) ?? env.strings.get('ui.trade.wait.on_way', { who: env.strings.get('ui.trade.wait.the_broker') });
  return paused ? `${text} · ${env.strings.get('ui.depot.resume')}` : text;
}

/**
 * Who a waiting trade request waits for and why (`panels.md` § Depot, 20 § The session): the
 * depot's `trade` job's worker on the way, else the Broker it is for and what keeps them (asleep,
 * eating, at another job, a patient, sheltering, out of reach), else why no Broker holds it (on duty
 * with a squad, the trading labor off, none appointed) and whether any other dwarf can trade; with
 * no dwarf on the way and nothing else to say, that no one has taken the trade yet, and how many
 * goods are still being carried to the depot. `null` when no request waits at the depot (no job,
 * or the session is open). With `prospective`, a request about to be sent is read as its job will
 * be: for the Broker unless the Broker is on duty or has the labor off, who is then on the way.
 */
export function tradeWait(env: MessageEnv, depotId: EntityId, prospective = false): string | null {
  if (!env.readers.has('11') || !env.readers.has('20') || !env.readers.has('10')) return null;
  if (env.readers.of<TradeReader>('20').sessionOpen()) return null;
  const job = env.readers.of<JobsReader>('11').byKey(`trade:${depotId}`);
  if (job === undefined && !prospective) return null;
  const assigned = job === undefined ? brokerFor(env) : typeof job.data['assignedWorker'] === 'number' ? job.data['assignedWorker'] : 0;
  return tradeWaitFor(env, job?.workerId ?? 0, assigned, typeof job?.workTile === 'number' ? job.workTile : -1, false, depotId, job === undefined);
}

/**
 * The words of {@link tradeWait} for a worker on the way (`workerId`), else the dwarf the job is
 * for (`assigned`, 0 for any trading dwarf). `late` reads them as the caravan leaves (20,
 * `TradeMissed`): a dwarf that was coming "did not reach the depot in time". `depotId` counts the
 * goods still being carried there; `prospective` reads a request not yet sent ({@link tradeWait}).
 */
export function tradeWaitFor(env: MessageEnv, workerId: EntityId, assigned: EntityId, workTile: TileIndex, late: boolean, depotId = 0, prospective = false): string {
  const s = env.strings;
  const hauls = depotId !== 0 && env.readers.has('20') ? env.readers.of<TradeReader>('20').depotHauls(depotId) : 0;
  // No dwarf has taken the trade: said so, with the goods still on their way to the depot.
  const notTaken = (): string => late
    ? s.get(hauls === 0 ? 'ui.trade.wait.late_any' : 'ui.trade.wait.late_hauls', { n: hauls })
    : s.get(hauls === 0 ? 'ui.trade.wait.not_taken' : 'ui.trade.wait.not_taken_hauls', { n: hauls });
  const dwarves = env.readers.of<DwarvesReader>('10');
  const broker = dwarves.holder('broker');
  const who = (id: EntityId): string => {
    const name = env.readers.entities.get(id, C.Creature)?.name ?? '';
    return id === broker ? s.get('ui.trade.wait.named_broker', { name }) : name;
  };
  if (workerId !== 0) {
    if (late) return s.get('ui.trade.wait.late', { who: who(workerId) });
    return s.get(broker !== 0 && broker !== workerId ? 'ui.trade.wait.stand_in_on_way' : 'ui.trade.wait.on_way', { who: who(workerId) });
  }
  if (assigned !== 0 && env.readers.entities.alive(assigned)) return dwarfWait(env, assigned, who(assigned), workTile, late, prospective ? null : notTaken);
  // No Broker holds the job: why not, and whether another dwarf can trade.
  const combat = env.readers.has('16') ? env.readers.of<CombatReader>('16') : null;
  const free = (id: EntityId): boolean => id !== broker && combat?.onDuty(id) !== true && !dwarves.isChild(id);
  const others = env.readers.of<JobsReader>('11').workersWithLabor('trading').some(free);
  if (late && others) return notTaken();
  if (broker !== 0 && env.readers.entities.alive(broker)) {
    const squad = combat?.onDuty(broker) === true ? combat.squadOf(broker) : undefined;
    if (squad !== undefined) return s.get(others ? 'ui.trade.wait.on_duty_stand_in' : 'ui.trade.wait.on_duty_nobody', { who: who(broker), squad: squad.name });
    if (!env.readers.of<JobsReader>('11').laborEnabled(broker, 'trading')) return s.get(others ? 'ui.trade.wait.labor_off_stand_in' : 'ui.trade.wait.labor_off_nobody', { who: who(broker) });
  }
  if (!others) return s.get('ui.trade.wait.nobody');
  return broker !== 0 ? notTaken() : `${notTaken()} ${s.get('ui.trade.wait.no_broker')}`;
}

/**
 * What keeps the dwarf a trade job is for from the depot, from its brain and health; with nothing
 * keeping them, `notTaken` (they have not taken it yet), or, for a request not yet sent, on the way.
 */
function dwarfWait(env: MessageEnv, id: EntityId, who: string, workTile: TileIndex, late: boolean, notTaken: (() => string) | null): string {
  const s = env.strings;
  const dwarves = env.readers.of<DwarvesReader>('10');
  const health = env.readers.has('17') ? env.readers.of<HealthReader>('17') : null;
  if (health !== null && !health.isConscious(id)) return s.get('ui.trade.wait.down', { who });
  const behavior = dwarves.behavior(id);
  if (behavior === 'patient' || health?.isPatient(id) === true) return s.get('ui.trade.wait.patient', { who });
  const pos = env.readers.entities.get(id, C.Position);
  if (workTile >= 0 && pos !== undefined && env.readers.has('pathing') &&
      !env.readers.pathing.reachable(env.readers.map.index(pos.x, pos.y, pos.z), workTile, 'walker')) return s.get('ui.trade.wait.unreachable', { who });
  if (behavior === 'retreat') return s.get('ui.trade.wait.sheltering', { who });
  if (behavior === 'flee') return s.get('ui.trade.wait.fleeing', { who });
  if (behavior === 'need' || behavior === 'social') {
    const activity = dwarves.activityText(id);
    const key = activity === 'sleep' ? 'asleep' : activity === 'hunger' ? 'eating' : activity === 'thirst' ? 'drinking' : 'break';
    return s.get(late ? 'ui.trade.wait.late' : `ui.trade.wait.${key}`, { who });
  }
  if (late) return s.get('ui.trade.wait.late', { who });
  if (behavior === 'work' && env.readers.has('11') && env.readers.of<JobsReader>('11').forWorker(id) !== undefined) return s.get('ui.trade.wait.job', { who });
  return notTaken === null ? s.get('ui.trade.wait.on_way', { who }) : notTaken();
}

/** The Broker a trade job would be for now (20 § The session): alive, trading on, not on duty; else 0. */
function brokerFor(env: MessageEnv): EntityId {
  const broker = env.readers.of<DwarvesReader>('10').holder('broker');
  if (broker === 0 || !env.readers.entities.alive(broker) || !env.readers.of<JobsReader>('11').laborEnabled(broker, 'trading')) return 0;
  return env.readers.has('16') && env.readers.of<CombatReader>('16').onDuty(broker) ? 0 : broker;
}

/** The plural of a lower-case creature name: wolf to wolves, dwarf to dwarves, lynx to lynxes, bear to bears. */
export function pluralName(name: string): string {
  const words = name.split(' ');
  const last = words[words.length - 1] ?? '';
  let plural: string;
  if (/(?:lf|fe)$/.test(last) || last === 'dwarf') plural = last.replace(/f(e?)$/, 'ves');
  else if (/(?:s|x|z|ch|sh)$/.test(last)) plural = `${last}es`;
  else if (/[^aeiou]y$/.test(last)) plural = `${last.slice(0, -1)}ies`;
  else plural = `${last}s`;
  return [...words.slice(0, -1), plural].join(' ');
}

/** A species' plural: its creature row's own (`creatures.md` § Plurals: "sheep", "deer"), else {@link pluralName} of its name. */
export function speciesPlural(row: { readonly name: string; readonly plural?: string } | undefined): string {
  return row?.plural ?? pluralName((row?.name ?? 'creature').toLowerCase());
}

/**
 * 13 § Rot as the stocks panel and Look say it: the stage and the days left at the speed the item
 * rots now ("stale, rots in 4 days", "rotten, gone in 2 days", "fresh, not rotting here" when it
 * lies frozen, on a rack or dry in a bag); "keeps, never rots" for food with no rot timer (cured
 * meat, honey, aged cheese); '' for anything else with no rot timer.
 */
export function rotText(strings: Strings, outlook: RotOutlook | null, edible: boolean): string {
  if (outlook === null) return edible ? strings.get('ui.rot.keeps') : '';
  const stage = strings.get(outlook.stage >= 2 ? 'ui.rot.rotten' : outlook.stage === 1 ? 'ui.rot.stale' : 'ui.rot.fresh');
  const left = outlook.stage >= 2 ? outlook.toGone : outlook.toRot;
  if (left === null) return strings.get('ui.rot.not_now', { stage });
  const n = Math.max(1, Math.ceil(left / TICKS_PER_DAY));
  return strings.get(outlook.stage >= 2 ? 'ui.rot.gone_in' : 'ui.rot.rots_in', { stage, n });
}

/** An item's rot as {@link rotText} says it, read from 13. */
export function itemRotText(env: Omit<MessageEnv, 'registry'>, id: EntityId): string {
  if (!env.readers.has('13')) return '';
  const items = env.readers.of<ItemsReader>('13');
  const it = items.get(id);
  if (it === undefined) return '';
  return rotText(env.strings, items.rotOutlook(id), items.def(it.type)?.edible === true);
}

/** A stack as the log names it: its count and its name ("20 turnip", "10 turnip stew", "3 oak logs"). */
export function stackName(env: MessageEnv, id: EntityId): string {
  if (!env.readers.has('13')) return '';
  const items = env.readers.of<ItemsReader>('13');
  const it = items.get(id);
  if (it === undefined) return '';
  const meal = env.readers.has('12') ? env.readers.of<{ mealName(itemId: EntityId): string | null }>('12').mealName(id) : null;
  const material = env.registry.table<NamedRow>('materials').byIndex(it.material)?.name ?? '';
  return `${it.count} ${meal ?? materialItemName(material, items.def(it.type) ?? { name: '' }, it.count)}`;
}

/**
 * Where an item lies, as a log line names it after "in": its stockpile ("Stockpile #2 (Food)"),
 * another zone ("Dining hall #1"), the building on the tile ("Wagon #1"), else "the open" outdoors
 * and "the halls" indoors.
 */
export function itemPlace(env: MessageEnv, tile: TileIndex): string {
  const map = env.readers.map;
  if (tile < 0 || tile >= map.w * map.h * map.d) return env.strings.get('ui.place.halls');
  const b = buildingsOf(env.readers);
  if (b !== null) {
    const zone = b.zoneAt(tile);
    if (zone !== 0) {
      const type = b.zone(zone)?.type;
      return type === 'stockpile' ? stockpileName(env, zone) : zoneName(env, zone);
    }
    const building = b.at(tile);
    if (building !== 0) return buildingName(env, building);
  }
  return env.strings.get(map.isOutdoor(tile) ? 'ui.place.open' : 'ui.place.halls');
}
