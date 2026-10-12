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
│ Day 12 of Summer, Year 2   ☼ clear 21°C   ☺ 23   ♥ Content   +1   $   z 31   ►► 2×                       [?] help     │
│ Granite wall, smoothed · 14°C · [d] dig  [b] build  [z] zones  [o] orders  [m] military  [l] labors  [u] units  [j] jobs  [s] stocks  [k] look│
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Status row 1 fields left to right: date (a click on it opens the calendar panel, which has no hotkey); weather glyph, word and temperature (`{glyph} {word} {temp}°C`; the moon `C` replaces the sun on a clear night; the glyph is red in a heatwave, cyan in a cold snap and dim in fog); `☺` population; `♥` hall spirit tier (colored); `+n` patients (red, hidden when 0); `!n` hostiles on discovered tiles or spotted, matching the threats panel's "Active" (red, hidden when 0); `$` while a caravan is arriving, at the depot or leaving (hidden otherwise); `z` current level; speed glyphs and multiplier (`║` when paused, yellow when the simulation lags); `[?] help` at the right edge.

Status row 2: the tile summary under the mouse (or the cursor), then as many complete hotkey entries as fit, in order `[d] dig  [b] build  [z] zones  [o] orders  [m] military  [l] labors  [u] units  [j] jobs  [s] stocks  [k] look`; omit a trailing entry that does not fit, never clip its key or caption. The tile summary keeps its place on the left; with a tool active it shows the tool name, the priority, the rectangle size while dragging, and `[Esc] cancel`. A notice or refusal reason takes the row for `STATUS_HINT_SECONDS` or until replaced earlier by starting a drag, a new ghost state or a new notice. Other status row text that does not fit ends with `…` and registers its full text as a tooltip on the row, like any clipped label.

The log strip shows the last three announcements; danger lines are prefixed `!!`, alerts `!`.

## Sidebar open (units panel)

```
├──────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────────┤
│ map viewport ({mapCols − SIDEBAR_COLS} wide)                                      │ Units                       [u]  │
│                                                                                  │ /filter: ____________             │
│                                                                                  │ Name               Prof.    Act.  │
│                                                                                  │ •Ketil Ironvein  ☺ Miner    Diggin│
│                                                                                  │ ▶Brynja Coldhamm ☺ Farmer   Eating│
│                                                                                  │  Orm Ashbrow     ☻ Carpente No job│
│                                                                                  │  …                                │
│                                                                                  │ ─────────────────────────────────│
│                                                                                  │ [Enter] inspect  [l] labors      │
│                                                                                  │ [c] center                       │
│                                                                                  │ [Space] mark  [*] all  1 marked  │
│                                                                                  │ [S-t] title  [S-n] rename        │
│                                                                                  │ [S-m] squad  sleep 22h  [[]  []] │
```

Rows: `▶` marks the cursor and `•` a marked row; the mood tier glyph follows the name (`☺` white from Fine up, `☻` yellow Unhappy, `‼` red Miserable; hovering it names the tier); activity from `dwarves.activityText`.

- **Marks**: `Space` marks the cursor's row (it does not pause while this list is open), a shift-click marks the range from the last mark, `*` marks all or none. An action applies to every marked dwarf when the cursor's row is marked, otherwise to the cursor's dwarf.
- `[S-t] title` lists the four titles with their holders (`Thane  Halvar Grimshield`, `Warden  (vacant)`). `Enter` or a click gives the title to the cursor's dwarf (`AssignTitle`), or takes it away when that dwarf holds it. A child cannot hold one, and the status row says so.
- `[S-n] rename` opens the text input with the dwarf's name (`RenameDwarf`, 1–24 characters).
- `[S-m] squad` lists the squads with their sizes; `Enter` or a click adds the selection in one `SetSquadMembers`. Children, dwarves already in a squad and those the squad has no room for are left out, and the status row says how many. With no squad it says to make one in Military.
- `Shift+L` with dwarves marked opens the labor manager ([`panels.md`](panels.md) § Labor manager) with them marked.
- `[` and `]` move the selection's sleep hour an hour earlier or later (`SetSchedule`).
- Every action row is clickable. The new keys are on `Shift`, or are not letters, because the letters are panel hotkeys.

## Inspection panel (look)

```
│ Look · (52, 31, z31)                 [k] │
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
│ Designate                          [d]  │
│ [S-d] Dig        [S-c] Channel          │
│ [S-u] Up stairs  [S-j] Down stairs      │
│ [i] Up/down      [r] Ramp               │
│ [w] Stairwell    [S-s] Smooth           │
│ [S-e] Engrave    [x] Remove construction│
│ [S-t] Chop trees [g] Gather plants      │
│ [h] Harvest      [S-f] Traffic          │
│ Priority: 5   (1–9 to change)           │
│ [Ctrl+Z] undo last  [Del] clear rect    │
│ [S-p] last batch to priority 5          │
│ ─ Drag a rectangle on the map, or      │
│   use Enter twice for corners.    │
```

`d` opens the panel with Dig chosen (`d` again closes it). The letters that open panels take `Shift` here (`panels.md`).

`[S-p]` (or a click on its row) gives the tool's priority to the tiles of the last batch that are still designated (`SetDesignationPriority`); with no batch, or no remaining designation in it, it says so.

While dragging: the rectangle is inverted on the map and the status bar reads `Dig 12×4 (48 tiles), priority 5`.

## Build tool

```
│ Build                              [b]  │
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
│ ── Ghost follows the mouse: green ok,   │
│    red blocked: "needs a floor"         │
```

Build rows put the name before abbreviated inputs. Counts in parentheses are available items. The ghost is centred on the pointer; commands use its north-west tile as origin. Placing keeps the tool active until `Esc`.

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
