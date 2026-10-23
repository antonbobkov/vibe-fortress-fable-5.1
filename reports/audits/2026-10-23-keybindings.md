# Audit: every key the game reacts to, and whether the menu can rebind it

**Date:** 2026-10-23 · **Commit examined:** `4b8d8e7` · **Kind:** audit of input handling, followed by the fix in the same task · **Source:** the owner's request, [T-424](../../docs/archive/tasks/T-424-keybindings-from-the-menu.md)

## The answer

- **At `4b8d8e7` most keys could not be rebound.** Settings › Keybindings listed 127 bindings, but only the global keys, the map keys, the panel letters and the world-map and embark keys were read through the keymap. Every fortress panel's own keys, the game menu, the confirmation dialog, the legend screen, the trade session and the labor manager compared the press with literal keys.
- **Four contexts were listed but dead.** The Labor manager, Units panel, Military panel and Trade session rows were in the table and in the editor, so a player could rebind them, but their code read the literal keys: the rebinding did nothing, and the old key went on working.
- **184 of the 272 key rows the fix leaves were not in the keymap at all**: the letters of Designate, Build and Zones, every panel's accelerators (Jobs, Orders, Workshop, Building, Stocks, Depot, Military, Animals, Civilizations, Mood, Debug, Look), the digit tabs of Look, Log, Help and Animals, the zone inspector, the map selection's `[S-f]` `[S-d]` `[S-t]`, the menus' letters, and the second spellings `=`, `Home` and `End` that some screens took beside `+`.
- **Esc was half rebindable.** The global `Esc` row was read by the fortress screen only; every other `Esc` (menus, dialogs, choosers) was literal.
- **Captions named the default keys.** After a rebinding, the panels' captions, the status rows, the hints and Help's notes still named the default key, and a click on an entry of the hotkey strip pressed the default letter, which no longer opened its panel.
- Smaller faults: the editor bound a lone modifier (`Shift`) when a player reached for `Shift+W`; the Workshop panel compared the arrows with `ArrowUp` and `ArrowDown`, which the input layer never sends, so its recipe list could not be moved by keyboard; the Units caption `[c] center` named the Civilizations letter (the key is `Shift+C`); the Units idle filter was a plain `i` that a panel letter rebound to `i` made unreachable; a key rebound to `F6` or `Ctrl+P` reached the browser as well; and saved rebindings were keyed by row index, so every new row had to be appended at the end of the table.

## How

Every key handler under `src/ui` and `src/app` was read: `FortressScreen.keyPress` and `panelKey`, each panel's `key`, `capKey`, `editorKey`, `farmKey`, `workshopKey`, `pickerKey` and `materialKey`, the stockpile editor, the dropdown widget, each screen's `key`, and `Game.handleKey`. Each comparison with a key was listed with the screen or panel state it acts in and checked against the keymap table of `docs/03-content/ui-keymap-and-screens.md` at that commit and against whether the code read it through `Keymap.resolve`.

## The keys, before and after the fix

Each row is a key of the keymap table as T-424 leaves it (`docs/03-content/ui-keymap-and-screens.md` § Keymap), with how `4b8d8e7` read it. The 17 panel letters of § Fortress panels are not rows of that table; they were and are rebindable through the `fortress_panel` context.

"Literal" means the code compared the press with the key itself. In the Key column `[w]` is an accelerator letter and `[S-m]` one whose default letter is a panel letter (it takes Shift).

