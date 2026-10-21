# T-405 — The first bandage decides a serious wound

**Closed:** 2026-10-21, in 72dc99d.

**Source:** T-367, [the wound-recovery measurement](../../../reports/audits/2026-10-21-wound-recovery.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

Measured at `a5cd51c` in a ward with one wound a day and a medic of skill 5 standing by:

- A serious cut (bleed 3 a health tick) leaves a dwarf about 800 ticks to live. The first bandage comes at a median 365 ticks. Six of thirty died, and all six were the patients whose first `stop_bleeding` failed (`TREAT_FAIL_PERMILLE` − 10 × skill = 15%): the failed job consumes the cloth, is produced again, and the second bandage comes after the patient is dead. None of the 24 whose first bandage held died.
- A bleeding patient first walks to a hospital bed, and the medic's first bandage comes about a hundred ticks later than when the patient rests where it stands (median 365 to 500 against 263 to 311). A grievous cut leaves about 390 ticks: 16 of 30 died with beds, 7 of 30 without.

Bleeding to death after a fight is the main cause of death in the measured fortresses (`balance-status.md`). A failed bandage is a coin a skilled medic cannot do anything about, and the walk to the bed makes the hospital slower than the floor.

## Decisions

1. **`stop_bleeding` does not fail.** Bandaging is the first aid that buys time for the rest; the failure rule of 17 § Treatment keeps applying to `suture`, `set_bone`, `clean_wound`, `dress_burn` and `bandage_animal`. 17's sentence on failure names the exception.
2. **A bleeding patient is bandaged where it lies.** A conscious patient with a bleeding wound and no bandage stays on its tile (it does not start the walk to a bed) until `stop_bleeding` is done or no worker can reach it within `RESERVE_KEEP_TICKS`; then it walks to its bed as now. An unconscious patient is bandaged before it is carried. A patient in danger (a hostile within `THREAT_RADIUS`) still flees first, by 10's rules.
3. No bleed rate, `CLOT_TICKS` or `TREAT_FAIL_PERMILLE` value changes in this task.

## Done

- 17 § Treatment and § Hospital say both rules; unit tests pin them (a failing roll on `stop_bleeding` still bandages; a bleeding conscious patient is bandaged on its tile).
- The ward probe of the measurement (`reports/data/2026-10-21-wound-recovery.probe.ts.txt`, one wound a day, medic 5) is re-run: serious-cut deaths fall from 6 of 30 to at most 1, grievous-cut deaths from 16 toward the floor case's 7, with before and after rows in a new dated report; the annual wildlife instrument passes its guards.
