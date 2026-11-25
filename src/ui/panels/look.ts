/**
 * The look panel (24 § Inspection, `ui-screens/fortress-screen.md` § Inspection panel): the click
 * ladder that says what a click on the map opens, the tile list of everything the map shows on a
 * tile, and the view of one creature, which holds the creature and not a tile. "Every number the
 * simulation uses for that thing is shown, in the section registered by its owner": 03's tile,
 * 13's item, 14's building and zone, and a creature's 10, 11, 15, 16, 17 and 25 sections.
 */

import { C, ItemFlag } from '@core/components';
import { FLUID_MAX_LEVEL, TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { Rgb } from '@render/palette';
import { patternCell } from '@render/things';
import { agedMaterial, buildingName, enchantedName, filterText, itemRotText, materialItemName, wrapHang, zoneName } from '../messages';
import type { Strings } from '../strings';
import { creatureName, creatureNameOf } from '../creature-name';
import { goodsWaiting, goodsWaitText } from '../goods-wait';
import type { MoraleReader } from '@systems/morale';
import type { BuildingsReader } from '@systems/buildings';
import type { FluidsReader } from '@systems/fluids';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { MagicReader, SpellView } from '@systems/magic';
import type { PlantsReader } from '@systems/plants';
import { bodyPartNames, permanentText } from '@systems/health';
import { DREAD_MAX_TARGETS, FIREBLOOM_DELAY_TICKS, FROSTBIND_SLOW_PERCENT, MAX_SUMMONS_PER_CASTER, METAL_RUNE_PENALTY_PERCENT, VIALS_PER_DAY } from '@systems/magic/constants';
import { moodTierName, thoughtText } from './mood';
import type { Surface } from '../surface';
import { captionButtons, label, separator, wrapLabel } from '../widgets';
import { HEALTH_PART_BAR_CELLS } from '../constants';
import { barCells } from '../widgets/bar';
import { creatureActivity } from './look-activity';
import { ANIMAL_FIELDS, animalFields } from './look-animal';
import { HOSTILE_FIELDS, hostileFields } from './look-hostile';
import { attributeRows, equipmentSpans, identityLine, isDwarf, needCells, needCellWidth, personalityText, productivityText, relationsSpans, skillBar, titleText, wearingSpans } from './look-dwarf';
import { drawSpanRow, stringSpans, wrapSpans, type LinkSink, type LookTarget, type Span } from './look-links';
import { creatureGone, drawGoneView, drawLookFoot, footRows, itemGone, type LookFoot } from './look-gone';

interface TileInspection {
  readonly discovered: boolean;
  readonly kind: TileKind;
  readonly material: string;
  readonly smoothed: boolean;
  readonly engraved: boolean;
  readonly designation: { kind: number; priority: number } | null;
  readonly forbidden: boolean;
  readonly restricted: boolean;
}

interface TerrainReaderLike {
  inspect(i: TileIndex): TileInspection;
}

interface DwarvesReaderLike {
  list(): EntityId[];
  activityText(id: EntityId): string;
  skill(id: EntityId, skill: string): number;
  skillTier(id: EntityId, skill: string): string;
  isTipsy?(id: EntityId): boolean;
}

interface JobsReaderLike {
  forWorker(id: EntityId): { priority: number } | undefined;
}

function has(readers: ReaderSet, id: string): boolean {
  return readers.has(id);
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

const DESIGNATION_IDS = ['', 'dig', 'channel', 'stairs_up', 'stairs_down', 'stairs_updown', 'ramp', 'smooth', 'engrave', 'remove', 'chop', 'gather', 'harvest', 'harvest_ice', 'ignite'];

/** "Granite wall, smoothed": the one-line summary of a tile (the status bar's hover line too). */
export function tileSummary(readers: ReaderSet, strings: Strings, i: TileIndex): string {
  if (!has(readers, '03')) return strings.get(`ui.kind.${readers.map.kindAt(i)}`);
  const t = readers.of<TerrainReaderLike>('03').inspect(i);
  if (!t.discovered) return strings.get('ui.look.undiscovered');
  const kind = strings.get(`ui.kind.${t.kind}`);
  const parts = [t.kind === TileKind.Open ? capitalize(kind) : capitalize(`${t.material} ${kind}`.trim())];
  if (t.smoothed) parts.push(strings.get('ui.look.smoothed'));
  if (t.engraved) parts.push(strings.get('ui.look.engraved'));
  const cover = groundCover(readers, i, t.kind);
  if (cover !== null) parts.push(strings.get(`ui.look.${cover}`));
  return parts.join(', ');
}

/**
 * What grows on a floor (24 § Inspection): `flowers` where the map draws a flower (07's `flowerAt`,
 * the compositor's own test), `grass` on any other outdoor floor with grass, `moss` below ground
 * (the same flag, cave moss), or null.
 */
function groundCover(readers: ReaderSet, i: TileIndex, kind: TileKind): 'flowers' | 'grass' | 'moss' | null {
  if (kind !== TileKind.Floor || (readers.map.flagsAt(i) & TileFlag.Grass) === 0) return null;
  if (!readers.map.isOutdoor(i)) return 'moss';
  return has(readers, '07') && readers.of<PlantsReader>('07').flowerAt(i) ? 'flowers' : 'grass';
}

/** Whether the map shows anything on a tile: an undiscovered tile shows nothing (23 § Compositor step 1). */
function discovered(readers: ReaderSet, i: TileIndex): boolean {
  return (readers.map.flagsAt(i) & TileFlag.Discovered) !== 0;
}

/** Whether the map draws a creature: a stealthed hostile no dwarf has spotted is not drawn (23 § Compositor step 6). */
export function creatureShown(readers: ReaderSet, id: EntityId): boolean {
  if (!readers.entities.alive(id) || !readers.entities.has(id, C.Creature)) return false;
  const p = readers.entities.get(id, C.Position);
  if (p === undefined || !discovered(readers, readers.map.index(p.x, p.y, p.z))) return false;
  const hostile = readers.entities.get(id, C.Hostile);
  return !(hostile?.stealthed === true && hostile.spotted !== true);
}

/** 24 § Inspection's order of creatures on a tile: dwarves, then animals (tame or wild), then the rest. */
function creatureGroup(readers: ReaderSet, id: EntityId): number {
  if (isDwarf(readers, id)) return 0;
  return readers.entities.has(id, C.Tame) || readers.entities.has(id, C.Wild) ? 1 : 2;
}

/** The creatures the map shows on a tile, dwarves first, then animals, then the rest, each by id. */
export function creaturesAt(readers: ReaderSet, i: TileIndex): EntityId[] {
  if (!discovered(readers, i)) return [];
  return readers.entities
    .at(i)
    .filter((id) => readers.entities.has(id, C.Creature) && creatureShown(readers, id))
    .sort((a, b) => creatureGroup(readers, a) - creatureGroup(readers, b) || a - b);
}

/**
 * The loose items on a tile, ascending: those lying on it, a barrel counting as one. The goods a
 * building holds there and what lies inside a container are not loose (24 § Inspection).
 */
export function looseItemsAt(readers: ReaderSet, i: TileIndex): EntityId[] {
  if (!has(readers, '13') || !discovered(readers, i)) return [];
  const it = readers.of<ItemsReaderLike>('13');
  return readers.entities
    .at(i)
    .filter((id) => {
      const rec = it.get(id);
      return rec !== undefined && rec.containerId === 0;
    })
    .sort((a, b) => a - b);
}

export type { LookTarget } from './look-links';

/** Where a click on a tile stops (24 § Inspection, the click ladder): one thing, the tile list, or the bare tile. */
export type LookRung = LookTarget | { readonly kind: 'list' } | { readonly kind: 'tile' };

/**
 * The click ladder of 24 § Inspection: the creature the map shows there (several: the tile list),
 * else the loose item (several: the tile list), else the building, else the zone, else the bare
 * tile. An undiscovered tile is bare: it gives nothing away.
 */
export function clickRung(readers: ReaderSet, i: TileIndex): LookRung {
  const creatures = creaturesAt(readers, i);
  if (creatures.length > 1) return { kind: 'list' };
  if (creatures.length === 1) return { kind: 'creature', id: creatures[0] as EntityId };
  const items = looseItemsAt(readers, i);
  if (items.length > 1) return { kind: 'list' };
  if (items.length === 1) return { kind: 'item', id: items[0] as EntityId };
  if (!discovered(readers, i)) return { kind: 'tile' };
  const building = readers.map.buildingAt(i);
  if (building !== 0) return { kind: 'building', id: building };
  const zone = has(readers, '14') ? readers.of<BuildingsReaderLike>('14').zoneAt(i) : 0;
  if (zone !== 0) return { kind: 'zone', id: zone };
  return { kind: 'tile' };
}

/** "Ketil Ironvein, Digging", "wolf, Asleep": a creature's summary for the status bar, its activity never empty. */
export function creatureSummary(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): string {
  const name = creatureNameOf(readers, registry, id);
  const activity = creatureActivity({ readers, registry, strings }, id);
  return activity.length > 0 ? `${name}, ${activity}` : name;
}

/**
 * "water 5/7", "magma 2/7", "ice 5/7": the fluid on a discovered tile (24 § Inspection, 04's
 * `levelAt` of `FLUID_MAX_LEVEL`; frozen water keeps its level), or '' for none.
 */
export function fluidText(readers: ReaderSet, strings: Strings, i: TileIndex): string {
  if (!has(readers, '04')) return '';
  if (has(readers, '03') && !readers.of<TerrainReaderLike>('03').inspect(i).discovered) return '';
  const fluids = readers.of<FluidsReader>('04');
  const level = fluids.levelAt(i);
  if (level === 0) return '';
  const key = fluids.isFrozen(i) ? 'ui.look.fluid_ice' : fluids.typeAt(i) === 'magma' ? 'ui.look.fluid_magma' : 'ui.look.fluid_water';
  return strings.get(key, { level, max: FLUID_MAX_LEVEL });
}

/**
 * The hover line's tile summary (24 § Inspection): the first creature on the tile, or the terrain,
 * then the fluid, then what else is there: the one other thing by name, or how many.
 */
export function tileContents(readers: ReaderSet, registry: Registry, strings: Strings, i: TileIndex): string {
  const creatures = creaturesAt(readers, i);
  const items = itemsAt(readers, i);
  const first = creatures.length > 0 ? creatureSummary(readers, registry, strings, creatures[0] as EntityId) : tileSummary(readers, strings, i);
  const fluid = fluidText(readers, strings, i);
  const summary = fluid === '' ? first : `${first} · ${fluid}`;
  const others = creatures.length - (creatures.length > 0 ? 1 : 0) + items.length;
  const wait = buildingWait(readers, strings, i);
  if (others === 0) return summary + wait;
  if (others > 1) return strings.get('ui.status.here_more', { summary, n: others }) + wait;
  const thing = items.length === 1 ? itemName(readers, registry, items[0] as EntityId) : creatureNameOf(readers, registry, creatures[1] as EntityId);
  return strings.get('ui.status.here_one', { summary, thing }) + wait;
}

/** " · 12 goods wait: 8 no stockpile, 4 no room": why the goods of the building on a tile (the wagon) still wait in it (T-681), or ''. */
function buildingWait(readers: ReaderSet, strings: Strings, i: TileIndex): string {
  if (!has(readers, '14') || !discovered(readers, i)) return '';
  const b = readers.of<BuildingsReader>('14');
  const id = b.at(i);
  if (id === 0) return '';
  const text = goodsWaitText(strings, goodsWaiting(readers, id, b.get(id)?.itemId ?? 0), true);
  return text === '' ? '' : ` · ${text}`;
}

/** A patient's Care line: what happens next, and whether the player must act (17 § Patients and hospitals). */
export interface CareLine {
  readonly text: string;
  readonly urgent: boolean;
}

/** Whether a free hospital bed exists for this patient (the rule of 17's bed allocation). */
function hospitalBedFree(buildings: BuildingsReader, hospitals: readonly EntityId[], patientId: EntityId): boolean {
  const beds = new Set(buildings.byTag('sleep'));
  for (const hospital of hospitals) {
    for (const tile of buildings.zone(hospital)?.tiles ?? []) {
      const bedId = buildings.at(tile);
      if (!beds.has(bedId) || buildings.get(bedId)?.state !== 'built') continue;
      const holder = buildings.bedHolder(bedId);
      if (holder === 0 || holder === patientId) return true;
    }
  }
  return false;
}

/**
 * The first of nine facts that applies to a patient, read from 14 (hospital, beds), 11 (the labor,
 * the job board) and 13 (stock): bleeding with no bandage or cloth, no hospital, no free bed, no one
 * with Medicine on, waiting to be carried, a treatment under way, a treatment short of a supply,
 * waiting for a medic, resting.
 * Null for a creature that is not a patient.
 */
export function careLine(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): CareLine | null {
  const patient = readers.entities.get(id, C.Patient);
  if (patient === undefined) return animalCareLine(readers, strings, id);
  const say = (key: string, args: Record<string, string | number> = {}, urgent = false): CareLine => ({ text: strings.get(key, args), urgent });
  if (has(readers, '11')) {
    // Its bandaging waits for a dressing the fortress does not have: the one fact that kills by itself.
    const bandaging = readers.of<JobsReader>('11').byKey(`stop_bleeding:${id}`);
    if (bandaging?.state === 'blocked' && bandaging.blockedReason === 'missing_input') return say('ui.look.care.no_dressing', {}, true);
  }
  if (has(readers, '14')) {
    const buildings = readers.of<BuildingsReader>('14');
    const hospitals = buildings.zonesOfType('hospital');
    if (hospitals.length === 0) return say('ui.look.care.no_hospital', {}, true);
    const inHospitalBed = patient.bedId !== 0 && hospitals.includes(patient.hospitalZoneId);
    if (!inHospitalBed && !hospitalBedFree(buildings, hospitals, id)) return say('ui.look.care.no_bed', {}, true);
  }
  if (!has(readers, '11')) return say(patient.needs.length === 0 ? 'ui.look.care.resting' : 'ui.look.care.waiting');
  const jobs = readers.of<JobsReader>('11');
  if (jobs.workersWithLabor('medicine').length === 0) return say('ui.look.care.no_medicine', {}, true);
  const carry = jobs.byKey(`carry_patient:${id}`);
  if (carry !== undefined && carry.workerId === 0) return say('ui.look.care.carry');
  const treatments = patient.needs.flatMap((kind) => {
    const job = jobs.byKey(`${kind}:${id}`);
    return job === undefined ? [] : [{ kind, job }];
  });
  const active = treatments.find((t) => t.job.workerId !== 0);
  if (active !== undefined) {
    const name = readers.entities.get(active.job.workerId, C.Creature)?.name ?? '';
    return say('ui.look.care.treating', { job: strings.get(`ui.look.care.job.${active.kind}`), name });
  }
  const short = treatments.find((t) => t.job.state === 'blocked' && t.job.blockedReason === 'missing_input');
  if (short !== undefined) {
    const input = short.job.inputs.find((i) => i.count - i.delivered.length > 0) ?? short.job.inputs[0];
    if (input !== undefined) {
      const filter = input.filter as Readonly<Record<string, unknown>>;
      const item = filterText(registry, filter, 1, strings).replace(/^\d+ /, '');
      const stock = has(readers, '13') ? readers.of<ItemsReader>('13').countAvailable(filter) : 0;
      return say('ui.look.care.needs', { item, n: stock }, true);
    }
  }
  return say(patient.needs.length === 0 ? 'ui.look.care.resting' : 'ui.look.care.waiting');
}

/**
 * A tame animal's Care line while its `bandage_animal` job is open (17 § Animals), the first that
 * holds: bleeding with no bandage or cloth to bandage it (the job blocked for a missing input), no one
 * with the job's labor on, the bandaging under way and who does it, waiting to be bandaged. Null for
 * an animal with no such job, and for any other creature.
 */
function animalCareLine(readers: ReaderSet, strings: Strings, id: EntityId): CareLine | null {
  if (!has(readers, '11') || !readers.entities.has(id, C.Tame) || readers.entities.has(id, C.Attributes)) return null;
  const jobs = readers.of<JobsReader>('11');
  const job = jobs.byKey(`bandage_animal:${id}`);
  if (job === undefined || job.state === 'done' || job.state === 'cancelled') return null;
  const say = (key: string, args: Record<string, string | number> = {}, urgent = false): CareLine => ({ text: strings.get(key, args), urgent });
  if (job.state === 'blocked' && job.blockedReason === 'missing_input') return say('ui.look.care.no_dressing', {}, true);
  if (job.workerId !== 0) {
    const name = readers.entities.get(job.workerId, C.Creature)?.name ?? '';
    return say('ui.look.care.treating', { job: strings.get('ui.look.care.job.bandage_animal'), name });
  }
  const labor = job.data['labor'];
  if (typeof labor === 'string' && jobs.workersWithLabor(labor).length === 0) return say('ui.look.care.no_animal_care', {}, true);
  return say('ui.look.care.bandage_waiting');
}

/** A line broken at spaces to `width` cells, the continuation rows indented under the text after the first word. */
function hangingRows(text: string, width: number): string[] {
  const indent = ' '.repeat(text.indexOf(' ') + 1);
  const rows: string[] = [];
  let row = '';
  for (const word of text.split(' ')) {
    if (row.trim() !== '' && Array.from(row).length + 1 + Array.from(word).length > width) {
      rows.push(row);
      row = `${indent}${word}`;
    } else row = row === '' ? word : `${row} ${word}`;
  }
  if (row !== '') rows.push(row);
  return rows;
}

/**
 * How far Look's view is scrolled (24 § Inspection): `PageUp` `PageDown` move it a page and the
 * wheel three rows a notch. It starts at the top again when what the view shows changes.
 */
export class LookScroll {
  /** The rows of the view scrolled past. */
  scroll = 0;
  /** The rows the last draw showed in the scrolled part; a page is this less one. */
  visible = 10;
  /** The most the view can scroll: its rows less those shown, at the last draw. */
  max = 0;
  /** What the last draw showed (the view, its tile or creature); a change starts it at the top. */
  key = '';
  /** The things the last draw of a tile list numbered, in digit order (`1` is the first). */
  numbered: LookTarget[] = [];
  /** The links the last draw of a creature's or an item's view showed, in reading order. */
  links: LookTarget[] = [];
  /** The link `Tab` has focused among {@link links}, or -1; it starts afresh with the view. */
  focus = -1;

  /** `Tab` (`step` 1) or `Shift+Tab` (-1): the next or the previous link in view; false with none. */
  cycle(step: 1 | -1): boolean {
    const n = this.links.length;
    if (n === 0) return false;
    this.focus = this.focus < 0 ? (step > 0 ? 0 : n - 1) : (this.focus + step + n) % n;
    return true;
  }

  /** The focused link, if one is in view. */
  focused(): LookTarget | undefined {
    return this.focus < 0 ? undefined : this.links[this.focus];
  }

  /** A new set of links for a draw of the view shown under `key`: the focus is dropped when the view changed. */
  sink(key: string, open?: (target: LookTarget) => void): LinkSink {
    if (this.key !== key) this.focus = -1;
    this.links = [];
    return { links: this.links, focus: this.focus, open, seen: new Map() };
  }

  move(delta: number): void {
    this.scroll = Math.max(0, Math.min(this.max, this.scroll + delta));
  }

  page(direction: 1 | -1): void {
    this.move(direction * Math.max(1, this.visible - 1));
  }
}

/** The writer of a scrolled part of a view: rows scrolled past are skipped, rows past its foot counted. */
interface Pen {
  readonly cols: number;
  put(draw: (row: number) => void): void;
  line(text: string, fg?: Rgb): void;
  wrapped(prefix: string, text: string, fg?: Rgb): void;
  /** A line of spans, its links drawn as links; continuation rows indented by `indent` (by default under the first word's end). */
  spans(spans: readonly Span[], fg?: Rgb, indent?: number): void;
}

/**
 * Draw `body` into `region` scrolled by `view` (24 § Inspection): a dim `▲` at the right edge of the
 * first row while rows lie above, `▼` at the right edge of the last while rows lie below. A view
 * whose `key` changed starts at its top.
 */
function scrolled(s: Surface, region: Rect, view: LookScroll | undefined, key: string, body: (pen: Pen) => void, sink: LinkSink | null = null): void {
  const t = s.theme;
  const top = region.row;
  const bottom = region.row + Math.max(0, region.rows);
  let row = top;
  if (view !== undefined) {
    if (view.key !== key) {
      view.key = key;
      view.scroll = 0;
    }
    view.visible = Math.max(1, bottom - top);
    view.scroll = Math.max(0, Math.min(view.max, view.scroll));
  }
  let skip = view?.scroll ?? 0;
  let below = 0;
  const cols = region.cols - 2;
  const put = (draw: (r: number) => void): void => {
    if (skip > 0) {
      skip -= 1;
      return;
    }
    if (row >= bottom) {
      below += 1;
      return;
    }
    draw(row);
    row += 1;
  };
  const line = (text: string, fg: Rgb = t.text): void => put((r) => label(s, region.col + 1, r, text, { fg, width: cols }));
  // A long line (a channel's spell, an enchantment, the rune lines) wraps under its prefix, so its end is read.
  const wrapped = (prefix: string, text: string, fg: Rgb = t.text): void => {
    for (const part of wrapHang(text, cols - prefix.length, 2)) line(`${prefix}${part}`, fg);
  };
  const spans = (parts: readonly Span[], fg: Rgb = t.text, indent?: number): void => {
    for (const r of wrapSpans(parts, cols, indent)) put((at) => drawSpanRow(s, region.col + 1, at, cols, r, fg, sink));
  };
  body({ cols, put, line, wrapped, spans });
  if (view !== undefined) view.max = Math.max(0, view.scroll - skip + (row - top) + below - view.visible);
  const edge = region.col + region.cols - 1;
  if (view !== undefined && view.scroll > 0 && bottom > top) label(s, edge, top, '▲', { fg: t.dim, keys: false });
  if (below > 0) label(s, edge, bottom - 1, '▼', { fg: t.dim, keys: false });
}

/** One row of the tile list: a thing on the tile, with what it holds and its notes under it. */
export interface TileListRow {
  /** What the row opens; null for a thing inside an item (a barrel's drink). A building's goods open. */
  readonly target: LookTarget | null;
  /** The glyph the map draws for it, or '' for a thing inside another. */
  readonly glyph: string;
  readonly name: string;
  /** One fact at the right: the activity, the count and value, the state, the size. */
  readonly fact: string;
  /** Rows of what it holds, indented under it. */
  readonly inner: boolean;
  /** Lines under it: rot, flags, a spell, an enchantment. */
  readonly notes: readonly { readonly text: string; readonly tone: 'text' | 'dim' | 'alert' }[];
}

/** The first glyph of a table row's `glyph`, or '?'. */
function firstGlyph(glyph: string | undefined): string {
  return Array.from(glyph ?? '?')[0] ?? '?';
}

/** The glyph the map draws for a building on a tile: its pattern's cell there, or its own glyph (23 § Compositor step 4). */
function buildingGlyph(readers: ReaderSet, registry: Registry, id: EntityId, i: TileIndex): string {
  const b = readers.of<BuildingsReader>('14').get(id);
  if (b === undefined) return '?';
  const row = registry.table<{ id: string; glyph?: string; pattern?: string }>('buildings').byId(b.typeId);
  const pattern = row?.pattern === undefined ? undefined : registry.table<{ id: string; rows: readonly string[] }>('patterns').byId(row.pattern)?.rows;
  if (pattern === undefined) return firstGlyph(row?.glyph);
  const map = readers.map;
  const at = map.unpack(i);
  const cells = b.footprint.map((t) => map.unpack(t));
  return patternCell(pattern, b.orientation, at.x - Math.min(...cells.map((c) => c.x)), at.y - Math.min(...cells.map((c) => c.y)));
}

/**
 * An item's row of the tile list (13's `item` section: name and quality, count, value, flags, rot,
 * spell, enchantment). An `inner` row is indented under what holds it; it opens when `opens` (a
 * building's goods), not when an item holds it.
 */
function itemRow(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId, inner: boolean, opens = !inner): TileListRow {
  const it = readers.of<ItemsReaderLike>('13');
  const rec = it.get(id);
  const def = rec === undefined ? undefined : it.def(rec.type);
  const name = itemName(readers, registry, id).replace(/^\d+ /, '') + (def?.quality === true && rec !== undefined ? ` (${QUALITY_WORDS[rec.quality] ?? ''})` : '');
  const notes: { text: string; tone: 'text' | 'dim' | 'alert' }[] = [];
  const flags = FLAG_WORDS.filter(([flag]) => ((rec?.flags ?? 0) & flag) !== 0).map(([, word]) => word);
  if (flags.length > 0) notes.push({ text: flags.join(', '), tone: 'dim' });
  // 13 § Rot: under a perishable item, its stage and the days it has left, in the alert colour once stale.
  const rot = itemRotText({ readers, strings }, id);
  if (rot !== '') notes.push({ text: rot, tone: it.get(id) !== undefined && readers.of<ItemsReader>('13').rotStage(id) >= 1 ? 'alert' : 'dim' });
  const spell = spellLine(readers, strings, id, true);
  if (spell !== null) notes.push({ text: spell, tone: 'dim' });
  const enchant = enchantLine(readers, strings, id);
  if (enchant !== null) notes.push({ text: enchant, tone: 'dim' });
  const items = registry.table<{ id: string; glyph?: string }>('items');
  return {
    target: opens ? { kind: 'item', id } : null,
    glyph: inner ? '' : firstGlyph(rec === undefined ? undefined : items.byIndex(rec.type)?.glyph),
    name: inner ? `${rec?.count ?? 0} ${name}` : name,
    fact: strings.get('ui.look.item_fact', { n: rec?.count ?? 0, value: rec === undefined ? 0 : it.value(id) }),
    inner,
    notes,
  };
}

/**
 * The rows of a tile's list (24 § Inspection), in the click ladder's order: the creatures the map
 * shows (dwarves, animals, the rest) with their activity, the loose items with what each holds
 * indented under it, the building with the goods it holds on this tile under it (each stack opens),
 * the zone. An undiscovered tile has none.
 */
export function tileListRows(readers: ReaderSet, registry: Registry, strings: Strings, i: TileIndex): TileListRow[] {
  if (!discovered(readers, i)) return [];
  const rows: TileListRow[] = [];
  const species = registry.table<{ id: string; glyph?: string }>('creatures');
  for (const id of creaturesAt(readers, i)) {
    const c = readers.entities.get(id, C.Creature);
    rows.push({
      target: { kind: 'creature', id },
      glyph: firstGlyph(species.byIndex(c?.species ?? -1)?.glyph),
      name: creatureName(registry, c),
      fact: creatureActivity({ readers, registry, strings }, id),
      inner: false,
      notes: [],
    });
  }
  const it = has(readers, '13') ? readers.of<ItemsReaderLike>('13') : null;
  const withContents = (id: EntityId, inner: boolean): void => {
    rows.push(itemRow(readers, registry, strings, id, inner, true));
    for (const held of it?.inContainer(id) ?? []) if (it?.get(held) !== undefined) rows.push(itemRow(readers, registry, strings, held, true));
  };
  for (const id of looseItemsAt(readers, i)) withContents(id, false);
  if (has(readers, '14')) {
    const b = readers.of<BuildingsReaderLike>('14');
    const id = b.at(i);
    const bld = id === 0 ? undefined : b.get(id);
    if (bld !== undefined) {
      // The goods a building holds lie on one of its tiles (the wagon's at its centre, 02 § Arrival).
      const goods = (it?.inContainer(id) ?? []).filter((g) => it?.tileOf(g) === i && it.get(g) !== undefined).sort((x, y) => x - y);
      const mode = bld.mode === '' ? '' : ` · ${bld.mode.replace(/_/g, ' ')}`;
      const inside = goods.length === 0 ? '' : strings.get('ui.look.inside', { n: goods.length });
      rows.push({ target: { kind: 'building', id }, glyph: buildingGlyph(readers, registry, id, i), name: buildingName({ readers, registry }, id), fact: `${bld.state}${mode}${inside}`, inner: false, notes: [] });
      for (const g of goods) withContents(g, true);
    }
    const zoneId = b.zoneAt(i);
    const zone = zoneId === 0 ? undefined : b.zone(zoneId);
    if (zone !== undefined) {
      rows.push({ target: { kind: 'zone', id: zoneId }, glyph: '░', name: zoneName({ readers, strings }, zoneId), fact: strings.get('ui.look.zone_fact', { n: zone.tiles.length }), inner: false, notes: [] });
    }
  }
  return rows;
}

/** The tile's own lines under its list: the fluid, the designation and the traffic. */
function tileLines(readers: ReaderSet, strings: Strings, i: TileIndex): string[] {
  const out: string[] = [];
  const fluid = fluidText(readers, strings, i);
  if (fluid !== '') out.push(capitalize(fluid));
  if (has(readers, '03')) {
    const info = readers.of<TerrainReaderLike>('03').inspect(i);
    if (info.designation !== null) {
      const kind = strings.get(`ui.tool.designate.${DESIGNATION_IDS[info.designation.kind] ?? ''}`);
      out.push(strings.get('ui.look.designation', { kind, priority: info.designation.priority }));
    }
    if (info.forbidden) out.push(strings.get('ui.look.forbidden'));
    else if (info.restricted) out.push(strings.get('ui.look.restricted'));
  }
  return out;
}

/** The tile list's title: "Tile (58, 93, z27)". */
export function tileTitle(readers: ReaderSet, strings: Strings, i: TileIndex): string {
  const p = readers.map.unpack(i);
  return strings.get('ui.look.title_tile', { x: p.x, y: p.y, z: p.z });
}

/**
 * The tile list (24 § Inspection, `ui-screens/fortress-screen.md` § Inspection panel): the terrain
 * line, then under `Here` a row for each thing on the tile (its digit, glyph, name and one fact),
 * then under `Tile` the fluid, designation and traffic lines; the keys at the foot. The rows that
 * `opens` accepts take the digits `1`–`9` in view and a click; the list records them in
 * `view.numbered`. Returns them.
 */
export function drawTileList(
  s: Surface,
  rect: Rect,
  readers: ReaderSet,
  registry: Registry,
  strings: Strings,
  tile: TileIndex | null,
  view?: LookScroll,
  opens: (target: LookTarget) => boolean = () => false,
  open?: (target: LookTarget) => void,
): LookTarget[] {
  const t = s.theme;
  const numbered: LookTarget[] = [];
  if (view !== undefined) view.numbered = numbered;
  if (tile === null || rect.rows <= 0) return numbered;
  const width = rect.cols - 2;
  label(s, rect.col + 1, rect.row, tileSummary(readers, strings, tile), { width });
  const rows = tileListRows(readers, registry, strings, tile);
  const lines = tileLines(readers, strings, tile);
  const openable = rows.some((r) => r.target !== null && opens(r.target));
  const foot = openable && rect.rows >= 6 ? 2 : 0;
  if (foot > 0) {
    const footRow = rect.row + rect.rows - 2;
    separator(s, rect.col + 1, footRow, width);
    // `[Enter]` is a button for the first row; the rows take their own clicks.
    const first = rows.find((r) => r.target !== null && opens(r.target))?.target ?? null;
    captionButtons(s, rect.col + 1, footRow + 1, strings.get('ui.look.list_keys'), [null, null, first === null || open === undefined ? null : () => open(first)], { width });
  }
  const region = { col: rect.col, row: rect.row + 1, cols: rect.cols, rows: rect.rows - 1 - foot };
  scrolled(s, region, view, `tile:${tile}:${rows.map((r) => `${r.target?.kind ?? ''}${r.target?.id ?? ''}`).join(',')}`, (pen) => {
    if (rows.length > 0) pen.put((r) => separator(s, rect.col + 1, r, width, strings.get('ui.look.here')));
    for (const row of rows) {
      pen.put((r) => {
        const target = row.target;
        const can = target !== null && opens(target);
        const digit = can && numbered.length < 9 ? String(numbered.length + 1) : '';
        if (digit !== '') numbered.push(target as LookTarget);
        const lead = row.inner ? `${digit.padEnd(1)}     ` : `${digit.padEnd(1)} ${row.glyph} `;
        const fact = row.inner ? '' : row.fact;
        const factCols = Array.from(fact).length;
        const nameCols = Math.max(1, width - Array.from(lead).length - (factCols > 0 ? factCols + 1 : 0));
        label(s, rect.col + 1, r, digit, { fg: t.key, keys: false });
        label(s, rect.col + 3, r, row.inner ? '' : row.glyph, { keys: false });
        label(s, rect.col + 1 + Array.from(lead).length, r, row.name, { fg: row.inner && !can ? t.dim : t.text, width: nameCols, keys: false });
        if (factCols > 0) label(s, rect.col + 1 + width - factCols, r, fact, { fg: t.dim, keys: false });
        if (can && open !== undefined) s.hit({ col: rect.col + 1, row: r, cols: width, rows: 1 }, () => open(target as LookTarget));
      });
      const indent = row.inner ? '      ' : '    ';
      for (const note of row.notes) pen.wrapped(indent, note.text, note.tone === 'alert' ? t.alert : note.tone === 'dim' ? t.dim : t.text);
    }
    if (rows.length > 0 && lines.length > 0) pen.put((r) => separator(s, rect.col + 1, r, width, strings.get('ui.look.tile_section')));
    for (const text of lines) pen.line(text, rows.length > 0 ? t.dim : t.text);
  });
  return numbered;
}

/** "At (59, 87, z27) · 2 more here · 1 level down": where a creature is now, read each frame. */
export function atLine(readers: ReaderSet, strings: Strings, id: EntityId, viewZ: number): string {
  const p = readers.entities.get(id, C.Position);
  if (p === undefined) return '';
  const tile = readers.map.index(p.x, p.y, p.z);
  return placeLine(readers, strings, tile, creaturesAt(readers, tile).length - 1, viewZ);
}

/** "At (59, 87, z27) · 2 more here · 1 level down": a tile, the others there, and the level it is on against the one shown. */
function placeLine(readers: ReaderSet, strings: Strings, tile: TileIndex, others: number, viewZ: number): string {
  const p = readers.map.unpack(tile);
  let text = strings.get('ui.look.at', { x: p.x, y: p.y, z: p.z });
  if (others > 0) text += strings.get('ui.look.at_more', { n: others });
  const dz = viewZ - p.z;
  if (dz !== 0) text += strings.get(dz > 0 ? (dz === 1 ? 'ui.look.at_down_one' : 'ui.look.at_down') : dz === -1 ? 'ui.look.at_up_one' : 'ui.look.at_up', { n: Math.abs(dz) });
  return text;
}

/**
 * A creature's view (24 § Inspection): it holds the creature, never a tile. Pinned on top the
 * identity line, the activity and the `At` line, read fresh each frame; under them the sections of
 * `ui-screens/fortress-screen.md` § Inspection panel, which scroll; the keys at the foot. A
 * creature the map no longer shows says so with the place it was last seen (`last`). `picker`
 * draws a choice the view's own key opened (a tame grazer's pasture) in the sections' place.
 */
export function drawCreatureView(
  s: Surface,
  rect: Rect,
  readers: ReaderSet,
  registry: Registry,
  strings: Strings,
  id: EntityId,
  viewZ: number,
  view?: LookScroll,
  last: TileIndex | null = null,
  open?: (target: LookTarget) => void,
  foot?: LookFoot,
  picker?: (region: Rect) => void,
): void {
  const t = s.theme;
  const sink = view?.sink(`creature:${id}`, open) ?? { links: [], focus: -1, open, seen: new Map() };
  if (rect.rows <= 0) return;
  const width = rect.cols - 2;
  let row = rect.row;
  const bottom = rect.row + rect.rows;
  const pinned = (text: string, fg: Rgb = t.text): void => {
    if (row >= bottom) return;
    label(s, rect.col + 1, row, text, { fg, width });
    row += 1;
  };
  const gone = creatureGone(readers, id, creatureShown(readers, id), undefined);
  if (gone !== null) {
    drawGoneView(s, rect, readers, registry, strings, gone, { name: creatureNameOf(readers, registry, id), sub: '', holder: 0, last }, sink, foot);
    if (view !== undefined) view.key = `gone:${id}`;
    return;
  }
  const dwarf = isDwarf(readers, id);
  // 10 § Registrations, `creature › dwarf`: the identity line, then the activity.
  if (dwarf) pinned(identityLine(readers, registry, strings, id));
  if (has(readers, '10')) {
    const dwarves = readers.of<DwarvesReaderLike>('10');
    // 10 § Tipsy: the inspector says "Tipsy" beside the activity.
    const words = creatureActivity({ readers, registry, strings }, id);
    const activity = dwarves.isTipsy?.(id) === true ? strings.get('ui.units.tipsy', { activity: words }) : words;
    const job = has(readers, '11') ? readers.of<JobsReaderLike>('11').forWorker(id) : undefined;
    // The activity is a fact: too long for its row, it wraps under itself.
    const line = job === undefined ? strings.get('ui.look.activity', { activity }) : strings.get('ui.look.activity_priority', { activity, priority: job.priority });
    if (row < bottom) row += wrapLabel(s, rect.col + 1, row, line, { width, indent: 2, maxRows: Math.max(1, bottom - row) });
  }
  pinned(atLine(readers, strings, id, viewZ), t.value);
  if (row < bottom) {
    separator(s, rect.col + 1, row, width);
    row += 1;
  }
  const feet = footRows(bottom - row, foot?.action === undefined ? 0 : 1);
  if (feet > 0) drawLookFoot(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, strings, foot, false);
  const region = { col: rect.col, row, cols: rect.cols, rows: bottom - feet - row };
  // A choice the view's own key opened (a tame grazer's pasture picker) takes the sections' place while it is open.
  if (picker !== undefined) picker(region);
  else scrolled(s, region, view, `creature:${id}`, (pen) => creatureSections(s, rect, pen, readers, registry, strings, id, dwarf), sink);
}

/** The sections of a creature under its pinned lines, in the wireframe's order. */
function creatureSections(s: Surface, rect: Rect, pen: Pen, readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId, dwarf: boolean): void {
  const t = s.theme;
  const { line, wrapped, put } = pen;
  // 08's `creature › animal` (species, state, owner, pasture, condition, training) and 18's
  // `creature › hostile` (party, role, state): a dim label and a value a row, the values in one column.
  const labels = [...ANIMAL_FIELDS.map((f) => `ui.look.animal.field.${f}`), ...HOSTILE_FIELDS.map((f) => `ui.look.hostile.field.${f}`)];
  const pad = Math.max(...labels.map((key) => Array.from(strings.get(key)).length)) + 2;
  const fields = animalFields({ readers, registry, strings }, id);
  for (const f of fields) {
    const head = strings.get(`ui.look.animal.field.${f.name}`).padEnd(pad);
    pen.spans([{ text: head, fg: t.dim }, ...f.value], f.tone === 'bad' ? t.bad : f.tone === 'alert' ? t.alert : t.text, pad);
  }
  if (fields.length === 0) {
    for (const f of hostileFields({ readers, registry, strings, shown: (other) => creatureShown(readers, other) }, id)) {
      pen.spans([{ text: strings.get(`ui.look.hostile.field.${f.name}`).padEnd(pad), fg: t.dim }, ...f.value], t.text, pad);
    }
  }
  const skills = registry.table<{ id: string; name: string }>('skills');
  if (has(readers, '10')) {
    const dwarves = readers.of<DwarvesReaderLike>('10');
    if (dwarf) {
      // Two needs to a row where the panel is wide enough, each in the colour of how pressing it is.
      line(strings.get('ui.look.dwarf.needs'), t.key);
      const cellWidth = needCellWidth(strings);
      const perRow = rect.cols - 2 >= 2 * cellWidth + 1 ? 2 : 1;
      const cells = needCells(readers, strings, id);
      for (let k = 0; k < cells.length; k += perRow) {
        put((r) => cells.slice(k, k + perRow).forEach((cell, n) => {
          label(s, rect.col + 1 + n * (cellWidth + 1), r, cell.text, { fg: cell.level === 2 ? t.bad : cell.level === 1 ? t.alert : t.text, width: cellWidth, keys: false });
        }));
      }
    }
    const known = skills
      .ids()
      .map((sid) => ({ sid, level: dwarves.skill(id, sid) }))
      .filter((k) => k.level > 0);
    if (known.length > 0) {
      line(strings.get('ui.look.skills'), t.key);
      for (const k of known) {
        line(`  ${skills.byId(k.sid)?.name ?? k.sid} ${k.level} (${dwarves.skillTier(id, k.sid)}) ${skillBar(readers, registry, id, k.sid)}`);
      }
    }
    if (dwarf) {
      // After the skills: the attributes, the three traits and the productivity.
      for (const text of attributeRows(readers, strings, id, rect.cols - 2)) line(text);
      const traits = personalityText(readers, registry, strings, id);
      if (traits !== null) for (const text of hangingRows(traits, rect.cols - 2)) line(text);
      line(productivityText(readers, strings, id));
    }
    // 15 gives moods to dwarves: a fortress animal has no mood line.
    if (dwarf && has(readers, '15')) {
      const morale = readers.of<MoraleReader>('15');
      line(strings.get('ui.look.mood', { tier: moodTierName(strings, morale.tier(id)), value: Math.round(morale.mood(id)) }), t.value);
      // Only a thought that moves the mood by a whole point or more: one that rounds to 0 is not listed.
      for (const thought of morale.thoughts(id)) if (Math.round(thought.value) !== 0) wrapped('  ', thoughtText(thought));
    }
  }
  // 08 § Wild behavior, `sleep` (T-540): a wild animal that sleeps through noise.
  if (readers.entities.get(id, C.Wild)?.heavySleeper === true) line(strings.get('ui.look.heavy_sleeper'), t.dim);
  const rune = runeLine(readers, registry, strings, id);
  if (rune !== null) wrapped('', rune, t.value);
  const channel = channelLine(readers, registry, strings, id);
  if (channel !== null) wrapped('', channel, t.value);
  const vials = vialsLine(readers, strings, id);
  if (vials !== null) wrapped('', vials, t.dim);
  const effects = effectsLine(readers, strings, id);
  if (effects !== null) wrapped('', effects, t.dim);
  const rest = draughtRestLine(readers, strings, id);
  if (rest !== null) wrapped('', rest, t.dim);
  const summons = summonsLine(readers, registry, strings, id);
  if (summons !== null) wrapped('', summons, t.dim);
  if (has(readers, '17') && readers.entities.has(id, C.Body)) {
    const body = readers.entities.get(id, C.Body);
    if (body !== undefined) {
      const isPatient = readers.entities.has(id, C.Patient);
      const care = careLine(readers, registry, strings, id);
      const careRows = (): void => {
        if (care !== null) for (const text of hangingRows(care.text, rect.cols - 2)) line(text, care.urgent ? t.alert : t.text);
      };
      if (isPatient && !body.diagnosed) {
        const bleeding = body.parts.some((p) => p.wounds.some((w) => w.bleed > 0 && !w.bandaged));
        line(strings.get(bleeding ? 'ui.look.health.wounded_bleeding' : 'ui.look.health.wounded'), t.bad);
        careRows();
      } else {
        const bloodPct = body.maxBlood > 0 ? Math.floor((body.blood * 100) / body.maxBlood) : 100;
        line(strings.get('ui.look.health.blood', { blood: bloodPct, pain: body.pain }));
        careRows();
        line(`  ${strings.get(body.conscious ? 'ui.look.health.conscious' : 'ui.look.health.unconscious')}`, body.conscious ? t.text : t.bad);
        // Each part by its body plan's name ("left foreleg", "left wing"); a slot the plan has no part for is not listed.
        const partNames = bodyPartNames(readers.entities, registry, id);
        if (body.permanent.length > 0) line(`  ${strings.get('ui.look.health.permanent', { list: body.permanent.map((mark) => permanentText(mark, partNames)).join(', ') })}`, t.dim);
        for (let pIdx = 0; pIdx < body.parts.length; pIdx += 1) {
          const part = body.parts[pIdx];
          if (!part) continue;
          const pName = partNames[pIdx];
          if (pName === null || pName === undefined) continue;
          if (part.destroyed) {
            line(`  ${strings.get('ui.look.health.destroyed', { part: pName })}`, t.bad);
            continue;
          }
          const filled = barCells(part.hp, part.maxHp, HEALTH_PART_BAR_CELLS);
          // Wasting takes fractions of a hit point; the panel writes whole ones, as it writes the mood.
          const bar = `${'▓'.repeat(filled)}${'░'.repeat(HEALTH_PART_BAR_CELLS - filled)}`;
          line(`  ${strings.get('ui.look.health.part', { part: pName, bar, hp: Math.round(part.hp), max: Math.round(part.maxHp) })}`);
          for (const w of part.wounds) {
            // A wound that bleeds unbandaged says so first, in the alert colour; a long line wraps, never cut.
            const bleeding = w.bleed > 0 && !w.bandaged;
            const flags = [...(bleeding ? ['bleeding'] : []), ...WOUND_FLAGS.filter((flag) => w[flag])].map((flag) => strings.get(`ui.look.wound.${flag}`));
            const flagStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';
            wrapped('    ', `${w.severity} ${w.type}${flagStr}`, bleeding ? t.alert : t.text);
          }
        }
      }
    }
  }
  // What the creature holds and wears, then a dwarf's relations and titles (fortress-screen.md § Inspection panel).
  // Names are links (24 § Inspection): an item held or worn opens its view, a friend or a grudge that dwarf's.
  const equipment = equipmentSpans(readers, registry, strings, id, dwarf);
  if (equipment !== null) pen.spans(equipment);
  const wearing = dwarf ? wearingSpans(readers, registry, strings, id) : null;
  if (wearing !== null) pen.spans(wearing);
  if (dwarf) {
    pen.spans(relationsSpans(readers, strings, id));
    const title = titleText(readers, strings, id);
    if (title !== null) line(title);
  }
}

/** An item's view is titled by its name without its count: "pine bed", "bellwine". */
export function itemTitle(readers: ReaderSet, registry: Registry, id: EntityId): string {
  return has(readers, '13') ? itemName(readers, registry, id).replace(/^\d+ /, '') : '';
}

/** The creature or item that holds an item at the last: its carrier's carrier, its container's; the item itself when it lies loose. */
function outerHolder(readers: ReaderSet, id: EntityId): EntityId {
  const it = readers.of<ItemsReader>('13');
  let holder = id;
  for (let depth = 0; depth < 8; depth += 1) {
    const rec = it.get(holder);
    if (rec === undefined) break;
    const next = rec.containerId !== 0 ? rec.containerId : rec.carriedBy;
    if (next === 0) break;
    holder = next;
  }
  return holder;
}

/**
 * Whether the map shows where an item is (24 § Inspection): it still exists, its tile is
 * discovered, and a creature that holds it is one the map draws (a stealthed hostile's loot is not).
 */
export function itemShown(readers: ReaderSet, id: EntityId): boolean {
  if (!has(readers, '13') || !readers.entities.alive(id)) return false;
  const it = readers.of<ItemsReader>('13');
  if (it.get(id) === undefined) return false;
  const tile = it.tileOf(id);
  if (tile >= 0 && !discovered(readers, tile)) return false;
  const holder = outerHolder(readers, id);
  return holder === id || !readers.entities.has(holder, C.Creature) || creatureShown(readers, holder);
}

/** A creature by its own name, or its species's; a link to its view when the map shows it. */
function creatureLink(readers: ReaderSet, registry: Registry, id: EntityId): Span[] {
  return [{ text: creatureNameOf(readers, registry, id), target: creatureShown(readers, id) ? { kind: 'creature', id } : undefined }];
}

/** An item by its name (with its count when more than one), a link to its view. */
function itemLink(readers: ReaderSet, registry: Registry, id: EntityId): Span[] {
  const count = readers.of<ItemsReader>('13').get(id)?.count ?? 1;
  return [{ text: count > 1 ? itemName(readers, registry, id) : itemTitle(readers, registry, id), target: { kind: 'item', id } }];
}

/**
 * What a container holds, its stacks grouped by kind and material as named ("20 dimcap ale, 3 plump
 * helmet"), in the order each first appears; each group a link to its first stack.
 */
function heldGroups(readers: ReaderSet, registry: Registry, held: readonly EntityId[]): Span[] {
  const it = readers.of<ItemsReader>('13');
  const groups = new Map<string, { first: EntityId; count: number }>();
  for (const inner of held) {
    const key = itemTitle(readers, registry, inner);
    const group = groups.get(key);
    const count = it.get(inner)?.count ?? 1;
    if (group === undefined) groups.set(key, { first: inner, count });
    else group.count += count;
  }
  const out: Span[] = [];
  for (const [name, group] of groups) {
    if (out.length > 0) out.push({ text: ', ' });
    out.push({ text: group.count > 1 ? `${group.count} ${name}` : name, target: { kind: 'item', id: group.first } });
  }
  return out;
}

/** Whether a creature wears an item: in an armor or a clothing slot of its equipment. */
function worn(readers: ReaderSet, creature: EntityId, item: EntityId): boolean {
  const equip = readers.entities.get(creature, C.Equipment);
  if (equip === undefined) return false;
  return Object.values(equip.armor).includes(item) || Object.values(equip.clothing ?? {}).includes(item);
}

/**
 * The item view's second line, how the item is held (24 § Inspection): "Lying in Stockpile #2",
 * "Lying on the ground", "Carried by Roald Deephelm", "Worn by …", "In oak barrel, Stockpile #1",
 * "In Wagon #1", "Installed", with the stockpile, the carrier and the container as links.
 */
export function heldSpans(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): Span[] {
  const it = readers.of<ItemsReader>('13');
  const rec = it.get(id);
  if (rec === undefined) return [];
  const tile = it.tileOf(id);
  const zoneId = tile >= 0 && has(readers, '14') ? readers.of<BuildingsReaderLike>('14').zoneAt(tile) : 0;
  const zone: Span[] = zoneId === 0 ? [] : [{ text: zoneName({ readers, strings }, zoneId), target: { kind: 'zone', id: zoneId } }];
  if (rec.carriedBy !== 0) {
    const carrier = rec.carriedBy;
    if (!readers.entities.has(carrier, C.Creature)) return stringSpans(strings, 'ui.look.item.carried', { who: itemLink(readers, registry, carrier) });
    return stringSpans(strings, worn(readers, carrier, id) ? 'ui.look.item.worn' : 'ui.look.item.carried', { who: creatureLink(readers, registry, carrier) });
  }
  if (rec.containerId !== 0) {
    const holder = rec.containerId;
    if (it.get(holder) === undefined) {
      const building: Span[] = [{ text: buildingName({ readers, registry }, holder), target: { kind: 'building', id: holder } }];
      return stringSpans(strings, 'ui.look.item.in', { container: building });
    }
    const container = itemLink(readers, registry, holder);
    return zone.length === 0 ? stringSpans(strings, 'ui.look.item.in', { container }) : stringSpans(strings, 'ui.look.item.in_zone', { container, zone });
  }
  if (readers.entities.has(id, C.Position)) return zone.length === 0 ? [{ text: strings.get('ui.look.item.lying') }] : stringSpans(strings, 'ui.look.item.lying_in', { zone });
  return [{ text: strings.get((rec.flags & ItemFlag.Installed) !== 0 ? 'ui.look.item.installed' : 'ui.look.item.nowhere') }];
}

/** The item view's first line: "Furniture · common · 10 ☼", "Drink · ×20 · 40 ☼". */
export function itemSummary(readers: ReaderSet, strings: Strings, id: EntityId): string {
  const it = readers.of<ItemsReader>('13');
  const rec = it.get(id);
  if (rec === undefined) return '';
  const def = it.def(rec.type);
  const top = it.categoryOf(rec.type).split('/')[0] ?? '';
  const parts = [capitalize(top.replace(/_/g, ' '))];
  if (def?.quality === true) parts.push(QUALITY_WORDS[rec.quality] ?? '');
  if (rec.count > 1) parts.push(strings.get('ui.look.item.count', { n: rec.count }));
  parts.push(strings.get('ui.look.item.value', { value: it.value(id) }));
  return parts.filter((part) => part !== '').join(' · ');
}

/**
 * An item's view (24 § Inspection): it holds the item, never a tile, and finds its place through
 * `items.tileOf`, which sees through a carrier and a container. Pinned on top the summary line, the
 * line of how it is held and the `At` line, read fresh each frame; under them 13's item fields with
 * the maker, the owner and the job that has reserved it, which scroll; the keys at the foot. Names
 * are links. An item gone or out of sight says so with the place it was last seen (`last`).
 */
export function drawItemView(
  s: Surface,
  rect: Rect,
  readers: ReaderSet,
  registry: Registry,
  strings: Strings,
  id: EntityId,
  viewZ: number,
  view?: LookScroll,
  last: TileIndex | null = null,
  open?: (target: LookTarget) => void,
  foot?: LookFoot,
): void {
  const t = s.theme;
  const sink = view?.sink(`item:${id}`, open) ?? { links: [], focus: -1, open, seen: new Map() };
  if (rect.rows <= 0) return;
  const width = rect.cols - 2;
  let row = rect.row;
  const bottom = rect.row + rect.rows;
  const pinned = (text: string, fg: Rgb = t.text): void => {
    if (row >= bottom) return;
    label(s, rect.col + 1, row, text, { fg, width });
    row += 1;
  };
  const gone = itemGone(readers, id, itemShown(readers, id), undefined);
  if (gone !== null) {
    drawGoneView(s, rect, readers, registry, strings, gone, { name: '', sub: '', holder: 0, last }, sink, foot);
    if (view !== undefined) view.key = `gone:item:${id}`;
    return;
  }
  const it = readers.of<ItemsReader>('13');
  pinned(itemSummary(readers, strings, id));
  for (const r of wrapSpans(heldSpans(readers, registry, strings, id), width, 2)) {
    if (row >= bottom) break;
    drawSpanRow(s, rect.col + 1, row, width, r, t.text, sink);
    row += 1;
  }
  const tile = it.tileOf(id);
  if (tile >= 0) {
    // Others on its tile: the creatures and loose items there, but not what carries it or holds it.
    const holder = outerHolder(readers, id);
    const others = readers.entities.has(holder, C.Creature) ? 0 : creaturesAt(readers, tile).length + looseItemsAt(readers, tile).filter((other) => other !== id && other !== holder).length;
    pinned(placeLine(readers, strings, tile, others, viewZ), t.value);
  }
  if (row < bottom) {
    separator(s, rect.col + 1, row, width);
    row += 1;
  }
  const feet = footRows(bottom - row);
  if (feet > 0) drawLookFoot(s, { col: rect.col, row, cols: rect.cols, rows: bottom - row }, strings, foot, false);
  const region = { col: rect.col, row, cols: rect.cols, rows: bottom - feet - row };
  scrolled(s, region, view, `item:${id}`, (pen) => itemFields(s, pen, readers, registry, strings, id), sink);
}

/** 13's item fields under the pinned lines, a label column and a value: type, material, quality, count, value, rot, maker, owner, flags, the reserving job, what it holds. */
function itemFields(s: Surface, pen: Pen, readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): void {
  const t = s.theme;
  const it = readers.of<ItemsReader>('13');
  const rec = it.get(id);
  if (rec === undefined) return;
  const def = it.def(rec.type);
  const fields = ['type', 'material', 'quality', 'count', 'value', 'rot', 'made_by', 'owner', 'flags', 'for', 'holds'];
  const pad = Math.max(...fields.map((f) => Array.from(strings.get(`ui.look.item.field.${f}`)).length)) + 2;
  const rows: { name: string; value: Span[]; fg?: Rgb }[] = [];
  const material = agedMaterial(null, registry.table<{ id: string; name: string }>('materials').byIndex(rec.material)?.name ?? '', rec.age);
  rows.push({ name: 'type', value: [{ text: def?.name ?? '' }] });
  if (material !== '') rows.push({ name: 'material', value: [{ text: material }] });
  if (def?.quality === true) rows.push({ name: 'quality', value: [{ text: QUALITY_WORDS[rec.quality] ?? '' }] });
  rows.push({ name: 'count', value: [{ text: String(rec.count) }] });
  rows.push({ name: 'value', value: [{ text: strings.get('ui.look.item.value', { value: it.value(id) }) }] });
  const rot = itemRotText({ readers, strings }, id);
  if (rot !== '') rows.push({ name: 'rot', value: [{ text: rot }], fg: it.rotStage(id) >= 1 ? t.alert : t.dim });
  if (rec.crafterId !== 0 && readers.entities.has(rec.crafterId, C.Creature)) rows.push({ name: 'made_by', value: creatureLink(readers, registry, rec.crafterId) });
  rows.push({ name: 'owner', value: rec.ownerId !== 0 && readers.entities.has(rec.ownerId, C.Creature) ? creatureLink(readers, registry, rec.ownerId) : [{ text: strings.get('ui.look.item.no_one') }] });
  const flags = FLAG_WORDS.filter(([flag]) => (rec.flags & flag) !== 0).map(([, word]) => word);
  rows.push({ name: 'flags', value: [{ text: flags.length > 0 ? flags.join(', ') : strings.get('ui.look.item.none') }] });
  if (rec.reservedBy !== 0 && has(readers, '11')) {
    const jobs = readers.of<JobsReader>('11');
    const type = jobs.typeOf(rec.reservedBy) ?? '';
    const name = strings.has(`ui.jobs.type.${type}`) ? strings.get(`ui.jobs.type.${type}`) : capitalize(type.replace(/_/g, ' '));
    const worker = jobs.get(rec.reservedBy)?.workerId ?? 0;
    rows.push({ name: 'for', value: worker !== 0 && readers.entities.has(worker, C.Creature) ? stringSpans(strings, 'ui.look.item.for_worker', { job: name, who: creatureLink(readers, registry, worker) }) : [{ text: name }] });
  }
  const held = (it.containerRecord(id)?.contents ?? []).filter((inner) => it.get(inner) !== undefined);
  if (held.length > 0) rows.push({ name: 'holds', value: heldGroups(readers, registry, held) });
  for (const r of rows) {
    // The labels dim, as the mock-ups draw them; a value that wraps hangs under the value column.
    const head = strings.get(`ui.look.item.field.${r.name}`).padEnd(pad);
    pen.spans([{ text: head, fg: t.dim }, ...r.value], r.fg ?? t.text, pad);
  }
  const spell = spellLine(readers, strings, id, true);
  if (spell !== null) pen.wrapped('', spell, t.dim);
  const enchant = enchantLine(readers, strings, id);
  if (enchant !== null) pen.wrapped('', enchant, t.dim);
}

/** Milli-rune as the inspector shows it: "0.6", "1", "0.36". */
function runeAmount(milli: number): string {
  return String(Number((milli / 1000).toFixed(2)));
}

/**
 * 25's `creature › rune` section on one line: "Rune 31/50, +0.6 an hour (iron helm −20%, iron mail
 * −20%); full tomorrow". Null for a creature without a `Rune`.
 */
export function runeLine(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): string | null {
  if (!has(readers, '25')) return null;
  const rune = readers.of<MagicReader>('25').rune(id);
  if (rune === undefined) return null;
  const items = registry.table<{ id: string; name: string }>('items');
  const materials = registry.table<{ id: string; name: string }>('materials');
  const pieces = rune.metalPieces.map((piece) => {
    const item = readers.entities.get(piece, C.Item);
    const name = item === undefined ? '' : materialItemName(materials.byIndex(item.material)?.name ?? '', items.byIndex(item.type) ?? { name: '' });
    return strings.get('ui.look.rune_metal_piece', { item: name, n: METAL_RUNE_PENALTY_PERCENT });
  });
  const hours = rune.hoursToFull;
  const hourOfDay = readers.calendar.hour;
  const days = hours < 0 ? -1 : Math.floor((hourOfDay + hours) / 24);
  const full = hours < 0 ? strings.get('ui.look.rune_never')
    : hours === 0 ? strings.get('ui.look.rune_full')
      : days === 0 ? strings.get('ui.look.rune_full_hours', { n: hours })
        : days === 1 ? strings.get('ui.look.rune_full_tomorrow')
          : strings.get('ui.look.rune_full_days', { n: days });
  return strings.get('ui.look.rune', {
    current: Math.floor(rune.current / 1000),
    max: Math.floor(rune.max / 1000),
    regen: runeAmount(rune.regen),
    metal: pieces.length === 0 ? '' : ` (${pieces.join(', ')})`,
    full,
  });
}

/**
 * 25's vial line under the channel line: "Vials: 2 carried, 1 of 3 drunk today." Null for a
 * creature with no `Rune`, or one that carries no vial and has drunk none today.
 */
export function vialsLine(readers: ReaderSet, strings: Strings, id: EntityId): string | null {
  if (!has(readers, '25')) return null;
  const rune = readers.of<MagicReader>('25').rune(id);
  if (rune === undefined || (rune.vials === 0 && rune.vialsToday === 0)) return null;
  return strings.get('ui.look.rune_vials', { n: rune.vials, drunk: rune.vialsToday, max: VIALS_PER_DAY });
}

/**
 * The creature's timed effects (25 § Effects): "Under: ward 5 (340 ticks), slowed 50% (120
 * ticks)." Null with none.
 */
export function effectsLine(readers: ReaderSet, strings: Strings, id: EntityId): string | null {
  if (!has(readers, '25')) return null;
  const effects = readers.of<MagicReader>('25').effects(id);
  if (effects.length === 0) return null;
  const tick = readers.calendar.tick;
  const parts = effects.map((e) => strings.get(`ui.look.effect.${e.kind}`, { value: e.value, ticks: e.until - tick }));
  return strings.get('ui.look.effects', { list: parts.join(', ') });
}

/**
 * 25 § Draughts: "Can take a draught again in 2 days." while the creature's rest lasts, counted in
 * whole days begun; null when it may take one now.
 */
export function draughtRestLine(readers: ReaderSet, strings: Strings, id: EntityId): string | null {
  if (!has(readers, '25')) return null;
  const left = readers.of<MagicReader>('25').draughtRest(id);
  if (left <= 0) return null;
  const days = Math.ceil(left / TICKS_PER_DAY);
  return days <= 1 ? strings.get('ui.look.draught_rest_one') : strings.get('ui.look.draught_rest', { n: days });
}

/**
 * 25 § Summons, in the creature tab. A caster: "Summons: a stone warden (fades in 9 hours)." A
 * summon: "Called by Urist Ironvein; fades in 9 hours.", or "Fades in 9 hours." for one with no
 * caster. Null for any other creature.
 */
export function summonsLine(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): string | null {
  if (!has(readers, '25')) return null;
  const tick = readers.calendar.tick;
  const hours = (fadesAt: number): number => Math.max(0, Math.ceil((fadesAt - tick) / TICKS_PER_HOUR));
  const own = readers.entities.get(id, C.Summoned);
  if (own !== undefined) {
    const caster = own.summonerId === 0 ? undefined : readers.entities.get(own.summonerId, C.Creature);
    return caster === undefined
      ? strings.get('ui.look.summoned_loose', { hours: hours(own.fadesAt) })
      : strings.get('ui.look.summoned', { caster: caster.name, hours: hours(own.fadesAt) });
  }
  const called = readers.of<MagicReader>('25').summonsOf(id);
  if (called.length === 0) return null;
  const creatures = registry.table<{ id: string; name: string }>('creatures');
  const list = called.map((s) => strings.get('ui.look.summon_entry', {
    name: creatures.byIndex(readers.entities.get(s, C.Creature)?.species ?? 0)?.name ?? '',
    hours: hours(readers.entities.get(s, C.Summoned)?.fadesAt ?? tick),
  }));
  return strings.get('ui.look.summons', { list: list.join(', ') });
}

/**
 * The numbers of the spell set in a channel item: "Emberbolt: 24 ember, range 12. Needs a
 * runecaster." Null for anything else. `needs` adds the last sentence, for an item on the ground.
 */
export function spellLine(readers: ReaderSet, strings: Strings, itemId: EntityId, needs: boolean): string | null {
  if (!has(readers, '25')) return null;
  const spell = readers.of<MagicReader>('25').spellOf(itemId);
  if (spell === undefined) return null;
  const text = spellText(strings, spell);
  return needs ? `${text} ${strings.get('ui.look.spell_needs')}` : text;
}

/** One spell's numbers in words, by its kind (25 § Spells). */
function spellText(strings: Strings, spell: SpellView): string {
  const base = { name: spell.name, damage: spell.damage, type: spell.type, range: spell.range, ticks: spell.ticks };
  switch (spell.kind) {
    case 'ward': return strings.get('ui.look.spell_ward', base);
    case 'mend': return strings.get('ui.look.spell_mend', base);
    case 'dread': return strings.get('ui.look.spell_dread', { ...base, n: DREAD_MAX_TARGETS });
    case 'burst': return strings.get('ui.look.spell_burst', { ...base, delay: FIREBLOOM_DELAY_TICKS });
    case 'single': return strings.get('ui.look.spell_single', base);
    case 'call': return strings.get('ui.look.spell_call', { ...base, summon: spell.summon, n: MAX_SUMMONS_PER_CASTER });
    default: {
      const effect = spell.type === 'frost' && spell.ticks > 0
        ? strings.get('ui.look.spell_slow', { percent: FROSTBIND_SLOW_PERCENT, ticks: spell.ticks }) : '';
      return strings.get('ui.look.spell', { ...base, effect });
    }
  }
}

/**
 * What an enchanted item does, at its tier: "+9 ember on a hit." Null for an item with no
 * enchantment. A kind with no words is left out.
 */
export function enchantLine(readers: ReaderSet, strings: Strings, itemId: EntityId): string | null {
  if (!has(readers, '25')) return null;
  const enchant = readers.of<MagicReader>('25').enchantOf(itemId);
  if (enchant === undefined) return null;
  const parts = enchant.effects.map((e) => strings.has(`ui.look.enchant.${e.kind}`)
    ? strings.get(`ui.look.enchant.${e.kind}`, { value: e.value, type: e.type, chance: e.chance, ticks: e.ticks }) : '')
    .filter((text) => text !== '');
  return parts.length === 0 ? null : parts.join(' ');
}

/**
 * 25's staff line under the rune line: "Channel: iron staff of embers (fine). Emberbolt: 24
 * ember, range 12." Null for a creature that holds no channel with a spell.
 */
export function channelLine(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): string | null {
  if (!has(readers, '13') || !has(readers, '25')) return null;
  const weapon = readers.entities.get(id, C.Equipment)?.weapon ?? 0;
  if (weapon === 0) return null;
  const spell = spellLine(readers, strings, weapon, false);
  if (spell === null) return null;
  const it = readers.of<ItemsReaderLike>('13');
  const rec = it.get(weapon);
  const quality = rec !== undefined && it.def(rec.type)?.quality === true ? ` (${QUALITY_WORDS[rec.quality] ?? ''})` : '';
  return strings.get('ui.look.channel', { item: `${channelName(readers, registry, weapon)}${quality}`, spell });
}

/** A channel's name with its spell's suffix: "iron staff of embers". */
function channelName(readers: ReaderSet, registry: Registry, id: EntityId): string {
  const it = readers.of<ItemsReaderLike>('13');
  const rec = it.get(id);
  if (rec === undefined) return '';
  const material = registry.table<{ id: string; name: string }>('materials').byIndex(rec.material)?.name ?? '';
  const name = materialItemName(material, it.def(rec.type) ?? { name: '' });
  const suffix = has(readers, '25') ? readers.of<MagicReader>('25').spellOf(id)?.suffix : undefined;
  return suffix === undefined ? name : `${name} ${suffix}`;
}

interface ItemsReaderLike {
  get(id: EntityId): { type: number; material: number; quality: number; count: number; flags: number; containerId: EntityId; age?: 1 | 2 } | undefined;
  value(id: EntityId): number;
  def(type: number): { name: string; quality: boolean; category?: string } | undefined;
  inContainer(id: EntityId): EntityId[];
  tileOf(id: EntityId): TileIndex;
}

/**
 * The items on a tile and in the containers there, ascending: what lies on it, what a building on
 * it holds there (the wagon's goods lie at its centre, 02 § Arrival), and what is inside those.
 */
export function itemsAt(readers: ReaderSet, i: TileIndex): EntityId[] {
  if (!has(readers, '13') || !discovered(readers, i)) return [];
  const it = readers.of<ItemsReaderLike>('13');
  const out: EntityId[] = [];
  for (const id of readers.entities.at(i)) {
    if (it.get(id) === undefined) continue;
    out.push(id);
    out.push(...it.inContainer(id));
  }
  const building = has(readers, '14') ? readers.of<BuildingsReaderLike>('14').at(i) : 0;
  if (building !== 0) {
    for (const id of it.inContainer(building)) {
      if (it.tileOf(id) !== i || it.get(id) === undefined) continue;
      out.push(id);
      out.push(...it.inContainer(id));
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** A wound's treatment flags in the order its line names them: `ui.look.wound.<flag>`. */
const WOUND_FLAGS = ['bandaged', 'splinted', 'dressed', 'sutured', 'cleaned', 'infected'] as const;

const QUALITY_WORDS = ['poor', 'common', 'fine', 'superior', 'exceptional', 'masterwork'];
const FLAG_WORDS: [number, string][] = [
  [1, 'forbidden'],
  [2, 'dump'],
  [4, 'melt'],
  [8, 'reserved'],
  [16, 'owned'],
];

/** An item as a count and a name: "5 oak logs" is written "5 oak log", as the item section does. */
function itemName(readers: ReaderSet, registry: Registry, id: EntityId): string {
  const it = readers.of<ItemsReaderLike>('13');
  const rec = it.get(id);
  if (rec === undefined) return '';
  const def = it.def(rec.type);
  // 13 § Aging in a cellar: "aged bellwine", "vintage cheese".
  const material = agedMaterial(null, registry.table<{ id: string; name: string }>('materials').byIndex(rec.material)?.name ?? '', rec.age);
  const meal = has(readers, '12') ? readers.of<{ mealName(itemId: EntityId): string | null }>('12').mealName(id) : null;
  const suffix = has(readers, '25') ? readers.of<MagicReader>('25').spellOf(id)?.suffix : undefined;
  const name = enchantedName(readers, id, meal ?? materialItemName(material, def ?? { name: '' }));
  return `${rec.count} ${suffix === undefined ? name : `${name} ${suffix}`}`.trim();
}

interface BuildingsReaderLike {
  at(i: TileIndex): EntityId;
  get(id: EntityId): { typeId: string; material: number; state: string; mode: string } | undefined;
  zoneAt(i: TileIndex): EntityId;
  zone(id: EntityId): { type: string; tiles: readonly TileIndex[] } | undefined;
}
