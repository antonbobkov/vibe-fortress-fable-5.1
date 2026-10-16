# UI: Keymap, Screens, Panels, Hints

**Owner:** content (`keymap`, `hints`, `milestones`, `strings` index) · **Depends on:** [`../02-systems/24-ui-and-input.md`](../02-systems/24-ui-and-input.md), [`../02-systems/23-rendering.md`](../02-systems/23-rendering.md)

## Screens

| id | Purpose | Enter from | Leave to |
|---|---|---|---|
| `main_menu` | New world, Continue, Load, Legends, Settings, About | start, fortress menu | any |
| `world_gen` | Seed, size, generate, preview | main_menu › New world | world_map |
| `world_map` | Choose a region | world_gen | embark, main_menu |
| `embark` | Party, supplies, animals, name | world_map › Embark | fortress |
| `fortress` | The game | embark, load | legend, main_menu |
| `trade_session` | Modal exchange | fortress (depot panel › Trade) | fortress |
| `labor_manager` | Every dwarf's labors, the labor priorities, profession templates | fortress (labors panel › `Enter`; units panel with marked dwarves) | fortress |
| `legend` | A finished fortress's record | fortress end, main_menu › Legends | main_menu |
| `settings` | Keys, palette, auto-pause, hints, autosave | main_menu, fortress menu | back |
| `load` | Saves and autosaves | main_menu, fortress menu | fortress |
| `confirm` | Yes/No dialog | anywhere | back |
| `text_input` | A single text field | rename, save name | back |

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

Jobs: `[/]` or a click focuses target-name/worker text; Enter or Esc finishes typing. `[S-l]` or a click cycles labors with jobs, `[S-s]` or a click cycles all/open/claimed/blocked. Stocks: `[/]` or a click focuses category/item/material text; Enter or Esc finishes typing. These controls also appear in Help.

Stockpile inspector: `[i] link` or its button starts choosing a source stockpile on the map; click it or Enter at the cursor, Esc or right click cancels. `[x] unlink` or its button opens named linked sources; arrows or click select and centre, Enter or the unlink button removes just that link, Esc or Cancel returns. Delete or `[Del] remove zone` removes the stockpile zone with its existing confirmation. Other zone inspectors retain `[x] remove zone`. Panel letters still switch panels inside both link modes; Help lists these actions.

Animals, Tame tab: `[S-c] cap` or click cap opens its inline number field: digits type, `+`/`-` step by one (Shift by ten), Enter or Set submits, Esc or Cancel discards; 0–100, no wrapping. Panel letters remain available.

Animals, Tame tab: `[S-t] train` or its button opens War/Hunting; arrows and Enter, or click a choice; Esc cancels. Panel letters still switch panels inside the choice. Help lists this action and `Esc` then `[n] Rename fortress` from the game menu, also available by clicking its row and entering a name in the text input.

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

