# Wireframe: Fortress Screen

**Owner:** `ui/screens/fortress` · **Depends on:** [`../../02-systems/24-ui-and-input.md`](../../02-systems/24-ui-and-input.md), [`../../03-content/ui-keymap-and-screens.md`](../../03-content/ui-keymap-and-screens.md)

Wireframes are at 120×45 cells for illustration; the layout scales with the window. Text in `[brackets]` is an accelerator key. `{braces}` are dynamic values.

While the tutorial runs, its box covers the top left corner of the map view and its step highlights a panel title, a hotkey strip entry or a field of status row 1 ([menus-and-world.md](menus-and-world.md) § Tutorial).

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
│ [d] dig  [b] build  [z] zones  [o] orders  [m] military  [l] labors  [u] units  [j] jobs  [s] stocks  [k] look       │
│ Sand floor · water 5/7 · 1 trout                                                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Status row 1 fields left to right: date (a click on it, or `Shift+Y`, opens the calendar panel); weather glyph, word and temperature (`{glyph} {word} {temp}°C`; the moon `C` replaces the sun on a clear night; the glyph is red in a heatwave, cyan in a cold snap and dim in fog); `☺` population; `♥` hall spirit tier (colored); `+n` patients (red, hidden when 0); `!n` hostiles on discovered tiles or spotted, matching the threats panel's "Active" (red, hidden when 0); `$` while a caravan is arriving, at the depot or leaving (hidden otherwise); `z` current level; speed glyphs and multiplier (`║` when paused, yellow when the simulation lags); `[Esc] menu  [?] help` at the right edge (`[Esc]` alone when the row is too narrow for the word, and `[?]` alone as well when it is narrower still, never a cut word).

Every field of row 1 is a button. A click on the date or the weather opens the Calendar; on `☺` Units; on `♥` Mood; on `+n` Units with the wounded first; on `!n` Threats; on `$` Civilizations; on `z` nothing. A click on the speed glyph pauses or resumes at the last speed, and a right click on it steps the speed 1× → 2× → 4× → 1× (a paused game stays paused and resumes at the new speed). Hovering `+n` shows "n wounded" and `!n` "n hostile creatures on the map". `[Esc] menu` opens the game menu and `[?] help` the Help panel.

