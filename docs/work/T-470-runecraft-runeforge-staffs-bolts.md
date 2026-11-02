# T-470 — Runecraft 3: the runeforge, wands and staffs, emberbolt and frostbind

**Source:** runecraft [design](../../reports/designs/2026-11-01-runecraft-magic-system.md) · **Size:** L · **Needs:** T-469 · **Status:** open

The specification is [25 Runecraft](../02-systems/25-runecraft.md). It governs, and this task needs only its sections named below. Everything marked for this task lands here and nothing else. Move this task's rows from 25 to the tables and schemas it names, and into its § Interfaces. Every number stays *unmeasured* unless this task measures it.

## What to do

25 §§ Damage types, Workshops (`runeforge`, `runesmithing`), Channels, Casting (the frame and bolts), Spells (two rows), Effects (`slow`).

## Decisions

- `ember` is the new fire type. The wyrm's `burn` keeps no table row and today's numbers.
- A staff's material is its shoe. There is no `Item.shoe`, and no yew bonus.
- One generated recipe per stone. The order's material filter picks the metal.
- A channel is a launcher with no `ammo`. Code tests that, never an id.
- Extract `armorReduction` first, with no change of result.
- Bolts are 16's projectiles, through a third branch in `fireRanged`.

## Done

- The worked-numbers table of § Spells holds for the Emberbolt rows, except the ward row (T-473).
- A Dabbling apprentice with 5 rune and a wand casts five bolts, then clubs. A dwarf with no `runecraft` never claims a channel and casts nothing.
- A bolt can hit an ally in the way.
- `Item.stone` survives drop, haul, claim and save. A staff melts by the ordinary formula, which gives nothing for one bar. `old_battlefield` arms are unchanged, because `metal()` in `traits.ts` skips the new rows.
- `pp_defence` on one seed gives the same result and the same draws as before.
- A probe in the combat-pace arena with a caster in a squad. The figures go in a dated report and the balance doc.
