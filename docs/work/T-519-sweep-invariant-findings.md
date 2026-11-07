# T-519 — Three invariant findings in shifted sweeps of master

**Source:** T-513's [report](../../reports/audits/2026-11-06-t513-sweep-verdict.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

Twelve shifted sweeps of master `1a8f0ef4` (Measure run 42329994960, T-513's branch with only the shift input added, shifts 0 to 550 ticks) stopped three peril seeds on a T-176 invariant. Unshifted, the sweep had shown none. Each is a fault in the game or in the invariant, seen once in a timeline of its own:

- `three-years-p2-4`, shift 400, tick 205,200: `caravan.present-over-20d` (`caravan/toDepot`), a Hillfolk caravan of 12 that arrived on tick 180,000 is still walking to the depot 21 days later.
- `three-years-p4-4`, shift 150, tick 106,800: `caravan.present-over-20d` (`caravan/retreat`), a Wildwood caravan that arrived on tick 81,600, was repelled (9 of 14 left) and has been retreating since tick 106,552.
- `three-years-p4-4`, shift 400, tick 343,200: `container.no-work-tile`, a built chest at index 60510 holds 7 items with no tile beside it that a dwarf reaches.

Since T-513 a seed plays on after a finding and writes its figures, so the sweep's verdict still counts it; the seed's job fails at the end. On T-513's commit `c50712e6` each finding is reproduced by the seed's job alone: `THREE_YEARS_SHIFT=<shift> npx vitest run -c vitest.perf.config.ts test/perf/three_years_seeds.test.ts -t "'three-years-<seed>'"`.

T-512 (the three-year script's sowing) and T-517 (an attacked caravan leaves within a limit) were merged after this measurement. They move every timeline: shift 150 of master `ec0c9e03` (run 42347442263) shows no finding on `p4-4`, which says nothing about the fault. T-517's limit may cover the repelled caravan; the caravan walking to the depot and the chest are not about attacked caravans.

## What to do

- Study each fault on `c50712e6`, where the timelines that show it still play, then judge whether it can still happen on the master of the day.
- For each finding, find whether the game or the invariant is wrong (a caravan whose way to the depot is cut, a retreat that cannot reach the edge, a chest walled in by construction or a collapse), and fix it, with a test that reproduces it in a short world where possible.

## Done

- The three timelines play to the end with no invariant finding, or the invariant is corrected and says why.

## Found (probe: `reports/data/2026-11-07-t519-sweep.probe.ts.txt`, excerpts in `reports/data/2026-11-07-t519-probes.txt`)

Each finding replayed on master `5312b44d` at its shift (single seeds, locally), then studied on `c50712e6`.

- **`p2-4` at shift 400: still happens on master, a game fault.** On `c50712e6` (day 150) and on master (day 36, a different caravan) a Hillfolk caravan of twelve spreads along the north edge, and its twelfth member, a mule, arrives on edge tile (30, 0, 31), a pocket below the surface that walks nowhere. Eleven members stand at the depot within a tenth of a day; the walk waits for every member, so the caravan never unloads, never leaves, and holds back every civilization's next caravan. Fix: members arrive only on edge tiles from which a walker reaches a depot, or, with none reachable, the first edge tile (20 § Movement step 1). The replay on the fix plays to the end with no finding (16 living at year 3).
- **`p4-4` at shift 150: no longer happens; T-517 covers it.** The Wildwood caravan was at the depot on day 68, was attacked by a peril-4 raid on day 72.6, lost a merchant and went to `leave`. Every member then stood on the edge tile for sixteen days while its guards fought each other and the leave's clock restarted on each hit: T-517's brawl exactly. T-517's rules (a comrade's hit is not an attack; the leave departs `CARAVAN_LEAVE_DAYS` after the first attack) send it off by day 75. The finding's `caravan/retreat` was the threat system's casualty check relabelling the caravan's party (see Noticed). On master the same shift plays a new timeline, extinct on day 245, with no finding.
- **`p4-4` at shift 400: the invariant was wrong.** The chest at (30, 12, 26) stood in an open bedroom that never changed. At the daily check of tick 343,200 the fortress's last dwarf was at a surface carpenter's workshop, and the hearth alert (raised at tick 342,960 for a thief) had locked the gate: every dwarf outside, the halls out of reach. The script lifted the alert on that tick (T-363's rule) and the dwarf was back inside 300 ticks later. A locked gate with everyone outside is a state of the game, not a lost container. The check (T-331 3) is now a day-long condition, like T-331's other two: a container is lost only once it has been out of every dwarf's reach for more than a day. On master the same shift is extinct on day 270, before that moment.

## Noticed

- The threat system's casualty check (`checkPartyCasualties`) runs on a caravan's party too, and sets its `Party.state` to `retreat` and its outcome to `repelled` when enough members fall. The trade system ignores the label (its own state rules the caravan), so nothing moves differently, but the invariant line and any reader of the party see a "repelled" caravan.
