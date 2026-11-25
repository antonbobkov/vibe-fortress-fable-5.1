export interface ImmigrationReader {
  cap(): number;
  wavesSoFar(): number;
  lastWave(): { tick: number; count: number } | null;
  eligibility(): { eligible: boolean; reasons: string[] };
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
