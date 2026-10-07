import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TICKS_PER_DAY } from '@core/constants';
import { earliestTickFromRow, type ThreatScheduleRow } from '@systems/threats/schedule';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const rows: ThreatScheduleRow[] = JSON.parse(
  readFileSync(join(root, 'src/content/threatSchedules.json'), 'utf8'),
) as ThreatScheduleRow[];

/**
 * Elapsed day (0-based, day 0 = start of year 1) before which a schedule row must not fire.
 * Source: docs/03-content/balance.md § Year-one expectation, day 56 row:
 * "at peril >= 2 the first ambush or raid warning". Balance.md gives no day for thieves,
 * bandits or sieges, so those kinds are not listed.
 */
const BALANCE_FIRST_DAY: Record<string, Record<number, number>> = {
  ambush: { 2: 56, 3: 56, 4: 56 },
  raid: { 2: 56, 3: 56, 4: 56 },
};

describe('T-125 threat schedule earliest days respect balance.md', () => {
  for (const [kind, byPeril] of Object.entries(BALANCE_FIRST_DAY)) {
    for (const [perilText, minDay] of Object.entries(byPeril)) {
      const peril = Number(perilText);
      it(`${kind} at peril ${peril} is not before day ${minDay}`, () => {
        const row = rows.find((r) => r.kind === kind && r.peril === peril);
        expect(row).toBeDefined();
        const tick = earliestTickFromRow(row!.earliest);
        // A disabled row (null earliest => -1) never fires early.
        if (tick < 0) return;
        expect(tick / TICKS_PER_DAY).toBeGreaterThanOrEqual(minDay);
      });
    }
  }

  it('peril 4 ambush and raid start at exactly day 56', () => {
    for (const kind of ['ambush', 'raid']) {
      const row = rows.find((r) => r.kind === kind && r.peril === 4);
      expect(earliestTickFromRow(row!.earliest) / TICKS_PER_DAY).toBe(56);
    }
  });
});
