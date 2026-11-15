# T-571 — Fortresses grow slower since Making Do: attribute it, then fix or accept

**Source:** the orchestrator, 2026-11-15, from [T-567](../archive/tasks/T-567-fixture-picks-and-chairs.md)'s runs ([data](../../reports/data/2026-11-15-t567-sweeps.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

The pooled three-year sweep's `living` has fallen across the Making Do merges, while deaths fell too: reference 1024.25 (T-544, with T-545); then about 966 after T-548 (plants), 955 after T-551 (beds), 937.5 after T-552, and 922 on master f5c91764. The bound is 898.25. T-567 found no script fault behind it: its fixes left living unchanged, and switching T-548's conversions off did not bring it back. The drop is spread across every seed and peril. Peril-0 fortresses, which have almost no deaths, went from 456 living to 444 after T-548, and to 428 on master. So fortresses **grow** slower: fewer arrivals or births, not more deaths.

## What to do

1. Attribute the drop by merge (T-547, T-548, T-551, T-552, and anything else since T-544) and by cause: immigration waves and their size, births, the wealth and renown that drive migrants, working time, and food. The sweep logs and per-seed artifacts hold most of it; rerun a sweep on a base commit where that is needed. Look first at what T-551 changed: floor sleep at 50%, which means longer sleeps before beds exist, and the dwarves who wake to eat. Then look at anything that lowers wealth or slows early building.
2. If one cause is a rule that is wrong, or a script that plays worse than a sensible player would (for example, never laying pallets when there are no beds yet), fix it with a test.
3. If the new level is the honest cost of the new rules, write a dated report under `reports/audits/` and refresh `SWEEP_REFERENCE` and `SWEEP_MEASURED` the T-543 way (an eight-shift measurement), in its own commit.

## Done

- A report names where the living went, merge by merge. Either a fix brings it back toward the reference, or the reference is refreshed with that evidence. The sweep and instrument verdicts pass.