| Context | Key | Action | At 4b8d8e7 | Now |
|---|---|---|---|---|
| Global | `Esc` | cancel tool → close panel → game menu | listed; only the fortress read the row, every other `Esc` was literal | fixed |
| Global | `Space` | pause / resume | rebindable | rebindable |
| Global | `+` | speed up (1× → 2× → 4×) | rebindable | rebindable |
| Global | `=` | speed up (1× → 2× → 4×) | rebindable | rebindable |
| Global | `-` | speed down | rebindable | rebindable |
| Global | `F5` | quick save | rebindable | rebindable |
| Global | `F9` | quick load (confirm) | rebindable | rebindable |
| Global | `Ctrl+S` | save menu | rebindable | rebindable |
| Global | `F12` | debug panel | rebindable | rebindable |
| Global | `?` | help | rebindable | rebindable |
| Global | `Tab` | toggle sidebar | rebindable | rebindable |
| Global | `Ctrl+Z` | undo last designation batch | rebindable | rebindable |
| Global | `Shift+Y` | calendar panel | rebindable | rebindable |
| Map | `←` | pan or move the map cursor (Shift: 10) | rebindable | rebindable |
| Map | `→` | pan or move the map cursor (Shift: 10) | rebindable | rebindable |
| Map | `↑` | pan or move the map cursor (Shift: 10) | rebindable | rebindable |
| Map | `↓` | pan or move the map cursor (Shift: 10) | rebindable | rebindable |
| Map | `<` | z-level down | rebindable | rebindable |
| Map | `,` | z-level down | rebindable | rebindable |
| Map | `>` | z-level up | rebindable | rebindable |
| Map | `.` | z-level up | rebindable | rebindable |
| Map | `Home` | center on the hearth (or wagon) | rebindable | rebindable |
| Map | `Ctrl+↑` | zoom in / out | rebindable | rebindable |
| Map | `Ctrl+↓` | zoom in / out | rebindable | rebindable |
| Map | `k` | look at the mouse (or map center) | rebindable | rebindable |
| Map | `Enter` | act at the map cursor | rebindable | rebindable |
| Map | `1` | with a designation or zone tool: set priority | rebindable | rebindable |
| Map | `9` | with a designation or zone tool: set priority | rebindable | rebindable |
| Map | `r` | with a building tool: rotate | rebindable | rebindable |
| Map | `x` | with a building tool: cycle material | rebindable | rebindable |
| Map | `Delete` | with a selection: cancel designations / remove zone / cancel building | rebindable | rebindable |
| Panels | `↑` | move selection | fault: rebindable in the menus only; literal in the fortress panels and dialogs | rebindable |
| Panels | `↓` | move selection | fault: rebindable in the menus only; literal in the fortress panels and dialogs | rebindable |
| Panels | `PageUp` | scroll | fault: rebindable in the menus only; literal in the fortress panels and dialogs | rebindable |
| Panels | `PageDown` | scroll | fault: rebindable in the menus only; literal in the fortress panels and dialogs | rebindable |
| Panels | `Enter` | activate | fault: rebindable in the menus only; literal in the fortress panels and dialogs | rebindable |
| Panels | `Tab` | next / previous field | fault: rebindable in the menus only; literal in the fortress panels and dialogs | rebindable |
| Panels | `Shift+Tab` | next / previous field | fault: rebindable in the menus only; literal in the fortress panels and dialogs | rebindable |
| Panels | `[letter]` | accelerator shown in brackets | listed (stands for every letter) | fixed |
| Panels | `/` | focus the filter field | fault: rebindable in the menus only; literal in the fortress panels and dialogs | rebindable |
| Panels | `Backspace` | back within nested menus | fault: rebindable in the menus only; literal in the fortress panels and dialogs | rebindable |
| Panels | `←` | move across, or change the focused value | fault: literal, not in the keymap | rebindable |
| Panels | `→` | move across, or change the focused value | fault: literal, not in the keymap | rebindable |
| Map selection | `[S-f]` | forbid everything on the selected tiles | fault: literal, not in the keymap | rebindable |
| Map selection | `[S-d]` | dump everything on the selected tiles (confirm) | fault: literal, not in the keymap | rebindable |
| Map selection | `[S-t]` | move the goods on the selected tiles to the depot | fault: literal, not in the keymap | rebindable |
| Designate panel | `[S-d]` | dig | fault: literal, not in the keymap | rebindable |
| Designate panel | `[S-c]` | channel | fault: literal, not in the keymap | rebindable |
| Designate panel | `[S-u]` | stairs up | fault: literal, not in the keymap | rebindable |
| Designate panel | `[S-j]` | stairs down | fault: literal, not in the keymap | rebindable |
| Designate panel | `[i]` | up/down stairs | fault: literal, not in the keymap | rebindable |
| Designate panel | `[r]` | ramp | fault: literal, not in the keymap | rebindable |
| Designate panel | `[w]` | stairwell | fault: literal, not in the keymap | rebindable |
| Designate panel | `[S-s]` | smooth | fault: literal, not in the keymap | rebindable |
| Designate panel | `[S-e]` | engrave | fault: literal, not in the keymap | rebindable |
| Designate panel | `[x]` | remove a construction | fault: literal, not in the keymap | rebindable |
| Designate panel | `[S-t]` | chop trees | fault: literal, not in the keymap | rebindable |
| Designate panel | `[g]` | gather plants | fault: literal, not in the keymap | rebindable |
| Designate panel | `[h]` | harvest | fault: literal, not in the keymap | rebindable |
| Designate panel | `[S-f]` | traffic (again: the next traffic mode) | fault: literal, not in the keymap | rebindable |
| Designate panel | `[S-p]` | give the tool's priority to the last batch | fault: literal, not in the keymap | rebindable |
| Build panel | `[S-c]` | constructions | fault: literal, not in the keymap | rebindable |
| Build panel | `[S-f]` | furniture | fault: literal, not in the keymap | rebindable |
| Build panel | `[w]` | workshops | fault: literal, not in the keymap | rebindable |
| Build panel | `[S-m]` | mechanisms | fault: literal, not in the keymap | rebindable |
| Build panel | `[S-t]` | traps | fault: literal, not in the keymap | rebindable |
| Build panel | `[S-s]` | special | fault: literal, not in the keymap | rebindable |
| Zones panel | `[S-s]` | stockpile | fault: literal, not in the keymap | rebindable |
| Zones panel | `[S-f]` | farm plot | fault: literal, not in the keymap | rebindable |
| Zones panel | `[S-p]` | pasture | fault: literal, not in the keymap | rebindable |
| Zones panel | `[S-b]` | bedroom | fault: literal, not in the keymap | rebindable |
| Zones panel | `[S-d]` | dining hall | fault: literal, not in the keymap | rebindable |
| Zones panel | `[h]` | hearth hall | fault: literal, not in the keymap | rebindable |
| Zones panel | `[S-o]` | hospital | fault: literal, not in the keymap | rebindable |
| Zones panel | `[r]` | barracks | fault: literal, not in the keymap | rebindable |
| Zones panel | `[S-a]` | archery range | fault: literal, not in the keymap | rebindable |
| Zones panel | `[S-m]` | meeting area | fault: literal, not in the keymap | rebindable |
| Zones panel | `[S-t]` | tomb | fault: literal, not in the keymap | rebindable |
| Zones panel | `[S-u]` | dump | fault: literal, not in the keymap | rebindable |
| Zones panel | `[i]` | fishing zone | fault: literal, not in the keymap | rebindable |
| Zones panel | `[g]` | gather zone | fault: literal, not in the keymap | rebindable |
| Zone inspector | `[y]` | back to the zone types | fault: literal, not in the keymap | rebindable |
| Zone inspector | `[x]` | unlink a source of a stockpile, or remove the zone (confirm) | fault: literal, not in the keymap | rebindable |
| Zone inspector | `Delete` | remove the stockpile zone (confirm) | fault: literal, not in the keymap | rebindable |
| Zone inspector | `[S-e]` | resize the zone | fault: literal, not in the keymap | rebindable |
| Zone inspector | `[i]` | link a source stockpile | fault: literal, not in the keymap | rebindable |
| Zone inspector | `[S-p]` | open the stockpile preset dropdown | fault: literal, not in the keymap | rebindable |
| Zone inspector | `[g]` | focus the category tree | fault: literal, not in the keymap | rebindable |
| Zone inspector | `[q]` | focus numeric settings | fault: literal, not in the keymap | rebindable |
| Zone inspector | `[v]` | open allowed material classes | fault: literal, not in the keymap | rebindable |
| Zone inspector | `[S-o]` | open the bedroom's owner picker | fault: literal, not in the keymap | rebindable |
| Zone inspector | `Shift+A` | a farm plot: the highlighted row's crop for every season in which that crop can grow | fault: literal, not in the keymap | rebindable |
| Zone inspector | `Space` | toggle the checkbox (category tree, material classes) | fault: literal, not in the keymap | rebindable |
| Zone inspector | `+` | adjust the focused value | fault: literal, not in the keymap | rebindable |
| Zone inspector | `=` | adjust the focused value | fault: literal, not in the keymap | rebindable |
| Zone inspector | `-` | adjust the focused value | fault: literal, not in the keymap | rebindable |
| Units panel | `Space` | mark the row (does not pause while the list is open) | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Units panel | `*` | mark all / none | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Units panel | `[i]` | show only idle dwarves / all | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Units panel | `Shift+W` | wounded dwarves first / list order | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Units panel | `Shift+T` | give or take away a title | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Units panel | `Shift+N` | rename the dwarf | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Units panel | `Shift+M` | add the marked dwarves to a squad | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Units panel | `[` | sleep an hour earlier / later | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Units panel | `]` | sleep an hour earlier / later | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Units panel | `Shift+L` | the labor manager on the marked dwarves | fault: literal, not in the keymap | rebindable |
| Units panel | `[S-c]` | center the map on the dwarf | fault: literal, not in the keymap | rebindable |
| Labors panel | `[S-a]` | whole row on / off | fault: literal, not in the keymap | rebindable |
| Jobs panel | `Tab` | move between the jobs and the "Orders waiting" rows | fault: literal, not in the keymap | rebindable |
| Jobs panel | `[S-l]` | cycle the labors that have jobs | fault: literal, not in the keymap | rebindable |
| Jobs panel | `[S-s]` | cycle all / open / claimed / blocked | fault: literal, not in the keymap | rebindable |
| Jobs panel | `[S-p]` | raise the job's priority (1–9, wrapping) | fault: literal, not in the keymap | rebindable |
| Jobs panel | `[x]` | cancel the job | fault: literal, not in the keymap | rebindable |
| Orders panel | `[S-n]` | new order (opens "Add order") | fault: literal, not in the keymap | rebindable |
| Orders panel | `+` | the selected order's count +1 (Shift: +10) | fault: literal, not in the keymap | rebindable |
| Orders panel | `=` | the selected order's count +1 (Shift: +10) | fault: literal, not in the keymap | rebindable |
| Orders panel | `-` | the selected order's count −1 (Shift: −10) | fault: literal, not in the keymap | rebindable |
| Orders panel | `_` | the selected order's count −1 (Shift: −10) | fault: literal, not in the keymap | rebindable |
| Orders panel | `[r]` | repeat the selected order, or the last finished one | fault: literal, not in the keymap | rebindable |
| Orders panel | `[x]` | remove the selected order (confirm) | fault: literal, not in the keymap | rebindable |
| Orders panel | `Delete` | remove the selected order (confirm) | fault: literal, not in the keymap | rebindable |
| Orders panel | `[S-m]` | the order's mode | fault: literal, not in the keymap | rebindable |
| Orders panel | `[S-p]` | the order's priority | fault: literal, not in the keymap | rebindable |
| Orders panel | `[S-f]` | the order's material | fault: literal, not in the keymap | rebindable |
| Orders panel | `Shift+↑` | move the order in its queue | fault: literal, not in the keymap | rebindable |
| Orders panel | `Shift+↓` | move the order in its queue | fault: literal, not in the keymap | rebindable |
| Workshop panel | `[S-n]` | new order at this workshop | fault: literal, not in the keymap | rebindable |
| Workshop panel | `[S-o]` | this workshop's orders | fault: literal, not in the keymap | rebindable |
| Workshop panel | `[S-f]` | the material of the orders here | fault: literal, not in the keymap | rebindable |
| Workshop panel | `[w]` | the next worker | fault: literal, not in the keymap | rebindable |
| Workshop panel | `[S-s]` | suspend (confirm) or resume | fault: literal, not in the keymap | rebindable |
| Workshop panel | `[x]` | take the workshop apart (confirm) | fault: literal, not in the keymap | rebindable |
| Building panel | `1` | a planned building's build priority | fault: literal, not in the keymap | rebindable |
| Building panel | `9` | a planned building's build priority | fault: literal, not in the keymap | rebindable |
| Building panel | `[i]` | link a lever or a plate | fault: literal, not in the keymap | rebindable |
| Building panel | `[r]` | unlink the target under the cursor, or release a caged creature (confirm) | fault: literal, not in the keymap | rebindable |
| Building panel | `[y]` | pull the lever | fault: literal, not in the keymap | rebindable |
| Building panel | `[g]` | tame the caged creature | fault: literal, not in the keymap | rebindable |
| Building panel | `[w]` | the owner of a bed's bedroom, or whom a coffin is kept for | fault: literal, not in the keymap | rebindable |
| Building panel | `[x]` | cancel the plan, or take the building apart (confirm) | fault: literal, not in the keymap | rebindable |
| Stocks panel | `[S-f]` | forbid the selected items | fault: literal, not in the keymap | rebindable |
| Stocks panel | `[S-d]` | dump the selected items (confirm) | fault: literal, not in the keymap | rebindable |
| Stocks panel | `[S-m]` | melt the selected items (confirm) | fault: literal, not in the keymap | rebindable |
| Stocks panel | `[S-t]` | move goods to the depot | fault: literal, not in the keymap | rebindable |
| Stocks panel | `Space` | in the depot list: mark the goods | fault: literal, not in the keymap | rebindable |
| Depot panel | `[S-m]` | move goods to the depot | fault: literal, not in the keymap | rebindable |
| Depot panel | `[r]` | return the selected goods to stock | fault: literal, not in the keymap | rebindable |
| Depot panel | `[S-t]` | open the trade session | fault: literal, not in the keymap | rebindable |
| Military panel | `Space` | mark the row (does not pause while the list is open) | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Military panel | `*` | mark all / none | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Military panel | `Enter` | add or remove every marked dwarf | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Military panel | `Shift+L` | choose the squad leader | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Military panel | `Shift+B` | assign a barracks zone | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Military panel | `Shift+N` | rename the squad | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Military panel | `[w]` | choose the squad weapon class | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Military panel | `[g]` | choose the squad armor | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Military panel | `1` | alert: calm | fault: literal, not in the keymap | rebindable |
| Military panel | `2` | alert: watchful | fault: literal, not in the keymap | rebindable |
| Military panel | `3` | alert: hearth | fault: literal, not in the keymap | rebindable |
| Military panel | `[h]` | alert: hearth | fault: literal, not in the keymap | rebindable |
| Military panel | `+` | new squad | fault: literal, not in the keymap | rebindable |
| Military panel | `[x]` | disband the squad (confirm) | fault: literal, not in the keymap | rebindable |
| Military panel | `[S-s]` | set the squad's station | fault: literal, not in the keymap | rebindable |
| Military panel | `[S-c]` | clear the squad's station | fault: literal, not in the keymap | rebindable |
| Military panel | `[S-p]` | add patrol points | fault: literal, not in the keymap | rebindable |
| Military panel | `[y]` | clear the patrol | fault: literal, not in the keymap | rebindable |
| Military panel | `[S-k]` | order a kill | fault: literal, not in the keymap | rebindable |
| Military panel | `[S-f]` | order to follow a dwarf | fault: literal, not in the keymap | rebindable |
| Military panel | `[q]` | cancel the squad's orders | fault: literal, not in the keymap | rebindable |
| Military panel | `[S-m]` | the next squad mode | fault: literal, not in the keymap | rebindable |
| Military panel | `[S-o]` | squad mode: off | fault: literal, not in the keymap | rebindable |
| Military panel | `[S-t]` | squad mode: train | fault: literal, not in the keymap | rebindable |
| Military panel | `[v]` | squad mode: active | fault: literal, not in the keymap | rebindable |
| Military panel | `[S-a]` | add members | fault: literal, not in the keymap | rebindable |
| Military panel | `[r]` | remove members | fault: literal, not in the keymap | rebindable |
| Military panel | `[j]` | ranged or melee | fault: literal, not in the keymap | rebindable |
| Animals panel | `1` | tame / wild tab | fault: literal, not in the keymap | rebindable |
| Animals panel | `2` | tame / wild tab | fault: literal, not in the keymap | rebindable |
| Animals panel | `[S-p]` | pasture the animal | fault: literal, not in the keymap | rebindable |
| Animals panel | `[S-s]` | mark for slaughter (confirm) | fault: literal, not in the keymap | rebindable |
| Animals panel | `[S-c]` | edit the breeding cap | fault: literal, not in the keymap | rebindable |
| Animals panel | `[S-a]` | assign the animal | fault: literal, not in the keymap | rebindable |
| Animals panel | `[S-n]` | name the animal | fault: literal, not in the keymap | rebindable |
| Animals panel | `[S-t]` | train the animal | fault: literal, not in the keymap | rebindable |
| Animals panel | `[h]` | wild tab: hunt toggle | fault: literal, not in the keymap | rebindable |
| Civilizations panel | `[S-d]` | depot panel | fault: literal, not in the keymap | rebindable |
| Civilizations panel | `[S-t]` | open the trade session | fault: literal, not in the keymap | rebindable |
| Civilizations panel | `+` | add a request | fault: literal, not in the keymap | rebindable |
| Civilizations panel | `[S-a]` | add a request | fault: literal, not in the keymap | rebindable |
| Civilizations panel | `[x]` | remove the request | fault: literal, not in the keymap | rebindable |
| Civilizations panel | `[S-p]` | the request's priority | fault: literal, not in the keymap | rebindable |
| Population panel | `+` | raise / lower the population cap | fault: literal, not in the keymap | rebindable |
| Population panel | `-` | raise / lower the population cap | fault: literal, not in the keymap | rebindable |
| Mood panel | `[S-s]` | sort by tier | fault: literal, not in the keymap | rebindable |
| Log panel | `1` | log filter tabs | fault: literal, not in the keymap | rebindable |
| Log panel | `2` | log filter tabs | fault: literal, not in the keymap | rebindable |
| Log panel | `3` | log filter tabs | fault: literal, not in the keymap | rebindable |
| Look panel | `1` | look tabs | fault: literal, not in the keymap | rebindable |
| Look panel | `2` | look tabs | fault: literal, not in the keymap | rebindable |
| Look panel | `3` | look tabs | fault: literal, not in the keymap | rebindable |
| Look panel | `[x]` | take apart the building here (confirm) | fault: literal, not in the keymap | rebindable |
| Help panel | `1` | Keys / Legend / Start tabs | fault: literal, not in the keymap | rebindable |
| Help panel | `2` | Keys / Legend / Start tabs | fault: literal, not in the keymap | rebindable |
| Help panel | `3` | Keys / Legend / Start tabs | fault: literal, not in the keymap | rebindable |
| Debug panel | `[S-d]` | dump save | fault: literal, not in the keymap | rebindable |
| Debug panel | `[r]` | replay season log | fault: literal, not in the keymap | rebindable |
| Debug panel | `[h]` | hash world | fault: literal, not in the keymap | rebindable |
| Labor manager | `arrows` | move the labor cursor (Shift+↑↓: mark the rows passed) | fault: literal, not in the keymap | rebindable |
| Labor manager | `Space` | mark the dwarf | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Labor manager | `*` | mark all / none | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Labor manager | `Enter` | toggle the labor (for every marked dwarf when the row is marked) | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Labor manager | `a` | whole row on / off | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Labor manager | `c` | whole column on / off (the marked dwarves, or everyone) | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Labor manager | `+` | labor priority up / down | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Labor manager | `-` | labor priority up / down | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Labor manager | `1` | set the labor priority | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Labor manager | `9` | set the labor priority | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Labor manager | `t` | profession templates | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Labor manager | `letters` | jump to the next labor starting with that letter (Shift and the letter for a, c, t) | listed (stands for every letter) | fixed |
| Labor manager | `Esc` | close | listed; literal | fixed |
| Labor manager | `Home` | first dwarf | fault: literal, not in the keymap | rebindable |
| Labor manager | `End` | last dwarf | fault: literal, not in the keymap | rebindable |
| Labor manager | `=` | labor priority up / down | fault: literal, not in the keymap | rebindable |
| Profession templates | `1` | choose that template | fault: literal, not in the keymap | rebindable |
| Profession templates | `9` | choose that template | fault: literal, not in the keymap | rebindable |
| Trade session | `Tab` | switch column | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Trade session | `+` | quantity | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Trade session | `-` | quantity | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Trade session | `Enter` | offer | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Trade session | `g` | gift (offer with nothing taken) | fault: listed, but the code read the literal key, so a rebinding did nothing | rebindable |
| Trade session | `Esc` | close | listed; literal | fixed |
| Trade session | `Home` | none of the selected goods | fault: literal, not in the keymap | rebindable |
| Trade session | `End` | all of the selected goods | fault: literal, not in the keymap | rebindable |
| Trade session | `=` | quantity | fault: literal, not in the keymap | rebindable |
| Game menu | `r` | Resume | fault: literal, not in the keymap | rebindable |
| Game menu | `s` | Save | fault: literal, not in the keymap | rebindable |
| Game menu | `l` | Load | fault: literal, not in the keymap | rebindable |
| Game menu | `o` | Settings | fault: literal, not in the keymap | rebindable |
| Game menu | `n` | Rename fortress | fault: literal, not in the keymap | rebindable |
| Game menu | `x` | Retire fortress (confirm) | fault: literal, not in the keymap | rebindable |
| Game menu | `m` | Main menu | fault: literal, not in the keymap | rebindable |
| Confirmation | `y` | Yes | fault: literal, not in the keymap | rebindable |
| Confirmation | `n` | No | fault: literal, not in the keymap | rebindable |
| Confirmation | `Enter` | the default answer | fault: literal, not in the keymap | rebindable |
| Main menu | `n` | New world | fault: literal, not in the keymap | rebindable |
| Main menu | `c` | Continue | fault: literal, not in the keymap | rebindable |
| Main menu | `l` | Load | fault: literal, not in the keymap | rebindable |
| Main menu | `g` | Legends | fault: literal, not in the keymap | rebindable |
| Main menu | `o` | Settings | fault: literal, not in the keymap | rebindable |
| Main menu | `a` | About | fault: literal, not in the keymap | rebindable |
| World generation | `g` | Generate | fault: literal, not in the keymap | rebindable |
| World generation | `r` | random seed | fault: literal, not in the keymap | rebindable |
| World map | `arrows` | move the cursor (Shift: 8) | fault: literal, not in the keymap | rebindable |
| World map | `f` | filter panel | rebindable | rebindable |
| World map | `Enter` | embark on the region | rebindable | rebindable |
| World map | `?` | biome legend | rebindable | rebindable |
| World map | `+` | adjust the selected filter | fault: literal, not in the keymap | rebindable |
| World map | `=` | adjust the selected filter | fault: literal, not in the keymap | rebindable |
| World map | `-` | adjust the selected filter | fault: literal, not in the keymap | rebindable |
| Embark | `1` | Dwarves / Supplies / Animals tabs | rebindable | rebindable |
| Embark | `2` | Dwarves / Supplies / Animals tabs | rebindable | rebindable |
| Embark | `3` | Dwarves / Supplies / Animals tabs | rebindable | rebindable |
| Embark | `+` | adjust the selected skill or quantity | rebindable | rebindable |
| Embark | `-` | adjust the selected skill or quantity | rebindable | rebindable |
| Embark | `r` | reroll the selected dwarf | rebindable | rebindable |
| Embark | `n` | rename | rebindable | rebindable |
| Embark | `p` | presets menu | rebindable | rebindable |
| Embark | `Enter` | Embark | rebindable | rebindable |
| Embark | `=` | adjust the selected skill or quantity | fault: literal, not in the keymap | rebindable |
| Load | `x` | Delete (confirm) | fault: literal, not in the keymap | rebindable |
| Load | `e` | Export | fault: literal, not in the keymap | rebindable |
| Load | `i` | Import | fault: literal, not in the keymap | rebindable |

