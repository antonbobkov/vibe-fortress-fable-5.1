# T-NEW — Making Do: salt crusts, after T-547's salt

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 5); split from [T-548](T-548-making-do-plants.md) · **Size:** S · **Needs:** T-547 · **Status:** open

T-548 built every plant of Making Do but the salt crust: its product is T-547's `salt` (item, material) and its colour T-547's `salt_white`, and T-547 had not landed when T-548 finished. Everything else it needs is in the game: conversions (03, the end of stage 10), grazable shrubs (08), a shrub's product gathered (09).

## What to do

- Move `plants.md` § Planned rows, *Planned salt crust*, into § Wild shrubs and § Conversions; add `| plants | salt_crust |` and `| materials | salt_crust |` to `row-order.md` (the `salt` material is T-547's own row, so the generator adds no `salt`); run `npm run content:export`.
- Spec (from T-546's planned blocks): 07 § Shrubs and 08 § Pastures and feeding name `salt_crust` with `rock_lichen` and `barrel_cactus` among the grazable shrubs; 09 § Gathering: `gather` on `salt_crust` yields `salt`. `plants.md`: "A salt crust is a shrub that is not a plant: it reuses gathering and regrowth whole, burns not, and is grazed by camels (and any tame grazer)."
- "Burns not": a salt crust tile is not `burnableTile` (05 § Fire); decide how the row says so (a tag on the shrub row read by 05's `burnableTile`), spec it, test it.
- Tests: extend `test/unit/t548-making-do-plants.test.ts` (a desert map grows salt crusts on dry soil and bare rock; a gathered crust gives 2 salt; it does not burn). The local-map golden moves only for desert and badlands maps; name it.
- Run the sweep and the instrument on GitHub if any sweep or instrument seed is a desert or badlands map.
