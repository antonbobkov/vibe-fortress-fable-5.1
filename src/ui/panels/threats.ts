/**
 * Threats panel: active threats, schedule preview, caverns, and the Deep gauge (`ui-screens/panels.md` § Threats).
 * Spec: 18 § Player-facing behavior, § Renown, § Schedule, § The Deep.
 */

import type { Rect } from '@render/cellbuffer';
import { C } from '@core/components';
import type { AnimalsReader } from '@systems/animals';
import { NEAR_DWARF_RADIUS } from '@systems/animals/constants';
import type { SchedulePreview, ThreatsReader } from '@systems/threats';
import type { TerrainReader } from '@systems/terrain';
import type { Surface } from '../surface';
import { label, separator, wrapHang, wrapLabel } from '../widgets';
import type { Strings } from '../strings';
import { seasonName } from './calendar';
import type { PanelContext } from './context';
import type { KeyPress } from '@platform/input';
import type { EntityId } from '@core/types';
import { visibleHostileIds } from '../status';
import { speciesPlural, withArticle } from '../messages';
import { comingText, memberShown, partyActiveText, partyMakeupText } from '../raid-lines';
import { fortressLabels, reachesFortress } from '../cavern-reach';
import { HOLLOW_AT_VEIN_RADIUS } from '../constants';

/** The Deep's line under its gauge, by level (18 § The Deep): `ui.threats.deep_quote.<level>`, the last for every level above. */
export function deepQuote(level: number, strings: Strings): string {
  return strings.get(`ui.threats.deep_quote.${Math.max(0, Math.min(DEEP_QUOTE_LAST, level))}`);
}

/** The highest level with a line of its own. */
const DEEP_QUOTE_LAST = 5;

