/** `ui-screens/panels.md` § Population and `21-immigration.md` § Reader. */
import { seasonOf, SEASON_NAMES, yearOf } from '@core/calendar';
import { C } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import type { Rect } from '@render/cellbuffer';
import type { ImmigrationReader } from '@systems/immigration/reader';
import type { MoraleReader } from '@systems/morale';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import type { Surface } from '../surface';
import { keyCells, label } from '../widgets';
import type { PanelContext } from './context';
import { MOOD_TIER_NAMES } from './mood';
import { dwarvesOf } from './units';

export const POPULATION_CAP_STEP = 1;

export function changePopulationCap(ctx: PanelContext, delta: number): void {
  if (!ctx.readers.has('21')) return;
  const cap = ctx.readers.of<ImmigrationReader>('21').cap();
  ctx.submit({ type: 'SetPopulationCap', n: cap + delta });
}

export function eligibilityText(reasons: readonly string[]): string {
  const reason = reasons[0];
  if (!reason) return 'Eligible: yes';
  if (reason === 'cap') return 'Immigration paused by cap';
  if (reason === 'spirit') return 'Eligible: no · hall spirit below Content';
  if (reason === 'wealth') return 'Eligible: no · wealth too low';
  if (reason === 'winter') return 'Eligible: no · winter pass closed';
  if (reason === 'raid') return 'Eligible: no · raid underway';
  if (reason === 'no_population') return 'Eligible: no · hall is empty';
  return `Eligible: no · ${reason}`;
}

export function drawPopulationPanel(s: Surface, rect: Rect, ctx: PanelContext): void {
  if (!ctx.readers.has('21')) return;
  const immigration = ctx.readers.of<ImmigrationReader>('21');
  const col = rect.col + 1;
  const width = rect.cols - 2;
  const ids = dwarvesOf(ctx);
  const children = ids.filter((id) => (ctx.readers.entities.get(id, C.Creature)?.ageTicks ?? 0) < ADULT_AGE_YEARS * TICKS_PER_YEAR).length;
  label(s, col, rect.row, `${ids.length} dwarves (${children} children)`, { width });
  const cap = immigration.cap();
  const capRow = rect.row + 1;
  const capText = `Cap [-] ${cap} [+]`;
  label(s, col, capRow, capText, { fg: s.theme.value, width });
  for (const cell of keyCells(s, capText, { width })) {
    s.hit({ col: col + cell.from, row: capRow, cols: cell.cols, rows: 1 }, () => changePopulationCap(ctx, cell.key === '-' ? -POPULATION_CAP_STEP : POPULATION_CAP_STEP));
  }
  if (ctx.readers.has('15')) {
    const morale = ctx.readers.of<MoraleReader>('15');
    label(s, col, rect.row + 2, `Hall spirit: ${MOOD_TIER_NAMES[morale.hallSpiritTier()]} (${morale.hallSpirit()})`, { width });
  }
  const next = immigration.nextEvaluation();
  label(s, col, rect.row + 3, `Next evaluation: ${next.charAt(0).toUpperCase()}${next.slice(1)}`, { width });
  label(s, col, rect.row + 4, eligibilityText(immigration.eligibility().reasons), { width });
  const last = immigration.lastWave();
  const season = last ? SEASON_NAMES[seasonOf(last.tick)] : null;
  label(s, col, rect.row + 5, last ? `Last wave: ${last.count} in ${season?.charAt(0).toUpperCase()}${season?.slice(1)}, Year ${yearOf(last.tick)}` : 'Last wave: none', { width });
  label(s, col, rect.row + 6, `Waves so far: ${immigration.wavesSoFar()}`, { width });
  const skip = immigration.lastSkipReason();
  if (skip) label(s, col, rect.row + 7, `Last skip: ${skip}`, { fg: s.theme.dim, width });
}
