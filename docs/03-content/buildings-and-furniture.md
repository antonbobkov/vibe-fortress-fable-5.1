# Buildings and Furniture

**Owner:** content (`buildings`, `zoneTypes`) · **Depends on:** [`../02-systems/14-buildings-and-rooms.md`](../02-systems/14-buildings-and-rooms.md), [`../02-systems/19-defense-and-traps.md`](../02-systems/19-defense-and-traps.md), [items.md](items.md), [glyphs-and-colors.md](glyphs-and-colors.md)

Columns: `footprint` `w×h` (rotatable when noted); `on` placement requirement; `inputs` items consumed or linked; `labor` for the build job; `ticks` build time; `tags` function tags; `room` the room-value contribution beyond the linked item's value (`item` = the item's value / 10); `pass` passable; `fluid` blocks fluid; `value` wealth bonus; `rest` the percent a building tagged `sleep` rests at ([10](../02-systems/10-dwarves.md) § Sleeping; a made-up bed rests at `MADE_UP_REST_PERCENT`, [14](../02-systems/14-buildings-and-rooms.md) § Beds); `wants` the items a built one holds ([14](../02-systems/14-buildings-and-rooms.md) § Building wants); `glyph` and `fg` (`item` = the linked item's glyph and material color; patterns for multi-tile buildings are in [glyphs-and-colors.md](glyphs-and-colors.md)).

## Constructions

| id | name | footprint | on | inputs | labor | ticks | tags | pass | fluid | value | glyph |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `wall` | wall | 1×1 | floor or open (supported) | 1 block, log, bar or raw stone | construction | 100 | — | no | yes | 2 | `█` material |
| `floor` | floor | 1×1 | open (supported, or beside a planned floor) or floor | 1 block, log, bar or raw stone | construction | 60 | — | yes | no | 1 | `+` material |
| `paved_floor` | paved floor | 1×1 | floor | 1 block | construction | 60 | — | yes | no | 1 | `≡` material |
| `ramp` | ramp | 1×1 | floor with an adjacent wall | 1 block or log | construction | 80 | — | yes | no | 1 | `▲` material |
| `stairs_up` | up stairs | 1×1 | floor | 1 block or log | construction | 80 | — | yes | no | 1 | `<` material |
| `stairs_down` | down stairs | 1×1 | floor over open | 1 block or log | construction | 80 | — | yes | no | 1 | `>` material |
| `stairs_updown` | up/down stairs | 1×1 | floor over open | 1 block or log | construction | 100 | — | yes | no | 1 | `X` material |
| `fortification` | fortification | 1×1 | floor | 1 block or bar (or a wall to carve) | construction (masonry to carve) | 120 | — | small only | no | 2 | `╬` material |

Blocks give constructed walls the smooth glyph; logs and raw stone give the rough glyph and no smoothing possibility.

## Furniture placements (consume the item)

| id | name | footprint | on | inputs | labor | ticks | tags | room | pass | glyph | rest | wants |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `bed` | bed | 1×1 | floor | `bed` | carpentry | 40 | sleep | item | yes | `Θ` item | 100 | 1 `bedding` + 1 `pillow` |
| `table` | table | 1×1 | floor | `table` | by material | 40 | eat_at | item | yes | `╥` item | — | 1 `mug` per adjacent chair, up to 4 |
| `chair` | chair | 1×1 | floor | `chair` | by material | 30 | sit | item | yes | `╫` item | — | — |
| `door` | door | 1×1 | floor between two walls | `door` | by material | 60 | door | item | yes (rules) | `+`/`/` item | — | — |
| `hatch` | hatch | 1×1 | stairs_down or ramp top | `hatch` | by material | 60 | hatch | item | yes (rules) | `¤` item | — | — |
| `cabinet` | cabinet | 1×1 | floor | `cabinet` | by material | 40 | store | item | no | `π` item | — | — |
| `chest` | chest | 1×1 | floor | `chest` | by material | 40 | store, container | item | no | `▄` item | — | — |
| `coffin` | coffin | 1×1 | floor | `coffin` | by material | 60 | coffin | item | no | `▬` item | — | — |
| `statue` | statue | 1×1 | floor | `statue` | by material | 80 | — (admire) | item × 2 | no | `Ω` item | — | — |
| `cage_building` | cage | 1×1 | floor | `cage` | by material | 40 | cage | item | no | `▒` item | — | — |
| `nest_box` | nest box | 1×1 | floor | `nest_box` | carpentry | 30 | nest_box | 0 | yes | `∩` item | — | — |
| `weapon_rack` | weapon rack | 1×1 | floor | `weapon_rack` | by material | 40 | — | item | no | `╨` item | — | — |
| `armor_stand` | armor stand | 1×1 | floor | `armor_stand` | by material | 40 | — | item | no | `╧` item | — | — |
| `memorial_slab` | memorial slab | 1×1 | floor | `memorial_slab` | masonry | 60 | memorial | item | no | `╤` item | — | — |
| `archery_target` | archery target | 1×1 | floor | `archery_target` | carpentry | 30 | archery_target | 0 | no | `◙` item | — | — |
| `chain_post` | chain | 1×1 | floor | `chain` or `rope` | construction | 30 | chain | 0 | yes | `§` item | — | — |
| `pallet` | cloth pallet | 1×1 | floor | 2 `cloth` or `wool_raw` | hauling | 20 | sleep | 0 | yes | `≈` material | 90 | — |
| `straw_pallet` | straw pallet | 1×1 | floor | 3 `fiber`, `straw` or `reed` | hauling | 20 | sleep | 0 | yes | `≈` material | 90 | — |
| `stone_bed` | stone bed | 1×1 | floor | `stone_bed` | masonry | 40 | sleep | item | yes | `Θ` item | 95 | — |
| `beehive` | beehive | 1×1 | an outdoor soil floor | `beehive` | by material | 30 | hive | 0 | no | `∩` item | — | — |
| `lantern` | lantern | 1×1 | floor | `lantern` | construction | 30 | light | item | no | `¥` item | — | — |
| `anvil_stand` | — | not a building; the anvil is an input of the forge | | | | | | | | | | |

"By material" labor: wood → carpentry, stone → masonry, metal → smithing (metalcrafting).

A table wants one mug for each chair beside it (a dining seat), up to four, counted in units: a stack of mugs is brought whole, so a stack may give it more than its chairs. A meal at a seat whose table holds its mug is drunk from a mug ([14](../02-systems/14-buildings-and-rooms.md) § Mugs at the table).

A pallet and a straw pallet are laid from their materials, not from an item: their counted input is consumed and returns when they are taken apart, as a construction's does, and they link no item ([14](../02-systems/14-buildings-and-rooms.md) § Beds). Their glyph takes the material's color.

## Mechanisms

| id | name | footprint | on | inputs | labor | ticks | tags | pass | fluid | value | glyph |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `lever` | lever | 1×1 | floor | 1 `mechanism` | mechanics | 60 | lever | yes | no | 5 | `/` `\` `lever_gray` |
| `pressure_plate` | pressure plate | 1×1 | floor | 1 `mechanism` | mechanics | 60 | plate | yes | no | 5 | `_` `lever_gray` |
| `floodgate_building` | floodgate | 1×1 | floor | 1 `floodgate` | mechanics | 80 | floodgate, blocks_fluid | closed: no; open: yes | closed: yes | item | `╪` item |
| `drawbridge` | drawbridge | 1×1 to 5×5 (rotatable; hinge edge chosen) | at least one end tile on floor; the rest floor or open | `w×h` blocks + 1 `mechanism` | mechanics | 60 × tiles | bridge, blocks_fluid (raised) | lowered: yes; raised: no | raised: yes | 8 × tiles | `═` lowered / `▓` raised, material |

## Traps

| id | name | inputs | labor | ticks | tags | pass | glyph |
|---|---|---|---|---|---|---|---|
| `stone_fall_trap` | stone-fall trap | 1 `mechanism` + 1 `raw_stone` | mechanics | 80 | trap:stone_fall | yes | `^` `trap_gray` |
| `spike_trap` | spike trap | 1 `mechanism` + 1–3 `spike` or `spear` | mechanics | 100 | trap:spike | yes | `^` `trap_gray` |
| `cage_trap` | cage trap | 1 `mechanism` + 1 empty `cage` | mechanics | 80 | trap:cage | yes | `^` `trap_gray` |
| `weapon_trap` | weapon trap | 1 `mechanism` + 1–3 melee weapons | mechanics | 100 | trap:weapon | yes | `^` `trap_gray` |

## Special

| id | name | footprint | on | inputs | labor | ticks | tags | pass | value | glyph | wants |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `hearth` | hearth | 1×1 | floor, indoors or outdoors | 3 `stone_block` + 1 `log` | masonry | 200 | hearth, light | no | 50 | `☼` `hearth_orange` | — |
| `trade_depot` | trade depot | 3×3 | floor; reachable from an edge | 3 `log` or 3 `stone_block` | construction | 300 | depot, container | yes | 20 | pattern `depot` | — |
| `well` | well | 1×1 | open tile with water within `WELL_DEPTH` below | 1 `bucket` + 1 `chain` or `rope` + 1 `mechanism` + 1 `stone_block` | mechanics | 150 | well | yes | 15 | `○` `well_blue` | — |
| `wagon` | wagon | 3×3 | placed at embark only | — | — | — | container | yes | 0 | pattern `wagon` | — |
| `rune_circle` | rune circle | 1×1 | floor | 3 `stone_block` + 1 `rune_vial` | masonry | 200 | rune_circle | no | 20 | `○` `rune_cyan` | — |
| `drying_rack` | drying rack | 1×1 | floor | 2 `log`, `stone_block` or `bone_pile` | construction | 60 | rack | no | 3 | `╤` material | 5 units of its drying rows |
| `candle_stand` | candle stand | 1×1 | floor | 1 `stone_block` or `bar` | construction | 40 | light | no | 2 | `ì` material | 5 `candle` |

A candle stand is built of its block or bar (returned when it is taken apart) and is impassable. It wants 5 candles, counted in units (a stack of candles is brought whole), burns the first and lights its 3×3 while it holds one; the candles it holds add their value to its room as furniture does ([14](../02-systems/14-buildings-and-rooms.md) § Candle stands and lanterns). A lantern is placed from its item, links it, and lights its 3×3 forever.

A drying rack is built of its materials (consumed, and returned when it is taken apart) and is impassable. Its `wants` are the inputs of the drying rows its setting takes ([items.md](items.md) § Drying), 5 units in all, and the salt a hide it holds needs ([14](../02-systems/14-buildings-and-rooms.md) § The drying rack).

## Workshops

See [workshops-and-recipes.md](workshops-and-recipes.md) for inputs and recipes. All workshops are 3×3 with the work tile at the center and the output tile at the south-center; the pattern glyphs are in [glyphs-and-colors.md](glyphs-and-colors.md). Impassable workshop tiles are the four corners for `smelter`, `forge`, `wood_furnace`, `runeforge` and the magma variants; every other workshop is fully passable.

## Zone types

| id | name | room | requirements to count | settings | consumers | value types |
|---|---|---|---|---|---|---|
| `stockpile` | stockpile | no | — | filter, containers, priority, links, cellar | 13 | 13's dedicated commands; filter tree, container counts, priority, links and the cellar (`SetStockpileCellar`) |
| `farm_plot` | farm plot | no | soil, mud or cave loam tiles | crop per season, fertilize | 07 | four season slots: 0 or a farmed plant id/index matching plot light; fertilize a boolean (absent: off) |
| `pasture` | pasture | no | walkable | — | 08 | — |
| `bedroom` | bedroom | yes | a bed | owner | 14, 10, 15 | 0 or a living dwarf, with AssignRoom checks |
| `dining_hall` | dining hall | yes | a table with an adjacent chair | — | 10, 15 | — |
| `hearth_hall` | hearth hall | yes | contains the hearth | — | 10, 15, 19 | — |
| `hospital` | hospital | yes | a bed and a chest | desired supplies | 17, 13 | supply-kind record; integer counts 0 to 999 |
| `barracks` | barracks | yes | — | squad | 16 | 0 or a living squad id |
| `archery_range` | archery range | no | an archery target inside | squad | 16 | 0 or a living squad id |
| `meeting_area` | meeting area | no | — | — | 10 | — |
| `tomb` | tomb | yes | a coffin | coffins ready | 14, 15, 12 | integer 0 to the tomb's tiles; absent: `TOMB_COFFINS_READY` (14 § Burial) |
| `dump` | dump | no | — | — | 13 | — |
| `fishing` | fishing | no | tiles adjacent to deep water | — | 09 | — |
| `gather` | gather zone | no | — | priority | 09 | integer 1 to 9 |
| `sanctum` | sanctum | yes | a rune circle | apprentices | 25 | 25's `SetSanctumApprentices` only; at most `SANCTUM_APPRENTICES` living adult dwarves |
| `compost` | compost heap | no | — | — | 13 | — |

"A bed" in a requirement is any built building tagged `sleep`: a bed, a stone bed or a pallet.

## Room quality tiers (from 14)

| Tier | Score |
|---|---|
| bare | < 20 |
| modest | 20–59 |
| decent | 60–149 |
| fine | 150–399 |
| grand | 400–999 |
| royal | ≥ 1000 |

Worked examples:

- A 2×3 bedroom dug in granite, unsmoothed, with a common pine bed (value 10): tiles 6 × 1 = 6; walls 0; furniture 1; size 6; enclosed ×1.5 → 19.5 → **bare**. Smooth the six floor tiles and ten bordering walls: 18 + 20 + 1 + 6 = 45 × 1.5 = 67 → **decent**. Add a fine oak cabinet (27) and a common granite chest (10): +3.7 → 74 → decent; engrave the walls (quality 5: 2 + 2.5 each = 45): 18 + 45 + 4.7 + 6 = 74 × 1.5 = 110 → decent; to reach **fine** the bedroom needs a masterwork bed (75 → 7.5) and engraved floors (8 × 6 = 48): 48 + 45 + 11 + 6 = 110 × 1.5 = 165 → fine.
- A 7×7 hearth hall with the hearth (value 50 → 5), four granite tables (8 → 0.8 each), eight chairs, smoothed floors and walls, two fine statues (36 → 7.2 each): tiles 49 × 3 = 147; walls 28 × 2 = 56; furniture 5 + 3.2 + 4.8 + 14.4 = 27; size 40 (cap); ×1.5 → 405 → **grand** (hearth bonus 4 × 2 = +8 mood to everyone).
