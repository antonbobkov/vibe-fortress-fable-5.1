# T-140 — Dwarves walk too slowly for a day of needs

**Source:** T-123 and its report, [`../../reports/audits/2026-10-08-economy-at-default-priority.md`](../../reports/audits/2026-10-08-economy-at-default-priority.md) (§ Where the time goes, cause 1) · **Size:** M · **Needs:** T-144, T-145 · **Status:** open

## Why

A dwarf walks one tile in 10 ticks: 120 tiles in a day of 1,200 ticks. The needs table asks for about 4.3 errands a day (measured), each a walk of 10 to 25 tiles and back. At default priorities a dwarf spends 77% of its time on its own needs and 21% on work. The economy fortress then makes 4,925 marks in three years.

With the dwarf's `speed` at 200 instead of 100, and nothing else changed, the same fortress at default priorities made 17,242 marks in year 1 with a mood of 64. That overshoots the wealth model (4,000–8,000), and the fortress grew to 41 dwarves.

`balance.md` § Needs and consumption gives the need intervals. It does not count the walking between a dwarf's work and its food, drink, bed and hall.

## Decision

**Raise walking speed; leave the need rates alone.** The need rates fix food and drink per dwarf-day, which the farm and brewing model is built on. Speed is the one constant that model does not depend on.

- Change `speed` for **every** creature row by the same factor, so that no creature gains on another.
- First value: **×1.5** (dwarf 100 → 150). Measure. If year-1 wealth is below 4,000 or the daily mood mean is below 55, try ×1.75. Do not go above ×2.
- Add to `balance.md` § Needs and consumption the share of a dwarf's day that needs take, in use and in travel, as measured.

## What to do

1. Do T-141, T-142 and T-143 first, so that they do not bend the measurement.
2. Change the `speed` column of `03-content/creatures.md` and export.
3. Re-measure with the rewritten fixture (branch `f-17`) at default priorities, seed `three-years`: wealth by year, daily mood mean, food and drink per dwarf-day, trades, time shares. The instrument is `reports/data/2026-10-08-economy-at-default-priority-probe.ts.txt`.
4. Re-measure every acceptance test whose tick bound includes walking (`tr_dig_room`, the two-pick dig, raid arrival in `18`, caravan travel in `20`). Keep or tighten each bound and say which.
5. Write a new dated report. Update `balance-status.md`.

Spec touched: `03-content/creatures.md`; `03-content/balance.md` § Needs and consumption, and § Combat pace if a figure there depends on speed; `04-implementation/acceptance-tests.md` where a bound moves.

## Done

- At default priorities the fixture's work share is at least 35% of dwarf time and its daily mood mean is at least 55.
- Year-1 wealth is inside 4,000–8,000, or the report says why not.
- Goldens regenerated with a `golden:` paragraph; `npm run test:perf` passes.

## Progress, 2026-10-09

Measured and applied; the report is [`../../reports/audits/2026-10-09-walking-speed.md`](../../reports/audits/2026-10-09-walking-speed.md).

- **Done: every creature's `speed` is ×1.5** (dwarf 0.15). `creatures.md`, `balance.md` §§ Time and pace, Needs and consumption, and `22` § Tuning constants are amended. The world-hash golden is regenerated. No acceptance bound moved; each is listed in the report with its ticks before and after.
- **Holds: daily mood mean at least 55.** 57.6 with the rewritten fixture at default priorities, 56.5 with the old one, 61.7 on `three-years-p0-1`.
- **Holds, with the explanation: year-1 wealth.** 11,234, of which 6,420 is a stock of 107 lavish meals; 4,814 without them; 6,162 on `three-years-p0-1`.
- **Does not hold: work share at least 35%.** 22.7% in year 1, against 22.0% at ×1.0, 22.7% at ×1.75 and 23.3% at ×2. Walking speed does not move it: need errands take 74% of the time, 30 points of it in use. Re-measure after T-144.
- **Not run: `npm run test:perf`.** Only `per-system` and `perf_reference` were run, once. The tier's seed sweep cannot pass before T-145.

Found on the way and filed: T-188. The three-year scenario now simulates a fortress of 43 dwarves and takes several times as long; T-145 decides what it may cost in `npm test`.

Close this task when the work share has been re-measured after T-144 and the performance tier has passed.

