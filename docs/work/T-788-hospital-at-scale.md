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

## Done

- [ ] The Beds line and the Patients list in the inspector; UI tests.
- [ ] The standing alert with its threshold; a test that it shows before any bleeding and clears when cloth arrives.
- [ ] The trade screen's "the hospital wants" mark; a test.
- [ ] 17 § Player-facing behavior and `panels.md` § Zones updated; `HOSPITAL_BEDS_PER` in 17's tuning constants.
