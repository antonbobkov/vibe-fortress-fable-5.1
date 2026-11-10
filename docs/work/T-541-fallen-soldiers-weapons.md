# T-541: A fallen soldier's spear is not picked up again for weeks

**Source:** [T-539](../archive/tasks/T-539-wolves-hold-the-hearth-alert.md) ([the report](../../reports/audits/2026-11-10-t539-wolves-and-the-hearth-alert.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

On `three-years-p2-6` at shift 150 (T-538's script), three soldiers died to wolves between day 28 and day 36. The recruit who replaced them had no weapon until at least day 76. Their spears lay where they fell, on the surface. The squad counted as unarmed for 40 days and hunted nothing, while the wolves stayed.

## What to do

Find out why: were the spears never hauled to a stockpile because of the alerts, or did 16's re-equip check (`REEQUIP_CHECK_DAYS`) never find them? Then decide whether a rule or the script should change: a player would have the gear brought in and the recruit armed.

## Done

- The cause is named, and fixed with a test if it is a rule; or a note says why the wait is right.
