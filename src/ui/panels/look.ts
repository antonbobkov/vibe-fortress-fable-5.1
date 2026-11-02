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
import { TileKind } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import { buildingName, filterText, materialItemName, zoneName } from '../messages';
import type { Strings } from '../strings';
import type { MoraleReader } from '@systems/morale';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { MagicReader } from '@systems/magic';
import { METAL_RUNE_PENALTY_PERCENT } from '@systems/magic/constants';
import { MOOD_TIER_NAMES } from './mood';
import type { Surface } from '../surface';
import { label, separator } from '../widgets';
import { HEALTH_PART_BAR_CELLS } from '../constants';
import { barCells } from '../widgets/bar';

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

const DESIGNATION_IDS = ['', 'dig', 'channel', 'stairs_up', 'stairs_down', 'stairs_updown', 'ramp', 'smooth', 'engrave', 'remove', 'chop', 'gather', 'harvest'];

/** "Granite wall, smoothed": the one-line summary of a tile (the status bar's hover line too). */
export function tileSummary(readers: ReaderSet, strings: Strings, i: TileIndex): string {
  if (!has(readers, '03')) return strings.get(`ui.kind.${readers.map.kindAt(i)}`);
  const t = readers.of<TerrainReaderLike>('03').inspect(i);
  if (!t.discovered) return strings.get('ui.look.undiscovered');
  const kind = strings.get(`ui.kind.${t.kind}`);
  const parts = [t.kind === TileKind.Open ? capitalize(kind) : capitalize(`${t.material} ${kind}`.trim())];
  if (t.smoothed) parts.push(strings.get('ui.look.smoothed'));
  if (t.engraved) parts.push(strings.get('ui.look.engraved'));
  return parts.join(', ');
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
export function creatureSummary(readers: ReaderSet, id: EntityId): string {
  const name = readers.entities.get(id, C.Creature)?.name ?? '';
  const activity = has(readers, '10') ? readers.of<DwarvesReaderLike>('10').activityText(id) : '';
  return activity.length > 0 ? `${name}, ${activity}` : name;
}

/**
 * The status row's hover summary (24 § Inspection): the first creature on the tile, or the terrain,
 * then what else is there: the one other thing by name, or how many.
 */
export function tileContents(readers: ReaderSet, registry: Registry, strings: Strings, i: TileIndex): string {
  const creatures = creaturesAt(readers, i);
  const items = itemsAt(readers, i);
  const summary = creatures.length > 0 ? creatureSummary(readers, creatures[0] as EntityId) : tileSummary(readers, strings, i);
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
): void {
  const t = s.theme;
  if (tile === null) return;
  const map = readers.map;
  const w = map.w;
  const h = map.h;
  const x = tile % w;
  const y = Math.floor(tile / w) % h;
  const z = Math.floor(tile / (w * h));
  const creatures = creaturesAt(readers, tile);
  const itemIds = itemsAt(readers, tile);
  let row = rect.row;
  const line = (text: string, fg = t.text): void => {
    if (row >= rect.row + rect.rows) return;
    label(s, rect.col + 1, row, text, { fg, width: rect.cols - 2 });
    row += 1;
  };
  line(strings.get('ui.look.header', { x, y, z }), t.value);
  line(strings.get('ui.look.tabs', { items: itemIds.length, creatures: creatures.length }));
  if (tab === 0) {
    line(tileSummary(readers, strings, tile));
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
      for (const id of itemIds) line(`  ${itemLine(readers, registry, id)}`);
      for (const id of creatures) line(`  ${creatureSummary(readers, id)}`);
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
    for (const id of itemIds) line(itemLine(readers, registry, id));
    return;
  }
  if (creatures.length === 0) {
    line(strings.get('ui.look.no_creatures'), t.dim);
    return;
  }
  const skills = registry.table<{ id: string; name: string }>('skills');
  for (const id of creatures) {
    const name = readers.entities.get(id, C.Creature)?.name ?? '';
    separator(s, rect.col + 1, row, rect.cols - 2, strings.get('ui.look.creature', { name }).replace(/^── /, '').trim());
    row += 1;
    if (has(readers, '10')) {
      const dwarves = readers.of<DwarvesReaderLike>('10');
      const activity = dwarves.activityText(id);
      const job = has(readers, '11') ? readers.of<JobsReaderLike>('11').forWorker(id) : undefined;
      line(
        job === undefined
          ? strings.get('ui.look.activity', { activity })
          : strings.get('ui.look.activity_priority', { activity, priority: job.priority }),
      );
      const known = skills
        .ids()
        .map((sid) => ({ sid, level: dwarves.skill(id, sid) }))
        .filter((k) => k.level > 0);
      if (known.length > 0) {
        line(strings.get('ui.look.skills'), t.key);
        for (const k of known) {
          line(`  ${skills.byId(k.sid)?.name ?? k.sid} ${k.level} (${dwarves.skillTier(id, k.sid)})`);
        }
      }
      if (has(readers, '15') && readers.entities.get(id, C.Creature)?.faction === 'fortress') {
        const morale = readers.of<MoraleReader>('15');
        line(`Mood: ${MOOD_TIER_NAMES[morale.tier(id)]} (${Math.round(morale.mood(id))})`, t.value);
        for (const thought of morale.thoughts(id)) line(`  ${thought.value > 0 ? '+' : ''}${Math.round(thought.value)} ${thought.text}`);
      }
    }
    const rune = runeLine(readers, registry, strings, id);
    if (rune !== null) line(rune, t.value);
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
            line(`  ${pName} ${'▓'.repeat(filled)}${'░'.repeat(HEALTH_PART_BAR_CELLS - filled)} ${part.hp}/${part.maxHp} hp`);
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
  }
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
    const name = item === undefined ? '' : materialItemName(materials.byIndex(item.material)?.name ?? '', { name: items.byIndex(item.type)?.name ?? '' });
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

interface ItemsReaderLike {
  get(id: EntityId): { type: number; material: number; quality: number; count: number; flags: number; containerId: EntityId } | undefined;
  value(id: EntityId): number;
  def(type: number): { name: string; quality: boolean } | undefined;
  inContainer(id: EntityId): EntityId[];
}

/** The items on a tile and in the containers there, ascending. */
export function itemsAt(readers: ReaderSet, i: TileIndex): EntityId[] {
  if (!has(readers, '13')) return [];
  const it = readers.of<ItemsReaderLike>('13');
  const out: EntityId[] = [];
  for (const id of readers.entities.at(i)) {
    if (it.get(id) === undefined) continue;
    out.push(id);
    out.push(...it.inContainer(id));
  }
  return out.sort((a, b) => a - b);
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
  const material = registry.table<{ id: string; name: string }>('materials').byIndex(rec.material)?.name ?? '';
  const meal = has(readers, '12') ? readers.of<{ mealName(itemId: EntityId): string | null }>('12').mealName(id) : null;
  return `${rec.count} ${meal ?? materialItemName(material, { name: def?.name ?? '' })}`.trim();
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
