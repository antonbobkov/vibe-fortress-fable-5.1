export interface ImmigrationReader {
  cap(): number;
  wavesSoFar(): number;
  lastWave(): { tick: number; count: number } | null;
  eligibility(): { eligible: boolean; reasons: string[] };
  nextEvaluation(): string;
  lastSkipReason(): string | null;
}
