# T-304 — A thief party stays in `approach` for four days

**Source:** T-145 and [`../../reports/audits/2026-10-12-economy-fixture-at-default-priority.md`](../../reports/audits/2026-10-12-economy-fixture-at-default-priority.md) (§ The sweep) · **Size:** S · **Needs:** — · **Status:** open (diagnosis first)

## Why

Seed `three-years-p2-5` of the 20-seed sweep at `ac88f56` stops on a T-176 party finding at tick 258,000 (day 215): party 117441017, Gloam thief, state `approach` since tick 253,200, arrived tick 253,200, members 1/1, size 1, loot 0, `goalUnreachable=false`, `walkUnreachable=false`, no outcome. The fortress had been extinct since day 112, so the thief has nobody to steal from and nothing ends its visit.

## Reproduction

`npm exec -- vitest run -c vitest.perf.config.ts test/perf/three_years_seeds.test.ts -t p2-5` at `ac88f56` (about four minutes).

## What the spec says

The party invariant of `test/scenarios/invariants.ts` (T-176) that reported it; `18` § Party AI for what ends a thief's visit.

## What to do

1. Find what the thief's goal is in a fortress with no dwarf and why neither `goalUnreachable` nor a timeout ends the approach.
2. Fix with a failing test first.

## Done

- The seed passes tick 258,000, or the invariant says why a thief may wait.

## Result, 2026-10-16 (closed: the Done item holds; the stall is not reproduced)

At `e0d36fa` the seed `three-years-p2-5` runs to day 220 (tick 264,000, past 258,000) with no T-176 finding ([data](../../reports/data/2026-10-16-peril-2-4-invariant-probe.txt)). The fortress no longer goes extinct (7 living on day 220, extinct by day 112 at `ac88f56`), so the state of the report, a thief in an empty fortress, does not arise. A unit probe of that state (all dwarves dead, a thief arriving with a log on the ground and a cat, or with nothing to take) did not stall either: with nothing to take the party waits `THIEF_WAIT_DAYS` and withdraws, and with a log or an animal it steals and leaves within half a day. The cause of the original stall was not established; a stall in `approach` with a live goal remains caught by the party invariant if it comes back.
