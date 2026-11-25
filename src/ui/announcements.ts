/**
 * The announcement registry and the log.
 *
 * `02-systems/24-ui-and-input.md` § Announcements and the log: "The announcement registry maps
 * event types to `{ severity, text, focus }` (from `register.announcement`). Text comes from the
 * strings table with placeholders filled from the event and readers." `note` is appended in gray;
 * `alert` in yellow and the strip flashes for one second; `danger` in red, the game pauses when
 * `auto-pause on danger` is on (default on), the view centres on the focus and the strip shows the
 * line until any key dismisses it. "Log size `LOG_MAX_LINES` in memory"; "Repeated identical
 * announcements within `LOG_DEDUP_TICKS`, or within one day, are merged with a count ("×3")."
 */

import { dayIndexOf } from '@core/calendar';
import { C, ItemFlag } from '@core/components';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { AnnouncementSpec } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { AnimalsReader } from '@systems/animals';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { TICKS_PER_DAY } from '@core/constants';
import { HINT_FOOD_DAYS_PER_ITEM, LOG_BLEEDING_NAMES, LOG_DEDUP_TICKS, LOG_ENGAGEMENT_TICKS, LOG_IMMIGRANT_NAMES, LOG_MAX_LINES, LOG_MISERABLE_REASONS, LOG_STANDING_ALERTS, ROT_ALERT_DAYS } from './constants';
import type { DwarvesReader } from '@systems/dwarves';
import type { MoraleReader } from '@systems/morale';
import type { WorkshopsReader } from '@systems/workshops';
import { capitalize, enchantedName, itemName, matchName, materialItemName, stockpileName, buildingName, zoneName, itemPlace, speciesPlural, stackName, tradeWaitFor, whimProgressText } from './messages';
import { moodTierName } from './panels/mood';
import { overGrazed, pastureFeed } from './pasture';
import { calmTail, raidArrival, raidEndedText, raidGone, stolenGoodsText, stolenOf, theftKey, type Stolen } from './raid-lines';
import { Strings } from './strings';

export type Severity = 'note' | 'alert' | 'danger';

export interface LogLine {
  tick: number;
  severity: Severity;
  text: string;
  /** How many identical lines were merged into this one. */
  count: number;
  focus?: TileIndex;
  category?: string;
  /**
   * The creature or item the line names, when one existed as it was announced (T-679): the log panel's
   * `[v]` opens its view while it still exists. Presentation state, saved with the line.
   */
  subject?: EntityId;
  /**
   * The string key the line's text was filled from (T-725), as it reads now: a line that grows
   * ("3 dwarves are starving: …") takes the key of its new words. The legend's last words fold by it.
   * Set on every line the announcer writes; a line the UI writes itself (a refused command, a save's
   * note, a hint) and a line of an older save have none. Presentation state, saved with the line.
   */
  key?: string;
  /**
   * The days in a row a standing alert has come (T-741), when more than one: its line of the day
   * before took the newest words. Presentation state, saved with the line; absent is one day.
   */
  days?: number;
}

/** A line's words and the string key they were filled from (T-725). */
export interface Said {
  readonly key: string;
  readonly text: string;
}

/** The strip's prefix per severity: "danger lines are prefixed `!!`, alerts `!`". */
export function prefixOf(severity: Severity): string {
  return severity === 'danger' ? '!! ' : severity === 'alert' ? '! ' : '';
}

/**
 * A line only the Combat tab lists: a combat note, a blow or a kill (16 § Combat log). The All tab
 * and the strip leave them out, so a fight does not bury the rest of the log.
 */
export function combatOnly(line: LogLine): boolean {
  return line.category === 'combat' && line.severity === 'note';
}

/** The UI's own strings, for the words a line is printed with. */
const PLAIN = new Strings();

/**
 * A line as the strip and the log panel print it, with its merge count; a standing alert that has
 * come on more days than one is marked with them instead, as the legend's last words are
 * ("! 113 food will rot within 3 days; … (6 days)", T-741).
 */
export function lineText(line: LogLine): string {
  const days = line.days ?? 1;
  if (days > 1) return PLAIN.get('ui.legend.folded', { line: `${prefixOf(line.severity)}${line.text}`, n: days });
  return `${prefixOf(line.severity)}${line.text}${line.count > 1 ? ` ×${line.count}` : ''}`;
}

interface NamedRow {
  readonly id: string;
  readonly name: string;
}

/** A creature in the fortress's engagement, as it was when it first fought in it. */
interface Fighter {
  readonly id: number;
  readonly species: number;
  readonly name: string;
}

/** The fortress's open engagement (16 § Combat log): its line, who has fought in it on each side, and its last blow. */
interface Engagement {
  readonly line: LogLine;
  readonly ours: Fighter[];
  readonly foes: Fighter[];
  last: number;
}

/** A reason on the miserable line: a negative thought's text and its weight (its value, made positive). */
interface Reason {
  readonly text: string;
  readonly weight: number;
}

/** What announcing one event produced. */
export interface Announced {
  readonly line: LogLine;
  readonly severity: Severity;
  readonly focus: TileIndex | undefined;
  /** A standing alert folded into its line of the day before (T-741): it neither flashes the strip nor pauses. */
  readonly folded?: true;
}

export class AnnouncementLog {
  /** The fortress's engagement line while its blows keep coming (presentation state, not saved). */
  private engagement: Engagement | null = null;
  /** Fortress dwarves whose death line named the killer: their `KillRecorded` makes no line. */
  private readonly killsTold = new Set<number>();
  readonly lines: LogLine[] = [];
  private readonly specs = new Map<string, AnnouncementSpec[]>();
  private readonly seen = new Set<string>();
  /** The open frost line of each plot and crop (`announceFrost`). */
  private readonly frostLines = new Map<string, { line: LogLine; n: number }>();
  /** The open line of what each party escaped with (`announceTheft`). */
  private readonly theftLines = new Map<number, { line: LogLine; stolen: Stolen[] }>();
  /** The day's starving line and the dwarves it names (`announceStarving`). */
  private starving: { line: LogLine; ids: number[]; names: string[] } | null = null;
  /** The day's miserable line, the dwarves it names and the reasons each gave (`announceMiserable`). */
  private miserable: { line: LogLine; ids: number[]; names: string[]; reasons: Reason[][] } | null = null;
  /** The day's line of fortress animals bleeding with no dressing and the animals it names (`announceBleedingAnimal`). */
  private bleeding: { line: LogLine; ids: number[]; names: string[] } | null = null;
  /** The open line of each announced thought this tick and the dwarves it names (`announceThought`; not saved). */
  private readonly thoughtLines = new Map<string, { line: LogLine; tick: number; ids: number[]; names: string[] }>();
  /** Where each party's last line put it, for a line that comes after it left the map (a theft, its raid's end; not saved). */
  private readonly partyTiles = new Map<number, TileIndex>();
  /** The standing alerts' templates as patterns (`templateOf`). */
  private readonly templates = new Map<string, RegExp>();

  constructor(
    private readonly strings: Strings,
    private readonly registry: Registry,
    private readonly history: { workshopIdleNotes: number[]; miasmaAdvised?: boolean } = { workshopIdleNotes: [] },
  ) {}

  /** Load the rows systems registered (`register.announcement`). */
  register(rows: readonly { type: EventType; spec: AnnouncementSpec }[]): void {
    for (const row of rows) {
      const specs = this.specs.get(row.type) ?? [];
      specs.push(row.spec);
      this.specs.set(row.type, specs);
    }
  }

  specFor(type: string): AnnouncementSpec | undefined {
    const specs = this.specs.get(type);
    return specs?.[specs.length - 1];
  }

