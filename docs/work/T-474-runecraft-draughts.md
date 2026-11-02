# T-474 — Runecraft 7: draughts and the medic's rune

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** M · **Needs:** T-473 · **Status:** open

## What to do

Design § 5, and the `give_draught` and `mend_wounds` jobs.

- Draught recipes at the laboratory, the spoiled batch and its miasma.
- The per-draught triggers, the three-day rest, the calming draught's longer rule. Soldiers claim allowed draughts at the re-equip check.
- `SetSquadDraughts`, the ordered checklist with its trigger text in the squad panel.

## Done

- A soldier who drank stoutness drinks nothing else for 3 days whatever triggers, and a medic gives them nothing. A second calming draught within seven days gives `dosed_again`. The mood floor holds.
- With nothing allowed in the squad panel (the default), no draught is drunk.
