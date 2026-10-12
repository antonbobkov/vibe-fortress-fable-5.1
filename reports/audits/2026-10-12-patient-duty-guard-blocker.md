# Patient duty interruptions blocked by annual guards, 2026-10-12

Before: `7b13c0c`. After: that runtime with the decided T-211 change,
now parked in stash `e1a3c9b2a35f2a6262b6190a5aa4855969740956`.
The patch subscribes to PatientAdmitted and PatientDischarged and sets the
existing dwarf interrupt flag. Four new stepped regressions fail before it:
a wounded soldier stays in duty after the badger dies and a hospital bed is
allocated. After it, train/calm, active/calm and off/watchful take patient
behavior within three ticks, walk to the bed, and return to the station on
discharge. A saved walk retains each next-50-tick hash. No behavior-selection
priority, need rate, supplies, balance constant or fixture command is changed.

All 54 focused health/squad/patient tests pass in 10.59 seconds. Six static
checks pass. The whole browser suite passes 25 in 4.2 minutes, screenshots
restored; the before/after end-state lines are identical. The behavior patch
is not committed because the twelve-seed acceptance rule rejects its result.

## Annual guards

[Before rows](../data/2026-10-12-t262-after-wildlife.json),
[after rows](../data/2026-10-12-t211-after-wildlife.json).
The unchanged `wildlife_year.test.ts` runs in 596.76 seconds: twelve individual
seed cases pass, and the suite guard fails. Median 13, single minimum 0,
wildlife-free 8/12 and hunger/thirst deaths 0 are unchanged. Second-worst
9 becomes 0 (floor 8); extinctions 1 become 2 (cap 1). Both guarded bounds
are exceeded; no bounds, best figures or latest accepted reference are changed.
Only forest seeds 2 and 3 and taiga seed 4 have changed complete rows;
nine rows and hashes are identical. No long fixture was tuned.

| Seed | Living before / after | Dwarf deaths before / after | Hash before / after |
|---|---:|---:|---|
| wildlife-temperate_forest-1 | 10 / 10 | 3 / 3 | f283bf718824d1fe / f283bf718824d1fe |
| wildlife-temperate_forest-2 | 10 / 0 | 3 / 13 | 33219acf7e82d844 / 99c66ca376dbd8e2 |
| wildlife-temperate_forest-3 | 0 / 0 | 9 / 9 | e18c38044c28ff6f / 4e4a0ce9de0c55e3 |
| wildlife-temperate_forest-4 | 13 / 13 | 0 / 0 | 3bfa873760a197f1 / 3bfa873760a197f1 |
| wildlife-taiga-1 | 13 / 13 | 0 / 0 | 27fca263c8872410 / 27fca263c8872410 |
| wildlife-taiga-2 | 12 / 12 | 0 / 0 | da23f5960d18bc77 / da23f5960d18bc77 |
| wildlife-taiga-3 | 13 / 13 | 0 / 0 | a11df5efc361241e / a11df5efc361241e |
| wildlife-taiga-4 | 9 / 9 | 2 / 2 | 7420e338609debc6 / e64e787cf7f07bb6 |
| wildlife-temperate_grassland-1 | 15 / 15 | 0 / 0 | 99c7cdcab8764933 / 99c7cdcab8764933 |
| wildlife-temperate_grassland-2 | 14 / 14 | 0 / 0 | f2db1e9cd1e340e9 / f2db1e9cd1e340e9 |
| wildlife-temperate_grassland-3 | 15 / 15 | 0 / 0 | d97039e3ddd76ce6 / d97039e3ddd76ce6 |
| wildlife-temperate_grassland-4 | 14 / 14 | 0 / 0 | e4aca96c8403d490 / e4aca96c8403d490 |

## Repeated seed and observed states

Forest seed 2 was ten living at the annual endpoint; it now goes extinct at
the observation tick 132000, day 110, hash 99c66ca376dbd8e2. A separate
read-only repeat gives precisely the same tick, living count and hash in
67.02 seconds. The [probe source](../data/2026-10-12-t211-recheck.test.ts.txt)
wraps World.step, clones guard transitions and listens to clinical/death
messages without issuing different commands. Restore the stash at the stated
baseline, copy the probe to test/perf/t211-recheck.test.ts, then run
`npm exec -- vitest run -c vitest.perf.config.ts test/perf/t211-recheck.test.ts`.
Remove the temporary test afterwards.

