/**
 * Threats panel: active threats, schedule preview, caverns, and the Deep gauge (`ui-screens/panels.md` § Threats).
 * Spec: 18 § Player-facing behavior, § Renown, § Schedule, § The Deep.
 */

import type { Rect } from '@render/cellbuffer';
import { C } from '@core/components';
import type { AnimalsReader } from '@systems/animals';
import { NEAR_DWARF_RADIUS } from '@systems/animals/constants';
import type { ThreatsReader } from '@systems/threats';
import type { TerrainReader } from '@systems/terrain';
import type { Surface } from '../surface';
import { label, separator, wrapHang } from '../widgets';
import type { PanelContext } from './context';
import type { KeyPress } from '@platform/input';
import type { EntityId } from '@core/types';
import { visibleHostileIds } from '../status';
import { pluralName } from '../messages';
import { comingText } from '../raid-lines';

export function deepQuote(level: number): string {
  switch (level) {
    case 0:
      return 'Something below has not yet noticed.';
    case 1:
      return 'The Deep stirs. Something has noticed the pale metal being taken.';
    case 2:
      return 'The rock cracks below. The Hollow sends its hunters.';
    case 3:
      return 'Fire moves in the deep. A wyrm has come up.';
    case 4:
      return 'The Hollow opens its mouth.';
    default:
      return 'The Hollow does not forget.';
  }
}

function shortSchedule(value: string): string {
  return value.replace('possible from ', 'from ').replace('Year ', 'Y');
}

/** The dangerous species on the map: its name, how many, and whether one is within NEAR_DWARF_RADIUS of a dwarf. */
export interface WildlifeRow { readonly name: string; readonly count: number; readonly near: boolean }

export function wildlifeRows(ctx: PanelContext): WildlifeRow[] {
  if (!ctx.readers.has('08')) return [];
  const animals = ctx.readers.of<AnimalsReader>('08');
  const creatures = ctx.registry.table<{ id: string; name: string }>('creatures');
  const dwarves = ctx.readers.has('10') ? ctx.readers.of<{ list(): number[] }>('10').list() : [];
  const spots = dwarves.map((id) => ctx.readers.entities.get(id, C.Position)).filter((p) => p !== undefined);
  const rows = new Map<string, { count: number; near: boolean }>();
  for (const id of animals.wildList()) {
    const species = ctx.readers.entities.get(id, C.Creature)?.species ?? 0;
    const row = creatures.byIndex(species);
    if (row === undefined || !animals.isDangerous(row.id)) continue;
    const at = ctx.readers.entities.get(id, C.Position);
    const near = at !== undefined && spots.some((p) => p !== undefined && Math.max(Math.abs(p.x - at.x), Math.abs(p.y - at.y)) <= NEAR_DWARF_RADIUS && p.z === at.z);
    const old = rows.get(row.id) ?? { count: 0, near: false };
    rows.set(row.id, { count: old.count + 1, near: old.near || near });
  }
  return Array.from(rows, ([id, v]) => ({ name: (creatures.byId(id)?.name ?? id).toLowerCase(), ...v })).sort((a, b) => a.name.localeCompare(b.name));
}

/** How many kinds of hostile the Active line names before "and n more". */
const ACTIVE_KINDS_NAMED = 3;

/**
 * What the hostiles in view are, by species in the order first seen: "a cave crab", "3 cave
 * crabs", "2 gloam warriors and a blind stalker", "… and 2 more".
 */
export function hostilesText(ctx: PanelContext, ids: readonly EntityId[]): string {
  const creatures = ctx.registry.table<{ id: string; name: string }>('creatures');
  const groups = new Map<number, number>();
  for (const id of ids) {
    const species = ctx.readers.entities.get(id, C.Creature)?.species ?? -1;
    groups.set(species, (groups.get(species) ?? 0) + 1);
  }
  const parts = [...groups].map(([species, n]) => {
    const name = (creatures.byIndex(species)?.name ?? 'creature').toLowerCase();
    return n === 1 ? `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}` : `${n} ${pluralName(name)}`;
  });
  const shown = parts.slice(0, ACTIVE_KINDS_NAMED);
  const rest = parts.length - shown.length;
  if (rest > 0) return ctx.strings.get('announce.list_and', { list: shown.join(', '), last: ctx.strings.get('announce.theft.more', { n: rest }) });
  if (shown.length <= 1) return shown[0] ?? '';
  return ctx.strings.get('announce.list_and', { list: shown.slice(0, -1).join(', '), last: shown[shown.length - 1] as string });
}

