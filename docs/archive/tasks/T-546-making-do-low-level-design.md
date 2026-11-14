# T-546 — Making Do: the low-level design, written into the spec

**Closed:** 2026-11-14, in 235bfc0b.

**Source:** [Making Do](../../../reports/designs/2026-11-06-making-do-content-and-scarcity.md); the owner, 2026-11-13 · **Size:** L · **Needs:** — · **Status:** open

The owner (2026-11-13): "let's implement reports\designs\2026-11-06-making-do-content-and-scarcity.md ! As before, schedule tasks including more a detailed low-level design".

The design is reviewed and has no open questions (its § 14). Treat its numbers and mechanic details as guidance, not a strict rule, as for runecraft (T-467's pattern). This task does no code.

## The owner on pallets and stone beds (2026-11-13)

"make stone bed to be just stone + pallet materials. Pallet should be very easy to construct - no specialized workshop, labor (think dwarf just sleeping covering with cloth)." Then: "Stone bed should take a mason. Adjust resting percentages, pallet and stone bed should be less comfortable."

- **A pallet needs no workshop, no recipe and no skill.** It is laid straight from its materials, 2 cloth or wool, or 3 fiber, straw or reeds, by any dwarf, with no labor and the shortest build the game has. Think of a dwarf lying down under a cloth. It rests at **60%**, with `slept_on_a_pallet` (−1).
- **A stone bed is a mason's job:** 1 raw stone + a pallet's materials, at the mason's workshop (skill `masonry`), no `bedding`. It rests at **75%**.
- The wooden bed rests at 100% and the dressed bed at 125%, as the design says. All four are *unmeasured*.
- These numbers replace the design's 80% and 90%.

## What to do

1. **Read it against the spec.** For every section of the design, find the systems it touches (03 terrain and generation, 05 fire and temperature, 07 plants, 08 animals, 09 production, 10 needs and sleep, 11 jobs, 13 items and stockpiles, 14 buildings and light, 16 combat layers, 17 health, 20 trade, 24 UI, 25 runecraft for fletching's enchant column) and the content tables. List every place the design's wording does not fit what the spec already says, and decide each one.
2. **Write the low-level design into the spec.** New sections or rules in the system docs and rows in `docs/03-content` (not yet exported; a row-order line only when its task lands). Each rule names its stream, its events, its constants (marked *unmeasured*), its save fields and its UI. Where a mechanism needs a design choice the design leaves open (the cellar's darkness test, how a skylight column is computed and cached, how a rack ``wants`` items, how `tipsy` is applied, how a dressed bed is made up), choose the plainest that fits the existing code, and say why.
3. **Check the task breakdown.** T-547 to T-561 are filed from the design's § 13 bundles. Re-cut them if the spec shows a better split (dependencies, shared mechanisms, sizes), by editing their work files: their **What to do**, **Needs** and **Size**. Add new rows only as `docs/work/T-NEW-<slug>.md`. Each implementation task should be one agent's day at most.
4. **Fun features.** List the design's goofy rules in `docs/fun-features.md` § Planned, each with its task.

## Where the design did not fit the spec, and what was decided

Written into the § Planned sections; listed here once, as the record of the low-level design.

**How it is written.** Each system document touched ends with `## Planned: Making Do` (01, 02, 03, 05, 07, 08, 09, 10, 12–18, 20, 22–25), each content document with `## Planned rows`, every block and row marked with its task. Planned constants, events and commands stay there, outside § Tuning constants and § Interfaces, because `interface:check` and the tuning-constant tests compare those sections with the code; planned rows come after the real tables under their own headings, so the export never reads them (`content:check` confirms it). The tasks move them in as they land.

1. **Soil items.** Sand, clay and peat are soil materials already: the dug item is one type, `soil_load`, of those materials; the drop is a material tag (`soil_drop`), rolled on its own stream so digging draws as before.
2. **Fossils.** `giant_bone` is a mineral of class `bone`, in sedimentary hosts only (a mineral has one count; the design's 0.5 elsewhere is dropped). A dug bone tile always drops a `fossil`; the first one is a fortress event. The skull's last tile drops the skull beside its fossil.
3. **Chitin, horn, ivory, feathers.** A butcher-parts table (item = material id), not `remains`, which are recovered by `strip_corpse` and flagged foreign. Chitin is the cave crawler's shell only; crabs and crocodiles keep their species shells.
4. **Glass** comes out of the kiln as blocks (2 sand → 1; with potash 2 → 2): no glass item in between. **Fired clay** is a material of its own, `earthenware`; bricks are `brick`.
5. **The wicker bag** is dropped: a basket is a bin of 15; reed cloth makes a cloth bag.
6. **Skylights.** A skylight is any constructed glass floor. `skylit` is flag bit 14, computed in the `outdoor` column pass and cached with it. 05 keeps the surface temperature for every tile `lit` today and excludes only a skylit one: the design's "05 reads `outdoor`, not `lit`" would have changed the temperature of every cave mouth.
7. **Glass walls** pass sight and not fire: 22 gets `lineOfFire` beside `lineOfSight`.
8. **Light for comfort** had no consumer in the spec. Comfort light (`buildings.comfortLightAt`: hearth, lamps, stands, lanterns) is defined by what reads it: `ate_by_candlelight`, the spotting bonus (both ways), the cellar's darkness. "Candles show the thief the gate" has no rule: thieves do not read light.
9. **Rest.** `rest` scales the sleep's fall and its cap (`SLEEP_HOURS × 100 / rest`); otherwise a pallet sleeper woke after seven hours with rest 0 and lost nothing. The floor rests at 50, so a pallet is better than the floor.
10. **Pallets** are two building rows (2 cloth or wool; 3 fiber, straw or reeds), since a building input has one count; the labor is `hauling` (any dwarf, children too): every job has a labor. **Stone beds** follow the owner's later note (a mason's recipe, twice for the two kinds of pallet materials, no quality), not the design's "same labor".
11. **Dressed beds, racks, candle stands and mugs** share one mechanism: a building row's `wants`, filled by `haul_to_stockpile` as a hospital chest is, held as `installed` items. It lands with the beds (T-551).
12. **The rack** wants what its checklist of drying rows allows (default all); drying days are counted on `DayPassed` by the day's weather.
13. **Half fuels**: one `fuel` bar or two `fuel_half` items; no fuel-value field. **Smoke** is a per-workshop record and a thought at the job's completion within 3 tiles, tinted like mist.
14. **Tipsy** is a timed field of 10's (`tipsyUntil`), not a rune effect: 10 owns speed, productivity and talks.
15. **The cellar** is dark when no tile is `lit` or in comfort light, judged daily with 05's temperature; aging counts days in a working cellar, by the barrel's wood (oak tagged `fine_cask`).
16. **Distilling** uses the container rule as it is: 20 units from one barrel into an empty one.
17. **Honey.** Cleaning already prevents infection, so honey is an alternative input (for cloth in `dress_burn`, a honeyed burn counting as cleaned; for water in `clean_wound`). **Soap** marks the patient `washed` for the admission.
18. **Compost** is a zone of fixed slots for rotten food and dung; straw is not composted (it is stuffing). **Fertilizer** is an optional second input of `plant` and adds 1 to the yield, beyond the skill cap; growth is unchanged.
19. **Hives** are an item made three ways (carpenter, kiln, craftsdwarf), since a building input has one count. Flowers are the compositor's test, moved into `core/` for both.
20. **New wild plants and ironwood** are placed by conversions of eligible tiles, each on its own stream, never by biome weights; ironwood never regrows. **Reindeer and camels** spawn wild on their own stream. **Starfall** is rolled on its own world-generation stream after the other traits. Every other draw is unchanged.
21. **Ice** is cut, not dug: the tile stays frozen and is cut again after three days. An ice block is a `stone_block` of `ice`, melting on the rot queue; ice constructions cool by 10 °C at the tile and its neighbours and melt with no water.
22. **Fire on purpose** takes the `woodcutting` labor (children never light fires) and a confirmation as the first deepsilver does.
23. **Wyrmtongue**: an ash tile is the `ash` flag or `ash_soil`; a harvest renews the ash; `bitter_cold` is held off while `ate_wyrmtongue` lasts. **Salted meals** give a thought beside the meal's (+1), not a renamed tier; meals record their seasonings.
24. **Ironwood**: chop time scales only above hardness 100; its shield's +5 block is dropped (no rule blocks by material).
25. **The horn bow** is its own launcher row. **Fletching** uses the `enchants` table with a `workshop` column, at the bowyer's `carpentry`.
26. **The feast** is a stack of servings eaten before any other meal, hauled as meals are. **Mugs** are held by dining tables, one per chair beside them. **Whims** are a content table drawn on 10's own stream.
27. **Signatures** are a content table (biome, geology, trait), not derived from generation; caverns, which every site has, have no row. **Sundries** land with their goods, each row with its task.
28. **The design's Caverns row** of § 2 and its "Thane's hall by lantern light" line have no rule of their own (the lantern is a whim).

**The re-cut.** T-549 lost scale armour, horn bows and fletching to `T-562-making-do-scale-armour-and-bows.md`; T-553 lost candles, stands and lanterns to `T-563-making-do-candles-and-lanterns.md` (which needs the wants of T-551, the smoke of T-552, the glass of T-553 and the comfort light of T-554); T-555 lost compost, fertilizer and soap to `T-564-making-do-compost-fertilizer-soap.md`; T-561 lost feasts, whims and mugs to `T-565-making-do-hall-life.md`. T-551 builds the shared wants mechanism, so T-552 needs it. Every task's Needs and Size are in its work file.

## Done

- The spec carries every rule of the design that is to be built, marked by the task that builds it, and the content docs carry the planned rows.
- The implementation tasks are ready to dispatch: each names the spec sections it builds, its dependencies and its measurement.
- The six static checks pass. Commit with `Closes: T-546`.
