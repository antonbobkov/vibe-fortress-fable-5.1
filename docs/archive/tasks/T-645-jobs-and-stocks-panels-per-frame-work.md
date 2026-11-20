# T-645 — Jobs and Stocks redo their whole lists every frame

**Closed:** 2026-11-19, in 7340df7c.

**Source:** [T-640](T-640-long-lists-animals-jobs-requests.md), measured with `test/perf/t640_stocks_open.test.ts`; the [T-635 audit](../../../reports/audits/2026-11-19-t635-midgame-ux.md) § Performance · **Size:** S · **Needs:** — · **Status:** open

## Why

The T-635 audit timed every panel at 130–160 ms to open at 80 dwarves (Jobs 155 ms). T-640 builds the Stocks tree once a tick instead of five times a frame (60–75 ms a frame down to 1–2 ms on the furniture fixture), but the first draw still takes 47–82 ms: it builds a row, with its name, age note and rot outlook, for each of the 25,000 stacks before any type is opened. The Jobs panel calls `JobsReader.list()`, which copies every job with its inputs, several times a frame (the rows, the filter, the selection), at 922 blocked jobs and more.

## What to do

Stocks: build a type's stack rows only when the type is opened or a filter is set, and keep the arrow that says it can be opened. Jobs: read the job list once a frame (or once a tick, as Stocks does) and pass it through. Measure with the T-640 probe and a like probe for Jobs on the furniture fixture, before and after.

Spec: none (no rule changes).

## Done

The probes' figures before and after in the commit body; the Stocks and Jobs panel tests unchanged.

- [x] **Stocks**: a type's row carries its stack rows as a list built the first time it is read (`openable` on the tree node keeps the `▸` without building it); the selected row's name is looked up under open rows only. The per-tick totals work out each type's category path once per type rather than once per stack, and an item's value once rather than once per row above it. `test/perf/t640_stocks_open.test.ts` (25,000 items, three passes, two runs each, the owner's machine), master → branch: first draw 43–79 → 14–43 ms; of which the per-tick totals 30–32 → 10–22 ms and the draw after them 14–19 → 1–2 ms; the next frame 1–2 ms both; the type of most stacks (9,078) opened 5–7 → 9–14 ms (its rows are built then); a filter 26–38 → 27–45 ms (it reads every stack's name, as before).
- [x] **Jobs**: the draw reads the job list once (`jobs(ctx, all)`, `rows(ctx, jobs)`) and the filtered title once, where the draw read it twice and the title twice. `test/perf/t645_jobs_open.test.ts` (the furniture fixture with 1,000 buried tiles designated for digging: 1,043 jobs, 1,041 blocked), master → branch: list copies per panel draw 2 → 1, per screen with a filter 4 → 2; the panel draws in 1–2 ms warm (6–7 ms the first time) either way, so the list copies were not where the audit's 155 ms went on this fixture: the 1,041 blocked digs batch into one row.
- [x] The Stocks and Jobs panel tests pass unchanged (`test/unit/ui`, 1,132 tests), with the goldens and the keymap parity scenario.
