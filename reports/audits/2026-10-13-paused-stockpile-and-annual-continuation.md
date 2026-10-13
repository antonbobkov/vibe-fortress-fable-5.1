# Paused stockpile and annual continuation, 2026-10-13

T-240 fixes presentation of a stockpile whose ZoneChanged event is still queued. Inspection found all four command handlers already called StockpileStore.ensure, including its LinkStockpile source path. Three paused editor regressions failed before the fix; the four command controls and replay already passed. The editor now reads shared, fresh defaults for an existing stockpile or hospital zone without a record, without mutating the world during drawing. A removed zone stays unavailable. The factory replaces the identical literal defaults in ensure; command dispatch, event order, save format, rates and fixtures are unchanged.

Fourteen task cases pass, covering keyboard and mouse Wood preset application at tick zero, default-based category/material/container edits, later ZoneChanged preserving settings, removed zones, isolated factory records, hospital defaults, paused save/load continuation and recorded replay without pauses. The U-07 and U-03 controls also pass (115 focused cases). Six static checks pass; npm test passes 2,583 tests in 293 files (827.11 seconds), including every golden. The whole browser suite passes 25 (7.5 minutes), with screenshots restored. No existing assertion or golden changed.

## Annual comparison

The before row is the [accepted T-211 after measurement](../data/2026-10-13-t211-after-wildlife.json), whose reviewed simulation is committed as 1d8ca62. Between that measurement and this task only T-249 presentation/input changes landed on this branch. The [fresh repeat](../data/2026-10-13-t240-wildlife.json) measures 983ca09 plus the T-240 changes in the closing commit. It ran with `WILDLIFE_YEAR_OUT=reports/data/2026-10-13-t240-wildlife.json npm exec -- vitest run --config vitest.perf.config.ts test/perf/wildlife_year.test.ts`: 12 tests pass in 925.51 seconds. All twelve endpoint hashes, summary figures and outcome classes are identical. No new unstable seed, guard update or tuning decision follows.

| Guarded figure | Before | After | Bound |
|---|---:|---:|---|
| Median living | 13 | 13 | At least 12 |
| Living sum | 139 | 139 | At least 127 |
| Wildlife-free years | 8 | 8 | At least 6 |
| Extinctions | 1 | 1 | At most 1 |
| Hunger/thirst deaths | 0 | 0 | At most 1 |

Worst 0 and second-worst 10 remain reported. Forest seed 3 still misses the general survival target; this is an equivalence check of shared defaults, not a balance fix.

| Seed | Living before / after | Hash on both sides |
|---|---:|---|
| wildlife-temperate_forest-1 | 13 / 13 | `b3ae0d7cc6fb874a` |
| wildlife-temperate_forest-2 | 10 / 10 | `9b2faa9b237b26a1` |
| wildlife-temperate_forest-3 | 0 / 0 | `a1a6a717ae82def9` |
| wildlife-temperate_forest-4 | 10 / 10 | `72b94828de6d4afb` |
| wildlife-taiga-1 | 13 / 13 | `45bce95ec7f53226` |
| wildlife-taiga-2 | 11 / 11 | `7af64434d0c4e59c` |
| wildlife-taiga-3 | 13 / 13 | `a11df5efc361241e` |
| wildlife-taiga-4 | 11 / 11 | `d270ee21a457c81f` |
| wildlife-temperate_grassland-1 | 15 / 15 | `99c7cdcab8764933` |
| wildlife-temperate_grassland-2 | 14 / 14 | `f2db1e9cd1e340e9` |
| wildlife-temperate_grassland-3 | 15 / 15 | `d97039e3ddd76ce6` |
| wildlife-temperate_grassland-4 | 14 / 14 | `e4aca96c8403d490` |

## Browser year

Both before and after have eight living, no hunger/thirst death, wealth 2,777 and hash `94f0a060eb7a66fc`. The complete end-state lines are:

```text
Before full-year end state: {"livingCount":8,"wealth":2777,"stocks":{"drink":108,"meal":58,"plantFood":103,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":2,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":88200,"level":"watchful"},{"tick":88220,"level":"calm"},{"tick":88300,"level":"watchful"},{"tick":89120,"level":"calm"},{"tick":89700,"level":"hearth"},{"tick":90000,"level":"watchful"},{"tick":90020,"level":"calm"}],"deaths":[{"day":61,"tick":72002,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"flee"},{"day":64,"tick":76762,"kind":"dwarf","name":"Estrid Emberstone","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":69,"tick":82422,"kind":"dwarf","name":"Vidar Shaletongue","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":73,"tick":87482,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":318767495,"killerSpecies":"wolf","killerState":"attack"}],"hash":"94f0a060eb7a66fc"}
After full-year end state: {"livingCount":8,"wealth":2777,"stocks":{"drink":108,"meal":58,"plantFood":103,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":2,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":88200,"level":"watchful"},{"tick":88220,"level":"calm"},{"tick":88300,"level":"watchful"},{"tick":89120,"level":"calm"},{"tick":89700,"level":"hearth"},{"tick":90000,"level":"watchful"},{"tick":90020,"level":"calm"}],"deaths":[{"day":61,"tick":72002,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"flee"},{"day":64,"tick":76762,"kind":"dwarf","name":"Estrid Emberstone","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":69,"tick":82422,"kind":"dwarf","name":"Vidar Shaletongue","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":73,"tick":87482,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":318767495,"killerSpecies":"wolf","killerState":"attack"}],"hash":"94f0a060eb7a66fc"}
```