Status row 2: as many complete hotkey entries as fit (each is a button that does what its key does), in order `[d] dig  [b] build  [z] zones  [o] orders  [m] military  [l] labors  [u] units  [j] jobs  [s] stocks  [k] look`; omit a trailing entry that does not fit, never clip its key or caption. With a tool active it shows the tool name, the priority, the rectangle size while dragging, and `[Esc] cancel`; with a selection, its size. A notice or refusal reason takes the row for `STATUS_HINT_SECONDS` or until replaced earlier by starting a drag, a new ghost state (a build ghost that appears after a notice written with none, such as a building picked after a zone's made line, is one) or a new notice. Other status row text that does not fit ends with `…` and registers its full text as a tooltip on the row, like any clipped label.

Status row 3, the hover line: the tile summary (24 § Inspection) of the tile under the mouse, or of the map cursor when the mouse is off the map, in every mode, menu and panel: `Granite wall`, `Sand floor · water 5/7 · 1 trout`, `Ketil Ironvein, Digging · 2 more here`. It is blank when there is neither. Text that does not fit ends with `…` and registers its full text as a tooltip on the row.

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
│                                                                                  │ [S-m] squad                      │
│                                                                                  │ sleep 22h  [[] earlier  []] later│
```

Rows: `▶` marks the cursor and `•` a marked row; the mood tier glyph follows the name in its own column (`☺` white from Fine up, `☻` yellow Unhappy, `‼` red Miserable; hovering it names the tier on the status row); activity from `dwarves.activityText`, always in its column. The list's tooltips (the mood tier, a row's "name, profession") show on the status row only, with no box, since a box would cover the row above. In the 36-column sidebar the name column is 14 cells (the cursor mark and twelve letters of the name), the mood glyph takes 2 (the glyph and a blank) and the activity the rest (16 or more). The profession is not a column: hovering a row shows "name, profession" on the status row, and Look shows it too. `Enter`, or a double click on a row, inspects the dwarf: Look on its tile at the `Creatures` tab with its sub-tab first (24 § Inspection). A dwarf with no activity reads "Idle" in the dim colour. The title row reads "Units (80, 9 idle)": the number of dwarves and of idle ones.

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
│ Miner · adult · The Hearthguard           │
│ Activity: Digging (priority 5)            │
│ Needs                                     │
│ hunger  ▓░░░  42 thirst  ▓░░░  30         │
│ rest    ░░░░  18 social  ▓▓░░  71         │
│ comfort ▓░░░  33 purpose ░░░░  12         │
│ joy     ▓▓░░  55                          │
│ Skills                                    │
│   Mining 7 (Competent) ▓▓▓░░              │
│   Masonry 2 (Novice) ▓░░░░                │
│ Mood: Fine (58)                           │
│   +5 Had a fine meal                      │
│   +3 Slept in my decent room              │
│   -4 Saw an enemy                         │
│ Health: Blood 100%, Pain 0                │
│ Care: resting until healed.               │
│ Equipment iron spear (fine), iron pick,   │
│           iron helm                       │
│ Wearing linen tunic, linen trousers,      │
│         leather boots                     │
│ Relations friends: Brynja Coldhammer      │
│ Title Thane                               │
```

On the `Tile` tab (`[1]`, the tab the panel opens on) the terrain line comes first, then the fluid line (`Water 5/7`, `Magma 2/7`, `Ice 5/7`; none on a dry tile), the designation, traffic, building and zone lines, then `Here:` and one line for each item (`1 granite stone · 3 ☼`) and each creature (`Ketil Ironvein, Digging`) on the tile, the goods a `container` building holds there among the items:

```
│ Look · (21, 20, z32)                 [x] │
│ Tabs: [1]Tile [2]Items(1) [3]Creatures(0) │
│ Granite floor                             │
│ Water 2/7                                 │
│ Here:                                     │
│   1 granite stone · 3 ☼                   │
```

The wireframes are drawn wider than the sidebar; in the 36-column sidebar the tabs line reads `[1]Tile [2]Items 3 [3]Who 1`, the short form 24 § Inspection gives for a line that does not fit. Inspecting a creature (from Units, Mood or a log line) opens the `Creatures` tab with its sub-tab first.

The mood prints as a whole number (`Mood: Unhappy (37)`), as the thoughts under it do, and so do a body part's hit points (`torso ▓▓▓░░ 41/60 hp`), which wasting takes in fractions.

A runecaster (a creature with a `Rune`) has its rune line after the mood, in the value colour: `Rune 31/50, +0.6 an hour (iron helm -20%, iron mail shirt -20%); full tomorrow`. The regen drops trailing zeros; each worn metal piece that lowers it is named with `-METAL_RUNE_PENALTY_PERCENT%` (an ASCII minus, which the glyph set has); the end reads `full`, `full in 5 hours` (later today), `full tomorrow`, `full in 3 days`, or `never full`. A creature holding a channel with a spell has the channel line under it, in the value colour: `Channel: iron staff of embers (fine). Emberbolt: 24 ember, range 12.` (a Frostbind adds `, slows by 50% for 360 ticks`; the other spells read by their kind: `Ward: 7 armour on every part for 720 ticks, range 3.`, `Mend: closes wounds, range 4.`, `Dread: sends up to 4 running for 480 ticks, range 4.`, `Firebloom: 17 ember on the 3x3, 20 ticks after the cast, range 8.`, `Daze: stuns a captain or a big creature for 180 ticks, range 6.`, `Call: brings a stone warden for a day, 2 at a time.`). Under them, in the dim colour, a caster that carries vials or drank today has `Vials: 2 carried, 1 of 3 drunk today.`, and any creature under timed effects `Under: ward 5 (340 ticks), slowed 50% (120 ticks).` (also `healing at 200%`, `pain halved`, `venom, pain +20`, `quickened 25%`, `proof against fire`, `spots within 10 tiles`, each with its ticks). A creature in a draught's rest has `Can take a draught again in 2 days.` after it, or `… tomorrow.` in its last day. Last, in the dim colour, a caster with summons alive has `Summons: stone warden (fades in 9 hours), wisp (fades in 3 hours).`, and a summon `Called by Urist Ironvein; fades in 9 hours.`, or `Fades in 9 hours.` when it has no caster (a loose wisp, a turned shade).

A channel among the items of a tile is named with its spell's suffix (`1 iron staff of embers (fine)`, then its value and flags), and a dim line under it gives the spell: `Emberbolt: 24 ember, range 12. Needs a runecaster.` An enchanted item is named with its enchantment's suffix, after the name for one that begins with "of" (`1 steel axe of embers (fine)`) and before it otherwise (`1 keen iron short sword (masterwork)`), and a dim line under it gives what it does at its tier: `+9 ember on a hit.` The stocks panel names an enchanted stack the same way (`keen iron ×1`).

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

A dwarf's view (10's `creature › dwarf`) has, under the creature's rule:

