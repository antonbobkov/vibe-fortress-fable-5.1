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
import type { Strings } from '../strings';
import type { MoraleReader } from '@systems/morale';
import { MOOD_TIER_NAMES } from './mood';
import type { Surface } from '../surface';
import { label, separator } from '../widgets';

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

export function drawLookPanel(
  s: Surface,
  rect: Rect,
  readers: ReaderSet,
  registry: Registry,
  strings: Strings,
  tile: TileIndex | null,
  tab: LookTab,
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
        line(`Mood: ${MOOD_TIER_NAMES[morale.tier(id)]} (${morale.mood(id)})`, t.value);
        for (const thought of morale.thoughts(id)) line(`  ${thought.value > 0 ? '+' : ''}${Math.round(thought.value)} ${thought.text}`);
      }
    }
  }
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

/** 13's `item` section on one line: "5 oak log (common) · 15 ☼ · forbidden". */
function itemLine(readers: ReaderSet, registry: Registry, id: EntityId): string {
  const it = readers.of<ItemsReaderLike>('13');
  const rec = it.get(id);
  if (rec === undefined) return '';
  const def = it.def(rec.type);
  const material = registry.table<{ id: string; name: string }>('materials').byIndex(rec.material)?.name ?? '';
  const meal = has(readers, '12') ? readers.of<{ mealName(itemId: EntityId): string | null }>('12').mealName(id) : null;
  const parts = [`${rec.count} ${meal ?? `${material} ${def?.name ?? ''}`}`.trim()];
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
    out.push(strings.get('ui.look.zone', { name: strings.get(`ui.zone.type.${zone.type}`), id: zoneId, n: zone.tiles.length, room: tier }));
  }
  return out;
}
