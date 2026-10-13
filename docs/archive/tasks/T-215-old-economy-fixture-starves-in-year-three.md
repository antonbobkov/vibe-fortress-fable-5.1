# T-215 — The old economy fixture runs out of food in year 3

> **Closed 2026-10-12 (orchestrator), folded into T-145.** The cause is the script: one kitchen and a farm that did not follow the population ([report](../../../reports/audits/2026-10-12-economy-fixture-at-default-priority.md)). The rebuilt fixture still starves past about 40 dwarves in four sweep seeds; that gap is named in the T-145 work file and is done there.

**Source:** T-144 and its re-measure, [`../../reports/audits/2026-10-10-wants-without-errands-after-t196.md`](../../../reports/audits/2026-10-10-wants-without-errands-after-t196.md) (§ Three years, old fixture) · **Size:** M · **Needs:** — · **Status:** open

## Why

With no wild arrivals, the old three-year fixture (`test/scenarios/three_years_fortress.ts`, urgent priorities, seed `three-years`) on `cloud/T-144` has no meal and no drink in stock on day 224, a fortress mood mean of 25.7 that day and 21.0 on day 253, and four dwarves starve on days 251–255. On `cloud/main` (before T-144) the same fixture loses nobody, but its dwarves are over the critical hunger mark 13.4% of year 3 (16.6% on `cloud/T-144`) and its mood mean falls to 21.8 on day 332. One run each; the two runs' populations differ from the autumn of year 2. So the fixture's food in year 3 is short with either code, and whether T-144 or T-197 made it worse is not established.

This fixture is the one the performance tier's `three_years` plays, and its mood-floor and no-spiral assertions read the same fortress.

## Reproduction

The probe [`2026-10-10-wants-without-errands-probe.ts.txt`](../../../reports/data/2026-10-10-wants-without-errands-probe.ts.txt) in `.probe/old/` with `T144_NOWILD=1`, as the report's Method describes; runs `old-nowild-cloud` and `old-nowild-main`. The daily stock snapshots in the probe output show the meal and drink counts.

## What the spec says

- `balance.md` § Needs and consumption: 0.48 food and 0.77 drink per dwarf-day. The fixture eats 0.33 and drinks 0.47–0.59.
- `balance.md` § Mood floor and the no-spiral guarantee: a needs-met fortress avoids a misery spiral.
- `testing-strategy.md` § The long scenarios: the fixture plays as a player could; it is a balance instrument.

## What to do

1. From the daily stocks and orders of both runs, find when the kitchen and the still stop keeping up in year 2–3 and why (inputs, workers, orders, the population jump from immigration).
2. Decide whether it is the fixture's script (no order scaled to the population) or the game. A fixture fix goes to whoever then owns `three_years_fortress.ts` (T-156 or T-145); a game fault gets a failing test first.
3. Run the perf-tier `three_years` once on the result.

## Done

- The cause is named with evidence in the work file or a dated report.
- The old fixture's year 3 has no starvation death with no wild arrivals, or the reason it may is written down.
