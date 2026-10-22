# T-NEW — A discharged dwarf with a splinted leg is diagnosed weeks late

**Source:** T-414, [care jobs end with their need](../../reports/audits/2026-10-21-care-jobs-end-with-need.md) · **Size:** S · **Needs:** — · **Status:** open

## Why

`diagnose` is made once per admission at priority 4 (17 § Patients and hospitals). In the one-a-day ward of the T-414 measurement (one skill-5 medic, one wound a day), a dwarf discharged with a splinted serious fracture is diagnosed a median 13.8 days after the wound (15.3 at skill 0), and up to 28 days. A dwarf discharged with any other wound is diagnosed within a median day. That ward's medic is idle 5% of the time while those diagnoses are open. Since T-414 a diagnosis ends when the dwarf has no wound left, so a serious fracture (healed in 15.8 days) loses 12 of 30 diagnoses, and the medic loses their `DIAGNOSE_XP`.

An idle medic with open work suggests the job is not offered to it, or that its walks fail. The target is a discharged dwarf with a splinted leg who is on its feet and moving (in the ward every patient has its labors off, so it idles and wanders), and the job stands beside it (`workTile: 'adjacent'`).

## To decide

Measure why the medic does not take an open `diagnose` while idle: the job's state and blocked reason over time, the medic's assignment answers, and the walks to a moving target. Then decide the fix by what that shows. Do not change `diagnose`'s priority without that measurement.

## Done

- The cause is named in a new dated report with the job's timeline, and the fix is in 11 or 17 as its rule, pinned by a unit test (an idle medic diagnoses a discharged dwarf with a splinted leg within a day).
- The one-a-day ward re-run shows the diagnoses, with before and after rows; the annual wildlife instrument passes its guards.
