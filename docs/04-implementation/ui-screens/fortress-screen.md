# Wireframe: Fortress Screen

**Owner:** `ui/screens/fortress` · **Depends on:** [`../../02-systems/24-ui-and-input.md`](../../02-systems/24-ui-and-input.md), [`../../03-content/ui-keymap-and-screens.md`](../../03-content/ui-keymap-and-screens.md)

Wireframes are at 120×45 cells for illustration; the layout scales with the window. Text in `[brackets]` is an accelerator key. `{braces}` are dynamic values.

## Sidebar closed

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒▒▒▒▒▒......▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒▒▒▒▒▒.☺....+.........▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒▒▒▒▒▒......▒▒▒▒▒▒▒▒▒.▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒.▒▒▒▒▒▒▒▒▒▒▒▒▒╥╥╥▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒.....☼....╫☺╫.▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│                          (map viewport: {mapCols} × {mapRows} cells, current z-level)                                 │
│                                                                                                                      │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Ketil Ironvein has found hematite.                                                                                   │
│ The Hillfolk caravan has arrived: 3 merchants, 4 guards, 5 mules.                                                    │
│ ! Gloam scouts have been seen at the eastern edge. They will come tomorrow.                                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Day 12 of Summer, Year 2   ☼ clear 21°C   ☺ 23   ♥ Content   +1   $   z 31   ►► 2×              [Esc] menu  [?] help     │
│ Granite wall, smoothed · 14°C · [d] dig  [b] build  [z] zones  [o] orders  [m] military  [l] labors  [u] units  [j] jobs  [s] stocks  [k] look│
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Status row 1 fields left to right: date (a click on it, or `Shift+Y`, opens the calendar panel); weather glyph, word and temperature (`{glyph} {word} {temp}°C`; the moon `C` replaces the sun on a clear night; the glyph is red in a heatwave, cyan in a cold snap and dim in fog); `☺` population; `♥` hall spirit tier (colored); `+n` patients (red, hidden when 0); `!n` hostiles on discovered tiles or spotted, matching the threats panel's "Active" (red, hidden when 0); `$` while a caravan is arriving, at the depot or leaving (hidden otherwise); `z` current level; speed glyphs and multiplier (`║` when paused, yellow when the simulation lags); `[Esc] menu  [?] help` at the right edge (`[Esc]` alone when the row is too narrow for the word, never a cut word).

Every field of row 1 is a button. A click on the date or the weather opens the Calendar; on `☺` Units; on `♥` Mood; on `+n` Units with the wounded first; on `!n` Threats; on `$` Civilizations; on `z` nothing. A click on the speed glyph pauses or resumes at the last speed, and a right click on it steps the speed 1× → 2× → 4× → 1× (a paused game stays paused and resumes at the new speed). Hovering `+n` shows "n wounded" and `!n` "n hostile creatures on the map". `[Esc] menu` opens the game menu and `[?] help` the Help panel.

Status row 2: the tile summary under the mouse (or the cursor), then as many complete hotkey entries as fit (each is a button that does what its key does), in order `[d] dig  [b] build  [z] zones  [o] orders  [m] military  [l] labors  [u] units  [j] jobs  [s] stocks  [k] look`; omit a trailing entry that does not fit, never clip its key or caption. The tile summary keeps its place on the left; with a tool active it shows the tool name, the priority, the rectangle size while dragging, and `[Esc] cancel`. A notice or refusal reason takes the row for `STATUS_HINT_SECONDS` or until replaced earlier by starting a drag, a new ghost state or a new notice. Other status row text that does not fit ends with `…` and registers its full text as a tooltip on the row, like any clipped label.

The log strip shows the last three announcements; danger lines are prefixed `!!`, alerts `!`. A line that does not fit ends with `»` and has a tooltip with the whole text. A hint (the `☼` lines) that does not fit one line is wrapped over two of the strip's three lines, and is drawn in `text_value`, not in the announcements' grey.

## Sidebar open (units panel)

