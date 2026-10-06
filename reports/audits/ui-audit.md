# Deepholm v1.0.0: UI audit

**Date:** 2026-10-04 · **Build audited:** `master` @ `134ff43` (dev server, `--mode test`, 1280×800) · **Scope:** every screen and panel, judged against three criteria: (1) a clean, intuitive UI, (2) repetitive tasks that are easy, (3) clear errors and warnings.

**Method.** I read the UI spec (`docs/02-systems/24-ui-and-input.md`, `docs/03-content/ui-keymap-and-screens.md`, `docs/04-implementation/ui-screens/*`, and systems 11, 12 and 14), all of `src/ui/`, and the related parts of `src/app/game.ts`, `src/platform/input.ts`, the reject reasons and the announcement registry. I then drove the real game with Playwright. Each run generated seed `audit-1`, went to the hilliest region, embarked (once with a bare `Enter`, otherwise with the Balanced preset), and tried the actions below. Screenshots and text dumps of the cell buffer are in my scratch folder (`%TEMP%\claude\…\scratchpad\shots\NN-*.png|.txt`, cited as `shot NN`). Screenshots already in the repo are cited as `reports/screenshots/*.png`. Each finding is tagged **[observed]** (seen in the running game) or **[code]** (read in source, not exercised).

---

## 1. Executive summary: top 10 issues by player impact

| # | Severity | Issue |
|---|---|---|
| 1 | **blocker** | **Pressing `[Enter] Embark` straight away embarks with nothing.** The embark screen opens with 0 skill points spent and 0 supplies. A first-time player who follows the footer prompt gets 7 "Peasants" with **0 picks, 0 axes, 0 food, 0 drink, 0 seeds, 0 logs**, so the fortress cannot dig and will starve. [observed: shots 05, 06, 14, 18; probe: `pick:0 axe:0 food:0 drink:0 seed:0 log:0`] |
| 2 | **blocker** | **Nothing you do on the map appears while the game is paused, and the game starts paused.** Commands are applied only at the next tick. A dig drag, a building or a zone shows nothing until you unpause, and a refusal appears only then, possibly for a click made much earlier. The first hint ("Designate a place to dig…") leads the player straight into this. [observed: shot 50 vs 51; shot 37 shows the refusal of an earlier click] |
| 3 | **blocker** | **You cannot set a work order's quantity.** Every order is added as `×1`. The panel says `[+/-] count`, but `+` opens the *new global order* list, `-` changes game speed (and unpauses from pause), and `Enter`+`+` changes the *threshold*. "Craft 5 doors" therefore means adding 5 separate ×1 orders. [observed: p4 log, shots 63/64; `src/ui/screens/fortress.ts:832`, `:1138`, `:1147`] |
| 4 | **major** | **Panel accelerators swallow panel hotkeys.** The same letter does different things depending on which panel is open. With Stocks open, `m` (Military) **marks the selected category for melting**. With Military open, `s` (Stocks) enters "set station", `j` (Jobs) toggles ranged gear, `c` clears the station, `t` sets Train and `o` sets Off. With a Workshop open, `s` suspends it. These are destructive and silent. [observed: Stocks+`m`, Military+`s`; `fortress.ts:882` runs `panelKey` before the hotkeys at `:973-981`] |
| 5 | **major** | **Many commands have no UI at all, yet the hints tell you to use them.** There is no way to set door modes (`hint_alert`: "lock doors set to lock on alert"), link levers (`hint_gate`: "drawbridge … linked to a lever"), assign bedrooms, set labor priorities, assign a barracks to a squad, train animals, designate harvest, set titles or rename dwarves. [code: grep of `src/ui`; 22 catalog commands are never emitted, see §5.4] |
| 6 | **major** | **The game rarely says why something is not happening.** The orders panel shows no waiting reason. The workshop panel shows the raw code `missing_input`. Jobs say `waiting: input` without naming the input. Dig or zone rectangles with no valid tile do nothing, silently. Trade/depot actions do nothing without a caravan. Rejections show for 2 s in the status row and are never logged. [observed + code, §4] |
| 7 | **major** | **Internal ids and codes leak into the UI**: `carpenter #16777320`, `Depot #16777303`, `Saved: manual-1791137527125.`, `raw_stone`/`stone_block` in the build menu, `No immigrants this season: spirit.`, `Our standing with hillfolk has fallen: wood_offered.`, keybinding rows `speed_up`/`z_down`, and the milestone tags `[t] train (M6)` and `(hunting M6)`. [observed: shots 61, 63, 70, 34; `reports/screenshots/full-year-end.png`] |
| 8 | **major** | **The two panels you need for many dwarves are broken at scale.** The labor grid never scrolls rows (dwarves past ~40 cannot be reached), its headers are ambiguous (`An An`, `Co`), and only 7 of 25 columns show at a time. The military squad list loses a row to its header, so a squad is always hidden: with 1 squad the list is empty, and with 2 only the second shows. [observed: shots 15, 67, p4 "MIL2"; `labors.ts:93`, `military.ts:312`] |
| 9 | **minor** | **The status bar shows red `!12` hostiles on Day 1** while the Threats panel says "Active: none". It counts sealed-cavern creatures 17–26 levels below the surface. [observed: probe `8@z20 ×10`, `45@z11–12`; `src/ui/status.ts:47-52`] |
| 10 | **minor** | **Text is truncated, mangled or missing glyphs**: `Butcher' 1 table+1 raw_stone (1)`, `Magma fo 1 anvil+3 stone_block (`, every makeable recipe drawn as `?` (● is not in CP437), `No jo`, help rows cut mid-word, a newline drawn as `?` in the Legend, `priOur goods` in Trade. There are no tooltips, although the spec promises them. [observed: shots 34, 61, 14, 10; goldens `m8-screens.legend`, `m7-trade-ui.trade_session`] |