Counts: of the 272 rows, 42 were rebindable at `4b8d8e7`, 32 were listed but dead, 9 were list keys that worked only in the menus, 184 were literal and not in the keymap, and 5 are fixed.

## Fixed keys and why

These stay out of the editor's reach; `docs/03-content/ui-keymap-and-screens.md` § Fixed keys gives the reasons.

| Key | Where | Why |
|---|---|---|
| `Esc` | everywhere | The one key that always leads back, out of every screen, dialog and chooser to the game menu and Settings. A rebound back key could leave a player with no way to the editor. |
| Typing | a focused text or number field (filters, names, the seed, the order picker, the breeding cap) | Every printable key is its character; the keys that edit or finish the text keep their meaning so a name can always be typed. |
| The editor's keys | Settings › Keybindings | It must work whatever the bindings are. |
| `[letter]`, the labor manager's letters, a preset's first letter | panels, the labor manager, the preset dropdown | They stand for every letter; each accelerator a panel shows is its own row. |
| Any key | a pinned danger line | "Dismissed by any key" (24 § Announcements and the log). |
| `Shift` with a key | arrows, `+` `-`, `Shift+Enter` | A modifier of the key's own action, not a key. |

## What T-424 changed

- **Every non-fixed key is a row of the keymap**, in a context per screen, panel or panel state (§ Keymap), 272 rows in 35 tables. The fortress panels and the labor manager are written against their default keys; the screen passes each press through `Keymap.translate`, so a rebound key reads as the default it replaced and a default key that was moved away reads as nothing there. The menus and dialogs read their own context through `Keymap.resolve` or the same translation.
- **The editor groups the bindings by screen**, one heading per context in the table's order, marks fixed rows, names a rebound row's default, draws a refused key's owner in red, and has `Delete`/`Backspace` (this binding's default) and `[d]` (every default). A lone modifier no longer binds.
- **Conflicts are checked where keys can act together**: the same context, the global keys, the list keys, the map keys beside every panel, the panel letters, the map selection, the zone types beside the inspector (24 § Settings); browser shortcuts such as `Ctrl+W` are refused.
- **Captions follow the bindings**: panel captions, the status rows (and the strip's clicks), hints in the log, the screens' footers and Help's notes name each key as it is bound now.
- **Saved keymaps**: a rebinding is saved under the binding's context and action (`map/z_down`), so a changed default does not retarget it; a keymap saved by index at `4b8d8e7` or earlier is read through the frozen order of that version (`LEGACY_BINDINGS`), and a saved rebinding that would clash is dropped without dropping the rest.
- Also: the Workshop panel's arrows work; the Units idle filter is an accelerator `[i]`; the Units caption reads `[S-c] center`; a bound function key or `Ctrl` key is kept from the browser.

## Left open

- A button whose caption names a key is clickable over the width of its default caption; a rebound key with a longer or shorter name moves the caption's end by a few cells. Filed as [T-NEW: caption buttons measured with the rebound key](../../docs/archive/tasks/T-428-caption-hits-follow-rebound-keys.md).
- Help's Keys tab lists each panel's keys as keymap rows and again in the older notes at its end. Filed as [T-NEW: Help, fold the panel notes into the key sections](../../docs/archive/tasks/T-429-help-notes-into-key-sections.md).
