# T-416 — System 10 is over twice its budget since the 64-tile drink search

**Closed:** 2026-10-22, in cf2e39d.

**Source:** T-113, the gate of 2026-10-21 (`reports/gates/2026-10-21-gate.md`) and the per-system runs that followed it · **Size:** M · **Needs:** — · **Status:** open

## Why

`test/perf/per-system.test.ts` fails on master `b8633df`: system 10 (dwarves) averages **1.02 to 1.03 ms** a tick on the furniture fixture, against its 0.50 ms allocation and the test's 2× bound of 1.00 ms (four runs on a quiet machine). Bisected on the same fixture: 0.646 ms at `92171f3`, 1.023 ms at `057089c`, the commit of T-398 that raised `DRINK_SEARCH_RADIUS` from 32 to 64 tiles. Every commit measured before it reads 0.64 to 0.65 ms, every one after it 1.02 to 1.03.

The same commit doubles the worst tick: the furniture fixture's single-pass worst tick is 33 ms at `92171f3` and 83 ms at `057089c` (80 to 82 ms on `b8633df`). Three tests of the performance tier fail on `b8633df` for it: `per-system.test.ts` (system 10), `perf_reference.test.ts` (steady worst tick 72 ms against 40 on the furniture fixture) and `fl_perf.test.ts` (worst tick 97 ms against 40 on the reference fortress).

The water search in `src/systems/dwarves/activities.ts` scans every tile of a (2 × 64 + 1)² square on up to 17 levels until it finds water, about 280,000 tiles when a thirsty dwarf has none within reach, and a dwarf with no water retries every `NEED_RETRY_TICKS`. T-398's commit measured its own worst case at 2.0 → 4.1 s per 1,200 ticks; the average cost on the 80-dwarf fixture was not measured then.

## Decisions

1. The rule does not change: the same water tile, the same stand tile and the same tie order (10 § Eating and drinking), so that every world hash stays.
2. The search stops visiting tiles that cannot hold water: it skips a chunk (or a row band) whose water count is zero, from a count kept by 04 or computed once per `FluidsChanged`, and it remembers per dwarf that nothing was in reach until the fluids or the dwarf's level change.
3. Done when system 10 is back near 0.65 ms and the worst ticks under 40 ms on the furniture fixture and the reference fortress, and the golden hashes, the annual instrument's hashes and T-398's unit tests are unchanged.

## Done

- `per-system.test.ts`, `perf_reference.test.ts` and `fl_perf.test.ts` pass on a quiet machine; before and after timings in the commit body.

## As done

Decision 2 was met more simply than it describes: the search keeps its order and its pruning, and reads the fluid bytes of each row directly, four at a time through a 32-bit view of the same buffer, skipping a zero word (four tiles with no fluid) without looking further. No cache and no per-dwarf memory are needed, so nothing can go stale between a fluid write and a search. The choice is the least (distance, stand tile) over the same candidates, pinned against the old tile-by-tile scan by `test/unit/dwarves/t416-drink-search-scan.test.ts`.
