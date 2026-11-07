# T-NEW — Three invariant findings in shifted sweeps of master

**Source:** T-513's [report](../../reports/audits/2026-11-06-t513-sweep-verdict.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

Twelve shifted sweeps of master `1a8f0ef4` (Measure run 42329994960, T-513's branch with only the shift input added, shifts 0 to 550 ticks) stopped three peril seeds on a T-176 invariant. Unshifted, the sweep had shown none. Each is a fault in the game or in the invariant, seen once in a timeline of its own:

- `three-years-p2-4`, shift 400, tick 205,200: `caravan.present-over-20d` (`caravan/toDepot`), a Hillfolk caravan of 12 that arrived on tick 180,000 is still walking to the depot 21 days later.
- `three-years-p4-4`, shift 150, tick 106,800: `caravan.present-over-20d` (`caravan/retreat`), a Wildwood caravan that arrived on tick 81,600, was repelled (9 of 14 left) and has been retreating since tick 106,552.
- `three-years-p4-4`, shift 400, tick 343,200: `container.no-work-tile`, a built chest at index 60510 holds 7 items with no tile beside it that a dwarf reaches.

Since T-513 a seed plays on after a finding and writes its figures, so the sweep's verdict still counts it; the seed's job fails at the end. Each finding is reproduced by the seed's job alone: `THREE_YEARS_SHIFT=<shift> npx vitest run -c vitest.perf.config.ts test/perf/three_years_seeds.test.ts -t "'three-years-<seed>'"`.

## What to do

- For each finding, find whether the game or the invariant is wrong (a caravan whose way to the depot is cut, a retreat that cannot reach the edge, a chest walled in by construction or a collapse), and fix it, with a test that reproduces it in a short world where possible.

## Done

- The three timelines play to the end with no invariant finding, or the invariant is corrected and says why.
