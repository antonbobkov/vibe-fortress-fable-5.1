# Measurement: care jobs end with their need

**Task:** T-414 · **Date:** 2026-10-21 · **Commit examined:** master `1c98234` (before) and `1c98234` with the T-414 change (after) · **Kind:** re-measure after a rule change; no constant, formula or content value was changed · **Source:** [the medic cleans only wounds that can be infected](2026-10-21-clean-exposed-wounds.md)

## The answer

- **The rule:** every treatment job (`stop_bleeding`, `set_bone`, `suture`, `clean_wound`, `dress_burn`) ends once no wound of its dwarf needs that treatment, admitted or not, also while it is under way. `diagnose` goes on after discharge while the dwarf has a wound and ends once none remains. `give_crutch` outlives discharge. A failed treatment stays a request after discharge while its wound needs it, as before.
- **A clotted light cut costs no cloth and a third less medic time.** A light cut clots 150 ticks after the wound and its dwarf is discharged then. The bandage job made at admission used to be done anyway, a median 286 ticks after the wound, with a unit of cloth and nothing to bandage. Now it is cancelled at the clot. Cloth for 30 light cuts: **30 → 0**. Medic ticks per patient: 557 → 396 at one a day, 528 → 267 under load (skill 5).
- **Under load the light cut stops dying.** One light cut every 400 ticks: 9 of 30 were infected and 3 died before, because the medic spent half its time on empty bandages and reached the cleaning late. After: none infected, none dead, and the medic's time bandaging falls from 50% to 12%.
- **Every other case at one wound a day is unchanged.** Deaths, cloth, thread, medic time, discharge and healing are the same as before, to the tick in most cases. The one other change is diagnoses for a serious fracture: 30 → 18 at skill 5, 30 → 19 at skill 0. A dwarf discharged with a splinted leg is diagnosed a median 13.8 days after the wound at skill 5 (15.3 at skill 0), and up to 28 days. Every other wound is diagnosed within a median day of the wound. A diagnosis later than the healing (15.8 days) now ends unfinished.
- **Under load, diagnoses that come after the healing end unfinished:** light cut 27 → 7, serious cut 27 → 7, serious puncture 26 → 14, grievous cut 16 → 16. A diagnosis changes no treatment. It shows a patient's wounds in full in the inspector and gives the medic `DIAGNOSE_XP`. A dwarf with no wound left has nothing to show.
- **A splinted leg is diagnosed weeks late.** In the one-a-day ward the medic is idle 5% of the time while those diagnoses are open. This run does not say why. Filed as [a discharged dwarf with a splinted leg is diagnosed weeks late](../../docs/work/T-NEW-diagnosis-weeks-late.md).

## What was run

The ward probe of [wound recovery](2026-10-21-wound-recovery.md) (`reports/data/2026-10-21-wound-recovery.probe.ts.txt`), copied to `test/perf/` with the T-413 recording additions (per-patient job and treatment log, medic time by job until 2,400 ticks after the thirtieth wound). Cloth used is the completed `stop_bleeding` and `dress_burn` jobs, thread the completed sutures. The loaded ward: `med5`, `T367_GAP=400`, light cut, serious cut, serious puncture, grievous cut. The one-a-day ward: `med5` and `med0`, `T367_GAP=1200`, all seven wounds. `T367_DAYS=60`. Figures are in [`2026-10-21-care-jobs-end-with-need.json`](../data/2026-10-21-care-jobs-end-with-need.json).

## One wound every 400 ticks, medic 5, before → after

| Wound | Died | Infected | Cloth | Diagnoses | Medic ticks per patient | Medic time bandaging / cleaning | Healed, days |
|---|---|---|---|---|---|---|---|
| Light cut (9) | 3 → **0** | 9 → 0 | 30 → **0** | 27 → 7 | 528 → 267 | 50% / 11% → 12% / 43% | 5 → 5 |
| Serious cut (21) | 0 → 0 | 0 → 0 | 30 → 30 | 27 → 7 | 528 → 474 | 46% / 0% → 46% / 0% | 13.5 → 13.5 |
| Serious puncture (21) | 4 → 4 | 0 → 0 | 26 → 26 | 26 → 14 | 563 → 517 | 47% / 0% → 47% / 0% | 12.5 → 12.5 |
| Grievous cut (36) | 14 → 14 | 0 → 0 | 16 → 16 | 16 → 16 | 500 → 500 | 38% / 0% → 38% / 0% | 21.3 → 21.3 |

Discharge is 0.1 to 0.3 days in every case before and after.

## One wound a day, before → after

| Wound | Died, medic 5 / medic 0 | Cloth, medic 5 | Diagnoses, medic 5 / medic 0 | Medic ticks per patient, medic 5 / medic 0 | Healed, days (medic 5) |
|---|---|---|---|---|---|
| Light cut (9) | 0 / 0 → 0 / 0 | 30 → **0** | 30 / 30 → 30 / 30 | 557 / 628 → 396 / 470 | 5 → 5 |
| Serious cut (21) | 0 / 0 → 0 / 0 | 30 → 30 | 30 / 30 → 30 / 30 | 559 / 642 → 559 / 642 | 10.2 → 10.2 |
| Grievous cut (36) | 7 / 12 → 7 / 12 | 23 → 23 | 23 / 18 → 23 / 18 | 556 / 527 → 556 / 527 | 20.3 → 20.3 |
| Serious puncture (21) | 0 / 0 → 0 / 0 | 30 → 30 | 30 / 30 → 30 / 30 | 592 / 629 → 592 / 629 | 10.2 → 10.2 |
| Serious fracture (13, leg) | 0 / 0 → 0 / 0 | 30 → 30 | 30 / 30 → 18 / 19 | 772 / 794 → 765 / 786 | 15.8 → 15.8 |
| Grievous fracture (22, leg) | 0 / 1 → 0 / 1 | 30 → 30 | 30 / 29 → 30 / 28 | 756 / 921 → 756 / 938 | 30.6 → 30.6 |
| Serious burn (13, arm) | 0 / 0 → 0 / 0 | 67 → 67 | 30 / 30 → 30 / 27 | 635 / 705 → 635 / 721 | 15 → 15 |

## Annual wildlife instrument

Before (`1c98234`, the T-413 row, not re-run: since T-413 only T-412 changed `src/`, and its run kept every world hash): median 13, worst 2, second-worst 8, living 140, wildlife-free 8, extinct 0, hunger/thirst 0. After (`1c98234` with this change): **the same row**. Eleven seeds keep their world hash; taiga seed 3 changes its hash with the same eleven deaths on the same days. Every guarded figure holds, and none worsens.

## What this does not measure

- A fortress with several medics, or a Chief Medic whose diagnoses come first.
- The medicine experience lost with the diagnoses that end at the healing.