/** The tile of a creature, for a click that centres on it. */
function tileOf(ctx: PanelContext, id: EntityId): number | null {
  const p = ctx.readers.entities.get(id, C.Position);
  return p === undefined ? null : ctx.readers.map.index(p.x, p.y, p.z);
}

export class ThreatsPanel {
  key(_ctx: PanelContext, _press: KeyPress): boolean {
    return false;
  }
}

/** A party is known once at least one of its members can be seen. */
export function visibleThreatParties(reader: Pick<ThreatsReader, 'activeParties' | 'party' | 'isStealthed' | 'isSpotted'>): readonly number[] {
  return reader.activeParties().filter((id) => {
    const party = reader.party(id);
    return party !== undefined && party.purpose !== 'caravan' &&
      party.members.some((member) => !reader.isStealthed(member) || reader.isSpotted(member));
  });
}

export function drawThreatsPanel(
  s: Surface,
  rect: Rect,
  _panel: ThreatsPanel,
  ctx: PanelContext,
  deepFound = false,
  /** The breach tile of each breached cavern, `[cavern, tile]`, as the UI saw it (`UiState.breaches`). */
  breaches: readonly (readonly [number, number])[] = [],
): void {
  const t = s.theme;
  const col = rect.col + 1;
  const width = rect.cols - 2;
  let row = rect.row;

  const threats = ctx.readers.has('18') ? ctx.readers.of<ThreatsReader>('18') : null;
  const terrain = ctx.readers.has('03') ? ctx.readers.of<TerrainReader>('03') : null;

  const peril = terrain?.spec()?.peril ?? 0;
  const renown = threats ? threats.renown() : 0;
  label(s, col, row, `Peril ${peril} · Renown ${renown.toFixed(1)}`, { fg: t.value, width });
  row += 1;
  label(s, col, row, 'Wealth and population draw attention.', { fg: t.dim, width });
  row += 1;

  // Active threats
  const active = threats ? visibleThreatParties(threats) : [];
  // D-U8: the status bar's `!n` and this line agree: hostiles in view without a party (a cavern
  // monster come up, a wild predator) are counted here too.
  const seenIds = visibleHostileIds(ctx.readers);
  const wildlife = wildlifeRows(ctx);
  if (active.length === 0) {
    const none = wildlife.length > 0 ? ctx.strings.get('ui.threats.active_wildlife') : ctx.strings.get('ui.threats.active_none');
    if (seenIds.length === 0) {
      label(s, col, row, none, { fg: wildlife.length > 0 ? t.bad : t.text, width });
      row += 1;
    } else {
      // What the hostiles in view are; a click centres on the first.
      const first = tileOf(ctx, seenIds[0] as EntityId);
      for (const part of wrapHang(ctx.strings.get('ui.threats.active_named', { list: hostilesText(ctx, seenIds) }), width, 2)) {
        if (row >= rect.row + rect.rows) break;
        label(s, col, row, part, { fg: t.bad, width, keys: false });
        if (first !== null) s.hit({ col, row, cols: width, rows: 1 }, () => ctx.focusOn(first));
        row += 1;
      }
    }
  } else {
    for (const pId of active) {
      if (row >= rect.row + rect.rows) break;
      const p = threats?.party(pId);
      if (p) {
        label(s, col, row, `Active: ${p.purpose} (${p.members.length}, ${p.state})`, { fg: t.bad, width });
        // A click centres on the party's leader, or on its first member still on the map.
        const lead = [p.leaderId, ...p.members].map((m) => (ctx.readers.entities.alive(m) ? tileOf(ctx, m) : null)).find((at) => at !== null);
        if (lead !== undefined && lead !== null) s.hit({ col, row, cols: width, rows: 1 }, () => ctx.focusOn(lead));
        row += 1;
        // 18 § Morale: the party's morale in words, on a line of its own, while it has not broken.
        const morale = p.state === 'retreat' ? '' : threats?.moraleWord(pId) ?? '';
        if (morale !== '' && row < rect.row + rect.rows) {
          label(s, col, row, `  Morale: ${morale}`, { fg: t.bad, width });
          row += 1;
        }
      }
    }
  }

  // The parties a warning announced, until they come.
  for (const coming of threats?.coming() ?? []) {
    for (const part of wrapHang(comingText(ctx.strings, ctx.registry, coming, ctx.readers.calendar.tick), width, 2)) {
      if (row >= rect.row + rect.rows) break;
      label(s, col, row, part, { fg: t.alert, width, keys: false });
      row += 1;
    }
  }

  // Schedule preview
  const preview = threats ? threats.schedulePreview() : {};
  if (preview['raid'] !== undefined && preview['raid'] !== 'never') {
    label(s, col, row, `Raids ${shortSchedule(preview['raid'])}`, { width });
    row += 1;
  }
  if (preview['ambush'] !== undefined && preview['ambush'] !== 'never') {
    label(s, col, row, `Ambushes ${shortSchedule(preview['ambush'])}`, { width });
    row += 1;
  }
  label(s, col, row, `Thieves ${shortSchedule(preview['thief'] ?? 'unknown')}`, { width });
  row += 1;

  // Wildlife: the dangerous species on the map (08 § Registrations).
  if (wildlife.length > 0) {
    separator(s, col, row, width, ctx.strings.get('ui.threats.wildlife'));
    row += 1;
    for (const w of wildlife) {
      if (row >= rect.row + rect.rows) break;
      label(s, col, row, ctx.strings.get(w.near ? 'ui.threats.wild_near' : 'ui.threats.wild_far', { species: w.name, count: w.count }), { fg: w.near ? t.bad : t.text, width, keys: false });
      row += 1;
    }
  }

  // Caverns
  separator(s, col, row, width, 'Caverns');
  row += 1;
  for (let c = 1; c <= 3; c += 1) {
    if (row >= rect.row + rect.rows) break;
    const breached = terrain ? terrain.cavernBreached(c) : false;
    if (breached) {
      const monsterCount = threats ? threats.monstersInCavern(c) : 0;
      // Where the cavern lies open, "1: breached at (84,73,z22)", and its monsters on the row under it.
      const tile = breaches.find(([cavern]) => cavern === c)?.[1];
      const at = tile === undefined ? null : ctx.readers.map.unpack(tile);
      if (at === null) label(s, col, row, `${c}: breached · monsters ${monsterCount}`, { width });
      else {
        label(s, col, row, ctx.strings.get('ui.threats.cavern_breached_at', { n: c, x: at.x, y: at.y, z: at.z }), { width });
        row += 1;
        if (row >= rect.row + rect.rows) break;
        label(s, col + 3, row, ctx.strings.get('ui.threats.cavern_monsters', { n: monsterCount }), { width: width - 3 });
      }
    } else {
      label(s, col, row, `${c}: sealed`, { fg: t.dim, width });
    }
    row += 1;
  }

  // The Deep
  const deepsilverFound = deepFound || (threats !== null && (threats.deepPressure() > 0 || threats.deepLevel() > 0));

  if (deepsilverFound) {
    separator(s, col, row, width, 'The Deep');
    row += 1;
    const pressure = threats ? threats.deepPressure() : 0;
    const level = threats ? threats.deepLevel() : 0;
    const nextThresh = threats ? threats.deepNextThreshold() : 50;

    const filled = Math.min(10, Math.max(0, Math.floor((pressure / Math.max(1, nextThresh)) * 10)));
    const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
    label(s, col, row, `Pressure ${bar} ${pressure} / ${nextThresh} (lvl ${level})`, { width });
    row += 1;

    const quote = `"${deepQuote(level)}"`;
    if (quote.length <= width) {
      label(s, col, row, quote, { fg: t.dim, width });
      row += 1;
    } else {
      const words = quote.split(' ');
      let line1 = '';
      let line2 = '';
      for (const w of words) {
        if ((line1 + ' ' + w).trim().length <= width) {
          line1 = (line1 + ' ' + w).trim();
        } else {
          line2 = (line2 + ' ' + w).trim();
        }
      }
      label(s, col, row, line1, { fg: t.dim, width });
      row += 1;
      if (line2.length > 0 && row < rect.row + rect.rows) {
        label(s, col, row, ` ${line2}`, { fg: t.dim, width });
        row += 1;
      }
    }
  }
}
