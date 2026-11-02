# T-474 — Runecraft 7: draughts

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** M · **Needs:** — · **Status:** open

The specification is [25 Runecraft](../02-systems/25-runecraft.md). It governs, and this task needs only its sections named below. Everything marked for this task lands here and nothing else. Move this task's rows from 25 to the tables and schemas it names, and into its § Interfaces. Every number stays *unmeasured* unless this task measures it.

## What to do

25 §§ Draughts, Effects (`heal_rate`, `pain_half`, `haste`, `fire_immune`, `spot_radius`), Morale (its rows). The four draughts marked T-474; the other two come with their materials in T-476.

## Decisions

- Triggers are 25's event handlers, not scans.
- The list is on `Squad.equipment` through `SetSquadEquipment`. No new command.
- Drinking takes no time.
- A spoiled batch is a murky draught only. There is no miasma.
- Stoutness halves pain. There is no Toughness term.
- `mend_wounds` is cut (it was named here in the first file). `give_draught` stays.

## Done

- A soldier who drank stoutness drinks nothing else for 3 days whatever triggers, and a medic gives them nothing. A second calming draught within seven days gives `dosed_again`. The mood floor holds.
- With nothing listed in the squad panel (the default), no draught is drunk.
- Spoiled batches fall as the formula says; only a `spoilable` recipe draws.
