# Treatment retries after discharge, 2026-10-12

Before runtime: `5589f97`; after: that commit with the working retry change.
The original stepped hospital trace admitted dwarf 184549575 at tick 6394,
bandaged and discharged it at 6679 with pain 11, then failed suture job 157
at 7056. Discharge was correct: the cut was no longer bleeding and none of
17's admission reasons remained. The failed suture consumed thread but left
the serious cut unsutured, with no Patient tag to drive another producer pass.

## Rule and regression

A failed, still-needed dwarf wound treatment retains its kind independently
of admission. The ordinary producer recreates it with the usual inputs and
reservations. Success, healing or death clears a request when that treatment
is no longer needed. A discharged target is not readmitted to obtain a retry;
its other existing care is left alone. Infection cure deadlines are unchanged.

The new stepped case lets bandaging discharge a serious-cut patient while
its suture is working. A real low-skill RNG state fails that completion:
three threads become two, no Suture TreatmentDone occurs, and the cut is
still unsutured without Patient. Before the fix no replacement appears within
50 ticks, including after save/load. After the fix a replacement consumes
one fresh thread and succeeds under medicine 20 without admission.

Seven T-262 cases cover retry, save/load and 50 continuation hashes, successful
completion, another treatment clearing the need, cancellation of an already
recreated job, death and two pending kinds recorded in a different order.
The original four cases have two failures and two passing controls before the
fix. The two-kind continuation case also caught insertion-order dependence in
the working change; production now uses the clinical need order and stale
request cancellation is sorted. All 36 health cases pass in 9.81 seconds.
The existing T-190 constructor fixture supplies the new host map; no assertion
changes. No rates, failure formula, supplies or long fixture commands change.

## Twelve-seed re-measure

Before: [accepted reservation-cleanup rows](../data/2026-10-12-t263-after-wildlife.json).
After: [discharge-retry rows](../data/2026-10-12-t262-after-wildlife.json).
Command: `npm exec -- vitest run -c vitest.perf.config.ts test/perf/wildlife_year.test.ts`,
with WILDLIFE_YEAR_OUT naming the after file. The instrument passes twelve cases in 570.19 seconds.

Median 13, second-worst 9, minimum 0, eight wildlife-free years, one extinction
and zero hunger/thirst deaths before and after. No guard, best measurement,
latest reference, target or tolerance changes. Eleven complete rows and hashes
are identical. Forest seed 3 still goes extinct: Hrolf Stonebrook dies at 53907
instead of 57722, and Lida Stormaxe at 61262 instead of 51187, both bleeding
after boar attacks. Its extinct observation moves from 57740 to 61280; its
hash becomes e18c38044c28ff6f. No outcome class changes.

| Seed | Living before / after | Dwarf deaths before / after | Need deaths before / after |
|---|---:|---:|---:|
| wildlife-temperate_forest-1 | 10 / 10 | 3 / 3 | 0 / 0 |
| wildlife-temperate_forest-2 | 10 / 10 | 3 / 3 | 0 / 0 |
| wildlife-temperate_forest-3 | 0 / 0 | 9 / 9 | 0 / 0 |
| wildlife-temperate_forest-4 | 13 / 13 | 0 / 0 | 0 / 0 |
| wildlife-taiga-1 | 13 / 13 | 0 / 0 | 0 / 0 |
| wildlife-taiga-2 | 12 / 12 | 0 / 0 | 0 / 0 |
| wildlife-taiga-3 | 13 / 13 | 0 / 0 | 0 / 0 |
| wildlife-taiga-4 | 9 / 9 | 2 / 2 | 0 / 0 |
| wildlife-temperate_grassland-1 | 15 / 15 | 0 / 0 | 0 / 0 |
| wildlife-temperate_grassland-2 | 14 / 14 | 0 / 0 | 0 / 0 |
| wildlife-temperate_grassland-3 | 15 / 15 | 0 / 0 | 0 / 0 |
| wildlife-temperate_grassland-4 | 14 / 14 | 0 / 0 | 0 / 0 |

## Browser year

Before and after end-state lines are identical, including the hash. No browser
commands or assertions change.

