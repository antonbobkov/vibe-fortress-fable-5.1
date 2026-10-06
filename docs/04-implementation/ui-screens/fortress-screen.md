# Wireframe: Fortress Screen

**Detail level:** W4 · **Owner:** `ui/screens/fortress` · **Depends on:** [`../../02-systems/24-ui-and-input.md`](../../02-systems/24-ui-and-input.md), [`../../03-content/ui-keymap-and-screens.md`](../../03-content/ui-keymap-and-screens.md)

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
│ Granite wall, smoothed · 14°C · [k] look  [d] dig  [b] build  [z] zones  [u] units  [j] jobs  [s] stocks  [m] military│
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Status row 1 fields left to right: date; weather glyph, word and temperature; `☺` population; `♥` hall spirit tier (colored); `+n` patients (red, hidden when 0); `!n` hostiles on discovered tiles or spotted, matching the threats panel's "Active" (red, hidden when 0); `$` caravan present (hidden otherwise); `z` current level; speed glyphs and multiplier (`║` when paused, yellow when the simulation lags); `[?] help` at the right edge.

Status row 2: the tile summary under the mouse (or the cursor), then the hotkey strip for the most used panels; with a tool active it shows the tool name, the priority, the rectangle size while dragging, and `[Esc] cancel`.

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
│ Equipment iron pick (common)              │
│ Wearing  linen tunic, trousers, boots     │
│ Relations friends: Brynja Coldhammer     │
│ Title    Thane            [t] change     │
│ Labors   [l] edit                         │
```

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
│   click two corners. Enter confirms.    │
```

`d` opens the panel with Dig chosen (`d` again closes it). The letters that open panels take `Shift` here (`panels.md`).

`[S-p]` (or a click on its row) gives the tool's priority to the tiles of the last batch that are still designated (`SetDesignationPriority`); with no batch it says so.

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

Counts in parentheses are available items. Placing keeps the tool active until `Esc`.

Placing many (types with a 1×1 footprint, except the hearth and the well): a left drag shows one ghost per tile of the rectangle, `▒` where the tile is valid and `x` where it is blocked, and the status bar reads `Door ×5, 2 tiles blocked`. Releasing places one per valid tile and reports the skipped tiles in one message: `Door ×3 placed, 2 tiles skipped: needs walls on two opposite sides`. A click is a drag that stays on its tile and places one. By keyboard, `Shift+Enter` marks a corner and `Enter` at the other corner places the lot; `Esc` drops the corner first.

Out of stock: when the stock of the first input does not cover what was placed with the tool, the two help rows of the panel and the status bar say so, and `o` (the Orders key; the second row is also a button) opens "Add order" preset to the item and the count:

```
│ 0 doors in stock: 5 will wait           │
│ [o] order 5                             │
```

When no built workshop makes the item, the second row names what to build (`build a carpenter's workshop to make them`) and `o` opens Orders as usual.

## Game menu (Esc with nothing open)

```
        ┌──────────────────────┐
        │  Deepholm · Emberhall│
        │  [r] Resume          │
        │  [s] Save            │
        │  [l] Load            │
        │  [o] Settings        │
        │  [x] Retire fortress │
        │  [m] Main menu       │
        └──────────────────────┘
```

Strings: `ui.status.date`, `ui.status.pop`, `ui.panel.units.title`, `ui.tool.designate.*`, `ui.build.category.*`, `ui.menu.*`; every label above is a key.
