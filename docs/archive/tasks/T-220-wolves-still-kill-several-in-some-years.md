# T-220 — In a third of forest and taiga years a hungry pack still kills several dwarves

Closed by `T-220: a fed pack drops its hunting quarry`.

**Source:** T-212 and [`2026-10-11-hungry-predators.md`](../../../reports/audits/2026-10-11-hungry-predators.md) (§ A year with wolves only) · **Size:** M · **Needs:** T-136 (its instrument first), T-218 and T-219 (both done) · **Status:** open (diagnosis first)

## Why

`balance.md` § Wild animals intends that on a forest or taiga map at peril 0 a fortress that ignores wolves loses a few dwarves a year at most, and one that reacts (pasture behind a door, alert raised, squad sent) loses none. After T-212, the compact three-year fortress with only the game's own wolf arrivals, six seeds, one year: no dwarf lost to wolves in four seeds, but 7 and 5 in the other two when ignoring them, and 3 and 4 when reacting. On `t212-temperate_forest-2` a pack of four arrives on day 4, is hungry from day 7, and kills three to five dwarves in a week, before the fixture forms its squad on day 10; the reacting fortress then starves out by day 86. On `t212-taiga-1` the third pack of the year (day 86) kills 7 in two weeks; the reacting fortress loses 3, one of them a soldier.

## Reproduction

The year probe of the report ([source](../../../reports/data/2026-10-11-t212-probe-year.test.ts.txt)) with `T212_ONLY=wolf`, seeds `t212-temperate_forest-2` and `t212-taiga-1`, both modes.

## What the spec says

`08` § Wild behavior (hunger, the quarry, a pack); `10` § Behavior selection (flee, the caught civilian); `16` § Squads and § Alerts; `balance.md` § Wild animals.

## What to do

1. Trace each death in the two seeds: where the dwarf was (job, need, haul), whether it fled and was caught, what it held, how far the nearest door was, where the squad and the dogs were.
2. Find why four seeds never lose a dwarf and two lose several: where the pack's hunger falls relative to the surface work.
3. Classify each link (code fault, missing rule, fixture, balance number). A fixture that forms its squad after the first pack is hungry, or arms it with nothing, is not the "reacting fortress" of the target; say what a reacting player does in the first week and measure that.
4. Re-measure the six seeds with a dated report and update `balance.md` § Wild animals and `balance-status.md`.

## Done

- Each link is classified with evidence in a dated report.
- The wolf figures of `balance.md` § Wild animals hold over the six seeds, or `balance.md` says what holds instead.

## Note (2026-10-11, orchestrator)

Do T-136 first and use its instrument for step 4. The latest figures to beat are in [the T-253 re-measure](../../../reports/audits/2026-10-11-wildlife-after-t219.md): wolf-only years cost 13 dwarves when ignored and 10 when reacting over six seeds; all-species years 42 and 18, with 3 and 2 fortresses wiped out.

## Progress (2026-10-11, codex-a)

Reproduced both original seeds in both modes on `182d2fd`. Forest seed 2 loses
five dwarves to wolves when ignored and twelve when reacting (plus one
starvation-labelled death in either mode); taiga seed 1 loses eight and five.
The forest response has no squad before day 10 and no built door at its first
five deaths. Taiga has no built door at any recorded death; its squad members
are unarmed during the first late attack. Exact victim activities, weapons,
needs, wounds, nearest doors, squad positions and dogs are recorded.

A separate small regression exposed an actual rule mismatch: a pack's kill
sets `hungry=false` but leaves a living quarry targeted by another pack member
in `hunt` or a hunting `attack`. The next think can turn the latter into a
territorial defence. Two cases failed before the patch, while the genuine
previously defending attack control passed. The patch clears only newly fed
hunters' targets and pursuit paths. Re-measurement distinguishes this verified
fault from the causes of the measured deaths; it must not be credited with
preventing a death unless the run changes.

A separate command-only player comparison requests clubs and a mined shelter
at the start and begins checking alerts immediately. It records actual squad,
club and door readiness, without changing farms, food quantities, the browser
year or either economy fixture. The first seed's clubs are ready at tick 10841
and its door at 11601 (day 10), so requesting them in week one is not counted
as already having a completed first-week defence.
