# Personal reservations, weeping and death, 2026-10-12

Diagnosis runtime: `315cf6b`; fix: that commit with the T-263 working change.
The main three-year commands and assertions are unchanged. The read-only
[probe source](../data/2026-10-12-t263-trace-probe.test.ts.txt) wraps item API
mutations, activity-plan transitions and delivered events. It restores its
prototype hooks in finally and captures a selected dwarf's state, rather than
changing the simulation. On that diagnosis commit, copy it to test/perf/t263-trace-probe.test.ts,
set TRACE_OUT to an ignored path, and run `npm exec -- vitest run -c
vitest.perf.config.ts test/perf/t263-trace-probe.test.ts`; remove the copied
probe afterwards. The unfixed run takes 532.37 seconds and fails at tick 336000
with the original [orphan reservation](../data/2026-10-12-t263-before-invariants.log).

## Exact lost release

[Selected trace records](../data/2026-10-12-t263-reservation-trace.json):

| Boundary | State |
|---|---|
| 98253 | Saga Granitefell (150995335), thirst 86.4, reserves drink 150995102, one unit in barrel 50331755 at tile 74572; Activities.start installs its travel plan |
| 98401 | SulkHappened, kind weep, target 60274; 10 changes the brain to idle, but leaves the old thirst travel plan and reservation intact; thirst is now 91.2 |
| 98402 | Normal selection starts another thirst plan for drink 83886707 at 74571; plans.set overwrites the old plan, with both drinks reserved under Saga's id |
| 98458 | The new drink is consumed; the old one remains reserved in its barrel |
| 149100 | First later reload retains the orphan drink, with no current activity plan |
| 273900 | Another reload retains it beside an unrelated current plan (item 16777594) |
| 335727 | Saga dies of bleeding; the old drink still names her now-dead id as reserver |
| 336000 | The existing invariant reports item.reserved-by-missing-job for that drink |

No release or consumption of 150995102 occurs in the complete captured trace
(3765 records). This is the weeping controller bypassing normal activity
cancellation, not a failed walk or a missing death event. Normal death
cancellation sees only the current plan; it cannot recover the overwritten one.

## Rule and fix

Before a weeping controller replaces the brain, cancel the need plan through
the ordinary activity path: drop a held meal, release only that dwarf's
reservation with ItemReleased, delete its plan and stop its obsolete walk.
Retain the existing weeping timer and later selection rules.

During CreatureDied, 13 also releases every reservation still under the removed
creature's id, including older saved orphans without a current plan. It uses
the item API and emits ItemReleased once per actual release. This is added to
the existing ownership-cleanup scan. A reservation already cancelled by 10,
or one held by another holder, is untouched. No need rate, sulk rate, death
threshold, supply, balance constant or long fixture changes.

## Regressions

Six new T-263 stepped cases: travelling drink cancellation at delivered
weeping, held-meal drop and spatial/availability indices, interrupted-boundary
save/load plus 50 continuation hashes, another holder's reservation, legacy
reservations at death, and no duplicate active-plan death release. Four fail
before the fix; the two preservation/idempotence controls pass before and after.
All 137 focused dwarf/item tests in 20 files pass. The small world explicitly
requests normal reselection by crossing a want threshold after the interruption;
the full scenario's work availability requested that selection. No assertion
from an existing test changes.

## Twelve-seed re-measure

Before: the [accepted reachable-arrival rows](../data/2026-10-12-t260-after-wildlife.json).
After: [reservation-cleanup rows](../data/2026-10-12-t263-after-wildlife.json),
one foreground `npm exec -- vitest run -c vitest.perf.config.ts
 test/perf/wildlife_year.test.ts`, 555.99 seconds.

All twelve complete rows and hashes are identical. Median 13, second-worst 9,
single minimum 0, wildlife-free 8/12, one extinction, zero need deaths before
and after. The current guards (median 12, second-worst 8, wildlife-free 6,
extinction cap 1, need-death cap 1) pass with no worsened or exceeded figure.
No best measurement, bound, tolerance or target changes. The extinction/minimum
still miss the general survival target; both unstable seeds stay in the record.

## Full verification

Six static checks pass: 50 tables / 1624 content rows, 1140 strings,
24 interface documents, 323 docs with no broken links. npm test passes
278 files / 2444 tests in 467.91 seconds. The whole npm run test:e2e
passes 25 in 4.1 minutes; screenshots restored. No golden files move.
The browser before/after end-state records are identical, including the hash.

```
Before
full-year end state: {"livingCount":7,"wealth":2840,"stocks":{"drink":101,"meal":59,"plantFood":50,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":1,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":73740,"level":"watchful"},{"tick":75240,"level":"hearth"},{"tick":77460,"level":"watchful"},{"tick":77480,"level":"calm"},{"tick":77540,"level":"watchful"},{"tick":78960,"level":"hearth"},{"tick":79940,"level":"watchful"},{"tick":85040,"level":"hearth"},{"tick":85720,"level":"watchful"},{"tick":85740,"level":"calm"},{"tick":85780,"level":"watchful"},{"tick":87220,"level":"hearth"},{"tick":88100,"level":"watchful"},{"tick":88120,"level":"calm"},{"tick":88260,"level":"watchful"},{"tick":91020,"level":"hearth"},{"tick":91940,"level":"watchful"},{"tick":91960,"level":"calm"},{"tick":92120,"level":"watchful"},{"tick":93440,"level":"hearth"},{"tick":94040,"level":"watchful"},{"tick":94060,"level":"calm"},{"tick":94200,"level":"watchful"},{"tick":97580,"level":"calm"},{"tick":97860,"level":"watchful"},{"tick":98700,"level":"calm"},{"tick":99000,"level":"watchful"},{"tick":99880,"level":"calm"},{"tick":100120,"level":"watchful"},{"tick":101080,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":62,"tick":74162,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":65,"tick":77932,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":72,"tick":85392,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":77,"tick":91247,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"a4b660f007544cc3"}

After
full-year end state: {"livingCount":7,"wealth":2840,"stocks":{"drink":101,"meal":59,"plantFood":50,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":1,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":73740,"level":"watchful"},{"tick":75240,"level":"hearth"},{"tick":77460,"level":"watchful"},{"tick":77480,"level":"calm"},{"tick":77540,"level":"watchful"},{"tick":78960,"level":"hearth"},{"tick":79940,"level":"watchful"},{"tick":85040,"level":"hearth"},{"tick":85720,"level":"watchful"},{"tick":85740,"level":"calm"},{"tick":85780,"level":"watchful"},{"tick":87220,"level":"hearth"},{"tick":88100,"level":"watchful"},{"tick":88120,"level":"calm"},{"tick":88260,"level":"watchful"},{"tick":91020,"level":"hearth"},{"tick":91940,"level":"watchful"},{"tick":91960,"level":"calm"},{"tick":92120,"level":"watchful"},{"tick":93440,"level":"hearth"},{"tick":94040,"level":"watchful"},{"tick":94060,"level":"calm"},{"tick":94200,"level":"watchful"},{"tick":97580,"level":"calm"},{"tick":97860,"level":"watchful"},{"tick":98700,"level":"calm"},{"tick":99000,"level":"watchful"},{"tick":99880,"level":"calm"},{"tick":100120,"level":"watchful"},{"tick":101080,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":62,"tick":74162,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":65,"tick":77932,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":72,"tick":85392,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":77,"tick":91247,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"a4b660f007544cc3"}
```
