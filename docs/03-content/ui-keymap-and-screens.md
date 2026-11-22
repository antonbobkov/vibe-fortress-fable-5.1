# UI: Keymap, Screens, Panels, Hints

**Owner:** content (`keymap`, `hints`, `tutorial`, `milestones`, `strings` index) · **Depends on:** [`../02-systems/24-ui-and-input.md`](../02-systems/24-ui-and-input.md), [`../02-systems/23-rendering.md`](../02-systems/23-rendering.md)

## Screens

| id | Purpose | Enter from | Leave to |
|---|---|---|---|
| `intro` | The animated intro, in the style the Intro style setting names ([deep-intro.md](deep-intro.md), [intro.md](intro.md)) | start (Intro at launch), main_menu › Intro | main_menu |
| `main_menu` | New world, Tutorial, Continue, Load, Legends, Settings, About, Intro | start, intro, fortress menu | any |
| `world_gen` | Seed, size, generate, preview | main_menu › New world | world_map |
| `world_map` | Choose a region | world_gen | embark, main_menu |
| `embark` | Party, supplies, animals, name | world_map › Embark | fortress |
| `fortress` | The game | embark, load | legend, main_menu |
| `trade_session` | Modal exchange | fortress (depot panel › Trade) | fortress |
| `labor_manager` | Every dwarf's labors, the labor priorities, profession templates | fortress (labors panel › `Enter`; units panel with marked dwarves) | fortress |
| `legend` | A finished fortress's record | fortress end, main_menu › Legends | main_menu |
| `settings` | Keys, palette, auto-pause, hints, autosave, music | main_menu, fortress menu | back |
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
| `e` | Mood | 15 | the thoughts held by most dwarves, then every dwarf's tier and top thoughts |
| `a` | Log | 24 | announcements with filters; combat tab |
| `k` | Look | 24 | the tile list of the tile under the cursor |
| `f` | Overlays | 23 | overlay toggles |
| `y` | Calendar | 06 | the date, the season and the weather |
| `?` | Help | 24 | keymap, legend of glyphs |
| `F12` | Debug | 24 | timings and counters |

Jobs: `Tab` moves the cursor between the job list and the "Orders waiting" rows (`↑↓` move over them, `Enter` opens Orders on one); `[/]` or a click focuses target-name/worker text; Enter or Esc finishes typing. `[l]` or a click cycles labors with jobs, `[s]` or a click cycles all/open/claimed/blocked. Stocks: `[/]` or a click focuses category/item/material text; Enter or Esc finishes typing. These controls also appear in Help.

Stockpile inspector: `[i] link` or its button starts choosing a source stockpile on the map; click it or Enter at the cursor, Esc or right click cancels. `[x] unlink` or its button opens named linked sources; arrows or click select and centre, Enter or the unlink button removes just that link, Esc or Cancel returns. Delete or `[Del] remove zone` removes the stockpile zone with its existing confirmation. Other zone inspectors retain `[x] remove zone`. Panel letters still switch panels inside both link modes; Help lists these actions.

Animals, Tame tab: `[c] cap` or click cap opens its inline number field: digits type, `+`/`-` step by one (Shift by ten), Enter or Set submits, Esc or Cancel discards; 0–100, no wrapping. Panel letters remain available.

Animals, Tame tab: `[t] train` or its button opens War/Hunting; arrows and Enter, or click a choice; Esc cancels. Panel letters still switch panels inside the choice. Help lists this action and `Esc` then `[n] Rename fortress` from the game menu, also available by clicking its row and entering a name in the text input.

## Keymap (defaults)

Every row of the tables below is a binding that Settings › Keybindings can change; the keys of § Fixed keys are the only keys the game reacts to that are not here. Each table is one context: the screen, panel or panel state in which its keys act, named by its heading in the editor and in Help.

Key notation: `Ctrl+S` and `Shift+Tab` are a key with modifiers; `arrows` are the four arrow keys; `1`–`9` binds every digit between its two ends; `[w]` is an accelerator letter of a panel, bound to the letter, which also takes it with `Shift`; `[d]` is an accelerator kept on `Shift`+letter, which the bare letter does not reach (§ Panels). A key written without `Shift` also takes a shifted press (arrows with `Shift` move ten, `+` with `Shift` changes ten), unless the context binds the shifted key itself (`Shift+Tab`).

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
| `Ctrl+M` | music on / off |
| `F1` | skip the tutorial step |
| `Shift+F1` | end the tutorial |

The music key acts on every screen, not only the fortress: a screen that does not use the key passes it on, and a text field that is typing in or a key being captured in Settings › Keybindings keeps it.

### Map

| Key | Action |
|---|---|
| `←` `→` `↑` `↓` | pan or move the map cursor (`Shift`: 10) |
| `<` `,` | z-level down |
| `>` `.` | z-level up |
| `Home` | center on the hearth (or wagon) |
| `Ctrl+↑` / `Ctrl+↓` | zoom in / out |
| `k` | look at the mouse (or map center) |
| `Enter` | act at the map cursor |
| `1`–`9` | with a designation or zone tool: set priority |
| `r` | with a building tool: rotate |
| `x` | with a building tool: cycle material |
| `Delete` | with a selection: cancel designations / remove zone / cancel building |

With the map cursor shown (a tool armed, or a panel asking for a tile or a creature), the arrows move the cursor instead of panning, and `Enter` acts at it; with a building tool that places many, `Enter` with `Shift` sets a corner. In the Build list `Enter` picks the highlighted building and, with a building armed, `Backspace` returns to the list. See `02-systems/24-ui-and-input.md` § Rules (input model).

### Panels

