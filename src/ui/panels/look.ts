/**
 * The look panel: 24 § Inspection ("The look panel shows the tile under the cursor or the clicked
 * tile with tabs for what is there: `Tile` …, `Items`, `Creatures` …. Every number the simulation
 * uses for that thing is shown, in the section registered by its owner") and the wireframe of
 * `ui-screens/fortress-screen.md` § Inspection panel.
 *
 * M1's sections are those whose owners exist: 03's `tile` (`readers.of('03').inspect`), and for a
 * creature 10's identity, activity and skills and 11's current job. M2 adds 13's `item` section
 * (type, material, quality, count, value, flags, container) and, on the tile tab, 14's building
 * (type, material, state, mode) and zone (type, tiles, room tier) lines (T-M2-09).
 */

import { C } from '@core/components';
import { FLUID_MAX_LEVEL, TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import { agedMaterial, buildingName, enchantedName, filterText, itemRotText, materialItemName, wrapHang, zoneName } from '../messages';
import type { Strings } from '../strings';
import type { MoraleReader } from '@systems/morale';
import type { BuildingsReader } from '@systems/buildings';
import type { FluidsReader } from '@systems/fluids';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { MagicReader, SpellView } from '@systems/magic';
import type { PlantsReader } from '@systems/plants';
import { DREAD_MAX_TARGETS, FIREBLOOM_DELAY_TICKS, FROSTBIND_SLOW_PERCENT, MAX_SUMMONS_PER_CASTER, METAL_RUNE_PENALTY_PERCENT, VIALS_PER_DAY } from '@systems/magic/constants';
import { MOOD_TIER_NAMES } from './mood';
import type { Surface } from '../surface';
import { label, separator } from '../widgets';
import { HEALTH_PART_BAR_CELLS } from '../constants';
import { barCells } from '../widgets/bar';
import { activityLabel } from './units';
import { attributeRows, equipmentText, identityLine, isDwarf, needCells, needCellWidth, personalityText, productivityText, relationsText, skillBar, titleText, wearingText } from './look-dwarf';

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

export type LookTab = 0 | 1 | 2;

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

/** The creatures on a tile, dwarves first (23 § Compositor step 6 order), then by id. */
export function creaturesAt(readers: ReaderSet, i: TileIndex): EntityId[] {
  return readers.entities
    .at(i)
    .filter((id) => readers.entities.has(id, C.Creature))
    .slice()
    .sort((a, b) => a - b);
}

/** "Ketil Ironvein, Digging": a creature's summary for the status bar. */
export function creatureSummary(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): string {
  const name = readers.entities.get(id, C.Creature)?.name ?? '';
  const activity = activityLabel({ readers, registry, strings }, id);
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
  if (others === 0) return summary;
  if (others > 1) return strings.get('ui.status.here_more', { summary, n: others });
  const thing = items.length === 1 ? itemName(readers, registry, items[0] as EntityId) : readers.entities.get(creatures[1] as EntityId, C.Creature)?.name ?? '';
  return strings.get('ui.status.here_one', { summary, thing });
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
 * The first of eight facts that applies to a patient, read from 14 (hospital, beds), 11 (the labor,
 * the job board) and 13 (stock): no hospital, no free bed, no one with Medicine on, waiting to be
 * carried, a treatment under way, a treatment short of a supply, waiting for a medic, resting.
 * Null for a creature that is not a patient.
 */
export function careLine(readers: ReaderSet, registry: Registry, strings: Strings, id: EntityId): CareLine | null {
  const patient = readers.entities.get(id, C.Patient);
  if (patient === undefined) return null;
  const say = (key: string, args: Record<string, string | number> = {}, urgent = false): CareLine => ({ text: strings.get(key, args), urgent });
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
      const item = filterText(registry, filter, 1).replace(/^\d+ /, '');
      const stock = has(readers, '13') ? readers.of<ItemsReader>('13').countAvailable(filter) : 0;
      return say('ui.look.care.needs', { item, n: stock }, true);
    }
  }
  return say(patient.needs.length === 0 ? 'ui.look.care.resting' : 'ui.look.care.waiting');
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
 * The tabs line, in the first form that fits the panel: "Tabs: [1]Tile [2]Items(52) [3]Creatures(7)",
 * then without "Tabs:", then with the short labels "[1]Tile [2]Items 52 [3]Who 7" (24 § Inspection).
 */
export function tabsLine(strings: Strings, width: number, items: number, creatures: number): string {
  const forms = ['ui.look.tabs', 'ui.look.tabs_bare', 'ui.look.tabs_short'].map((key) => strings.get(key, { items, creatures }));
  return forms.find((text) => Array.from(text).length <= width) ?? (forms[forms.length - 1] as string);
}

/**
 * How far the `Creatures` tab is scrolled (24 § Inspection): `PageUp` `PageDown` move it a page and
 * the wheel three rows a notch. It starts at the top again when the creatures shown, the tile or
 * the tab change.
 */
export class LookScroll {
  /** The rows of the tab scrolled past. */
  scroll = 0;
  /** The rows the last draw showed under the tabs line; a page is this less one. */
  visible = 10;
  /** The most the tab can scroll: its rows less those shown, at the last draw. */
  max = 0;
  /** What the last draw showed (tile, tab and creatures); a change starts the tab at the top. */
  key = '';

  move(delta: number): void {
    this.scroll = Math.max(0, Math.min(this.max, this.scroll + delta));
  }

  page(direction: 1 | -1): void {
    this.move(direction * Math.max(1, this.visible - 1));
  }
}

export function drawLookPanel(
  s: Surface,
  rect: Rect,
  readers: ReaderSet,
  registry: Registry,
  strings: Strings,
  tile: TileIndex | null,
  tab: LookTab,
  pullLever?: (id: EntityId) => void,
  /** 14 § Player-facing behavior: the building panel offers deconstruct (T-M7-09). */
  deconstruct?: (id: EntityId) => void,
  /** U-05: the building's own panel (`Enter`). */
  open?: (id: EntityId) => void,
  /** The creature whose sub-tab comes first (24 § Inspection: inspecting a creature from a list or a log line). */
  first: EntityId = 0,
  /** The `Creatures` tab's scroll; without one the tab is drawn from its top. */
  view?: LookScroll,
): void {
  const t = s.theme;
  if (tile === null) return;
  const map = readers.map;
  const w = map.w;
  const h = map.h;
  const x = tile % w;
  const y = Math.floor(tile / w) % h;
  const z = Math.floor(tile / (w * h));
  const here = creaturesAt(readers, tile);
  const creatures = here.includes(first) ? [first, ...here.filter((id) => id !== first)] : here;
  const itemIds = itemsAt(readers, tile);
  let row = rect.row;
  const bottom = rect.row + rect.rows;
  // The Creatures tab scrolls: `skip` rows are scrolled past above, `below` rows did not fit under it.
  let skip = 0;
  let below = 0;
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
  const line = (text: string, fg = t.text): void => put((r) => label(s, rect.col + 1, r, text, { fg, width: rect.cols - 2 }));
  // A long line (a channel's spell, an enchantment, the rune lines) wraps under its prefix, so its end is read.
  const wrapped = (prefix: string, text: string, fg = t.text): void => {
    for (const part of wrapHang(text, rect.cols - 2 - prefix.length, 2)) line(`${prefix}${part}`, fg);
  };
  // 13 § Rot: under a perishable item, its stage and the days it has left, in the alert colour once stale.
  const rot = (prefix: string, id: EntityId): void => {
    const text = itemRotText({ readers, strings }, id);
    if (text === '') return;
    const stage = has(readers, '13') ? readers.of<ItemsReader>('13').rotStage(id) : 0;
    wrapped(prefix, text, stage >= 1 ? t.alert : t.dim);
  };
  line(strings.get('ui.look.header', { x, y, z }), t.value);
  line(tabsLine(strings, rect.cols - 2, itemIds.length, creatures.length));
  if (view !== undefined && tab !== 2) view.key = '';
  if (tab === 0) {
    line(tileSummary(readers, strings, tile));
    const fluid = fluidText(readers, strings, tile);
    if (fluid !== '') line(capitalize(fluid));
    if (has(readers, '03')) {
      const info = readers.of<TerrainReaderLike>('03').inspect(tile);
      if (info.designation !== null) {
        const kind = strings.get(`ui.tool.designate.${DESIGNATION_IDS[info.designation.kind] ?? ''}`);
        line(strings.get('ui.look.designation', { kind, priority: info.designation.priority }));
      }
      if (info.forbidden) line(strings.get('ui.look.forbidden'));
      else if (info.restricted) line(strings.get('ui.look.restricted'));
    }
    for (const text of buildingLines(readers, registry, strings, tile)) line(text);
    // Everything else on the tile, so nothing here is seen only on another tab (24 § Inspection).
    if (itemIds.length + creatures.length > 0) {
      line(strings.get('ui.look.here'), t.key);
      for (const id of itemIds) {
        line(`  ${itemLine(readers, registry, id)}`);
        rot('    ', id);
        const spell = spellLine(readers, strings, id, true);
        if (spell !== null) wrapped('    ', spell, t.dim);
        const enchant = enchantLine(readers, strings, id);
        if (enchant !== null) wrapped('    ', enchant, t.dim);
      }
      for (const id of creatures) line(`  ${creatureSummary(readers, registry, strings, id)}`);
    }
    if (has(readers, '14')) {
      const b = readers.of<BuildingsReader>('14');
      const id = b.at(tile);
      if (id !== 0 && b.byTag('lever').includes(id) && b.get(id)?.state === 'built') {
        line('Linked targets:', t.key);
        for (const target of b.get(id)?.linkedIds ?? []) {
          const targetView = b.get(target);
          if (targetView !== undefined) line(`  ${buildingName({ readers, registry }, target)}: ${b.mechanismState(target)}`);
        }
        if (pullLever !== undefined && row < rect.row + rect.rows) {
          const buttonRow = row;
          line('[Pull lever]', t.value);
          s.hit({ col: rect.col + 1, row: buttonRow, cols: rect.cols - 2, rows: 1 }, () => pullLever(id));
        }
      }
      if (id !== 0 && open !== undefined && row < rect.row + rect.rows) {
        const buttonRow = row;
        line(strings.get('ui.look.open_building'), t.value);
        s.hit({ col: rect.col + 1, row: buttonRow, cols: rect.cols - 2, rows: 1 }, () => open(id));
      }
      if (id !== 0 && deconstruct !== undefined && b.get(id)?.state === 'built' && row < rect.row + rect.rows) {
        const buttonRow = row;
        line(strings.get('ui.look.deconstruct'), t.value);
        s.hit({ col: rect.col + 1, row: buttonRow, cols: rect.cols - 2, rows: 1 }, () => deconstruct(id));
      }
    }
    return;
  }
  if (tab === 1) {
    if (itemIds.length === 0) {
      line(strings.get('ui.look.no_items'), t.dim);
      return;
    }
    for (const id of itemIds) {
      line(itemLine(readers, registry, id));
      rot('  ', id);
      const spell = spellLine(readers, strings, id, true);
      if (spell !== null) wrapped('  ', spell, t.dim);
      const enchant = enchantLine(readers, strings, id);
      if (enchant !== null) wrapped('  ', enchant, t.dim);
    }
    return;
  }
  if (creatures.length === 0) {
    line(strings.get('ui.look.no_creatures'), t.dim);
    return;
  }
  const top = row;
  if (view !== undefined) {
    const key = `${tile}:${creatures.join(',')}`;
    if (view.key !== key) {
      view.key = key;
      view.scroll = 0;
    }
    view.visible = Math.max(1, bottom - top);
    view.scroll = Math.max(0, Math.min(view.max, view.scroll));
    skip = view.scroll;
  }
  const skills = registry.table<{ id: string; name: string }>('skills');
  for (const id of creatures) {
    const name = readers.entities.get(id, C.Creature)?.name ?? '';
    put((r) => separator(s, rect.col + 1, r, rect.cols - 2, strings.get('ui.look.creature', { name }).replace(/^── /, '').trim()));
    const dwarf = isDwarf(readers, id);
    // 10 § Registrations, `creature › dwarf`: the identity line, then the activity, the needs and the skills.
    if (dwarf) line(identityLine(readers, registry, strings, id));
    if (has(readers, '10')) {
      const dwarves = readers.of<DwarvesReaderLike>('10');
      // 10 § Tipsy: the inspector says "Tipsy" beside the activity.
      const words = activityLabel({ readers, registry, strings }, id);
      const activity = dwarves.isTipsy?.(id) === true ? strings.get('ui.units.tipsy', { activity: words }) : words;
      const job = has(readers, '11') ? readers.of<JobsReaderLike>('11').forWorker(id) : undefined;
      line(
        job === undefined
          ? strings.get('ui.look.activity', { activity })
          : strings.get('ui.look.activity_priority', { activity, priority: job.priority }),
      );
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
      if (has(readers, '15') && readers.entities.get(id, C.Creature)?.faction === 'fortress') {
        const morale = readers.of<MoraleReader>('15');
        line(`Mood: ${MOOD_TIER_NAMES[morale.tier(id)]} (${Math.round(morale.mood(id))})`, t.value);
        for (const thought of morale.thoughts(id)) line(`  ${thought.value > 0 ? '+' : ''}${Math.round(thought.value)} ${thought.text}`);
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
          line(`Health: ${bleeding ? 'Wounded, bleeding' : 'Wounded'}`, t.bad);
          careRows();
        } else {
          const bloodPct = body.maxBlood > 0 ? Math.floor((body.blood * 100) / body.maxBlood) : 100;
          line(`Health: Blood ${bloodPct}%, Pain ${body.pain}`);
          careRows();
          line(`  ${body.conscious ? 'Conscious' : 'Unconscious'}`, body.conscious ? t.text : t.bad);
          if (body.permanent.length > 0) line(`  Permanent: ${body.permanent.join(', ')}`, t.dim);
          const partNames = ['head', 'torso', 'left arm', 'right arm', 'left leg', 'right leg'];
          for (let pIdx = 0; pIdx < body.parts.length; pIdx += 1) {
            const part = body.parts[pIdx];
            if (!part) continue;
            const pName = partNames[pIdx] ?? `part ${pIdx}`;
            if (part.destroyed) {
              line(`  ${pName}: destroyed`, t.bad);
              continue;
            }
            const filled = barCells(part.hp, part.maxHp, HEALTH_PART_BAR_CELLS);
            // Wasting takes fractions of a hit point; the panel writes whole ones, as it writes the mood.
            line(`  ${pName} ${'▓'.repeat(filled)}${'░'.repeat(HEALTH_PART_BAR_CELLS - filled)} ${Math.round(part.hp)}/${Math.round(part.maxHp)} hp`);
            for (const w of part.wounds) {
              const flags: string[] = [];
              if (w.bandaged) flags.push('bandaged');
              if (w.splinted) flags.push('splinted');
              if (w.dressed) flags.push('dressed');
              if (w.sutured) flags.push('sutured');
              if (w.cleaned) flags.push('cleaned');
              if (w.infected) flags.push('infected');
              const flagStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';
              line(`    ${w.severity} ${w.type}${flagStr}`);
            }
          }
        }
      }
    }
    // What the creature holds and wears, then a dwarf's relations and titles (fortress-screen.md § Inspection panel).
    const equipment = equipmentText(readers, registry, strings, id, dwarf);
    if (equipment !== null) for (const text of hangingRows(equipment, rect.cols - 2)) line(text);
    const wearing = dwarf ? wearingText(readers, registry, strings, id) : null;
    if (wearing !== null) for (const text of hangingRows(wearing, rect.cols - 2)) line(text);
    if (dwarf) {
      for (const text of hangingRows(relationsText(readers, strings, id), rect.cols - 2)) line(text);
      const title = titleText(readers, strings, id);
      if (title !== null) line(title);
    }
  }
  if (view !== undefined) view.max = Math.max(0, view.scroll - skip + (row - top) + below - view.visible);
  // More above or below: a dim mark at the right edge of the first or the last row.
  const edge = rect.col + rect.cols - 1;
  if (view !== undefined && view.scroll > 0) label(s, edge, top, '▲', { fg: t.dim, keys: false });
  if (below > 0) label(s, edge, bottom - 1, '▼', { fg: t.dim, keys: false });
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
  if (!has(readers, '13')) return [];
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

/** 13's `item` section on one line: "5 oak log (common) · 15 ☼ · forbidden". */
function itemLine(readers: ReaderSet, registry: Registry, id: EntityId): string {
  const it = readers.of<ItemsReaderLike>('13');
  const rec = it.get(id);
  if (rec === undefined) return '';
  const def = it.def(rec.type);
  const parts = [itemName(readers, registry, id)];
  if (def?.quality === true) parts[0] += ` (${QUALITY_WORDS[rec.quality] ?? ''})`;
  parts.push(`${it.value(id)} ☼`);
  for (const [flag, word] of FLAG_WORDS) if ((rec.flags & flag) !== 0) parts.push(word);
  if (rec.containerId !== 0) parts.push('in a container');
  return parts.join(' · ');
}

interface BuildingsReaderLike {
  at(i: TileIndex): EntityId;
  get(id: EntityId): { typeId: string; material: number; state: string; mode: string } | undefined;
  zoneAt(i: TileIndex): EntityId;
  zone(id: EntityId): { type: string; tiles: readonly TileIndex[] } | undefined;
  room(zoneId: EntityId): { tier: number; score: number } | undefined;
  types(): readonly { id: string; name: string }[];
}

/** 14's `building` and `zone › room` lines for a tile. */
function buildingLines(readers: ReaderSet, registry: Registry, strings: Strings, i: TileIndex): string[] {
  if (!has(readers, '14')) return [];
  const b = readers.of<BuildingsReaderLike>('14');
  const out: string[] = [];
  const id = b.at(i);
  const bld = id === 0 ? undefined : b.get(id);
  if (bld !== undefined) {
    const name = b.types().find((r) => r.id === bld.typeId)?.name ?? bld.typeId;
    const material = registry.table<{ id: string; name: string }>('materials').byIndex(bld.material)?.name ?? '';
    const mode = bld.mode === '' ? '' : ` · ${bld.mode.replace(/_/g, ' ')}`;
    out.push(strings.get('ui.look.building', { name: `${material} ${name}`.trim(), state: bld.state, mode }));
  }
  const zoneId = b.zoneAt(i);
  const zone = zoneId === 0 ? undefined : b.zone(zoneId);
  if (zone !== undefined) {
    const room = b.room(zoneId);
    const tiers = registry.table<{ id: string; tier: number }>('roomTiers');
    const tier = room === undefined ? '' : ` · ${tiers.ids().find((t) => tiers.byId(t)?.tier === room.tier) ?? ''} (${Math.floor(room.score)})`;
    out.push(strings.get('ui.look.zone', { name: zoneName({ readers, strings }, zoneId), n: zone.tiles.length, room: tier }));
  }
  return out;
}
