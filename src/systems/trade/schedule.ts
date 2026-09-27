import { DAYS_PER_SEASON, DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import type { RngStream } from '@core/rng';
import type { Civ } from '@core/types';
import { CARAVAN_BAN_REP, CARAVAN_DAY_MAX, CARAVAN_DAY_MIN, WEATHER_SKIP_PERMILLE } from './constants';

export const TRADE_CIVS: readonly Civ[] = ['hillfolk', 'wildwood', 'mountainhome'];
export const CARAVAN_SEASON: Readonly<Record<string, number>> = { hillfolk: 1, wildwood: 2, mountainhome: 0 };

export interface CaravanSchedule {
  nextArrivalTick: number;
  banUntilYear: number;
}

export function arrivalTick(civ: Civ, year: number, rng: RngStream): number {
  const season = CARAVAN_SEASON[civ] ?? 0;
  return ((year - 1) * DAYS_PER_YEAR + season * DAYS_PER_SEASON + rng.int(CARAVAN_DAY_MIN, CARAVAN_DAY_MAX) - 1) * TICKS_PER_DAY;
}

export function initialSchedule(rng: RngStream): Record<string, CaravanSchedule> {
  return {
    hillfolk: { nextArrivalTick: arrivalTick('hillfolk', 1, rng), banUntilYear: 0 },
    wildwood: { nextArrivalTick: arrivalTick('wildwood', 1, rng), banUntilYear: 0 },
    mountainhome: { nextArrivalTick: arrivalTick('mountainhome', 2, rng), banUntilYear: 0 },
  };
}

export function skipCaravan(reputation: number, year: number, banUntilYear: number, temper: number, rng: RngStream): boolean {
  return reputation <= CARAVAN_BAN_REP || year <= banUntilYear || (temper === 4 && rng.chance(WEATHER_SKIP_PERMILLE));
}
