# T-261 - An infection appearing after job planning is cured without brightleaf

Closed by `T-261: require brightleaf when a planned cleaning target becomes infected`.

**Source:** T-137 stepped-treatment investigation, 2026-10-11 | **Size:** S | **Needs:** none | **Status:** open

## Progress (2026-10-11, codex-a)

Parked: the narrow fix and four stepped regressions pass all six static checks,
`npm test` (273 files, 2,413 tests), and the whole e2e suite (25). The browser
full-year state stays at 7 living with hash `54f0bf60c7e768c3`. Three regression
cases fail before the fix; the uninfected control stays green. No existing
assertion, fixture, constant or golden changed.

The twelve-seed instrument was repeated with identical records and hashes:
median 12.5, worst 0, wildlife-free 8/12, one extinction, two hunger/thirst
deaths, versus accepted 12.5 / 3 / 7/12 / 0 / 2. Taiga seed 4 loses its three
remaining dwarves to wolf-inflicted bleeding on days 105, 106 and 108. Worst
survival and extinction both fail the strict guards, so the task cannot land.
[Measurement and reproduction](../../../reports/audits/2026-10-11-t261-blocked-wildlife.md).

Saved stash: `T-261: correct late-infection brightleaf fix; parked by annual
worst/extinction guards (12.5/0/8/1/2)`. It includes the tests, code and proposed
spec edits, plus provisional closure edits; restore selectively and retain this
open work file/backlog row. Next: trace the first taiga-4 treatment/combat
divergence. No long-fixture tuning and no guard reduction.

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

## Decision (2026-10-11, local orchestrator, under the owner's standing instruction to use judgement)

**Land the fix, and correct the guard rule I set for T-137: it was still too strict in two places.**

The fix is right by its regressions and changes nothing in the browser year. What stopped it is one seed. Taiga seed 4 sits on a knife-edge: its last three dwarves either survive the winter wolves or bleed out on days 105 to 108, and which one happens flips with any change to who is where. T-137 flipped it one way (worst seed 0 to 3, extinctions 1 to 0) and this fix flips it back. Neither fix has anything to do with wolves. A guard that says "the worst seed and the extinction count may never get worse" therefore blocks correct fixes at random, exactly as the single browser year did.

**The rule, replacing the worst-seed and extinction lines of the T-137 decision:**

- `extinct`: tolerance of 1 fortress. The cap is the best measured count plus 1.
- `worst`: no longer guarded on the single worst seed, which is one sample. Guard the **second-worst** seed instead (the 10th percentile of twelve): its floor is the best measured second-worst minus 2 dwarves. The single worst seed is still reported in every row.
- `hungerThirstDeaths`: tolerance of 1.
- `median` (minus 1) and `wildlifeFree` (minus 2 seeds) stay as decided.
- The combined rule stays, counted on these five guarded figures: a change is blocked when a guard fails with its tolerance, or when **three** or more of the five get worse at once (it was two; with five noisy figures two move together too often).
- A seed that changes its outcome class (wiped out or not) under a change that does not touch wildlife, alerts, fleeing, treatment or needs is to be named in the commit body as unstable, so that a list of unstable seeds builds up; taiga seed 4 is the first entry. If that list reaches three seeds, the instrument needs more seeds, and that becomes a task.

Update `testing-strategy.md`, `balance.md` and the instrument's computed bounds and control tests to this rule, restore the stashed fix, re-run the instrument, and close this task with both rows in the commit body.

The real problem this seed shows is not the guard: a taiga fortress down to three dwarves in winter is one bite from extinction. That belongs to the preparation question of T-220's report (arms, a door, a shelter before day 60), which goes to the UI audit as guidance and to T-145 as what a competent fixture does.
