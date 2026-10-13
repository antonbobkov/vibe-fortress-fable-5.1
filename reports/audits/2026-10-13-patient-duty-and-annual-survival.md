# Patient duty and annual survival, 2026-10-13

T-211 makes admission and discharge interrupt behavior selection. A conscious soldier remains on duty while a hostile is alive, visible and within the existing sight bounds; after the fight it rests in its held hospital bed or at its current tile. Want activities do not override that fighting-patient rule, and an ongoing critical meal releases its reservation when the fight ends and patient rest takes priority. Critical needs retain their existing priority during the fight. No rates, capacities, supplies or long fixtures changed.

The five original stepped regressions all failed on master `65b7a17` and passed on WIP `30680ec`. Review added five cases; two failed on the WIP: training under a calm alert let a hungry admitted fighter eat, and an ongoing critical meal blocked rest after the enemy died. Both now pass; all ten task cases and four existing soldier-needs cases pass. No existing assertion was weakened.

## Annual measurement

[Before data](../data/2026-10-13-t211-before-wildlife.json) records master `65b7a17`. [After data](../data/2026-10-13-t211-after-wildlife.json) records merge `80e22a5` plus the reviewed working-tree changes preserved in [the clinical patch](../data/2026-10-13-t211-reviewed.patch.txt). The instrument ran all twelve seeds afresh on each side with `WILDLIFE_YEAR_OUT=reports/data/2026-10-13-t211-{before,after}-wildlife.json npm exec -- vitest run --config vitest.perf.config.ts test/perf/wildlife_year.test.ts` (substitute one output name per run). The after measurement's saved bounds precede the required improved-measurement update.

| Figure | Before | After | Guard at measurement |
|---|---:|---:|---|
| Median living | 13 | 13 | At least 12 |
| Sum living | 133 | 139 | At least 123; tightened to 127 on acceptance |
| Wildlife-free years | 8 | 8 | At least 6 |
| Extinctions | 1 | 1 | At most 1 |
| Hunger/thirst deaths | 0 | 0 | At most 1 |
| Worst (reported) | 0 | 0 | None |
| Second-worst (reported) | 6 | 10 | None |

All guards pass; no guarded figure worsens. Best measured living improves from 135 to 139; other best figures and all tolerances remain unchanged. Forest median/minimum is 10/0, taiga 12/11 and grassland 14.5/14. Forest seed 3 still goes extinct, so this is not fulfillment of the general survival target.

| Seed | Before living | After living | Before hash | After hash |
|---|---:|---:|---|---|
| wildlife-temperate_forest-1 | 13 | 13 | `b3ae0d7cc6fb874a` | `b3ae0d7cc6fb874a` |
| wildlife-temperate_forest-2 | 6 | 10 | `78492100501e5b89` | `9b2faa9b237b26a1` |
| wildlife-temperate_forest-3 | 0 | 0 | `97c9da7f1ae301ef` | `a1a6a717ae82def9` |
| wildlife-temperate_forest-4 | 12 | 10 | `b2755ad230219d5b` | `72b94828de6d4afb` |
| wildlife-taiga-1 | 13 | 13 | `45bce95ec7f53226` | `45bce95ec7f53226` |
| wildlife-taiga-2 | 7 | 11 | `f4366f1bda38a008` | `7af64434d0c4e59c` |
| wildlife-taiga-3 | 13 | 13 | `a11df5efc361241e` | `a11df5efc361241e` |
| wildlife-taiga-4 | 11 | 11 | `d270ee21a457c81f` | `d270ee21a457c81f` |
| wildlife-temperate_grassland-1 | 15 | 15 | `99c7cdcab8764933` | `99c7cdcab8764933` |
| wildlife-temperate_grassland-2 | 14 | 14 | `f2db1e9cd1e340e9` | `f2db1e9cd1e340e9` |
| wildlife-temperate_grassland-3 | 15 | 15 | `d97039e3ddd76ce6` | `d97039e3ddd76ce6` |
| wildlife-temperate_grassland-4 | 14 | 14 | `e4aca96c8403d490` | `e4aca96c8403d490` |

There is no new outcome-class flip or change of five or more living in this pair. The five previously recorded unstable seeds remain in balance-status.md and in the cohort.

## Browser year

The unchanged playthrough rises from six living to eight. Both runs have no hunger or thirst death. The full before and after end-state lines are:

```text
Before full-year end state: {"livingCount":6,"wealth":2547,"stocks":{"drink":100,"meal":56,"plantFood":84,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":3,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":85840,"level":"watchful"},{"tick":87340,"level":"hearth"},{"tick":91960,"level":"watchful"},{"tick":91980,"level":"calm"},{"tick":92060,"level":"watchful"},{"tick":93460,"level":"hearth"},{"tick":93760,"level":"watchful"},{"tick":93920,"level":"calm"},{"tick":94120,"level":"watchful"},{"tick":95180,"level":"calm"},{"tick":95400,"level":"watchful"},{"tick":96140,"level":"calm"},{"tick":96500,"level":"watchful"},{"tick":101160,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":67,"tick":80072,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":""},{"day":70,"tick":83561,"kind":"dwarf","name":"Estrid Emberstone","cause":"killed","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":71,"tick":84132,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"idle"},{"day":74,"tick":88532,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":78,"tick":92472,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"008a55e9dabe420b"}
After full-year end state: {"livingCount":8,"wealth":2777,"stocks":{"drink":108,"meal":58,"plantFood":103,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":2,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":88200,"level":"watchful"},{"tick":88220,"level":"calm"},{"tick":88300,"level":"watchful"},{"tick":89120,"level":"calm"},{"tick":89700,"level":"hearth"},{"tick":90000,"level":"watchful"},{"tick":90020,"level":"calm"}],"deaths":[{"day":61,"tick":72002,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"flee"},{"day":64,"tick":76762,"kind":"dwarf","name":"Estrid Emberstone","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":69,"tick":82422,"kind":"dwarf","name":"Vidar Shaletongue","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":73,"tick":87482,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":318767495,"killerSpecies":"wolf","killerState":"attack"}],"hash":"94f0a060eb7a66fc"}
```

## Verification

Ten task regressions and four existing soldier-needs cases pass. Six static checks pass. The render golden intentionally changes only the look panel activity from On duty to Resting in hospital; all 71 golden cases pass after the official updater. The whole browser suite passes 25 tests, with screenshots restored. The full suite passes 2,557 tests in 291 files (510.13 seconds). Content checks cover 50 tables and 1,626 rows, strings 1,178 keys, interfaces 24 documents, and documentation links 341 files; all pass.
