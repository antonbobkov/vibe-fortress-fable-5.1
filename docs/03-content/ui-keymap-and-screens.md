# UI: Keymap, Screens, Panels, Hints

**Detail level:** W3 · **Owner:** content (`keymap`, `hints`, `milestones`, `strings` index) · **Depends on:** [`../02-systems/24-ui-and-input.md`](../02-systems/24-ui-and-input.md), [`../02-systems/23-rendering.md`](../02-systems/23-rendering.md)

## Screens

| id | Purpose | Enter from | Leave to |
|---|---|---|---|
| `main_menu` | New world, Continue, Load, Legends, Settings, About | start, fortress menu | any |
| `world_gen` | Seed, size, generate, preview | main_menu › New world | world_map |
| `world_map` | Choose a region | world_gen | embark, main_menu |
| `embark` | Party, supplies, animals, name | world_map › Embark | fortress |
| `fortress` | The game | embark, load | legend, main_menu |
| `trade_session` | Modal exchange | fortress (depot panel › Trade) | fortress |
| `legend` | A finished fortress's record | fortress end, main_menu › Legends | main_menu |
| `settings` | Keys, palette, auto-pause, hints, autosave | main_menu, fortress menu | back |
| `load` | Saves and autosaves | main_menu, fortress menu | fortress |
| `confirm` | Yes/No dialog | anywhere | back |
| `text_input` | A single text field | rename, save name | back |
| `debug` | Timings, counts, seed, replay controls | `F12` | back |

## Fortress panels

| Hotkey | Panel | Owner | Contents |
|---|---|---|---|
| `d` | Designate | 03 | designation kinds, priority, undo |
| `b` | Build | 14 | categories, types, material choice, orientation |
| `z` | Zones | 14 | zone types, settings of the selected zone |
| `u` | Units | 10 | dwarves table, labor grid toggle, titles |
| `l` | Labors | 11 | labor grid and labor priorities |
| `j` | Jobs | 11 | open, claimed, blocked jobs with reasons |
| `o` | Orders | 12, 11 | work orders across workshops; standing orders |
| `s` | Stocks | 13 | category tree with counts and values; forbid, dump, melt |
| `m` | Military | 16 | squads, alert |
| `n` | Animals | 08, 09 | tame and wild tabs, huntable toggles |
| `t` | Threats | 18 | parties, renown, schedule preview, Deep gauge |
| `c` | Civilizations | 20 | reputation, schedule, requests, depot |
| `p` | Population | 21 | cap, eligibility |
| `e` | Mood | 15 | every dwarf's tier and top thoughts |
| `a` | Log | 24 | announcements with filters; combat tab |
| `k` | Look | 24 | inspection of the tile under the cursor |
| `f` | Overlays | 23 | overlay toggles |
| `?` | Help | 24 | keymap, legend of glyphs |
| `F12` | Debug | 24 | timings and counters |

## Keymap (defaults; every binding is rebindable)

### Global

| Key | Action |
|---|---|
| `Esc` | cancel tool → close panel → game menu |
| `Space` | pause / resume |
| `+` `=` | speed up (1× → 2× → 4×) |
| `-` | speed down |
| `F5` | quick save |
| `F9` | quick load (confirm) |
| `Ctrl+S` | save menu |
| `F12` | debug panel |
| `?` | help |
| `Tab` | toggle sidebar |
| `Ctrl+Z` | undo last designation batch |

### Map

| Key | Action |
|---|---|
| `←` `→` `↑` `↓` | pan by 1 cell (`Shift`: 10) |
| `<` `,` | z-level down |
| `>` `.` | z-level up |
| `Home` | center on the hearth (or wagon) |
| `Ctrl+↑` / `Ctrl+↓` | zoom in / out |
| `k` | look cursor at the mouse (or map center) |
| `Enter` | with a tool: start/end rectangle at the cursor |
| `1`–`9` | with a designation or zone tool: set priority |
| `r` | with a building tool: rotate |
| `x` | with a building tool: cycle material |
| `Delete` | with a selection: cancel designations / remove zone / cancel building |

### Panels

