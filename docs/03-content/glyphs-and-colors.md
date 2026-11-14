# Glyphs and Colors

**Owner:** content (`glyphs`, `palette`) · **Depends on:** [`../02-systems/23-rendering.md`](../02-systems/23-rendering.md), [`../01-architecture/tech-stack.md`](../01-architecture/tech-stack.md)

## Glyph set

The atlas holds CP437 (256 glyphs, indices 0–255) followed by these extras (indices from 256):

| Index | Glyph | Code point | Used for |
|---|---|---|---|
| 256 | `♥` | U+2665 | hall spirit (also CP437 3; listed for the status bar font) |
| 257 | `⌠` | U+2320 | fishing rod |
| 258 | `⌡` | U+2321 | crutch |
| 259 | `∫` | U+222B | quiver |
| 260 | `Ю` | U+042E | barrel |
| 261 | `ð` | U+00F0 | bag |
| 262 | `Ξ` | U+039E | anvil |
| 263 | `Ρ` | U+03A1 | axe |
| 264 | `Θ` | U+0398 | bed |
| 265 | `Ω` | U+03A9 | statue |
| 266 | `π` | U+03C0 | cabinet |
| 267 | `∂` | U+2202 | mug |
| 268 | `↯` | U+21AF | storm (status bar) |
| 269 | `☼` | U+263C | sun, hearth, drink (CP437 15; listed for clarity) |
| 270 | `◙` | U+25D9 | archery target |
| 271 | `‼` | U+203C | mechanism, fire |
| 272 | `£` | U+00A3 | ore |
| 273 | `♦` | U+2666 | cut gem |
| 274 | `τ` | U+03C4 | sapling |
| 275 | `╪` | U+256A | floodgate |
| 276 | `¤` | U+00A4 | hatch |
| 277 | `§` | U+00A7 | chain |
| 278 | `∩` | U+2229 | nest box, hills |
| 279 | `▓` | U+2593 | raised bridge |