  /** The placeholders an event offers: its fields, with ids and indices named through the readers. */
  params(event: GameEvent, readers: ReaderSet): Record<string, string | number> {
    const out: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(event)) {
      if (typeof value === 'string' || typeof value === 'number') out[key] = value;
    }
    const e = event as unknown as Record<string, unknown>;
    const deadId = e['id'];
    // A death or a lost limb names the creature from the event, which carries the name taken when it happened.
    if ((event.type === 'CreatureDied' || event.type === 'LimbLost') && typeof deadId === 'number') {
      const creature = readers.entities.get(deadId, C.Creature);
      const rawName = typeof e['name'] === 'string' && e['name'].length > 0 ? e['name'] : creature?.name;
      const speciesIdx = typeof e['species'] === 'number' ? e['species'] : creature?.species;
      const formatted = this.formatCreatureName(rawName, speciesIdx);
      out['name'] = formatted;
      out['dwarf'] = formatted;
    }
    const trapped = e['creatureId'];
    if (typeof trapped === 'number') {
      const creature = readers.entities.get(trapped, C.Creature);
      if (creature !== undefined) out['species'] = this.registry.table<NamedRow>('creatures').byIndex(creature.species)?.name ?? '';
    }
    if (out['dwarf'] === undefined) {
      for (const key of ['finderId', 'minerId', 'dwarfId', 'thaneId', 'id', 'previousId'] as const) {
        const who = e[key];
        if (typeof who === 'number') {
          const creature = readers.entities.get(who, C.Creature);
          if (creature !== undefined) {
            out['dwarf'] = this.formatCreatureName(creature.name, creature.species);
            break;
          }
        }
      }
    }
    // A spell names its caster and its target (25 § Spells, a firebloom that caught a fortress creature).
    const caster = e['casterId'];
    if (typeof caster === 'number' && caster !== 0) {
      const who = readers.entities.get(caster, C.Creature);
      out['caster'] = this.formatCreatureName(who?.name, who?.species);
      const target = e['targetId'];
      const whom = typeof target === 'number' ? readers.entities.get(target, C.Creature) : undefined;
      out['target'] = this.formatCreatureName(whom?.name, whom?.species);
    }
    // A hunt names its hunter and its prey (09 § Registrations, T-M7-10).
    const hunter = e['hunterId'];
    if (typeof hunter === 'number' && hunter !== 0) {
      const who = readers.entities.get(hunter, C.Creature);
      out['hunter'] = this.formatCreatureName(who?.name, who?.species);
    }
    const prey = e['targetId'];
    if (typeof prey === 'number' && prey !== 0) {
      const species = readers.entities.get(prey, C.Creature)?.species ?? (typeof e['targetSpecies'] === 'number' ? e['targetSpecies'] : undefined);
      out['prey'] = this.formatCreatureName(undefined, species);
    }
    // A species field, as an index or a content id, reads as the species' name (a creature's, or a
    // plant's for a farm plot's seeds); the event's raw field was copied above, so it is replaced
    // unless a caught creature already named it.
    const speciesOf = e['species'];
    if (!(typeof trapped === 'number' && readers.entities.get(trapped, C.Creature) !== undefined)) {
      const table = this.registry.table<NamedRow>('creatures');
      const plants = this.registry.hasTable('plants') ? this.registry.table<NamedRow>('plants') : null;
      if (typeof speciesOf === 'number') out['species'] = table.byIndex(speciesOf)?.name ?? '';
      else if (typeof speciesOf === 'string') out['species'] = table.byId(speciesOf)?.name ?? plants?.byId(speciesOf)?.name ?? speciesOf.replace(/_/g, ' ');
    }
    // A civilization reads as its name without the article, as the panels write it ("Hillfolk");
    // the strings put "the" before it where the sentence wants one.
    const civ = e['civ'];
    if (typeof civ === 'string' && this.registry.hasTable('civilizations')) {
      const name = this.registry.table<NamedRow>('civilizations').byId(civ)?.name ?? civ;
      out['civ'] = capitalize(name.replace(/^the /, ''));
    }
    // 20 § Movement: a caravan's lines name its depot ("Trade depot #1") and its edge ("west"); so does the goods' return.
    if ((event.type === 'CaravanWaiting' || event.type === 'CaravanAtDepot' || event.type === 'DepotGoodsReturned') && typeof e['depotId'] === 'number') {
      out['depot'] = buildingName({ readers, registry: this.registry }, e['depotId']) || this.strings.get('ui.depot.a_depot');
    }
    // 20 § The session: a caravan leaving with a trade request unserved says why, as the depot's line would.
    if (event.type === 'TradeMissed' && readers.has('10') && readers.has('11')) {
      out['why'] = tradeWaitFor({ readers, registry: this.registry, strings: this.strings }, 0, Number(e['traderId'] ?? 0), -1, true, Number(e['depotId'] ?? 0));
    }
    const edge = e['edge'];
    if ((event.type === 'CaravanWaiting' || event.type === 'RaidArrived') && typeof edge === 'string' && this.strings.has(`ui.edge.${edge}`)) out['edge'] = this.strings.get(`ui.edge.${edge}`);
    // 18 § Morale, Nerve: "A gloam warrior has lost its nerve and runs."
    if (event.type === 'HostileFled') {
      const species = typeof speciesOf === 'number' ? speciesOf : readers.entities.get(Number(e['id']), C.Creature)?.species;
      const name = this.formatCreatureName(undefined, species);
      out['raider'] = name.charAt(0).toUpperCase() + name.slice(1);
    }
    // 10 § The Thane's whim: `{whim}` is the whim row's text.
    const whimId = e['whimId'];
    if (whimId !== undefined) {
      const row = typeof whimId === 'string' && this.registry.hasTable('whims') ? this.registry.table<{ id: string; text: string }>('whims').byId(whimId) : undefined;
      out['whim'] = row?.text ?? String(whimId);
      // The wish says how far the fortress is with it: "3 of 20 fine meals in stock", "0 of 1 in place".
      const view = readers.has('10') ? readers.of<DwarvesReader>('10').whim() : null;
      out['progress'] = whimProgressText(this.strings, this.registry, String(whimId), view?.id === whimId ? view.have : 0);
    }
    // 10 § Titles: a title reads by its name ("is now the Thane"); the line of a title taken away names who held it.
    if (event.type === 'TitleAssigned' && typeof e['title'] === 'string' && this.strings.has(`ui.title.${e['title']}`)) out['title'] = this.strings.get(`ui.title.${e['title']}`);
    const skill = e['skill'];
    if (typeof skill === 'string' && this.registry.hasTable('skills')) {
      out['skill'] = this.registry.table<NamedRow>('skills').byId(skill)?.name ?? skill;
    }
    if (event.type === 'FortressShutOut' && Array.isArray(e['doors'])) {
      out['doors'] = (e['doors'] as number[]).map((door) => buildingName({ readers, registry: this.registry }, door)).join(', ');
    }
    if ((event.type === 'WorkshopBlocked' || event.type === 'WorkOrderSkipped') && typeof e['workshopId'] === 'number') {
      out['workshop'] = buildingName({ readers, registry: this.registry }, e['workshopId']);
      out['input'] = typeof e['input'] === 'string' ? matchName(this.registry, e['input'], 1, this.strings) : this.strings.get('ui.workshop.input_unspecified');
    }
    // 12 § Registrations: a skipped order is named by its recipe ("its make steel order").
    const recipeId = e['recipeId'];
    if (event.type === 'WorkOrderSkipped' && (typeof recipeId === 'string' || typeof recipeId === 'number')) {
      const name = readers.has('12') ? readers.of<WorkshopsReader>('12').recipe(recipeId)?.name : undefined;
      out['recipe'] = name === undefined ? String(recipeId).replace(/_/g, ' ') : name.charAt(0).toLowerCase() + name.slice(1);
    }
    if (event.type === 'IceMelted') out['place'] = this.icePlace(readers, (e['tiles'] as readonly TileIndex[] | undefined) ?? []);
    if (event.type === 'PlotNeedsSeeds') out['plot'] = zoneName({ readers, strings: this.strings }, Number(e['zoneId'])) || this.strings.get('ui.zone.type.farm_plot');
    // A workshop waiting for an empty container names the container class (12 § Operation 3).
    if (event.type === 'WorkshopBlocked' && typeof e['container'] === 'string') out['container'] = itemName(this.registry, e['container']);
    const crafter = e['crafterId'];
    if (typeof crafter === 'number') out['crafter'] = readers.entities.get(crafter, C.Creature)?.name ?? '';
    const smith = e['smithId'];
    if (typeof smith === 'number') out['smith'] = readers.entities.get(smith, C.Creature)?.name ?? '';
    const itemId = e['itemId'];
    if (typeof itemId === 'number') {
      const item = readers.entities.get(itemId, C.Item);
      if (item !== undefined) out['item'] = this.registry.table<NamedRow>('items').byIndex(item.type)?.name ?? '';
      // A set stone names the whole item with its suffix: "steel axe of embers".
      if (item !== undefined && event.type === 'StoneSet') {
        const material = this.registry.table<NamedRow>('materials').byIndex(item.material)?.name ?? '';
        const type = this.registry.table<NamedRow>('items').byIndex(item.type);
        out['item'] = enchantedName(readers, itemId, materialItemName(material, type ?? { name: '' }));
      }
    }
    const tier = e['tier'];
    if (typeof tier === 'number' && this.registry.hasTable('roomTiers')) {
      const tiers = this.registry.table<{ id: string; tier: number }>('roomTiers');
      out['tierName'] = tiers.ids().find((id) => tiers.byId(id)?.tier === tier) ?? String(tier);
    }
    const material = e['material'];
    if (typeof material === 'number' || typeof material === 'string') {
      const table = this.registry.table<NamedRow>('materials');
      const row = typeof material === 'number' ? materialByIndex(table, material) : table.byId(material);
      out['material'] = row?.name ?? String(material);
    }
    const thoughtId = e['thoughtId'];
    if (typeof thoughtId === 'string' && this.registry.hasTable('thoughts')) {
      const thoughtRow = this.registry.table<{ id: string; text?: string }>('thoughts').byId(thoughtId);
      if (thoughtRow?.text !== undefined) out['thought'] = thoughtRow.text;
    }
    // A creature with a name of its own by that name (a blow by its first word: "Halvar hits a
    // gloam archer"), any other by its species with an article, never its content id; one that is
    // gone by the time the line is drawn is "a creature".
    const short = event.type === 'AttackResolved';
    const attackerId = e['attackerId'] ?? e['attacker'];
    if (typeof attackerId === 'number' && attackerId !== 0) out['attacker'] = this.creatureLabel(readers, attackerId, short);
    const defenderId = e['defenderId'] ?? e['defender'];
    if (typeof defenderId === 'number' && defenderId !== 0) out['defender'] = this.creatureLabel(readers, defenderId, short);
    const killerId = e['killerId'];
    if (event.type === 'KillRecorded') {
      // The event carries the names taken when the victim died; the creatures may be gone by now.
      const named = (name: unknown, species: unknown): string => this.formatCreatureName(typeof name === 'string' ? name : undefined, typeof species === 'number' ? species : undefined);
      out['killer'] = named(e['killerName'], e['killerSpecies']);
      out['victim'] = named(e['victimName'], e['victimSpecies']);
      return out;
    }
    if (event.type === 'CreatureDied' && typeof killerId === 'number' && killerId !== 0) {
      // A death names its killer from the event, which carries the name taken when it happened ("a boar", a trap by its building).
      const creature = readers.entities.get(killerId, C.Creature);
      const name = typeof e['killerName'] === 'string' && e['killerName'].length > 0 ? e['killerName'] : creature?.name;
      const species = typeof e['killerSpecies'] === 'number' ? e['killerSpecies'] : creature?.species;
      out['killer'] = killerWords(this.registry, name, species);
    } else if (typeof killerId === 'number' && killerId !== 0) {
      out['killer'] = this.creatureLabel(readers, killerId, false);
    }
    // §4.5: a reason code reads as words ("No immigrants this season: hall spirit must be
    // Content (now Unhappy)", "…fallen: they were offered wooden goods"); a stockpile by name.
    if (event.type === 'ImmigrationSkipped' || event.type === 'ReputationChanged') {
      const reason = String(e['reason'] ?? '');
      const tier = readers.has('15') ? moodTierName(this.strings, readers.of<{ hallSpiritTier(): number }>('15').hallSpiritTier()) : '';
      const keyOf = (code: string): string => event.type === 'ImmigrationSkipped' ? `announce.immigration_skipped.reason.${code}` : `announce.reputation_changed.reason.${code}`;
      out['reason'] = this.strings.has(keyOf(reason)) ? this.strings.get(keyOf(reason), { tier }) : this.strings.get(keyOf('other'));
    }
    if (event.type === 'StockpileFull' && typeof deadId === 'number') out['zone'] = stockpileName({ readers, strings: this.strings }, deadId) || this.strings.get('ui.zone.type.stockpile');
    const victimId = e['victimId'];
    if (typeof victimId === 'number' && victimId !== 0) out['victim'] = this.creatureLabel(readers, victimId, false);
    return out;
  }

  /**
   * 08 § Player-facing behavior: a starving animal by its own name or as "The cow", and, on a pasture
   * whose grass feeds fewer grazers than it holds, that pasture and its count ("The cow is starving:
   * Pasture #1 feeds 0 of 6 grazers."). Sets `{animal}` (and the pasture's placeholders) in `params`.
   */
  private animalStarvingKey(id: unknown, readers: ReaderSet, params: Record<string, string | number>): string {
    const creature = typeof id === 'number' ? readers.entities.get(id, C.Creature) : undefined;
    const row = creature === undefined ? undefined : this.registry.table<NamedRow>('creatures').byIndex(creature.species);
    const own = creature !== undefined && creature.name !== '' && creature.name !== row?.name && creature.name !== row?.id;
    params['animal'] = own ? creature.name : capitalize(this.strings.get('ui.creature.the_species', { species: (row?.name ?? 'animal').toLowerCase() }));
    const pasture = typeof id === 'number' && readers.has('08') ? readers.of<AnimalsReader>('08').pastureOf(id) : 0;
    const feed = pasture === 0 ? null : pastureFeed(readers, pasture);
    if (feed === null || !overGrazed(feed)) return 'announce.animal_starving';
    params['pasture'] = zoneName({ readers, strings: this.strings }, pasture);
    params['fed'] = feed.supported;
    params['n'] = feed.grazers;
    return 'announce.animal_starving.pasture';
  }

  /** A creature in a line: {@link creatureWords}, its own name's first word when `short`, "a creature" when it is gone. */
  private creatureLabel(readers: ReaderSet, id: number, short: boolean): string {
    const creature = readers.entities.get(id, C.Creature);
    if (creature === undefined) return creatureWords(this.registry, undefined, undefined);
    const words = creatureWords(this.registry, creature.name, creature.species);
    return short && words === creature.name ? words.split(' ')[0] ?? words : words;
  }

  /**
   * `IceMelted`'s `{place}` (05 § Ice constructions): the zone on or beside the first melted tile
   * ("Stockpile #2"), else "the surface" for ice that stood outdoors, else "the halls".
   */
  private icePlace(readers: ReaderSet, tiles: readonly TileIndex[]): string {
    const first = tiles[0];
    const map = readers.map;
    if (first === undefined || first < 0 || first >= map.w * map.h * map.d) return this.strings.get('announce.ice_melted.place.halls');
    if (readers.has('14')) {
      const zones = readers.of<BuildingsReader>('14');
      const { x, y, z } = map.unpack(first);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!map.inBounds(x + dx, y + dy, z)) continue;
          const zone = zones.zoneAt(map.index(x + dx, y + dy, z));
          if (zone !== 0) return zoneName({ readers, strings: this.strings }, zone);
        }
      }
    }
    // The melted tile is open now: outdoors when the sky reaches it.
    return map.isOutdoor(first)
      ? this.strings.get('announce.ice_melted.place.surface')
      : this.strings.get('announce.ice_melted.place.halls');
  }

  /**
   * 17 § Registrations: a death's line by its cause (`announce.died.<cause>`): "has bled to death",
   * "has starved to death", "has been killed by a boar"; a blow with no killer known "has died of
   * wounds". A cause with no line of its own keeps the plain "has died." (null).
   */
  private deathKey(cause: unknown, killer: unknown): string | null {
    return deathLineKey(this.strings, cause, killer);
  }

  /**
   * 21 § Registrations: the immigrants line names a wave of up to `LOG_IMMIGRANT_NAMES` newcomers,
   * each with their best skill and its level, a child as a child: "Vigga Pinegate (Farming 5), Ivar
   * Coaleye (Woodcutting 3) and Ottar Brightfist have come to join the hall." A larger wave is
   * counted, with where to see them ("[u] lists them"). Sets `{names}` and returns the key; null
   * when the event names nobody, which keeps the plain count.
   */
  private immigrantsLine(fields: Record<string, unknown>, readers: ReaderSet, params: Record<string, string | number>): string | null {
    const ids = Array.isArray(fields['ids']) ? (fields['ids'] as unknown[]).filter((id): id is number => typeof id === 'number') : [];
    if (ids.length === 0) return null;
    const children = typeof fields['children'] === 'number' ? fields['children'] : 0;
    const counted = children === 0 ? 'announce.immigrants_counted' : 'announce.immigrants_counted_children';
    if (ids.length > LOG_IMMIGRANT_NAMES) return counted;
    const dwarves = readers.has('10') ? readers.of<{ isChild(id: number): boolean }>('10') : null;
    const skills = this.registry.hasTable('skills') ? this.registry.table<NamedRow>('skills') : null;
    const names: string[] = [];
    for (const id of ids) {
      const name = readers.entities.get(id, C.Creature)?.name;
      if (name === undefined || name === '') return counted;
      if (dwarves?.isChild(id) === true) { names.push(this.strings.get('announce.immigrant_child', { name })); continue; }
      // The highest level, ties by the skill table's order (the units panel's profession rule).
      const levels = readers.entities.get(id, C.Skills)?.level ?? [];
      let best = -1;
      levels.forEach((level, index) => { if (level > 0 && (best < 0 || level > (levels[best] ?? 0))) best = index; });
      const skill = best < 0 ? undefined : skills?.byIndex(best)?.name;
      names.push(skill === undefined ? name : this.strings.get('announce.immigrant_skilled', { name, skill, level: levels[best] ?? 0 }));
    }
    params['names'] = names.length === 1 ? names[0] as string
      : this.strings.get('announce.list_and', { list: names.slice(0, -1).join(', '), last: names[names.length - 1] as string });
    return names.length === 1 ? 'announce.immigrant_named' : 'announce.immigrants_named';
  }

  private formatCreatureName(name: string | undefined, speciesIndex: number | undefined): string {
    return creatureWords(this.registry, name, speciesIndex);
  }

  /**
   * Map an event through the registry and append it; `null` when the event has no row. A blow
   * (`AttackResolved`) is its own line, a note; the fortress's engagement line is {@link engage}'s.
   */
  announce(event: GameEvent, readers: ReaderSet, tick: number): Announced | null {
    const done = this.announceLine(event, readers, tick);
    if (done === null) return null;
    // T-679: every line keeps a place to go to and what it names, as far as the event tells them.
    const line = done.line;
    const partyId = (event as unknown as Record<string, unknown>)['partyId'];
    if (line.focus === undefined && typeof partyId === 'number') {
      const last = this.partyTiles.get(partyId);
      if (last !== undefined) line.focus = last;
    }
    if (typeof partyId === 'number' && line.focus !== undefined) this.partyTiles.set(partyId, line.focus);
    if (line.subject === undefined) {
      const subject = subjectOf(event, readers);
      if (subject !== undefined) line.subject = subject;
    }
    return line.focus === done.focus ? done : { ...done, focus: line.focus };
  }

  private announceLine(event: GameEvent, readers: ReaderSet, tick: number): Announced | null {
    const fields = event as unknown as Record<string, unknown>;
    // 16 § Kills and loot: a fortress dwarf's death line that named its killer is the kill's only line.
    if (event.type === 'KillRecorded' && typeof fields['victimId'] === 'number' && this.killsTold.delete(fields['victimId'])) return null;
    // Completion/removal must clear suppression even when the event has no announcement.
    const finished = event.type === 'JobCompleted' && fields['jobType'] === 'craft' ? fields['target']
      : event.type === 'BuildingRemoved' ? fields['id'] : undefined;
    if (typeof finished === 'number') this.history.workshopIdleNotes = this.history.workshopIdleNotes.filter(id => id !== finished);
    const idleWorkshop = event.type === 'WorkshopBlocked' && fields['reason'] === 'missing_input' ? fields['workshopId'] : undefined;
    if (typeof idleWorkshop === 'number' && this.history.workshopIdleNotes.includes(idleWorkshop)) return null;
    const spec = this.specs.get(event.type)?.find((candidate) => {
      if (candidate.atLeast !== undefined) {
        const value = fields[candidate.atLeast.field];
        if (typeof value !== 'number' || value < candidate.atLeast.value) return false;
      }
      if (candidate.atMost !== undefined) {
        const value = fields[candidate.atMost.field];
        if (typeof value !== 'number' || value > candidate.atMost.value) return false;
      }
      return candidate.oneOf === undefined || candidate.oneOf.values.includes(fields[candidate.oneOf.field] as string | number | boolean);
    });
    if (spec === undefined) return null;
    if (event.type === 'CropDied') return this.announceFrost(fields, readers, tick, spec);
    if (event.type === 'Starving') return this.announceStarving(event, readers, tick, spec);
    if (event.type === 'MoodTierChanged') return this.announceMiserable(event, readers, tick, spec);
    if (event.type === 'ThoughtGained') return this.announceThought(event, readers, tick, spec);
    if (event.type === 'NoDressing' && typeof fields['id'] === 'number' && !readers.entities.has(fields['id'], C.Attributes)) {
      return this.announceBleedingAnimal(event, fields['id'], readers, tick, spec);
    }
    if (event.type === 'MiasmaSpread') return this.announceMiasma(fields, readers, tick, spec);
    if (event.type === 'ThiefEscaped') return this.announceTheft(fields, readers, tick, spec);
    if (event.type === 'RaidEnded') return this.announceRaidEnded(fields, readers, tick, spec);
    if (typeof idleWorkshop === 'number') { this.history.workshopIdleNotes.push(idleWorkshop); this.history.workshopIdleNotes.sort((a, b) => a - b); }
    const creatureId = fields['id'];
    const dwarfDeath = event.type === 'CreatureDied' && typeof creatureId === 'number' &&
      (readers.entities.has(creatureId, C.Brain) ||
        (fields['species'] === this.registry.table('creatures').index('dwarf') && fields['faction'] === 'fortress'));
    // 08 § Death: a pet's death is an alert. The pet is gone when the line is drawn, so the event says whose it was.
    const petDeath = event.type === 'CreatureDied' && typeof fields['petOf'] === 'number' && fields['petOf'] !== 0;
    if (event.type === 'CreatureUnconscious' && (typeof creatureId !== 'number' || !readers.entities.has(creatureId, C.Brain))) return null;
    if (spec.once === true) {
      if (this.seen.has(event.type)) return null;
      this.seen.add(event.type);
    }
    let key = spec.keyField === undefined ? spec.stringKey : `${spec.stringKey}.${String(fields[spec.keyField])}`;
    // §4.5: "drop the clause when 0" children came.
    if (event.type === 'ImmigrantsArrived' && fields['children'] === 0) key = 'announce.immigrants_arrived_adults';
    if (event.type === 'CreatureDied' && typeof creatureId === 'number' && !dwarfDeath) {
      key = fields['cause'] === 'faded' ? 'announce.summon_faded'
        : petDeath ? 'announce.pet_died' : 'announce.creature_died';
    }
    const params = this.params(event, readers);
    // 17 § Registrations: a death says how it came, by its cause ("Ketil Ironvein has bled to death.").
    if (event.type === 'CreatureDied' && key !== 'announce.summon_faded') key = this.deathKey(fields['cause'], params['killer']) ?? key;
    // A fortress dwarf killed by a creature: the death line names the killer and is a combat line too.
    const killTold = dwarfDeath && key === 'announce.died.killed_by' && typeof creatureId === 'number';
    if (killTold) this.killsTold.add(creatureId);
    if (event.type === 'ImmigrantsArrived') key = this.immigrantsLine(fields, readers, params) ?? key;
    if (event.type === 'AnimalStarving') key = this.animalStarvingKey(creatureId, readers, params);
    const said = this.strings.get(key, params);
    // 18 § Registrations: under a Calm alert a raid's danger line says what the alert does and its keys, as true then.
    const tail = raidArrival(fields) ? calmTail(this.strings, readers) : null;
    const text = tail === null ? said : `${said} ${tail}`;
    const focus = focusOf(event, readers) ?? (event.type === 'StockpileFull' ? zoneFocus(readers, fields['id']) : undefined);
    const category = killTold ? 'combat' : spec.category;
    let severity = spec.severity;
    if (event.type === 'CreatureDied' && typeof creatureId === 'number' && !dwarfDeath) {
      severity = petDeath ? 'alert' : 'note';
    }
    // A blow that does no damage says so, rather than "0 edge".
    if (event.type === 'AttackResolved' && fields['outcome'] === 'hit' && fields['amount'] === 0) {
      return this.done(this.append(severity, this.strings.get('announce.attack_harmless', params), tick, focus, category, 'announce.attack_harmless'));
    }
    return this.appendStanding(severity, text, tick, focus, category, key);
  }

  private done(line: LogLine): Announced {
    return { line, severity: line.severity, focus: line.focus };
  }

  /**
   * 16 § Combat log: a blow between a fortress creature and a foe opens the fortress's engagement
   * line, an alert ("4 dwarves and a dog are fighting 9 gloam warriors and a gloam captain."), or
   * refreshes the open one: its text counts everyone who has fought in it, it takes the time and the
   * place of the latest blow, and it keeps its place in the log. A foe is a raider or a creature of
   * the Deep, a wild animal that attacks, or anything that strikes a fortress creature (a fortress
   * creature hunting a deer is no engagement). The engagement ends when no blow of it has come for
   * `LOG_ENGAGEMENT_TICKS`. Returns the line it opened; null when it refreshed one or the blow is
   * none of the fortress's.
   */
  engage(event: GameEvent, readers: ReaderSet, tick: number): Announced | null {
    if (event.type !== 'AttackResolved') return null;
    const fields = event as unknown as Record<string, unknown>;
    const attacker = fields['attackerId'];
    const defender = fields['defenderId'];
    if (typeof attacker !== 'number' || typeof defender !== 'number') return null;
    const prior = this.engagement;
    const open = prior !== null && tick - prior.last <= LOG_ENGAGEMENT_TICKS && this.lines.includes(prior.line) ? prior : null;
    const side = (id: number): 'ours' | 'foe' | 'other' | null => {
      if (open?.ours.some((f) => f.id === id) === true) return 'ours';
      if (open?.foes.some((f) => f.id === id) === true) return 'foe';
      const creature = readers.entities.get(id, C.Creature);
      if (creature === undefined) return null;
      if (creature.faction === 'fortress') return 'ours';
      if (creature.faction.startsWith('hostile') || creature.faction === 'deep') return 'foe';
      if (creature.faction === 'wild' && readers.entities.get(id, C.Wild)?.state === 'attack') return 'foe';
      return 'other';
    };
    const a = side(attacker);
    const d = side(defender);
    let ours: number;
    let foe: number;
    if (a === 'ours' && d === 'foe') {
      ours = attacker;
      foe = defender;
    } else if (d === 'ours' && (a === 'foe' || a === 'other')) {
      ours = defender;
      foe = attacker;
    } else {
      // A blow of the open engagement on a creature already gone (a killing blow) only keeps it open.
      const known = (s: typeof a): boolean => s === 'ours' || s === 'foe';
      if (open !== null && ((known(a) && d === null) || (known(d) && a === null))) open.last = tick;
      return null;
    }
    const focus = focusOf({ type: 'AttackResolved', defenderId: defender, attackerId: attacker } as unknown as GameEvent, readers);
    const fight: Engagement = open ?? { line: { tick, severity: 'alert', text: '', count: 1 }, ours: [], foes: [], last: tick };
    this.enlist(fight.ours, ours, readers);
    this.enlist(fight.foes, foe, readers);
    fight.last = tick;
    const said = this.engagementText(fight);
    const text = capitalize(said.text);
    if (open !== null) {
      open.line.text = text;
      open.line.key = said.key;
      open.line.tick = tick;
      if (focus !== undefined) open.line.focus = focus;
      open.line.subject = foe;
      return null;
    }
    const line = this.append('alert', text, tick, focus, 'combat', said.key);
    line.subject = foe;
    this.engagement = { line, ours: fight.ours, foes: fight.foes, last: tick };
    return this.done(line);
  }

  private enlist(side: Fighter[], id: number, readers: ReaderSet): void {
    if (side.some((f) => f.id === id)) return;
    const creature = readers.entities.get(id, C.Creature);
    if (creature === undefined) return;
    side.push({ id, species: creature.species, name: creature.name });
  }

  /** "Halvar Ironfell is fighting a wolf.", "4 dwarves and a dog are fighting 9 gloam warriors and a gloam captain." */
  private engagementText(fight: Engagement): Said {
    const ours = this.fightersText(fight.ours);
    const foes = this.fightersText(fight.foes);
    return this.say(fight.ours.length === 1 ? 'announce.engagement.one' : 'announce.engagement.many', { ours, foes });
  }

  /** A template's words and its key (T-725). */
  private say(key: string, params: Readonly<Record<string, string | number>> = {}): Said {
    return { key, text: this.strings.get(key, params) };
  }

  /** A side of an engagement by species, in the order they joined: one by its name or "a dog", more counted ("4 dwarves"). */
  private fightersText(fighters: readonly Fighter[]): string {
    const groups = new Map<number, Fighter[]>();
    for (const f of fighters) groups.set(f.species, [...groups.get(f.species) ?? [], f]);
    const table = this.registry.table<NamedRow & { plural?: string }>('creatures');
    const parts = [...groups.values()].map((group) => {
      const first = group[0] as Fighter;
      if (group.length === 1) return creatureWords(this.registry, first.name, first.species);
      return `${group.length} ${speciesPlural(table.byIndex(first.species))}`;
    });
    if (parts.length <= 1) return parts[0] ?? '';
    return this.strings.get('announce.list_and', { list: parts.slice(0, -1).join(', '), last: parts[parts.length - 1] as string });
  }

  /**
   * 07 § Registrations (T-516): a frost kills a plot's crops one `CropDied { reason: frost }` each,
   * often on one hour and sometimes over a night. The kills of one crop on one plot within the
   * dedup window (`LOG_DEDUP_TICKS`, or the same day) count up in a single line ("Frost killed 12
   * plants of strawberry on Farm plot #3."); a later frost starts a new one.
   */
  private announceFrost(fields: Record<string, unknown>, readers: ReaderSet, tick: number, spec: AnnouncementSpec): Announced {
    const tile = typeof fields['tile'] === 'number' ? fields['tile'] : undefined;
    const zoneId = tile !== undefined && readers.has('14') ? readers.of<BuildingsReader>('14').zoneAt(tile) : 0;
    const species = String(fields['species'] ?? '');
    const key = `${zoneId}:${species}`;
    const prev = this.frostLines.get(key);
    const merges = prev !== undefined && this.lines.includes(prev.line) &&
      (tick - prev.line.tick <= LOG_DEDUP_TICKS || dayIndexOf(prev.line.tick) === dayIndexOf(tick));
    const n = merges ? prev.n + 1 : 1;
    const crop = this.registry.hasTable('plants') ? this.registry.table<NamedRow>('plants').byId(species)?.name ?? species : species;
    const plot = zoneName({ readers, strings: this.strings }, zoneId) || this.strings.get('ui.zone.type.farm_plot');
    const text = this.strings.get(spec.stringKey, { n, crop, plot });
    if (merges) {
      prev.n = n;
      prev.line.text = text.charAt(0).toUpperCase() + text.slice(1);
      prev.line.tick = tick;
      return { line: prev.line, severity: prev.line.severity, focus: prev.line.focus };
    }
    const line = this.append(spec.severity, text, tick, tile, spec.category, spec.stringKey);
    this.frostLines.set(key, { line, n });
    return { line, severity: spec.severity, focus: tile };
  }

  /**
   * 18 § Player-facing behavior: a `ThiefEscaped` names what was taken ("A thief has escaped with an
   * iron short sword!"). The escapes of one party within the dedup window (`LOG_DEDUP_TICKS`, or the
   * same day) are one line that counts and lists them ("Raiders have escaped with 14 goods: iron
   * bars ×6, oak logs ×7 and an iron short sword!"); bandits and raiders are named as such.
   */
  private announceTheft(fields: Record<string, unknown>, readers: ReaderSet, tick: number, spec: AnnouncementSpec): Announced {
    const partyId = typeof fields['partyId'] === 'number' ? fields['partyId'] : 0;
    const stolen = stolenOf(this.registry, fields);
    const prev = partyId === 0 ? undefined : this.theftLines.get(partyId);
    const merges = prev !== undefined && stolen !== null && this.lines.includes(prev.line) &&
      (tick - prev.line.tick <= LOG_DEDUP_TICKS || dayIndexOf(prev.line.tick) === dayIndexOf(tick));
    const all = merges ? [...prev.stolen, stolen] : stolen === null ? [] : [stolen];
    const goods = all.length === 0 ? this.strings.get('announce.goods_unknown') : stolenGoodsText(this.strings, all);
    const said = this.say(theftKey(readers, partyId), { goods });
    if (merges) {
      prev.stolen = all;
      prev.line.text = capitalize(said.text);
      prev.line.key = said.key;
      prev.line.tick = tick;
      return { line: prev.line, severity: prev.line.severity, focus: prev.line.focus };
    }
    // The thief has left the map with it: the line's place is where its party was last told of (`announce`).
    const line = this.append(spec.severity, said.text, tick, undefined, spec.category, said.key);
    if (partyId !== 0 && stolen !== null) this.theftLines.set(partyId, { line, stolen: all });
    return { line, severity: line.severity, focus: undefined };
  }

  /**
   * 18 § Player-facing behavior: a raid's end by its outcome with the party's counts ("The Gloam
   * raid is over: 6 raiders fled with 14 goods, 3 fell."), an alert when it escaped with loot. When
   * no other raid is left and the alert is still up, an alert says it can come down ("The raid is
   * gone: [m] [1] lowers the alert.").
   */
  private announceRaidEnded(fields: Record<string, unknown>, readers: ReaderSet, tick: number, spec: AnnouncementSpec): Announced | null {
    const partyId = Number(fields['partyId']);
    const outcome = String(fields['outcome'] ?? '');
    const severity: Severity = outcome === 'looted' ? 'alert' : spec.severity;
    const said = raidEndedText(this.strings, this.registry, readers, partyId, outcome);
    const purpose = readers.has('18') ? readers.of<{ party(id: number): { purpose: string } | undefined }>('18').party(partyId)?.purpose : undefined;
    // A thief that got away with something was told by its theft line.
    const told = said ?? this.say(spec.stringKey);
    const line = said === null && purpose === 'thief' ? null : this.append(severity, told.text, tick, undefined, spec.category, told.key);
    const gone = raidGone(readers, partyId) ? this.append('alert', this.strings.get('announce.raid_gone'), tick, undefined, undefined, 'announce.raid_gone') : null;
    const shown = gone ?? line;
    return shown === null ? null : { line: shown, severity: shown.severity, focus: undefined };
  }

  /**
   * 10 § Needs: one `Starving` comes for each starving dwarf each day. A day's are one line, which
   * names each dwarf once as it comes: "Asa Forgehall is starving.", then "3 dwarves are starving:
   * Asa, Njal, Liv." (first names). Its focus is the first dwarf's tile; a new day starts a new line.
   */
  private announceStarving(event: GameEvent, readers: ReaderSet, tick: number, spec: AnnouncementSpec): Announced {
    const id = Number((event as unknown as Record<string, unknown>)['id']);
    const name = String(this.params(event, readers)['dwarf'] ?? '');
    const open = this.starving;
    if (open !== null && this.lines.includes(open.line) && dayIndexOf(open.line.tick) === dayIndexOf(tick)) {
      if (!open.ids.includes(id)) { open.ids.push(id); open.names.push(name); }
      const said = this.starvingText(open.names, spec);
      open.line.text = said.text;
      open.line.key = said.key;
      open.line.tick = tick;
      return { line: open.line, severity: open.line.severity, focus: open.line.focus };
    }
    const focus = focusOf(event, readers);
    const said = this.starvingText([name], spec);
    const line = this.append(spec.severity, said.text, tick, focus, spec.category, said.key);
    this.starving = { line, ids: [id], names: [name] };
    return { line, severity: spec.severity, focus };
  }

  /**
   * 15 § Registrations: a dwarf who falls to Miserable is told once a day, with its reasons, its three
   * strongest negative thoughts in their own words: 'Asa Forgehall is miserable: "I am hungry. Slept
   * on the floor. I have no room of my own."'. A day's are one line, as the starving line is, which
   * names each dwarf once: '3 dwarves are miserable: Asa, Njal, Liv. "I am hungry. …"', the reasons
   * weighing most over the dwarves named. A dwarf already named today makes no line. Its focus is the
   * first dwarf's tile; a new day starts a new line.
   */
  private announceMiserable(event: GameEvent, readers: ReaderSet, tick: number, spec: AnnouncementSpec): Announced | null {
    const id = Number((event as unknown as Record<string, unknown>)['id']);
    const name = String(this.params(event, readers)['dwarf'] ?? '');
    const thoughts = readers.has('15') ? readers.of<MoraleReader>('15').thoughts(id) : [];
    const reasons = thoughts.filter((t) => t.value < 0).slice(0, LOG_MISERABLE_REASONS).map((t) => ({ text: t.text, weight: -t.value }));
    const open = this.miserable;
    if (open !== null && this.lines.includes(open.line) && dayIndexOf(open.line.tick) === dayIndexOf(tick)) {
      if (open.ids.includes(id)) return null;
      open.ids.push(id);
      open.names.push(name);
      open.reasons.push(reasons);
      const said = this.miserableText(open.names, open.reasons, spec);
      open.line.text = said.text;
      open.line.key = said.key;
      open.line.tick = tick;
      return { line: open.line, severity: open.line.severity, focus: open.line.focus };
    }
    const focus = focusOf(event, readers);
    const said = this.miserableText([name], [reasons], spec);
    const line = this.append(spec.severity, said.text, tick, focus, spec.category, said.key);
    this.miserable = { line, ids: [id], names: [name], reasons: [reasons] };
    return { line, severity: spec.severity, focus };
  }

  /** The miserable line's text and its key (T-731): `announce.mood_tier[_why]` for one dwarf, `announce.mood_tier_many[_why]` for more. */
  private miserableText(names: readonly string[], reasons: readonly (readonly Reason[])[], spec: AnnouncementSpec): Said {
    // The reasons weighing most over everyone named, the first named first on a tie.
    const weights = new Map<string, number>();
    for (const list of reasons) for (const r of list) weights.set(r.text, (weights.get(r.text) ?? 0) + r.weight);
    const why = Array.from(weights).sort((a, b) => b[1] - a[1]).slice(0, LOG_MISERABLE_REASONS).map(([text]) => text).join(' ');
    if (names.length === 1) {
      const dwarf = names[0] ?? '';
      const said = why === '' ? this.say(spec.stringKey, { dwarf }) : this.say('announce.mood_tier_why', { dwarf, why });
      return { key: said.key, text: capitalize(said.text) };
    }
    const first = names.map((n) => n.split(' ')[0] ?? n).join(', ');
    return this.say(why === '' ? 'announce.mood_tier_many' : 'announce.mood_tier_many_why', { n: names.length, names: first, why });
  }

  /**
   * 17 § Player-facing behavior (T-723): a fortress animal's `NoDressing`. The day's are one line that
   * names each animal once, by its own name or as "the dog" ("the war dog"), and counts more than
   * `LOG_BLEEDING_NAMES`. Only the first is announced (its flash and pause); a later one changes the
   * line in place, its focus and subject the latest animal, and returns null.
   */
  private announceBleedingAnimal(event: GameEvent, id: number, readers: ReaderSet, tick: number, spec: AnnouncementSpec): Announced | null {
    const name = this.animalWords(id, readers);
    const focus = focusOf(event, readers);
    const open = this.bleeding;
    if (open !== null && this.lines.includes(open.line) && dayIndexOf(open.line.tick) === dayIndexOf(tick)) {
      if (!open.ids.includes(id)) { open.ids.push(id); open.names.push(name); }
      const said = this.bleedingText(open.names);
      open.line.text = said.text;
      open.line.key = said.key;
      open.line.tick = tick;
      if (focus !== undefined) open.line.focus = focus;
      const subject = subjectOf(event, readers);
      if (subject !== undefined) open.line.subject = subject;
      return null;
    }
    const said = this.bleedingText([name]);
    const line = this.append(spec.severity, said.text, tick, focus, spec.category, said.key);
    this.bleeding = { line, ids: [id], names: [name] };
    return { line, severity: spec.severity, focus };
  }

  private bleedingText(names: readonly string[]): Said {
    if (names.length > LOG_BLEEDING_NAMES) return this.say('announce.no_dressing.animals_counted', { n: names.length });
    if (names.length === 1) {
      const said = this.say('announce.no_dressing.animal', { animal: names[0] ?? '' });
      return { key: said.key, text: capitalize(said.text) };
    }
    const animals = this.strings.get('announce.list_and', { list: names.slice(0, -1).join(', '), last: names[names.length - 1] as string });
    const said = this.say('announce.no_dressing.animals', { animals });
    return { key: said.key, text: capitalize(said.text) };
  }

  /** An animal by its own name, else "the dog", "the war dog" or "the hunting dog" (as `animalStarvingKey` names one). */
  private animalWords(id: number, readers: ReaderSet): string {
    const creature = readers.entities.get(id, C.Creature);
    const row = creature === undefined ? undefined : this.registry.table<NamedRow>('creatures').byIndex(creature.species);
    if (creature !== undefined && creature.name !== '' && creature.name !== row?.name && creature.name !== row?.id) return creature.name;
    const species = (row?.name ?? 'animal').toLowerCase();
    const trained = readers.entities.get(id, C.Tame)?.trained;
    const key = trained === 'war' ? 'announce.no_dressing.the_war' : trained === 'hunting' ? 'announce.no_dressing.the_hunting' : 'ui.creature.the_species';
    return this.strings.get(key, { species });
  }

  /**
   * 15 § Registrations: a thought many dwarves gain from one event (`raid_repelled`, `hearth_lit`, an
   * argument's pair) is one line. The `ThoughtGained` events of one thought in one tick grow one line:
   * one dwarf reads 'Asa Forgehall: "We drove them off."', two are named ('Asa Forgehall and Njal
   * Coaleye: "Had an argument."'), more are counted ('13 dwarves: "We drove them off."'). The line
   * keeps its place and the first dwarf's focus; once it names more than one it has no subject. A
   * later event of the line returns null: it changes the line in place.
   */
  private announceThought(event: GameEvent, readers: ReaderSet, tick: number, spec: AnnouncementSpec): Announced | null {
    const fields = event as unknown as Record<string, unknown>;
    const id = Number(fields['id']);
    const thoughtId = String(fields['thoughtId'] ?? '');
    const params = this.params(event, readers);
    const name = String(params['dwarf'] ?? '');
    const thought = String(params['thought'] ?? '');
    const open = this.thoughtLines.get(thoughtId);
    if (open !== undefined && open.tick === tick && this.lines.includes(open.line)) {
      if (open.ids.includes(id)) return null;
      open.ids.push(id);
      open.names.push(name);
      const said = this.thoughtText(open.names, thought, spec);
      if (open.line.count > 1) {
        // The first dwarf's words had merged into an earlier identical line: that line keeps its own, less one.
        open.line.count -= 1;
        open.line = this.append(spec.severity, said.text, tick, open.line.focus, spec.category, said.key);
      } else {
        open.line.text = said.text;
        open.line.key = said.key;
      }
      delete open.line.subject;
      return null;
    }
    const focus = focusOf(event, readers);
    const said = this.thoughtText([name], thought, spec);
    const line = this.append(spec.severity, said.text, tick, focus, spec.category, said.key);
    this.thoughtLines.set(thoughtId, { line, tick, ids: [id], names: [name] });
    return { line, severity: spec.severity, focus };
  }

  /** The thought line's words and key: `announce.thought` for one dwarf, `announce.thought_pair` for two, `announce.thought_many` for more. */
  private thoughtText(names: readonly string[], thought: string, spec: AnnouncementSpec): Said {
    if (names.length === 1) return this.say(spec.stringKey, { dwarf: names[0] ?? '', thought });
    if (names.length === 2) return this.say('announce.thought_pair', { dwarf: names[0] ?? '', other: names[1] ?? '', thought });
    return this.say('announce.thought_many', { n: names.length, thought });
  }

  private starvingText(names: readonly string[], spec: AnnouncementSpec): Said {
    if (names.length === 1) return { key: spec.stringKey, text: capitalize(this.strings.get(spec.stringKey, { dwarf: names[0] ?? '' })) };
    const first = names.map((n) => n.split(' ')[0] ?? n).join(', ');
    return this.say('announce.starving_many', { n: names.length, names: first });
  }

  /**
   * 13 § Rot, miasma: the line names what rots and where, from the rotting stacks on the event's
   * tiles (the largest, summed by material within its place): "Miasma spreads from 20 rotten turnip
   * in Stockpile #2 (Food)." The fortress's first such line adds where rotten food belongs; with no
   * rotting item found there, the line is the plain "Miasma spreads.".
   */
  private announceMiasma(fields: Record<string, unknown>, readers: ReaderSet, tick: number, spec: AnnouncementSpec): Announced {
    const tiles = Array.isArray(fields['tiles']) ? fields['tiles'] as TileIndex[] : [];
    const source = readers.has('13') ? this.miasmaSource(readers, tiles) : null;
    let key = spec.stringKey;
    let text = this.strings.get(key);
    let focus = tiles[0];
    if (source !== null) {
      key = 'announce.miasma_from';
      text = this.strings.get(key, { what: source.what, place: source.place });
      focus = source.tile;
      if (this.history.miasmaAdvised !== true) {
        this.history.miasmaAdvised = true;
        text = `${text} ${this.strings.get('announce.miasma_advice')}`;
      }
    }
    return this.appendStanding(spec.severity, text, tick, focus, spec.category, key);
  }

  /** The largest group of rotting units on the tiles, by place and by material (or corpse species), with its first tile. */
  private miasmaSource(readers: ReaderSet, tiles: readonly TileIndex[]): { what: string; place: string; tile: TileIndex } | null {
    const items = readers.of<ItemsReader>('13');
    const env = { readers, registry: this.registry, strings: this.strings };
    const groups = new Map<string, { place: string; tile: TileIndex; n: number; material: string; species: string | null }>();
    const seen = new Set<number>();
    for (const tile of tiles) {
      for (const id of items.at(tile)) {
        if (seen.has(id)) continue;
        seen.add(id);
        const it = items.get(id);
        if (it === undefined || it.rotStage !== 2 || it.containerId !== 0) continue;
        const corpse = readers.entities.get(id, C.Corpse);
        const species = corpse === undefined ? null : this.registry.table<NamedRow>('creatures').byIndex(corpse.species)?.name ?? '';
        const material = this.registry.table<NamedRow>('materials').byIndex(it.material)?.name ?? '';
        const place = itemPlace(env, tile);
        const key = `${place}|${species === null ? `m:${material}` : `c:${species}`}`;
        const g = groups.get(key) ?? { place, tile, n: 0, material, species };
        g.n += it.count;
        groups.set(key, g);
      }
    }
    let best: { place: string; tile: TileIndex; n: number; material: string; species: string | null } | null = null;
    for (const g of groups.values()) if (best === null || g.n > best.n) best = g;
    if (best === null) return null;
    const what = best.species === null
      ? this.strings.get('announce.miasma_rotten', { n: best.n, material: best.material })
      : this.strings.get(best.n === 1 ? 'announce.miasma_corpse' : 'announce.miasma_corpses', { n: best.n, species: best.species });
    return { what, place: best.place, tile: best.tile };
  }

  /**
   * 13 § Rot, the alert before food rots: the caller asks once a day, on `DayPassed`. When the edible
   * units that will rot within `ROT_ALERT_DAYS` at the speed they rot now would feed the fortress
   * for a day (a unit for each `HINT_FOOD_DAYS_PER_ITEM` dwarves), an alert names the units, the
   * largest such stack and its place, and focuses that stack's tile. Merchants' goods are not the
   * fortress's. Returns what it appended, or null when no alert is due.
   */
  rotAlert(readers: ReaderSet, tick: number): Announced | null {
    if (!readers.has('13') || !readers.has('10')) return null;
    const items = readers.of<ItemsReader>('13');
    const population = readers.of<{ population(): number }>('10').population();
    if (population <= 0) return null;
    const within = ROT_ALERT_DAYS * TICKS_PER_DAY;
    let n = 0;
    let largest: { id: number; count: number } | null = null;
    for (const id of readers.entities.with(C.Item)) {
      const it = items.get(id);
      if (it === undefined || it.rotStage >= 2 || (it.flags & ItemFlag.Merchant) !== 0 || items.def(it.type)?.edible !== true) continue;
      const outlook = items.rotOutlook(id);
      if (outlook === null || outlook.toRot === null || outlook.toRot > within) continue;
      n += it.count;
      if (largest === null || it.count > largest.count) largest = { id, count: it.count };
    }
    if (largest === null || n * HINT_FOOD_DAYS_PER_ITEM < population) return null;
    const tile = items.tileOf(largest.id);
    const env = { readers, registry: this.registry, strings: this.strings };
    const text = this.strings.get('announce.rot_soon', { n, days: ROT_ALERT_DAYS, stack: stackName(env, largest.id), place: itemPlace(env, tile) });
    const focus = tile >= 0 ? tile : undefined;
    const done = this.appendStanding('alert', text, tick, focus, undefined, 'announce.rot_soon');
    done.line.subject = largest.id;
    return done;
  }

  /**
   * 24 § Announcements and the log (T-741): a standing alert (`LOG_STANDING_ALERTS`) that comes again
   * on the day after its line of one key and one condition last came folds into that line: the line
   * takes the newest words, time and place, counts one more day in a row, and moves to the newest
   * place in the log; its subject is cleared for the caller to set anew. A day without it ends the
   * run, so a later one starts a line of its own. Anything else, and a standing alert with no line
   * of the day before, is appended as {@link append} does.
   */
  private appendStanding(severity: Severity, text: string, tick: number, focus: TileIndex | undefined, category: string | undefined, key: string): Announced {
    const folded = severity === 'alert' && category !== 'combat' ? this.fold(text, tick, focus, key) : null;
    if (folded !== null) return { line: folded, severity, focus: folded.focus, folded: true };
    const line = this.append(severity, text, tick, focus, category, key);
    return { line, severity, focus };
  }

  private fold(text: string, tick: number, focus: TileIndex | undefined, key: string): LogLine | null {
    if (LOG_STANDING_ALERTS[key] === undefined) return null;
    const words = text.length > 0 ? text.charAt(0).toUpperCase() + text.slice(1) : text;
    const which = this.condition(key, words);
    const day = dayIndexOf(tick);
    for (let k = this.lines.length - 1; k >= 0; k -= 1) {
      const prev = this.lines[k] as LogLine;
      if (prev.key !== key || prev.severity !== 'alert' || prev.category === 'combat' || this.condition(key, prev.text) !== which) continue;
      // The newest line of this condition: it folds only when it came the day before.
      if (dayIndexOf(prev.tick) !== day - 1) return null;
      prev.text = words;
      prev.tick = tick;
      prev.count = 1;
      prev.days = (prev.days ?? 1) + 1;
      if (focus === undefined) delete prev.focus;
      else prev.focus = focus;
      delete prev.subject;
      this.lines.splice(k, 1);
      this.lines.push(prev);
      return prev;
    }
    return null;
  }

  /** The condition a standing alert's line tells of: its key's naming placeholders as its text fills them ('' for the fortress's own). */
  private condition(key: string, text: string): string {
    const fields = LOG_STANDING_ALERTS[key] ?? [];
    if (fields.length === 0) return '';
    const read = this.templateOf(key).exec(text);
    // A text its template does not read (an older template's words) is a condition of its own.
    if (read === null) return text;
    return fields.map((field) => read.groups?.[field] ?? '').join('|');
  }

  /** A key's template as a pattern that reads its placeholders back from the start of a line (case aside: the log capitalizes the first letter). */
  private templateOf(key: string): RegExp {
    let re = this.templates.get(key);
    if (re === undefined) {
      const template = this.strings.get(key);
      const seen = new Set<string>();
      let source = '';
      let at = 0;
      for (const match of template.matchAll(/\{(\w+)(?:\|[^|}]+\|[^|}]+)?\}/g)) {
        const name = match[1] as string;
        source += escapeRegExp(template.slice(at, match.index));
        source += seen.has(name) ? '.+?' : `(?<${name}>.+?)`;
        seen.add(name);
        at = match.index + match[0].length;
      }
      source += escapeRegExp(template.slice(at));
      re = new RegExp(`^${source}`, 'si');
      this.templates.set(key, re);
    }
    return re;
  }

  /**
   * `ui.announce(severity, text, focus?, category?)`, with the dedup rule. `key` is the string key
   * the text was filled from (T-725); an identical line merged into one without a key gives it its own.
   */
  append(severity: Severity, text: string, tick: number, focus?: TileIndex, category?: string, key?: string): LogLine {
    if (text.length > 0) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }
    // An identical line merges within `LOG_DEDUP_TICKS`, and within the same day however many lines came between.
    const day = dayIndexOf(tick);
    for (let k = this.lines.length - 1; k >= 0; k -= 1) {
      const prev = this.lines[k] as LogLine;
      // A line from an earlier day outside the window is no candidate, but a later one may still be: scan on.
      if (tick - prev.tick > LOG_DEDUP_TICKS && dayIndexOf(prev.tick) !== day) continue;
      if (prev.text === text && prev.severity === severity && prev.category === category) {
        prev.count += 1;
        prev.tick = tick;
        if (prev.key === undefined && key !== undefined) prev.key = key;
        return prev;
      }
    }
    const line: LogLine = {
      tick,
      severity,
      text,
      count: 1,
      ...(focus === undefined ? {} : { focus }),
      ...(category === undefined ? {} : { category }),
      ...(key === undefined ? {} : { key }),
    };
    this.lines.push(line);
    if (this.lines.length > LOG_MAX_LINES) this.lines.splice(0, this.lines.length - LOG_MAX_LINES);
    return line;
  }

  /** T-684: the lines whose subject is a stack that merged (13's `ItemMerged`, `id` → `into`) name the stack it joined, through every merge of the batch. */
  followMerges(merges: ReadonlyMap<EntityId, EntityId>): void {
    for (const line of this.lines) {
      let id = line.subject;
      for (let hops = 0; id !== undefined && hops < 64 && merges.has(id); hops += 1) id = merges.get(id);
      if (id !== undefined && id !== line.subject) line.subject = id;
    }
  }

  /** The last `n` lines, oldest first (the strip shows the newest at the bottom). */
  tail(n: number): LogLine[] {
    return this.lines.slice(Math.max(0, this.lines.length - n));
  }

  /** "The `once` rows already announced", for a load to restore. */
  markSeen(type: string): void {
    this.seen.add(type);
  }
}

