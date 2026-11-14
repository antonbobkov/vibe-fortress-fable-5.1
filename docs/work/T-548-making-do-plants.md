# T-548 — Making Do A2: new plants, wild and farmed

**Source:** [Making Do](../../reports/designs/2026-11-06-making-do-content-and-scarcity.md) (§ 5); the owner, 2026-11-13 · **Size:** L · **Needs:** — · **Status:** open

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

## What to do

The blocks and rows marked T-548:

- **03 § Planned:** Stage 9 conversions, one pass per row of `plants.md`'s Conversions table, each on its own stream (`terrain.convert.<id>`); the site summary lists the converted plants.
- **07 § Planned:** The new species (rye at −2 °C, nettle, straw at harvest, wyrmtongue on ash with its renewed ash, ironwood's chop time, grazable shrubs and `ShrubGrazed`).
- **08 § Planned:** Grazing shrubs (tame grazers only; the pasture capacity weight).
- **05 § Planned:** Ironwood is hard to burn (`fire_resistant`, `FIRE_RESIST_DIVISOR`).
- **09 § Planned:** Gathering the new shrubs (the nettle's sting on its own stream).
- **10 § Planned:** Drinking a cactus (`DrankFromPlant`).
- **12 § Planned** and **15 § Planned:** meals seasoned with wyrmtongue (`Item.seasoned` for wyrmtongue; salt comes with T-552, which extends it), `ate_wyrmtongue`, and `bitter_cold` kept out while it lasts.
- **Rows:** the plants (crops, shrubs, the tree, the Conversions table, the brewing rows of rye, cactus and wyrmtongue), the cloth-and-fiber materials and their stages, the drinks `black_ale`, `cactus_wine`, `emberwine`, the `ironwood` material, the items `straw` and `reed`, `jobs.md`'s `chop` edit, the thoughts `nettles`, `drank_cactus`, `ate_wyrmtongue`, the colours.

## Decisions

- No new plant enters a biome's weights: every one is placed by a conversion of an eligible tile on its own stream, so the main stage-9 stream and 07's regrowth draw as before. Ironwood never regrows.
- Only tame grazers eat shrubs; wild grazing is unchanged.

### Taken while building (T-548)

- **The conversions end stage 10**, after every trait and before lighting, not straight after the rare cave patches: no other stage reads what they place, so a map changes only on converted tiles, and the `ash_soil` that a trait lays (the Starfall crater, T-560; the Glasslands' ash) is eligible for wild wyrmtongue. A converted floor loses its `grass` and `snow`.
- **The Conversions table is machine-readable**: the eligible tiles are named codes (`shrub`, `tree`, `grass`, `sand`, `dry_soil`, `rock`, `near_water`, `shallow`, `ash_soil`) defined in `plants.md`, exported as each row's `convert`. Passes run in the `plants` table's order, tiles in column order. "Within 2 tiles of surface water" is within `CONVERT_WATER_RADIUS` columns of a wet column; "shallow" is water level 1 or 2 (`CONVERT_SHALLOW_MAX`).
- **The site summary** lists the converted plants after their kind's species, and its shrub estimate adds each converted shrub's permille of the open soil (sand by its share) or, on bare rock, of every surface tile, so an alpine site now says it has lichen.
- **Shrub products do not brew yet.** The still finds a brewable plant by its own species material, so a shrub's product (`cactus_pulp`, like `bramble_berry`, `sunfruit` and `frostberry` before it) does not brew: `cactus_wine` exists as a material with no way to make it. Wiring it would make the berries brewable too and move every forest fortress, so it is left for a task of its own.
- **Reed, cactus and nettle fiber** have their thread and cloth stages; nothing spins them until T-549's `spin_coarse_thread`.
- **Ironwood's 0.60** is its material's `sharpness`, read from the wood row's notes.
- **`Stung { id, source }`**: `source` is `nettle` here, so T-555's bees share the event; `nettles` matches the nettle only.
- **`MealEaten.seasoned`** is present only when the meal has a seasoning, so no other meal's event changes. Meals with different seasonings do not stack.
- **A grazer walks onto the shrub** (a shrub is walkable), as onto grass, rather than beside it; it claims the tile, and the claim ends when the shrub is no longer mature.
- **Ash and sowing**: 05 already said ash blocks planting; the producer now enforces it: no crop but wyrmtongue is sown on a tile with `ash`, and wyrmtongue only on an ash tile.
- **`mill_flour` takes rye** with barley and cavewheat (the rye row's "flour at the farmer's workshop").
- **Fire**: the resistant chance is `floor(permille / FIRE_RESIST_DIVISOR)` (150 → 37, 20 → 5).


## Common rules for every Making Do task

- **The spec is the § Planned blocks.** Each system document touched carries a `## Planned: Making Do` section; each content document a `## Planned rows` section. Build every block and row marked with this task, and only those. Move each block into its document's sections as plain specification (no task id), its constants into § Tuning constants, its readers, events and commands into § Interfaces and into `04-implementation/event-catalog.md`, `command-catalog.md`, the schemas and `save-format.md`; then delete the block. Move each row into its table (without the `task` column), add its line to `row-order.md`, and run `npm run content:export`. The last task to empty a § Planned section deletes it.
- Where the spec is silent or a planned rule does not fit the code, decide, write it in the spec, and say so in the report.
- Rows are appended; none is removed. Never edit `test/fixtures/content-row-baseline.json`.
- A new rng draw is on a stream of its own, or on an existing stream only where the new content is present, so a game without it draws the same numbers. Name every golden that moves in `golden:`, with the reason.
- **Substitutes are worse.** Every recipe the planned table marks `substitute for` stays worse than its regular recipe; T-547's check enforces it once it lands. Add your pairs to it.
- A caravan good the planned table marks with this task lands with it (20 § Planned, Sundries).
- **Fun features.** Move this task's entries from `docs/fun-features.md` § Planned to § In the game, with where each lives and how to remove it.

## Done

- Each plant is placed only where its conversion row says, and a map's other rock, trees and shrubs are unchanged: the local-map hash moves only for converted tiles, named in `golden:`.
- Rye grows in a cold spring; wyrmtongue grows only on ash and keeps it; a thirsty dwarf with nothing else drinks a cactus; a nettle stings; a yak grazes lichen.
- The annual instrument runs; its forest, taiga and grassland rows move at most by what the new shrubs and grazing explain.
