# Why a bleeding patient is not treated, and why the fixes do not pass the guards, 2026-10-12

Examined: T-301 and T-211, on the branch `t-301` from `28e2eab`. Method: two probes of the three-year economy fixture (seed `three-years`, peril 0), a probe of `defence_year`, a probe of the annual seed `wildlife-temperate_forest-2`, small stepped tests that fail before each fix, and the twelve-seed instrument for each variant. The `runtimeCommit` field in every data file below says `28e2eab`; the working tree held the named variant.

The trace of T-301's work file (a badger, day 44, commit `edc0d48`) does not repeat: with the four fixture and constant files of `edc0d48` checked out over `28e2eab`, the fixture has no alert and no patient before day 46. Its links are explained below from what the code does and from three other traces.

## The links

| # | Link | Kind | Evidence | State |
|---|---|---|---|---|
| 1 | A hospital's built chest is never stocked. The haul job's work tile is the chest's own tile, which is not walkable (`passable: false`), so the job is `blocked: unreachable` for ever | code fault, `src/systems/items/hauling.ts:264` (the slot tile from `stockpiles.ts:445`) | [haul trace](../data/2026-10-12-t301-hospital-haul-trace.txt): jobs 1360 and 1361, created at tick 46,091 when the chest is built, still blocked on day 45; on day 295 the cloth and thread lie on the surface | fixed on the branch |
| 2 | What lies in a built chest cannot be found or taken: `tileOf` gives −1 for the contents of an `installed` item, the search wants the item's tile to have the searcher's label, and the fetch walks to the item's tile | code fault, `src/systems/items/api.ts:313`, `search.ts:140`, `jobs/steps.ts:116` | the unit test "bandages a patient with cloth taken from the chest" | fixed on the branch |
| 3 | Under a `hearth` alert the gate locks, so supplies left outside (link 1) are in another connectivity label: `stop_bleeding` and `suture` block `missing_input` "with five cloth in stock", and open again when the alert ends | consequence of link 1 | the work file's trace, ticks 52,560 to 52,620, both jobs at once | goes with link 1 |
| 4 | A soldier called to duty keeps the job it held. Nobody steps it and nobody else can take it: the job stays `fetching` | code fault, `src/systems/dwarves/brain.ts:576` (the `work` branch reselects for a soldier and leaves the claim) | the unit test "lets another medic bandage the patient when the first is called to duty"; [forest-2 trace](../data/2026-10-12-t211-forest-2-wolf-trace.txt): three soldiers on duty hold `harvest` jobs for 500 ticks; the work file's trace: `stop_bleeding` `fetching` for 300 ticks under the alert and `open` when it ends; `defence_year`: a `suture` job holds the last thread from tick 29,548 past tick 35,600 | fixed on the branch |
| 5 | A treatment job reserves the whole stack of cloth or thread. A second patient's job is `blocked: missing_input` until the first is finished | code fault, `src/systems/health/producer.ts:205` (the inputs are not `inputUnits`) | `defence_year` with the chest fix: job 941 blocked at tick 28,380 and unblocked at 28,664, when job 936 finished; a two-patient unit test | written and tested, **not on the branch**: T-305 |
| 6 | An open `stop_bleeding` job waits until a worker finishes its own job: workers that hold a job never look at the board | missing rule | `defence_year`: admitted at tick 24,838, three workers carry inputs for builds and crafts with `hasUrgent(id, 1)` true, the bandage is claimed at 25,020 by a dwarf that woke up; the work file's trace: 140 ticks | written and tested, **not on the branch**: T-306 |
| 7 | A medic walks to a patient that stands beside the animal that bit it, is bitten, and is the next patient; the next medic follows | missing rule | [forest-2 trace](../data/2026-10-12-t211-forest-2-wolf-trace.txt), ticks 74,907 to 75,357: two dead in 450 ticks, the second the first one's medic, six more by day 85 | T-307 |
| 8 | A boar puts nine punctures into a militia member in 160 ticks; the dwarf is dead before a medic can cross the map | number | [boar trace](../data/2026-10-12-t301-boar-trace.txt), day 295 | T-145 and `balance.md`: "armour is the answer" |
| 9 | The economy fixture and `defence_year` start with five cloth; in `defence_year` the last patient has none | number | `defence_year`, tick 35,606 | the fixtures' |

## T-211

