# T-NEW — A dwarf with the medicine labor can treat itself

**Source:** T-415, [diagnosis while treating](../../reports/audits/2026-10-22-diagnosis-while-treating.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

The scenario `he_crutch` (a severed leg, a skill-20 medic beside it) gave its crutch through the patient itself once T-415 freed the medic's time: the casualty had the medicine labor, as every spawned dwarf does, claimed its own `give_crutch` job and completed it (`TreatmentDone { medicId: patientId }`). Nothing in 11 or 17 keeps a worker from a job whose target is itself. The scenario now turns the casualty's medicine labor off, as the other health tests do.

Whether that is right depends on the treatment. Taking a crutch, or a meal, is plausible; bandaging, suturing or splinting oneself, or diagnosing oneself, is not what 17 describes ("a medic", "the Chief Medic"). A conscious patient resting in a hospital bed is already kept from work, but a discharged dwarf with a remaining need (a suture, a cleaning, a crutch) is not.

## To decide

Which health jobs a dwarf may take when it is their target: none, or only `give_crutch` (and `feed_patient` and `water_patient` if they ever target a walking dwarf). Write the rule in 17 § Patients and hospitals, or in 11 § Assignment if it holds for every job with an entity target.

## Done

- The rule is in the spec and pinned by a unit test (a discharged dwarf with the medicine labor and an unsutured cut does not suture itself while another medic is free, or does, as decided).
- The one-a-day ward (`reports/data/2026-10-21-wound-recovery.probe.ts.txt`) and the annual wildlife instrument re-run with before and after rows.
