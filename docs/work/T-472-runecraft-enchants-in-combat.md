# T-472 — Runecraft 5: enchantments act in combat

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** M · **Needs:** T-471 · **Status:** open

## What to do

Design § 4, "How enchantments enter combat". The resolution reads rows, never ids: `passive` and `on_hit` effects in the melee and ranged rolls and in `armorReduction`. Enchanted ammunition keeps its stone when it drops.

## Done

- One test per effect kind: to-hit, damage, armour halved, extra burn, slow, flight, pain, armour bonus, burn halved or immune, wound healing, the stealth spotting of `glowing` and `hollowsight`.
- Combat with no enchanted item gives the same result, same rng draws, as before: `pp_defence` on one seed proves it.
- Arena figures for an enchanted squad in the balance doc. Steel keeps the top of the damage table.
