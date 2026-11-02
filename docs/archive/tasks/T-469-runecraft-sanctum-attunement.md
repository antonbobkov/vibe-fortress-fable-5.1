# T-469 — Runecraft 2: the rune tank, the sanctum, attunement and mishaps

**Closed:** 2026-11-02, in a4019ab8,61a878ea,f5370be0.

**Source:** runecraft [design](../../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** L · **Needs:** — · **Status:** open

The specification is [25 Runecraft](../../02-systems/25-runecraft.md). It governs, and this task needs only its sections named below. Everything marked for this task lands here and nothing else. Move this task's rows from 25 to the tables and schemas it names, and into its § Interfaces. Every number stays *unmeasured* unless this task measures it.

## What to do

25 §§ Rune of one's own, The sanctum, Effects (only the stun), Morale (its rows), State. `MagicSystem` starts here, with its rng stream `25`.

## Decisions

- No sanctum chest and no `SetSanctumSupplies`. The job finds its glowcap in any stockpile.
- `ATTUNE_XP` is 25: a year is 112 days.
- `wisp_loose` waits for T-475.
- A blackout is `CreatureStunned`, handled by 17 through `Body.conscious`, and admits no patient.

## Done

- Level 10 in 74 ± 3 days at two sessions a day and Wits 50, with 148 ± 6 glowcap counted.
- Over 1,000 level-0 sessions in a bare sanctum, 60 ± 15 mishaps. None kills, takes a limb or destroys a stockpile item.
- 50 ± 2 hours to refill in a tunic and 84 in an iron helm and mail. (The robe's 34 comes with T-471.)
- Same seed and command log give the same mishaps. An older save loads with no `Rune` and no sanctum.
- Sanctum panel and inspector rune line show.
- Predicted `golden:`: flat-test hashes move for the new system's state and rng key. The annual instrument row is unchanged.