```
├──────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────────┤
│ map viewport ({mapCols − SIDEBAR_COLS} wide)                                      │ Units (80, 9 idle)          [x]  │
│                                                                                  │ /filter: ____________             │
│                                                                                  │ Name           Act.               │
│                                                                                  │ •Ketil Ironve  ☺ Digging          │
│                                                                                  │ ▶Brynja Coldh  ☺ Eating           │
│                                                                                  │  Orm Ashbrow   ☻ Idle             │
│                                                                                  │  …                                │
│                                                                                  │ ─────────────────────────────────│
│                                                                                  │ [Enter] inspect  [l] labors      │
│                                                                                  │ [S-c] center [i] idle [S-w] hurt  │
│                                                                                  │ [Space] mark  [*] all  1 marked  │
│                                                                                  │ [S-t] title  [S-n] rename        │
│                                                                                  │ [S-m] squad  sleep 22h  [[]  []] │
```

Rows: `▶` marks the cursor and `•` a marked row; the mood tier glyph follows the name (`☺` white from Fine up, `☻` yellow Unhappy, `‼` red Miserable; hovering it names the tier); activity from `dwarves.activityText`. In the 36-column sidebar the name column is 14 cells (the cursor mark and twelve letters of the name), the mood glyph takes 2 (the glyph and a blank) and the activity the rest (16 or more). The profession is not a column: hovering a row shows "name, profession", and Look shows it too. A dwarf with no activity reads "Idle" in the dim colour. The title row reads "Units (80, 9 idle)": the number of dwarves and of idle ones.

- **Idle filter and order**: `i` shows only the idle dwarves, and the title row then reads "Units · idle (n)"; `Shift+W` puts the wounded dwarves first, in list order. Both are kept while the fortress is open and are not saved.
- **To the labors**: the labors key `l` over the Units list opens the Labors panel with its cursor on the dwarf under the Units cursor, at its first labor column; the Units filters are dropped. The key row still reads `[l] labors`.
- **Marks**: `Space` marks the cursor's row (it does not pause while this list is open), a shift-click marks the range from the last mark, `*` marks all or none. An action applies to every marked dwarf when the cursor's row is marked, otherwise to the cursor's dwarf.
- `[S-t] title` lists the four titles with their holders (`Thane  Halvar Grimshield`, `Warden  (vacant)`). `Enter` or a click gives the title to the cursor's dwarf (`AssignTitle`), or takes it away when that dwarf holds it. A child cannot hold one, and the status row says so.
- `[S-n] rename` opens the text input with the dwarf's name (`RenameDwarf`, 1–24 characters).
- `[S-m] squad` lists the squads with their sizes; `Enter` or a click adds the selection in one `SetSquadMembers`. Children, dwarves already in a squad and those the squad has no room for are left out, and the status row says how many. With no squad it says to make one in Military.
- `Shift+L` with dwarves marked opens the labor manager ([`panels.md`](panels.md) § Labor manager) with them marked.
- `[` and `]` move the selection's sleep hour an hour earlier or later (`SetSchedule`).
- Every action row is clickable. The new keys are on `Shift`, or are not letters, because the letters are panel hotkeys.

## Inspection panel (look)

```
│ Look · (52, 31, z31)                 [x] │
│ Tabs: [1]Tile [2]Items(3) [3]Creatures(1) │
│ ── Creature: Ketil Ironvein ────────────  │
│ Miner · adult · Fine (58)                 │
│ Activity: Digging (priority 5)            │
│ Needs   hunger ▓▓▓░░ 42  thirst ▓▓░░░ 30  │
│         rest   ▓░░░░ 18  social ▓▓▓▓░ 71  │
│ Skills  Mining 7 (Competent) ▓▓▓░░       │
│         Masonry 2 (Novice)   ▓░░░░       │
│ Thoughts  +5 Had a fine meal (1d)         │
│           +3 Slept in my decent room      │
│           −4 Saw an enemy (12h)           │
│ Health   unhurt · blood 100%              │
│ Care     resting until healed.            │
│ Equipment iron pick (common)              │
│ Wearing  linen tunic, trousers, boots     │
│ Relations friends: Brynja Coldhammer     │
│ Title    Thane            [t] change     │
│ Labors   [l] edit                         │
```

