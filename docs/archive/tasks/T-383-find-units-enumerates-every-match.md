# T-383 — A craft job's unit search enumerates every matching item, one search at a time

**Closed:** 2026-10-18, in b6e0900, 740c658.

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

- The unit search costs what its answer needs, with the same ids and order (`t383-find-items-one-pass`). The reference fortress with its 25,000 loose items averages 17 ms a tick (72 before), system 11 costs 2.2 ms (63 to 67 before; the fortress with its items forbidden costs 1.7), and the worst tick fell from 42 s to 2.0 s, on a busy machine; `reference_fortress_figures.test.ts` holds system 11 to 10 ms and the worst tick to 10 s. The 2.0 s ticks are not this task's: they are system 16's re-equip pass on every `ItemCreated` and a pass of 13, filed as the row "Two kinds of slow tick remain in the reference fortress with its 25,000 items loose", which takes the target of 300 ms.
- The builder no longer forbids the items, and its comment says what the items do instead.