[Selected transitions](../data/2026-10-12-t211-patient-duty-transitions.json)
show Orm Frostward admitted with no available bed while serving a need at
88159, then in patient at 88226 with bedId 0 and no combat target. Katla
Stoneheart is admitted while serving a need at 92182 and takes patient at
92202, also with no bed and no target. Admission does not interrupt a running
need by itself in the existing brain; the new event flag fixes the stuck duty
case proven by the small regressions. These observations do not establish a
new medical rule or a claim that the death differences have one combat cause.
The new deaths are wolf combat/bleeding deaths, not hunger or thirst deaths;
stocks at extinction include 111 drink, 63 meals and 30 plant food.

## Browser year

Before
```
full-year end state: {"livingCount":7,"wealth":2840,"stocks":{"drink":101,"meal":59,"plantFood":50,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":1,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":73740,"level":"watchful"},{"tick":75240,"level":"hearth"},{"tick":77460,"level":"watchful"},{"tick":77480,"level":"calm"},{"tick":77540,"level":"watchful"},{"tick":78960,"level":"hearth"},{"tick":79940,"level":"watchful"},{"tick":85040,"level":"hearth"},{"tick":85720,"level":"watchful"},{"tick":85740,"level":"calm"},{"tick":85780,"level":"watchful"},{"tick":87220,"level":"hearth"},{"tick":88100,"level":"watchful"},{"tick":88120,"level":"calm"},{"tick":88260,"level":"watchful"},{"tick":91020,"level":"hearth"},{"tick":91940,"level":"watchful"},{"tick":91960,"level":"calm"},{"tick":92120,"level":"watchful"},{"tick":93440,"level":"hearth"},{"tick":94040,"level":"watchful"},{"tick":94060,"level":"calm"},{"tick":94200,"level":"watchful"},{"tick":97580,"level":"calm"},{"tick":97860,"level":"watchful"},{"tick":98700,"level":"calm"},{"tick":99000,"level":"watchful"},{"tick":99880,"level":"calm"},{"tick":100120,"level":"watchful"},{"tick":101080,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":62,"tick":74162,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":65,"tick":77932,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":72,"tick":85392,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":77,"tick":91247,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"a4b660f007544cc3"}
```

After
```
full-year end state: {"livingCount":7,"wealth":2840,"stocks":{"drink":101,"meal":59,"plantFood":50,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":1,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":73740,"level":"watchful"},{"tick":75240,"level":"hearth"},{"tick":77460,"level":"watchful"},{"tick":77480,"level":"calm"},{"tick":77540,"level":"watchful"},{"tick":78960,"level":"hearth"},{"tick":79940,"level":"watchful"},{"tick":85040,"level":"hearth"},{"tick":85720,"level":"watchful"},{"tick":85740,"level":"calm"},{"tick":85780,"level":"watchful"},{"tick":87220,"level":"hearth"},{"tick":88100,"level":"watchful"},{"tick":88120,"level":"calm"},{"tick":88260,"level":"watchful"},{"tick":91020,"level":"hearth"},{"tick":91940,"level":"watchful"},{"tick":91960,"level":"calm"},{"tick":92120,"level":"watchful"},{"tick":93440,"level":"hearth"},{"tick":94040,"level":"watchful"},{"tick":94060,"level":"calm"},{"tick":94200,"level":"watchful"},{"tick":97580,"level":"calm"},{"tick":97860,"level":"watchful"},{"tick":98700,"level":"calm"},{"tick":99000,"level":"watchful"},{"tick":99880,"level":"calm"},{"tick":100120,"level":"watchful"},{"tick":101080,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":62,"tick":74162,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":65,"tick":77932,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":72,"tick":85392,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":77,"tick":91247,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"a4b660f007544cc3"}
```

## Parking verification

After stashing the behavior patch, the unchanged accepted runtime passes all
six static checks (325 docs, no broken links) and npm test: 279 files / 2451
tests in 475.42 seconds. Only the parking note, report and evidence are committed.
No golden file or existing assertion changes.
