/**
 * The calendar panel and the status bar's weather field: `06` § Player-facing behavior ("Status
 * bar: a weather glyph and word … and the temperature in °C"; "The calendar panel (from the status
 * bar date) shows the season, the day, daylight hours, and the current weather with its remaining
 * hours") and `glyphs-and-colors.md` § Status bar glyphs. docs/04-implementation/ui-screens/fortress-screen.md § Status bar.
 */

import type { ReaderSet } from '@core/readers';
import type { Rect } from '@render/cellbuffer';
import type { Rgb } from '@render/palette';
import type { Strings } from '../strings';
import type { Surface, Theme } from '../surface';
import { label } from '../widgets';

interface WeatherLike {
  state(): string;
  surfaceTempC(): number;
  isDaylight(): boolean;
  forecast(): number;
  daylightHours(): readonly [number, number];
}

/** § Status bar glyphs: clear `☼` (the moon `C` at night), overcast `≡`, rain `'`, storm `↯`, snow `*`, fog `≡`, heatwave `☼`, cold snap `*`. */
export const WEATHER_GLYPHS: Readonly<Record<string, string>> = Object.freeze({
  clear: '☼',
  overcast: '≡',
  rain: "'",
  storm: '↯',
  snow: '*',
  fog: '≡',
  heatwave: '☼',
  cold_snap: '*',
});

/** The moon, "`C` in `dark_cyan`". */
export const MOON_GLYPH = 'C';

export function weatherOf(readers: ReaderSet): WeatherLike | null {
  return readers.has('06') ? readers.of<WeatherLike>('06') : null;
}

/** The glyph of the weather field: the state's, with the moon for a clear night. */
export function weatherGlyph(w: WeatherLike): string {
  const state = w.state();
  if (state === 'clear' && !w.isDaylight()) return MOON_GLYPH;
  return WEATHER_GLYPHS[state] ?? '?';
}

/** The glyph's colour: heatwave red, cold snap cyan, fog dim, the moon dark cyan, else the text colour. */
export function weatherColor(w: WeatherLike, theme: Theme): Rgb {
  const state = w.state();
  if (state === 'heatwave') return theme.hot;
  if (state === 'cold_snap') return theme.cold;
  if (state === 'fog') return theme.dim;
  if (state === 'clear' && !w.isDaylight()) return theme.moon;
  return theme.text;
}

/** `☼ clear 21°C`. */
export function weatherField(readers: ReaderSet, strings: Strings): string | null {
  const w = weatherOf(readers);
  if (w === null) return null;
  return strings.get('ui.status.weather', { glyph: weatherGlyph(w), word: w.state().replace('_', ' '), temp: w.surfaceTempC() });
}

export function drawCalendarPanel(s: Surface, rect: Rect, readers: ReaderSet, strings: Strings): void {
  const cal = readers.calendar;
  const season = cal.seasonName.charAt(0).toUpperCase() + cal.seasonName.slice(1);
  const lines = [strings.get('ui.calendar.season', { season, year: cal.year }), strings.get('ui.calendar.day', { day: cal.dayOfSeason, hour: cal.hour })];
  const w = weatherOf(readers);
  if (w !== null) {
    const [rise, set] = w.daylightHours();
    lines.push(strings.get('ui.calendar.daylight', { rise, set }));
    lines.push(strings.get('ui.calendar.weather', { word: w.state().replace('_', ' '), hours: w.forecast(), temp: w.surfaceTempC() }));
  }
  lines.forEach((text, k) => {
    if (k < rect.rows) label(s, rect.col + 1, rect.row + k, text, { width: rect.cols - 2 });
  });
}
