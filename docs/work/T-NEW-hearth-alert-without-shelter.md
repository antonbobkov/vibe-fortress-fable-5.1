# T-NEW — The Hearth alert with no shelter anywhere stops all work for nothing

**Source:** [T-618's first-year audit](../../reports/audits/2026-11-18-t618-first-year-ux.md), finding 12, after T-624 (which made the panel say so) · **Size:** M · **Needs:** — · **Status:** open

## Why

With no hearth hall, no indoor tile behind a door and no bedroom, 19 § Hearth alert retreat gives a civilian no retreat tile, so 10 § Behavior selection skips step 2 for it; but 11 § Assignment still offers a civilian under a `hearth` alert only patient care, lever pulls inside its shelter and work done wholly inside its shelter, and with no shelter that is nothing. So the alert stops every civilian's work and leaves them in the open at the wagon, where they are no safer than at work. T-624 made the military panel say so ("No shelter: 7 dwarves wait at the wagon, in the open …") and the activity read "Sheltering (no shelter)"; the rule itself is unchanged.

## What to do

1. **A civilian with no shelter works as under a `watchful` alert.** While 19 gives a civilian no retreat tile (10's `dwarves.unsheltered()`), 11 offers it every job it would be offered under `watchful`; the flee step and the remembered-threat avoidance of 10 step 1 still keep it from the beast. When a shelter appears (the watched ids are rechecked), the alert's job filter applies again and a job outside the shelter is interrupted as on the alert's change.
2. The panel line then reads "No shelter: 7 dwarves keep working …".

Spec: 11 § Assignment (the alert's job filter), 10 § Behavior selection step 2, 19 § Hearth alert retreat, `ui-screens/panels.md` § Military.

## Done

A unit test: a fortress with no shelter under the Hearth alert keeps digging, and stops when a hall with a hearth is made. This changes a simulation rule: the twenty-seed sweep and `defence_seeds` run on it.
