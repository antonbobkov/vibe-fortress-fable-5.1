# T-470 — Runecraft 3: the runeforge, wands and staffs, emberbolt and frostbind

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** L · **Needs:** T-469 · **Status:** open

## What to do

The rest of phase 1: the first spells a dwarf throws.

- `runesmithing` skill, workshop `runeforge`, `make_wand`, `make_staff`.
- `Item.stone` and `Item.shoe`, kept through drop, haul, claim and save. `runeMult` on metals.
- Launcher class `staff` that spends the holder's rune. A squad member with `runecraft` claims the best channel; nobody else does. Out of rune, it is a club.
- Damage types `burn` and `frost` with the new armour rows. `Slowed` status, read by the movement helper. Emberbolt and Frostbind. Inspector and look-cursor lines.

## Done

- The spec's raw-damage figures hold: wand, iron-shod staff, silver-shod fine staff, and each against mail, plate and a bare part.
- A Dabbling apprentice with 5 rune and a wand casts five bolts, then swings it as a club. A dwarf with no `runecraft` casts nothing.
- A bolt can hit an ally in the way. Combat-pace arena run with a caster in a squad; the figures go in the balance doc.
