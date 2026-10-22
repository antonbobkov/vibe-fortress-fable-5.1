# T-417 — Systems 08 and 18 run over their allocations

**Closed:** 2026-10-22, in 2ac3a80.

**Source:** T-113, the per-system timings of the gate of 2026-10-21 · **Size:** S · **Needs:** — · **Status:** open

## Why

The T-113 work file asked for system 08 (wild animals) to be measured on a quiet machine. On the furniture fixture it averages **0.72 to 0.73 ms** a tick in five runs (`92171f3` to `b8633df`), against a 0.40 ms allocation: inside the 2× bound of `per-system.test.ts`, and steady since wild animals spawn (T-192). System 18 (threats) averages **0.14 to 0.15 ms** against 0.10. The fixture's whole tick averages 4.25 to 4.31 ms against the 6 ms target, so the table, not the tick, is wrong.

## Decisions

1. The allocations follow the measurement, from the headroom of systems that run well under theirs, so that the table's total stays 5.85 ms: 08 from 0.40 to 0.80 and 18 from 0.10 to 0.20, taken from 04 fluids (1.50 to 1.25; it measures 1.02) and 22 pathing (1.00 to 0.75; it measures 0.43).
2. `docs/01-architecture/performance-budget.md` is the only change; the mitigation column keeps its text.

## Done

- The table holds the new figures with a link to the gate report, and `per-system.test.ts` passes for 08 and 18 within 1× of their allocation on a quiet machine.

## As done

The table's stated total was 5.85 ms, but its rows summed to 5.95 before this change and still do after it (the moves net to zero); the total cell now says 5.95. The allocations that `perf_reference.test.ts` and `fl_perf.test.ts` repeat, and the 2.5 ms fluids line of `acceptance-tests.md`, follow the table.
