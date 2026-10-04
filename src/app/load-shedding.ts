/** T-M8-02: wall-time policy lives in app; core/systems receive only the three switches. */
import { LOAD_SHEDDING_ENGAGE_MS, LOAD_SHEDDING_RATE_PERCENT, LOAD_SHEDDING_RECOVER_MS } from '@core/performance-constants';

export type SheddingRule = 1 | 2 | 3;

export class LoadShedding {
  private lowSince: number | null = null;
  private healthySince: number | null = null;
  private enabled = false;
  get active(): boolean { return this.enabled; }

  constructor(private readonly apply: (rule: SheddingRule, enabled: boolean) => void) {}

  observe(nowMs: number, actualRate: number, requestedRate: number): void {
    if (requestedRate <= 0) { this.interrupt(); return; }
    if (actualRate * 100 < requestedRate * LOAD_SHEDDING_RATE_PERCENT) {
      this.healthySince = null;
      this.lowSince ??= nowMs;
      if (!this.active && nowMs - this.lowSince >= LOAD_SHEDDING_ENGAGE_MS) {
        this.enabled = true;
        this.apply(1, true);
        this.apply(2, true);
        this.apply(3, true);
      }
    } else {
      this.lowSince = null;
      this.healthySince ??= nowMs;
      if (this.active && nowMs - this.healthySince >= LOAD_SHEDDING_RECOVER_MS) this.relax();
    }
  }

  /** Pauses, hidden tabs and requested-rate changes break continuous observation. */
  interrupt(): void { this.lowSince = null; this.healthySince = null; }

  /** A new or loaded world starts with normal budgets, independently of the old wall clock. */
  reset(): void { if (this.active) this.relax(); this.interrupt(); }

  private relax(): void {
    this.apply(3, false);
    this.apply(2, false);
    this.apply(1, false);
    this.enabled = false;
  }
}
