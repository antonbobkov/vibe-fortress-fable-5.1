# Measurement: care jobs end with their need

**Task:** T-414 · **Date:** 2026-10-21 · **Commit examined:** master `1c98234` (before) and `1c98234` with the T-414 change (after) · **Kind:** re-measure after a rule change; no constant, formula or content value was changed · **Source:** [the medic cleans only wounds that can be infected](2026-10-21-clean-exposed-wounds.md)

## The answer

- **The rule:** every treatment job (`stop_bleeding`, `set_bone`, `suture`, `clean_wound`, `dress_burn`) ends once no wound of its dwarf needs that treatment, admitted or not, also while it is under way. `diagnose` ends after discharge once no wound needs a treatment. `give_crutch` outlives discharge. A failed treatment stays a request after discharge while its wound needs it, as before.
- **A clotted light cut costs no cloth and half the medic's time it used to.** A light cut clots 150 ticks after the wound and its dwarf is discharged then. The bandage job made at admission used to be done anyway, a median 286 ticks after the wound, with a unit of cloth and nothing to bandage. Now it is cancelled at the clot. Cloth for 30 light cuts: **30 → 0**. Medic ticks per patient: 557 → 298 at one a day, 528 → 261 under load (skill 5).
- **Under load the light cut stops dying.** One light cut every 400 ticks: 9 of 30 were infected and 3 died before, because the medic spent half its time on empty bandages and reached the cleaning late. After: none infected, none dead, and the medic's time bandaging falls from 50% to 12%.
- **Diagnosis now mostly ends unfinished.** `diagnose` is the lowest priority. A dwarf discharged before it comes, and whose wounds need nothing more, is not diagnosed. Diagnoses fall from 30 to 0–5 a case, except the grievous fracture (29), whose patient stays admitted for its pain. A diagnosis changes no treatment: it shows a patient's wounds in full in the inspector and gives the medic `DIAGNOSE_XP`, and a discharged dwarf's wounds are shown in full anyway. So the change costs the medic experience and nothing else. Medic ticks per patient fall 0% to 18% for the other wounds (serious cut 559 → 458).
- **Deaths, healing and discharge hold.** Cloth and thread for the other wounds change only with the number of survivors. Two single deaths at skill 0 are new: one light cut of infection, one serious puncture bled out. Neither case's cause is touched by this change. The skill-5 grievous cut falls from 7 to 1, which is chance: four seeds gave 1 to 7 in [the T-413 run](2026-10-21-clean-exposed-wounds.md).

## What was run

The ward probe of [wound recovery](2026-10-21-wound-recovery.md) (`reports/data/2026-10-21-wound-recovery.probe.ts.txt`), copied to `test/perf/` with the T-413 recording additions (per-patient job and treatment log, medic time by job until 2,400 ticks after the thirtieth wound). Cloth used is the completed `stop_bleeding` and `dress_burn` jobs, thread the completed sutures. The loaded ward: `med5`, `T367_GAP=400`, light cut, serious cut, serious puncture, grievous cut. The one-a-day ward: `med5` and `med0`, `T367_GAP=1200`, all seven wounds. `T367_DAYS=60`. Figures are in [`2026-10-21-care-jobs-end-with-need.json`](../data/2026-10-21-care-jobs-end-with-need.json).

## One wound every 400 ticks, medic 5, before → after

| Wound | Died | Infected | Cloth | Diagnoses | Medic ticks per patient | Medic time bandaging / cleaning | Healed, days |
|---|---|---|---|---|---|---|---|
| Light cut (9) | 3 → **0** | 9 → 0 | 30 → **0** | 27 → 0 | 528 → 261 | 50% / 11% → 12% / 43% | 5 → 5 |
| Serious cut (21) | 0 → 0 | 0 → 0 | 30 → 30 | 27 → 0 | 528 → 452 | 46% / 0% → 46% / 0% | 13.5 → 13.5 |
| Serious puncture (21) | 4 → 4 | 0 → 0 | 26 → 26 | 26 → 0 | 563 → 478 | 47% / 0% → 47% / 0% | 12.5 → 12.5 |
| Grievous cut (36) | 14 → 14 | 0 → 0 | 16 → 16 | 16 → 0 | 500 → 426 | 38% / 0% → 38% / 0% | 21.3 → 21.3 |

Discharge is 0.1 to 0.3 days in every case before and after.

## One wound a day, before → after

| Wound | Died, medic 5 / medic 0 | Cloth, medic 5 | Diagnoses, medic 5 | Medic ticks per patient, medic 5 / medic 0 | Healed, days (medic 5) |
|---|---|---|---|---|---|
| Light cut (9) | 0 / 0 → 0 / 1 (infection) | 30 → **0** | 30 → 1 | 557 / 628 → 298 / 356 | 5 → 5 |
| Serious cut (21) | 0 / 0 → 0 / 0 | 30 → 30 | 30 → 2 | 559 / 642 → 458 / 566 | 10.2 → 10.3 |
| Grievous cut (36) | 7 / 12 → 1 / 11 | 23 → 29 | 23 → 5 | 556 / 527 → 488 / 477 | 20.3 → 20.2 |
| Serious puncture (21) | 0 / 0 → 0 / 1 (bled out) | 30 → 30 | 30 → 1 | 592 / 629 → 487 / 537 | 10.2 → 10.2 |
| Serious fracture (13, leg) | 0 / 0 → 0 / 0 | 30 → 30 | 30 → 4 | 772 / 794 → 744 / 742 | 15.8 → 15.8 |
| Grievous fracture (22, leg) | 0 / 1 → 0 / 1 | 30 → 30 | 30 → 29 | 756 / 921 → 756 / 939 | 30.6 → 30.6 |
| Serious burn (13, arm) | 0 / 0 → 0 / 0 | 67 → 69 | 30 → 2 | 635 / 705 → 546 / 689 | 15 → 15 |

## Annual wildlife instrument

Before (`1c98234`, the T-413 row, not re-run: since T-413 only T-412 changed `src/`, and its run kept every world hash): median 13, worst 2, second-worst 8, living 140, wildlife-free 8, extinct 0, hunger/thirst 0. After (`1c98234` with this change): **the same row**. Eleven seeds keep their world hash; taiga seed 3 changes its hash with the same eleven deaths on the same days. Every guarded figure holds, and none worsens.

## What this does not measure

- A fortress with several medics, or a Chief Medic whose diagnoses come first.
- The medic's skill: a diagnosis gives `DIAGNOSE_XP`, and fewer diagnoses mean slower medicine training. The inspector hides an undiagnosed dwarf's wound detail only while it is a patient (`src/ui/panels/look.ts`), so a dwarf discharged undiagnosed shows its wounds in full.
