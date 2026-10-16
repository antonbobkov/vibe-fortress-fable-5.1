# T-343 — The workshops job producer visits every building every tick

**Source:** T-283 (building the reference fortress, [`../../test/perf/scripted-reference.ts`](../../test/perf/scripted-reference.ts)) · **Size:** M · **Needs:** — · **Status:** open (diagnosis first)

## Why

`performance-budget.md` gives system 12 a budget of 0.10 ms ("only active workshops"). On the reference fortress (600 buildings, 16 workshops, 12 standing orders, 25,000 items) the producer `workshops` costs about 30 ms per tick: 1,186 ms over 40 ticks, measured by wrapping `JobBoard.producers[].produce`, against 1,297 ms for the whole `JobBoard.tick` and 1,338 ms for system 11. `WorkshopOperator.produce` (`src/systems/workshops/operate.ts`, the loop `for (const id of entities.with(C.Building))`) calls `ensure(id)` and reads the workshop of every building, built or not, workshop or not, and for each workshop evaluates `problem(order, id)` for every order against the item reader, every tick.

## What to do

- Reproduce with a unit test on `buildScriptedReference()` (or a smaller world with 600 one-tile buildings and 16 workshops): time `produce` over 40 ticks.
- Keep a list of workshops (built, not suspended, with recipes) and visit only those; re-evaluate an order's problem when the stock it reads changes or at a cadence, not on every tick.
- Gates as for any simulation change, including the annual instrument; the job order must not change (hashes of the scenarios that play workshops stay equal, or the golden paragraph explains).

## Done

- `workshops` costs at most its allocation on the reference fortress, shown by the figures of `reference_fortress_figures.test.ts`.