CP437 already provides `☺`, `☻`, `♣`, `♠`, `♀`, `≈`, `≡`, `▒`, `█`, `▲`, `╬`, `╥`, `╫`, `╨`, `╧`, `╤`, `▄`, `▬`, `▪`, `▐`, `•`, `○`, `∙`, `≡`, `"`, `'`, `%`, `*`, `^`, `,`, `.`, `+`, `/`, `\`, `<`, `>`, `X`, `_`, `~`, `-`, `|`, letters and digits.

UI glyph aliases use `▸`→`►`, `▾`→`▼`, `□`→space, `▪`→`∙`, `…`→`»`, `●`→`•`, `★`→`☼`, and newline→space. Recipe makeability therefore draws `•` when makeable and `○` otherwise.

## Palette

Hex values for the light-on-dark default. The colorblind palette replaces every color that supplies an alternate with that alternate. Material and nature rows carry an alternate column for each id/hex pair.

### Base 16

| id | hex |
|---|---|
| `black` | #000000 |
| `dark_gray` | #555555 |
| `gray` | #AAAAAA |
| `white` | #FFFFFF |
| `dark_red` | #AA0000 |
| `red` | #FF5555 |
| `dark_green` | #00AA00 |
| `green` | #55FF55 |
| `brown` | #AA5500 |
| `yellow` | #FFFF55 |
| `dark_blue` | #0000AA |
| `blue` | #5555FF |
| `dark_magenta` | #AA00AA |
| `magenta` | #FF55FF |
| `dark_cyan` | #00AAAA |
| `cyan` | #55FFFF |

### State and UI colors

| id | hex | alternate |
|---|---|---|
| `dwarf_normal` | #FFFFFF | |
| `dwarf_need` | #FFD34D | #FFB000 |
| `dwarf_wounded` | #FF6060 | #FF77CC |
| `dwarf_asleep` | #6A8CFF | |
| `dwarf_child` | #B0B0B0 | |
| `dwarf_soldier` | #4DFF88 | #00A2FF |
| `hostile` | #E60000 | #E65100 |
| `hostile_bright` | #FF7A7A | #FFB74D |
| `undead_gray` | #9C9C7A | |
| `hollow_violet` | #B266FF | |
| `wyrm_red` | #FF2A00 | #E64500 |
| `trader_mountainhome` | #FFD700 | |
| `trader_hillfolk` | #D2B48C | |
| `trader_wildwood` | #7CFC00 | #00C8FF |
| `undiscovered` | #0A0A0A | |
| `sky_day` | #1E2E4A | |
| `sky_night` | #05070F | |
| `abyss` | #000000 | |
| `panel_bg` | #101418 | |
| `panel_border` | #556677 | |
| `text` | #E0E0E0 | |
| `text_dim` | #808080 | |
| `text_key` | #FFFF55 | #FFFF55 |
| `text_value` | #55FFFF | |
| `text_good` | #55FF55 | #00A2FF |
| `text_bad` | #FF5555 | #FF7F00 |
| `note` | #909090 | |
| `alert` | #FFB700 | #FFB000 |
| `danger` | #FF4040 | #FF7F00 |
| `cursor` | inverted | |
| `ghost_ok` | #358035 | #2B558C |
| `ghost_bad` | #903535 | #8C4E2B |
| `lever_gray` | #C0C0C0 | |
| `trap_gray` | #8A8A8A | |
| `well_blue` | #6AA6FF | |
| `hearth_orange` | #FF9A2E | |

### Fluid ramps

| id | hex | alternate |
|---|---|---|
| `water_1` (levels 1–2) | #60C0FF | #68D0FF |
| `water_2` (3–4) | #2880E0 | #1890E8 |
| `water_3` (5–6) | #1848A8 | #0058B8 |
| `water_7` (7) | #0C1C60 | #002878 |
| `water_bg` | #0A1840 | |
| `magma_1` | #FF8C1A | |
| `magma_2` | #FF6A00 | |
| `magma_3` | #E64500 | |
| `magma_7` | #C02800 | |
| `magma_bg` | #3A0800 | |
| `mist_bg` | #1C3A44 | |
| `ice_blue` | #BFE6FF | |

### Designation and zone tints (backgrounds)

| id | hex |
|---|---|
| `des_dig` | #1E3A8A |
| `des_channel` | #0E5A6A |
| `des_stairs` | #5A1E7A |
| `des_ramp` | #46206E |
| `des_smooth` | #3A3A3A |
| `des_engrave` | #5A5A5A |
| `des_remove` | #6A1E1E |
| `des_chop` | #1E5A1E |
| `des_gather` | #4A5A1E |
| `zone_stockpile` | #23303F |
| `zone_farm` | #3F2E1E |
| `zone_pasture` | #1E3F1E |
| `zone_bedroom` | #35203F |
| `zone_dining` | #3F3A1E |
| `zone_hearth` | #3F2A12 |
| `zone_hospital` | #3F2626 |
| `zone_barracks` | #2A3038 |
| `zone_range` | #2A3830 |
| `zone_meeting` | #2E2E3F |
| `zone_tomb` | #262626 |
| `zone_dump` | #3A3A1E |
| `zone_fishing` | #1E2E3F |
| `zone_gather` | #2E3A1E |
| `zone_sanctum` | #1E363A |

### Material and nature colors

| id | hex | alternate | | id | hex | alternate |
|---|---|---|---|---|---|---|
| `sand_tan` | #C8B88A |  |  | `oak_brown` | #8B5A2B |  |
| `bone_white` | #E8E0C8 |  |  | `pine_yellow` | #C9A24C |  |
| `slate_gray` | #6E7278 |  |  | `pine_green` | #2F6B3A |  |
| `pebble_gray` | #9A9080 |  |  | `birch_pale` | #E6E0C8 |  |
| `pale_gray` | #C0C0B8 |  |  | `willow_green` | #7FA86B |  |
| `chalk_white` | #F0EEE6 |  |  | `yew_red` | #A0522D |  |
| `dust_brown` | #9C8A6A |  |  | `ash_pale` | #D8D0B8 |  |
| `granite_gray` | #8C8C8C |  |  | `maple_amber` | #C97A2F |  |
| `diorite_gray` | #A8A8A0 |  |  | `shroom_gray` | #B8B0C0 |  |
| `dark_gray_rock` | #505050 |  |  | `fern_teal` | #4E8C7A |  |
| `basalt_black` | #3A3A3A |  |  | `grass_green` | #2E8B2E | #3A7A9C |
| `rose_gray` | #B08A8A |  |  | `grass_dry` | #A8A040 |  |
| `ash_gray` | #7A7A7A |  |  | `moss_teal` | #2E7A6E |  |
| `obsidian_black` | #1C1C24 |  |  | `mud_brown` | #5A3E1E |  |
| `marble_white` | #F2F2F2 |  |  | `snow_white` | #F4F8FF |  |
| `slate_blue` | #5A6A7A |  |  | `bright_green` | #66FF66 |  |
| `banded_gray` | #8A8A96 |  |  | `berry_red` | #C81E3C |  |
| `glitter_gray` | #A0A0B0 |  |  | `nut_brown` | #8B6B3B |  |
| `quartz_white` | #E8E8F0 |  |  | `flax_straw` | #D8C878 |  |
| `sheen_gray` | #9A9AA8 |  |  | `sun_yellow` | #FFD23C |  |
| `loam_brown` | #6B4E2E |  |  | `frost_blue` | #8AC6FF |  |
| `clay_red` | #A0522D |  |  | `barley_gold` | #D4A017 |  |
| `sand_yellow` | #E0C878 |  |  | `turnip_violet` | #B07AC8 |  |
| `silt_gray` | #8A8A78 |  |  | `cabbage_green` | #7ACC52 |  |
| `peat_black` | #2E2418 |  |  | `pumpkin_orange` | #FF8C00 |  |
| `cave_umber` | #4E3A2E |  |  | `hops_green` | #6AB04C |  |
| `hematite_red` | #8B2E2E |  |  | `dimcap_violet` | #7A5AA0 |  |
| `magnetite_black` | #2E2E38 |  |  | `cavewheat_pale` | #C8C0A0 |  |
| `limonite_yellow` | #B8962E |  |  | `bell_white` | #E6E6FA |  |
| `malachite_green` | #2E8B57 |  |  | `root_amber` | #C8783C |  |
| `copper_orange` | #B87333 |  |  | `spore_violet` | #9A6ACC |  |
| `tin_gray` | #C0C0C8 |  |  | `linen_cream` | #EDE6D0 |  |
| `galena_gray` | #6E6E78 |  |  | `wool_cream` | #F0E8D8 |  |
| `sphalerite_brown` | #7A5A3A |  |  | `silk_white` | #F8F8F8 |  |
| `tetra_gray` | #5E5E68 |  |  | `leather_brown` | #7A4A1E |  |
| `gold_yellow` | #FFD700 |  |  | `hide_brown` | #8A5A3A |  |
| `silver_white` | #E8E8E8 |  |  | `meat_red` | #B03030 |  |
| `platinum_white` | #E5E4E2 |  |  | `corpse_red` | #6A1A1A |  |
| `bismuth_pink` | #D8A0B8 |  |  | `rot_green` | #5A7A2E |  |
| `coal_black` | #202020 |  |  | `meal_brown` | #A0703A |  |
| `lignite_brown` | #4A3A2A |  |  | `meal_gold` | #D8A040 |  |
| `charcoal_gray` | #404040 |  |  | `meal_red` | #C04040 |  |
| `deepsilver_blue` | #9AD0FF |  |  | `flour_white` | #F4F0E8 |  |
| `bronze_gold` | #CD7F32 |  |  | `cheese_yellow` | #F0D060 |  |
| `bronze_pale` | #D8A860 |  |  | `egg_cream` | #F0E8D0 |  |
| `iron_gray` | #7A7A7A |  |  | `milk_white` | #F8F8F0 |  |
| `steel_bright` | #B8C0C8 |  |  | `tallow_yellow` | #E8D890 |  |
| `lead_gray` | #5A5A66 |  |  | `shell_pink` | #F0C8C0 |  |
| `zinc_gray` | #A8B0B8 |  |  | `glow_green` | #7CFFB2 |  |
| `brass_gold` | #D4AF37 |  |  | `amethyst_violet` | #9966CC |  |
| `electrum_pale` | #E8E0A0 |  |  | `garnet_red` | #A02040 |  |
| `dog_tan` | #C8A878 |  |  | `emerald_green` | #50C878 |  |
| `cat_gray` | #A0A0A0 |  |  | `ruby_red` | #E0115F |  |
| `cow_brown` | #8B5A3C |  |  | `sapphire_blue` | #0F52BA |  |
| `sheep_cream` | #F0EAD6 |  |  | `diamond_white` | #F8FCFF |  |
| `goat_gray` | #B0A898 |  |  | `deer_tan` | #C8A070 |  |
| `goat_white` | #F0F0F0 |  |  | `boar_brown` | #6B4A2E |  |
| `chicken_white` | #F8F8F0 |  |  | `wolf_gray` | #8A8A90 |  |
| `pig_pink` | #F0B0B0 |  |  | `bear_brown` | #5A3A1E |  |
| `mule_brown` | #7A5A3A |  |  | `fox_orange` | #E07030 |  |
| `yak_black` | #2E2A28 |  |  | `rabbit_gray` | #B8B0A8 |  |
| `horse_brown` | #8B4513 |  |  | `elk_brown` | #7A5A3A |  |
| `horse_dun` | #C2A878 |  |  | `leopard_pale` | #E0D8C8 |  |
| `crab_pale` | #E8D0C0 |  |  | `lizard_green` | #6A8A3A |  |
| `fish_pale` | #D0D8E0 |  |  | `croc_green` | #4A6A3A |  |
| `ox_gray` | #7A7A78 |  |  | `badger_gray` | #6A6A6A |  |
| `hound_umber` | #5A4030 |  |  | `lynx_tan` | #C8B090 |  |
| `ember_orange` | #FF7A2E |  |  | `mammoth_brown` | #5A3E28 |  |
| `prof_gray` | #A0A0A0 |  |  | `prof_orange` | #FFA040 |  |
| `prof_brown` | #C08040 |  |  | `prof_steel` | #B0C0D0 |  |
| `prof_tan` | #D8C8A0 |  |  | `prof_white` | #F0F0F0 |  |
| `prof_green` | #60D060 |  |  | `prof_red` | #FF6060 |  |
| `prof_violet` | #C090FF |  |  | `prof_dim` | #707070 |  |
| `tundra_gray` | #B8C0B0 |  |  | `savanna_gold` | #D8B860 |  |
| `forest_green` | #2E6B2E |  |  | `badlands_red` | #A05030 |  |
| `wetland_teal` | #3A7A6A |  |  | `jungle_green` | #1E7A3E |  |
| `hill_olive` | #7A8A3A |  |  | `dark_forest_green` | #1E3A1E |  |
| `alpine_white` | #E8ECF0 |  |  | `oak_leaf` | #3E7A2A |  |
| `ash_leaf` | #7A9A5A |  |  | `grass_deep` | #1E6E2A |  |
| `grass_light` | #5AA83E |  |  | `grass_olive` | #6E8A2E |  |
| `grass_pale` | #8FA070 |  |  | `moss_green` | #3E6E3A |  |
| `flower_white` | #ECECE0 |  |  | `flower_yellow` | #F0D040 |  |
| `flower_violet` | #A878D8 |  |  | `flower_red` | #D84858 |  |
| `flower_blue` | #6890E8 |  |  | `lichen_gray` | #8E9C84 |  |
| `lichen_orange` | #C08448 |  |  | `lichen_yellow` | #B8B464 |  |
| `rune_cyan` | #5AD8E0 |  |  | `ward_cyan` | #1A4448 |  |
| `glow_halo` | #0E2426 |  |  | `glow_core` | #1E4C50 |  |
| `reed_green` | #9AA65A |  |  | `cactus_green` | #5E8C4A |  |
| `nettle_green` | #4F7A3A |  |  | `rye_gold` | #B89A55 |  |
| `wyrmtongue_red` | #C2452D |  |  | `ironwood_dark` | #4A3A2C |  |

## Glyphs by thing

### Terrain

| Thing | Glyph | fg | bg |
|---|---|---|---|
| undiscovered | ` ` | — | `undiscovered` |
| rough wall | `▒` | material | `black` |
| smoothed wall | `█` | material | `black` |
| engraved wall | `☼` | material | `black` |
| constructed wall (block) | `█` | material | `black` |
| constructed wall (log, raw stone) | `▒` | material | `black` |
| rough floor | `.` (outdoors also pebbles `·` and a stone `∙`) | material; outdoor bare rock leans toward the biome's rock tints in patches | `black` |
| smoothed floor | `+` | material | `black` |
| engraved floor | `☼` | material (dimmed) | `black` |
| paved floor | `≡` | material | `black` |
| grass floor | `"` (outdoors also `'` and `` ` ``) | `grass_green` / `grass_dry` / `moss_teal`, outdoors leaning toward the biome's grass tints | `black` |
| flower on outdoor grass | `*` | the biome's flower colors | `black` |
| mud | `.` | `mud_brown` | `black` |
| snow-covered | floor glyph | `gray` | `snow_white` |
| ash | `.` | `ash_gray` | `black` |
| ramp | `▲` | material | `black` |
| stairs | `<` `>` `X` | material | `black` |
| fortification | `╬` | material | `black` |
| tree | species glyph | species color | `black` |
| sapling | `τ` | species color | `black` |
| shrub | `"` (species may override) | species color | `black` |
| boulder | `○` | material | `black` |
| higher ground (a natural wall under the outdoor surface, 1–3 levels up) | the surface's glyph | the surface's | the surface's, blended toward the ground's tone (23 § Compositor step 2) |
| open, floor visible below | below's glyph | dimmed | dimmed |
| open sky | ` ` | — | `sky_day` / `sky_night` |
| open abyss | ` ` | — | `abyss` |
| water | `~` (1–2) `≈` (3–7) | `water_*` | `water_bg` |
| magma | `~` (1–2) `≈` (3–7) | `magma_*` | `magma_bg` |
| ice | `▒` / `.` | `ice_blue` | `black` |
| fire | `^` / `‼` alternating | `yellow` / `red` | `black` |
| web | `*` | `silk_white` | `black` |

