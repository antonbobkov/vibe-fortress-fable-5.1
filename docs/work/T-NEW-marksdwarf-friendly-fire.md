# T-NEW — Marksdwarves shoot their own squad

**Source:** [the caster arena](../../reports/audits/2026-11-02-t470-caster-arena.md) · **Size:** S · **Needs:** — · **Status:** open

The specification is [16 Combat](../02-systems/16-combat.md) § Ranged resolution: a creature other than the target in the path is hit with half the hit chance, and nothing stops a shooter from firing through its own squad.

## What was found

In the combat-pace ambush arena (three Novice soldiers in full kit against a peril-2 ambush of four), a Proficient marksdwarf (crossbow 10, oak crossbow, iron bolts) in a ranged squad of its own at the same station hits a fortress creature in 21 of 24 fights: 65 hits for 895 damage, against 91 hits for 2,043 on the raiders. The squad then loses **2.04** soldiers a fight (dead a day later, no medic) against **1.08** without the marksdwarf. Against a raid of ten in the open it hits its own side 23 times for 369 in 12 of 24 fights.

A runecaster's bolt has a cast-when rule since T-470 (25 § Casting): it is held while one of the caster's own faction stands on the line to the target, and the caster throws at another target with a clear line or waits. With it the same arena's caster hits its own side in 0 of 24 fights and the squad loses 0.58.

## What to decide

Whether a launcher with ammunition takes the same rule (hold while an ally is on the ray, shoot another clear target or wait), or whether marksdwarves keep firing through their line and the player is told to place them on a fortification. Measure the choice in the same two arenas before and after, with the no-crossbow arenas and `pp_defence` unchanged.

## Done

- The rule chosen is in 16 § Ranged resolution.
- The two arenas are re-run and the marksdwarf figures go in a dated report and `balance-status.md`.