| Key | Action |
|---|---|
| `↑` `↓` | move selection |
| `PageUp` `PageDown` | scroll |
| `Enter` | activate |
| `Tab` / `Shift+Tab` | next / previous field |
| `[letter]` | accelerator shown in brackets |
| `/` | focus the filter field |
| `Backspace` | back within nested menus |

### World map

| Key | Action |
|---|---|
| arrows | move the cursor (`Shift`: 8) |
| `f` | filter panel |
| `Enter` | embark on the region |
| `?` | biome legend |

### Embark

| Key | Action |
|---|---|
| `1` `2` `3` | Dwarves / Supplies / Animals tabs |
| `+` `-` | adjust the selected skill or quantity |
| `r` | reroll the selected dwarf |
| `n` | rename |
| `p` | presets menu |
| `Enter` on the footer | Embark |

### Trade session

| Key | Action |
|---|---|
| `Tab` | switch column |
| `+` `-` | quantity |
| `Enter` | offer |
| `g` | gift (offer with nothing taken) |
| `Esc` | close |

## Mouse

| Gesture | With no tool | With a tool |
|---|---|---|
| Left click | inspect the tile (look panel) | apply to one tile / place building |
| Left drag | select a rectangle (then `Delete`, forbid, dump, move to depot) | designate / draw zone rectangle |
| Right click | inspect with the entity list | cancel the tool |
| Wheel | z-level | z-level |
| `Ctrl` + wheel | zoom | zoom |
| `Shift` + wheel | pan vertically | pan vertically |
| Middle drag | pan | pan |
| Hover | tile summary in the status bar | ghost footprint / rectangle size |
| Click on a panel row | select | select |
| Double-click a unit or job row | center the map on it | same |

## Overlays

| Overlay | Default | Owner |
|---|---|---|
| designations | on | 03 |
| zones | on | 14 |
| priority digits | off | 03 |
| fluid levels | off | 04 |
| temperature | off | 05 |
| jobs | off | 11 |
| squad stations | on while the military panel is open | 16 |
| stockpile usage | off | 13 |
| connectivity (debug) | off | 22 |
| paths (debug) | off | 22 |
| chunks (debug) | off | core |

## Hints

Shown once, as notes with a lamp glyph, when the trigger holds (checked hourly). Ids and triggers:

| id | Trigger | Text |
|---|---|---|
| `hint_dig` | tick 1 | "Designate a place to dig with [d]. Dwarves dig into rock faces from the side." |
| `hint_still` | no still exists and drink < 40 units | "Dwarves need drink. Build a still [b › Workshops] and brew from plants." |
| `hint_stockpile` | no stockpile exists and items on the ground > 20 | "Set up a stockpile [z] so hauled goods have somewhere to go." |
| `hint_winter` | day 20 of spring, year 1 | "Winter comes in 60 days. Farms need soil or mud; cave crops grow in the dark all year." |
| `hint_hearth` | no hearth and at least one dining hall or 5 bedrooms | "A hearth makes a hall a home. Build one [b › Special] in your main hall." |
| `hint_containers` | a drink or seed stockpile exists without barrels or bags | "Stockpiles need barrels for drink and bags for seeds. The carpenter makes barrels; the clothier makes bags." |
| `hint_fuel` | a smelter or forge is blocked for fuel | "Smelters and forges need fuel. A wood furnace makes charcoal from logs; coal seams burn too." |
| `hint_hunter` | hunting labor enabled and no crossbow or bow exists | "Hunters need a crossbow and bolts, or a bow and arrows." |
| `hint_farm` | a farm plot placement is refused | "Farms need soil, mud left by water, or cave loam." |
| `hint_seeds` | first harvest | "Harvest returns one seed. Brewing and cooking do not." |
| `hint_room` | a bedroom zone with tier bare exists for 3 days | "A room needs walls or doors around it, a bed, and smooth stone to be worth sleeping in." |
| `hint_alert` | first `ThreatWarning` | "Raise the alert [m] to send civilians to the hearth and lock doors set to lock on alert." |
| `hint_depot` | day 14 of summer, year 1, no depot | "Build a trade depot [b › Special] before the caravan arrives." |
| `hint_hospital` | first serious wound with no hospital | "A hospital zone needs a bed, a chest, cloth and thread. Brightleaf treats infection." |
| `hint_immigration` | first `ImmigrationSkipped` | "Immigrants come at the turn of the season when hall spirit is Content. Good rooms, meals and drink raise it." |
| `hint_gate` | first raid ended | "A drawbridge over a channel, linked to a lever inside, is the surest gate." |
| `hint_cage` | first cage trap built | "Cage traps catch anything smaller than a wyrm. Caged beasts can be tamed at a kennel or sold." |
| `hint_troll` | first `DoorBroken` | "Trollkin break doors. Walls and raised bridges hold." |
| `hint_deep` | first `VeinFound` deepsilver | "Deepsilver lies beside the Sea of Fire. Taking it wakes the Hollow. The threats panel shows the Deep gauge." |
| `hint_magma` | first cavern 2 breach | "A forge over channeled magma needs no fuel. Build it of magma-safe stone." |

