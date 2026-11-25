export interface ImmigrationReader {
  cap(): number;
  wavesSoFar(): number;
  lastWave(): { tick: number; count: number } | null;
  /**
   * Whether the evaluation to come (a deferred one, or the next season's), or the one of `at` (a season
   * index and a year), can bring a wave, why not, and whether it is one of Year 1's guaranteed waves.
   */
  eligibility(at?: { season: number; year: number }): { eligible: boolean; reasons: string[]; guaranteed: boolean };
  nextEvaluation(): string;
  lastSkipReason(): string | null;
  /** The fortress's wealth and what the next evaluation asks of it: `WEALTH_PER_WAVE × wavesSoFar`, or 0 for one of Year 1's guaranteed waves. */
  wealthBar(): WealthBar;
  /** The wealth and the bar at the last skip when it was for wealth; null otherwise, and for an older save. */
  lastSkipWealth(): WealthBar | null;
}

export interface WealthBar {
  wealth: number;
  need: number;
}
