# T-152 — A hospital and burial run

**Source:** T-114 and its report, [`../../../reports/audits/2026-10-08-playthrough-coverage.md`](../../../reports/audits/2026-10-08-playthrough-coverage.md) (gap 2) · **Size:** M · **Needs:** — · **Status:** closed

## Why

No long playthrough has a hospital, a well, a coffin or a tomb. In the measured peril-4 run 13 patients were admitted and none was treated, and 13 fortress creatures died and none was buried. The `he_*` scenarios each test one treatment in a prepared room. Three medical jobs (`suture`, `dress_burn`, `give_crutch`) are completed in no test that steps a world, and `bandage_animal` is named in no test.

## Decisions

- **A new scenario, `hospital_run`**, in `test/scenarios/hospital_run.scenario.ts`. Flat-test map, Balanced embark, 30 days.
- **The fortress is built by commands.** The scenario places and lets the dwarves build: a hospital zone with beds, a table and a chest, a well, a tomb zone with coffins, a memorial slab; it sets the hospital supplies (`SetHospitalSupplies`) and has thread, cloth, splints, crutches and bandages made in the workshops or brought by the embark. Setup may use `spawnItem` for raw materials only, so that the run stays short.
- **The casualties are made by the simulation.** The scenario spawns a small hostile party at the map edge on day 5 (the spawn API, as `th_*` scenarios do) and one fire beside a dwarf. It does not write wounds into components.
- **Assertions:**
  - every wounded dwarf who survives is admitted, diagnosed, treated and discharged: `PatientAdmitted`, `TreatmentDone` and `PatientDischarged` for each, and `PatientHealed` for at least one;
  - `TreatmentDone` occurs with each kind the wounds call for; across the run at least `stop_bleeding`, `clean_wound`, `suture`, `set_bone` and `dress_burn`;
  - a dwarf who lost the use of a leg gets a crutch (`give_crutch` completes) if the fight produces one; if not, the scenario says so in its output and does not fail;
  - `feed_patient` and `water_patient` complete, with water from the well;
  - every dwarf who dies is buried (`Buried`) in an assigned or free coffin, and the `unburied_dead` thought is absent at the end;
  - a wounded tame animal is bandaged (`bandage_animal`) if 08 and 17 provide that job. If no code creates the job, file a bug row and leave the assertion out.
- **It runs in `npm test`** with `milestone: 8`.

## What to do

1. Write the scenario.
2. Add it to `04-implementation/acceptance-tests.md`.
3. File a row for every job type that cannot be reached.

## Done

- `hospital_run` passes in `npm test`.
- The verification commands of [`../../process/agent-workflow.md`](../../process/agent-workflow.md) are green.