/**
 * 17 § Registrations: the string key of a death's line by its cause (`announce.died.<cause>`); a
 * blow names its killer when one is known. Null for a cause with no line of its own.
 */
export function deathLineKey(strings: Strings, cause: unknown, killer: unknown): string | null {
  if (typeof cause !== 'string') return null;
  if (cause === 'killed') return typeof killer === 'string' && killer !== '' ? 'announce.died.killed_by' : 'announce.died.killed';
  const key = `announce.died.${cause}`;
  return strings.has(key) ? key : null;
}

/** A creature as a line names it: its own name, else its species with an article ("a deer"). */
export function creatureWords(registry: Registry, name: string | undefined, speciesIndex: number | undefined): string {
  const table = registry.table<NamedRow>('creatures');
  const speciesRow = typeof speciesIndex === 'number' ? table.byIndex(speciesIndex) : undefined;
  if (name && (!speciesRow || (name !== speciesRow.id && name !== speciesRow.name))) {
    return name;
  }
  const species = speciesRow?.name ?? speciesRow?.id ?? 'creature';
  const first = species.charAt(0).toLowerCase();
  const article = 'aeiou'.includes(first) ? 'an' : 'a';
  return `${article} ${species}`;
}

/** A death's killer as its line names it: a creature by {@link creatureWords}, a trap by its building ("a stone-fall trap"), or ''. */
export function killerWords(registry: Registry, name: string | undefined, species: number | undefined): string {
  if (species === undefined) return name === undefined || name === '' ? '' : withArticle(name.toLowerCase());
  return creatureWords(registry, name, species);
}