The keys every list, menu and chooser shares: the fortress panels and their choosers, the labor manager, the trade session, the game menu, the legend screen and the menus outside the fortress.

| Key | Action |
|---|---|
| `↑` `↓` | move selection |
| `PageUp` `PageDown` | scroll |
| `Enter` | activate |
| `Tab` / `Shift+Tab` | next / previous field |
| `[letter]` | accelerator shown in brackets |
| `/` | focus the filter field |
| `Backspace` | back within nested menus |
| `←` `→` | move across, or change the focused value |

The open panel's own letters come first (D-253, which replaces D-U2's "panel hotkeys always win"). While a panel is open, a letter that the panel binds (in its current state: the zone inspector before the zone types, a map selection's keys) does the panel's action, even when the action does nothing at that moment; any other letter of § Fortress panels opens its panel, and the open panel's own letter closes it unless the panel binds that letter (Designate binds `d`: `d d` chooses Dig). `Esc` backs out one step, so `Esc` and then a letter reaches any panel; the sidebar's panel strip and the mouse always do. No panel binds bare `k`, so Look is one key from anywhere. When a panel closes while one of its tools was armed, the status row shows a notice ("Designate closed · [d] opens it again", naming the panel and its key; also for Build and Zones). `Shift` is kept for the actions that destroy or are hard to undo (set a fire, dump, melt, slaughter, suspend, kill), for the compost heap (so that `k` stays Look), and for a key's second variant (`Shift+Tab`, `Shift+↑` `Shift+↓` in Orders, `Shift+F1`, `Shift` held for ten); every other panel key is a bare letter, and a bare letter also takes its press with `Shift`. A letter with `Shift` never opens a panel. The first time a panel's letter acts where it is also a panel letter, the hint `hint_panel_letters` says so. Only a focused text field (a filter, a name, the order picker's `Find`) takes letters as text.

A caption that names a key (`[t] train`, `[x] cancel`, a hint's `[d]`) shows the key its binding has now.

Every destructive single-key action asks through the confirmation dialog first, default **No** (§ Confirmations): melt, dump, slaughter, suspend, take apart, disband, remove (a zone, a work order), release (a caged creature). Undoing a mark (resume, unmark) does not ask.

### Map selection

The keys of a rectangle dragged with no tool (§ Mouse); `Delete` is the Map context's.

| Key | Action |
|---|---|
| `[f]` | forbid everything on the selected tiles |
| `[S-d]` | dump everything on the selected tiles (confirm) |
| `[t]` | move the goods on the selected tiles to the depot |

### Designate panel

| Key | Action |
|---|---|
| `[d]` | dig |
| `[c]` | channel |
| `[w]` | stairs (the kind chosen per tile) |
| `[r]` | ramp |
| `[s]` | smooth |
| `[e]` | engrave |
| `[x]` | remove a construction |
| `[t]` | chop trees |
| `[g]` | gather plants |
| `[h]` | harvest |
| `[q]` | harvest ice |
| `[S-b]` | ignite (set a fire) |
| `[f]` | traffic (again: the next traffic mode) |
| `[p]` | give the tool's priority to the last batch |

### Build panel

`↑` `↓` and `Enter` choose in a category's list; `Backspace` returns from an armed building to the list.

| Key | Action |
|---|---|
| `[c]` | constructions |
| `[f]` | furniture |
| `[w]` | workshops |
| `[m]` | mechanisms |
| `[t]` | traps |
| `[s]` | special |

### Zones panel

The zone types; `Enter` with no tool selects the zone at the map cursor or centre.

| Key | Action |
|---|---|
| `[s]` | stockpile |
| `[f]` | farm plot |
| `[p]` | pasture |
| `[b]` | bedroom |
| `[d]` | dining hall |
| `[h]` | hearth hall |
| `[o]` | hospital |
| `[r]` | barracks |
| `[a]` | archery range |
| `[m]` | meeting area |
| `[t]` | tomb |
| `[u]` | dump |
| `[i]` | fishing zone |
| `[g]` | gather zone |
| `[c]` | sanctum |
| `[S-k]` | compost heap |

### Zone inspector

The keys of a selected zone, before the zone types and before the panel letters (§ Panels). Every action has the mouse path listed here and a Help row.

| Key | Action | Mouse |
|---|---|---|
| `[y]` | back to the zone types | zone types button |
| `[x]` | unlink a source of a stockpile, or remove the zone (confirm) | the `[x]` caption |
| `Delete` | remove the stockpile zone (confirm) | `[Del] remove zone` |
| `[e]` | resize the zone | the `[e] resize` caption |
| `[i]` | link a source stockpile | `[i] link` |
| `[p]` | open the stockpile preset dropdown | preset header |
| `[g]` | focus the category tree | tree button or category name |
| `[q]` | focus numeric settings | settings button or numeric label |
| `[v]` | open allowed material classes | materials button |
| `[o]` | open the bedroom's owner picker, or the sanctum's apprentice picker | owner or apprentices button |
| `[c]` | a stockpile: turn the cellar setting on or off | the `[c] cellar` caption |
| `[a]` | a farm plot: the highlighted row's crop for every season in which that crop can grow | the `[a] all seasons` caption |
| `[w]` | a farm plot: turn fertilize on or off | the `[w] fertilize` caption |
| `Space` | toggle the checkbox (category tree, material classes) | the checkbox |
| `+` `=` `-` | adjust the focused value | minus or plus button |

The list keys of § Panels work in the inspector: with a farm plot, `↑` `↓` highlight a season row (starting on the current season) and `Enter` opens its crop list (`↑` `↓` and `Enter` choose); in the preset dropdown `↑` `↓` and `Enter` highlight and apply a preset and a letter jumps to the next preset starting with it (`Shift` for a panel letter the inspector does not bind); in the tree `↑` `↓` select, `→` expands, `←` collapses or goes to the parent; in numeric settings `Tab`, `Shift+Tab` and `↑` `↓` choose barrels, bags, bins, priority, min quality or max quality and `←` `→` adjust; in material classes `↑` `↓` select and `Enter` toggles, Any switching all or none; in the owner picker `↑` `↓` and `Enter` choose Nobody or a dwarf; in the apprentice picker `↑` `↓` and `Enter` add or remove an adult dwarf, and the picker stays open. `Esc` in a chooser goes back, and applied settings remain applied; by mouse, choose another zone or panel.

Container counts are non-negative integers, priorities are 1–9 and quality bounds are 0–5 with minimum no greater than maximum. A refused adjustment reports its reason. In the selected stockpile editor, Space toggles a checkbox, +/- adjusts a numeric field and Tab chooses fields before their global pause, speed or sidebar actions. A panel letter the inspector does not bind keeps its panel action in every editor state. Zone removal continues to use the existing default-No confirmations in § Confirmations.

### Units panel

An action applies to every marked dwarf when the cursor's row is marked, otherwise to the cursor's dwarf. `[l]` opens the labor manager on the marked dwarves, or on the cursor's dwarf when none is marked; `Esc` then the labors key opens the labors panel. `Enter` inspects the cursor's dwarf: Look opens its view (24 § Inspection).

| Key | Action |
|---|---|
| `Space` | mark the row (does not pause while the list is open) |
| `*` | mark all / none |
| `[i]` | show only idle dwarves / all |
| `[w]` | wounded dwarves first / list order |
| `[t]` | give or take away a title |
| `[n]` | rename the dwarf |
| `[m]` | add the marked dwarves to a squad |
| `[` `]` | sleep an hour earlier / later |
| `[l]` | the labor manager on the marked dwarves |
| `[c]` | center the map on the dwarf |

### Labors panel

`↑` `↓` choose the dwarf, `←` `→` move across the labor columns, and `Enter` opens the labor manager with its cursor on that dwarf.

| Key | Action |
|---|---|
| `[a]` | whole row on / off |

### Jobs panel

`↑` `↓` move over the jobs (or the waiting orders), `Enter` centres the map on the job or opens Orders on the waiting order, and `/` focuses the filter.

| Key | Action |
|---|---|
| `Tab` | move between the jobs and the "Orders waiting" rows |
| `[l]` | cycle the labors that have jobs |
| `[s]` | cycle all / open / claimed / blocked |
| `[p]` | raise the job's priority (1–9, wrapping) |
| `[x]` | cancel the job |

### Orders panel

The Orders panel's keys, beside the accelerators it shows (`ui-screens/panels.md` § Orders). `↑` `↓` move over the orders.

| Key | Action |
|---|---|
| `[n]` | new order (opens "Add order") |
| `+` `=` | the selected order's count +1 (`Shift`: +10) |
| `-` `_` | the selected order's count −1 (`Shift`: −10) |
| `[r]` | repeat the selected order, or the last finished one |
| `[x]` `Delete` | remove the selected order (confirm) |
| `[m]` | the order's mode |
| `[p]` | the order's priority |
| `[f]` | the order's material |
| `Shift+↑` `Shift+↓` | move the order in its queue |

The count keys take precedence over the speed keys only while an order is selected; with no order selected the order keys say "No order is selected: [n] adds one." and the count keys are the speed keys. In "Add order", a text field, letters and `Backspace` edit the recipe filter, `0`–`9` type the quantity, `+` `=` `-` change it, `Tab` / `Shift+Tab` move between the fields, `←` `→` change the focused one, `Enter` adds the order and `Esc` closes it. The material list uses the list keys of § Panels.

### Workshop panel

A click on a workshop opens it; `↑` `↓` choose a recipe and `Enter` adds an order for it.

| Key | Action |
|---|---|
| `[n]` | new order at this workshop |
| `[o]` | this workshop's orders |
| `[f]` | the material of the orders here |
| `[w]` | the next worker |
| `[S-s]` | suspend (confirm) or resume |
| `[x]` | take the workshop apart (confirm) |

### Building panel

The building panel's keys (`ui-screens/panels.md` § Building). The panel opens with a left click on a building (where no creature or loose item stands), or from its row in Look's tile list. `↑` `↓` and `Enter` move over the lines that act and activate one (a mode, a trigger, a linked target, an owner); `←` `→` change a pressure plate's smallest creature size or fluid depth. A link target is picked with a left click on the map, or `↑` `↓` `Enter` in the list.

| Key | Action |
|---|---|
| `1`–`9` | a planned building's build priority |
| `[i]` | link a lever or a plate |
| `[r]` | unlink the target under the cursor, or release a caged creature (confirm) |
| `[y]` | pull the lever |
| `[g]` | tame the caged creature |
| `[w]` | the owner of a bed's bedroom, or whom a coffin is kept for |
| `[h]` | take out what the building holds (its bedding and pillow): they drop on its tile |
| `[v]` | a `container` building (the wagon, a chest): Look's tile list where its goods lie |
| `[x]` | cancel the plan, or take the building apart (confirm) |

### Stocks panel

`↑` `↓` move over the categories, `Enter` expands one, and `/` focuses the filter. In the depot list (`[t]`), `↑` `↓` move, `Enter` or `Space` marks goods, `[t]` sends them and `Esc` returns to the depot panel.

| Key | Action |
|---|---|
| `[f]` | forbid the selected items |
| `[S-d]` | dump the selected items (confirm) |
| `[S-m]` | melt the selected items (confirm) |
| `[t]` | move goods to the depot |
| `Space` | in the depot list: mark the goods |

### Depot panel

| Key | Action |
|---|---|
| `[m]` | move goods to the depot |
| `[r]` | return the selected goods to stock |
| `[t]` | open the trade session |

### Military panel

| Key | Action |
|---|---|
| `Space` | mark the row (does not pause while the list is open) |
| `*` | mark all / none |
| `Enter` | add or remove every marked dwarf |
| `[l]` | choose the squad leader |
| `[b]` | assign a barracks zone |
| `[n]` | rename the squad |
| `[w]` | choose the squad weapon class |
| `[g]` | choose the squad armor |
| `1` | alert: calm |
| `2` | alert: watchful |
| `3` `[h]` | alert: hearth |
| `+` | new squad |
| `[x]` | disband the squad (confirm) |
| `[s]` | set the squad's station |
| `[c]` | clear the squad's station |
| `[p]` | add patrol points |
| `[y]` | clear the patrol |
| `[S-k]` | order a kill |
| `[f]` | order to follow a dwarf |
| `[q]` | cancel the squad's orders |
| `[m]` | the next squad mode |
| `[o]` | squad mode: off |
| `[t]` | squad mode: train |
| `[v]` | squad mode: active |
| `[a]` | add members |
| `[r]` | remove members |
| `[j]` | ranged or melee |

### Animals panel

| Key | Action |
|---|---|
| `1` `2` | tame / wild tab |
| `[p]` | pasture the animal |
| `[S-s]` | mark for slaughter (confirm) |
| `[c]` | edit the breeding cap |
| `[a]` | assign the animal |
| `[n]` | name the animal |
| `[t]` | train the animal |
| `[h]` | wild tab: hunt toggle |

### Civilizations panel

`↑` `↓` choose the civilization and `←` `→` its request. While a request is being added, the selected civilization's own goods come first; `/` focuses the editor's filter (letters are text, `Enter` or `Esc` finishes typing, as in Jobs and Stocks), `↑` `↓` choose the item, `←` `→` its material, `Enter` adds it and `Esc` cancels.

| Key | Action |
|---|---|
| `[d]` | depot panel |
| `[t]` | open the trade session |
| `+` `[a]` | add a request |
| `[x]` | remove the request |
| `[p]` | the request's priority |

### Population panel

| Key | Action |
|---|---|
| `+` `-` | raise / lower the population cap |

### Mood panel

`↑` `↓` move over the summary's thoughts and then the dwarves; `Enter` on a thought lists the dwarves who hold it, and on a dwarf inspects it, as Units does; `Backspace` or `Esc` lists every dwarf again (`ui-screens/panels.md` § Mood).

| Key | Action |
|---|---|
| `[s]` | sort by tier |

### Log panel

`↑` `↓` select an entry and `PageUp` `PageDown` move a page of entries, however many rows each entry wraps over; `Enter` centres the map on the selected entry, and `/` focuses the filter.

| Key | Action |
|---|---|
| `1` `2` `3` | log filter tabs |

A click on a line centres the map on its focus; a click on a creature's name in it inspects that creature (24 § Inspection).

### Look panel

Look shows a tile list, one creature or one item (24 § Inspection). `PageUp` `PageDown` scroll any view a page and the wheel three rows a notch. In the tile list the arrows move the map cursor and the list follows it; in a creature's or an item's view they pan the map. A building's panel, with its take apart key, opens from its row. In a creature's or an item's view the names are links: a click opens one, § Panels' `Tab` and `Shift+Tab` (next and previous field) move the focus through those in view, and `Enter` (activate) opens the focused one.

| Key | Action |
|---|---|
| `1`–`9` | tile list: open that row |
| `Enter` | tile list: open the first row |
| `[h]` | creature or item view: the tile list where it is |
| `Backspace` | back to the view before |

The bare `c` and `f` of the creature and item views are kept for centre and follow (T-671), on bare letters like every other panel key (§ Panels); `k` or `Esc` closes Look.

### Help panel

`↑` `↓` and `PageUp` `PageDown` scroll.

| Key | Action |
|---|---|
| `1` `2` `3` | Keys / Legend / Start tabs |

### Debug panel

| Key | Action |
|---|---|
| `[d]` | dump save |
| `[r]` | replay season log |
| `[h]` | hash world |

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
| `Home` | first dwarf |
| `End` | last dwarf |
| `=` | labor priority up / down |

### Profession templates

The labor manager's template menu: `↑` `↓` and `Enter` choose too.

| Key | Action |
|---|---|
| `1`–`9` | choose that template |

### Trade session

| Key | Action |
|---|---|
| `Tab` | switch column |
| `+` `-` | quantity |
| `Enter` | offer |
| `g` | gift (offer with nothing taken) |
| `Esc` | close |
| `Home` | none of the selected goods |
| `End` | all of the selected goods |
| `=` | quantity |

### Game menu

| Key | Action |
|---|---|
| `r` | Resume |
| `s` | Save |
| `l` | Load |
| `o` | Settings |
| `n` | Rename fortress |
| `x` | Retire fortress (confirm) |
| `m` | Main menu |

### Confirmation

The `confirm` dialog, and the embark screen's "Replace your changes" line.

| Key | Action |
|---|---|
| `y` | Yes |
| `n` | No |
| `Enter` | the default answer |

### Main menu

| Key | Action |
|---|---|
| `n` | New world |
| `t` | Tutorial |
| `c` | Continue |
| `l` | Load |
| `g` | Legends |
| `o` | Settings |
| `a` | About |
| `i` | Intro |

### World generation

| Key | Action |
|---|---|
| `g` | Generate |
| `r` | random seed |

### World map

| Key | Action |
|---|---|
| arrows | move the cursor (`Shift`: 8) |
| `f` | filter panel |
| `Enter` | embark on the region |
| `?` | biome legend |
| `+` `=` `-` | adjust the selected filter |

### Embark

| Key | Action |
|---|---|
| `1` `2` `3` | Dwarves / Supplies / Animals tabs |
| `+` `-` | adjust the selected skill or quantity |
| `r` | reroll the selected dwarf |
| `n` | rename |
| `p` | presets menu |
| `l` | saved loadouts |
| `Enter` on the footer | Embark |
| `=` | adjust the selected skill or quantity |
| `0` | clear the selected skill or quantity |
| `t` | testing mode on or off |
| `4` | Items tab (testing mode) |
| `a` | add a dwarf or the item being made (testing mode) |
| `x` | remove the selected dwarf or item line (testing mode) |
| `*` | give every dwarf the selected skill's level (testing mode) |

### Load

| Key | Action |
|---|---|
| `x` | Delete (confirm) |
| `e` | Export |
| `i` | Import |

## Fixed keys

These keys act as described and cannot be rebound. The editor lists the `Esc` rows dimmed with "fixed" and refuses them.

| Key | Where | Why |
|---|---|---|
| `Esc` | everywhere: cancel, close, back, and the Global, Trade session and Labor manager rows | The one key that always leads back, out of every screen, dialog and chooser, to the game menu and to Settings; a rebound or lost back key could leave the player with no way to the editor. |
| Letters, digits, `Space`, `Backspace`, `Enter`, `Tab` and `Esc` in a focused text or number field | filters, names, the seed, the order picker, the breeding cap editor, the `text_input` dialog | Typing: every printable key is the character it shows, and the keys that edit or finish the text keep their meaning so that no rebinding can make a name impossible to type. |
| Every key in Settings › Keybindings | the editor itself | The editor must work whatever the bindings are: `↑` `↓` `PageUp` `PageDown` move, `Enter` or a click captures the next key, `Delete` or `Backspace` restores the row's default, `[d]` restores every default, `Esc` backs out. |
| `[letter]` and labor manager letters | panel accelerators, the labor manager's jump to a labor, a preset's first letter | They stand for every letter; each accelerator that a panel shows is its own row above. |
| Any key, or a click | the intro | Whoever did not ask to watch it must be able to leave at once with whatever key the hand finds; a skip that had to be learned or could be rebound away would hold the player in front of a film of most of a minute. A modifier pressed alone does not count. |
| Any key | a danger line pinned to the log strip | "Dismissed by any key", which then acts as it would have; `Space` and `Esc` (the pause and cancel keys, however bound) only dismiss, so reading the line does not unpause the game (`02-systems/24-ui-and-input.md` § Announcements and the log). |
| `Shift` held with a bound key | arrows, `+` `-`, `Shift+Enter` | A modifier of the key's own action (ten at a time, mark the rows passed, a corner), not a key of its own. |

The mouse is not rebindable; § Mouse lists its gestures.

## Mouse

| Gesture | With no tool | With a tool |
|---|---|---|
| Left click | open what the map shows there (24 § Inspection): a creature's view, else a loose item's view, else the tile list for a crowd, else a building's panel, else a zone's inspector, else the tile list; a second click on an open creature or item lists its tile; in a creature's or an item's view, a click on a name opens what it names | a designation tool: the first corner of its box, then the opposite corner, which designates (the box may span the levels between) / a zone: one tile / place building |
| Left drag | select a rectangle (then `Delete`, `[f]` forbid, `[d]` dump, `[t]` move to depot) | designate a box on one level / draw zone rectangle |
| Right click | the tile list: everything the map shows on the tile | cancel the tool |
| Wheel | z-level on the map; over the sidebar, scrolls the list under the pointer three rows a notch and never changes the level | same |
| `Ctrl` + wheel | zoom | zoom |
| `Shift` + wheel | pan vertically | pan vertically |
| Middle drag | pan | pan |
| Hover | tile summary on the hover line (the status bar's last row) | ghost footprint / rectangle size; the hover line still names the tile |
| Click on a panel row | select | select |
| Double-click a unit or job row | a unit: inspect it, as `Enter` does; a job: center the map on it | same |

Each entry of the hotkey strip on status row 2 and each field of status row 1 is a button (fortress-screen wireframe, Status rows), `[x]` on a panel's title row closes the panel, and a press on a list's scrollbar track or thumb jumps the list there: with the button held, the list follows the pointer's row (the scroll is proportional to the row within the track, and the selection stays inside the window), wherever the pointer goes, until the button is released. The map is not touched by the drag.

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
| light | off | 14 |
| connectivity (debug) | off | 22 |
| paths (debug) | off | 22 |
| chunks (debug) | off | core |

## Announcements

`MiasmaSpread` uses alert severity and the line "Miasma spreads.", which names what rots and where when rotting items lie on its tiles (`announce.miasma_from`); the first such line of a fortress adds `announce.miasma_advice`. A day's `Starving` lines are one (`announce.starving_many`), and the alert before food rots is `announce.rot_soon` (24 § Announcements and the log). A death's line is `announce.died.<cause>` where its cause has one (17 § Registrations), and the immigrants line names a small wave (`announce.immigrants_named`) and counts a larger one (`announce.immigrants_counted`) (21 § Registrations).

### Announcement strings

| Key | Text |
|---|---|
| `announce.caravan_arrived` | "A caravan has arrived from the {civ}." |
| `announce.caravan_departed` | "The {civ} caravan has departed." |
| `announce.caravan_lost` | "The {civ} caravan has been lost." |
| `announce.caravan_waiting` | "The {civ} caravan waits at the edge for a trade depot." |
| `announce.caravan_unreachable` | "The {civ} caravan cannot reach {depot} from the {edge} edge: its pack animals need a way on foot, with no deep water or drop. Bridge the gap, or build a depot on their side." |
| `announce.caravan_at_depot` | "The {civ} caravan is at {depot}: [c] or the depot to trade." |
| `announce.trade_completed` | "A trade with the {civ} is complete." |
| `announce.title_assigned` | "{dwarf} is now the {title}." |
| `announce.title_vacated` | "{dwarf} is no longer the {title}." |
| `announce.trade_missed` | "The {civ} caravan is leaving without trading. {why}" |
| `announce.immigrants_arrived` | "{count} dwarves have come to join the hall, {children\|of them a child\|of them children}." |
| `announce.immigration_skipped` | "No immigrants this season: {reason}." |
| `announce.dangerous_arrived` | "A {species} has come to the valley." |
| `announce.dangerous_arrived_many` | "{count} {species} have come to the valley." |
| `announce.reputation_changed` | "Our standing with the {civ} has fallen: {reason}." |
| `announce.workshop_missing_input` | "{workshop} is idle: no {input}." |
| `announce.order_skipped` | "{workshop} skips its {recipe} order: no {input} within reach." |
| `announce.plot_needs_seeds` | "{plot} has no {species} seeds." |
| `announce.crater_entered` | "{dwarf} stood where the star fell." |
| `announce.ribs_entered` | "{dwarf} stood inside the ribs of something enormous." |
| `announce.thane_whim` | "{dwarf}, Thane, wishes for {whim} by the end of the season: {progress}." |
| `announce.thane_whim_met` | "The Thane's wish was met: {whim}." |
| `announce.thane_whim_missed` | "The Thane wished for {whim}, and did not get it." |
| `announce.spat_on` | "The camel spat on {dwarf}." |
| `announce.ice_melted` | "The ice walls of {place} have melted." |
| `announce.roost_found` | "Bats. Hundreds of them. {dwarf} counted." |
| `announce.miasma_from` | "Miasma spreads from {what} in {place}." |
| `announce.miasma_rotten` | "{n} rotten {material}" |
| `announce.miasma_corpse` | "a rotting {species} corpse" |
| `announce.miasma_corpses` | "{n} rotting {species} corpses" |
| `announce.miasma_advice` | "A refuse stockpile outdoors, or a dump, takes rotten food away." |
| `announce.rot_soon` | "{n} food will rot within {days\|day\|days}; the largest stack is {stack} in {place}." |
| `announce.starving_many` | "{n} dwarves are starving: {names}." |
| `announce.died.bled_out` | "{name} has bled to death." |
| `announce.died.starvation` | "{name} has starved to death." |
| `announce.died.infection` | "{name} has died of an infection." |
| `announce.died.frozen` | "{name} has frozen to death in the ice." |
| `announce.died.bridge_crush` | "{name} has been crushed by a bridge." |
| `announce.died.killed_by` | "{name} has been killed by {killer}." |
| `announce.died.killed` | "{name} has died of wounds." |
| `announce.died.burnt` | "{name} has burned to death." |
| `announce.died.magma` | "{name} has died in magma." |
| `announce.died.drowned` | "{name} has drowned." |
| `announce.died.lightning` | "{name} has been struck dead by lightning." |
| `announce.died.fell` | "{name} has died in a fall." |
| `announce.died.slaughter` | "{name} has been slaughtered." |
| `announce.immigrant_named` | "{names} has come to join the hall." |
| `announce.immigrants_named` | "{names} have come to join the hall." |
| `announce.immigrant_skilled` | "{name} ({skill} {level})" |
| `announce.immigrant_child` | "{name} (a child)" |
| `announce.list_and` | "{list} and {last}" |
| `announce.immigrants_counted` | "{count} dwarves have come to join the hall. [u] lists them." |
| `announce.immigrants_counted_children` | "{count} dwarves have come to join the hall, {children\|of them a child\|of them children}. [u] lists them." |
| `ui.threats.cavern_breached_at` | "{n}: breached at ({x},{y},z{z})" |
| `ui.threats.cavern_monsters` | "monsters {n}" |
| `ui.rot.fresh` | "fresh" |
| `ui.rot.stale` | "stale" |
| `ui.rot.rotten` | "rotten" |
| `ui.rot.rots_in` | "{stage}, rots in {n\|day\|days}" |
| `ui.rot.gone_in` | "{stage}, gone in {n\|day\|days}" |
| `ui.rot.not_now` | "{stage}, not rotting here" |
| `ui.rot.keeps` | "keeps, never rots" |
| `ui.stocks.rot_soon` | "{n} rot within {days\|day\|days}" |
| `ui.place.open` | "the open" |
| `ui.place.halls` | "the halls" |


## Hints

Shown once, as notes prefixed with `☼`, when the trigger holds (checked hourly, except the hauling shortage on DayPassed). Ids and triggers:

| id | Trigger | Text |
|---|---|---|
| `hint_dig` | tick 1 | "Designate a place to dig with [d]. Dwarves dig into rock faces from the side." |
| `hint_still` | no still exists and drink < 40 units | "Dwarves need drink. Build a still [b > Workshops] and brew from plants." |
| `hint_stockpile` | no stockpile exists and items on the ground > 20 | "Set up a stockpile [z] so hauled goods have somewhere to go." |
| `hint_winter` | day 20 of spring, year 1 | "Winter comes in 60 days. Farms need soil or mud. Cave crops grow in the dark, but in a cold region a cave within two levels of the surface freezes in winter; three levels down stays warm." |
| `hint_hearth` | no hearth and at least one dining hall or 5 bedrooms | "A hearth makes a hall a home. Build one [b > Special] in your main hall." |
| `hint_containers` | a drink or seed stockpile exists without barrels or bags | "Stockpiles need barrels for drink and bags for seeds. The carpenter makes barrels; the clothier makes bags." |
| `hint_barrel` | a workshop is blocked because no barrel is empty | "A brew needs an empty barrel, and a barrel that holds food or seed is not empty. Order a barrel at the carpenter's workshop." |
| `hint_fuel` | a smelter or forge is blocked for fuel | "Smelters and forges need fuel. A wood furnace makes charcoal from logs; coal seams burn too." |
| `hint_hunter` | a living fortress dwarf has hunting enabled and no crossbow or bow exists | "Hunters need a crossbow and bolts, or a bow and arrows." |
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
| `hint_predator` | first `AnimalSpawned` of a dangerous species while the fortress has a shelter (a hearth hall, a built door or a bedroom zone) | "A beast that hunts dwarves is near. [m] then [3] raises the Hearth alert: civilians go to the hearth and doors set to Lock on alert shut. [n] then [2] shows where it is." |
| `hint_predator_open` | first `AnimalSpawned` of a dangerous species while the fortress has no shelter | "A beast that hunts dwarves is near. [m] then [3] raises the Hearth alert once your hall has a door: before that there is nowhere to shelter, and the dwarves work on in the open. [n] then [2] shows where it is." |
| `hint_food` | edible items in stock fall below `HINT_FOOD_DAYS` days for the population, hourly | "Food is running low. Check the farm plots' crops [z], order meals at a kitchen, and gather plants [d]." |
| `hint_no_path` | a job remains blocked unreachable for a whole day from first hourly observation | "Jobs are blocked: no path. Check for doors, water and undug rock." |
| `hint_glowcap` | glowcap seeds in stock | "Glowcap grows in the dark under a glowstone lamp." |
| `hint_runeforge` | a runeforge is placed | "The runeforge burns vials, not coal." |
| `hint_staff` | a runeforge is built | "A staff is a stone on a stick: the stone is the spell, the dwarf is the fuel." |
| `hint_wand` | a wand or a staff in stock | "A wand is quick and soft; a shod staff is slow and hard." |
| `hint_sanctum` | a sanctum zone exists | "Build the sanctum in stone." |
| `hint_rune_metal` | a dwarf of the fortress has rune of their own | "Iron drinks the rune: a runecaster in mail recovers slowly." |
| `hint_draught` | a draught in stock | "One draught, then three days' rest." |
| `hint_herbs_eaten` | a dwarf eats a raw plant while a work order for a draught brewed from plants stands | "Hungry dwarves ate the plants a draught was waiting for. Order the draught before the crop ripens, and its job takes the first of the harvest." |
| `hint_cellar` | a stockpile with the cellar setting on is not a working cellar (hourly) | "A cellar must be dark and between 2 and 14 °C. Oak barrels age in a year, other wood in two." |
| `hint_pallet` | first `Slept` on the floor with a pallet's materials (cloth, wool, fiber, straw or reeds) in stock | "A pallet needs no workshop: build one from cloth or straw and nobody sleeps on the floor." |
| `hint_rack` | first `drying_rack` built | "A rack dries what it holds. Outdoors it dries twice as fast in clear weather, and not at all in rain." |
| `hint_hive` | a built hive with too few flowers in reach | "Bees need flowers: three within six tiles of the hive. Look for a meadow." |
| `hint_skylight` | first glass floor built over open space | "A glass floor is a skylight: crops below grow in every season, as warm as the rock around them." |
| `hint_spider_ranch` | first caged spider placed in a cage building | "The spider does not need feeding. Nobody has asked it." |
| `hint_rot` | the first food item of the fortress turns stale | "Food rots: meals and raw food keep two or three weeks. Barrels in a food stockpile slow it four times; smoked or salted meat keeps. Cook, farm and fish for more." |
| `hint_breach` | first cavern breach | "A cavern lies open to the fortress, and what lives there can walk in. Wall the opening off [b > Constructions] or hang a door in it set to Lock on alert." |
| `hint_panel_letters` | a panel's own letter acts where that letter also opens a panel (§ Panels) | "Inside a panel its own letters come first. Esc, then a letter, opens another panel." |

## Tutorial

The tutorial's steps, in order (`../04-implementation/ui-screens/menus-and-world.md` § Tutorial). `Check` names one of the fixed checks of that section; `Highlight` is a fortress panel id, or `z`, `speed` or `menu`, a field of status row 1. The text is the string `tutorial.<id>`; each `[k]` key in it, and each key word, is shown as its binding has it now.

| id | Check | Highlight | Text |
|---|---|---|---|
| `view` | `view_moved` | `z` | "Welcome to your hall. Move the view with ←→ ↑↓ (or drag with the middle button), and change the level with [<] and [>] (or the wheel). Do both: the z field below shows the level." |
| `look` | `looked` | `look` | "Look at things with [k], or a click on the map. The look panel lists all that is on the tile, and a click on a dwarf opens its view; the status row names what is under the pointer. Look at a tile, then at one of your dwarves." |
| `dig` | `dig_designated` | `designate` | "Open Designate with [d]: Dig is chosen. Go down a level with [<] into the rock, click one corner of a box, then the opposite corner (or Enter twice). The marked tiles blink while the work waits for a miner." |
| `stairs` | `stairs_designated` | `designate` | "Stairs lead down. In Designate, [w] chooses stairs: click a floor tile twice for a down stair and the stair beneath it. Change the level between the two clicks and the box makes a whole shaft." |
| `stockpile` | `stockpile_made` | `zones` | "Hauled goods need a place. Open Zones with [z], choose a stockpile with [s], and drag a rectangle over open floor (or Enter at two corners)." |
| `workshop` | `workshop_placed` | `build` | "Leave Zones with Esc, open Build with [b], then [w] for the workshops. Choose one with ↑↓ and Enter, then click a free spot, or Enter at the cursor. Dwarves build it once time runs." |
| `order` | `order_queued` | `orders` | "Workshops make what is ordered. Open Orders with [o]: [n] adds an order, type part of a recipe's name and press Enter. An order waits for a workshop that can make it." |
| `farm` | `farm_plot_made` | `zones` | "Food grows on soil. In Zones ([z]), [f] chooses a farm plot: drag it over soil or grass. Click the plot to choose its crop for each season." |
| `labors` | `labors_changed` | `labors` | "A dwarf works only at the labors that are on. Open Labors with [l]: ↑↓ choose a dwarf, a click on a cell turns that labor on or off, and [a] turns the whole row." |
| `speed` | `paused_and_sped` | `speed` | "Time stands still while the game is paused. [Space] pauses and resumes, and [+] and [-] change the speed. Run the fortress at 2× or 4×, then pause it again." |
| `save` | `saved` | `menu` | "Save your fortress: [F5] makes a quick save, and Esc opens the game menu, which has Save. Saves are kept in this browser." |

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
| `m_summon` | first `SummonCalled` | "A summoning was answered." |
| `m_stone_set` | first `StoneSet` | "A stone was first set at the runeforge." |
| `m_runecaster` | `FirstRunecaster` | "A dwarf first held the rune." |

## Confirmations

| id | Text | Default |
|---|---|---|
| `c_deepsilver` | "Deepsilver is the finest metal in the world. Taking it wakes the Hollow: creatures will come up through the rock where it was mined. Working it at the runeforge or the laboratory wakes the Hollow too. Mine it?" | No |
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
| `c_embark_no_food` | "Embark with no food?" | No |
| `c_embark_no_drink` | "Embark with no drink?" | No |
| `c_load_loadout` | "Load {loadout}? It replaces the skills and supplies you have set." | No |
| `c_overwrite_loadout` | "A loadout named {loadout} is saved already. Replace it with this one?" | No |
| `c_delete_loadout` | "Delete the loadout {loadout}? This cannot be undone." | No |
| `c_leave_embark` | "Go back to the world map? The skills and supplies you have set here are lost." | No |
| `c_melt_items` | "Mark {what} for melting? Melted items are gone; the smelter gives back part of their metal as bars." | No |
| `c_dump_items` | "Mark {what} for dumping? Dwarves will carry every one of them to a dump zone." | No |
| `c_dump_selection` | "Dump everything on these {n} tiles? Dwarves will carry it to a dump zone." | No |
| `c_slaughter_animal` | "Slaughter {animal}? It will be butchered for meat, hide and bone." | No |
| `c_suspend_workshop` | "Suspend {workshop}? Its current job stops and its orders wait until you resume it." | No |
| `c_deconstruct_building` | "Take apart {building}? Its materials are left where it stood." | No |
| `c_remove_zone` | "Remove {zone}? Its settings are lost." | No |
| `c_remove_order` | "Remove the order for {recipe}? Work in progress on it stops." | No |
| `c_tutorial` | "Is this your first fortress? The tutorial sets up a friendly site and walks you through the basics, a step at a time. Play it?" | No |
| `c_release_cage` | "Release {creature} from {cage}? It is set down beside the cage, as wild or hostile as it was." | No |
| `c_first_ignite` | "Set a fire on purpose? Fire spreads to anything that burns, your own floors and fields too, and rain is the only thing that puts it out." | No |

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
| Music volume | 0 to 100 in steps of 10 | 50 |
| Music | on / off (also the `Ctrl+M` key) | on |
| Sound volume | 0 to 100 in steps of 10; reserved for sound effects, saved and not shown | 50 |
| Intro at launch | first time / always / off | first time |
| Intro style | deep / hall | deep |
| Reduced motion | on / off: the map's designations do not blink | off |

## Strings

Settings rebinding failures use the UI defaults `ui.settings.binding_modifiers` ("Use a key with optional Ctrl or Shift."), `ui.settings.binding_conflict` ("Conflicts with {context}: {action}"), `ui.settings.binding_fixed` ("{key} is a fixed key and cannot be rebound.") and `ui.settings.binding_browser` ("{key} belongs to the browser, which acts on it first."); its resets say `ui.settings.binding_reset` ("{action}: back to {key}.") and `ui.settings.bindings_reset` ("Every key is back to its default."). Context and action use the same headings and wording as Help.

A refused fixed-footprint placement names the building and explains that width and height cannot be changed; its named message and generic rejection text are string-registry defaults.

Pasture rejection defaults include `reject.not_tame` ("that animal is not tame") and `reject.not_grazer` ("that animal does not graze").

Player-facing text uses string keys. The UI reads `strings.json` together with the `UI_STRINGS` defaults in `ui/strings.ts`; a content row wins over a default of the same key. Screen wireframes list the keys per screen; announcement, thought, hint, milestone and confirmation texts above are their canonical values. Count placeholders in strings support plural forms `{count|singular|plural}` (such as `{n|table|tables}`), evaluating to `{count} singular` when `count` is 1 and `{count} plural` otherwise; prefixing the singular form with `!` (`{count|!singular|!plural}`) outputs only the chosen noun without the count number. The strings check audits both tables, used keys, and the bidirectional text mirrors for confirmations, hints, milestones and thoughts.
