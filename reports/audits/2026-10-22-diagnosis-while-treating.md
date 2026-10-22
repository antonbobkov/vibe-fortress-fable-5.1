# Measurement: a dwarf with a splinted leg is diagnosed weeks late

**Task:** T-415 · **Date:** 2026-10-22 · **Commit examined:** master `143d0fa` (before) and `143d0fa` with the T-415 change (after) · **Kind:** diagnosis and re-measure after a rule change; no constant, formula or content value was changed · **Source:** [care jobs end with their need](2026-10-21-care-jobs-end-with-need.md)

## The answer

- **The medic was not idle: it had no time for a priority-4 job.** In the one-a-day ward with a serious fracture (one skill-5 medic, thirty patients), I sampled the medic every 100 ticks while any `diagnose` job was open: 347 samples, with 11 open diagnoses on average. The medic was setting bones 40% of the time, asleep 24%, bandaging 23%, drinking, eating or talking 12%, diagnosing 2%, and idle in one sample. No `diagnose` job was ever blocked and none had a failed walk. A fracture asks for a bandage and a splint (about 770 medic ticks a patient), which is what a medic who sleeps and eats has in a day. The diagnoses waited until the wounds stopped coming. The 5% idle time that [T-414](2026-10-21-care-jobs-end-with-need.md) read as "idle with open work" fell after the last patient; the work file's guess was wrong.
- **The rule chosen: the medic diagnoses while treating.** When the medic who diagnoses (the Chief Medic, or any medic when there is none) completes a wound treatment on an undiagnosed dwarf, the treatment also diagnoses it: `diagnosed` is set, `DIAGNOSE_XP` is given and the `diagnose` job ends (17 § Patients and hospitals). `diagnose` keeps its priority; it is still made, and it serves a dwarf that no treatment reaches.
- **Every patient is diagnosed within a day**, most within a quarter of a day. A serious fracture: 18 of 30 diagnosed at a median 8.0 days → 30 of 30 at 0.43 days. A grievous fracture: 9.9 days → 0.27 days. Skill 0: serious fracture 19 → 30, grievous fracture 18.3 days → 0.52.
- **The medic keeps its experience and saves its time.** Each diagnosis gives the same `DIAGNOSE_XP`. The walk and the 100 ticks of a separate diagnosis go, so medic ticks per patient fall 1% to 25%: light cut 396 → 298, serious cut 559 → 454, grievous fracture 756 → 654, serious burn 635 → 541.
- **Deaths and healing hold or improve.** At skill 5 the grievous cut falls from 7 to 3 dead, at skill 0 from 12 to 8, but four seeds of that case gave 1 to 7 in [T-413](2026-10-21-clean-exposed-wounds.md), so this is mostly chance. One serious puncture bled out at skill 0 (0 → 1). Discharge and healing days move by 0.1 at most, except a skill-0 grievous fracture (31.8 → 31.0).

## What was run

The ward probe of [wound recovery](2026-10-21-wound-recovery.md) (`reports/data/2026-10-21-wound-recovery.probe.ts.txt`), copied to `test/perf/` with the T-413 recording additions and a trace that, every 100 ticks, printed each open `diagnose` job's state, blocked reason, failed-walk flag and worker, its dwarf's position and behavior, and the medic's behavior, activity, job and assignment queue. The trace ran on `med5`, serious fracture, at `T367_GAP=1200` for 34 days. The one-a-day ward ran at `med5` and `med0` with all seven wounds, `T367_GAP=1200`, `T367_DAYS=60`. A diagnosis is counted by its `TreatmentDone { kind: 'diagnose' }`, which the diagnosis by treatment also emits. Figures are in [`2026-10-22-diagnosis-while-treating.json`](../data/2026-10-22-diagnosis-while-treating.json).

## One wound a day, before → after

| Wound | Diagnosed of 30, medic 5 / medic 0 | Diagnosis, median days after the wound (medic 5) | Medic ticks per patient, medic 5 / medic 0 | Died, medic 5 / medic 0 |
|---|---|---|---|---|
| Light cut (9) | 30 / 30 → 30 / 30 | 0.56 → 0.40 | 396 / 470 → 298 / 337 | 0 / 0 → 0 / 0 |
| Serious cut (21) | 30 / 30 → 30 / 30 | 0.85 → 0.21 | 559 / 642 → 454 / 538 | 0 / 0 → 0 / 0 |
| Grievous cut (36) | 23 / 18 → 27 / 22 | 0.80 → 0.21 | 556 / 527 → 486 / 494 | 7 / 12 → 3 / 8 |
| Serious puncture (21) | 30 / 30 → 30 / 29 | 0.82 → 0.26 | 592 / 629 → 478 / 509 | 0 / 0 → 0 / 1 |
| Serious fracture (13, leg) | 18 / 19 → **30 / 30** | **8.03 → 0.43** | 765 / 786 → 703 / 777 | 0 / 0 → 0 / 0 |
| Grievous fracture (22, leg) | 30 / 28 → 30 / 30 | 9.93 → 0.27 | 756 / 938 → 654 / 775 | 0 / 1 → 0 / 0 |
| Serious burn (13, arm) | 30 / 27 → 30 / 30 | 0.96 → 0.23 | 635 / 721 → 541 / 605 | 0 / 0 → 0 / 0 |

A grievous cut's patients who die before a treatment are never diagnosed. The latest diagnosis after is 1.0 days after the wound (skill 0); before, 33 days.

## Annual wildlife instrument

Before (`143d0fa`, the T-414 row, not re-run: `src/` has not changed since T-414's commit): median 13, worst 2, second-worst 8, living 140, wildlife-free 8, extinct 0, hunger/thirst 0. After (`143d0fa` with this change, [rows](../data/2026-10-22-t415-wildlife.json)): **median 13, worst 1, second-worst 8, living 139, wildlife-free 8, extinct 0, hunger/thirst 0**. Eleven seeds keep their world hash. Taiga seed 3, unstable since T-404, loses one more dwarf to bleeding (its deaths after day 85 move from days 88 and 91 to days 89, 98 and 108). Every bound holds: median at least 12, living at least 136, wildlife-free at least 6, extinctions at most 1, need deaths at most 1. One guarded figure worsens (living, by one), so the change is accepted. `WILDLIFE_REFERENCE` takes the new row.

## What this does not measure

- A fortress with a Chief Medic and other medics. There, the other medics' treatments do not diagnose, and the Chief Medic's `diagnose` jobs can still wait.
