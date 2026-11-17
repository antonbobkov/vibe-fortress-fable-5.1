# T-583: how much of Making Do a real game reaches

**Date:** 2026-11-17 · **Commit:** master `6c93906e` (the probes ran on it; the fixes are on `t583-making-do-reach`) · **Design:** [Making Do](../designs/2026-11-06-making-do-content-and-scarcity.md), built as T-546 to T-566, T-571 and T-572 · **Probes:** `test/perf/t583_making_do_reach.test.ts`, `test/perf/t583_making_do_player.test.ts`, `test/perf/t583_making_do_sites.test.ts` · **Runs:** Measure `44150068129` (the twenty sweep seeds, `suite=making_do`), `44150074086` (six seeds with a player, `suite=making_do_player`)

## The question

Making Do added about 140 rows and a dozen mechanisms: soils and fossils to dig, a kiln, glass and skylights, wicker, beds from pallets to dressed beds, racks, smoke and salt, hives and mead, candles and lanterns, a cellar, spirits, compost and fertilizer, soap, scale armour and horn bows, boneyards, ice and fire on purpose, Starfall, spider ranches, beetle jars and bat roosts, reindeer and camels, feasts, whims and mugs, sundries and the scarcity price. In a real game, does that content get made and used, can a player find and order it, and does it work end to end?

## How

