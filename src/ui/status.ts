/**
 * The status bar: `ui-screens/fortress-screen.md` § Sidebar closed, "Status row 1 fields left to
 * right: date; weather glyph, word and temperature; `☺` population; `♥` hall spirit tier (colored);
 * `+n` patients (red, hidden when 0); `!n` hostiles on map (red, hidden when 0); `$` caravan
 * present (hidden otherwise); `z` current level; speed glyphs and multiplier (`║` when paused …);
 * `[?] help` at the right edge", and `glyphs-and-colors.md` § Status bar glyphs (speed `►`, `►►`,
 * `►►►`, paused `║`).
 *
 * A field whose owning system is not running is not drawn: hall spirit (15),
 * patients (17), hostiles (18) and the caravan (20) arrive in later milestones (docs/archive/decisions-archive.md
 * D-066).
 */

import type { ReaderSet } from '@core/readers';
import { weatherField } from './panels/calendar';
import type { Strings } from './strings';
import type { MoraleReader } from '@systems/morale';
import { MOOD_TIER_NAMES } from './panels/mood';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import type { HealthReader } from '@systems/health';
import type { ThreatsReader } from '@systems/threats';
import type { TradeReader } from '@systems/trade';
import { UI_NORMAL_SPACING, UI_COMPACT_SPACING } from './constants';

export type Speed = 0 | 1 | 2 | 4;

/** `►`, `►►`, `►►►` by multiplier; `║` when paused. */
export function speedText(speed: Speed): string {
  if (speed === 0) return '║';
  const arrows = speed === 1 ? '►' : speed === 2 ? '►►' : '►►►';
  return `${arrows} ${speed}×`;
}

/** The fields of row 1, left to right, without the right-aligned help. */
export function statusFields(readers: ReaderSet, strings: Strings, z: number, speed: Speed, loadShedding = false): string[] {
  const cal = readers.calendar;
  const season = cal.seasonName.charAt(0).toUpperCase() + cal.seasonName.slice(1);
  const fields = [strings.get('ui.status.date', { day: cal.dayOfSeason, season, year: cal.year })];
  // 06 weather (T-M3-08): "weather glyph, word and temperature".
  const weather = weatherField(readers, strings);
  if (weather !== null) fields.push(weather);
  if (readers.has('10')) {
    fields.push(strings.get('ui.status.pop', { n: readers.of<{ population(): number }>('10').population() }));
  }
  if (readers.has('15')) fields.push(`♥ ${MOOD_TIER_NAMES[readers.of<MoraleReader>('15').hallSpiritTier()]}`);
  if (readers.has('17') && readers.has('10')) {
    const health = readers.of<HealthReader>('17');
    const n = readers.of<{ list(): number[] }>('10').list().filter((id) => health.isPatient(id)).length;
    if (n > 0) fields.push(`+${n}`);
  }
  if (readers.has('18')) {
    const n = visibleHostiles(readers);
    if (n > 0) fields.push(`!${n}`);
  }
  if (readers.has('20') && readers.of<TradeReader>('20').activeCaravan() !== null) fields.push('$');
  fields.push(strings.get('ui.status.z', { z }));
  fields.push(loadShedding ? `${speedText(speed)} ${strings.get('ui.status.slow')}` : speedText(speed));
  return fields;
}

/**
 * `!n` (D-U8, S6): the hostiles on discovered tiles that are not hidden, plus every spotted one.
 * A creature in a sealed cavern far below is not counted; the threats panel's "Active" agrees.
 */
export function visibleHostiles(readers: ReaderSet): number {
  if (!readers.has('18')) return 0;
  const threats = readers.of<ThreatsReader>('18');
  const map = readers.map;
  return readers.entities.with(C.Creature, C.Position).filter((id) => {
    if (!readers.entities.alive(id) || !threats.isHostile(id)) return false;
    if (threats.isSpotted(id)) return true;
    const p = readers.entities.get(id, C.Position);
    if (p === undefined || threats.isStealthed(id)) return false;
    return (map.flagsAt(map.index(p.x, p.y, p.z)) & TileFlag.Discovered) !== 0;
  }).length;
}

/** Row 1 as one line of `cols` cells: the fields three spaces apart, `[?] help` at the right edge. */
export function statusRow1(readers: ReaderSet, strings: Strings, z: number, speed: Speed, cols: number, loadShedding = false): string {
  const fields = statusFields(readers, strings, z, speed, loadShedding);
  const left = ` ${fields.join(' '.repeat(statusFieldSpacing(fields, strings, cols)))}`;
  const help = `${strings.get('ui.status.help')} `;
  const pad = Math.max(1, cols - Array.from(left).length - Array.from(help).length);
  return `${left}${' '.repeat(pad)}${help}`;
}

/** Keep the help field inside the minimum viewport without changing field order. */
export function statusFieldSpacing(fields: readonly string[], strings: Strings, cols: number): number {
  const normal = fields.reduce((sum, field) => sum + Array.from(field).length, 0) +
    Math.max(0, fields.length - 1) * UI_NORMAL_SPACING + Array.from(strings.get('ui.status.help')).length + 3;
  return normal <= cols ? UI_NORMAL_SPACING : UI_COMPACT_SPACING;
}

/** A narrow strip drops complete trailing entries, rather than clipping an accelerator. */
export function statusPanelStrip(strings: Strings, cols: number): string {
  let strip = '';
  for (const entry of strings.get('ui.status.strip').split('  ')) {
    const candidate = strip.length === 0 ? entry : `${strip}  ${entry}`;
    if (Array.from(candidate).length > cols) break;
    strip = candidate;
  }
  return strip;
}
