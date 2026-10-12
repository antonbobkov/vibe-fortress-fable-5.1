# Pasture capacity and winter feeding

Measured 2026-10-12 on codex-a at the merge following `01fa4ec`, with only the T-210 capacity constant changed in the runtime. Source finding: [the livestock probe](2026-10-10-wild-animals-and-civilians.md). Raw [before/after and intermediate measurements](../data/2026-10-12-t210-pasture-measurements.json) retain the daily grass and condition rows.

## Capacity decision

Keep the hourly condition rise, grass relief, starvation deadline and regrowth probability unchanged. Correct the advertised capacity allocation from six to 48 grass tiles per grazer. One grazer's ordinary demand is 48 condition points per day divided by 25 relief per consumed tile, or 1.92 tiles/day. Six bare tiles regrow at most 0.72 tiles/day even when all have a grass neighbour; that allocation cannot sustain the demand. The larger allowance retains a reserve for the neighbour requirement and uneven regrowth, rather than increasing grass growth or reducing feeding needs.

The capacity warning is a conservative growing-season allocation for accessible, replenishing grass without competition. It does not promise winter surface feeding: outdoor regrowth stops and snow makes grass inedible. Retained grazers need a walkable cave-loam pasture with unsnowed moss at the same allocation, or a smaller herd. There is no stored-fodder feeding mechanic.

## Controlled feeding probe

The permanent T-210 test uses two cows, two sheep and two goats, all male, on six adjacent separate pasture parcels. This measures one grazer per capacity allocation without the shared-tile fault below. Its flat map has ordinary weather, grass regrowth, animal brains, products and starvation. Immigration is omitted and natural surface wildlife is excluded expressly for this single feeding rule; no new animals compete. Every condition is sampled hourly and grazer starvation events are counted, so a transient hit to 100 is caught as well.

The old allocation is six 3 by 2 parcels (36 total grass tiles); the corrected allocation is six 8 by 6 parcels (288 total). Increasing the pasture allocation is the subject of this probe, not a change to any long economy or browser fixture. Commands: `npx vitest run test/unit/animals/t210-pasture-capacity.test.ts` before and after changing the one constant. Two feeding regressions failed before the fix and the no-outdoor-winter-regrowth control passed; all three passed after it.

| Case | Days | Before max condition / starving / deaths / final grass | After max condition / starving / deaths / final grass |
|---|---:|---|---|
| Spring through summer and early autumn | 60 | 100 / 10 / 4 / 12 | 42 / 0 / 0 / 164 |
| Unsnowed cave pasture in winter | 28 | 100 / 6 / 6 / 0 | 42 / 0 / 0 / 153 |
| Outdoor pasture in winter | 28 | 100 / 6 / 6 / 0 | 100 / 6 / 0 / 48 |

An intermediate allocation of 32 passed summer but failed the winter cave regression: one sheep reached condition 100 on day 23. No assertion was weakened; 48 is the measured allowance that passes both feeding cases. Outdoor winter still raises starving notes despite grass remaining, demonstrating why a surface capacity warning cannot guarantee winter feeding.

## Shared grass fault, filed separately

The original shared-herd probe can grant feeding relief to several animals for one physical tile. The [small saved reproduction](../data/2026-10-12-t285-shared-grass-probe.test.ts.txt) puts six grazers at condition 42 on one grass tile. Twenty ticks later all six have condition 17, but there is just one GrassGrazed event and the grass is gone: 150 total condition relief for one tile that should yield 25. [Result](../data/2026-10-12-t285-shared-grass-result.txt).

`animals/tame.ts` grants relief immediately; `animals/index.ts` deduplicates the pending tile before 07 clears it. This fault is filed as [T-285](../../docs/work/T-285-several-grazers-eat-one-grass-tile.md), with a proposed single-consumer claim and continuation tests. It is not fixed here, and the separated capacity parcels do not rely on it. No long fixture has been edited.

## Browser verification

The full browser suite passed 25 tests in 10.5 minutes; screenshots were restored. The before and after full-year end-state lines are identical: six living dwarves, wealth 2547, drink/meal/plant food 100/56/84, no hunger or thirst death, hash `008a55e9dabe420b`. No playthrough command, timing, supply or capacity was changed.

## Annual instrument and full verification

The [accepted before rows](../data/2026-10-12-t213-after-wildlife.json) and [after rows](../data/2026-10-12-t210-after-wildlife.json) are identical for every one of the twelve seeds, including hashes. Before and after median/second-worst/minimum/wildlife-free/extinctions/need-deaths is 13/8/0/8/1/0. All guards pass; best measurements, latest reference and targets are unchanged. Command: `npx vitest run -c vitest.perf.config.ts test/perf/wildlife_year.test.ts`, with `WILDLIFE_YEAR_OUT` selecting the after file. Twelve tests passed in 748.93 seconds.

All six static checks pass: 50 tables / 1624 content rows, 1159 string keys, 24 interface documents without differences. The full suite, run with four workers, passed 284 files and 2505 tests in 607.83 seconds. The interrupted earlier runs lost a worker and the annual report's git subprocess; both were re-run with no assertion change. No existing assertion or golden changed.
