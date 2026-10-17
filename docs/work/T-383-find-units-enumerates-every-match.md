# T-383 — A craft job's unit search enumerates every matching item, one search at a time

**Source:** T-344 (the reference fortress with its 25,000 items not forbidden) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-344 asked that the reference fortress's 25,000 loose items stop being forbidden in its builder, and for system 11 to cost at most its allocation then. With the items not forbidden (the builder's `ForbidItem` line removed, the fixture rebuilt), the fortress averaged 68 ms a tick over 2,000 ticks, and system 11 alone 57 ms, with worst ticks of 37 to 40 s about every 400 ticks. None of that was haul planning (system 13 cost 4.4 ms, and 0.86 ms after T-344, both measured with no other test process running; the average tick stayed at 68 and 71 ms, system 11 at 57 and 63 ms). It is the job board: wrapping `JobBoard` methods shows 34 s of one tick inside `reserveInputs` for a `craft` job whose input is one item type (3,125 loose logs lie on the map).

`reserveInputs` calls `items.findUnits` (`src/systems/jobs/items-adapter.ts`), which calls `findItem` again and again, each time with the ids found so far in `excludeIds`, until nothing is left, so that it can choose the largest stacks. That visits every matching item, and each search scans the candidates again (`matches` tests `excludeIds.includes(id)` on a growing array): the cost grows with the cube of the matching items. A played fortress with a few hundred loose logs would pay the same in proportion.

## What to do

- Make `findUnits` cost what its answer needs, with the same answer (same stacks, same order): for example one pass over the candidates in the order `findItem` would return them, or an `excludeIds` set in `findItem` as a first step, and measure each step.
- Keep the reservation and split behaviour as they are; the order of the fetches (`order` in the candidates) must not change.
- Then remove the `ForbidItem` line from `test/perf/scripted-reference.ts` (as T-344 intended), rebuild `test/fixtures/reference-fortress.deepholm`, and report the reference fortress's figures with the loose items in play. Their haul-planning cost is already fixed.
- Gates as for any simulation change, including the annual instrument and the perf tier.

## Done

- No tick of the reference fortress with its 25,000 loose items takes more than a few hundred milliseconds, and system 11 costs at most its allocation on average, shown by `reference_fortress_figures.test.ts`.
- The builder no longer forbids the items, and its comment says what the items do instead.
