/**
 * The status bar: `ui-screens/fortress-screen.md` § Sidebar closed, "Status row 1 fields left to
 * right: date; weather glyph, word and temperature; `☺` population; `♥` hall spirit tier (colored);
 * `+n` patients (red, hidden when 0); `!n` hostiles on map (red, hidden when 0); `$` caravan
 * present (hidden otherwise); `z` current level; speed glyphs and multiplier (`║` when paused …);
 * `[?] help` at the right edge", and `glyphs-and-colors.md` § Status bar glyphs (speed `►`, `►►`,
 * `►►►`, paused `║`).
 *
 * A field whose owning system is not running is not drawn: hall spirit (15),
 * patients (17), hostiles (18) and the caravan (20) arrive in later milestones (DECISIONS.md
 * D-066).
 */

import type { ReaderSet } from '@core/readers';
import { weatherField } from './panels/calendar';
import type { Strings } from './strings';

export type Speed = 0 | 1 | 2 | 4;

/** `►`, `►►`, `►►►` by multiplier; `║` when paused. */
export function speedText(speed: Speed): string {
  if (speed === 0) return '║';
  const arrows = speed === 1 ? '►' : speed === 2 ? '►►' : '►►►';
  return `${arrows} ${speed}×`;
}

/** The fields of row 1, left to right, without the right-aligned help. */
export function statusFields(readers: ReaderSet, strings: Strings, z: number, speed: Speed): string[] {
  const cal = readers.calendar;
  const season = cal.seasonName.charAt(0).toUpperCase() + cal.seasonName.slice(1);
  const fields = [strings.get('ui.status.date', { day: cal.dayOfSeason, season, year: cal.year })];
  // 06 weather (T-M3-08): "weather glyph, word and temperature".
  const weather = weatherField(readers, strings);
  if (weather !== null) fields.push(weather);
  if (readers.has('10')) {
    fields.push(strings.get('ui.status.pop', { n: readers.of<{ population(): number }>('10').population() }));
  }
  fields.push(strings.get('ui.status.z', { z }));
  fields.push(speedText(speed));
  return fields;
}

/** Row 1 as one line of `cols` cells: the fields three spaces apart, `[?] help` at the right edge. */
export function statusRow1(readers: ReaderSet, strings: Strings, z: number, speed: Speed, cols: number): string {
  const left = ` ${statusFields(readers, strings, z, speed).join('   ')}`;
  const help = `${strings.get('ui.status.help')} `;
  const pad = Math.max(1, cols - Array.from(left).length - Array.from(help).length);
  return `${left}${' '.repeat(pad)}${help}`;
}
