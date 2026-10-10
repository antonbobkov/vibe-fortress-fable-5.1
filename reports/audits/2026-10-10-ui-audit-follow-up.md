# Deepholm: UI audit follow-up

**Date:** 2026-10-10 · **Build examined:** `cloud/T-111` @ `26b6b86` (dev server `npx vite --mode test`, port 5190, Chromium 1280×800) · **Follows:** [`ui-audit.md`](ui-audit.md) (2026-10-04, `134ff43`) · **Task:** T-111

## The answer first

- The U tasks fixed most of what the first audit found. Of its 89 findings, **65 are fixed, 20 partly fixed and 4 still open** on this build. The mechanical draft at `c2b8ca8` counted 68, 16 and 5.
- Four states changed after playing the game or re-reading the code:
  - **Issue 2 and M1, fixed → partly fixed.** Paused input now takes effect at once, but a stockpile made while paused cannot be set up until time runs: its editor says "That zone is no longer available."
  - **§5.5, fixed → partly fixed.** The Jobs panel never shows its empty-state line; the table draws over it.
  - **7.19, open → partly fixed.** The idle-hauler hint now exists (T-177, `1ee4263`, after the draft's snapshot). The two hints for "no one can mine" and "no path" are still missing.
- The § 2 walkthrough is much better. A new player now starts with a working party, sees a dig, a building or a zone at once while paused, can order "5 doors" in one go, and is told why a drag did nothing. What still goes wrong is listed in § 2 below.
- The walkthrough also found new problems the first audit did not list. The worst are a raw string key in the stockpile preset list (`ui.stockpile.preset.hospital`) and the stockpile editor while paused.
- Every item still open or partly fixed, and every new finding, has a backlog row: T-240 … T-252.

## Method

- I read the first audit, the mechanical draft in `docs/work/T-111-ui-audit-follow-up.md` (now archived), the UI decisions D-U1 … D-U10 in `docs/archive/ui-fixes/README.md`, and the spec sections each check needed.
- I drove the real game with Playwright scripts kept outside the repository. Each run generated seed `audit-1`, walked to the hilliest region (the e2e helper's rule), and embarked with the default party. Two runs used the test start `?start=flat-test&embark=default` to reach a trade caravan, as `test/e2e/trade-session.spec.ts` does.
- Player actions went through the real keyboard and mouse. To let time pass I used the test hook's `step(n)`, and to set up the caravan fixture I used the same hook calls as the trade e2e test. State was read through `window.__deepholm` (`text()`, `readers`).
- Screenshots and text dumps of the screen are in my session scratch folder as `shots/NN-*.png|.txt`, cited as **shot NN**. They are not committed. Three crops that show colour or layout are committed under [`../screenshots/t-111/`](../screenshots/t-111/).
- Each claim is marked **observed** (seen in play, with its shot) or **code** (read at `26b6b86`, with file and line). "Draft" means I did not re-check the draft's code reading, and it still stands as the draft wrote it.
- Not run: anything that needs a real raid, a full year, or a second session. § "What I could not establish" lists the gaps.

## 1. Closure table

States: **fixed** (the item's stated behaviour is now as the audit asked, or as the accepted U decision chose), **partly** (part remains), **open** (nothing done). "Draft" is the state in the mechanical draft. A state in bold differs from the draft.

### Top ten issues

| Item | Task / commit | Draft | Now | How checked, and what remains |
|---|---|---|---|---|
| Issue 1: empty embark | U-01 `0b124b1` | fixed | fixed | Observed: the embark screen opens with Balanced, `Spent 1,480` (shot 04). With both picks removed, `Enter` asks "Embark without a pick?", and `Enter` on the dialog keeps the player on the embark screen (shots 04f–04h). |
| Issue 2: paused commands invisible | U-02 `fac58ce` | fixed | **partly** | Observed: a dig drag designates 12 tiles at tick 400 while paused (shot 07f); a workshop is placed while paused (shot 09f). **Remaining:** a stockpile made while paused has no stockpile record yet, so its editor says "That zone is no longer available." until the game runs (shot 08g0; 21 ticks later it works, shot 08g). Code: the record is created when `ZoneChanged` is dispatched (`src/systems/items/index.ts:286-296`), and the spec keeps command events for the tick dispatch (`docs/01-architecture/simulation-core.md:128`). → T-240 |
| Issue 3: order quantity | U-03 `42b1f7a` | fixed | fixed | Observed: `Shift+N`, type `door`, `Tab`, `5`, `Enter` gives `x5 Door · queued` and "Ordered: x5 Door · Carpenter's workshop #1" (shots 10b–10e). `-` then `=` `=` change the count 5 → 4 → 6 while the game stays paused (shots 10g, 10h). |
| Issue 4: accelerators swallow panel keys | U-03 `42b1f7a` | fixed | fixed | Observed: with Stocks open, `m` opens Military (shot 15a); `Shift+M` on a non-metal category says "Nothing here is metal: only metal items melt." (shot 15b). |
| Issue 5: commands without UI | U-05, U-06, U-07, U-01 | partly | partly | Observed: the Animals panel has no train action (shot 16b) and the game menu has no rename (shot 14d). Code: no `TrainAnimal` or `RenameFortress` emitter in `src/ui` or `src/app` (only strings and a length constant). → T-246 |
| Issue 6: no reason given | U-01, U-03 | fixed | fixed | Observed: "No tile here can be dug: dig marks rock walls and boulders." (shot 07d); `Blocked: 4 missing items` and `waiting: 1 t[able]` in Jobs (shot 11e); `x3 Door · waiting for log (0)` in Orders (shot 10j). |
| Issue 7: ids leak | U-01 `cc8c064`, `a8e0a26` | fixed | fixed | Observed: `Carpenter's workshop #1` (shot 10a), `Trade depot #1` (shot 18b), "Saved Wolfhall, Day 1 of Spring, Year 1." (shot 14c), keybinding rows show actions (shot 17b). The listed leaks are gone. A **new** leak arrived later: see N2 (T-242). |
| Issue 8: labor and military lists at scale | U-01, U-06 | fixed | fixed | Observed: the labor manager shows full vertical names and a priority row (shot 17a); one squad shows under its header (shot 13a). The sidebar Labors grid still has `An An Br Bu` headers (shot 16a), but it now points to the manager. Row scrolling with 40+ dwarves not observed (7 dwarves). |
| Issue 9: sealed hostiles counted | U-01 `a8e0a26` | fixed | fixed | Observed: no `!n` on Day 1; Threats says "Active: none" (shots 05, 05b). |
| Issue 10: truncation and glyphs | U-01, U-08 | partly | partly | Observed: `•` draws for makeable recipes (shot 10a); hovering a clipped cell shows its full text (shot 15i). **Remaining:** the trade header still reads `priOur goods at the depot` and `their valua` (shot 18f, [`trade-header.png`](../screenshots/t-111/trade-header.png)); the embark header shows `[p]` with no label, `reroll (25 ☼` is cut, and `Left 236` shows as `Left 23` (shots 04, 04f). → T-244 |

### Quick recommendations

| Item | Task / commit | Draft | Now | How checked, and what remains |
|---|---|---|---|---|
| Q1 Balanced, unsafe-loadout warning | U-01 `0b124b1` | partly | partly | Observed: Balanced and the pick warning (shots 04, 04g). Code: only pick, food and drink are checked (`src/ui/screens/embark.ts:256`); D-U3 left out the axe the audit asked for. → T-252 |
| Q2 order count keys | U-03 `42b1f7a` | fixed | fixed | Observed: shots 10g, 10h (count keys); `Shift+N` new order (shot 10b). |
| Q3 friendly names and settings | U-01 | fixed | fixed | Observed: shots 10a, 14c, 17b, 18b. |
| Q4 named input and blocked summary | U-01 | fixed | fixed | Observed: shot 11e. |
| Q5 rejections logged, 4 s | U-01 `0d7199b` | fixed | fixed | Observed: `! Refused: something is already b…` in Log, All and Alerts (shots 20a, 20b). A side effect is new finding N3 (T-243). |
| Q6 silent no-ops | U-01 `cc8c064` | fixed | fixed | Observed: empty dig drag (shot 07d), zero-qualify zone (shot 08c), trade without caravan "No caravan is at the depot. Caravans come: Hillfolk in summer, …" (shot 18c), offer and gift with nothing chosen "Choose goods to offer." (shots 18g, 18h). |
| Q7 aliases and build rows | U-01 `a8e0a26` | fixed | fixed | Observed: names first, content names for inputs, `»` where cut (shots 09b, 11). |
| Q8 visible-hostile counter | U-01 `a8e0a26` | fixed | fixed | Observed: shot 05. |
| Q9 Harvest | U-01 `a8e0a26` | fixed | fixed | Observed: `h` in Designate arms "Harvest · priority 5" (shot 16d). |
| Q10 paused speed, save menu, browser keys | U-01 `0b124b1` | fixed | fixed | Observed: `-` and `=` while paused stay paused and say "Paused · speed on resume: 2x" (shots 14a, 14b); `Ctrl+S` opens the game menu with Save selected (shot 14d). |
| Q11 seed field | U-01 `0b124b1` | fixed | fixed | Observed: the focused field shows `[Enter] done · [g] Generate`; `g` in an untouched field generates (shots 02, 02c); after an edit `g` types (shot 02d), as the hint says. |
| Q12 fuel and farm hints | U-01 `a8e0a26` | fixed | fixed | Observed: a farm drag on rock shows "☼ Farms need soil, mud left by water, or cave loam." (shot 19a). The fuel hint was not exercised; draft. |
| Q13 list heights | U-01 `a8e0a26` | fixed | fixed | Observed: shot 13a. |
| Q14 grouped Help | U-01 `a8e0a26` | fixed | fixed | Observed: panel keys first, `←→↑↓` and `1-9` grouped (shot 14e). Rows are still clipped at 36 columns; hover shows them. |

### Medium recommendations

| Item | Task / commit | Draft | Now | How checked, and what remains |
|---|---|---|---|---|
| M1 immediate paused input | U-02 `fac58ce` | fixed | **partly** | Same as Issue 2: commands apply at once; the stockpile record does not exist until the tick (shot 08g0). → T-240 |
| M2 order picker | U-03 `42b1f7a` | fixed | fixed | Observed: grouped picker with Find, quantity, mode, material, Where (shots 10b–10d); status per order (shots 10e, 10j). |
| M3 panel precedence, confirmations | U-03 `42b1f7a` | fixed | fixed | Observed: shot 15a, 15b. |
| M4 building panel | U-05 `3b06f7b` | fixed | fixed | Observed: a built bed's panel shows owner `[w]`, take apart, and an explanation (shot 19b). Door modes and lever links not exercised; draft. |
| M5 labor manager | U-06 `9d92c17` | fixed | fixed | Observed: shot 17a. |
| M6 drag placement, order prompt | U-04 `5d9759f` | fixed | fixed | Observed: a drag places `Table x5` (shot 11c); for cabinets with a carpenter built, "0 cabinets in stock: 3 will wait · [o] order 3", and `o` opens the picker with quantity 3, which `Enter` turns into `x3 Cabinet · queued` (shots 19c–19e2). |
| M7 stockpile editor | U-07 `0e875a7` | fixed | fixed | Observed: `Shift+P` opens the preset list, `w` jumps to Wood, `Enter` applies it; arrows and `Space` toggle the tree; `Shift+Q` and `→` set barrels to 1 (shots 08h–08m). Its preset list has new defects: N2 (T-242). |
| M8 tooltips | U-08 `42c623d` | fixed | fixed | Observed: hovering `[S-j] Down stai` shows `[[S-j] Down stairs]` (shot 15i). |
| M9 room diagnostics, owner | U-07 `0e875a7` | fixed | fixed | Observed: "Needs a bed", "Not enclosed: 16 open border tile[s]", `[S-o] owner` answering "This bedroom needs a built bed before it can have an owner." (shots 12e, 12g). |
| M10 unit marks, mood, title, rename | U-06 `9d92c17` | fixed | fixed | Observed: `☺` after names, `Space` marks, `[S-t] title  [S-n] rename` (shots 15e, 15f, 16c). |
| M11 squad marks, leader, barracks | U-06 `9d92c17` | fixed | fixed | Observed: mark three, `Enter` adds them (shots 13b–13d); `[S-b]` without a barracks says to make one (shot 13e). |
| M12 palette and ghosts | U-08 `42c623d` | fixed | fixed | Observed: bright red ghost with `x` glyphs on rock, green `▒` on floor (shots 09d, 09e). Palette distances: draft. |

### Spec recommendations

| Item | Task / commit | Draft | Now | How checked |
|---|---|---|---|---|
| S1 Balanced and warning | U-01 `0b124b1` | fixed | fixed | Observed (shots 04, 04g); spec `docs/04-implementation/ui-screens/embark.md:107`. |
| S2 paused command phase | U-02 `fac58ce` | fixed | fixed | Code: `docs/01-architecture/simulation-core.md:127-128`. The spec rule exists; its consequence for stockpiles is T-240. |
| S3 Add order wireframe | U-03 `42b1f7a` | fixed | fixed | Code: `docs/04-implementation/ui-screens/panels.md:188-212`. |
| S4 reserved panel letters | U-03 `42b1f7a` | fixed | fixed | Observed: `[S-x]` captions throughout (shots 06, 08, 13a). |
| S5 stockpile removal default No | U-01 `0b124b1` | fixed | fixed | Draft. |
| S6 discovered/spotted hostiles | U-01 `a8e0a26` | fixed | fixed | Observed (shot 05); spec `fortress-screen.md:29`. |
| S7 named input | U-01 | fixed | fixed | Observed (shot 11e); spec `docs/02-systems/11-jobs-and-labor.md:187`. |
| S8 rejection log | U-01 `0d7199b` | fixed | fixed | Observed (shots 20a, 20b); spec `docs/02-systems/24-ui-and-input.md:101`. |
| S9 drag placement | U-04 `5d9759f` | fixed | fixed | Observed (shot 11c); spec `fortress-screen.md:133`. |

### Errors and warnings (§ 4)

| Item | Task / commit | Draft | Now | How checked, and what remains |
|---|---|---|---|---|
| 4.1 command rejections | U-01, U-02 | partly | partly | Observed: the occupied footprint says "Refused: something is already built here" (shot 09i); the door rule is repeated, "No Door placed: every tile is blocked (3): needs walls on two opposite sides" (shot 19d). Code: the generic fallback `reject.precondition_failed` "that cannot be done here" remains (`src/ui/strings.ts:777`); Undo after work began says "work has begun there, so those designations are kept" with no count (`src/ui/strings.ts:808`). → T-250 |
| 4.2 silent no-ops | U-01 | fixed | fixed | Observed: shots 07d, 08c, 12b, 18c, 18g. |
| 4.3 job and workshop blocks | U-01, U-03 | partly | partly | Observed: the reasons are named (shots 10j, 11e). Observed: three days with the carpenter "waiting for log" left no idle line in the Log (shots 10j, 10k). Code: `WorkshopBlocked` is announced only for `no_magma` (`src/systems/workshops/index.ts:40`). → T-250 |
| 4.4 room, zone, stockpile state | U-07, U-01 | partly | partly | Observed: room diagnostics (shot 12e). Code: "A farm plot has no {species} seeds." still has no plot number (`src/ui/strings.ts:962`). → T-250 |
| 4.5 announcements | U-01 `cc8c064` | fixed | fixed | Observed: the save message (shot 14c). Immigration and reputation lines not exercised; draft. |
| 4.6 dead and missing hints | U-01, T-177 | partly | partly | Observed: the farm hint fires (shot 19a). Code: the idle-hauler hint now exists (`src/ui/hints.ts:95`, T-177 `1ee4263`); no hint for "no one has mining enabled" or "jobs are blocked: no path" (no such text in `src/content/hints.json` or `src/ui`). → T-250 |

### Clarity and layout (§ 5)

| Item | Task / commit | Draft | Now | How checked, and what remains |
|---|---|---|---|---|
| 5.1 hierarchy, truncation | U-01, U-08 | partly | partly | Observed: the hotkey strip still ends at `[s] stocks`, with Military, Labors and Orders missing (shot 05), and ends mid-entry `[s]` when the tile summary is shown (shot 18d); with a caravan at the depot there is no `$` field (shot 18d); Units still shows `No jo` (shot 15e). Tooltips cover clipped panel cells (shot 15i). → T-244 |
| 5.2 glyphs and colours | U-01, U-08 | partly | partly | Observed: a zone drag colours qualifying tiles green and the rest red without changing the glyph, and a room's open border is red background only (shots 12a, 12c, 12e; [`zone-colour-only.png`](../screenshots/t-111/zone-colour-only.png)). Code: `src/ui/screens/fortress.ts:482-500`. → T-245 |
| 5.3 keys, help, discoverability | U-01, U-03 | partly | partly | Observed: following the old habit `d` `d`, the second `d` closes Designate, and the next drag becomes an item selection offering `[S-d] dump` (shots 06b, 06c). D-U2 kept "the open panel's own key closes it". → T-252 |
| 5.4 missing command UI | U-01, U-05, U-06, U-07 | partly | partly | As Issue 5. → T-246 |
| 5.5 empty states, confirmations | U-01, U-03 | fixed | **partly** | Observed: Orders "No work orders. [S-n] adds one, or click a workshop on the map." (shot 19f) and Military "No squads yet: [+] makes one." (shot 13). **Jobs with no jobs shows only its header** (shot 11d). Code: the line is drawn at `src/ui/panels/jobs.ts:110`, then the table's list blanks the same row (`src/ui/widgets/list.ts:38`). → T-241 |

### Repetitive tasks (local ids R1–R14, the audit's § 3 rows in order)

| Item | Task / commit | Draft | Now | How checked, and what remains |
|---|---|---|---|---|
| R1 craft five | U-03 | fixed | fixed | Observed: shots 10b–10e. |
| R2 make ten beds | U-03 | fixed | fixed | Observed: the same picker; mode toggle present (shot 10d). |
| R3 repeat an order | U-03 | fixed | fixed | Observed: `[r] repeat` on the order row (shot 10e); "Recent" not exercised. |
| R4 build five doors or beds | U-04 | fixed | fixed | Observed: shots 11b, 11c, 19c–19e2. |
| R5 several rooms | U-07, U-01 | fixed | fixed | Observed: shots 12b, 12g. |
| R6 configure a stockpile | U-07 | fixed | fixed | Observed: shots 08h–08m. |
| R7 mass labors | U-06, U-01 | fixed | fixed | Observed: shot 17a (templates `[t]`, marks, whole row and column). |
| R8 labor priority | U-06 | fixed | fixed | Observed: the priority row in the manager (shot 17a). |
| R9 six squad members | U-06 | fixed | fixed | Observed: shots 13b–13d. |
| R10 multi-select units | U-06 | fixed | fixed | Observed: shot 15f. |
| R11 undo stack | none (pre-existing `c38d1d8`) | open | open | Observed: two dig batches, `Ctrl+Z` removes the second, a second `Ctrl+Z` says "Nothing to undo." and the first batch stays (shot 15h). Code: `src/ui/panels/designate.ts:97,163-174` keeps one batch. → T-249 |
| R12 breeding cap | none | open | open | Observed: `Shift+C` raises the cap 12 → 13 → 15; `-` does nothing (run p16). Code: `src/ui/panels/animals.ts:58` adds one modulo 101. → T-249 |
| R13 forbid or dump selection | U-03 | fixed | fixed | Observed: the selection row offers `[S-f] forbid  [S-d] dump  [S-t] to depot` (shot 06c). |
| R14 trade quantities | pre-existing `4b8ef2f` | fixed | fixed | Observed: `[+]/[-] quantity` per row (shot 18f). Merchant goods are not stacked (one row per item); see N6 (T-251). |

### Spec mismatches (local ids 7.1–7.19, the audit's § 7 rows in order)

| Item | Task / commit | Draft | Now | How checked, and what remains |
|---|---|---|---|---|
| 7.1 caravan `$` | none | open | open | Observed: no `$` while a caravan is at the depot (shot 18d). Code: `src/ui/status.ts:37-56` has no caravan field. → T-244 |
| 7.2 unit mood, title, rename | U-06 | fixed | fixed | Observed: shot 16c. |
| 7.3 Jobs filters, named reasons | U-01 | partly | partly | Observed: named reasons (shot 11e); no `/filter` row and no labor or state filter (shot 11e). → T-241 |
| 7.4 labor priority, blocked breakdown | U-06, U-01 | fixed | fixed | Observed: shots 11e, 17a. |
| 7.5 order waiting status | U-03, U-01 | fixed | fixed | Observed: shot 10j. |
| 7.6 workshop recipe grouping | U-03, U-01 | partly | partly | Observed: the workshop panel lists 27 recipes flat and alphabetical (shot 10a), while the picker groups them (shot 10b). → T-248 |
| 7.7 selected order count | U-03 | fixed | fixed | Observed: shots 10g, 10h. |
| 7.8 stockpile fields and links | U-07 | partly | partly | Observed: `Links: none` with no way to add one (shot 08j). Code: no `LinkStockpile` emitter in `src/ui`. → T-247 |
| 7.9 military gear dropdown | U-01, U-06 | partly | partly | Observed: `[w] weapon any`, `[g] armor any` (shot 13a). Code: the weapon cycles through a fixed list (`src/ui/panels/military.ts:144-150`). → T-248 |
| 7.10 animal training | U-01 (placeholders removed) | open | open | Observed: no train action in Animals (shot 16b). → T-246 |
| 7.11 Harvest | U-01 | fixed | fixed | Observed: shot 16d. |
| 7.12 building panel | U-05 | fixed | fixed | Observed: shot 19b, and the planned-building panel with priority and cancel (shot 09k). |
| 7.13 `Ctrl+S` | U-01 | fixed | fixed | Observed: shot 14d. |
| 7.14 tooltips, input parity | U-08, U-07, U-06 | fixed | fixed | Observed: shots 15i, 08h–08m, 17a. |
| 7.15 colour-only state | U-01, U-08 | partly | partly | As 5.2. → T-245 |
| 7.16 Load thumbnails | pre-existing `542e51b` | fixed | fixed | Observed: the Load list draws a map thumbnail under the save (shot 19g). |
| 7.17 keybinding labels | U-01, T-121 | fixed | fixed | Observed: shot 17b. |
| 7.18 fuel and farm hints | U-01 | fixed | fixed | Observed for farm (shot 19a); fuel: draft. |
| 7.19 global job hints | T-177 `1ee4263` (hauler only) | open | **partly** | Code: hauler hint at `src/ui/hints.ts:95`; the mining and no-path hints of `docs/02-systems/11-jobs-and-labor.md:191` have no emitter. → T-250 |

**Totals:** fixed 65, partly 20, open 4 (89 items). Draft: 68, 16, 5.

## 2. A new player's first 20 minutes, again

The same route as the first audit, on this build. "Then" is the first audit; "now" is what I saw.

**Main menu** (shot 01). Unchanged and clean. `[a] About` is still dim and does nothing.

**World generation** (shots 02–02e). Fixed. The focused seed field now shows `[Enter] done · [g] Generate`. Pressing `g` before editing generates; after typing, `g` types, as the hint says. Still nothing explains what size does or why the seed matters.

**World map** (shot 03). Unchanged. `Wealth ▓▓░░░ 2 · Peril 0 · Temper 3` still has no explanation.

**Embark** (shots 04–04h). The trap is gone. The screen opens with Balanced (`Spent 1,480`). Removing both picks and pressing `Enter` asks "Embark without a pick?", and `Enter` answers No. Still wrong at 1280×800: the `[p]` Presets button has no label, `[r] reroll (25 ☼` is cut off, and with 236 left the footer reads `Left 23`. The confirmation draws on a black screen, so the player loses sight of the supplies while answering.

**Arrival** (shots 05, 05b). Fixed: no red `!12`; Threats says "Active: none". The first hint is shown. The hotkey strip still ends at `[s] stocks`.

**Dig** (shots 06–07h). Mostly fixed. One `d` opens Designate with Dig already armed, so one key is enough. A drag on rock shows the blue designation at once, while paused. A drag on floor says "No tile here can be dug: dig marks rock walls and boulders." Two things still go wrong:
- A player who presses `d` twice, as the old game taught, closes Designate with the second press. The next drag then makes an item selection with `[S-f] forbid  [S-d] dump  [S-t] to depot` (shots 06b, 06c). (5.3, T-252.)
- The refusal stays on the status row for 4 seconds, and it hides the live readout of the next drag. A good drag on rock right after a refused one still reads "No tile here can be dug" while dragging and after release (shots 07e, 07f). (N3, T-243.)
- `Ctrl+Z` still undoes only the last batch (shot 15h; R11).

**Stockpile** (shots 08–08m). Partly fixed. `z`, `Shift+S`, drag works; a drag on rock says "Stockpile: 0 of 9 tiles qualify: it needs walkable floor that no other zone hol" (cut at 80 columns). The editor now has a real keyboard path. But:
- **While paused, the new stockpile cannot be set up.** Clicking it says "That zone is no longer available." Only after the game runs a moment does the editor appear (shots 08g0, 08g). Since the game starts paused, every new player meets this. (Issue 2, M1, T-240.)
- A new stockpile starts as `Preset [Custom ▼]` with nothing ticked, so it takes nothing until the player picks.
- The preset list shows a raw string key, `ui.stockpile.preset.hospi…`, as its last row, and its letter captions collide: `[S-f]` Food and Furniture, `[S-s]` Seeds and Stone, `[w]` Wood and Weapons, three `[S-c]` ([`stockpile-presets.png`](../screenshots/t-111/stockpile-presets.png)). (N2, T-242.)

**Workshop** (shots 09–09k). Mostly fixed. The build list puts names first and uses content names (`2 logs`, `3 stones`), cut with `»`. Bowyer's is still preselected. The blocked ghost is a bright red `x` pattern, easy to see. A click while paused places the workshop at once. Still wrong: right after the click the ghost over the new building turns red and the status row says "blocked: something is built here", so success still reads as failure (shot 09f). (N7, T-251.)

**Craft** (shots 10a–10k). Fixed. The panel is titled `Carpenter's workshop #1`, recipes show `•`. `Shift+N`, type `door`, `Tab`, `5`, `Enter` makes one `x5 Door` order and says so. `-` and `=` change the count and do not touch the speed. Later the row reads `x3 Door · waiting for log (0)`. Still wrong: the workshop's own recipe list is one flat list of 27 (7.6), and nothing in the Log says that the workshop has gone idle for want of logs (4.3).

**Build furniture** (shots 11–11f, 19c–19e2). Fixed. Dragging a row of five tables places them all and says "Table x5 placed · 1 tables in stock: 4 will wait · build a carpenter's workshop, a for…" (grammar "1 tables", and the line is cut). With a carpenter built, "0 cabinets in stock: 3 will wait · [o] order 3", and `o` opens the picker with 3 filled in. Jobs then says `Blocked: 4 missing items` and `waiting: 1 t…`. Still wrong in Jobs: the job column reads `Build (28,25,z37` where the wireframe says `Build bed`; with no jobs the panel shows only its header (shot 11d); the `/filter` row is missing; and its labor priority row reads `Anim 5 Anim 5 Brew 5`. (T-241.)

**Bedrooms** (shots 12a–12h). Fixed. A drag on rock says the rule; on floor the room says "Needs a bed", "Not enclosed: 16 open border tile[s]", and the owner key explains that a bed must be built first. Still wrong: qualification and the open border are shown by background colour alone ([`zone-colour-only.png`](../screenshots/t-111/zone-colour-only.png); 5.2, T-245).

**Military and alert** (shots 13–13f). Fixed. With no squad the panel says "No squads yet: [+] makes one."; the new squad shows under its header; `Shift+A`, `Space` three times, `Enter` adds three dwarves at once; `[S-b]` without a barracks says to make one. Gear still cycles (`[w] weapon any`, 7.9).

**Saving** (shots 14c, 14d, 19g). Fixed. `F5` says "Saved Wolfhall, Day 1 of Spring, Year 1."; `Ctrl+S` opens the game menu on Save; Load shows a thumbnail.

**Trade** (shots 18b–18h; the flat-test start). `[S-t]` without a caravan names when caravans come. With a caravan there, `[S-t]` while paused gives no message at all, and the depot panel loses its action row until time runs. The session header still reads `priOur goods at the depot` and `their valua`, and each merchant item has its own row, so twelve rows say `1 pine cage`. (Issue 10, T-244; N6, T-251.)

## 3. New findings

These are not in the first audit's list. Each has a row.

| # | Finding | How established | Row |
|---|---|---|---|
| N1 | A stockpile made while paused has no editor until time runs ("That zone is no longer available."). | Observed: shots 08g0, 08g. Code: `src/systems/items/index.ts:286-296`, `src/ui/panels/stockpile-editor.ts:186-188`. | T-240 |
| N2 | The stockpile preset list shows the raw key `ui.stockpile.preset.hospital`, and its accelerator captions collide. D-U4 says no raw key ever reaches the screen. | Observed: shot 08h. Code: the `hospital` preset (`src/systems/items/stockpiles.ts:91`) has no string (`src/ui/strings.ts:331-343`), and `presetOptions` builds the key for every preset (`src/ui/panels/stockpile-editor.ts:44-46`). | T-242 |
| N2b | Unnamed creatures start log lines in lower case with their species id: "dog has died.", "! cat has lost a limb." The Stocks panel lists categories by id (`food`, `bar`); Animals lists `dog` under Species. | Observed: shots 10k, 15a, 15c. | T-242 |
| N3 | A status notice (4 s) hides the live readout of the next drag and the result of the next action. Long notices are cut at 80 columns. "1 tables in stock". | Observed: shots 07e, 07f, 08c, 08d, 11b, 18c. | T-243 |
| N4 | Jobs shows no empty-state line, and names build jobs by coordinates. | Observed: shots 11d, 11e. Code: `src/ui/panels/jobs.ts:65-72,110`. | T-241 |
| N5 | Embark at 1280×800: `[p]` with no label, `reroll (25 ☼` cut, `Left 236` drawn as `Left 23`. | Observed: shots 04, 04f. | T-244 |
| N6 | Trade: merchant goods are one row per item; a paused `[S-t]` says nothing. | Observed: shots 18e2, 18f. | T-251 |
| N7 | After a placement, the ghost over the new building turns red and says "blocked: something is built here". | Observed: shot 09f. | T-251 |

Outside the UI, and not filed here: in these runs the embark dog and cat died within four days, and in the flat-test run five of seven dwarves were dead by Day 10 of Summer. That is the wildlife problem T-196 is working on.

## 4. What I could not establish

- Labor-grid row scrolling and list behaviour with 40 or more dwarves: the runs had seven.
- Door and hatch modes, lever links, plates, traps and cages in the building panel (M4): only a bed and a planned building were opened.
- The colorblind palette and the CIEDE2000 checks (M12): not inspected by eye; the draft's code reading stands.
- Immigration, reputation and load-failure announcements (4.5), the fuel hint (Q12, 7.18), and stockpile removal's default No (S5): not triggered in play.
- Whether the Add-order picker, opened from the out-of-stock offer, shows the preset recipe on screen: the list was scrolled and the selected row was not visible in the dump (shot 19e). The order it added was right.
