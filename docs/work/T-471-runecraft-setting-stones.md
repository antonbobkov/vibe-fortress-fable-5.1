# T-471 — Runecraft 4: setting stones, enchanted items and their value

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** L · **Needs:** T-470 · **Status:** open

## What to do

Phase 2, the item side.

- Recipe shape `transform: true`: the first input is kept and changed. Work order item filter.
- `Item.enchant { id, tier }`, the name suffix, value, melting returns bars only. The three enchantment tables as content rows with a trigger and an effect record.
- `set_weapon`, `set_armor`, `set_ammo`. Robe and circlet with their rune effects. Trade preferences from design § 9. Stocks panel.

Effects do not yet act in combat, except what the item's own stats give.

## Done

- An enchanted axe keeps its stone through drop, haul, claim and save. Melting returns bars and nothing else. A second setting on the same item is refused.
- Value and suffix read as the spec says. Robe and circlet change the rune figures.
