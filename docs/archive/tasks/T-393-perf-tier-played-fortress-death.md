# T-393 — The performance tier fails: a dwarf dies in the played fortress, and worst ticks pass 40 ms

**Closed:** 2026-10-18, in b069e88, 86d6016.

**Source:** T-140's check of the performance tier, 2026-10-18 at `88119f4` (and at `a9a21dd`, before T-383 to T-388 were merged) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-140 ran the tier's budget and behaviour files alone on a quiet machine (`npx vitest run -c vitest.perf.config.ts test/perf/perf_reference.test.ts test/perf/played_behavior.test.ts`). Three assertions fail, the same way at both commits:

| Test | Assertion | Measured |
|---|---|---|
| `played_behavior` | no dwarf dies in the 20-dwarf played fortress | 1 dwarf death (19 of 20 alive), 1 other creature |
| `perf_reference`, played fortress | worst tick ≤ 40 ms | 57.4 ms (55.1 ms at `a9a21dd`); average 0.96 ms |
| `perf_reference`, 80-dwarf furniture fixture | worst tick ≤ 40 ms | 115.4 ms; average 7.3 ms |

The death is deterministic (the played fortress is a fixed save); the worst ticks are single ticks and may be one slow system or a collection pause. `per-system`, `reference_fortress`, `perf_gen`, `fl_perf` and `fl_settle` pass.

## What to do

1. The death: run `played_behavior` with a journal of the death (tick, cause, killer, what the dwarf was doing) and bisect it to the commit that introduced it if the cause is not plain. A game fault gets a failing stepped test and a fix; a staging fault in the saved fortress gets a regenerated fixture with its reason.
2. The worst ticks: time each system on the slow ticks (as T-390 did for the loose-items fortress), run three times to separate a repeatable spike from noise, and fix the system or record the measured noise in `performance-budget.md`.

## Done

- `perf_reference` and `played_behavior` pass, or the budget document records why a bound changed.
