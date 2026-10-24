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
| `e` | Mood | 15 | every dwarf's tier and top thoughts |
| `a` | Log | 24 | announcements with filters; combat tab |
| `k` | Look | 24 | inspection of the tile under the cursor |
| `f` | Overlays | 23 | overlay toggles |
| `?` | Help | 24 | keymap, legend of glyphs |
| `F12` | Debug | 24 | timings and counters |

Jobs: `Tab` moves the cursor between the job list and the "Orders waiting" rows (`↑↓` move over them, `Enter` opens Orders on one); `[/]` or a click focuses target-name/worker text; Enter or Esc finishes typing. `[S-l]` or a click cycles labors with jobs, `[S-s]` or a click cycles all/open/claimed/blocked. Stocks: `[/]` or a click focuses category/item/material text; Enter or Esc finishes typing. These controls also appear in Help.

Stockpile inspector: `[i] link` or its button starts choosing a source stockpile on the map; click it or Enter at the cursor, Esc or right click cancels. `[x] unlink` or its button opens named linked sources; arrows or click select and centre, Enter or the unlink button removes just that link, Esc or Cancel returns. Delete or `[Del] remove zone` removes the stockpile zone with its existing confirmation. Other zone inspectors retain `[x] remove zone`. Panel letters still switch panels inside both link modes; Help lists these actions.

Animals, Tame tab: `[S-c] cap` or click cap opens its inline number field: digits type, `+`/`-` step by one (Shift by ten), Enter or Set submits, Esc or Cancel discards; 0–100, no wrapping. Panel letters remain available.

Animals, Tame tab: `[S-t] train` or its button opens War/Hunting; arrows and Enter, or click a choice; Esc cancels. Panel letters still switch panels inside the choice. Help lists this action and `Esc` then `[n] Rename fortress` from the game menu, also available by clicking its row and entering a name in the text input.

## Keymap (defaults)

Every row of the tables below is a binding that Settings › Keybindings can change; the keys of § Fixed keys are the only keys the game reacts to that are not here. Each table is one context: the screen, panel or panel state in which its keys act, named by its heading in the editor and in Help.

Key notation: `Ctrl+S` and `Shift+Tab` are a key with modifiers; `arrows` are the four arrow keys; `1`–`9` binds every digit between its two ends; `[w]` is an accelerator letter, bound to the letter alone while no fortress panel uses that letter and to `Shift`+letter (shown `[S-w]`) while one does; `[S-m]` is an accelerator whose default letter is a panel letter. A key written without `Shift` also takes a shifted press (arrows with `Shift` move ten, `+` with `Shift` changes ten), unless the context binds the shifted key itself (`Shift+Tab`).

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
| `Shift+Y` | calendar panel |
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

