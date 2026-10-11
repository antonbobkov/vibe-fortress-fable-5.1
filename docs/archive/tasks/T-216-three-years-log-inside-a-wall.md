# T-216 — The performance tier's `three_years` stops on day 3: a log inside a wall

Closed by `T-216: walls clear loose items before sealing the ground`.

**Source:** T-144 and its re-measure, [`../../../reports/audits/2026-10-10-wants-without-errands-after-t196.md`](../../../reports/audits/2026-10-10-wants-without-errands-after-t196.md) (§ The long scenarios) · **Size:** S · **Needs:** — · **Status:** open; local side (the three-year files are T-156's)

## Why

`npx vitest run -c vitest.perf.config.ts test/perf/three_years_main.test.ts` fails after about 3 seconds, on `origin/master` (`4fbe72c`), on `cloud/main` (`a1ed087`) and on `cloud/T-144` (`38c59f6`) alike:

```
T-176 tick 3600: expected [ { inv: 'item.inside-wall', … } ] to deeply equal []
  "t3600: item 16777328 log at (33,9,32) flags=0"
```

The invariant checker (`test/scenarios/invariants.ts`, `item.inside-wall`) finds a log lying on a wall tile at tick 3600. The scenario's other assertions are never reached, so the three-year balance instrument of the performance tier measures nothing. `npm test` does not run it, so nothing else shows the failure.

## Reproduction

The command above, on any of the three commits. The probe runs of the T-144 re-measure play the same fixture without the invariant watch and pass; they are no evidence either way about the log.

## What the spec says

- `14` § Construction, `build` job completion: "Constructions that become walls check that no creature is on the tile (the job waits otherwise)." Nothing is said about a loose item on that tile, and no rule elsewhere in `13` or `14` was found that moves one. If a wall built over the log is the cause, the missing rule is the finding.
- The invariant checker treats an item on a wall tile as a fault (`item.inside-wall`).
- `testing-strategy.md` § The long scenarios: the main three-year scenario runs `checkInvariants` every 1,200 ticks.

## What to do

1. Find which event put the log on the wall tile at (33, 9, 32): a wall or building completed over it, a tree felled into it, or a dig that left it behind. A trace of the item's position and the tile's kind from tick 0 to 3600 is enough.
2. If the game left the item there against its rule, fix the game with a failing test first. If the fixture placed something it may not, fix the fixture (the three-year files are T-156's).
3. Run `three_years_main` to its end and record the result.

## Done

- `three_years_main` passes the tick-3600 check, and the result of the full run is recorded.

## Measurement and resolution (2026-10-11)

The unmodified main scenario creates oak log 16777328 at (33,9,32) on `TreeFelled` at tick 673. The item remains there until a wall completes over it at tick 2950; the first invariant watch that sees it is tick 3600. This is a game construction fault, not a fixture placement. The construction rule now clears loose items that remain after input consumption onto the lowest-index adjacent solid-bottomed walker-passable tile, preserving their metadata and contents. With no destination the build waits before consuming its inputs. No fixture changed.

Before the fix, `three_years_main` fails at tick 3600 on `item.inside-wall`. The complete invocation after the fix passes that check and continues to tick 37200, where it stops on `item.carrier-dead`: tunic 16777302, trousers 16777303 and boots 16777304 have `carriedBy=16777293`, which is no longer alive. That separate fault is filed as T-139; no assertion is removed or weakened. Five focused tests cover stepped clearance, containers and partial input stacks, waiting and retrying, fully consumed inputs and the creature guard, and solid ground versus open air.
