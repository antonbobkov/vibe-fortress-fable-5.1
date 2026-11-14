# Buildings and Furniture

**Owner:** content (`buildings`, `zoneTypes`) · **Depends on:** [`../02-systems/14-buildings-and-rooms.md`](../02-systems/14-buildings-and-rooms.md), [`../02-systems/19-defense-and-traps.md`](../02-systems/19-defense-and-traps.md), [items.md](items.md), [glyphs-and-colors.md](glyphs-and-colors.md)

Columns: `footprint` `w×h` (rotatable when noted); `on` placement requirement; `inputs` items consumed or linked; `labor` for the build job; `ticks` build time; `tags` function tags; `room` the room-value contribution beyond the linked item's value (`item` = the item's value / 10); `pass` passable; `fluid` blocks fluid; `value` wealth bonus; `glyph` and `fg` (`item` = the linked item's glyph and material color; patterns for multi-tile buildings are in [glyphs-and-colors.md](glyphs-and-colors.md)).

## Constructions

| id | name | footprint | on | inputs | labor | ticks | tags | pass | fluid | value | glyph |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `wall` | wall | 1×1 | floor or open (supported) | 1 block, log, bar or raw stone | construction | 100 | — | no | yes | 2 | `█` material |
| `floor` | floor | 1×1 | open (supported) or floor | 1 block, log, bar or raw stone | construction | 60 | — | yes | no | 1 | `+` material |
| `paved_floor` | paved floor | 1×1 | floor | 1 block | construction | 60 | — | yes | no | 1 | `≡` material |
| `ramp` | ramp | 1×1 | floor with an adjacent wall | 1 block or log | construction | 80 | — | yes | no | 1 | `▲` material |
| `stairs_up` | up stairs | 1×1 | floor | 1 block or log | construction | 80 | — | yes | no | 1 | `<` material |
| `stairs_down` | down stairs | 1×1 | floor over open | 1 block or log | construction | 80 | — | yes | no | 1 | `>` material |
| `stairs_updown` | up/down stairs | 1×1 | floor over open | 1 block or log | construction | 100 | — | yes | no | 1 | `X` material |
| `fortification` | fortification | 1×1 | floor | 1 block or bar (or a wall to carve) | construction (masonry to carve) | 120 | — | small only | no | 2 | `╬` material |

Blocks give constructed walls the smooth glyph; logs and raw stone give the rough glyph and no smoothing possibility.

## Furniture placements (consume the item)

| id | name | footprint | on | inputs | labor | ticks | tags | room | pass | glyph |
|---|---|---|---|---|---|---|---|---|---|---|
| `bed` | bed | 1×1 | floor | `bed` | carpentry | 40 | sleep | item | yes | `Θ` item |
| `table` | table | 1×1 | floor | `table` | by material | 40 | eat_at | item | yes | `╥` item |
| `chair` | chair | 1×1 | floor | `chair` | by material | 30 | sit | item | yes | `╫` item |
| `door` | door | 1×1 | floor between two walls | `door` | by material | 60 | door | item | yes (rules) | `+`/`/` item |
| `hatch` | hatch | 1×1 | stairs_down or ramp top | `hatch` | by material | 60 | hatch | item | yes (rules) | `¤` item |
| `cabinet` | cabinet | 1×1 | floor | `cabinet` | by material | 40 | store | item | no | `π` item |
| `chest` | chest | 1×1 | floor | `chest` | by material | 40 | store, container | item | no | `▄` item |
| `coffin` | coffin | 1×1 | floor | `coffin` | by material | 60 | coffin | item | no | `▬` item |
| `statue` | statue | 1×1 | floor | `statue` | by material | 80 | — (admire) | item × 2 | no | `Ω` item |
| `cage_building` | cage | 1×1 | floor | `cage` | by material | 40 | cage | item | no | `▒` item |
| `nest_box` | nest box | 1×1 | floor | `nest_box` | carpentry | 30 | nest_box | 0 | yes | `∩` item |
| `weapon_rack` | weapon rack | 1×1 | floor | `weapon_rack` | by material | 40 | — | item | no | `╨` item |
| `armor_stand` | armor stand | 1×1 | floor | `armor_stand` | by material | 40 | — | item | no | `╧` item |
| `memorial_slab` | memorial slab | 1×1 | floor | `memorial_slab` | masonry | 60 | memorial | item | no | `╤` item |
| `archery_target` | archery target | 1×1 | floor | `archery_target` | carpentry | 30 | archery_target | 0 | no | `◙` item |
| `chain_post` | chain | 1×1 | floor | `chain` or `rope` | construction | 30 | chain | 0 | yes | `§` item |
| `anvil_stand` | — | not a building; the anvil is an input of the forge | | | | | | | | |

"By material" labor: wood → carpentry, stone → masonry, metal → smithing (metalcrafting).

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

| id | name | footprint | on | inputs | labor | ticks | tags | pass | value | glyph |
|---|---|---|---|---|---|---|---|---|---|---|
| `hearth` | hearth | 1×1 | floor, indoors or outdoors | 3 `stone_block` + 1 `log` | masonry | 200 | hearth, light | no | 50 | `☼` `hearth_orange` |
| `trade_depot` | trade depot | 3×3 | floor; reachable from an edge | 3 `log` or 3 `stone_block` | construction | 300 | depot, container | yes | 20 | pattern `depot` |
| `well` | well | 1×1 | open tile with water within `WELL_DEPTH` below | 1 `bucket` + 1 `chain` or `rope` + 1 `mechanism` + 1 `stone_block` | mechanics | 150 | well | yes | 15 | `○` `well_blue` |
| `wagon` | wagon | 3×3 | placed at embark only | — | — | — | container | yes | 0 | pattern `wagon` |
| `rune_circle` | rune circle | 1×1 | floor | 3 `stone_block` + 1 `rune_vial` | masonry | 200 | rune_circle | no | 20 | `○` `rune_cyan` |

## Workshops

See [workshops-and-recipes.md](workshops-and-recipes.md) for inputs and recipes. All workshops are 3×3 with the work tile at the center and the output tile at the south-center; the pattern glyphs are in [glyphs-and-colors.md](glyphs-and-colors.md). Impassable workshop tiles are the four corners for `smelter`, `forge`, `wood_furnace`, `runeforge` and the magma variants; every other workshop is fully passable.

## Zone types

| id | name | room | requirements to count | settings | consumers | value types |
|---|---|---|---|---|---|---|
| `stockpile` | stockpile | no | — | filter, containers, priority, links | 13 | 13's dedicated commands; filter tree, container counts, priority and links |
| `farm_plot` | farm plot | no | soil, mud or cave loam tiles | crop per season | 07 | four season slots: 0 or a farmed plant id/index matching plot light |
| `pasture` | pasture | no | walkable | — | 08 | — |
| `bedroom` | bedroom | yes | a bed | owner | 14, 10, 15 | 0 or a living dwarf, with AssignRoom checks |
| `dining_hall` | dining hall | yes | a table with an adjacent chair | — | 10, 15 | — |
| `hearth_hall` | hearth hall | yes | contains the hearth | — | 10, 15, 19 | — |
| `hospital` | hospital | yes | a bed and a chest | desired supplies | 17, 13 | supply-kind record; integer counts 0 to 999 |
| `barracks` | barracks | yes | — | squad | 16 | 0 or a living squad id |
| `archery_range` | archery range | no | an archery target inside | squad | 16 | 0 or a living squad id |
| `meeting_area` | meeting area | no | — | — | 10 | — |
| `tomb` | tomb | yes | a coffin | — | 14, 15 | — |
| `dump` | dump | no | — | — | 13 | — |
| `fishing` | fishing | no | tiles adjacent to deep water | — | 09 | — |
| `gather` | gather zone | no | — | priority | 09 | integer 1 to 9 |
| `sanctum` | sanctum | yes | a rune circle | apprentices | 25 | 25's `SetSanctumApprentices` only; at most `SANCTUM_APPRENTICES` living adult dwarves |

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

## Planned rows

Rows of the Making Do content, not yet in the game and not exported. Each names the task that adds it: that task moves the row into its table above (in that table's columns, without `table` and `task`), adds its line to [row-order.md](row-order.md) and runs `npm run content:export`. The rules are in [14](../02-systems/14-buildings-and-rooms.md) § Planned. Every number is *unmeasured*.

### Planned buildings

New columns (T-551): `rest`, the percent a `sleep` building rests at (10 § Planned), and `wants`, the items a built one holds (13 § Planned, Buildings that want items). `bed` gets rest 100 and wants 1 `bedding` + 1 `pillow`; `table` wants 1 `mug` per adjacent chair, up to 4 (T-565).

| table | id | name | footprint | on | inputs | labor | ticks | tags | room | pass | rest | wants | glyph | task |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Furniture placements | `pallet` | cloth pallet | 1×1 | floor | 2 `cloth` or `wool_raw` | hauling | 20 | sleep | 0 | yes | 60 | — | `≈` material | T-551 |
| Furniture placements | `straw_pallet` | straw pallet | 1×1 | floor | 3 `fiber`, `straw` or `reed` | hauling | 20 | sleep | 0 | yes | 60 | — | `≈` material | T-551 |
| Furniture placements | `stone_bed` | stone bed | 1×1 | floor | `stone_bed` | masonry | 40 | sleep | item | yes | 75 | — | `Θ` item | T-551 |
| Special | `drying_rack` | drying rack | 1×1 | floor | 2 `log`, `stone_block` or `bone_pile` | construction | 60 | rack | 0 | no | — | 5 units of its drying rows | `╤` material | T-552 |
| Special | `candle_stand` | candle stand | 1×1 | floor | 1 `stone_block` or `bar` | construction | 40 | light | its candles' value / 10 | no | — | 5 `candle` | `ì` material | T-563 |
| Furniture placements | `lantern` | lantern | 1×1 | floor | `lantern` | construction | 30 | light | item | no | — | — | `¥` item | T-563 |
| Furniture placements | `beehive` | beehive | 1×1 | an outdoor soil floor | `beehive` | by material | 30 | hive | 0 | no | — | — | `∩` item | T-555 |

A pallet and a straw pallet return their materials when taken apart. The candle stand and the drying rack have the value 2 and 3 as a special building does (`value` column), and the lantern its item's.

### Planned zone types and settings

| id | name | room | requirements to count | settings | consumers | value types | task |
|---|---|---|---|---|---|---|---|
| `compost` | compost heap | no | — | — | 13 | — | T-564 |

Edits: `stockpile` settings gain `cellar` (boolean, through `SetStockpileCellar`) (T-554); `farm_plot` settings gain `fertilize` (boolean) (T-564); the `bedroom` and `hospital` requirement "a bed" is any building tagged `sleep` (T-551).
