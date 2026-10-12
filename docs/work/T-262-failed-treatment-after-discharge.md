# T-262 - A failed treatment is not recreated after patient discharge

**Source:** T-223 stepped hospital trace, [raw events](../../reports/data/2026-10-11-t223-failed-suture.json), 2026-10-11 | **Size:** M | **Needs:** none | **Status:** open

## Finding

In `hospital_run` with the one-bed/one-holder fix before its fixture-role correction,
serious-cut patient 184549575 is admitted at tick 6394. Bandaging succeeds and the
patient is discharged at 6679 with pain 11, which satisfies 17's discharge
criteria while the serious cut still needs suturing. Suture job 157 is claimed
at tick 6765 and completed at 7056 by dwarf 16777279 with medicine 0.
There is no suture `TreatmentDone`, the thread is consumed, the wound remains
unsutured, and the job is never recreated. Recorded event ticks are the delivery
boundary in the raw trace; their payload snapshots establish the remaining wound.

`HealthProducer.onComplete` handles a failed treatment by consuming its inputs
and calling `updatePatient`. The target no longer meets admission criteria, so
that call does not restore `Patient`. `produce` visits admitted patients only;
the unfinished failed treatment has no retry request. 17's Patients and hospitals
says a failed treatment consumes its input without effect and the job is recreated.
That rule names no exception for a patient discharged before completion.

Restricting `hospital_run` to its intended medicine-20 medic makes its care
coverage deterministic and leaves this low-skill game path for a separate fix.

## Proposed resolution

Preserve a failed, still-needed treatment request through the ordinary producer
phase even when its target has been discharged. Do not readmit a dwarf that fails
17's admission criteria. Recreate only if the living target still has the wound
requiring that treatment; otherwise end the request. Use ordinary job input and
reservation handling, save pending requests, and never restart an infection cure.

## Done

Turn this discharge/completion timing into a small stepped failing regression,
with a successful-treatment control and a no-longer-needed-treatment control.
Fold the retry rule into 17's Patients and the health algorithm/state schema;
verify six static checks, `npm test`, the whole browser suite and the twelve-seed
instrument, recording before/after rows and naming any golden change.
