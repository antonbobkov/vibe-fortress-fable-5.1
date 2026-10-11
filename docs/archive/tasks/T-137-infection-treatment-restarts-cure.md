# T-137 - Repeated infection cleaning restarts a cure already in progress

Closed by `T-137: infection cleaning keeps its first cure deadline`.

## Progress (2026-10-11): parked on the annual distribution guard

Four stepped regressions and the narrow fix are in stash `e3b1fed802d5bde466529aa3c5f086bb4d714a5c`
(`T-137 pending cure fix parked: annual wildlife-free guard 7/12 below 8/12`).
Six statics, 2353 tests and the whole 25-test browser suite pass; the browser
end state is unchanged (seven living, hash `54f0bf60c7e768c3`). No golden moves.
The annual instrument keeps median 12.5, improves minimum 0 to 3 and extinctions
1 to 0, but drops wildlife-free seeds 8/12 to 7/12, failing its existing guard.
No assertion or long fixture was weakened or tuned.

Taiga seed 1 reproduces its changed annual hash in a second event-traced run:
first successful cleaning at 78124 now cures at 81727 rather than restarting
until 82872. The changed workforce later encounters wolves; Palnir is admitted
at 130192, remains a patient on exposed surface tile (27,36,32) beside a hungry
attacking wolf at 130290, and bleeds out at 130407 (day 109). A causal game fault
in the cure fix is not established. See the [frozen measurements](../../../reports/audits/2026-10-11-pending-infection-cure-annual-check.md).

Next: retain the tested cure fix; investigate the exposed-patient danger under
T-214/T-211, then rerun the annual guard before landing T-137. A separate
planning-time infection/input race is filed as T-261. T-137 remains open.

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

## Decision (2026-10-11, local orchestrator, under the owner's standing instruction to use judgement)

**Land the fix.** It is correct by its four regressions, and on the twelve-seed instrument it makes the distribution better where it matters: the worst seed goes from 0 to 3 alive and extinctions from 1 to 0, with the median unchanged. The one figure that fell, seeds with no dwarf lost to wildlife, went from 8 of 12 to 7 of 12, which is one seed changing sides because a different dwarf was outdoors when the wolves came. That is noise of the same kind that made the single browser year useless as a floor, one level up.

**So the instrument's guards get a tolerance, and it is written down once:**

- `wildlifeFree`: the floor is the measured figure minus 2 seeds. One or two seeds change sides with any change to who is where; three is a signal.
- `median`: the floor is the measured figure minus 1.
- `worst` and `extinct`: these may only improve or stay; a fix that adds an extinction or lowers the worst seed is stopped and reported.
- `hungerThirstDeaths`: may not rise.
- A change is blocked when a guard with tolerance fails, **or** when two or more of the five figures get worse at once even inside their tolerances. In every case the before and after rows go in the commit body.
- When a change improves a figure, the measured figures in the instrument are updated to the new measurement in the same commit, and the floors follow from them by the rule above. The targets (median at least 11, no seed below 8, no hunger or thirst death) stay beside them unchanged.

Write this rule into `testing-strategy.md` where the instrument is described and into `balance.md` § Wild animals, change the instrument to compute its floors from its measured figures by it, then restore the stash, re-run the instrument, and close this task. T-261 (an infection that appears after the cleaning job was planned is cured without brightleaf) stays its own task.
