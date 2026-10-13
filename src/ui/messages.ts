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
import type { Command } from '@core/commands';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { MAGMA_POWER_LEVEL } from '@systems/workshops/constants';
import type { ItemsReader } from '@systems/items';
import { STOCKPILE_PRESETS } from '@systems/items';
import type { TradeReader } from '@systems/trade';
import type { Strings } from './strings';
import type { Binding } from './keymap';
import { actionText, contextTitle } from './panels/help';

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
  return strings.get('ui.settings.binding_conflict', { context: contextTitle(binding.context), action: actionText(binding) });
}

export function invalidBindingModifiers(strings: Strings): string {
  return strings.get('ui.settings.binding_modifiers');
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

/** U-07 §4.4: identify a full stockpile by ordinal and the player's preset name. */
export function stockpileName(env: Omit<MessageEnv, 'registry'>, zoneId: EntityId): string {
  const name = zoneName(env, zoneId);
  const f = env.readers.has('13') ? env.readers.of<ItemsReader>('13').stockpile(zoneId)?.filter : undefined;
  if (f === undefined) return name;
  const preset = stockpilePreset(f);
  return env.strings.get('ui.stockpile.name', { name, preset: env.strings.get(preset === null ? 'ui.stockpile.custom' : `ui.stockpile.preset.${preset}`) });
}

/** The presentation-only reasons a zone editor action can do nothing. */
export function zoneEditorMessage(env: MessageEnv, reason: 'unavailable' | 'bounds' | 'quality' | 'no_bed' | 'pending_room' | 'no_zone'): string {
  return env.strings.get(`ui.zone.edit.${reason}`);
}

/** A civilization id as a name ("hillfolk" → "Hillfolk"). */
export function civName(civ: string): string {
  return capitalize(civ);
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
  if (active !== null) return s.get('ui.status.caravan_coming', { civ: civName(active.civ) });
  const when = Object.entries(trade.schedule()).map(([civ, season]) => s.get('ui.status.caravan_when', { civ: civName(civ), season }));
  return when.length === 0 ? s.get('ui.status.no_caravan_soon') : s.get('ui.status.no_caravan', { when: when.join(', ') });
}

/** An item type's name, singular or plural ("door", "doors"); a raw match word reads as words. */
export function itemName(registry: Registry, id: string, n = 1): string {
  const row = registry.table<NamedRow>('items').byId(id);
  if (row === undefined) return id.replace(/_/g, ' ');
  return n === 1 ? row.name : row.plural ?? `${row.name}s`;
}

/** A building input or recipe match ("block|log") as words: "block or log". */
export function matchName(registry: Registry, match: string, n = 1): string {
  return match.split('|').map((part) => itemName(registry, part, n)).join(' or ');
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
export function whereMade(registry: Registry, itemIds: readonly string[]): string {
  const names = Array.from(new Set(itemIds.flatMap((id) => producersOf(registry, id))));
  if (names.length === 0 || names.length > 3) return '';
  const each = names.map((n) => `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n}`);
  return each.length === 1 ? (each[0] as string) : `${each.slice(0, -1).join(', ')} or ${each[each.length - 1] as string}`;
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
  SetStockpileFilter: 'zone', SetStockpileContainers: 'zone', SetStockpilePriority: 'zone', LinkStockpile: 'zone',
  PlaceBuilding: 'building_type', CancelBuilding: 'building', DeconstructBuilding: 'building',
  SetBuildingPriority: 'building', ResizeZone: 'zone', RemoveZone: 'zone', SetZoneSetting: 'zone', AssignRoom: 'zone',
  LinkMechanism: 'building', UnlinkMechanism: 'building', SetDoorMode: 'building', SetHatchMode: 'building',
  SetPlateTrigger: 'building', ReleaseCage: 'building', AssignCoffin: 'building', DisbandSquad: 'squad',
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
export function filterText(registry: Registry, filter: Readonly<Record<string, unknown>>, n: number): string {
  const items = registry.table<NamedRow>('items');
  const nameOf = (index: number): string => {
    const row = items.byIndex(index);
    return row === undefined ? '' : n === 1 ? row.name : row.plural ?? `${row.name}s`;
  };
  let name = '';
  if (typeof filter['type'] === 'number') name = nameOf(filter['type']);
  else if (Array.isArray(filter['types'])) name = (filter['types'] as number[]).slice(0, 2).map(nameOf).filter((x) => x !== '').join(' or ');
  else if (typeof filter['emptyContainer'] === 'string') name = `empty ${itemName(registry, filter['emptyContainer'], n)}`;
  else if (typeof filter['category'] === 'string') name = (filter['category'].split('/').pop() ?? '').replace(/_/g, ' ');
  else if (filter['edible'] === true) name = 'food';
  else if (filter['drinkable'] === true) name = 'drink';
  else if (typeof filter['tag'] === 'string') name = filter['tag'].replace(/_/g, ' ');
  if (name === '') name = n === 1 ? 'item' : 'items';
  const material = filter['materialId'];
  if (typeof material === 'number') {
    const m = registry.table<NamedRow>('materials').byIndex(material)?.name;
    if (m !== undefined) name = `${m} ${name}`;
  } else if (typeof filter['materialClass'] === 'string') name = `${filter['materialClass']} ${name}`;
  return `${n} ${name}`;
}

/** The item ids a filter names, for {@link whereMade}. */
function filterItemIds(registry: Registry, filter: Readonly<Record<string, unknown>>): string[] {
  const items = registry.table<NamedRow>('items');
  const ids: number[] = typeof filter['type'] === 'number' ? [filter['type']] : Array.isArray(filter['types']) ? (filter['types'] as number[]) : [];
  return ids.map((i) => items.byIndex(i)?.id ?? '').filter((id) => id !== '');
}

/** A job as the blocked-reason column reads it. */
export interface BlockedJob {
  readonly type: number;
  readonly blockedReason: string | null;
  readonly tool: string | null;
  readonly inputs: readonly { readonly filter: object; readonly count: number; readonly delivered: readonly number[] }[];
}

/**
 * A blocked job's reason: `short` for the jobs table's cell ("waiting: 1 door"), `long` for the
 * selected job's line, which also says where to get the missing item ("— order at a carpenter's
 * workshop") or what to do.
 */
export function jobBlockText(env: MessageEnv, job: BlockedJob): { short: string; long: string } {
  const s = env.strings;
  const reason = job.blockedReason ?? '';
  if (reason === 'missing_input') {
    const input = job.inputs.find((i) => i.count - i.delivered.length > 0) ?? job.inputs[0];
    if (input !== undefined) {
      const n = Math.max(1, input.count - input.delivered.length);
      const filter = input.filter as Readonly<Record<string, unknown>>;
      const what = filterText(env.registry, filter, n);
      const where = whereMade(env.registry, filterItemIds(env.registry, filter));
      const short = s.get('ui.jobs.reason.missing_input', { what });
      return { short, long: where === '' ? short : s.get('ui.block.order_at', { text: short, where }) };
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
export function waitingFor(env: Omit<MessageEnv, 'strings'>, reason: string | null): { match: string; item: string; n: number } | null {
  const waiting = reason === null ? null : /^waiting for (.+)$/.exec(reason);
  if (waiting === null) return null;
  const match = waiting[1] as string;
  const items = env.readers.has('13') ? env.readers.of<ItemsReader>('13') : null;
  const table = env.registry.table<NamedRow>('items');
  const n = items !== null && table.has(match) ? items.countAvailable({ type: table.index(match) }) : 0;
  return { match, item: itemName(env.registry, match), n };
}

/**
 * A workshop order's waiting reason as words (`12` § Operation 3: "waiting for <input>"): the
 * reader's `isRunnable` reason, which names the input (`waiting for raw_stone`), or the fuel
 * shortage it reports as `missing_input`.
 */
export function workshopBlockText(env: MessageEnv, reason: string | null): string {
  const s = env.strings;
  if (reason === null) return '';
  const waiting = waitingFor(env, reason);
  if (waiting !== null) {
    const text = s.get('ui.block.waiting_for', { item: waiting.item, n: waiting.n });
    const where = whereMade(env.registry, [waiting.match]);
    return where === '' ? text : s.get('ui.block.order_at', { text, where });
  }
  if (reason === 'missing_input') {
    const items = env.registry.table<NamedRow>('items');
    const fuels = items.ids().filter((id) => items.byId(id)?.tags?.includes('fuel') === true);
    const where = whereMade(env.registry, fuels);
    return where === '' ? s.get('ui.block.fuel') : s.get('ui.block.order_at', { text: s.get('ui.block.fuel'), where });
  }
  return s.has(`ui.block.${reason}`) ? s.get(`ui.block.${reason}`) : s.get('ui.jobs.reason.other');
}

/** Why a gear or member chooser cannot open. */
export function militaryNoSquad(env: MessageEnv): string {
  return env.strings.get('ui.military.no_squad');
}

/** An accepted trade request waits for the broker to walk to the depot. */
export function brokerOnWay(env: MessageEnv, paused: boolean): string {
  const text = env.strings.get('ui.depot.broker_on_way');
  return paused ? `${text} · ${env.strings.get('ui.depot.resume')}` : text;
}