- **The fixture as it is.** The reach probe plays each of the twenty sweep seeds (shift 0) for three years with the three-year script unchanged, and records every event, every recipe crafted, every item made (a caravan's goods apart), every building finished, every thought held (sampled every 100 ticks), what each caravan brought, and the map as generated. The script is the sweep's player: what it reaches is what the gates measure.
- **A player on top.** The player probe plays six of the seeds (p0-1, p0-3, p0-5, p2-1, p2-4, p4-2) with the same script and, from day 40, does what a player reading the build menu and the workshop lists would do: it places a kiln, a smokehouse, a clothier, a farmer's workshop, a leatherworks, a bowyer and a loom where the fortress lacks them, two drying racks and two candle stands in the hall, beehives (where most flowers are) and lanterns once their items exist, a compost heap and a gather zone over the wild reed beds and nettles; it adds a keep order for every Making Do recipe at every workshop the fortress has, sets every plot to `fertilize` and every stockpile below the surface to `cellar`, and designates ice every week of winter. Its orders go behind the script's own, so a workshop the script keeps busy gets to them late.
- **The map of every biome.** The sites probe generates three 48 × 48 sites of each land biome and geology (sedimentary, igneous) as the fixture does its temperate forest, counts the Making Do plants, soils, minerals, boneyards, roosts and flowers, and plays the herd biomes 56 days. Two seeds each of tundra and desert were played two years for the herds.
- **The player's path.** The build, designate and zone panels and the orders list were drawn from a day-150 save of the player probe with `scripts/screenshot.mjs --screen` (pictures not committed), and the panels' code read for the rest.

The fixture is a temperate forest at mixed geology, as the sweep is. Its peril-0 maps (`serene_vale`) have no clay; its peril-2 and peril-4 maps have clay walls. It never butchers (no `ButcheryDone` in twenty seeds), never fishes, and orders nothing of Making Do but the wooden bed stuffed with straw.

## The headline

**A real game reaches almost none of Making Do unless the player goes looking for it, and some of it it could not reach when the player did.** The three-year fortresses touch Making Do only where it happens to them: straw from their harvests stuffs their beds, gatherers bring in nettle fiber and reeds (and get stung), miners dig clay, fossils and halite that nobody uses, the Thane wishes every season and is never pleased. Of about forty features, nine are reached by the fixture and one (straw) is used.

A player who orders it all reaches about half within three years on a temperate forest: kilns, wicker, dressed beds, spirits and their singing, the cellar, compost and fertilizer, feasts, salted meals, mugs at the table and met whims. The rest failed for four reasons: three bugs fixed here (flowers die in the first rain so no hive ever made a comb; caravans never brought sand, clay or brightleaf; the orders panel showed the wrong stock), two rules filed (a keep order of glass or brick counts every stone block; ice designations vanish in a temperate thaw), a map that does not have the input (no sand, no horned game, no peat on a temperate forest), and a fixture that never butchers, so no tallow, horn, bone or raw meat for the candle, scale, bow, smokehouse and rack chains. Everything is in the menus: nothing a player would look for is missing from the build menu, the designate and zone panels or a workshop's recipe list.

## The features

*Fixture*: seeds of 20 that reached it, the total, and the median first day. *Player*: seeds of 6 with the player probe (master's code, before the fixes). *Menu*: where a player finds it. A dash is none.

| Feature | Fixture (of 20) | Player (of 6) | On the map, by biome | Player finds it | Verdict |
|---|---|---|---|---|---|
| Soil loads (sand, clay, peat) | 13: 390 clay loads from day 2, never used | 3: used by the kiln | Soil walls only where a biome's soil is two levels deep or more: none in desert, badlands, mountain, tundra or alpine | Dig | Partly reached; no soil to dig on five biomes (filed) |
| Fossils, the first-fossil thought | 8: 60 fossils, `first_fossil` 8 times, from day 12 | 2: crushed to bone ash (12) | `giant_bone` in every sedimentary map (200 to 380 tiles), none in igneous | Dig | Reached; nothing uses them unless ordered |
| Giant skull, mounted | — | — | A skull per boneyard (desert, badlands, tundra, wetland) | Mason's list | Not reached on the fixture's biome |
| Halite, salt | 7: 33 halite ore, never crushed | 2: crushed (4), salted meals | Halite in every sedimentary map | Kitchen's list | Reached as ore; salt only when ordered |
| Bog iron | — | — | Dark forest, wetland, taiga | Smelter's list | Not on the fixture's map |
| Straw, the straw bed | 20: 5452 straw, 1162 straw beds | 6 | Every grain harvest | Carpenter's list | **Reached and used** |
| Wild reeds, nettles, ironwood | Reeds 7 (378), nettle fiber 19 (843), ironwood logs 19 (142) | 6 | Reed beds on every brook; nettles in temperate, dark forest, hills, wetland; ironwood in forests | Gather zone, chop | Reached; the fiber and reeds lie unused unless ordered |
| Rye, lichen, cactus, salt crust, wyrmtongue | — | — | Rye on taiga, tundra, cold steppe; lichen on cold ones (500 tiles a map on alpine); cactus and salt crust on desert and badlands (salt crust 11 over three maps); wild wyrmtongue only in a Starfall crater | Gather zone | Present on their biomes; not on the fixture's |
| Butcher parts: horn, feather, chitin, ivory | — | — | Horned and feathered game, cave crawlers | Butcher | Not reached: the fixture never butchers |
| Wicker (basket, rope, hive, buckler) | — | 5: 26 | Reeds | Craftsdwarf's list | Works when ordered |
| Kiln: potash, pots, jugs, mugs, clay hives, bone ash | — | 5 kilns from day 44: 74 jobs | — | Build › Workshops | Works when ordered; bricks blocked by the keep rule (filed) |
| Glass blocks, lanterns, glass mugs, skylights, glass walls | — | — (no sand) | Sand only on hills, cold steppe, savanna; the Mountainhome never brought its sand (fixed) | Kiln's list; glass floor or wall by material | Not reached: no sand on the map or by caravan |
| Beds: pallet, stone bed, bedding, pillow, dressed bed | Wooden beds only; no pallet (the script builds beds) | Stone beds 6; bedding and pillows 14 in 4; slept dressed 256 times in 2, from day 238 | — | Furniture; clothier's list | Works when ordered; slow (the clothier waits on the carpenter's chest) |
| Drying rack | — | 7 built, nothing dried | — | Build › Special | Built; starved: no raw meat, peat or dung |
| Smokehouse, salted and smoked meat | — | 5 built, nothing smoked | — | Build › Workshops | Built; starved of raw meat (no butchery) |
| Beehive, honeycomb, honey, beeswax, mead | — | 12 hives in 6, **no comb ever** | Flowers 6 to 61 a map at generation; 0 after the first rain | Furniture | **Broken** (fixed: flowers stand in mud) |
| Stings | Nettles 13 (47) | Bees 3 (8), passers-by | — | — | Reached |
| Candles, candle stands, lanterns | — | 11 stands, never a candle | — | Special; craftsdwarf's list | Built; no tallow (no butchery), no glass |
| Spirits, tipsy, singing | — | 6: 248 distillings, 2394 spirits drunk | — | Still's list | **Works**; the fortress drinks as fast as it distils |
| The cellar, aged drink | — | 4: 40 aged drinks | — | Stockpile › `[S-c]` | Works when set |
| Compost heap, fertilizer | — | 6: 947 compost, all used on the plots | — | Zones `[S-k]`; plot `[w]` | Works when set |
| Soap, washing a patient; honey as a dressing | — | — | — | Kitchen's list | Not reached: no tallow or potash together, no honey |
| Scale armour, horn bow, fletching | — | — (no shell, bone pile or horn; no feather) | — | Leatherworks', bowyer's lists | Not reached (no butchery) |
| Bone blocks and furniture, carved fossils | — | — (fossils went to bone ash first) | Sedimentary maps | Mason's, craftsdwarf's lists | Not reached in three years |
| Pewter, shell or bone-ash steel, star steel | — | — | Star iron only on Starfall (one in seventy regions) | Smelter's list | Not reached |
| Ice blocks and constructions | — | 5: 126 cut, most designations lost to the daily thaw | Frozen outdoor water in winter | Designate `[q]` | Barely works in a temperate winter (filed) |
| Fire on purpose | — | — (not ordered) | — | Designate `[S-b]` | Not exercised |
| Boneyards, `stood_in_the_ribs` | — | — | 1 to 3 skeletons on desert, badlands, tundra; 2 of 3 wetland maps | Map | Not on the fixture's biome |
| Starfall crater, star iron | — | — | 3 of 3 Starfall maps: a crater, one star iron | World map trait | Not on the fixture's maps |
| Spider ranch, beetle jar | — | — | Giant cave spiders (6 a map), glow beetles in caverns | Cage trap, cage | Not exercised |
| Bat roosts, guano | Roost found 1; guano 2 (73) | 1 (44) | 0 to 2 roosts a map | — | Reached, mostly unseen |
| Reindeer, camels, the camel's spit | — | — | Herds come by a daily roll: 3 of 4 tundra and desert sites in two years, first on day 60 to 183; none in the first 56 days of 10 sites | — | Present, slow to come; not on the fixture's biome |
| Feasts | — | 2: 4 feasts, `feasted` 31, `held_a_feast` 86 | — | Kitchen's list | Works when ordered |
| Mugs at the table | — | 1: `drank_from_a_mug` 1211 | — | Kiln's, craftsdwarf's lists | Works when made |
| Salted meals, candlelit meals | — | Salted 2 (48); candlelit — | — | — | Salted works; candlelight never (no candles) |
| The Thane's whim | 20: 198 set, **0 of 181 met**, `thane_grumbled` 178 | 2 met: `thane_pleased` 53 | — | Units panel's Thane line | Reached; met only when the player answers it |
| Sundries, the scarcity price | Wildwood: honey, beeswax, feathers, reeds, nettle fiber; Hillfolk: salt, bricks, pots, dung, tallow candles, cured meat, bedding; Mountainhome: flux stones, coal, charcoal, glowstone. Never sand, clay or brightleaf | — | — | Trade screen | Reached; three goods never came (fixed) |
| The workshop-of-blocks rule | — (the script builds of logs) | — (the probe took the default material) | — | Build menu: "Material: [x]", "of blocks" | Not exercised; offered in the menu |
| Site summary (has, lacks) | — | — | — | World map region panel | Present (T-550's tests) |

### The player's path

Every Making Do building is in the build menu: the kiln and the smokehouse (and the magma kiln) under Workshops, the cloth and straw pallets, stone bed, beehive and lantern under Furniture, the drying rack and candle stand under Special. A workshop is offered only when a recipe names it, and every one of Making Do's recipes names a workshop that is offered, so each shows in its workshop's add-order list. The designate panel has `[q] Cut ice` and `[S-b] Set a fire`; the zones panel `[S-k] Compost` and `[g] Gather`; the zone inspector the cellar (`[S-c]`) and fertilize (`[w]`); a rack's panel its drying list; a hive's panel its flowers in reach. Three things are found only by knowing: a skylight is a glass floor (Construction › Floor with glass blocks as its material; a hint names it after the first), a spider ranch or beetle jar is a cage building holding the caged creature (a hint after the first spider), and fletching is a `once` order (the panel says so when a keep is tried). The straw pallet's menu row says "3 fibers", the first of its alternatives, which hides that straw and reeds do as well.

## Issues

### Fixed on this branch

1. **Flowers died in the first rain, so no hive ever made a comb.** Rain sets `mud` on every outdoor soil floor (06 § Weather effects) and mud never goes (04 § Mud), and 07's `flowerAt` and 23's compositor both left out a muddy tile. On seed p0-1 all 20 flowers of the map were gone on day 8 and none came back; the six player seeds built twelve hives and never had a comb, so no honey, beeswax, mead, wax candle or honey dressing came from a hive; T-555's own test held the weather clear. Now mud does not hide a flower or grass's variety: a muddy grass tile draws as grass, and mud tints only a bare floor (07 § Flowers, 23 § Compositor; `test/unit/t583-flowers-in-mud.test.ts`). Only a fortress with hives reads flowers, so no fixture moves; the surface of a fortress looks as it did before its first rain, not brown for good.
2. **Caravans never brought sand, clay or brightleaf.** The draw skips a good worth nothing, and sand and clay (soil, value 0) and brightleaf (a plant of value 0, with an item multiplier of 4000) were worth nothing: the Mountainhome's sand, the Hillfolk's clay and both of the Wildwood's brightleaf entries never came, by the draw or by a request, in sixty caravan-years. A sandless site could make no glass at all. Sand, clay and peat are now worth 1 a load and brightleaf 1 (4 a leaf), *unmeasured* (`materials.md`, `plants.md`; `test/unit/t583-sundries-drawn.test.ts` checks that a request brings every good of every list). This moves the simulation: the sweep and the instrument ran on it (below).
3. **The orders panel's "stocked (n)" counted every unit of the output type.** A keep order of mead or spirits read "stocked (303)" in a fortress with 303 units of ale, and one of glass blocks kept by its material read "stocked (132)" with sandstone blocks and no glass; the workshop counts the order's material or a drink's fixed material (12 § Work orders). The panel now asks the workshop (`workshops.orderStock`, which replaces `stockOf`; 12 § Reader, panels.md § Orders; `test/unit/ui/t583-orders-stock.test.ts`).

### Filed

4. **A keep order of glass blocks or bricks counts every stone block.** The drink rule of 12 § Work orders counts a fixed material only for drinks, so "keep 5 bricks" is stocked by the fortress's 130 sandstone blocks and the kiln never fires a brick: in the player probe `fire_bricks` never ran on the three clay seeds. [T-NEW-keep-order-fixed-material](../../docs/work/T-NEW-keep-order-fixed-material.md).
5. **A site one soil level deep has no soil to dig.** The top tile of a column is a soil floor and the `soilDepth − 1` tiles below are soil walls, and only a wall drops a soil load: the desert, badlands, mountain and tundra maps have no sand, clay or peat wall at all, so the desert's glass, the badlands' bricks and the tundra's peat bricks have no source on the map. 03 step 3 also says the top `soilDepth` tiles are walls. [T-NEW-shallow-soil-loads](../../docs/work/T-NEW-shallow-soil-loads.md).
6. **Ice designations vanish in a temperate winter.** The brook thaws by day and freezes by night, and a thaw clears the designation (03 § Ice harvesting): of twelve tiles designated on day 90 of p0-1, three were cut and nine lost within hours; over the six player seeds 126 blocks were cut from weekly designations of twelve tiles all winter. [T-NEW-ice-designation-daily-thaw](../../docs/work/T-NEW-ice-designation-daily-thaw.md).
7. **The long fixtures play none of Making Do.** No gate that plays a fortress measures the kiln, the cellar, bedding, spirits, hives or the whim; the script never butchers, which starves every chain that starts at a carcass. [T-NEW-fixture-makes-do](../../docs/work/T-NEW-fixture-makes-do.md).

### Seen, not filed

- **Bought sundries are not used by anyone who did not order them.** The Wildwood's honey and the Hillfolk's candles and salt come, but a player who does not order mead, a candle stand or salted meat lets them sit. That is the design: a substitute or a sundry is a choice.
- **The player probe's p2-4 died out** where the fixture's own p2-4 ended with 10 dwarves. Its dwarves were bleeding out from day 3, before the player started, and the last were killed in a fight from day 63. One timeline of a fortress already crippled; the player's surface workshops and haulers are one plausible difference, and nothing in it points at a Making Do rule.
- **The Thane is never pleased by the script.** 181 whims judged and none met; a player answers them (two of six player seeds met one, and everyone thought `thane_pleased`). The draw's "possible" asks only for a workshop that can make the thing, so the Thane asks for mead where no bee has ever found a flower.

## Fun finds

- **Guano under bats nobody has counted.** A roost drops its guano on a discovered tile whether or not a dwarf has stood near enough to count the bats: on p2-1 and p2-5 a cavern tile seen once from afar gathered 73 guano over three years, while only one fortress ever made the "Bats. Hundreds of them." note. Added to fun-features.md.
- **Stung for fiber nobody spins.** The fixture's gatherers brought in 843 nettle fibers over twenty fortresses and were stung 47 times for them; nobody orders coarse thread, so the fiber lies in the stockpile. Noted on the Nettles row.
- **The singing still.** Once a still distils, a fortress drinks spirits as fast as they come: 2394 strong drinks over six player fortresses, a song at the hearth for each (the Tipsy dwarves row).

## Gates

The fixes' gate results (CI on the final head; the sweep and the instrument on `a37b66c4`, the commit that changes the content values) are in the closing commit's body.

## Data

The probe outputs are not committed. To reproduce: `gh workflow run measure.yml --ref <branch> -f suite=making_do` (twenty seeds) and `-f suite=making_do_player` (six), then `gh run download`; the sites probe runs locally in about three minutes (`npx vitest run -c vitest.perf.config.ts test/perf/t583_making_do_sites.test.ts`, `PROBE_OUT=<file>` for its figures).