### Creatures

Dwarves `☺` with state colors; traders `☺` in civ colors; animals by species glyph and color; hostiles as listed in [creatures.md](creatures.md). Unconscious: alternate with `_`.

### Items

By category (depth 2): food `%`, drink `☼`, seed `,`, stone raw `•`, block `▪`, gem rough `*`, gem cut `♦`, ore `£`, log `≡`, bar `▬`, furniture per item, container per item, weapon `/` (melee) `)` (ranged), ammo `↑`, armor `[`, clothing `[`, tool per item, craft `♀` (mug `∂`), textile `~` (cloth `≈`), medical `♣` (brightleaf) `~` (bandage) `♠` (glowcap) `¡` (rune vial, hollow ichor, spider venom) `§` (wyrmscale) `♥` (ember gland), refuse `%` in `corpse_red` / `bone_white` / `rot_green`. Color is the material's.

### Buildings

Per [buildings-and-furniture.md](buildings-and-furniture.md). Doors `+` closed, `/` open, red when locked. Lever `/` (off) `\` (on). Plate `_`. Bridge `═` lowered, `▓` raised. Traps `^` in `trap_gray`. Hearth `☼` in `hearth_orange` with a pulsing `bg` between `black` and `#3A1A00`. Well `○` in `well_blue`. Rune circle `○` in `rune_cyan`. Depot and wagon patterns below. Planned buildings: the same glyph in `text_dim`.