/** "a boar", "an ember newt": a lower-case noun with its indefinite article. */
function withArticle(noun: string): string {
  return `${'aeiou'.includes(noun.charAt(0)) ? 'an' : 'a'} ${noun}`;
}

/** A zone's first tile, for a line about the zone. */
function zoneFocus(readers: ReaderSet, id: unknown): TileIndex | undefined {
  if (typeof id !== 'number' || !readers.has('14')) return undefined;
  return readers.of<BuildingsReader>('14').zone(id)?.tiles[0];
}

function materialByIndex(table: { ids(): readonly string[]; byId(id: string): NamedRow | undefined; index(id: string): number }, index: number): NamedRow | undefined {
  for (const id of table.ids()) if (table.index(id) === index) return table.byId(id);
  return undefined;
}

/** The focus of an event: its `tile`, the first of its `tiles`, or an involved entity's position. */
export function focusOf(event: GameEvent, readers?: ReaderSet): TileIndex | undefined {
  const e = event as unknown as Record<string, unknown>;
  if (typeof e['tile'] === 'number') return e['tile'];
  const tiles = e['tiles'];
  if (Array.isArray(tiles) && typeof tiles[0] === 'number') return tiles[0];
  if (readers !== undefined) {
    const workshopId = e['workshopId'];
    if (typeof workshopId === 'number' && readers.has('14')) {
      const tile = readers.of<BuildingsReader>('14').get(workshopId)?.footprint[0];
      if (tile !== undefined) return tile;
    }
    // A caravan's line about its depot shows the depot (20 § Registrations).
    const depotId = e['depotId'];
    if (typeof depotId === 'number' && readers.has('14')) {
      const tile = readers.of<BuildingsReader>('14').get(depotId)?.footprint[0];
      if (tile !== undefined) return tile;
    }
    const partyId = e['partyId'];
    if (typeof partyId === 'number') {
      const party = readers.entities.get(partyId, C.Party);
      const member = party?.members.find((id) => readers.entities.has(id, C.Position));
      const pos = member === undefined ? undefined : readers.entities.get(member, C.Position);
      if (pos !== undefined) return readers.map.index(pos.x, pos.y, pos.z);
    }
    for (const key of PLACE_KEYS) {
      const id = e[key];
      const tile = typeof id === 'number' && id !== 0 ? entityTile(readers, id) : undefined;
      if (tile !== undefined) return tile;
    }
    const ids = e['ids'];
    if (Array.isArray(ids) && typeof ids[0] === 'number') {
      const tile = entityTile(readers, ids[0]);
      if (tile !== undefined) return tile;
    }
    // A line about a zone (a plot with no seed, a room's new tier) shows the zone (T-679).
    const zoneId = e['zoneId'];
    if (typeof zoneId === 'number') return zoneFocus(readers, zoneId);
  }
  return undefined;
}

