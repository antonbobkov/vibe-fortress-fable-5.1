# T-NEW — the peril-0 smelter's open steel jobs lose their iron bar to the forge

**Source:** T-817 (local `three_years_main` at 3bf4e2af, `three_years_steel` journal) · **Size:** M · **Needs:** — · **Status:** open

## Why

With T-817 the main fortress (`three-years-p0-3`) makes steel again, but one bar in year 3 (the pre-T-620 runs made 1 to 5): its 30-bar alloy order stands first from day 224 with 160 iron ore and 10 to 18 flux stones free, and the journal shows an `alloy_steel` job open on most weeks and a hematite job on the others, the order's count falling once. A job's inputs are reserved at the claim (11 § Assignment), and the smelter's one worker spends most of the day at its needs, so the forge's standing iron orders (picks, helms, battle axes, crafts) take each iron bar the smelter makes before the open steel job is claimed; the steel job then has no bar and gives way to the next iron smelt. The `alloy_steel > 0` witness passes on one bar.

## What to do

- Confirm the race from a journal of the smelter's job ids and their cancel reasons in year 3.
- Decide how the script's player keeps the iron for the steel at peril 0 (as the strong squad's T-616 rule does at perils 2 and 4: the forge's iron orders come off while steel is owed, or a small iron stock is kept back for the smelter), measure it with the sweep, and adopt it if the deaths hold.

## Done

- [ ] The race confirmed or ruled out.
- [ ] The main fortress makes steel with margin (several bars in year 3), or the reason it cannot is recorded.
