# T-M8-01 profiling pass (verification complete)

Worktree: vibe-fortress-fable-5.1-perf, branch m8-perf, 2026-10-03.

The unchanged saved reference contains 80 dwarves, 120 animals, 25,000 items,
600 buildings, 60 zones, the river, breached cavern and waterfall. Measurements
retain the existing 200 warmup ticks and 2,000 measured ticks, platform clock,
scheduler totals amortized over every world tick, and pathing/connectivity wrapper.
Event handling remains charged to the residual core column, as in the inherited
measurement. This table measures the daily/hourly transitions reached in that
window, not every possible season or event. System 24 is measured but unbudgeted.

## Profile and changes

V8 CPU sampling and separate handler/search tracing identified repeated whole-stock
searches during dwarf behavior/job retries, held-ammunition scans, perception through
item-heavy spatial buckets, miasma enumeration, static activity scans, cavern target
reachability, and statue checks in movement batches. The changes preserve search rings,
stockpile fallback, reachability, strict distance ties, entity slot/id order, and RNG calls:

- Derived item type/chunk/carrier/container indexes and immutable content filters;
  failed candidates checked once per expanding-ring search. Connectivity label zero
  returns the existing impossible-search result immediately.
- Exact-tile and kind spatial indexes for bounded perception and unattended loot.
- Incremental metadata refresh for legacy squad claims, hostile gear, last-arrow
  launch and training destruction, preserving their existing records, accounting
  and events. Regression tests exercise real squad and projectile paths.
- Rot-stage-2 sources maintained incrementally; expiry removal visits the record's
  bucket, with binary sorted insertion/removal instead of rescanning and resorting it.
- Static activity targets invalidated by building/room/zone revisions; occupancy,
  well water and reachability stay live. Water-distance pruning retains equal-distance
  lower-tile ties. Statue candidates are shared within each movement batch.
- Cavern fortress targets grouped by live connectivity label within one pass;
  hostile LOS checks stop when neither selected minimum can improve.
- Thief goals select the original stable-sort minimum through cached per-tile value
  maxima and value bands; lower bands cannot displace a reachable winner. Outdoor
  preference, distance and slot ties, and F-13 raid/pet-door behavior remain.
- Tick contexts reused within one world tick. Diagnostic moving average and rolling
  worst cover one simulated second, including zero-cost cadence ticks, alongside
  lifetime totals/worst. The app injects its platform clock on creation and load,
  and the debug panel uses the rolling values (D-209).

## Comparable measurements

The table uses means of two alternating before/after runs of the final version,
each in a fresh Node/Vite process with identical fixtures, 200 warmup ticks,
2,000 measured ticks, clock and timing harness. The baseline is an archive of
merged parent HEAD 36fce6a inside this worktree; probes confirmed original
Scheduler and ItemCore module resolution in both baseline processes. The archive
was removed afterward. An unrelated balance worker continued on this six-core
host; no other tests owned by this agent overlapped these four comparison runs.
Before averages: 46.629928 / 46.148115 ms; after: 3.511240 / 3.463686 ms
(13.30x mean speedup). The two baselines agree within 1.04%.
Repeated samples and per-system ratios control for noisy wall time; no budget,
fixture or tolerance was changed. The initial pre-integration local measurement
was 52.575 ms, versus inherited M6's 41.9 ms; neither substitutes for this baseline.

| System | Budget (ms) | Before (ms) | After (ms) | Before / after |
|---|---:|---:|---:|---:|
| 03 terrain | 0.10 | 0.005747 | 0.004865 | 1.18x |
| 04 fluids | 1.50 | 1.028334 | 1.057507 | 0.97x |
| 05 materials | 0.15 | 0.000746 | 0.000659 | 1.13x |
| 06 weather | 0.02 | 0.000571 | 0.000544 | 1.05x |
| 07 plants | 0.15 | 0.001049 | 0.000977 | 1.07x |
| 08 animals | 0.40 | 8.860296 | 0.549010 | 16.14x |
| 09 foraging | 0.05 | 0.001154 | 0.000718 | 1.61x |
| 10 dwarves | 0.50 | 7.593021 | 0.444009 | 17.10x |
| 11 jobs | 0.60 | 25.259990 | 0.385457 | 65.53x |
| 12 workshops | 0.10 | 0.001031 | 0.000670 | 1.54x |
| 13 items | 0.30 | 0.723766 | 0.033418 | 21.66x |
| 14 buildings | 0.10 | 0.000758 | 0.000679 | 1.12x |
| 15 morale | 0.20 | 0.085706 | 0.081138 | 1.06x |
| 16 combat | 0.20 | 1.460410 | 0.135892 | 10.75x |
| 17 health | 0.10 | 0.005779 | 0.005470 | 1.06x |
| 18 threats | 0.10 | 0.438473 | 0.131365 | 3.34x |
| 19 defense | 0.05 | 0.009875 | 0.008200 | 1.20x |
| 20 trade | 0.02 | 0.001702 | 0.001102 | 1.54x |
| 21 immigration | 0.00 | 0.000564 | 0.000342 | 1.65x |
| 22 pathing | 1.00 | 0.421830 | 0.402521 | 1.05x |
| core | 0.30 | 0.487599 | 0.242505 | 2.01x |

