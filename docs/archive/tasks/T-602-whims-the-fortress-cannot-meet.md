# T-602 — The Thane wishes for what the fortress cannot make

**Closed:** 2026-11-18, in 0e82a55c.

**Source:** [T-588](T-588-fixture-makes-do.md) (the three-year script's Making Do strand; its reach probe, Measure run 44311051943, the twenty sweep seeds at shift 0) · **Size:** S · **Needs:** — · **Status:** open

## Why

With the three-year script answering the Thane's whims it can make (fine meals, spirits, mead from bought honey), 20 of 175 whims over twenty fortresses were met, and 14 fortresses thought `thane_pleased`. The rest were whims the fortress had no way to meet, and the draw counts them possible (10 § The Thane's whim: a built workshop has a recipe that makes the item):

- **Mead** (40 of 175, none met): the still makes mead from honey, and a temperate fortress with no hive and no honey bought cannot brew it. Most mead whims fall in the first year, before any caravan has brought honey.
- **A lantern in the dining hall** (20, none met): once a kiln stands, the lantern counts as possible, but it takes a glass block and a candle, and a temperate forest has no sand (T-583's audit). Before the strand built a kiln, no seed drew it.
- **A featherbed** (31, none met) and **a masterwork** (34, none met): possible with a carpenter or any quality workshop; neither is in reach of a three-year fortress that buys no feathers.

T-583's audit noted the first ("the Thane asks for mead where no bee has ever found a flower") and filed nothing. All face, no spiral: a missed whim costs only the Thane's grumble, so this is a question of flavour, not balance.

## What to do

Decide whether a whim's "possible" should also ask for its inputs: a recipe whose inputs are in stock (honey for mead; a glass block and a candle for a lantern), or that a workshop could make from what is in stock. Measure the draw on the twenty seeds before and after with the T-583 reach probe (`gh workflow run measure.yml --ref <branch> -f suite=making_do`). If the rule changes, it changes in 10 § The Thane's whim and `dwarves/whims.ts`, with a unit test.

## Done

A decision recorded in 10 § The Thane's whim, and, if the rule changes, the probe's whim counts before and after.
