# Measurement: is "a party repelled or wiped" in `defence_year` noise?

**Task:** T-462 · **Date:** 2026-11-01 · **Commits examined:** `44d0462` (T-460), `a4fe892` (T-462), `38f7404` (T-463 on T-462) · **Kind:** noise of a scenario assertion

## The answer

- **The assertion was a coin flip on one seed.** A party ended `repelled` in 8 of 12 measured runs: 4 of 4 at T-460, 1 of 4 at T-462, 3 of 4 at T-463. None ended `wiped`.
- **It does not say what it seemed to say.** In the four runs with party detail, every announced party with more than one member, the 3 bandits and the raid of 9 or 10, ended `looted`. Each `repelled` there came from a party with no `RaidArrived` announcement, so it was not the corridor turning back a raid.
- **So this is a finding, not noise to bound with a set rule.** The result does not meet "most seeds at both states", and 1 of 4 at T-462 gives no useful N. The scenario now prints the outcomes and keeps its other assertions, including a soldier's kill, which held in all 12 runs. [Its own task](../../docs/archive/tasks/T-466-defence-never-repels-a-raid.md) asks why.
- **Three runs stopped on a fault in the script, now fixed.** The defence's own zones took dug pantry tiles before the pantry was zoned, so the pantry's zone was refused. The pantry now takes the tiles left: `defence-year-3` at T-460 and T-462, and `defence-year` at T-463. So a single seed's run could also fail for this reason on any timeline.

## Rows

One process, in sequence, with the scenario's own script. Five seeds per state, of which the rows below finished. "Soldier kills" counts hostile kills by squad members. `raiders dead` counts creatures of a hostile faction outside the caverns.

| State | Seed | Parties announced | Withdrew | Looted | Repelled | Raiders dead | Soldier kills | Dwarf deaths |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| T-460 | `defence-year` | 7 | 4 | 3 | 2 | 4 | 2 | 1 |
| T-460 | `defence-year-2` | 6 | 4 | 3 | 1 | 5 | 2 | 5 |
| T-460 | `defence-year-4` | 7 | 4 | 4 | 1 | 4 | 4 | 2 |
| T-460 | `defence-year-5` | 7 | 5 | 3 | 1 | 4 | 2 | 2 |
| T-462 | `defence-year` | 6 | 4 | 4 | 0 | 4 | 1 | 1 |
| T-462 | `defence-year-2` | 7 | 5 | 4 | 0 | 3 | 2 | 0 |
| T-462 | `defence-year-4` | 7 | 4 | 4 | 1 | 4 | 4 | 2 |
| T-462 | `defence-year-5` | 7 | 5 | 4 | 0 | 1 | 1 | 1 |
| T-463 | `defence-year-2` | 7 | 5 | 3 | 1 | 4 | 2 | 2 |
| T-463 | `defence-year-4` | 7 | 4 | 4 | 1 | 4 | 3 | 3 |
| T-463 | `defence-year-5` | 7 | 6 | 3 | 0 | 1 | 1 | 2 |
| T-463 | `defence-year-6` | 7 | 5 | 2 | 2 | 4 | 2 | 8 |

Outcomes can add up to more than the parties announced, because some parties end without a `RaidArrived`.

`defence-year-4` has the lever trial at `none` in all three states: the script never finished it on that seed, which the scenario would fail on. The other seeds finished it.

## Party detail, T-463

| Seed | Bandits (3) | Raid | Thieves | Parties with no announcement |
|---|---|---|---|---|
| `defence-year-2` | looted | 10, looted | 5 withdrew | looted, repelled |
| `defence-year-4` | looted | 9, looted | 4 withdrew, 1 looted | repelled, looted |
| `defence-year-5` | looted | 9, looted | 5 withdrew | looted, withdrew |
| `defence-year-6` | looted | 10, looted | 5 withdrew | repelled, repelled |

The T-460 and T-462 runs recorded no party detail, so these four runs are the only evidence on which party was repelled. They do not show that a raid can never be repelled at the earlier commits.

## Reproduce

[Probe](../data/2026-11-01-t462-defence-noise.probe.ts.txt), [rows](../data/2026-11-01-t462-defence-noise.jsonl). Copy the probe to `test/perf/defence_probe.test.ts`, have `playDefenceYear` take its world seed from `DEFENCE_SEED`, and run it with `vitest.perf.config.ts`. It takes about 16 minutes per state.
