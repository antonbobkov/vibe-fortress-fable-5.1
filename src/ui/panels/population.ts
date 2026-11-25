/** `ui-screens/panels.md` § Population and `21-immigration.md` § Reader. */
import { seasonOf, SEASON_NAMES, yearOf } from '@core/calendar';
import { C } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import type { Rect } from '@render/cellbuffer';
import type { ImmigrationReader } from '@systems/immigration/reader';
import type { MoraleReader } from '@systems/morale';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import { Strings } from '../strings';
import type { Surface } from '../surface';
import { keyCells, label, wrapLabel } from '../widgets';
import { seasonName } from './calendar';
import type { PanelContext } from './context';
import { moodTierName } from './mood';
import { dwarvesOf } from './units';

export const POPULATION_CAP_STEP = 1;

export function changePopulationCap(ctx: PanelContext, delta: number): void {
  if (!ctx.readers.has('21')) return;
  const cap = ctx.readers.of<ImmigrationReader>('21').cap();
  ctx.submit({ type: 'SetPopulationCap', n: cap + delta });
}

/** Why a wave can come or not (21 § Eligibility), the first reason in words. */
export function eligibilityText(reasons: readonly string[], strings: Strings = new Strings()): string {
  const reason = reasons[0];
  if (!reason) return strings.get('ui.population.eligible_yes');
  if (reason === 'cap') return strings.get('ui.population.paused_cap');
  const words = strings.has(`ui.population.reason.${reason}`) ? strings.get(`ui.population.reason.${reason}`) : reason;
  return strings.get('ui.population.eligible_no', { reason: words });
}

export function drawPopulationPanel(s: Surface, rect: Rect, ctx: PanelContext): void {
  if (!ctx.readers.has('21')) return;
  const immigration = ctx.readers.of<ImmigrationReader>('21');
  const col = rect.col + 1;
  const width = rect.cols - 2;
  const ids = dwarvesOf(ctx);
  const children = ids.filter((id) => (ctx.readers.entities.get(id, C.Creature)?.ageTicks ?? 0) < ADULT_AGE_YEARS * TICKS_PER_YEAR).length;
  const strings = ctx.strings;
  label(s, col, rect.row, strings.get('ui.population.dwarves', { n: ids.length, children }), { width });
  const cap = immigration.cap();
  const capRow = rect.row + 1;
  const capText = strings.get('ui.population.cap', { cap });
  label(s, col, capRow, capText, { fg: s.theme.value, width });
  for (const cell of keyCells(s, capText, { width })) {
    s.hit({ col: col + cell.from, row: capRow, cols: cell.cols, rows: 1 }, () => changePopulationCap(ctx, cell.key === '-' ? -POPULATION_CAP_STEP : POPULATION_CAP_STEP));
  }
  if (ctx.readers.has('15')) {
    const morale = ctx.readers.of<MoraleReader>('15');
    label(s, col, rect.row + 2, strings.get('ui.population.hall_spirit', { tier: moodTierName(strings, morale.hallSpiritTier()), value: Math.round(morale.hallSpirit()) }), { width });
  }
  const next = immigration.nextEvaluation();
  label(s, col, rect.row + 3, strings.get('ui.population.next', { season: seasonName(strings, next) }), { width });
  // Why no wave comes is the line's fact: it wraps under itself rather than being cut.
  let row = rect.row + 4;
  row += wrapLabel(s, col, row, eligibilityText(immigration.eligibility().reasons, strings), { width, indent: 2 });
  const last = immigration.lastWave();
  const lastText = last
    ? strings.get('ui.population.last_wave', { count: last.count, season: seasonName(strings, SEASON_NAMES[seasonOf(last.tick)] ?? ''), year: yearOf(last.tick) })
    : strings.get('ui.population.last_wave_none');
  label(s, col, row++, lastText, { width });
  label(s, col, row++, strings.get('ui.population.waves', { n: immigration.wavesSoFar() }), { width });
  const skip = immigration.lastSkipReason();
  if (skip) wrapLabel(s, col, row, strings.get('ui.population.last_skip', { reason: skip }), { fg: s.theme.dim, width, indent: 2 });
}
