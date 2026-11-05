# T-494 — `glowing` armour lights the wearer's tile

**Source:** [flavour report](../../reports/audits/2026-11-03-flavour-left-out.md) (item 13) · **Size:** M · **Needs:** — · **Status:** open

The owner (2026-11-04): "I like all of these, let's try to make it work (but drop if too complex)."

## What to do

- A creature wearing a piece enchanted `glowing` lights its own 3×3 as a lamp does, for crop light, the glow light value and anything else that reads lamp coverage.
- Lamp coverage is per building today (14 keeps a count per tile). Find the plainest way to add moving lights: for example, a separate light set rebuilt each tick or hour from the glowing wearers, read beside the building count. Keep the cost small with no glowing wearers: zero work.
- The bonus from the report: glowcap under a glowing dwarf standing still grows while lit, by the ordinary glow rule.
- Render: a glowing wearer's tile and its neighbours read as lit in the view, if the renderer shows light.

**Drop rule.** This is a fun feature, and the owner said to drop it if it is too complex. If the plainest version needs a new mechanism much larger than the effect, or breaks a set rule that a small change cannot fix, stop, commit the findings, and report it as dropped with the reason. That is a valid outcome. If it lands, list it in [`docs/fun-features.md`](../fun-features.md) § In the game, marked removable.

## Done

- Tests: a glowing wearer lights its 3×3; the light follows them; with no glowing wearer nothing changes (goldens and the annual instrument unchanged).