## Milestones (legend record)

| id | Trigger | Text |
|---|---|---|
| `m_hearth` | `HearthLit` | "The hearth was lit." |
| `m_metal` | first `ItemCrafted` of a metal bar | "The first bar was smelted." |
| `m_cavern1` | `CavernBreached` 1 | "The first cavern was breached." |
| `m_cavern2` | `CavernBreached` 2 | "The second cavern was breached." |
| `m_sea` | `CavernBreached` 3 or the Sea of Fire discovered | "The Sea of Fire was seen." |
| `m_fifty` | population ≥ 50 | "Fifty dwarves lived in the hall." |
| `m_magma_forge` | first magma forge completed | "The forge burned without fuel." |
| `m_steel` | first steel bar | "Steel was made." |
| `m_deepsilver` | first `DeepsilverMined` | "The pale metal was taken." |
| `m_hollow` | first Hollow-born killed | "A thing of the Hollow was slain." |
| `m_wyrm` | first magma wyrm killed | "A wyrm was slain." |
| `m_raid` | first `RaidEnded` repelled or wiped | "The first raid was driven off." |
| `m_royal` | first royal room | "A royal hall was made." |
| `m_decade` | year 11 | "Ten years in the deep." |
| `m_legend` | first `LegendaryReached` | "A legend walked the halls." |

## Confirmations

| id | Text | Default |
|---|---|---|
| `c_deepsilver` | "Deepsilver is the finest metal in the world. Taking it wakes the Hollow: creatures will come up through the rock where it was mined. Mine it?" | No |
| `c_retire` | "Retire {fortress}? The hall will be recorded in the Legends and cannot be resumed." | No |
| `c_quickload` | "Load the quick save? Unsaved progress will be lost." | No |
| `c_remove_zone_crops` | "This plot has {n} growing crops. Remove it?" | No |
| `c_remove_stockpile_items` | "This stockpile holds {n} items. They will stay where they are. Remove it?" | No |
| `c_disband_squad` | "Disband {squad}? Members keep their gear." | No |
| `c_deconstruct_workshop` | "This workshop has {n} orders. Deconstruct it?" | No |
| `c_load_snapshot` | "Load the {season} snapshot? The current game continues to exist as its own saves." | No |
| `c_delete_save` | "Delete {save}? This cannot be undone." | No |
| `c_main_menu` | "Return to the main menu? Unsaved progress since {time} will be lost." | No |
| `c_embark_no_pick` | "Embark without a pick?" | No |
| `c_embark_no_food_drink` | "Embark without food or drink?" | No |

## Settings

| Setting | Values | Default |
|---|---|---|
| Auto-pause on danger | on / off | on |
| Auto-pause on alert | on / off | off |
| Hints | on / off | on |
| Colorblind palette | on / off | off |
| Zoom | 0.75 / 1 / 1.5 | 1 |
| Edge scrolling | on / off | off |
| Autosave each season | on / off | on |
| Snapshots kept | 2 / 4 / 8 | 4 |
| Combat log verbosity | all / hits only / off | hits only |
| Keybindings | table | defaults above |

## Strings

Every player-facing string is a key in `strings.json`. Wave 4's screen wireframes list the keys per screen; announcement, thought, hint, milestone and confirmation texts above are their canonical values.
