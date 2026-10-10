# Wild-animal activation and the affected single-rule scenarios

Measured from `f9724ef` with the seasonal caller correction from `bc30b80` applied.
The correction passes the season of the year to species lookup; the original
calendar year starts at 1, so its absolute season number never matches 0 to 3.
Gemini's second-year regression fails with the original expression (zero spawn
events after 30 days), and passes with the correction. Permanent coverage now
checks both years and all four seasons.

## Spawning and movement against system 08

[Measurements](../data/2026-10-09-t192-wild-animals.json) include 24 ten-day runs:
years 1 and 2, all seasons, and temperate grassland, taiga and glacier. There were
40 individual arrivals, at most six in one day. Every arrival belonged to its
biome's current-season list; taiga's elk were eligible only in autumn/winter.
Glacier produced none. Daily counts and each arrival's count stayed within the
species cap and `MAX_CREATURES`. Each group started on an outdoor edge tile;
additional members occupied nearby passable outdoor tiles. All 40 individuals
were passable and at least 25 planar tiles from the current dwarf. No placement,
eligibility or cap fault was observed in these runs. Spawn attempts happen at
`DayPassed`, as the current spec says, rather than the stale dawn quotation in
the original work file.

Wild grass seeking does not exclude pasture zones. System 08's Wild behavior
explicitly makes grazers seek and consume grass; the Tame feeding paragraph's
condition is for tame animals. A pasture zone alone supplies no fence. The
scenario trace directly records wild rabbits and a deer grazing pasture tiles.

In a separate 30-day synthetic room control, natural arrivals entered an open
room that contained a bed and pasture. Three rabbits first entered at ticks
30,675, 34,622 and 35,339, leaving 190 of 225 grass tiles. The otherwise identical
sealed room had no wild entry and retained all 225 grass tiles. Open/closed runs
had 19/28 natural arrivals. Ordinary passability governs wandering into fortress
areas; the spec gives no blanket fortress-zone exclusion. No rule fault was
established, so this audit files no extra runtime fix.

The requested per-system perf file was run once with no other test process here:
22 tests passed. System 08 averaged **0.731803 ms** on the saved 80-dwarf,
120-animal reference, below its **0.40 ms x 2 = 0.80 ms** CI tolerance. Whole tick
average was 4.032020 ms over 2,000 ticks. The reference fixture was unchanged.

## Why the three scenarios fail with natural arrivals

| Scenario | Original caller | Corrected caller, original scenario |
|---|---|---|
| `an_pasture` | Both cows alive at tick 33,600, condition 17 | Wild rabbits graze its fixed patch from tick 6,473; grass is gone by day 8; cows die of starvation at tick 21,402 |
| `an_breed` | One birth by tick 85,202 | A deer grazes the pasture at 39,153; grass is exhausted by 40,800; cows die at 53,852, so there is no birth by 134,400 |
| `hospital_run` | At least three wounded survivors; no fortress dwarf deaths | Four rabbits spawn before the staged hostiles, changing their IDs; two dwarves bleed out at 6,532 and 6,842, leaving one wounded survivor |

The hospital explanation is **not animal attacks disturbing the raid**. Both
recorded runs have zero damage to or from wild species. At tick 6,016, soldier
16777275 is at (48,6,32), while captain/archer are at (48,0,32)/(46,0,32), both
distance six. Originally archer 16777405 precedes captain 184549488 in the spatial
query. After four rabbit allocations, captain 16777402 precedes archer 16777409.
The soldier therefore chooses the captain. `combat/squads.ts` retains the first
nearest enemy and `core/spatial.ts` sorts by id. Both runs were repeated for this
target trace with the same result; all original scenario commands and assertions
were used. This is the intended deterministic tie-break, not a combat fault.

These are fixed-patch domestic-feeding/breeding and staged-hospital-casualty tests.
They now explicitly set the test-only `surfaceWildlife: 'none'` option. Only 08
receives the species-free ocean surface list; their terrain, climate, plants,
threats and manually supplied animals retain ordinary behavior. All original
assertions remain unchanged. A regression first failed with 19 natural arrivals
when that option was ignored, then passed with no arrivals and manual wild/tame
animals still available. No year-long fixture receives the option or any extra
farm, capacity, retiming or supply.

## Reproducing the measurements

The [spawning/room probe](../data/2026-10-09-t192-audit.probe.ts.txt) and
[scenario trace probe](../data/2026-10-09-t192-scenarios.probe.ts.txt) use the
ordinary public test-world helpers. Copy them to `.vite/task-resume/` as
`t192-audit.test.ts` and `t192-scenarios.test.ts`. Use a Vitest config with the
repository aliases from `../../vite.config`, these two include paths, node
environment, `testTimeout: 300000` and a single fork. Then run:

```
npx vitest run -c .vite/task-resume/t192.config.ts .vite/task-resume/t192-audit.test.ts
npx vitest run -c .vite/task-resume/t192.config.ts .vite/task-resume/t192-scenarios.test.ts
```

The scenario probe constructs a natural-spawn test world deliberately, so it
continues to reproduce the original single-rule assumptions even though the
scenarios now declare isolation. For the baseline trace temporarily use the old
one-line caller; restore the corrected caller before normal verification.

## Year-long fixtures without tuning

The full-year browser records 38 arrivals (deer 11, lynx 4, wolf 8, boar 5,
rabbit 6, badger 1, fox 3), six live at the end and no completed hunt/HuntKill.
It passes with 12 dwarves alive, but zero drink, meal and plant food at year end.
The generated `e2e-year` standard world has no `serene_vale` region; the script's
prescribed fallback is region 880, temperate forest, peril/temper zero and no
traits. Its wolves therefore do not violate the serene-valley exclusions.

`year_one` records 88 arrivals (rabbit 49, deer 22, wild horse 13, fox 4), no live
wild animals at the end, 13 completed hunts and 13 HuntKill events; all assertions
pass with 13 dwarves and no dwarf deaths. `homestead_year` records 16 arrivals
(wild horse 3, rabbit 7, fox 2, deer 4), 14 live at the end, two completed hunts
and two HuntKill events. Its newly activated hunting assertions pass.

No fixture commands, timing, capacity or supplies changed. Only observational
counters and the previously omitted homestead hunting assertions were added.
All six static checks pass, npm test passes 236 files / 2,146 tests in 339.68s,
and the whole browser suite passes all 20 tests in 3.0m. Screenshots restored.
`world-hashes.json` changes only the deepholm/emberhall tick 1,000/5,000 hashes
because natural spawning now contributes creatures and RNG state. Render,
tick-zero and generated world/local-map goldens remain unchanged.
