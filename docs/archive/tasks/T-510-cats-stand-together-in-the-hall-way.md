# T-510 — Cats stand together on one tile of the hall's walking line

**Closed:** 2026-11-07, in e2d8a575.

**Source:** T-508's three-year probe of `three-years-p0-6` ([report](../../../reports/audits/2026-11-05-t508-idle-dwarves-by-the-hearth.md#the-crowd-watch), [output](../../../reports/data/2026-11-05-t508-probe-p0-6.txt)) · **Size:** S · **Needs:** — · **Status:** open (probe first)

## Why

With idle dwarves gathered round the hearth (T-508), the hall tiles that still stay crowded for a day or more on `p0-6` are crowded by cats. Of the 20 stretches of 1,200 ticks or more in its three years, 16 are on tile 60368, on the hall's west column where everyone walks in, and nearly every one has two or three cats standing there with passers-by stepping through; at days 334, 683 and 822 the tile holds three cats and nothing else. The longest stretch is 2,400 ticks. The sweep's only hall tile crowded for more than a day (`p0-6`, 2,120 ticks) is likely this one.

Cats are not in the pets' heap while four dogs fill it, and T-463's spreading rule should move a second idle tame animal off a shared tile. The likely cause, not yet confirmed: these are cats that adopted a dwarf (08 § Tame behavior, "a pet follows its dwarf loosely, within 5 tiles"), so the spreading rule, which is for animals with no owner, does not apply, and the follow rule gives every cat the same tile near the way in.

## What to do

1. Probe `p0-6` around day 334 (tick 400,800): for each cat on 60368, its owner, its `Tame` state, its walk target and the rule of `thinkTame` that chose its tile.
2. Fix it the plain way: a pet that follows its dwarf loosely and stops in or beside the hall takes its tile by T-463's spreading rule (or joins the heap), with a failing test first; put the rule in 08 § Tame behavior.

## Done

- No hall tile crowded for more than a day in the twenty-seed file; the instrument passes by the T-308 rule.
