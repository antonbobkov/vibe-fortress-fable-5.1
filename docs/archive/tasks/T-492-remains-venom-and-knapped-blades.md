# T-492 — Remains and venom: venomed blades, the ember gland, knapped blades

**Closed:** 2026-11-05, in a41e1bf0.

**Source:** [flavour report](../../../reports/audits/2026-11-03-flavour-left-out.md) (items 7, 8, 11), the owner on 2026-11-04 · **Size:** M · **Needs:** — · **Status:** open

## Why

The design's pattern is that the hardest fights leave the material for the next one. T-476's `remains` column and T-474's timed effects now make these cheap. Each is a fun feature, removable if it breaks game logic ([`docs/fun-features.md`](../../fun-features.md)).

## What to do

1. **`venomed`** (item 7): a dead giant cave spider leaves `spider_venom` through `remains`. Setting it in a melee weapon gives `venomed`: on a hit, pain +20 for 300 ticks, as a timed `pain` effect on the `Spellbound` list beside `pain_half`.
2. **The ember gland** (item 8): a dead ember newt leaves an `ember_gland` through `remains`. It is an alternative stone for the `ember` setting at fewer vials (the design said 4).
3. **Knapped blades** (item 11): bring back the obsidian and bone daggers and short swords T-460 removed, made by a knapping recipe from obsidian or a `bone_pile`, at the workshop that fits best. They are a primitive tier for a rock-only or hunter's embark; check their place in the damage table.

## Done

- Each has a test; rows are in `03-content` with `row-order.md` lines.
- `remains` is a deliberate move only where these creatures die; the annual instrument and `pp_defence` are run and any move explained.
- Each is listed in `docs/fun-features.md` § In the game.