### Workshop patterns (3×3, north at top)

```
carpenter    mason        craftdwarf   jeweler      mechanic     furnace
╥ ≡ ╥        • ▪ •        ♀ ∂ ♀        ♦ * ♦        ‼ ¤ ‼        ▒ ^ ▒
≡ ┼ ≡        ▪ ┼ ▪        ♀ ┼ ♀        * ┼ *        ¤ ┼ ¤        ^ ┼ ^
╥ ≡ ╥        • ▪ •        ♀ ∂ ♀        ♦ * ♦        ‼ ¤ ‼        ▒ ^ ▒

smelter      forge        kitchen      still        tannery      leatherworks
▒ ‼ ▒        Ξ ‼ Ξ        % ╥ %        Ю ☼ Ю        ≈ u ≈        [ ╥ [
‼ ┼ ‼        ‼ ┼ ‼        ╥ ┼ ╥        ☼ ┼ ☼        u ┼ u        ╥ ┼ ╥
▒ ‼ ▒        Ξ ‼ Ξ        % ╥ %        Ю ☼ Ю        ≈ u ≈        [ ╥ [

loom         clothier     farmers      butcher      kennel       bowyer
~ ≈ ~        [ ≈ [        u ╥ u        % ╥ %        § ▒ §        ) ≡ )
≈ ┼ ≈        ≈ ┼ ≈        ╥ ┼ ╥        ╥ ┼ ╥        ▒ ┼ ▒        ≡ ┼ ≡
~ ≈ ~        [ ≈ [        u ╥ u        % ╥ %        § ▒ §        ) ≡ )

depot        wagon        alchemist    runeforge
▄ ═ ▄        ○ ═ ○        ¡ ╥ ¡        Ξ ¡ Ξ
═ ┼ ═        ═ ▄ ═        ╥ ┼ ╥        ♦ ┼ ♦
▄ ═ ▄        ○ ═ ○        ¡ ╥ ¡        Ξ ¡ Ξ
```