Panel hotkeys always win. The letters of § Fortress panels always open or close their panel, whatever panel is open; pressing an open panel's own key closes it; when a panel closes while one of its tools was armed, the status row shows a notice ("Designate closed · [d] opens it again", naming the panel and its key; also for Build and Zones). A panel's accelerator may not use one of those letters bare: it is bound to `Shift`+letter and shown `[S-m]`. Reserved letters are read from the live panel bindings, including rebinds. Fixed accelerator captions show the defaults; zone inspector captions follow the current bindings. With default bindings, the free letters `g h i q r v w x y` work with or without `Shift`. Only a focused text field (a filter, a name, the order picker's `Find`) takes letters as text. With a map selection, forbid, dump and move to depot are `[S-f]`, `[S-d]` and `[S-t]` for the same reason.

Every destructive single-key action asks through the confirmation dialog first, default **No** (§ Confirmations): melt, dump, slaughter, suspend, take apart, disband, remove (a zone, a work order), release (a caged creature). Undoing a mark (resume, unmark) does not ask.

The Orders panel's own keys, beside the accelerators it shows (`ui-screens/panels.md` § Orders); they are the panel's, not rows of the rebindable keymap table:

- `Shift+N`: new order (opens "Add order").
- `=` or numpad `+` / `-`: the selected order's count ±1, or the quantity in "Add order". Shift changes ten: main-row `+` is Shift+`=` and `_` is Shift+`-`. With no order selected these are speed keys.
- `r`: repeat the selected order, or the last finished one.
- `x`: remove the selected order (confirm).
- `Shift+↑` / `Shift+↓`: move the selected order in its queue.
- In "Add order": letters and `Backspace` edit the recipe filter, `0`–`9` type the quantity, `Tab` / `Shift+Tab` move between the fields and `←` `→` change the focused one.

The building panel's own keys (`ui-screens/panels.md` § Building), which are the panel's and not rows of the rebindable keymap table. The panel opens with a left click on a building, or `Enter` in Look on its tile:

- `↑` `↓`, `Enter`: move over the lines that act and activate one (a mode, a trigger, a linked target, an owner).
- `i`: link a lever or a plate; the target is then picked with a left click on the map, or `↑` `↓` `Enter` in the list. `r`: unlink the target under the cursor. `y`: pull the lever.
- `←` `→`: a pressure plate's smallest creature size or fluid depth.
- `r`: release a caged creature (confirm). `g`: tame it.
- `w`: the owner of a bed's bedroom, or whom a coffin is kept for.
- `1`–`9`: a planned building's build priority. `x`: cancel the plan, or take a built building apart (confirm).

In Designate, `Shift+P` gives the tool's priority to the last batch of designations.

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

### Labor manager

Opened with `Enter` in the labors panel, or from the units panel with dwarves marked.

| Key | Action |
|---|---|
| arrows | move the labor cursor (Shift+↑↓: mark the rows passed) |
| `Space` | mark the dwarf |
| `*` | mark all / none |
| `Enter` | toggle the labor (for every marked dwarf when the row is marked) |
| `a` | whole row on / off |
| `c` | whole column on / off (the marked dwarves, or everyone) |
| `+` `-` | labor priority up / down |
| `1` `9` | set the labor priority |
| `t` | profession templates |
| letters | jump to the next labor starting with that letter (`Shift` and the letter for `a`, `c`, `t`) |
| `Esc` | close |

### Units panel

A panel's own keys may not use a panel hotkey, so these are on `Shift` (shown `[S-t]`). An action applies to every marked dwarf when the cursor's row is marked, otherwise to the cursor's dwarf. `Shift+L` opens the labor manager on the marked dwarves when any are marked; the bare labors key always opens the labors panel, with its cursor on the dwarf under the units cursor.

| Key | Action |
|---|---|
| `Space` | mark the row (does not pause while the list is open) |
| `*` | mark all / none |
| `i` | show only idle dwarves / all |
| `Shift+W` | wounded dwarves first / list order |
| `Shift+T` | give or take away a title |
| `Shift+N` | rename the dwarf |
| `Shift+M` | add the marked dwarves to a squad |
| `[` `]` | sleep an hour earlier / later |

### Military panel

| Key | Action |
|---|---|
| `Space` | mark the row (does not pause while the list is open) |
| `*` | mark all / none |
| `Enter` | add or remove every marked dwarf |
| `Shift+L` | choose the squad leader |
| `Shift+B` | assign a barracks zone |
| `Shift+N` | rename the squad |
| `w` | choose the squad weapon class |
| `g` | choose the squad armor |

## Zones inspector keys

These are the Zones panel's own accelerators and widget keys. Letters that open panels require Shift; the labels follow the current panel bindings. Every action has the mouse path listed here and a Help row.

| Key | Action | Mouse |
|---|---|---|
| `Enter` with no tool or selection | select the zone at the map cursor or centre | click a zoned map tile |
| `y` | return from an inspector to zone types | zone types button |
| `Shift+P` | open the stockpile preset dropdown | preset header |
| `↑↓`, `Enter`, accelerator letters | highlight/apply a preset; jump by its first letter, Shift for a panel letter | preset option |
| `g` | focus the category tree | tree button or category name |
| `↑↓`, `→`, `←`, `Space` in the tree | select, expand, collapse/parent, toggle subtree | category name or checkbox |
| `q` | focus numeric settings | settings button or numeric label |
| `Tab`, `Shift+Tab`, `↑↓` in numeric settings | choose barrels, bags, bins, priority, min quality or max quality | numeric label |
| `←→`, `+`, `-` in numeric settings | adjust the focused value | minus or plus button |
| `v` | open allowed material classes | materials button |
| `↑↓`, `Space` or `Enter` in material classes | select/toggle; Any switches all/none | checklist row |
| `Shift+O` in a bedroom | open the shared owner picker | owner button |
| `↑↓`, `Enter` in owner picker | select Nobody or a dwarf and assign | owner row |
| `Esc` in a chooser | cancel/back; applied settings remain applied | choose another zone or panel |

Container counts are non-negative integers, priorities are 1–9 and quality bounds are 0–5 with minimum no greater than maximum. A refused adjustment reports its reason. In the selected stockpile editor, Space toggles a checkbox, +/- adjusts a numeric field and Tab chooses fields before their global pause, speed or sidebar actions. Bare panel letters always retain their panel action in every editor state. Zone removal continues to use the existing default-No confirmations in § Confirmations.

## Mouse

| Gesture | With no tool | With a tool |
|---|---|---|
| Left click | inspect the tile (look panel); on a building, open its panel | apply to one tile / place building |
| Left drag | select a rectangle (then `Delete`, `[S-f]` forbid, `[S-d]` dump, `[S-t]` move to depot) | designate / draw zone rectangle |
| Right click | inspect with the entity list | cancel the tool |
| Wheel | z-level on the map; over the sidebar, scrolls the list under the pointer three rows a notch and never changes the level | same |
| `Ctrl` + wheel | zoom | zoom |
| `Shift` + wheel | pan vertically | pan vertically |
| Middle drag | pan | pan |
| Hover | tile summary in the status bar | ghost footprint / rectangle size |
| Click on a panel row | select | select |
| Double-click a unit or job row | center the map on it | same |

Each entry of the hotkey strip on status row 2 and each field of status row 1 is a button (fortress-screen wireframe, Status rows), `[x]` on a panel's title row closes the panel, and a click on a list's scrollbar track jumps the list there.

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

## Announcements

`MiasmaSpread` uses alert severity and the line "Miasma spreads."

### Announcement strings

| Key | Text |
|---|---|
| `announce.caravan_arrived` | "A caravan has arrived from {civ}." |
| `announce.caravan_departed` | "The {civ} caravan has departed." |
| `announce.caravan_lost` | "The {civ} caravan has been lost." |
| `announce.caravan_waiting` | "The {civ} caravan waits at the edge for a trade depot." |
| `announce.trade_completed` | "A trade with {civ} is complete." |
| `announce.immigrants_arrived` | "{count} dwarves have come to join the hall, {children} of them children." |
| `announce.immigration_skipped` | "No immigrants this season: {reason}." |
| `announce.dangerous_arrived` | "A {species} has come to the valley." |
| `announce.dangerous_arrived_many` | "{count} {species} have come to the valley." |
| `announce.reputation_changed` | "Our standing with {civ} has fallen: {reason}." |
| `announce.workshop_missing_input` | "{workshop} is idle: no {input}." |
| `announce.plot_needs_seeds` | "{plot} has no {species} seeds." |


## Hints

Shown once, as notes prefixed with `☼`, when the trigger holds (checked hourly, except the hauling shortage on DayPassed). Ids and triggers:

| id | Trigger | Text |
|---|---|---|
| `hint_dig` | tick 1 | "Designate a place to dig with [d]. Dwarves dig into rock faces from the side." |
| `hint_still` | no still exists and drink < 40 units | "Dwarves need drink. Build a still [b > Workshops] and brew from plants." |
| `hint_stockpile` | no stockpile exists and items on the ground > 20 | "Set up a stockpile [z] so hauled goods have somewhere to go." |
| `hint_winter` | day 20 of spring, year 1 | "Winter comes in 60 days. Farms need soil or mud; cave crops grow in the dark all year." |
| `hint_hearth` | no hearth and at least one dining hall or 5 bedrooms | "A hearth makes a hall a home. Build one [b > Special] in your main hall." |
| `hint_containers` | a drink or seed stockpile exists without barrels or bags | "Stockpiles need barrels for drink and bags for seeds. The carpenter makes barrels; the clothier makes bags." |
| `hint_barrel` | a workshop is blocked because no barrel is empty | "A brew needs an empty barrel, and a barrel that holds food or seed is not empty. Order a barrel at the carpenter's workshop." |
| `hint_fuel` | a smelter or forge is blocked for fuel | "Smelters and forges need fuel. A wood furnace makes charcoal from logs; coal seams burn too." |
| `hint_hunter` | hunting labor enabled and no crossbow or bow exists | "Hunters need a crossbow and bolts, or a bow and arrows." |
| `hint_farm` | a farm plot placement is refused | "Farms need soil, mud left by water, or cave loam." |
| `hint_seeds` | first harvest | "Harvest returns one seed. Brewing and cooking do not." |
| `hint_room` | a bedroom zone with tier bare exists for 3 days | "A room needs walls or doors around it, a bed, and smooth stone to be worth sleeping in." |
| `hint_alert` | first `ThreatWarning`, or the first fortress dwarf wounded by an animal | "Click a door and choose Lock on alert. Then [m] and [3] raise the Hearth alert: civilians go to the hearth and those doors lock, but a dwarf in dire need still goes out to eat, drink or sleep, and the medics still tend the wounded." |
| `hint_depot` | day 14 of summer, year 1, no depot | "Build a trade depot [b > Special] before the caravan arrives." |
| `hint_hospital` | first serious wound to a dwarf of the fortress with no hospital | "A hospital zone needs a bed, a chest, cloth and thread. Brightleaf treats infection." |
| `hint_immigration` | first `ImmigrationSkipped` | "Immigrants come at the turn of the season when hall spirit is Content. Good rooms, meals and drink raise it." |
| `hint_gate` | first raid ended | "A drawbridge over a channel is the surest gate. Build a lever inside [b], click it, press [i] and click the bridge; [y] pulls it." |
| `hint_cage` | first cage trap built | "Cage traps catch anything smaller than a wyrm. Caged beasts can be tamed at a kennel or sold." |
| `hint_troll` | first `DoorBroken` | "Trollkin break doors. Walls and raised bridges hold." |
| `hint_deep` | first `VeinFound` deepsilver | "Deepsilver lies beside the Sea of Fire. Taking it wakes the Hollow. The threats panel shows the Deep gauge." |
| `hint_magma` | first cavern 2 breach | "A forge over channeled magma needs no fuel. Build it of magma-safe stone." |
| `hint_haulers` | DayPassed: more than IDLE_HAULER_WARNING items want hauling and fewer than HAULER_WARNING_MIN_WORKERS dwarves have hauling enabled | "Items are waiting to be hauled. Enable hauling for more dwarves in the labors panel." |
| `hint_no_miners` | a dig designation exists and no living dwarf has mining enabled; hourly | "No one has mining enabled. Turn it on in Labors [l]." |
| `hint_shelter` | from day 3 of the first spring, no squad exists | "Wild beasts will come. Dig a hall into rock, put a door on it, click the door and choose Lock on alert. Make a squad in [m] and arm it with iron spears: clubs lose to boars. Order a kill when a beast comes." |
| `hint_predator` | first `AnimalSpawned` of a dangerous species | "A beast that hunts dwarves is near. [m] then [3] raises the Hearth alert: civilians go to the hearth and doors set to Lock on alert shut. [n] then [2] shows where it is." |
| `hint_food` | edible items in stock fall below `HINT_FOOD_DAYS` days for the population, hourly | "Food is running low. Check the farm plots' crops [z], order meals at a kitchen, and gather plants [d]." |
| `hint_no_path` | a job remains blocked unreachable for a whole day from first hourly observation | "Jobs are blocked: no path. Check for doors, water and undug rock." |

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
| `c_embark_no_axe` | "Embark without an axe?" | No |
| `c_embark_no_food_drink` | "Embark without food or drink?" | No |
| `c_melt_items` | "Mark {what} for melting? Melted items are gone; the smelter gives back part of their metal as bars." | No |
| `c_dump_items` | "Mark {what} for dumping? Dwarves will carry every one of them to a dump zone." | No |
| `c_dump_selection` | "Dump everything on these {n} tiles? Dwarves will carry it to a dump zone." | No |
| `c_slaughter_animal` | "Slaughter {animal}? It will be butchered for meat, hide and bone." | No |
| `c_suspend_workshop` | "Suspend {workshop}? Its current job stops and its orders wait until you resume it." | No |
| `c_deconstruct_building` | "Take apart {building}? Its materials are left where it stood." | No |
| `c_remove_zone` | "Remove {zone}? Its settings are lost." | No |
| `c_remove_order` | "Remove the order for {recipe}? Work in progress on it stops." | No |
| `c_release_cage` | "Release {creature} from {cage}? It is set down beside the cage, as wild or hostile as it was." | No |

## Settings

| Setting | Values | Default |
|---|---|---|
| Auto-pause on danger | on / off | on |
| Auto-pause on alert | on / off | off |
| Hints | on / off | on |
| Colorblind palette | on / off | off |
| Zoom | Auto / 0.75 / 1 / 1.5 / 2 | Auto |
| Edge scrolling | on / off | off |
| Autosave each season | on / off | on |
| Snapshots kept | 2 / 4 / 8 | 4 |
| Combat log verbosity | all / hits only / off | hits only |
| Keybindings | table | defaults above |

## Strings

Settings rebinding failures use the UI defaults `ui.settings.binding_modifiers` ("Use a key with optional Ctrl or Shift.") and `ui.settings.binding_conflict` ("Conflicts with {context}: {action}"). Context and action use the same headings and wording as Help.

A refused fixed-footprint placement names the building and explains that width and height cannot be changed; its named message and generic rejection text are string-registry defaults.

Pasture rejection defaults include `reject.not_tame` ("that animal is not tame") and `reject.not_grazer` ("that animal does not graze").

Player-facing text uses string keys. The UI reads `strings.json` together with the `UI_STRINGS` defaults in `ui/strings.ts`; a content row wins over a default of the same key. Screen wireframes list the keys per screen; announcement, thought, hint, milestone and confirmation texts above are their canonical values. Count placeholders in strings support plural forms `{count|singular|plural}` (such as `{n|table|tables}`), evaluating to `{count} singular` when `count` is 1 and `{count} plural` otherwise; prefixing the singular form with `!` (`{count|!singular|!plural}`) outputs only the chosen noun without the count number. The strings check audits both tables, used keys, and the bidirectional text mirrors for confirmations, hints, milestones and thoughts.
