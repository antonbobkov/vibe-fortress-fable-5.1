# T-507 — The three-year fortress can outgrow its food at peril 0

**Source:** T-482's twenty-seed run on `bba82dfc` ([report](../../reports/audits/2026-11-05-t482-pets-heap.md#the-sweep), [seeds](../../reports/data/2026-11-05-t482-sweep.json)) · **Size:** M · **Needs:** — · **Status:** open (measurement first)

## Why

In T-482's sweep, `three-years-p0-3` grows to 67 dwarves by day 308 and starves 23 of them between days 316 and 336. Its progress lines show the food running out twice before that: meals 759 at day 196, 231 at day 224, **0 at day 252**, 221 at day 280, **0 at day 308**, with plant food at 0 to 8 from day 224. Wealth falls from 50,516 to 12,888 while the meals are eaten.

T-482 did not cause this directly: it moves every peril-0 timeline from day 20 (the hall is no longer slowed by a pile of animals), and peril-0 fortresses end with 427 dwarves against 389. The same code one tick later does not starve on that seed (53 living at day 340). So the fixture's food has a margin that a faster-growing fortress can cross: the set rule "0/7 peril-0 seeds with need deaths" can fail on a lucky, fast timeline.

## What to do

1. Journal `three-years-p0-3` on `bba82dfc` from day 180 to day 336: farm plots and their yield, cooks and brewers at work, immigrant waves, meals and drink made and eaten per day.
2. Name the cause: the fixture's farm plan not growing with the population (a fault in `three_years_fortress.ts`'s script, with a failing check) or a balance margin (to the orchestrator with the rows).

## Done

- A report with the journal and the cause; a fix, if any, measured by the twenty-seed file's set rule.
