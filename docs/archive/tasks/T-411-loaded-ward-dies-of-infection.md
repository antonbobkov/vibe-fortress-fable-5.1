# T-411 — A loaded ward's serious cuts die of infection

**Closed:** 2026-10-21, in ce26a36.

**Source:** T-405, [the first bandage](../../../reports/audits/2026-10-21-first-bandage.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

With the bandage rules of T-405, a serious cut no longer bleeds out in a ward with a medic. Under load it still kills, of infection: one skill-5 medic, thirty serious cuts one every 400 ticks (a fight's worth in three days), 18 of 30 infected and 10 of 30 dead, every one of infection (none bled out). A serious puncture: 13 infected and 13 dead, 9 of them of infection. At one wound a day nobody is infected.

`clean_wound` is priority 3, level with `suture` and behind `stop_bleeding` and `set_bone`, and a wound older than one day that is neither `cleaned` nor `sutured` rolls `INFECTION_PERMILLE` (100) a day. A medic with three new patients a day reaches the suture or the cleaning of the first too late, and an infection nothing cures without brightleaf kills at `INFECTION_DEATH_PERMILLE` (50) a day. A fortress after a fight is this loaded ward.

## To decide

Measure first which step comes late (suture, cleaning, or the brightleaf fetch) in the loaded ward of the probe (`reports/data/2026-10-21-wound-recovery.probe.ts.txt`, `T367_GAP=400`), then choose the smallest rule that keeps a serious cut alive under one loaded medic: for example, an order of the medic's work that sutures or cleans a wound before its first daily roll, or a later first roll for a bandaged wound. Do not change `INFECTION_PERMILLE` or `INFECTION_DEATH_PERMILLE` without that measurement.

## Done

- The decision is in 17 § Infection or § Patients and hospitals, pinned by a unit test.
- The loaded ward re-run (serious cut, serious puncture, grievous cut; medic 5) shows the infection deaths fall, with before and after rows in a new dated report; the annual wildlife instrument passes its guards.