On the `Tile` tab (`[1]`, the tab the panel opens on) the terrain line comes first, then the designation, traffic, building and zone lines, then `Here:` and one line for each item (`1 granite stone · 3 ☼`) and each creature (`Ketil Ironvein, Digging`) on the tile:

```
│ Look · (21, 20, z32)                 [x] │
│ Tabs: [1]Tile [2]Items(1) [3]Creatures(0) │
│ Granite floor                             │
│ Here:                                     │
│   1 granite stone · 3 ☼                   │
```

The mood prints as a whole number (`Mood: Unhappy (37)`), as the thoughts under it do.

A dwarf who is a patient has a `Care:` line under the Health line, on top of the health details (an undiagnosed patient keeps `Health: Wounded, bleeding` and still has the line). It is the first of these that applies, and it is drawn in the alert color when the player must act (the first three, and a missing supply) and in the normal color otherwise:

1. no hospital zone exists: `Care: no hospital. Make one in Zones [z] > Hospital.`
2. the patient is not in a hospital bed and no hospital bed is free for them: `Care: no free hospital bed.`
3. no living dwarf has the `medicine` labor on: `Care: no one has Medicine enabled ([l] Labors).`
4. an unconscious patient's `carry_patient` job has no worker: `Care: waiting to be carried to the hospital.`
5. a treatment job of the patient's needs has a worker: `Care: {job} by {name}.` (`Care: diagnosis by Snorri Pinesong.`; the job words are bandaging, bone setting, suturing, wound cleaning, burn dressing, diagnosis, crutch fitting)
6. a treatment job is blocked for a missing input: `Care: needs {item} ({n} in stock).`, with the count 13 reports as available
7. otherwise, while a need remains: `Care: waiting for a medic.`
8. with no need left: `Care: resting until healed.`

The line reads 14's hospital zones and beds, 11's labor and job readers and 13's stock; it is broken at spaces to the panel width, the continuation rows indented under the text. A creature that is not a patient has no such line.

Sections come from the inspector registry in this order: identity, activity, needs, skills, thoughts, health, equipment, relationships, title, labors (dwarf); species, state, owner, pasture, condition, training (animal); party, role, state (hostile); type, material, quality, count, value, rot, flags (item); type, state, mode, links, owner, workshop orders (building); type, tiles, settings, room tier with breakdown (zone).

## Designate tool

```
│ Designate                          [x]  │
│ [S-d] Dig        [S-c] Channel          │
│ [S-u] Up stair   [S-j] Down stair       │
│ [i] Up/down      [r] Ramp               │
│ [w] Stairwell    [S-s] Smooth           │
│ [S-e] Engrave    [x] Remove             │
│ [S-t] Chop trees [g] Gather             │
│ [h] Harvest      [S-f] Traffic          │
│ Priority [-] 5 [+]   (1–9)              │
│ [Ctrl+Z] undo  [Del] clear              │
│ [S-p] last batch to priority 5          │
│ Drag, or click/Enter two corners.       │
│ S- is Shift                             │
```

The captions are short so that none is cut at the 36-column sidebar; the tool's full name stays in the status row ("Remove construction · priority 5", "Gather plants", "Traffic (restricted)"). The footer is two whole lines ("[Ctrl+Z] undo  [Del] clear" and "Drag, or click/Enter two corners.").

`d` opens the panel with Dig chosen (`d` again closes it). The letters that open panels take `Shift` here (`panels.md`).

`[S-p]` (or a click on its row) gives the tool's priority to the tiles of the last batch that are still designated (`SetDesignationPriority`); with no batch, or no remaining designation in it, it says so.

While dragging: the rectangle is inverted on the map and the status bar reads `Dig 12×4 (48 tiles), priority 5`.

## Build tool

