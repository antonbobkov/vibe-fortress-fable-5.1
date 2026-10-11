# T-135 — Medics treat patients under a hearth alert

Closed by `T-135: medics treat patients under a hearth alert`.

**Source:** T-134 (the browser year, `test/e2e/full-year.spec.ts`, after T-134: Rurik Oakpick bled out untreated under a `hearth` alert) · **Size:** S · **Needs:** — · **Status:** decided 2026-10-11

## Why

With T-134 a soldier stays on duty through a `hearth` alert and fights. Rurik Oakpick killed the wolf at the wagon on day 74, was bitten, became a patient and lay at his post for about 700 ticks with a bleeding wound. Every civilian, the medic included, was in `retreat` (10 § Behavior selection step 2), so nobody treated him and he bled out at tick 89267. 17 says nothing about care under an alert, and 10 retreats every civilian.

## What the spec says

10 § Behavior selection steps 2 and 3; 17 § Patients and hospitals; 11 § Assignment; 16 § Alerts.

## Decision (the local orchestrator's, under the owner's standing instruction; the owner may overrule)

- Medical work continues under an alert. A dwarf that holds, or can claim, a job for a patient (`carry_patient`, `feed_patient`, `water_patient`, the treatments, `diagnose`, `give_crutch`: the health jobs whose target is a patient) is exempt from the `hearth` retreat for the length of that job, as a critical need is. It leaves shelter, does the job, and returns to shelter. The ordinary `flee` rule still applies to it: a hostile near the patient keeps it away, and a job in progress is released when it flees.
- A patient that can walk goes to its bed as under any alert; one that cannot is carried.
- Under the alert 11 offers a sheltering civilian patient-care jobs only. No constant changes.
- Spec: 10 step 2 and step 3, 11 § Assignment and Interfaces, 17 § Patients and hospitals, 16 § Alerts, creature-brains.md, and the `hint_alert` text.

## Done

`test/unit/t135-medics-under-hearth.test.ts`: under a held `hearth` alert a bleeding soldier at its station outside the hall is bandaged and does not bleed out, the medic is back in `retreat` in the hall afterwards, a medic takes no other work, and a hostile near the patient keeps the medic away.
