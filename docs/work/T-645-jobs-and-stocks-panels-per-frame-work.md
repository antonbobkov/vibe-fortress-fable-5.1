# T-645 — Jobs and Stocks redo their whole lists every frame

**Source:** [T-640](../archive/tasks/T-640-long-lists-animals-jobs-requests.md), measured with `test/perf/t640_stocks_open.test.ts`; the [T-635 audit](../../reports/audits/2026-11-19-t635-midgame-ux.md) § Performance · **Size:** S · **Needs:** — · **Status:** open

## Why

The T-635 audit timed every panel at 130–160 ms to open at 80 dwarves (Jobs 155 ms). T-640 builds the Stocks tree once a tick instead of five times a frame (60–75 ms a frame down to 1–2 ms on the furniture fixture), but the first draw still takes 47–82 ms: it builds a row, with its name, age note and rot outlook, for each of the 25,000 stacks before any type is opened. The Jobs panel calls `JobsReader.list()`, which copies every job with its inputs, several times a frame (the rows, the filter, the selection), at 922 blocked jobs and more.

## What to do

Stocks: build a type's stack rows only when the type is opened or a filter is set, and keep the arrow that says it can be opened. Jobs: read the job list once a frame (or once a tick, as Stocks does) and pass it through. Measure with the T-640 probe and a like probe for Jobs on the furniture fixture, before and after.

Spec: none (no rule changes).

## Done

The probes' figures before and after in the commit body; the Stocks and Jobs panel tests unchanged.
