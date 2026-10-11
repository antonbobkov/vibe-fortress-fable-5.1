/** T-136: distributions include extinct fortresses and distinguish livestock losses. */
import type { WildlifeYear } from './wildlife_year_fixture';

export function distribution(years: readonly Pick<WildlifeYear, 'living' | 'deaths'>[]): {
  median: number; worst: number; wildlifeFree: number; seeds: number; extinct: number; hungerThirstDeaths: number;
} {
  const living = years.map((row) => row.living).sort((a, b) => a - b);
  if (living.length === 0) throw new Error('A wildlife distribution needs at least one year');
  const middle = Math.floor(living.length / 2);
  return {
    median: living.length % 2 === 0 ? (living[middle - 1]! + living[middle]!) / 2 : living[middle]!,
    worst: living[0]!,
    wildlifeFree: years.filter((row) => !row.deaths.some((death) => death.kind === 'dwarf' && death.wildlife)).length,
    seeds: years.length,
    extinct: years.filter((row) => row.living === 0).length,
    hungerThirstDeaths: years.flatMap((row) => row.deaths).filter((death) =>
      death.kind === 'dwarf' && ['starvation', 'dehydration'].includes(death.cause)).length,
  };
}
