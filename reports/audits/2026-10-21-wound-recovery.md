# Measurement: wound recovery and infection

**Task:** T-367 · **Date:** 2026-10-21 · **Commit examined:** master `a5cd51c` · **Kind:** measurement; no constant, formula or content value was changed · **Source:** [unmeasured spec numbers](2026-10-17-unmeasured-spec-numbers.md), rank 4

## The answer

- **A light cut is a hospital visit.** With a medic it is bandaged, cleaned and discharged in 0.3 days and gone in 5 (`HEAL_BASE_TICKS` 6,000), and nobody dies of it. Without a medic it clots by itself, but 12 of 30 become infected (an uncleaned wound, `INFECTION_PERMILLE` 100 a day while it lasts) and 6 die of the infection, which nothing cures.
- **A serious cut kills one patient in five under a skilled medic, and every one of those deaths is a failed bandage.** One wound a day in a ward with beds, a stocked chest and a medic of skill 5 standing by: 6 of 30 die, bled out, and each of the six had its first `stop_bleeding` fail (`TREAT_FAIL_PERMILLE` 200 − 10 × skill = 15%); none of the 24 whose first bandage held died. The bandage comes a median 365 ticks after the wound; a serious cut (bleed 3 a health tick) takes a dwarf unconscious at about 600 ticks and dead at about 800, and the second bandage does not come in time. At skill 0, 7 of 30 die (two of them of infection). A serious puncture (bleed 4): 5 of 30 (17 of 30 lose consciousness).
- **A grievous cut kills half the patients even when the bandage succeeds.** Bleed 6 a health tick: unconscious at a median 302 ticks, dead at 387; the bandage comes at 380. 16 of 30 die at skill 5 (13 of them before any bandage was finished), 18 at skill 0.
- **The walk to the bed costs the first bandage about a hundred ticks.** The same ward with no beds (patients rest where they stand): the first bandage at a median 263 to 311 ticks instead of 365 to 500, and deaths fall to 2 of 30 for a serious cut and 7 of 30 for a grievous one.
- **Without a medic, every wound that bleeds until bandaged kills**: 27 to 30 of 30 for serious and grievous cuts, punctures, fractures (they bleed 1 and 2) and serious burns (bleed 1).
- **Days out of work.** A medic sutures, splints and dresses, and patients leave the hospital fast except for a grievous fracture: discharge after a median 0.3 days for cuts and punctures, 1.2 for a serious fracture (3.7 at skill 0), 2.1 for a serious burn, and **30.6 days for a grievous fracture**, whose pain stays above `PAIN_DISCHARGE` (45 × the Willpower factor, about 34 against 30) until it heals: more than a season. Full healing: light 5 days, serious cut or puncture 10.3 (15 × `SUTURED_HEAL_PERCENT` 150), serious fracture 15.9, serious burn 15, grievous cut 20.3, grievous fracture 30.7: `HEAL_BASE_TICKS` × 1, 3 and 6 to within a day.
- **One medic for many wounded is the bottleneck.** The same thirty wounds one every 400 ticks (a fight's worth in three days): the first bandage of a serious cut slips to a median 514 ticks and deaths rise to 18 of 30 (9 bled out, 9 of infection, cleaning comes late); a serious fracture kills 11 and keeps survivors 11 days; a grievous fracture 38 days. Infection deaths appear even for light cuts (4 of 30).
- **Brightleaf and beds matter less than the medic.** Without brightleaf the infection deaths rise only where the medic is loaded (one wound every 400 ticks: 12 of 30 serious cuts die of infection against 9). With no beds, nobody was infected at one wound a day; under load the floor ward had more infections than the bedded one (19 of 30 serious cuts against 11) but fewer bleeding deaths.
- **Medic time:** a median 630 to 950 ticks of the medic's work per patient (bandage, suture or splint, cleaning, diagnosis, walks and fetches).
- **The marks of the numbers measured are replaced by this report:** `LIGHT_MAX` / `SERIOUS_MAX`, `HEAL_BASE_TICKS`, `SUTURED_HEAL_PERCENT`, `INFECTION_PERMILLE`, `INFECTION_DEATH_PERMILLE`, `TREAT_FAIL_PERMILLE`, `PAIN_DISCHARGE`, `BLOOD_UNCONSCIOUS_PERCENT` (unconscious at 40% of blood, as the death times show). `BLOOD_REGEN_PER_TICK`, `PAIN_UNCONSCIOUS`, `INFECTION_CURE_DAYS` (no cure observed against a timed infection), `UNTREATED_FRACTURE_PERCENT` and the hospital's default supplies stay *unmeasured*.
- **What should change: a failed bandage should not kill a patient a skilled medic attends.** Filed as [the first bandage decides a serious wound](../../docs/archive/tasks/T-405-first-bandage-decides-a-serious-wound.md). Bleeding to death after a fight, the main cause of death of the measured fortresses, is this ward's result: a serious cut bleeds out in 800 ticks, a grievous one in 390, and a bandage that fails or comes from a bed's distance is too late.

## What was run

`reports/data/2026-10-21-wound-recovery.probe.ts.txt` (a vitest file under `test/perf`, not committed as a test), at `a5cd51c`: a stepped ward on the `flat-test` map with no embark and no wild animals. A hospital zone with 40 beds (none in the floor case) and a chest; a stockpile with cloth, thread, splints, crutches, buckets and brightleaf (none in the no-brightleaf case), meals and drink renewed every ten days; a well. One medic with only the medicine labor (skill 5, or 0), two haulers, thirty patients with every labor off. Each patient gets one wound through the damage path (`DamageDealt`, as 16 deals it): a cut of 9, 21 or 36 to the torso (light, serious, grievous), a puncture of 21 to the torso, a blunt hit of 13 or 22 to a leg (serious and grievous fracture), a burn of 13 to an arm. One wound every 1,200 ticks (one a day; the main table) and every 400 (the loaded medic), for up to 60 days.

The data (`…-wound-recovery.json`) holds every patient (wound, admission, first bandage, unconsciousness, infection, discharge, healing, death and cause, treatments done and treatment jobs completed, medic ticks) and the summary made by `…-wound-recovery-summary.mjs.txt`. A treatment job completed without its `TreatmentDone` is a failed treatment.

## One wound a day, 30 patients a case

| Wound | Medic 5: died (cause) | Medic 0: died | No medic: died | Medic 5, no beds: died | Unconscious (medic 5) | First bandage, median ticks (5 / floor) | Discharge, days | Healed, days |
|---|---|---|---|---|---:|---|---:|---:|
| Light cut (9) | 0 | 1 (infection) | 6 (infection) | 0 | 0 | 383 / 372 | 0.3 | 5.0 |
| Serious cut (21) | 6 (bled out) | 7 | 28 | 2 | 6 | 365 / 309 | 0.3 | 10.3 |
| Grievous cut (36) | 16 (bled out) | 18 | 30 | 7 | 27 | 380 / 263 | 0.6 | 20.3 |
| Serious puncture (21) | 5 (bled out) | 8 | 28 | 2 | 17 | 432 / 294 | 0.4 | 10.3 |
| Serious fracture (13, leg) | 0 | 0 | 27 | 0 | 1 | 633 / 305 | 1.2 | 15.9 |
| Grievous fracture (22, leg) | 2 (bled out) | 6 | 27 | 0 | 8 | 501 / 311 | 30.6 | 30.7 |
| Serious burn (13, arm) | 4 (3 infection) | 6 (infection) | 26 | 0 | 1 | 400 / 387 | 2.1 | 15.0 |

Failed treatments at skill 5: 4 to 21 per case of 67 to 137 treatment jobs (6% to 16%), at skill 0 11 to 20 (10% to 17%), against 15% and 20% by the rule.

## What this does not measure

- A fight's wounds, which come several to a dwarf and to several dwarves at once: the 400-tick case is the nearest.
- Miasma, infection from floor sleep and limb loss.
- A fortress's medic, who also has other work; here the medic does nothing else.
- Animals' bandaging.
