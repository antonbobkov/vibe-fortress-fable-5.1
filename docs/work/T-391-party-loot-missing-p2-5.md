# T-391 — A raid party's loot item is not alive at tick 286,800 of seed p2-5

**Source:** T-370 (2026-10-18): the peril-2 sweep seed `three-years-p2-5` stops on the T-176 invariant `party.loot-missing` at tick 286,800 (day 239) with a raid party `raid/loiter`: "party 251658433 loot 318768027 not alive". The same finding, at the same tick, on `master` without T-370 and T-382 (checked at the T-383 merge), so neither task causes it; the sweeps of 2026-10-17 did not stop here, so one of the changes since (T-383 to T-388, T-390) may have moved the run into it · **Size:** S · **Needs:** — · **Status:** open

## Why

A raid party lists a loot item (something it stole or carries) that no longer exists, while the party loiters. Either the item was destroyed (burned, eaten, melted) while the party held it and the party did not drop it from its list, or the list is wrong from the start.

## What to do

1. Diagnosis first: rerun the seed to tick 286,800 with a probe that logs the item's creation, holder and destruction (`ItemCreated`, `ItemDestroyed` with its reason) and the party's loot list over the last day.
2. Name the cause; a failing stepped test with the same shape (a party holding loot that is destroyed), the fix in 18 (the party forgets or replaces destroyed loot), the spec section.
3. If the checker is wrong (a loot list that may name a destroyed item for a tick), say why in testing-strategy.md.

## Done

- `p2-5` plays past tick 286,800 with no `party.loot-missing`; gates as for a behaviour change.
