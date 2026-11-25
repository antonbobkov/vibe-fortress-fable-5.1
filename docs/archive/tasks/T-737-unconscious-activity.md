# T-737 — An unconscious dwarf's activity still reads what it was doing ("Resting in hospital" on a stair)

**Closed:** 2026-11-25, in 9f37dc19.

**Source:** playtest 2026-11-25 (mid game) ([report](../../../reports/data/2026-11-25-playtest-3.md), finding 4) · **Size:** S · **Needs:** — · **Status:** open

## Why

After the Gloam raid of Summer 12, Year 3, Kolfinna Ironwall lay unconscious on the slate stairs at (32, 9, z26), with two corpses, a bucket and three dwarves fleeing past, while a medic bandaged her there. Her view said "Activity: Resting in hospital", and so did her row in Units ("Kolfinna Ironwall ☻ Resting i»") and the tile list ("Kolfinna» Resting in hospital"); only the Health section, far down, said "Unconscious" (`45-wounded-dwarf.png`, `46-hospital-tile.png`). The hospital zone at (34, 13) listed "Patients: None" (`44-hospital-zone.png`). In the hour after a raid, the Units list (hurt first, `[w]`) is where a player looks for who is down, and an unconscious dwarf reads like one resting in bed.

The brain sets `activity` when it thinks (`src/systems/dwarves/brain.ts`: `'Resting in hospital'` for a conscious patient), and an unconscious dwarf does not think, so the word of its last think stays: "Resting in hospital", "Fleeing", "Haul". 10 § Player-facing behavior gives no word for an unconscious dwarf.

Reproduce: load `reports/data/2026-11-25-playtest-3/frostvault-y3-summer9.bin`, run about 3,650 ticks to the raid and 1,200 more at Calm, and list the unconscious dwarves (`readers.of('17').isConscious(id)` false) with `readers.of('10').activityText(id)`.

## What to do

Decisions:

- **`dwarves.activityText` reads "Unconscious" for a dwarf 17 holds unconscious**, whatever its brain's last activity; "Carried to the hospital" while a `carry_patient` job carries it. Every panel that shows the activity (Units, the hover line, Look, the tile list) shows those words, as 10 says they all use `activityText`.
- In the Units list the word is in the alert colour, as an idle dwarf's is dim.

Spec: 10 § Player-facing behavior (activity words); `ui-screens/fortress-screen.md` § Sidebar open (the row's colours).

## Done

- [x] Tests (`describe` with the task id): a patient that loses consciousness reads "Unconscious" in `activityText` and in the Units row; one being carried reads "Carried to the hospital"; on waking it reads its activity again (`test/unit/ui/t737-unconscious-activity.test.ts`: a dwarf stunned mid-job reads Unconscious in its view, the tile list, the hover line, Units (alert colour, not idle) and the All tab, and its job word on waking; a casualty reads Carried while its `carry_patient` job has a worker, then "Unconscious in bed"; "on the stairs", "on a ramp"; a stunned deer reads Unconscious and "Wild, unconscious").
- [x] UI only (`activityText` is a reader): no world hash moves (no simulation code reads `activityText`).