Runners-up: `[g] Generate` types a "g" into the seed field (shot 60); `-` while paused unpauses (`fortress.ts:803-809`); `Ctrl+S` "save menu" is not implemented, and the browser's Save-page dialog fires instead; a successful placement immediately shows a **red** ghost over the new building (shot 37); `hint_fuel` and `hint_farm` can never fire (§4.6).

---

## 2. A new player's first 20 minutes

Each step lists what the player sees and where they get confused.

**Main menu** (shot 01). This is clean. `[a] About` is dimmed and does nothing. "Continue" is hidden when there is no save, as the spec says.

**World generation** (shots 02, 03, 60). The seed field has focus as soon as the screen opens. The screen advertises `[g] Generate`, but pressing `g` appends a "g" to the seed (`deep-1189-1g`) [observed]. You have to press `Enter` to leave the field first, and nothing says so. Nothing explains what size does, or how much the seed matters.

**World map** (shot 04). The region panel shows `Wealth ▓▓ 2 · Peril 0 · Temper 3` without explaining what these mean, and "Temper" in particular is opaque. The cursor is hard to find on a busy map. `[Enter] Embark here` is clear.

**Embark** (shots 05–07, 30–31). **This is the first trap (issue #1).** The screen opens with every dwarf at `0/10` skill points and `Spent 0` of a 1,500 budget. The footer's most prominent action is `[Enter] Embark`, and pressing it starts a fortress with nothing in it. The Supplies tab does print "Hint: two picks and one axe are the minimum for a working start", but only on the second tab, and Embark is not blocked or warned when the party has no pick. `[p]` Presets is cut off at the right edge (`[p]` with no label at 1280 px). The skill list has 33 rows of `[-] 0 [+]` with no indication of which skills matter.

**Arrival** (shot 09). The fortress is paused (`║`) and the first hint is shown. At 800 px tall the log strip has one line and the hint just fits. A red `!12` sits in the status bar on Day 1 (issue #9). A new player will open Threats, read "Active: none", and not know what to believe.

**Dig** (shots 32, 33, 50, 51). `d` opens Designate and a second `d` picks Dig, so "dig" takes two presses of the same key. Dragging shows `Dig 4×3 (12 tiles), priority 5`. That number counts every tile, not the tiles that will actually be designated (the zone tool does show "k qualify"). On release:
- On open floor nothing happens and there is no message. The tool filters out every tile and sends nothing (`designate.ts:152-155`).
- On rock, while paused, still nothing visible (issue #2). After unpausing, the designation is a faint blue tint on a pink stipple (shot 51).
- `[h] Harvest` is permanently greyed out. A stale M4 gate still blocks it (`designate.ts:52-58`, "until 07 exists"), and 07 now exists.

**Stockpile.** `z`, then `s`, then a drag works, and the status line `Stockpile 3×3 (9 tiles, 9 qualify)` is good. To pick what it holds you click the `Preset [Food ▾]` row repeatedly: the e2e test needs 6 clicks to reach Wood, and Everything is 13 away. There is no keyboard path: in the zones panel `p` selects the Pasture tool, and the tree has no arrow-key handling (`zones.ts:323-326`, `fortress.ts:1043-1053`). This breaks the spec rule "no action reachable only one way".

**Workshop** (shots 34–37). `b`, `w` lists 20 workshops alphabetically. Many names are mangled because the inputs column eats the name: `Butcher' 1 table+1 raw_stone (1)`, `Craftsdwar 1 raw_stone+1 log (0)`, `Drawbrid n block+1 mechanism (0)`. The inputs use content ids (`raw_stone`, `stone_block`), and the count covers the first input only. The first row (Bowyer's) is preselected, so the player has to look for the carpenter. Hovering rock shows `blocked: needs a floor` and a ghost so dark (#502020 on black) that it is nearly invisible (shot 35). Clicking a valid floor while paused shows nothing. After a tick, the ghost under the cursor turns **red** ("something is built here") on top of the building you just placed (shot 37), so success looks like failure.

**Craft** (shots 61–64). Clicking a finished workshop opens a panel titled `carpenter #16777320`. Each recipe is prefixed `?`, because ● is missing from the font, so "makeable" survives only as green text (colour only). `[+] new order`, then `Enter`, adds `Door x1`. **There is no way to make it ×5** (issue #3). Pressing `+` again, as the panel's `[+/-] count` suggests, opens a 150-row *global* recipe list. Pressing `-` unpaused the game (status went from `║` to `► 1x`). `Enter` then `+` raised a threshold that does not apply to a "once" order. Once the order finishes it disappears, and nothing in the log says so.

**Build furniture** (shot 38 / p3 log). Doors and beds are under Furniture: `Door 1 door (0)`, `Bed 1 bed (3)`. With 0 doors in stock, nothing tells you a door must first be ordered at a carpenter or mason. A planned building that is waiting shows `Build … waiting: inp` (truncated) in Jobs, and the Look panel shows only `Building: butcher's shop (planned` (cut off). Neither says *which* input is missing (p3 log).

**Bedrooms** (shot 43). `z`, `b`, drag. A drag over rock reads `Bedroom 3×3 (9 tiles, 0 qualify)`, and on release nothing happens and no message appears. On floor, the selected zone shows `Room: bare (score 0) · Not enclosed · Requirements not met · Owner: nobody`. It does not say *which* requirement is missing (a bed). There is no key to assign an owner. `[e] resize` does not explain that the next drag replaces the zone's tiles.

**Military and alert** (shots 19, 67, 68; `reports/screenshots/military-and-alert.png`). `m`, `+` creates "The Hearthguard", but the squad table under the `Squad Size Mode` header stays **empty** (issue #8). The alert line `[1] Calm [2] Watch [3] Hearth` is clear. Adding members means pressing `a`, choosing a dwarf and pressing `Enter`, once per dwarf. `Barracks none · assign zone` looks like an instruction, but there is no way to assign one. `hint_alert` tells you to "lock doors set to lock on alert", but door modes have no UI anywhere.

**Saving.** `F5` logs `Saved: manual-1791137527125.` (shot 70). `Ctrl+S`, listed in Help as "save menu", does nothing in-game; in a real browser it opens "Save page as…" (`input.ts:114` swallows F5/F9/F12 but not `Ctrl+S`). [code + observed: screen unchanged]

---

## 3. Repetitive tasks

Costs below are measured in the running build (p4) or counted from the key handlers.

| Task | Today: inputs and screens | What happens | Recommended interaction | Spec / file it touches |
|---|---|---|---|---|
| **Craft 5 of an item** (doors at a carpenter) | Click workshop → `+` → ~15×`↓` (or click) → `Enter`. That makes ×1. To get 5: repeat click → `+` → `Enter` four more times (the recipe selection is kept on the workshop path only) = **≈5 clicks + 25 keys, 5 order rows** | The count cannot be changed (`orders.ts:54` always sends `remaining: 1`; `fortress.ts:1138` sends `+` to "new global order", `:832` lets `-` reach the speed handler) | Recipe picker with a **quantity field** (type digits, `+`/`-` ±1, `Shift` ±10) and a mode toggle (`once N` / `keep ≥ N`). In the order list, `+`/`-` change the count. A type-ahead filter in the recipe list | `ui-screens/panels.md` § Orders (add an "add order" sub-wireframe); `fortress.ts` orders/workshop key cases; `panels/orders.ts` |
| **Make 10 beds** | As above, 10 times (~40 inputs). Workaround: `m` (maintain, sets threshold to 20), `Enter`, then `-` ×10 to keep ≥10, about 12 keys, and only discoverable by reading code | Gives "keep ≥10 in stock", which is not "make 10" | Same as above | same |
| **Queue the same order again** | Global `+` resets the selection to the top of a 150-row list (`fortress.ts:1138`). The workshop `+` keeps it. A finished order disappears | No "again" action | `[r] repeat` on a selected or just-finished order; keep a "recent recipes" section at the top of the picker | `panels.md` § Orders |
| **Build 5 doors / 5 beds** | `b` `f`, select row (`↓`×9 or click), then 5 clicks (the tool stays active, which is good) = **≈7 + 5** | Fine if items exist. With `(0)` in stock nothing warns that the jobs will wait | Keep click-to-place, and add **drag a line or rectangle to place one per valid tile**. Show `0 in stock — 5 will wait for door items · [o] order 5` | `fortress-screen.md` § Build tool; `14` § Player-facing behavior |
| **Designate several rooms** | `z` `b`, one drag per room (the tool stays active) | Good. But you cannot assign owners, and a rejected drag is silent | Keep the drag. Add `[o] owner` (cycle or pick list) to the room panel, and a status line when 0 tiles qualify | `panels.md` § Zones; `14` `AssignRoom` |
| **Configure a stockpile** | Click `Preset [ ]` up to 12 times. Tree clicks only. Material, quality, containers and priority are display-only | Mouse-only and slow | A real dropdown (`p` opens it, letters jump), arrow keys plus `Space` in the tree, editable container and priority fields | `panels.md` § Zones (stockpile); `zones.ts` |
| **Set many dwarves' labors** | One click per cell. 7 of 25 columns visible (`←`/`→` scroll). Shift-click toggles a column, `a` toggles a row. **Rows past the panel height cannot be reached** (`labors.ts:93`) | Unusable past ~40 dwarves. Headers are ambiguous | Scrolling rows. Full-width labor screen (a modal like Trade) with readable headers and a hover name. Profession templates ("Miner", "Hauler only") applied to a multi-selection. Editable labor priority row (`SetLaborPriority`) | `panels.md` § Labors; `11` § Player-facing behavior |
| **Change labor priority** | Not possible: read-only text in Jobs (`jobs.ts:117-131`) | Spec item missing | Number row in the labor screen, `↑`/`↓` on a focused column | `11` § Priorities in the UI |
| **Add 6 dwarves to a squad** | `a`, `↓`…, `Enter`, ×6 (the list resets to the top each time) ≈ 20+ keys | Works, but slow | Multi-select list (`Space` toggles, `Enter` commits). Or select dwarves in Units and `[m] add to squad` | `panels.md` § Military |
| **Multi-select units** (forbid their gear, send to squad, etc.) | Not possible | — | `Space` to mark rows in Units, then act on the selection | `fortress-screen.md` § Units |
| **Undo designations** | `Ctrl+Z` undoes only the most recent batch, once (`designate.ts:166-171`) | Fine for one mistake | Short undo stack (e.g. 10 batches) | `24` § Input model |
| **Breeding cap to 20** | `c` ×20. Going down wraps through 100 (`animals.ts:47`) | Tedious | `+`/`-` on the cap, typed value | `panels.md` § Animals |
| **Mark items forbidden or to dump** | Drag selection on the map, then `f` / `d` | Good | Keep it, but warn that the stocks-panel `m` key melts (see #4) | — |
| **Trade quantities** | `+`/`-`, `Shift` ±10, `Home`/`End` | Good, matches the spec | Keep | — |

---

## 4. Errors and warnings

"Today" is the exact text the player sees, or "nothing".

### 4.1 Command rejections

All rejections go through `fortress.ts:254-260`. The text replaces status row 2 for `STATUS_HINT_SECONDS` = 2 s of wall time, is **not written to the log**, and, because commands apply at the next tick, appears only after unpausing (issue #2).

| Failure | Today | Should say |
|---|---|---|
| Any of 33 `precondition_failed` sites (wrong building state, trap mode, cage occupant, hospital zone, work order recipe/workshop mismatch, traffic mode…) | `Refused: that cannot be done here` | Specific text per site, e.g. "That building is still being built", "That order belongs to a different workshop type" |
| 100 `not_found` sites | `Refused: there is nothing there` | Name the missing thing: "That dwarf has died", "That zone no longer exists" |
| Place building, bad tile | Ghost: `blocked: needs a floor` (good). After the click: `Refused: it cannot stand there` | Keep the ghost text, and make the refusal repeat the rule: "Door needs walls on two opposite sides" |
| Magma workshop away from magma | Ghost `blocked: something is built here` (from a stale hover); refusal `it cannot stand there` | "Needs magma (level ≥4) directly below one tile" |
| Place on an occupied footprint | `Refused: the footprint is blocked` | "Something is already built here" (the same string the ghost uses) |
| Hearth while one exists | `the hall already has a hearth` | OK |
| Undo with progress | `work has already begun there` | "N designations kept: work has begun" |
| Squad limit (`+` with 8 squads) | **nothing**: `newSquad` returns null (`military.ts:75`) | "There can be at most 8 squads" |
| Squad full | `Refused: the squad is full` | OK |
| `disband` with no confirm host | nothing (`military.ts:81-91`) | n/a in the app, but should not silently return |

### 4.2 Silent no-ops in the UI layer (nothing reaches the simulation)

| Action | Today | Should say |
|---|---|---|
| Dig/channel/smooth drag where no tile qualifies | **nothing**; the tool stays armed (`designate.ts:155`) [observed] | "No tiles here can be dug: they are open or floor" (per kind) |
| Zone drag with 0 qualifying tiles | **nothing**; `0 qualify` flashes only while dragging (`zones.ts:165`) [observed] | "Bedrooms need walkable floor; 0 of 9 tiles qualify" |
| Kill / follow order clicked on an empty tile | nothing; stays in mode (`military.ts:198-199`) | "Click a creature" in the status bar |
| `[t] trade now` / depot `[t]` without a caravan at the depot | **nothing** (`fortress.ts:671-675`) | "No caravan is at the depot (next: Hillfolk, Summer)" |
| Trade `[g] Gift` with merchant goods selected | nothing (`trade_session.ts:112`) | "A gift takes nothing: clear their side first" |
| Trade `Enter` with nothing offered | nothing (`trade_session.ts:116`) | "Choose goods to offer" |
| `Ctrl+S` | nothing (no `save_menu` case in `fortress.ts:835-876`) | Open the save dialog the help promises |
| `[t] title`, `[n] rename` in Units | dimmed, swallowed (`fortress.ts:1114`) | Implement, or remove from the action row |
| Load a save whose blob is missing | nothing (`game.ts` `loadSave`: `if (blob === undefined) return`) | "That save could not be read" |

### 4.3 Job and workshop blocks

| Failure | Where shown today | Today | Should say |
|---|---|---|---|
| `missing_input` (build) | Jobs panel only | `waiting: input`, truncated to `waiting: inp` [observed] | `waiting: 1 door — order at carpenter`. The job's input filter is available, so name it (as the wireframe's `waiting: log` does) |
| `missing_input` (workshop order) | Workshop panel last line | raw `missing_input` (`orders.ts:213`). `operate.ts:346` collapses `waiting for raw_stone` into the code | `Waiting for stone (0 available)`. Show it **next to the order** in the Orders panel too, which today shows no status at all (`orders.ts:154-159`); the spec requires "waiting for <input>" (`12` § Operation 3) |
| Fuel missing | Workshop panel | raw `missing_input` (same collapse) | "Needs fuel: a wood furnace makes charcoal" |
| `unreachable` | Jobs panel | `no path` | "no path: blocked by water, a locked door or undug rock" (11 lists the hint) |
| `no_tool` | Jobs panel | `waiting: tool` | "waiting: a pick (none free)" |
| `no_worker` | Jobs panel | `no worker` | "no one has Mining enabled: [l] labors" |
| `workshop_suspended`, `no_magma`, `target_invalid` | Jobs panel | raw code with spaces: `workshop suspended`, `no magma` (`jobs.ts:84`) | Strings for each |
| Blocked summary | Jobs header | `0 open · 2 claimed · 6 blocked` | Spec: "6 blocked (4 unreachable, 2 missing materials)" (`11` § Player-facing behavior) |
| No announcement for blocks | — | Only `no_magma` is announced (`workshops/index.ts:40`) | A once-per-cause alert: "The carpenter's workshop is idle: no logs" |

### 4.4 Room, zone, placement and stockpile state

| State | Today | Should say |
|---|---|---|
| Room requirements | `Requirements not met` | "Needs a bed" / "needs a table with a chair" |
| Not enclosed | `Not enclosed` | "Not enclosed: 3 open border tiles" (and highlight them) |
| Stockpile full | log note `A stockpile is full.` | "Stockpile #2 (Wood) is full" with focus on it |
| Farm needs seeds | `A farm plot has no {species} seeds.` (fills correctly) | OK; add the plot number |

### 4.5 Trade, military, saves and other announcements

| Event | Today | Should say |
|---|---|---|
| Immigration skipped | `No immigrants this season: spirit.` / `: luck.` / `: cap.` [observed in `reports/screenshots/full-year-end.png`] | "No immigrants this season: hall spirit must be Content (now Unhappy)" |
| Reputation loss | `Our standing with hillfolk has fallen: wood_offered.` [code: `trade/index.ts:204`] | "…fallen: they were offered wooden goods" |
| Immigrants arrived | `5 dwarves have come to join the hall, 0 of them children.` | Drop the clause when 0 |
| Save | `Saved: manual-1791137527125.` [observed] | "Saved Wolfhall, Day 2 of Spring, Year 1" |
| Load failure | `The save failed: <section>` (`game.ts:667` reuses `ui.save.failed`) | "Could not load that save: …" |
| Quota | `Storage quota exceeded; export offered…` | OK |
| Combat log | `{attacker} hits {defender}` (first names only) | OK |

### 4.6 Hints that cannot fire, and hints the spec promises but the code lacks

- `hint_fuel` listens for `WorkshopBlocked { reason: 'no_fuel' }` (`hints.ts:103`). No system emits `no_fuel`, because fuel shortage is reported as `missing_input`, so the hint is dead. [code: grep]
- `hint_farm` fires on a refused `CreateZone farm_plot` (`hints.ts:99-101`). The zone tool never sends a refusable rectangle (it filters tiles first), so this hint is dead too. [code]
- `11` § Player-facing behavior promises "No one has mining enabled" and "Jobs are blocked: no path". Neither exists, and `IDLE_HAULER_WARNING` is defined but never used. [code]

---

## 5. Clarity and layout

### 5.1 Information hierarchy

- **The status bar carries too much and drops the important parts.** At 1280 px, row 1 ends `[?] hel` and row 2 ends `[s] stocks`; Military, Labors and Orders are missing from the hotkey strip. The red `!n` is the loudest element and is wrong on Day 1 (issue #9). The spec's `$` caravan field is not implemented (`status.ts:33-59`).
- **The log strip is 1–3 rows**, and the 2 s rejection text overwrites the tile-summary row. Rejections should go to the log as an "alert" (or a new "refused" severity) so they can be read later.
- **The sidebar is 36 columns, and almost every panel truncates**: Units `No jo`, Jobs `Thurid Darks`, Orders `[↑↓] reor`, the Build list (§2), Look `(planned` and `[3]Crea`. The spec's tooltips for truncated cells (24 § Input model, Hover) do not exist. Either widen the sidebar at ≥1280 px or implement the tooltip.
- **The workshop panel has no hotkey title and no type name**: it shows `Workshop` and `carpenter #16777320` (`orders.ts:188`). Use "Carpenter's workshop" and the building's ordinal ("#1").

### 5.2 Glyphs and colours (including the colorblind palette)

- **Glyphs missing from CP437** draw as `?`: ● (makeable recipe, `orders.ts:196`), ★ (civ request priority, `civilizations.ts:91`), and a raw newline in the Legend. Add aliases to `GLYPH_ALIASES` (`surface.ts:67`) or use CP437 characters (`•`/`○`, `☼`).
- **Colour-only state**: makeable recipes (green vs dim, since the glyph is broken), zone-tile qualification (green or red background, no glyph change), and the build ghost (green or red). Spec 24 says "No information is conveyed by color alone".
- **Ghost colours are too dark.** `ghost_ok #205020` and `ghost_bad #502020` on a black map are nearly invisible (shot 35). Use brighter backgrounds, or a glyph change (`▒` for OK, `x` for blocked).
- **Colour collisions in both palettes.** `text_key` = `alert` = `dwarf_need`: `#FFD34D` by default, `#FFB000` colorblind, so accelerators look like alert lines. `hostile #FF3030` vs `dwarf_wounded #FF4040` by default, and `#FF8C00` vs `#FF7F00` colorblind: a wounded dwarf and a hostile differ only by glyph. `danger` = `text_bad` = `dwarf_wounded` in colorblind mode. `SIDE_BY_SIDE_STATE_PAIRS` (`palette.ts:101`) checks only for *identical* values. It should check a minimum perceptual distance, and add `hostile`/`dwarf_wounded` and `text_key`/`alert`.

### 5.3 Discoverability and consistency of hotkeys

- **Same letter, different meaning** (issue #4). Panel accelerators run before the global panel hotkeys (`fortress.ts:882` vs `:973`). Stocks uses `f d m t`, Military uses 18 letters, Workshop uses `s o f w x`, Zones uses all its zone letters, Animals uses `p s c a n h`, and Build uses its category letters. Recommendation: panel hotkeys win when a panel is merely *open*, and accelerators need focus (or `Alt`/`Shift`). At minimum, destructive accelerators (melt, dump, suspend, slaughter, deconstruct) should never share a letter with a panel hotkey.
- **Toggle surprise**: pressing the open panel's own key closes it (`fortress.ts:977`). After `Esc` cancels a build category, `b` closes Build and the next `f` opens Overlays instead of Furniture. [observed in p2]
- **Help is generated from action ids, so shared ids are mislabelled** (`help.ts:119-120`): Trade `+` reads "adjust the selected skill or q…", Trade `Esc` reads "cancel tool → close panel → game menu", and Embark `Enter` reads "embark on the region". It lists every arrow and digit on its own row (93 rows), with panel hotkeys at row ~70. Group them ("←→↑↓ pan", "1–9 priority") and put panel hotkeys first.
- **Keybindings screen** shows ids: `speed_up`, `z_down`, `quick_save` (`settings.ts:136`). Show the help wording.
- **Speed keys**: `-` from pause unpauses at 1× (`fortress.ts:803-809`); it should stay paused. `+` and `-` also do different things per panel (see Orders).

### 5.4 Missing UI for implemented commands

Never emitted by the UI: `AssignRoom`, `AssignCoffin`, `AssignTitle`, `LinkMechanism`, `UnlinkMechanism` (code only), `SetDoorMode`, `SetHatchMode`, `SetPlateTrigger`, `SetTrapMode`, `ReleaseCage`/`ReleaseCaged`, `TameCaged`, `TrainAnimal`, `SetLaborPriority`, `SetBuildingPriority`, `SetDesignationPriority`, `SetSquadLeader`, `SetSchedule`, `RenameSquad`, `RenameFortress`, `SetStockpileContainers`, `DesignateHarvest`, plus `SetZoneSetting` (barracks squad). (Grep of `src/ui`, `src/app` against `command-catalog.md`.)

The Look panel's lever section lists linked targets and `[Pull lever]`, but you cannot create a link.

### 5.5 Empty states and confirmations

- **Empty states are mostly silent.** Jobs with 0 jobs shows an empty table. Orders with none shows only `[+] new global order`. Military before any squad shows a header with no rows. Stocks shows only what exists (fine). Each should have a one-line "what to do": e.g. "No work orders. Click a workshop and press [+]".
- **Confirmations** are implemented as specified and read well (golden `m8-screens.confirm`). Gaps:
  - Animal slaughter (`s`), stocks melt (`m`) and dump (`d`), and workshop suspend have no confirmation and share letters with panel hotkeys.
  - `c_remove_stockpile_items` defaults to **Yes**, against 24's "`Enter` for the default which is always the safe option" (spec inconsistency).
- **Embark** has no "are you sure?" when the party has no pick or no food (issue #1).

---

## 6. Recommendations

### Quick wins (strings and small UI changes only)

| # | Change | File / spec | Size |
|---|---|---|---|
| Q1 | Open the embark screen with **Balanced** applied. If no pick or axe is selected, show a footer warning before Embark (or a confirmation) | `src/ui/screens/embark.ts` (constructor: `applyPreset('balanced')`); `02` § Player-facing behavior | S |
| Q2 | Fix the Orders keys: `+`/`-` change `remaining` when an order is selected and not editing; move "new global order" to `n`; stop `-` from falling through to speed | `fortress.ts:832`, `:1138`, `:1147`; `ui.panels.md` § Orders | S |
| Q3 | Replace raw codes with strings: `lastBlockedReason` (keep the `waiting for X` text instead of collapsing it to `missing_input`), immigration and reputation `{reason}`, `typeId #entityId` titles, `Depot #id`, save ids, keybinding ids, `(M6)` labels | `orders.ts:188,213`; `operate.ts:346`; `depot.ts:52`; `animals.ts:99,104`; `game.ts:510,614`; `settings.ts:136`; `strings.json` `announce.immigration_skipped`, `announce.reputation_changed` | S |
| Q4 | Name the missing input in jobs (`waiting: 1 door`), add strings for `workshop_suspended`, `no_magma` and `target_invalid`, and add the blocked breakdown to the Jobs header | `jobs.ts:20-25,84,95`; `strings.ts:255-258` | S |
| Q5 | Write rejections to the log as well as the status row (alert colour, with the command's focus tile). Keep them for 4 s | `fortress.ts:254-260`; `24` § Events consumed | S |
| Q6 | Status messages for silent no-ops: empty designate or zone rectangle, `[t] trade` without a caravan, gift/offer guards, squad limit, kill target miss | `fortress.ts:701-733,684-691,671-675`; `trade_session.ts:111-116`; `military.ts:75,198` | S |
| Q7 | Glyph aliases for ● ★ and newline. Clean the build list: content names in place of ids, shorter input text, name column first | `surface.ts:67`; `build.ts:43-46,253-263` | S |
| Q8 | Do not count sealed-cavern hostiles in `!n`; count only those on discovered tiles or spotted ones, and match the Threats panel's "Active" | `status.ts:47-52` | S |
| Q9 | Enable `[h] Harvest` (drop the stale M4 gate) | `designate.ts:52-58` | S |
| Q10 | `-` from pause stays paused. Swallow `Ctrl+S` and `Ctrl`+wheel and implement the save menu (reuse the game menu's Save) | `fortress.ts:803-809,835`; `input.ts:114` | S |
| Q11 | World gen: `Enter` or `Tab` leaves the seed field, and a hint line says "[Enter] done · [g] Generate" while focused (or make `g` generate when the field is empty of edits) | `world_gen.ts` | S |
| Q12 | Fix the dead hints: emit or recognise fuel shortage for `hint_fuel`; trigger `hint_farm` from the zone tool when a farm drag has 0 qualifying tiles | `hints.ts:99-105`; `operate.ts:250` | S |
| Q13 | Military list height = squads + 1 for the header. Labor grid row scrolling | `military.ts:312`; `labors.ts:92-109` | S |
| Q14 | Help: group the arrow and digit rows, put panel hotkeys first, use per-context wording | `help.ts:100-125` | S |

### Medium (UI features)

| # | Change | File / spec | Size |
|---|---|---|---|
| M1 | **Apply UI commands immediately while paused** (run the command phase without advancing the tick), or at least draw a pending preview layer for queued designations, placements and zones and report rejections at once. The trade screen already works around this with `commandTick` (`game.ts:1067`) | `sim-host.ts`, `core/commands.ts`; `simulation-core.md` § Commands; `24` | M |
| M2 | **Order picker with quantity, mode and material**, type-ahead filter, "recent recipes", `[r] repeat` order; a status column per order ("waiting for stone", "no workshop of this type", "done") | `panels/orders.ts`; `panels.md` § Orders | M |
| M3 | **Rebind panel accelerators** so panel hotkeys always win (or accelerators need focus); confirmations for destructive single-key actions | `fortress.ts:882,973-981`; `ui-keymap-and-screens.md` § Panels | M |
| M4 | **Building panel**: door/hatch modes, lever link (pick a target on the map), plate trigger, trap mode, cage release, bed and room owner, coffin assignment, build priority | new `panels/building.ts`; `14` § Player-facing behavior ("Clicking a building opens its panel…") | M |
| M5 | **Full-screen labor manager**: scrolling rows, named headers, labor priority row, profession templates, multi-select | `panels/labors.ts`; `11` § Player-facing behavior | M |
| M6 | Drag-to-place for 1×1 furniture and constructions (one building per valid tile in the rectangle, with a count in the status bar) and a "0 in stock, order N?" prompt | `panels/build.ts`; `fortress-screen.md` § Build tool | M |
| M7 | Stockpile editor with keyboard: preset dropdown, tree navigation, editable containers, priority, quality and materials | `panels/zones.ts`; `13` § Player-facing behavior | M |
| M8 | Tooltips (hover shows the full text of truncated cells), or a wider sidebar at ≥1280 px | `widgets/label.ts`, `ui/constants.ts` `SIDEBAR_COLS` | M |
| M9 | Room panel: say which requirement is missing, highlight open border tiles, `[o] owner` | `panels/zones.ts:257-277`; `14` § Rooms | S–M |
| M10 | Units: multi-select, mood glyph (spec), title and rename via the existing `text_input` | `panels/units.ts` | M |
| M11 | Military: multi-select members, barracks assignment, leader | `panels/military.ts`; `16` | M |
| M12 | Palette: check a minimum colour distance, separate `text_key` from `alert`, separate `hostile` from `dwarf_wounded`, brighter ghosts plus a glyph difference | `src/content/palette.json`, `render/palette.ts:76-125`; `23` § Palette | S–M |

### Spec changes (where the spec itself leads to an unintuitive result)

| # | Spec text | Problem | Proposed change | Size |
|---|---|---|---|---|
| S1 | `02-embark-and-loadout.md` § Presets and § Player-facing behavior say nothing about the initial state; D-029 only covers scenarios | The UI opens empty, and "Embark" with an empty party is valid | "The screen opens with `balanced` applied. Embark warns when the party has no pick or no food." | S |
| S2 | `simulation-core.md`/`command-catalog.md`: "Commands are applied at the start of a tick"; `sim-host` "begins … paused" | Together these mean that a paused game, which is the default state, ignores input visibly | "While paused, the host applies pending commands immediately (a zero-length command phase)." | M |
| S3 | `ui-screens/panels.md` § Orders shows only `[+] new global order` and `[Enter] edit` | No wireframe exists for *adding* an order, so quantity was never designed | Add an "Add order" wireframe: recipe filter, quantity, once/keep mode, material, workshop | S |
| S4 | `ui-keymap-and-screens.md` § Panels: "`[letter]` accelerator shown in brackets" together with single-letter panel hotkeys | Guarantees collisions (`m`/melt, `s`/station…) | Reserve the panel hotkey letters globally. Panel accelerators use `Shift`+letter, or only apply once the panel has focus (after `Tab`) | S |
| S5 | `24` § Confirmations: "default … always the safe option" vs `c_remove_stockpile_items` default Yes | Internal contradiction | Make the default No, or reword the rule | S |
| S6 | `24` § Fortress screen layout: `!n` "active hostiles" vs fortress-screen.md "`!n` hostiles on map" | The implementation took "on map", which includes sealed caverns | "Hostiles on discovered tiles or spotted" | S |
| S7 | `11` § Player-facing behavior: the jobs panel names the reason, but `ui-screens/panels.md` shows `waiting: log` while strings use `waiting: input` | The spec never says the input must be named | "Reason names the missing item type and count." | S |
| S8 | `24` § Announcements: `CommandRejected` is status-bar only | Rejections disappear after 2 s | "…and appended to the log as an alert with the command's focus." | S |
| S9 | `14` § Player-facing behavior: "Placing several of the same type: the menu stays open" | Click-per-tile only | Add "drag places one per valid tile for 1×1 types" | S |

---

## 7. Where the spec and the implementation disagree

| Spec | Implementation | Evidence |
|---|---|---|
| `fortress-screen.md` status row 1: `$` caravan present | Not drawn | `status.ts:33-59` |
| `fortress-screen.md` Units: mood tier glyph after the name; `[t] title`, `[n] rename` | No glyph; actions dimmed and inert | `units.ts:91,100`; `fortress.ts:1114` |
| `panels.md` Jobs: `/filter`, `[l]abor [s]tate` filters; reason `waiting: log` | No filter; `waiting: input` | `jobs.ts` |
| `11`: "a number row above sets labor priorities"; jobs summary by reason | Read-only text; no breakdown | `jobs.ts:117-131,95` |
| `12` § Operation 3: order shows "waiting for <input>" | Orders list has no status; the workshop shows a raw code | `orders.ts:154-159,213`; `operate.ts:346` |
| `12` § Player-facing: workshop recipe list "grouped by output category" | Flat alphabetical list, broken ● glyph | `orders.ts:192-197` |
| `panels.md` Orders: `[+] new global order` (and `[+/-] count` in the action row) | `+` opens new global even when an order is selected; count is unchangeable | `fortress.ts:1138,1147` |
| `panels.md` Zones stockpile: `Preset [Food ▾]` dropdown, editable `Materials`, `Quality`, `Priority`, `Links [+]` | Click-to-cycle preset; other fields display-only | `zones.ts:316-359` |
| `panels.md` Military: `Gear weapon [axe ▾]`, squad list with rows | Cycle keys; list hides a squad | `military.ts:128-150,312` |
| `panels.md` Animals: `[t] train` | `[t] train (M6)`, no handler; wild tab `(hunting M6)` | `animals.ts:99,104` |
| `fortress-screen.md` Designate: `[h] Harvest` | Permanently dim | `designate.ts:52-58` |
| `14` § Player-facing: clicking a building opens its panel (state, mode toggles, links, owner, deconstruct); lever panel | Non-workshop buildings open Look with type, state and `[x] take apart`; no modes or links | `look.ts:135-156` |
| `24` § Input model: `Ctrl+S` save menu | Not handled | `fortress.ts:835-876` |
| `24` § Input model: "panels show tooltips for truncated cells"; "no action reachable only one way" | No tooltips; stockpile preset and tree are mouse-only, labor columns are keyboard-scroll only | widgets; `zones.ts` |
| `24` § Accessibility: "No information is conveyed by color alone" | Recipe makeability, zone qualification, ghost validity | §5.2 |
| `menus-and-world.md` Load: thumbnails | Not shown in the golden | `m8-screens.load` |
| `menus-and-world.md` Keybindings: rows show the action | Rows show action ids | `settings.ts:136` |
| `24` Hints: `hint_fuel`, `hint_farm` | Unreachable triggers | `hints.ts:99-105` |
| `11` hints "No one has mining enabled", "Jobs are blocked: no path", `IDLE_HAULER_WARNING` | Not implemented | grep |

---

### Appendix: how the observations were made

- Playwright scripts outside the repo (`scratchpad/lib.mjs`, `p1.mjs` to `p5.mjs`) against `npx vite --mode test --host 127.0.0.1 --port 5299` (stopped afterwards). State was read through `window.__deepholm` (`text()`, `readers`, `step()`).
- Key observed runs:
  - p1: tour of every panel (shots 01–29).
  - p2/p3: dig, build and zone attempts (shots 30–55).
  - p4: workshop order quantity, global order, military, F5 (shots 60–70).
  - p5: no-preset embark inventory, hostile census, help panel (shot 71).
- No repository file was changed apart from this report.