/** A schedule preview's season and year as the panel writes it: "from Autumn, Y2". */
function shortSchedule(strings: Strings, value: SchedulePreview | null | undefined): string {
  if (value === undefined) return strings.get('ui.threats.schedule_unknown');
  if (value === null) return strings.get('ui.threats.schedule_never');
  return strings.get('ui.threats.schedule_from', { season: seasonName(strings, value.season), year: value.year });
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

/** A breached cavern's monsters and how many can walk to the halls: "5 monsters, 1 can reach the halls", "no monsters". */
export function cavernMonstersText(ctx: PanelContext, threats: ThreatsReader | null, cavern: number): string {
  const ids = threats?.cavernMonsters(cavern) ?? [];
  if (ids.length === 0) return ctx.strings.get('ui.threats.cavern_no_monsters');
  const labels = fortressLabels(ctx.readers);
  const reach = ids.filter((id) => reachesFortress(ctx.readers, id, labels)).length;
  return ctx.strings.get('ui.threats.cavern_monsters', { n: ids.length, reach: reach === 0 ? ctx.strings.get('ui.threats.reach_none') : reach });
}

/** How many kinds of hostile the Active line names before "and n more". */
const ACTIVE_KINDS_NAMED = 3;

/**
 * What the hostiles in view are, by species in the order first seen: "a cave crab", "3 cave
 * crabs", "2 gloam warriors and a blind stalker", "… and 2 more".
 */
export function hostilesText(ctx: PanelContext, ids: readonly EntityId[]): string {
  const creatures = ctx.registry.table<{ id: string; name: string; plural?: string }>('creatures');
  const groups = new Map<number, number>();
  for (const id of ids) {
    const species = ctx.readers.entities.get(id, C.Creature)?.species ?? -1;
    groups.set(species, (groups.get(species) ?? 0) + 1);
  }
  const parts = [...groups].map(([species, n]) => {
    const name = (creatures.byIndex(species)?.name ?? ctx.strings.get('ui.creature.unknown')).toLowerCase();
    return n === 1 ? withArticle(ctx.strings, name) : `${n} ${speciesPlural(creatures.byIndex(species))}`;
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
  label(s, col, row, ctx.strings.get('ui.threats.peril', { peril, renown: renown.toFixed(1) }), { fg: t.value, width });
  row += 1;
  row += wrapLabel(s, col, row, ctx.strings.get('ui.threats.attention'), { fg: t.dim, width }) - 1;
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
        // A click centres on the party's leader, or on its first member still on the map: one the map shows.
        const lead = [p.leaderId, ...p.members].map((m) => (ctx.readers.entities.alive(m) && memberShown(ctx.readers, m) ? tileOf(ctx, m) : null)).find((at) => at !== null);
        for (const part of wrapHang(partyActiveText(ctx.strings, ctx.registry, ctx.readers, p), width, 2)) {
          if (row >= rect.row + rect.rows) break;
          label(s, col, row, part, { fg: t.bad, width, keys: false });
          if (lead !== undefined && lead !== null) s.hit({ col, row, cols: width, rows: 1 }, () => ctx.focusOn(lead));
          row += 1;
        }
        // What the party is made of, by species, under its Active line (`panels.md` § Threats).
        const makeup = partyMakeupText(ctx.strings, ctx.registry, ctx.readers, p);
        if (makeup !== '') {
          for (const part of wrapHang(ctx.strings.get('ui.threats.makeup', { list: makeup }), width, 2)) {
            if (row >= rect.row + rect.rows) break;
            label(s, col, row, part, { fg: t.bad, width, keys: false });
            row += 1;
          }
        }
        // 18 § Morale: the party's morale in words, on a line of its own, while it has not broken.
        const morale = p.state === 'retreat' ? '' : threats?.moraleWord(pId) ?? '';
        if (morale !== '' && row < rect.row + rect.rows) {
          label(s, col, row, ctx.strings.get('ui.threats.morale', { word: morale }), { fg: t.bad, width });
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
  if (preview['raid'] !== undefined && preview['raid'] !== null) {
    label(s, col, row, ctx.strings.get('ui.threats.raids', { when: shortSchedule(ctx.strings, preview['raid']) }), { width });
    row += 1;
  }
  if (preview['ambush'] !== undefined && preview['ambush'] !== null) {
    label(s, col, row, ctx.strings.get('ui.threats.ambushes', { when: shortSchedule(ctx.strings, preview['ambush']) }), { width });
    row += 1;
  }
  label(s, col, row, ctx.strings.get('ui.threats.thieves', { when: shortSchedule(ctx.strings, preview['thief']) }), { width });
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
  separator(s, col, row, width, ctx.strings.get('ui.threats.caverns'));
  row += 1;
  for (let c = 1; c <= 3; c += 1) {
    if (row >= rect.row + rect.rows) break;
    const breached = terrain ? terrain.cavernBreached(c) : false;
    if (breached) {
      // Where the cavern lies open, "1: open at (84,73,z22)", and its monsters on the row under it,
      // with how many can walk to the halls: "5 monsters, 1 can reach the halls".
      const tile = breaches.find(([cavern]) => cavern === c)?.[1];
      const at = tile === undefined ? null : ctx.readers.map.unpack(tile);
      label(s, col, row, at === null ? ctx.strings.get('ui.threats.cavern_breached', { n: c })
        : ctx.strings.get('ui.threats.cavern_breached_at', { n: c, x: at.x, y: at.y, z: at.z }), { width });
      row += 1;
      if (row >= rect.row + rect.rows) break;
      label(s, col + 3, row, cavernMonstersText(ctx, threats, c), { width: width - 3 });
    } else {
      label(s, col, row, ctx.strings.get('ui.threats.cavern_sealed', { n: c }), { fg: t.dim, width });
    }
    row += 1;
  }

  // The Deep
  const deepsilverFound = deepFound || (threats !== null && (threats.deepPressure() > 0 || threats.deepLevel() > 0));

  if (deepsilverFound) {
    separator(s, col, row, width, ctx.strings.get('ui.threats.deep'));
    row += 1;
    const pressure = threats ? threats.deepPressure() : 0;
    const level = threats ? threats.deepLevel() : 0;
    const nextThresh = threats ? threats.deepNextThreshold() : 50;

    const filled = Math.min(10, Math.max(0, Math.floor((pressure / Math.max(1, nextThresh)) * 10)));
    const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
    // The pressure line and the Deep's quote wrap rather than cut.
    for (const part of wrapHang(ctx.strings.get('ui.threats.pressure', { bar, pressure, next: nextThresh, level }), width, 2)) {
      if (row >= rect.row + rect.rows) break;
      label(s, col, row, part, { width, keys: false });
      row += 1;
    }
    for (const part of wrapHang(`"${deepQuote(level, ctx.strings)}"`, width, 1)) {
      if (row >= rect.row + rect.rows) break;
      label(s, col, row, part, { fg: t.dim, width, keys: false });
      row += 1;
    }
    // The Hollow-born on the map, by species, at the vein or in the halls; a click centres on the first.
    const hollow = hollowText(ctx, threats);
    if (hollow !== null) {
      for (const part of wrapHang(hollow.text, width, 2)) {
        if (row >= rect.row + rect.rows) break;
        label(s, col, row, part, { fg: t.bad, width, keys: false });
        if (hollow.first !== null) {
          const first = hollow.first;
          s.hit({ col, row, cols: width, rows: 1 }, () => ctx.focusOn(first));
        }
        row += 1;
      }
    }
  }
}

/**
 * The Deep's Hollow-born on the map and in view (18 § Player-facing behavior): "3 hollow crawlers at the vein" while
 * every one stands within `HOLLOW_AT_VEIN_RADIUS` of the emergence base, on its level or two above or
 * below; else "… in the halls". Null with none.
 */
export function hollowText(ctx: PanelContext, threats: ThreatsReader | null): { text: string; first: number | null } | null {
  // A stalker that hides and is not yet spotted is not told.
  const ids = (threats?.hollowBorn() ?? []).filter((id) => threats === null || !threats.isStealthed(id) || threats.isSpotted(id));
  if (ids.length === 0) return null;
  const base = threats?.emergenceBase() ?? -1;
  const at = base < 0 ? null : ctx.readers.map.unpack(base);
  const atVein = at !== null && ids.every((id) => {
    const p = ctx.readers.entities.get(id, C.Position);
    return p !== undefined && Math.abs(p.z - at.z) <= 2 && Math.max(Math.abs(p.x - at.x), Math.abs(p.y - at.y)) <= HOLLOW_AT_VEIN_RADIUS;
  });
  const list = hostilesText(ctx, ids);
  return { text: ctx.strings.get(atVein ? 'ui.threats.hollow_vein' : 'ui.threats.hollow_halls', { list }), first: tileOf(ctx, ids[0] as EntityId) };
}