The parked patch makes a soldier select again on admission. `select` puts `patient` before `duty`, so a soldier that is bitten takes `patient` with the animal beside it: it stops fighting, and with no bed it stands where it is. A fifth case in the patch's test file shows it (`expected 'patient' to be 'duty'`). With the rule "a soldier on duty stays on duty while a hostile is in sight, and takes `patient` when none is" the case passes, and the annual row improves from the patch's 13 / 0 / 0 / 8 of 12 / 2 / 0 to 13 / 3 / 0 / 8 of 12 / 1 / 0. The second-worst guard (8) still fails: forest seed 2 goes from 10 living to 3. In that seed the third boar death of the before row does not happen (the soldier is treated), the timeline then differs, and a wolf pack kills eight between days 63 and 85 by link 7. None of the eight is a soldier in `patient`. [Patch and test](../data/2026-10-12-t211-fight-rule.patch.txt).

The hypothesis that T-211 fails because patients are not treated is half right. Patients are not treated (links 1 to 6). But the annual fixture has no hospital, so links 1 to 3 cannot matter there, and the fixes for 4, 5 and 6 did not make the year safer. The likely reason is link 7: the sooner a medic sets out, the sooner it meets the animal. That is shown in one seed's trace and not yet measured over the twelve (T-307, step 1).

## The guards

Median / second-worst / minimum / wildlife-free / extinctions / need deaths. Bounds: 12 / 8 / none / 6 / 1 / 1.

| Variant | Row | Verdict | forest 1, 2, 3, 4 | taiga 1, 2, 3, 4 | Data |
|---|---|---|---|---|---|
| Before, `28e2eab` | 13 / 8 / 0 / 8 of 12 / 1 / 0 | reference | 8, 10, 0, 13 | 13, 12, 13, 8 | [rows](../data/2026-10-12-t301-before-wildlife.json) |
| Links 1, 2, 5 | 13 / 0 / 0 / 8 of 12 / 2 / 0 | rejected | 8, 9, 0, 13 | 13, 12, 13, 0 | [rows](../data/2026-10-12-t305-units-wildlife.json) |
| Links 1, 2 and T-211 with the fight rule | 13 / 3 / 0 / 8 of 12 / 1 / 0 | rejected | 11, 3, 0, 13 | 13, 12, 13, 8 | [rows](../data/2026-10-12-t211-fight-rule-wildlife.json) |
| Links 1, 2, 4 (the branch) | 13 / 6 / 0 / 8 of 12 / 1 / 0 | rejected | 13, 6, 0, 12 | 13, 7, 13, 11 | [rows](../data/2026-10-12-t301-after-wildlife.json) |

The four grassland seeds are 15, 14, 15, 14 with unchanged hashes in every row. The sum of the living is 135 before and 126, 131 and 133 after: the changes move deaths between seeds. The second-worst reference is 8 and its bound is 8, so a row passes only if at most one seed is under 8. Forest seeds 1 and 2 and taiga seeds 2 and 4 each change by five or more under a change of the job timeline; with the two seeds already recorded as unstable that is four distinct seeds (T-308).

`defence_year` (in `npm test`) fails with every variant. It has no alert response and one dwarf bleeds to death in the before run; which dwarf dies decides its assertions.

| Variant | Dwarf deaths by day 35 | The assertion that fails |
|---|---|---|
| Before | 1 | none |
| Links 1, 2, 5 | 1 | the lever is not linked: the dead dwarf is the free mechanic |
| Links 1, 2 | 3 | the squad has 3 members, not 4 |
| Links 1, 2, 4 (the branch) | 3 | the squad has 3 members, not 4 |
| Links 1, 2, 6 | 6 | the lever is not linked |
| Links 1, 2 and the parked T-211 patch, with or without the fight rule | 5 | a building is still planned |

## What is on the branch

Links 1, 2 and 4, with five stepped tests in `test/unit/health/t301-hospital-supplies.test.ts` (each seen to fail first) and the spec edits. It is a work-in-progress commit: `defence_year` fails and the annual second-worst guard rejects the row. Nothing was tuned and no guard was changed.

## Findings that need work

- T-305: treatment jobs reserve whole stacks (link 5).
- T-306: an open bandage job waits for a free worker (link 6).
- T-307: medics walk to a patient beside its attacker (link 7). The treatment fixes probably need it first.
- T-308: the annual cohort has four seeds that change class under any change of the job timeline, the second-worst guard has no slack, and `defence_year` depends on which dwarf a boar kills.
