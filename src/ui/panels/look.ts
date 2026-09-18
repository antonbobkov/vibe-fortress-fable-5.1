/**
 * The look panel: 24 § Inspection ("The look panel shows the tile under the cursor or the clicked
 * tile with tabs for what is there: `Tile` …, `Items`, `Creatures` …. Every number the simulation
 * uses for that thing is shown, in the section registered by its owner") and the wireframe of
 * `ui-screens/fortress-screen.md` § Inspection panel.
 *
 * M1's sections are those whose owners exist: 03's `tile` (`readers.of('03').inspect`), and for a
 * creature 10's identity, activity and skills and 11's current job. Items arrive with 13 (M2).
 */

import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { Strings } from '../strings';
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
  let row = rect.row;
  const line = (text: string, fg = t.text): void => {
    if (row >= rect.row + rect.rows) return;
    label(s, rect.col + 1, row, text, { fg, width: rect.cols - 2 });
    row += 1;
  };
  line(strings.get('ui.look.header', { x, y, z }), t.value);
  line(strings.get('ui.look.tabs', { items: 0, creatures: creatures.length }));
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
    return;
  }
  if (tab === 1) {
    line(strings.get('ui.look.no_items'), t.dim);
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
    }
  }
}
