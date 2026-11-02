# T-476 — Runecraft 9: rare materials, deepsilver pressure and the legend

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** M · **Needs:** T-472, T-474 · **Status:** open

The specification is [25 Runecraft](../02-systems/25-runecraft.md). It governs, and this task needs only its sections named below. Everything marked for this task lands here and nothing else. Move this task's rows from 25 to the tables and schemas it names, and into its § Interfaces. Every number stays *unmeasured* unless this task measures it.

## What to do

25 §§ Rare materials, Deepsilver, the T-476 rows of Workshops, Enchantments and Draughts, and the legend milestones. Hexers moved to their own task, T-479.

## Decisions

- `remains` on a species row, recovered by the existing `strip_corpse`. The butcher does not change.
- `venomed`, `spider_venom` and `ember_gland` are cut.
- `DeepsilverWorked` comes from any `rune_work` building that consumes a metal with `runePressure`, read from the row.

## Done

- A dead wyrm's corpse gives 4 wyrmscale by `strip_corpse`; a dead stalker or maw gives 1 ichor. A hollow crawler gives none.
- A quench and a deepsilver staff raise pressure by 10 a bar, and the thresholds act. A forge does not raise it. A fortress that bought its bar and mined no tile still gets an emergence with a base.
- The confirmation has its sentence. Milestones fire once.
- `remains` is a deliberate move: a `golden:` line names it, and the annual instrument is run and any move explained.

## Decisions from T-472 (orchestrator, 2026-11-02)

- **Item stones get their value.** Wyrmscale (80) and hollow ichor (60) are items, and `items/facts.ts` values only material stones, so they count 0 today. Use the item row's value.
- **Deepsilver as a stone** needs a branch in the setting-recipe generator, which knows only a cut gem or an item.
- **Hollowsight:** one rule for the enchantment and the draught, "spots stealthed creatures within 10". Make the enchantment row's `spot_radius` 4, so 6 + 4 = 10, matching the draught's "larger of the two" of 10. No 16-tile spotting.