```
│ Build                              [x]  │
│ [S-c] Constructions [S-f] Furniture     │
│ [w] Workshops       [S-m] Mechanisms    │
│ [S-t] Traps         [S-s] Special       │
│ ── Workshops ──────────────────────     │
│ ▶Carpenter's workshop   2 logs  (14)    │
│  Mason's workshop      2 stone  (31)    │
│  Still                 barrel+stone (2) │
│  Smelter               3 stone  (31)    │
│ Material: [x] any wood ▸ oak (9)        │
│ [r] rotate                              │
│ ── Ghost at the cursor: green ok,       │
│    red blocked: "needs a floor"         │
```

Build rows put the name before abbreviated inputs. Counts in parentheses are available items. A category key opens its list with a row highlighted and nothing armed (status row 2: "↑↓ choose · Enter pick · Esc back"); `Enter` or a click on a row arms the building, `Backspace` returns to the list. The ghost is centred on the map cursor, which follows the pointer and which the arrows move; commands use its north-west tile as origin. `Enter` places at the cursor. While the list is open and nothing is picked, the two help rows under the list say "── ↑↓ choose, Enter picks the" and "building to place." in place of the ghost rows. Placing keeps the tool active until `Esc`. After a successful placement the ghost stays hidden while the pointer remains within the placed footprint, and status row 2 says "Carpenter's workshop placed" (the current building type), with any stock warning. A drag keeps its count and skipped-tile summary. The ghost stays hidden until the pointer leaves the footprint or another tool/type is chosen. The success text lasts until then, unless another notice replaces it; that notice does not restore the blocked ghost. A rejected placement still shows its refusal. Returning to the footprint after leaving shows the normal blocked ghost. Placement feedback is presentation state and is not saved.

Placing many (types with a 1×1 footprint, except the hearth and the well): a left drag shows one ghost per tile of the rectangle, `▒` where the tile is valid and `x` where it is blocked, and the status bar reads `Door ×5, 2 tiles blocked`. Releasing places one per valid tile and reports the skipped tiles in one message: `Door ×3 placed, 2 tiles skipped: needs walls on two opposite sides`. A click is a drag that stays on its tile and places one. By keyboard, `Shift+Enter` marks a corner and `Enter` at the other corner places the lot; `Esc` drops the corner first.

Out of stock: when the stock of the first input does not cover what was placed with the tool, the two help rows of the panel and the status bar say so, and `o` (the Orders key; the second row is also a button) opens "Add order" preset to the item and the count:

```
│ 0 doors in stock: 5 will wait           │
│ [o] order 5                             │
```

The count records units of the first input not covered at each placement; placements on the same paused tick add up, and the waiting count is buildings waiting for those units. It clears on choosing another type, leaving the tool or taking the offer, and is not saved. The offered item is the first input alternative a recipe makes at a built workshop; Orders opens on that recipe with the waiting quantity. When no built workshop makes the item, the second row names what to build (`build a carpenter's workshop to make them`) and `o` opens Orders as usual. Inputs no recipe makes (logs, raw stone) show only the stock line.

## Game menu (Esc with nothing open)

```
        ┌──────────────────────┐
        │  Deepholm · Emberhall│
        │  [r] Resume          │
        │  [s] Save            │
        │  [l] Load            │
        │  [o] Settings        │
        │  [n] Rename fortress │
        │  [x] Retire fortress │
        │  [m] Main menu       │
        └──────────────────────┘
```

Strings: `ui.status.date`, `ui.status.pop`, `ui.panel.units.title`, `ui.tool.designate.*`, `ui.build.category.*`, `ui.menu.*`; every label above is a key.

The status bar fits 80 columns. Row 1 keeps its field order and complete numbers, reducing spaces between fields before cutting any text; the help field stays at the right edge.

Zone drag and resize previews draw qualifying tiles as `▒` on green and rejected tiles as `x` on red. A selected room's open-border tiles draw `x` on red, alongside the panel's "Not enclosed: N open border tiles" explanation. Both palettes use the same glyphs, so these states remain distinguishable without colour.