The center `┼` is the work tile; the south-center tile is the output tile. Impassable corner tiles (smelter, forge, furnace, runeforge and magma variants) are the `▒`, `Ξ` glyphs. Magma variants draw the pattern in `magma_2` instead of the material color.

### Status bar glyphs

Sun `☼` day, moon `C` night (CP437 lacks a moon; `C` in `dark_cyan` is the convention), weather: clear `☼`, overcast `≡`, rain `'`, storm `↯`, snow `*`, fog `≡` dim, heatwave `☼` red, cold snap `*` cyan; population `☺`; hall spirit `♥`; patients `+` red; hostiles `!` red; caravan `$`; speed `►`, `►►`, `►►►`, paused `║`.

## Planned rows

Rows of the Making Do content, not yet in the game and not exported. The task named adds each colour to § Material and nature colors (the hex here is a first choice; it may change if it clashes) and its pattern to § Workshop patterns, adds its lines to [row-order.md](row-order.md) and runs `npm run content:export`.

### Planned colours

| id | hex | task |
|---|---|---|
| `salt_white` | #ECEAE2 | T-547 |
| `chitin_brown` | #6B4A2E | T-547 |
| `horn_gray` | #A89A86 | T-547 |
| `ivory_cream` | #F2E8CF | T-547 |
| `feather_white` | #F4F1EA | T-547 |
| `pewter_gray` | #8E949A | T-547 |
| `dung_brown` | #5C4A30 | T-552 |
| `smoke_bg` | #2E2E2E | T-552 |
| `brick_red` | #A0482E | T-553 |
| `glass_pale` | #BFE3E6 | T-553 |
| `honey_amber` | #D49A2A | T-555 |
| `wax_yellow` | #E8D27A | T-555 |
| `soap_white` | #EEF0F2 | T-564 |
| `star_silver` | #D8E4F0 | T-560 |
| `reindeer_brown` | #8A6A4A | T-561 |
| `camel_tan` | #C8A472 | T-561 |

### Planned workshop patterns

| id | rows | task |
|---|---|---|
| `kiln` | `▄▲▄`, `█☼█`, `▀ ▀` | T-553 |
| `smokehouse` | `≡≡≡`, `≡%≡`, `▀ ▀` | T-552 |

The patterns' exact glyphs follow § Workshop patterns' conventions; a task may choose others from the glyph set.
