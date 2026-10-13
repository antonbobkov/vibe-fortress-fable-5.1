# T-305 — A treatment job reserves the whole stack of cloth or thread

**Source:** T-301 and [`../../reports/audits/2026-10-12-bleeding-patients-and-the-duty-guard.md`](../../reports/audits/2026-10-12-bleeding-patients-and-the-duty-guard.md) (link 5) · **Size:** S · **Needs:** — · **Status:** open

## Why

A medic job asks 11 for one item of its category, and a stack of five cloth is one item. The job reserves the stack, carries all of it to the patient and leaves the rest beside the patient. While it is reserved, a second patient's `stop_bleeding`, or the same patient's `dress_burn`, is `blocked: missing_input` with cloth in stock. In `defence_year` with T-301's chest fix a second bandage job waited from tick 28,380 to 28,664 for the first to finish.

## What to do

In `src/systems/health/producer.ts` give the six jobs that consume a supply (`stop_bleeding`, `set_bone`, `suture`, `clean_wound`, `dress_burn`, `bandage_animal`) `inputUnits: true`, so that 11's claim reserves one unit split from the stack (11 § Assignment step 4). The change and two tests that fail without it are in [`2026-10-12-t305-treatment-units.patch.txt`](../../reports/data/2026-10-12-t305-treatment-units.patch.txt). Fold into 17 § Patients and hospitals: inputs are counted in units, and the rest of the stack stays in store.

One consequence to settle with a measurement: where there is no hospital, the rest of the stack used to lie beside the patient, and a retry after a failed treatment found it there. With units, the retry walks back to the store.

## Measured so far

With T-301's chest fix and this change the twelve-seed instrument gave 13 / 0 / 0 / 8 of 12 / 2 / 0 against 13 / 8 / 0 / 8 of 12 / 1 / 0 ([rows](../../reports/data/2026-10-12-t305-units-wildlife.json)): taiga seed 4 went from 8 living to extinct. The change was taken out again. Measure it again after T-307.

## Done

- Two patients are bandaged at once from one stack, with a test that names T-305.
- The twelve-seed instrument accepts the row.
