# T-399 — A hearth alert held for weeks starves a fortress that has no work inside the shelter

**Closed:** 2026-10-20, in 46aa7b5, 91b19e8.

**Source:** T-398, [the diagnosis](../../../reports/audits/2026-10-18-no-drink-deaths-diagnosis.md) § `wildlife-taiga-4` · **Size:** M · **Needs:** — · **Status:** open

## Why

In `wildlife-taiga-4` with the dry-north opening the annual instrument's harness raised the hearth alert on day 21 and held it 68,580 ticks (57 days; it lowers the alert only when no aggressive animal is within 40 tiles of the wagon). Under the alert a civilian is offered patient-care jobs and lever pulls only (11 § Assignment, 10 § Behavior selection step 2), so nobody farmed, cooked or brewed: no meal, no plant food and no harvest remained by day 48, hunger stood at 100, and eight dwarves starved on days 68 to 72 (thirst was served every time, at 86). The usual opening on the same seed never sheltered. A player faces the same shape: an animal that does not leave, a fortress that cannot work. The cave plots, the kitchen and the still of a fortress often lie inside the shelter.

## What to do

1. Decision: under a `hearth` alert, 11 also offers a sheltering civilian a job whose work tile, and for a hauling job its item tile and its destination, lie inside the civilian's shelter (the hall, or the indoor area around its retreat tile; `src/systems/dwarves/shelter.ts` already computes it for the want-level needs). Nothing outside the shelter is offered, so no dwarf walks out for work. The change is to 11 § Assignment (candidate jobs) and 10 § Behavior selection step 2, the sentence that says what the alert offers.
2. A failing stepped test first: a hall with a kitchen and an underground plot inside it, a sheltering civilian, a `hearth` alert held for ten days; today no meal is cooked and no crop is harvested, after the change both are, and a plot or workshop outside the shelter stays untouched.
3. Run the annual instrument before and after; the guarded figures may move for the better (alerts held long are the only ones that change), and the hashes of seeds that never shelter do not move.

## Done

- `wildlife-taiga-4` with the dry-north opening has food at day 70, or the report names the rule that still starves it; the instrument's bounds hold.
