# T-220 — In a third of forest and taiga years a hungry pack still kills several dwarves

**Source:** T-212 and [`2026-10-11-hungry-predators.md`](../../reports/audits/2026-10-11-hungry-predators.md) (§ A year with wolves only) · **Size:** M · **Needs:** T-136 (its instrument first), T-218 and T-219 (both done) · **Status:** open (diagnosis first)

## Why

`balance.md` § Wild animals intends that on a forest or taiga map at peril 0 a fortress that ignores wolves loses a few dwarves a year at most, and one that reacts (pasture behind a door, alert raised, squad sent) loses none. After T-212, the compact three-year fortress with only the game's own wolf arrivals, six seeds, one year: no dwarf lost to wolves in four seeds, but 7 and 5 in the other two when ignoring them, and 3 and 4 when reacting. On `t212-temperate_forest-2` a pack of four arrives on day 4, is hungry from day 7, and kills three to five dwarves in a week, before the fixture forms its squad on day 10; the reacting fortress then starves out by day 86. On `t212-taiga-1` the third pack of the year (day 86) kills 7 in two weeks; the reacting fortress loses 3, one of them a soldier.

## Reproduction

The year probe of the report ([source](../../reports/data/2026-10-11-t212-probe-year.test.ts.txt)) with `T212_ONLY=wolf`, seeds `t212-temperate_forest-2` and `t212-taiga-1`, both modes.

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

Do T-136 first and use its instrument for step 4. The latest figures to beat are in [the T-253 re-measure](../../reports/audits/2026-10-11-wildlife-after-t219.md): wolf-only years cost 13 dwarves when ignored and 10 when reacting over six seeds; all-species years 42 and 18, with 3 and 2 fortresses wiped out.