Panel hotkeys always win. The letters of § Fortress panels always open or close their panel, whatever panel is open; pressing an open panel's own key closes it; when a panel closes while one of its tools was armed, the status row shows a notice ("Designate closed · [d] opens it again", naming the panel and its key; also for Build and Zones). A panel's accelerator may not use one of those letters bare: it is bound to `Shift`+letter and shown `[S-m]`. Reserved letters are read from the live panel bindings, including rebinds. With default bindings, the free letters `g h i q r v w x` work with or without `Shift`; `y` works bare only, because `Shift+Y` opens the Calendar from anywhere on the fortress screen. Only a focused text field (a filter, a name, the order picker's `Find`) takes letters as text.

A caption that names a key (`[S-t] train`, `[x] cancel`, a hint's `[d]`) shows the key its binding has now. Where a panel letter was rebound and an accelerator only moved between its bare and its `Shift` form, the fixed captions keep their default form and the zone inspector's captions follow the live panel letters.

Every destructive single-key action asks through the confirmation dialog first, default **No** (§ Confirmations): melt, dump, slaughter, suspend, take apart, disband, remove (a zone, a work order), release (a caged creature). Undoing a mark (resume, unmark) does not ask.

### Map selection

The keys of a rectangle dragged with no tool (§ Mouse); `Delete` is the Map context's.

| Key | Action |
|---|---|
| `[S-f]` | forbid everything on the selected tiles |
| `[S-d]` | dump everything on the selected tiles (confirm) |
| `[S-t]` | move the goods on the selected tiles to the depot |

### Designate panel

| Key | Action |
|---|---|
| `[S-d]` | dig |
| `[S-c]` | channel |
| `[S-u]` | stairs up |
| `[S-j]` | stairs down |
| `[i]` | up/down stairs |
| `[r]` | ramp |
| `[w]` | stairwell |
| `[S-s]` | smooth |
| `[S-e]` | engrave |
| `[x]` | remove a construction |
| `[S-t]` | chop trees |
| `[g]` | gather plants |
| `[h]` | harvest |
| `[S-f]` | traffic (again: the next traffic mode) |
| `[S-p]` | give the tool's priority to the last batch |

### Build panel

`↑` `↓` and `Enter` choose in a category's list; `Backspace` returns from an armed building to the list.

| Key | Action |
|---|---|
| `[S-c]` | constructions |
| `[S-f]` | furniture |
| `[w]` | workshops |
| `[S-m]` | mechanisms |
| `[S-t]` | traps |
| `[S-s]` | special |

### Zones panel

The zone types; `Enter` with no tool selects the zone at the map cursor or centre.

| Key | Action |
|---|---|
| `[S-s]` | stockpile |
| `[S-f]` | farm plot |
| `[S-p]` | pasture |
| `[S-b]` | bedroom |
| `[S-d]` | dining hall |
| `[h]` | hearth hall |
| `[S-o]` | hospital |
| `[r]` | barracks |
| `[S-a]` | archery range |
| `[S-m]` | meeting area |
| `[S-t]` | tomb |
| `[S-u]` | dump |
| `[i]` | fishing zone |
| `[g]` | gather zone |

### Zone inspector

The keys of a selected zone, before the zone types; letters that open panels require `Shift`, and the labels follow the current panel bindings. Every action has the mouse path listed here and a Help row.

| Key | Action | Mouse |
|---|---|---|
| `[y]` | back to the zone types | zone types button |
| `[x]` | unlink a source of a stockpile, or remove the zone (confirm) | the `[x]` caption |
| `Delete` | remove the stockpile zone (confirm) | `[Del] remove zone` |
| `[S-e]` | resize the zone | the `[S-e] resize` caption |
| `[i]` | link a source stockpile | `[i] link` |
| `[S-p]` | open the stockpile preset dropdown | preset header |
| `[g]` | focus the category tree | tree button or category name |
| `[q]` | focus numeric settings | settings button or numeric label |
| `[v]` | open allowed material classes | materials button |
| `[S-o]` | open the bedroom's owner picker | owner button |
| `Shift+A` | a farm plot: the highlighted row's crop for every season in which that crop can grow | the `[S-a] all seasons` caption |
| `Space` | toggle the checkbox (category tree, material classes) | the checkbox |
| `+` `=` `-` | adjust the focused value | minus or plus button |

The list keys of § Panels work in the inspector: with a farm plot, `↑` `↓` highlight a season row (starting on the current season) and `Enter` opens its crop list (`↑` `↓` and `Enter` choose); in the preset dropdown `↑` `↓` and `Enter` highlight and apply a preset and a letter jumps to the next preset starting with it (`Shift` for a panel letter); in the tree `↑` `↓` select, `→` expands, `←` collapses or goes to the parent; in numeric settings `Tab`, `Shift+Tab` and `↑` `↓` choose barrels, bags, bins, priority, min quality or max quality and `←` `→` adjust; in material classes `↑` `↓` select and `Enter` toggles, Any switching all or none; in the owner picker `↑` `↓` and `Enter` choose Nobody or a dwarf. `Esc` in a chooser goes back, and applied settings remain applied; by mouse, choose another zone or panel.

Container counts are non-negative integers, priorities are 1–9 and quality bounds are 0–5 with minimum no greater than maximum. A refused adjustment reports its reason. In the selected stockpile editor, Space toggles a checkbox, +/- adjusts a numeric field and Tab chooses fields before their global pause, speed or sidebar actions. Bare panel letters always retain their panel action in every editor state. Zone removal continues to use the existing default-No confirmations in § Confirmations.

### Units panel

A panel's own keys may not use a panel hotkey, so these are on `Shift` (shown `[S-t]`). An action applies to every marked dwarf when the cursor's row is marked, otherwise to the cursor's dwarf. `Shift+L` opens the labor manager on the marked dwarves when any are marked; the bare labors key always opens the labors panel, with its cursor on the dwarf under the units cursor. `Enter` looks at the cursor's dwarf.

| Key | Action |
|---|---|
| `Space` | mark the row (does not pause while the list is open) |
| `*` | mark all / none |
| `[i]` | show only idle dwarves / all |
| `Shift+W` | wounded dwarves first / list order |
| `Shift+T` | give or take away a title |
| `Shift+N` | rename the dwarf |
| `Shift+M` | add the marked dwarves to a squad |
| `[` `]` | sleep an hour earlier / later |
| `Shift+L` | the labor manager on the marked dwarves |
| `[S-c]` | center the map on the dwarf |

### Labors panel

`↑` `↓` choose the dwarf, `←` `→` move across the labor columns, and `Enter` opens the labor manager with its cursor on that dwarf.

| Key | Action |
|---|---|
| `[S-a]` | whole row on / off |

### Jobs panel

`↑` `↓` move over the jobs (or the waiting orders), `Enter` centres the map on the job or opens Orders on the waiting order, and `/` focuses the filter.

| Key | Action |
|---|---|
| `Tab` | move between the jobs and the "Orders waiting" rows |
| `[S-l]` | cycle the labors that have jobs |
| `[S-s]` | cycle all / open / claimed / blocked |
| `[S-p]` | raise the job's priority (1–9, wrapping) |
| `[x]` | cancel the job |

### Orders panel

The Orders panel's keys, beside the accelerators it shows (`ui-screens/panels.md` § Orders). `↑` `↓` move over the orders.

| Key | Action |
|---|---|
| `[S-n]` | new order (opens "Add order") |
| `+` `=` | the selected order's count +1 (`Shift`: +10) |
| `-` `_` | the selected order's count −1 (`Shift`: −10) |
| `[r]` | repeat the selected order, or the last finished one |
| `[x]` `Delete` | remove the selected order (confirm) |
| `[S-m]` | the order's mode |
| `[S-p]` | the order's priority |
| `[S-f]` | the order's material |
| `Shift+↑` `Shift+↓` | move the order in its queue |

The count keys take precedence over the speed keys only while an order is selected; with no order selected the order keys say "No order is selected: [S-n] adds one." and the count keys are the speed keys. In "Add order", a text field, letters and `Backspace` edit the recipe filter, `0`–`9` type the quantity, `+` `=` `-` change it, `Tab` / `Shift+Tab` move between the fields, `←` `→` change the focused one, `Enter` adds the order and `Esc` closes it. The material list uses the list keys of § Panels.

### Workshop panel

A click on a workshop opens it; `↑` `↓` choose a recipe and `Enter` adds an order for it.

| Key | Action |
|---|---|
| `[S-n]` | new order at this workshop |
| `[S-o]` | this workshop's orders |
| `[S-f]` | the material of the orders here |
| `[w]` | the next worker |
| `[S-s]` | suspend (confirm) or resume |
| `[x]` | take the workshop apart (confirm) |

### Building panel

The building panel's keys (`ui-screens/panels.md` § Building). The panel opens with a left click on a building, or `Enter` in Look on its tile. `↑` `↓` and `Enter` move over the lines that act and activate one (a mode, a trigger, a linked target, an owner); `←` `→` change a pressure plate's smallest creature size or fluid depth. A link target is picked with a left click on the map, or `↑` `↓` `Enter` in the list.

| Key | Action |
|---|---|
| `1`–`9` | a planned building's build priority |
| `[i]` | link a lever or a plate |
| `[r]` | unlink the target under the cursor, or release a caged creature (confirm) |
| `[y]` | pull the lever |
| `[g]` | tame the caged creature |
| `[w]` | the owner of a bed's bedroom, or whom a coffin is kept for |
| `[x]` | cancel the plan, or take the building apart (confirm) |

### Stocks panel

`↑` `↓` move over the categories, `Enter` expands one, and `/` focuses the filter. In the depot list (`[S-t]`), `↑` `↓` move, `Enter` or `Space` marks goods, `[S-t]` sends them and `Esc` returns to the depot panel.

| Key | Action |
|---|---|
| `[S-f]` | forbid the selected items |
| `[S-d]` | dump the selected items (confirm) |
| `[S-m]` | melt the selected items (confirm) |
| `[S-t]` | move goods to the depot |
| `Space` | in the depot list: mark the goods |

### Depot panel

| Key | Action |
|---|---|
| `[S-m]` | move goods to the depot |
| `[r]` | return the selected goods to stock |
| `[S-t]` | open the trade session |

### Military panel

| Key | Action |
|---|---|
| `Space` | mark the row (does not pause while the list is open) |
| `*` | mark all / none |
| `Enter` | add or remove every marked dwarf |
| `Shift+L` | choose the squad leader |
| `Shift+B` | assign a barracks zone |
| `Shift+N` | rename the squad |
| `[w]` | choose the squad weapon class |
| `[g]` | choose the squad armor |
| `1` | alert: calm |
| `2` | alert: watchful |
| `3` `[h]` | alert: hearth |
| `+` | new squad |
| `[x]` | disband the squad (confirm) |
| `[S-s]` | set the squad's station |
| `[S-c]` | clear the squad's station |
| `[S-p]` | add patrol points |
| `[y]` | clear the patrol |
| `[S-k]` | order a kill |
| `[S-f]` | order to follow a dwarf |
| `[q]` | cancel the squad's orders |
| `[S-m]` | the next squad mode |
| `[S-o]` | squad mode: off |
| `[S-t]` | squad mode: train |
| `[v]` | squad mode: active |
| `[S-a]` | add members |
| `[r]` | remove members |
| `[j]` | ranged or melee |

### Animals panel

| Key | Action |
|---|---|
| `1` `2` | tame / wild tab |
| `[S-p]` | pasture the animal |
| `[S-s]` | mark for slaughter (confirm) |
| `[S-c]` | edit the breeding cap |
| `[S-a]` | assign the animal |
| `[S-n]` | name the animal |
| `[S-t]` | train the animal |
| `[h]` | wild tab: hunt toggle |

### Civilizations panel

`↑` `↓` choose the civilization and `←` `→` its request.

| Key | Action |
|---|---|
| `[S-d]` | depot panel |
| `[S-t]` | open the trade session |
| `+` `[S-a]` | add a request |
| `[x]` | remove the request |
| `[S-p]` | the request's priority |

### Population panel

| Key | Action |
|---|---|
| `+` `-` | raise / lower the population cap |

### Mood panel

`↑` `↓` choose a dwarf and `Enter` inspects it.

| Key | Action |
|---|---|
| `[S-s]` | sort by tier |

### Log panel

| Key | Action |
|---|---|
| `1` `2` `3` | log filter tabs |

### Look panel

`Enter` on a building's tile opens its panel.

| Key | Action |
|---|---|
| `1` `2` `3` | look tabs |
| `[x]` | take apart the building here (confirm) |

### Help panel

`↑` `↓` and `PageUp` `PageDown` scroll.

| Key | Action |
|---|---|
| `1` `2` `3` | Keys / Legend / Start tabs |

### Debug panel

| Key | Action |
|---|---|
| `[S-d]` | dump save |
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
| `Enter` on the footer | Embark |
| `=` | adjust the selected skill or quantity |

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
| Any key | a danger line pinned to the log strip | "Dismissed by any key" (`02-systems/24-ui-and-input.md` § Announcements and the log). |
| `Shift` held with a bound key | arrows, `+` `-`, `Shift+Enter` | A modifier of the key's own action (ten at a time, mark the rows passed, a corner), not a key of its own. |

The mouse is not rebindable; § Mouse lists its gestures.

## Mouse

| Gesture | With no tool | With a tool |
|---|---|---|
| Left click | inspect the tile (look panel); on a building, open its panel | a designation tool: the first corner of its box, then the opposite corner, which designates (the box may span the levels between) / a zone: one tile / place building |
| Left drag | select a rectangle (then `Delete`, `[S-f]` forbid, `[S-d]` dump, `[S-t]` move to depot) | designate a box on one level / draw zone rectangle |
| Right click | inspect with the entity list | cancel the tool |
| Wheel | z-level on the map; over the sidebar, scrolls the list under the pointer three rows a notch and never changes the level | same |
| `Ctrl` + wheel | zoom | zoom |
| `Shift` + wheel | pan vertically | pan vertically |
| Middle drag | pan | pan |
| Hover | tile summary in the status bar | ghost footprint / rectangle size |
| Click on a panel row | select | select |
| Double-click a unit or job row | center the map on it | same |

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

## Tutorial

The tutorial's steps, in order (`../04-implementation/ui-screens/menus-and-world.md` § Tutorial). `Check` names one of the fixed checks of that section; `Highlight` is a fortress panel id, or `z`, `speed` or `menu`, a field of status row 1. The text is the string `tutorial.<id>`; each `[k]` key in it, and each key word, is shown as its binding has it now.

| id | Check | Highlight | Text |
|---|---|---|---|
| `view` | `view_moved` | `z` | "Welcome to your hall. Move the view with ←→ ↑↓ (or drag with the middle button), and change the level with [<] and [>] (or the wheel). Do both: the z field below shows the level." |
| `look` | `looked` | `look` | "Look at things with [k], or a click on the map. The look panel's Tile tab lists all that lies on the tile, and the status row names what is under the pointer. Look at a tile, then at one of your dwarves." |
| `dig` | `dig_designated` | `designate` | "Open Designate with [d]: Dig is chosen. Go down a level with [<] into the rock, click one corner of a box, then the opposite corner (or Enter twice). The marked tiles blink while the work waits for a miner." |
| `stairs` | `stairs_designated` | `designate` | "Stairs lead down. In Designate, [S-j] chooses down stairs: click a floor tile twice. Change the level between the two clicks and the box makes a stair column, down stairs on top and up stairs below." |
| `stockpile` | `stockpile_made` | `zones` | "Hauled goods need a place. Open Zones with [z], choose a stockpile with [S-s], and drag a rectangle over open floor (or Enter at two corners)." |
| `workshop` | `workshop_placed` | `build` | "Open Build with [b], then [w] for the workshops. Choose one with ↑↓ and Enter, then click a free spot, or Enter at the cursor. Dwarves build it once time runs." |
| `order` | `order_queued` | `orders` | "Workshops make what is ordered. Open Orders with [o]: [S-n] adds an order, type part of a recipe's name and press Enter. An order waits for a workshop that can make it." |
| `farm` | `farm_plot_made` | `zones` | "Food grows on soil. In Zones ([z]), [S-f] chooses a farm plot: drag it over soil or grass. Click the plot to choose its crop for each season." |
| `labors` | `labors_changed` | `labors` | "A dwarf works only at the labors that are on. Open Labors with [l]: ↑↓ choose a dwarf, a click on a cell turns that labor on or off, and [S-a] turns the whole row." |
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
| `c_embark_no_food` | "Embark with no food?" | No |
| `c_embark_no_drink` | "Embark with no drink?" | No |
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