/**
 * The ids an event may name whose place is the line's, in the order the place is taken from them: the
 * blow's, the victim's, the subject's (a creature, then an item), then whoever else it names, then the
 * building (T-679).
 */
const PLACE_KEYS = ['defenderId', 'attackerId', 'victimId', 'id', 'creatureId', 'itemId', 'dwarfId', 'animalId', 'hunterId', 'targetId',
  'killerId', 'thaneId', 'minerId', 'finderId', 'casterId', 'crafterId', 'smithId', 'coffinId', 'cageItemId', 'trapId', 'buildingId'] as const;

/** The ids an event may name that a line's `[v]` can open, the one it is about first (T-679). */
const SUBJECT_KEYS = ['id', 'creatureId', 'itemId', 'dwarfId', 'victimId', 'defenderId', 'attackerId', 'animalId', 'hunterId', 'targetId',
  'killerId', 'thaneId', 'minerId', 'finderId', 'casterId', 'crafterId', 'smithId', 'coffinId', 'cageItemId'] as const;

/** Where an entity is: a creature's tile, an item's (through its carrier or container), a building's first tile. */
function entityTile(readers: ReaderSet, id: number): TileIndex | undefined {
  const pos = readers.entities.get(id, C.Position);
  if (pos !== undefined) return readers.map.index(pos.x, pos.y, pos.z);
  if (readers.entities.has(id, C.Item) && readers.has('13')) {
    const tile = readers.of<ItemsReader>('13').tileOf(id);
    if (tile >= 0) return tile;
  }
  if (readers.has('14')) return readers.of<BuildingsReader>('14').get(id)?.footprint[0];
  return undefined;
}

/** The creature on the map or the item an event names, the one it is about first; undefined when it names none that exists (T-679). */
export function subjectOf(event: GameEvent, readers: ReaderSet): EntityId | undefined {
  const e = event as unknown as Record<string, unknown>;
  const ids: unknown[] = SUBJECT_KEYS.map((key) => e[key]);
  if (Array.isArray(e['ids'])) ids.push(e['ids'][0]);
  for (const id of ids) {
    if (typeof id !== 'number' || id === 0) continue;
    if (readers.entities.has(id, C.Creature) && readers.entities.has(id, C.Position)) return id;
    if (readers.entities.has(id, C.Item)) return id;
  }
  return undefined;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