```
Before
full-year end state: {"livingCount":7,"wealth":2840,"stocks":{"drink":101,"meal":59,"plantFood":50,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":1,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":73740,"level":"watchful"},{"tick":75240,"level":"hearth"},{"tick":77460,"level":"watchful"},{"tick":77480,"level":"calm"},{"tick":77540,"level":"watchful"},{"tick":78960,"level":"hearth"},{"tick":79940,"level":"watchful"},{"tick":85040,"level":"hearth"},{"tick":85720,"level":"watchful"},{"tick":85740,"level":"calm"},{"tick":85780,"level":"watchful"},{"tick":87220,"level":"hearth"},{"tick":88100,"level":"watchful"},{"tick":88120,"level":"calm"},{"tick":88260,"level":"watchful"},{"tick":91020,"level":"hearth"},{"tick":91940,"level":"watchful"},{"tick":91960,"level":"calm"},{"tick":92120,"level":"watchful"},{"tick":93440,"level":"hearth"},{"tick":94040,"level":"watchful"},{"tick":94060,"level":"calm"},{"tick":94200,"level":"watchful"},{"tick":97580,"level":"calm"},{"tick":97860,"level":"watchful"},{"tick":98700,"level":"calm"},{"tick":99000,"level":"watchful"},{"tick":99880,"level":"calm"},{"tick":100120,"level":"watchful"},{"tick":101080,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":62,"tick":74162,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":65,"tick":77932,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":72,"tick":85392,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":77,"tick":91247,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"a4b660f007544cc3"}

After
full-year end state: {"livingCount":7,"wealth":2840,"stocks":{"drink":101,"meal":59,"plantFood":50,"log":55,"stoneBlock":1},"waves":[{"day":29,"count":2,"guaranteed":true},{"day":57,"count":3,"guaranteed":true}],"caravanDay":{"hillfolk":45,"wildwood":73,"mountainhome":null},"trades":0,"starving":1,"alerts":[{"tick":66740,"level":"watchful"},{"tick":68800,"level":"calm"},{"tick":68860,"level":"watchful"},{"tick":71720,"level":"hearth"},{"tick":73740,"level":"watchful"},{"tick":75240,"level":"hearth"},{"tick":77460,"level":"watchful"},{"tick":77480,"level":"calm"},{"tick":77540,"level":"watchful"},{"tick":78960,"level":"hearth"},{"tick":79940,"level":"watchful"},{"tick":85040,"level":"hearth"},{"tick":85720,"level":"watchful"},{"tick":85740,"level":"calm"},{"tick":85780,"level":"watchful"},{"tick":87220,"level":"hearth"},{"tick":88100,"level":"watchful"},{"tick":88120,"level":"calm"},{"tick":88260,"level":"watchful"},{"tick":91020,"level":"hearth"},{"tick":91940,"level":"watchful"},{"tick":91960,"level":"calm"},{"tick":92120,"level":"watchful"},{"tick":93440,"level":"hearth"},{"tick":94040,"level":"watchful"},{"tick":94060,"level":"calm"},{"tick":94200,"level":"watchful"},{"tick":97580,"level":"calm"},{"tick":97860,"level":"watchful"},{"tick":98700,"level":"calm"},{"tick":99000,"level":"watchful"},{"tick":99880,"level":"calm"},{"tick":100120,"level":"watchful"},{"tick":101080,"level":"calm"}],"deaths":[{"day":60,"tick":71912,"kind":"dwarf","name":"Oskar Stonetongue","cause":"bled_out","killerId":50331976,"killerSpecies":"wolf","killerState":"attack"},{"day":62,"tick":74162,"kind":"dwarf","name":"Gefjun Runemark","cause":"bled_out","killerId":251658488,"killerSpecies":"wolf","killerState":""},{"day":65,"tick":77932,"kind":"dwarf","name":"Rurik Oakpick","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":"attack"},{"day":72,"tick":85392,"kind":"dwarf","name":"Sigrun Ashbrook","cause":"bled_out","killerId":50331977,"killerSpecies":"wolf","killerState":""},{"day":77,"tick":91247,"kind":"dwarf","name":"Halvar Cragspark","cause":"bled_out","killerId":318767379,"killerSpecies":"wolf","killerState":""}],"hash":"a4b660f007544cc3"}
```

## Full verification

Six static checks pass: 50 tables / 1624 content rows, 1140 strings,
24 interface documents and 324 docs with no broken links. npm test passes
279 files / 2451 tests in 487.85 seconds. The whole npm run test:e2e passes
25 in 4.6 minutes; screenshots restored. No golden files move.