- the identity line: the profession of the dwarf's highest skill as the units panel names it, `adult` or `child`, and the name of the squad it serves in (`Miner · adult · The Hearthguard`);
- the activity line, then `Needs` and the seven needs in 10's order, two to a row where the panel holds two (one otherwise): the name, a bar of `NEED_BAR_CELLS` cells filled as the need stands of `NEED_MAX`, and the whole number, 0 being satisfied. A need is drawn in the warning colour at or above its critical threshold, in the alert colour at or above its want threshold, and in the normal colour below (10 § Needs);
- `Skills`, each known skill with its level, its tier and a bar of `SKILL_BAR_CELLS` cells filled as the experience it has toward its next level stands of what that level needs (full at `SKILL_MAX_LEVEL`);
- the mood, its thoughts and the health lines;
- `Equipment`: what the creature holds, in this order: the weapon it fights with, the tool it works with, its shield, its armor from head to feet, its quiver and the ammunition of its launcher (`24 iron bolts`), each named by its material and type with its quality when that is not common, its enchantment's suffix part of its name; `Equipment none` when a dwarf holds nothing;
- `Wearing`: its clothing, body, legs, feet and over; `Wearing nothing` with none;
- `Relations`: its friends, then its grudges (`Relations friends: Brynja Coldhammer; grudges: Orm Ashbrow`), or `Relations none yet`;
- `Title`, the titles it holds in the title table's order (`Title Thane, Warden`); no line without one.

A long line wraps under its text. Another creature has the `Equipment` line when it holds something; the dwarf's other lines are a dwarf's alone.

Sections come from the inspector registry in this order: identity, activity, needs, skills, thoughts, health, equipment, relationships, title, labors (dwarf); species, state, owner, pasture, condition, training (animal); party, role, state (hostile); type, material, quality, count, value, rot, flags (item); type, state, mode, links, owner, workshop orders (building); type, tiles, settings, room tier with breakdown (zone).

## Designate tool

```
│ Designate                          [x]  │
│ [S-d] Dig        [S-c] Channel          │
│ [w] Stairs       [r] Ramp               │
│ [S-s] Smooth     [S-e] Engrave          │
│ [x] Remove       [S-t] Chop trees       │
│ [g] Gather       [h] Harvest            │
│ [S-f] Traffic    [q] Cut ice            │
│ [S-b] Set a fire                        │
│ Priority [-] 5 [+]   (1–9)              │
│ [Ctrl+Z] undo  [Del] clear              │
│ [S-p] last batch to priority 5          │
│ Click 2 corners; [<] [>] levels.        │
│ S- is Shift                             │
```

The captions are short so that none is cut at the 36-column sidebar; the tool's full name stays in the status row ("Remove construction · priority 5", "Gather plants", "Traffic (restricted)"). The footer is two whole lines ("[Ctrl+Z] undo  [Del] clear" and "Click 2 corners; [<] [>] levels.", the z-level keys named as they are bound; `Enter` sets a corner too).

`d` opens the panel with Dig chosen (`d` again closes it). The letters that open panels take `Shift` here (`panels.md`).

`[S-p]` (or a click on its row) gives the tool's priority to the tiles of the last batch that are still designated (`SetDesignationPriority`); with no batch, or no remaining designation in it, it says so.

After the first corner, or while dragging, the box's slice on the current level is inverted on the map and the status bar reads `Dig 12×4 (48 tiles), priority 5`, or `Dig 12×4×3 levels (144 tiles), priority 5` once the level differs from the first corner's (24 § Input model).

Stairs is the only stair tool: it chooses up, down or up/down stairs for each tile (24 § Input model). Hovering its caption shows "Stairs: click a floor for a down stair and the stair beneath it, or a wall for up/down; change level between the two clicks for a whole shaft." With the first corner set and the cursor still on it, the status bar reads `Stairs from z 12: click again, or change level ([<] [>]) for a shaft · [Esc] cancel`. A box that skipped tiles says how many and why, as every designation does: `Stairs: 14 designated, 3 skipped (2 already open, 1 under a building).`

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

A footprint on saplings or shrubs is not blocked: the status bar says what the builder will clear ("Door · clears a sapling"; a drag counts them, "clears 3 plants"). A grown tree blocks, and the status bar says to chop it first.

A workshop that may be built of blocks (a loom, a tannery: 14 § Placement, Workshops of stone) has `blocks` last in its material choice, and its `[r] rotate` line reads `Of logs: 2 logs, 200 ticks` or `Of blocks: 4 blocks, 300 ticks` for the choice made. Build rows put the name before abbreviated inputs. Counts in parentheses are available items. A category key opens its list with a row highlighted and nothing armed (status row 2: "↑↓ choose · Enter pick · Esc back"); `Enter` or a click on a row arms the building, `Backspace` returns to the list. The ghost is centred on the map cursor, which follows the pointer and which the arrows move; commands use its north-west tile as origin. `Enter` places at the cursor. While the list is open and nothing is picked, the two help rows under the list say "── ↑↓ choose, Enter picks the" and "building to place." in place of the ghost rows. Placing keeps the tool active until `Esc`. After a successful placement the ghost stays hidden while the pointer remains within the placed footprint, and status row 2 says "Carpenter's workshop placed" (the current building type), with any stock warning. A drag keeps its count and skipped-tile summary. The ghost stays hidden until the pointer leaves the footprint or another tool/type is chosen. The success text lasts until then, unless another notice replaces it; that notice does not restore the blocked ghost. A rejected placement still shows its refusal. Returning to the footprint after leaving shows the normal blocked ghost. Placement feedback is presentation state and is not saved.

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
