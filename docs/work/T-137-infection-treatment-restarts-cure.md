# T-137 - Repeated infection cleaning restarts a cure already in progress

**Source:** T-224 treatment-refresh investigation, 2026-10-11 | **Size:** S | **Needs:** none | **Status:** open

## Finding and reproduction

17's infection rule says that successful cleaning with brightleaf cures an
infection after `INFECTION_CURE_DAYS`. `updatePatient` still requests
`clean_wound` for every infected wound, including a cleaned wound with a pending
`curedAt`. `HealthProducer.onComplete` selects the first infected wound and
unconditionally assigns another cure deadline. As long as supplies and the
medic are available, repeated jobs can keep pushing the cure into the future.

A direct completion probe on the T-224 worktree, base `539226d`, used a serious
cut marked bandaged, sutured, cleaned and infected, a diagnosed patient and a
medicine-20 worker (no treatment failure). Completing `clean_wound` at tick 100
set `curedAt` to 3700 and left the patient's needs as `['clean_wound']`.
Completing it again at tick 200 moved the deadline to 3800; the need remained.
This is distinct from an uninfected treated patient waiting only for pain.

The code paths are `src/systems/health/tick.ts` (`updatePatient`, cleaning need)
and `src/systems/health/producer.ts` (`clean_wound` completion, first infected
wound and assignment of `curedAt`).

## Proposed resolution and done

Preserve an infection's first successful cure deadline. A cleaned infected wound
whose cure is already pending must not request another cleaning or consume
another bucket or brightleaf. Keep the patient admitted for the infection until
the existing cure completes. If a different wound needs cleaning, select that
wound instead of restarting the already treated infection. Failed treatment
continues to require care under the existing failure rule.

Add a failing stepped regression with real supplies and a medicine-20 worker:
record the first deadline and inputs consumed, step through it, require exactly
one successful infection treatment and one `InfectionCured`, and assert that
the deadline never moves. Also cover a second untreated infection and treatment
failure. Edit 17's Infection and Patients rules and the health algorithm; run
the six checks, npm test and whole e2e suite with before/after full-year states.
Name any golden change and its cause. Do not change cure time or failure rates.
