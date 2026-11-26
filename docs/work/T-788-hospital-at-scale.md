# T-788 — The hospital panel says what 80 dwarves need, before the wounded come

**Source:** playtest 7 ([report](../../reports/data/2026-11-26-playtest-7.md), finding 4); playtest 3 findings 10 and 13 · **Size:** M · **Needs:** — · **Status:** open

## Why

Playtest 3 saw one hospital bed for 52 dwarves and "Patients: None" while five wounded rested elsewhere, and left both to watch. In Year 4 of this playtest it cost lives. After the blind stalker (finding 3) there were fifteen wounded (`☻` in Units [w]). Hospital #1 read: "Requirements met · Beds: 1 Traction: 0 Chests: 1 · No cloth or bandages: a bleeding dwarf cannot be bandaged. · Cloth: 0/10 … Patients: None". The wounded lay "Unconscious in bed" in their own bedrooms. Four bled to death within a day. The Warden, wounded in a raid three weeks before, died of an infection. The fortress had had no cloth since Year 3: the loom's orders read "Spin coarse thread · waiting for fiber or reed (0)". Nothing said so until a wound bled: then came "! Kari Veinspark is bleeding and there is no bandage or cloth: buy them from a caravan, or weave cloth at a loom." A month before, the Hillfolk had stood at the depot selling 16 linen bandages and 14 wool cloth.

"No cloth, no clot" is a kept trade-off (fun-features). This file does not change it. It asks that the warning come before the wound, and that the panel say what a fortress of this size needs. "Requirements met" with one bed for 80 dwarves reads as "done".

## What to do

Decisions taken here:

- **Beds against population.** The hospital inspector's Beds line reads "Beds: 1 for 80 dwarves (aim for 1 in 10)". It reads in the alert color when beds × `HOSPITAL_BEDS_PER` (10, *unmeasured*) is below the living dwarves. "Requirements met" stays for the room rules only.
- **Patients where they lie.** "Patients:" lists every dwarf under care, in the hospital or not, with where: "Kari Veinspark · in her bed (14,17,z28) · bleeding". The hospital's own beds come first.
- **A standing alert before the wound.** From the first wound the fortress has treated, or from 30 dwarves, whichever comes first, the Alerts tab holds "! The hospital has no cloth or bandages: a bleeding dwarf cannot be bandaged. Buy them [c] or weave cloth at a loom." while a hospital exists and holds none of either. It folds by day (T-741). With no hospital zone it reads "No hospital: [z] [o] makes one." from the same threshold.
- The caravan's trade screen marks bandages and cloth "the hospital wants" while the hospital holds less than its wanted count, as it marks "scarce here".

Decided while doing it:

- **Beds** are the built `sleep` buildings (a hospital's requirement), counted over every hospital; with several the line reads "Beds: 4 here, 8 in all, for 80 dwarves (aim for 1 in 10)". The other furniture moves to its own line ("Traction: 0  Chests: 1"). The living dwarves are 10's `list()`.
- **Patients** are every fortress creature with a `Patient`; this hospital's own keep "Name: needs", the others read "Name · in a bed in Bedroom #3 (14,17,z28) · needs" (a built bed held) or "· lying in the halls (…)" (the place as the log names an item's: zone, building, the halls or the open). Needs stay 17's job kinds, as today.
- **"Holds none of either"** reads as 17's rule for the panel line and the bleeding alert: no bandage and no cloth to be had in the whole fortress. A hospital whose chest is empty while cloth lies in a stockpile can still bandage, so the alert would mislead there.
- **"The first wound treated"** is the first `PatientAdmitted`, kept in the UI state (`patientSeen`, saved); a patient under care now counts too, for an older save. `HOSPITAL_ALERT_DWARVES` (30, *unmeasured*) is 17's, beside `HOSPITAL_BEDS_PER`. Both lines are standing alerts asked on `DayPassed` (no event of their own), focused on the hospital's first tile.
- **The trade mark** counts cloth and bandages together, as 12 and 17 count dressings: while every hospital's cloth and bandages held are fewer than their `cloth` + `bandages` wants, a merchant's cloth or bandage row says "the hospital wants" ("scarce here · the hospital wants" when both). With no hospital there is no mark (the alert says to make one). The default wants (cloth 10, bandages 0) would otherwise never mark bandages.

## Done

- [x] The Beds line and the Patients list in the inspector; UI tests.
- [x] The standing alert with its threshold; a test that it shows before any bleeding and clears when cloth arrives.
- [x] The trade screen's "the hospital wants" mark; a test.
- [x] 17 § Player-facing behavior and `panels.md` § Zones updated; `HOSPITAL_BEDS_PER` in 17's tuning constants.
