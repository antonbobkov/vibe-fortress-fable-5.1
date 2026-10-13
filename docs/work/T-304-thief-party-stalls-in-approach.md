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