Only the new system-21 assertion is TODO (C-009): the specified literal 0.00 ms
allocation cannot be met by actual daily execution and real clock measurement.
All other allocations are asserted at the unchanged budget times two; existing
immigration tests remain enabled.

The final paired worst ticks were 1231.314 / 1194.786 ms before and
34.380 / 33.818 ms after. Both meet the unchanged 40 ms CI
acceptance ceiling (2x the 20 ms architectural target). The 80-dwarf perf_reference
asserts its 12 ms average and 40 ms worst limits alongside the unchanged played
assertions. The daily arrival spike was sampled before adding per-tile maxima
and value bands; outdoor preference, distance and slot ties stay unchanged.

## Behavior, integration and verification

All four correctly resolved paired runs ended with hash 62009213641e17ac at 2,200
steps. No world/render goldens were regenerated. The original item-search oracle
covers creation, flags, carriers, containers, splits, consumption, rot type changes,
slot reuse, rebuild and impassable-source searches. Activity/spatial tests cover
invalidation, live reachability and distance ties. Thief tests retain slot-order ties
with a reused entity id and exclude a more valuable unreachable target.

Master fast-forwarded to e8e796c, F-13 cbbf8a9, F-14 7033620, then balance refresh
03d3590, then 36fce6a (including cc4c070). The refresh changes the three-year fixture's doors to `lock_on_alert`
and adds balance diagnostics; the saved references are unchanged. The later cc4c070 parent fix updates connectivity on timed alert-door locks; its new tests are included in final verification.
The previous incomplete performance run was stopped and verification restarted
against that fixture. Stash reapplication
had no textual conflicts. F-13 D-207 and F-14 D-208 remain; this task's decision was
renumbered D-209. The only spec-document edit made by this task is the permitted
one-line items reader implementation note.

Final 36fce6a-integrated verification: lint and typecheck passed; content check
passed (50 tables, 1,585 rows). All 169 regular files / 1,586 tests passed in
216.99 seconds, including world/render goldens and save round-trip determinism.
The three-year scenario retained population 12, zero dwarf and tame deaths,
wealth 3525/3750/3944, mean mood 51.5, 1,041 meals and 1,713 alcohol drinks.

All 14 browser tests passed in 2.1 minutes with the original farm staffing setup.
The browser full-year run ended with 10 living dwarves, wealth 1753, 5 drink units
and zero food stock; both guaranteed waves totaled 5 arrivals. These are measured
browser outcomes, distinct from the deterministic headless three-year baseline.
Earlier concurrent verification had a child_labor staffing rejection (13 passes);
a fresh full browser run after regular tests completed passed the unchanged test,
and the final source's full browser run also passed. Generated screenshots were
restored with git checkout reports/screenshots. No golden files or e2e tests changed.

The full performance run on final source passed: 9 files, 55 tests and the single C-009 TODO in 1,728.71 seconds. The per-system run measured 3.413 ms average / 33.669 ms worst. The acceptance reference measured 3.511 ms average / 28.796 ms worst; the played reference measured 0.417 ms average / 32.207 ms worst. perf_gen measured 515.237 ms for the standard 64-region world and actual 96x96x48 local map. All three mood
decomposition tests and both seed sweeps passed. Previous incomplete runs were stopped when parent
integration or compatibility review changed the source. T-M8-01 is complete; T-M8-02 follows in a separate commit.
