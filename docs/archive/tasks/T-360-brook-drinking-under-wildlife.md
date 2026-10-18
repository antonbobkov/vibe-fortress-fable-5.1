# T-360 — Measure brook drinking under wild animals

**Closed:** 2026-10-18, in 5bcea7b.

**Source:** T-350 and its review (2026-10-16) · **Size:** M · **Needs:** T-350 · **Status:** open

## Why

Since T-350 a dwarf drinks at a brook's bank when no barrel of drink on a stockpile is in reach (10 § Needs, drink search). Thirsty dwarves now walk out of the fortress, often 20 tiles or more, every day: in `pp_food` all seven dwarves walk to the bank on the map's west edge daily from day 9, and boars and a badger kill three of them on days 13 to 14; in the three-year fixture, whose drink stockpiles wanted no barrels, the founders drank at the brook instead of their brew, and eight dwarves bled out by day 47 ([the run's journal](../../../reports/data/2026-10-16-t145-run1.jsonl)).

The annual instrument does not see any of this: its twelve rows and hashes were identical before and after T-350, because no instrument seed ever falls back to water (its opening keeps drink in a stocked barrel). So what water costs a fortress under wild animals is unmeasured.

## What to do

1. Measure: run the instrument's twelve seeds once with an opening variant whose drink stockpile wants no barrels (or whose drink runs out by a fixed day), and record per seed the `DrankWater` count, where the dwarves drank, how far the bank was from the wagon, and the dwarf deaths by cause and place. Report it under `reports/audits/`.
2. Read the result against `balance.md` § Drink chain ("Water is the fallback") and § Wild animals, and decide whether a balance row or a hint needs to change (for example, whether the existing `hint_containers` hint should also say that dwarves without a barrel stockpile drink at the brook). A change to a rule or a constant becomes its own task.

## Done

- The report exists and `balance-status.md` has a row for brook drinking under wild animals.
