# T-261 - An infection appearing after job planning is cured without brightleaf

**Source:** T-137 stepped-treatment investigation, 2026-10-11 | **Size:** S | **Needs:** none | **Status:** open

## Finding and reproduction

The initial T-137 regression staged `DamageDealt` (edge, torso, 15) in a flat
`TestWorld` with seed `t137-cure-1-20`, a patient, bed and medicine-20 medic.
After two ticks, 11 had planned an uninfected `clean_wound` with no brightleaf
input. The probe then marked the actual cut bandaged, sutured, cleaned and
infected, before making a bucket and ten brightleaf available. Successful
completion set the infection's `curedAt`, but all ten brightleaf remained.
This is a staged timing reproduction, not a measured natural infection run.

`HealthProducer.produce` chooses brightleaf inputs from the infection state at
planning time; `onComplete` selects a wound from its current state without
checking that this job brought the required brightleaf. T-137's permanent tests
stage infection before job production to test an infection job with real inputs.

## Proposed resolution and done

Before an uninfected cleaning job can treat a newly infected wound, revalidate
its required input. If the planned job lacks the brightleaf now required,
cancel and recreate it with the correct input, releasing its tool and other
reservations under 11's normal cancellation rule. Do not consume another
wound's pending cure supplies, cure without brightleaf, or restart a cure.

Turn the staged timing reproduction into a failing stepped regression, with a
control in which the job remains uninfected and needs no brightleaf. Also stage
infection while the job waits for its bucket. Write the input revalidation rule
into 17's Patients and the health algorithm, then verify six static checks,
`npm test`, whole e2e and the wildlife instrument as required for treatment
changes. Record full-year states and name any golden change. No treatment rate
or cure-duration change.
