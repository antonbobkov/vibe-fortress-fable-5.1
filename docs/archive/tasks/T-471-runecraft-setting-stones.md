# T-471 — Runecraft 4: setting stones, enchanted items and their value

**Closed:** 2026-11-02, in 4b8af68d,ce3b1a04.

**Source:** runecraft [design](../../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** L · **Needs:** — · **Status:** open

The specification is [25 Runecraft](../../02-systems/25-runecraft.md). It governs, and this task needs only its sections named below. Everything marked for this task lands here and nothing else. Move this task's rows from 25 to the tables and schemas it names, and into its § Interfaces. Every number stays *unmeasured* unless this task measures it.

## What to do

25 §§ Setting stones, Enchantments in combat (the rows, without their effects), Trade and value (vials, preferences). Also `rune_robe`, `circlet` and their rune figures.

## Decisions

- `transform: true` recipes have no outputs and are `once` only.
- The order picks a target type and a material. There is no "this exact item".
- A soldier's gear is owned, so only stock is set. Re-equip then takes the better item through `ENCHANT_CLAIM_BONUS`.
- A set of ammunition is exactly 25 units.
- Rows for `venomed`, `calm` and `mending` are cut. See the list at the end of 25.

Effects do not act in combat yet, except the rune figures of robe and circlet.

## Done

- An enchanted axe keeps its stone through drop, haul, claim and save. Melting returns bars only. A second setting on the item is refused by `noEnchant`.
- Value and suffix read as § Setting stones says, wealth follows, and a stack of 25 enchanted bolts does not merge with plain ones.
- Robe and circlet change the rune figures (34 hours in a robe).
- A rune vial bought from the Mountainhome stays outside the ordinary pool.

## Note from T-468's review

A player request finds an `extra` caravan entry through `entries.find` in `trade/goods.ts`, but never checks `extra.minReputation`. The rune-vial row (reputation ≥ 50) needs that check in the request loop.
