# T-472 — Runecraft 5: enchantments act in combat

**Closed:** 2026-11-02, in 59782b5f.

**Source:** runecraft [design](../../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** M · **Needs:** — · **Status:** open

The specification is [25 Runecraft](../../02-systems/25-runecraft.md). It governs, and this task needs only its sections named below. Everything marked for this task lands here and nothing else. Move this task's rows from 25 to the tables and schemas it names, and into its § Interfaces. Every number stays *unmeasured* unless this task measures it.

## What to do

25 § Enchantments in combat, the table of kinds and seams. `applyEnchantOnHit` in `magic/cast.ts`. The resolution reads rows, never ids.

## Done

- One test per kind: `to_hit`, `damage_percent`, `vs_deep_percent`, `armor_percent`, `armor`, `fire_percent`, `frost_percent`, `extra_damage`, `slow`, `flee`, `spot_radius`.
- Enchanted ammunition keeps its stone when it drops, and its effect acts.
- Combat with no enchanted item gives the same result and the same rng draws as before: `pp_defence` on one seed proves it.
- Arena figures for an enchanted squad in the balance doc. Steel keeps the top of the damage table.
