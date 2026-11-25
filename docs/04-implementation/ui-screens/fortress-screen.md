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

Status row 1 fields left to right: date (a click on it, or `y`, opens the calendar panel); weather glyph, word and temperature (`{glyph} {word} {temp}°C`; the moon `C` replaces the sun on a clear night; the glyph is red in a heatwave, cyan in a cold snap and dim in fog); `☺` population; `♥` hall spirit tier (colored); `+n` patients (red, hidden when 0); `!n` hostiles on discovered tiles or spotted, matching the threats panel's "Active" (red, hidden when 0); `$` while a caravan is arriving, at the depot or leaving (hidden otherwise); `z` current level; speed glyphs and multiplier (`║` when paused, yellow when the simulation lags); `[Esc] menu  [?] help` at the right edge (`[Esc]` alone when the row is too narrow for the word, and `[?]` alone as well when it is narrower still, never a cut word).

Every field of row 1 is a button. A click on the date or the weather opens the Calendar; on `☺` Units; on `♥` Mood; on `+n` Units with the wounded first; on `!n` Threats; on `$` Civilizations; on `z` nothing. A click on the speed glyph pauses or resumes at the last speed, and a right click on it steps the speed 1× → 2× → 4× → 1× (a paused game stays paused and resumes at the new speed). Hovering `+n` shows "n wounded" and `!n` "n hostile creatures on the map". `[Esc] menu` opens the game menu and `[?] help` the Help panel.

Status row 2: as many complete hotkey entries as fit (each is a button that does what its key does), in order `[d] dig  [b] build  [z] zones  [o] orders  [m] military  [l] labors  [u] units  [j] jobs  [s] stocks  [k] look`; omit a trailing entry that does not fit, never clip its key or caption. With a tool active it shows the tool name, the priority, the rectangle size while dragging, and `[Esc] cancel`; with a selection, its size. A notice or refusal reason takes the row for `STATUS_HINT_SECONDS` or until replaced earlier by starting a drag, a new ghost state (a build ghost that appears after a notice written with none, such as a building picked after a zone's made line, is one) or a new notice. Other status row text that does not fit ends with `…` and registers its full text as a tooltip on the row, like any clipped label.

Status row 3, the hover line: the tile summary (24 § Inspection) of the tile under the mouse, or of the map cursor when the mouse is off the map, in every mode, menu and panel: `Granite wall`, `Sand floor · water 5/7 · 1 trout`, `Ketil Ironvein, Digging · 2 more here`. It is blank when there is neither. Text that does not fit ends with `…` and registers its full text as a tooltip on the row.

The log strip shows the last three announcements, leaving out the combat notes (blows and kills), which only the log's Combat tab lists; danger lines are prefixed `!!`, alerts `!`. A line that does not fit ends with `»` and has a tooltip with the whole text. A hint (the `☼` lines) that does not fit one line is wrapped over two of the strip's three lines, and is drawn in `text_value`, not in the announcements' grey.

## Sidebar open (units panel)

```
├──────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────────┤
│ map viewport ({mapCols − SIDEBAR_COLS} wide)                                      │ Units (80, 9 idle)          [x]  │
│                                                                                  │ [1] Dwarves (80)  [2] All (134)   │
│                                                                                  │ /filter: ____________             │
│                                                                                  │ Name                   Act.       │
│                                                                                  │ •Ketil Ironvein ♦    ☺ Digging    │
│                                                                                  │ ▶Ragnhild Brightvein ☺ Eating     │
│                                                                                  │  Orm Ashbrow         ☻ Idle       │
│                                                                                  │  …                                │
│                                                                                  │ ─────────────────────────────────│
│                                                                                  │ [Enter] inspect  [l] labors      │
│                                                                                  │ [c] center  [i] idle            │
│                                                                                  │ [Space] mark  [*] all  1 marked  │
│                                                                                  │ [t] title  [n] rename        │
│                                                                                  │ [m] squad  [w] hurt ■        │
│                                                                                  │ sleep 22h  [[] earlier  []] later│
```

The tab row under the title (T-678): `[1] Dwarves` is the list below, `[2] All` every creature the map draws, with its own wireframe in [`panels.md`](panels.md) § Units. Each tab is a button; `1` and `2` choose them.

Rows: `▶` marks the cursor and `•` a marked row; the mood tier glyph follows the name in its own column (`☺` white from Fine up, `☻` yellow Unhappy, `‼` red Miserable; hovering it names the tier on the status row); activity from `dwarves.activityText` in the words of 10 § Player-facing behavior, always in its column. A dwarf who holds a title has `♦` after its name. The list's tooltips (the mood tier, a row's "name, profession", and its titles after them when it holds any: "Ketil Ironvein, Miner, Thane") show on the status row only, with no box, since a box would cover the row above. The name column (the cursor mark, the name, its title mark and a blank) is as wide as the longest name listed needs, at least 14 cells, as far as the activity keeps `UNITS_ACTIVITY_MIN_COLS`; the mood glyph takes 2 (the glyph and a blank) and the activity the rest, an activity that does not fit ending with `»`. A name that does not fit its room is shortened so that two dwarves never read the same: the given name's initial and the rest (`R. Brightvein`), cut with `»` if even that does not fit, unless another dwarf listed shortens to the same (`Ragna Ironvein` and `Ragnhild Ironvein`), when the whole name is cut with `»`. The profession is not a column: hovering a row shows "name, profession" on the status row, and Look shows it too. `Enter`, or a double click on a row, inspects the dwarf: Look opens its view (24 § Inspection). A dwarf with no activity reads "Idle" (or "Idle (no shelter)", 10 § Player-facing behavior) in the dim colour. The title row reads "Units (80, 9 idle)": the number of dwarves and of idle ones.

- **Idle filter and order**: `i` shows only the idle dwarves, and the title row then reads "Units · idle (n)"; `[w]` (or a click on `[w] hurt`) puts the wounded dwarves first, in list order, and the caption reads `[w] hurt ■` while it does. Both are kept while the fortress is open and are not saved.
- **To the labors**: the labors key `l` over the Units list opens the Labors panel with its cursor on the dwarf under the Units cursor, at its first labor column; the Units filters are dropped. The key row still reads `[l] labors`.
- **Marks**: `Space` marks the cursor's row (it does not pause while this list is open), a shift-click marks the range from the last mark, `*` marks all or none. An action applies to every marked dwarf when the cursor's row is marked, otherwise to the cursor's dwarf.
- `[t] title` lists the four titles with their holders (`Thane  Halvar Grimshield`, `Warden  (vacant)`). `Enter` or a click gives the title to the cursor's dwarf (`AssignTitle`), or takes it away when that dwarf holds it; the log has a note either way ("Ketil Ironvein is now the Thane.", "Ketil Ironvein is no longer the Thane.", 10 § Registrations). A child cannot hold one, and the status row says so.
- `[n] rename` opens the text input with the dwarf's name (`RenameDwarf`, 1–24 characters).
- `[m] squad` lists the squads with their sizes; `Enter` or a click adds the selection in one `SetSquadMembers`. Children, dwarves already in a squad and those the squad has no room for are left out, and the status row says how many. With no squad it says to make one in Military.
- `[l]` opens the labor manager ([`panels.md`](panels.md) § Labor manager) with the marked dwarves marked, or on the cursor's dwarf when none is marked (D-253; `Esc`, then the labors key, opens the Labors panel).
- `[` and `]` move the selection's sleep hour an hour earlier or later (`SetSchedule`).
- Every action row is clickable. The new keys are on `Shift`, or are not letters, because the letters are panel hotkeys.

## Inspection panel (look)

Look shows a tile list, one creature's view or one item's view (24 § Inspection); the title row names what it shows. A click on a creature opens its view:

```
│ Ketil Ironvein                       [x] │
│ Miner · adult · The Hearthguard           │
│ Activity: Digging (priority 5)            │
│ At (52, 31, z31) · 1 more here            │
│ ───────────────────────────────────────── │
│ Needs                                     │
│ hunger  ▓░░░  42 thirst  ▓░░░  30         │
│ rest    ░░░░  18 social  ▓▓░░  71         │
│ comfort ▓░░░  33 purpose ░░░░  12         │
│ joy     ▓▓░░  55                          │
│ Skills                                    │
│   Mining 7 (Competent) ▓▓▓░░              │
│   Masonry 2 (Novice) ▓░░░░                │
│ Str 61 Agi 48 Tou 55 End 50 Wil 47        │
│ Wit 52 Cha 49                             │
│ Personality Stoic, Gregarious, Brave      │
│ Productivity 85%                          │
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
│ ───────────────────────────────────────── │
│ [c] center  [f] follow off                │
│ [h] here  [Bksp] back  [Tab] link         │
```

The identity, activity and `At` lines stay at the top and the keys at the foot; the sections between them scroll.

The activity line is never empty, and the tile list's row and the hover line's summary of a creature use the same words (`wolf  Asleep`, `deer, Grazing`). A dwarf's is its activity (10 § Player-facing behavior). Any other creature says what its behaviour is: `Caged` in a cage; a wild or hostile creature its state in the Units All tab's words, capitalized (`Activity: Grazing`, `Asleep`, `Hunting`, `Fleeing`, `Attacking`); a tame animal, the first that holds of `Curled up in the pets' heap`, `Starving` (a grazer at full hunger), `Waiting for the butcher` (marked for slaughter), `Following Ketil Ironvein` (its assigned dwarf) and `Keeping to Pasture #1`; and with none of these, `Wandering` while it walks and `Standing about` while it stands.

The health section lists each part on a line of its own, with a bar and its hit points, named as the creature's body plan names it (17's `health.partNames`): a dwarf's `left arm` and `right leg`, a wolf's `left foreleg` and `right hindleg`, a chicken's `left wing`, a fish's `tail` twice (its tail fills both leg slots, each with its own hit points). A slot the plan gives no part (a fish's arms, the Hollow Maw's limbs) is not listed. The `Permanent:` line names its slots the same way: `lost left foreleg`. The `At` line is read each frame, so the view stays with its creature as it walks, and the map cursor sits on it. The items it holds and wears and its friends and grudges are links, drawn in the value colour.

An animal's view (08's `creature › animal`) has, under the rule, a dim label and a value a row, in the Animals panel's words:

```
│ cow                                  [x] │
│ Activity: Keeping to Pasture #1           │
│ At (34, 31, z27)                          │
│ ───────────────────────────────────────── │
│ Species   cow                             │
│ State     tame, pregnant                  │
│ Owner     the fortress                    │
│ Pasture   Pasture #1                      │
│ Hunger    70 (very hungry)                │
│ Training  cannot be trained               │
│ Health: Blood 100%, Pain 0                │
│   Conscious                               │
│   head ▓▓▓▓▓ 45/45 hp                     │
│   torso ▓▓▓▓▓ 90/90 hp                    │
│   left foreleg ▓▓▓▓▓ 45/45 hp             │
│   right foreleg ▓▓▓▓▓ 45/45 hp            │
│   left hindleg ▓▓▓▓▓ 45/45 hp             │
│   right hindleg ▓▓▓▓▓ 45/45 hp            │
│ ───────────────────────────────────────── │
│ [c] center  [f] follow off                │
│ [h] here  [Bksp] back  [Tab] link         │
│ [p] pasture: Pasture #1                   │
```

A tame animal's rows are `Species`; `State`: `tame`, then `young`, `pregnant` and `marked for slaughter` while they hold; `Owner`: the dwarf it adopted as a pet, else `the fortress`; `With`: the dwarf it is assigned to, while it is; a grazer's `Pasture` (`none` off pasture) and `Hunger`, 08's condition as a whole number with the Animals panel's words for it (`70 (very hungry)`), in the alert colour when very hungry and the bad colour when starving; and `Training`: `in training`, `trained for war`, `trained for hunting`, `untrained`, or `cannot be trained` for a species that cannot be. A wild animal's are `Species`, `State` (`wild`, then `dangerous` for a dangerous species and `hungry` for a predator while its hunger lasts) and `Hunted` (`yes` or `no`, 09's huntable mark that the Animals panel's `[h]` turns), and a heavy sleeper has `A heavy sleeper.` under them in the dim colour. The owner, the dwarf it is with and the pasture are links. Under them come the health lines and, when it holds something, `Equipment`; an animal has no needs, skills or mood (15 gives moods to dwarves) and none of a dwarf's other lines. A value too long for its row wraps under the value column.

A tame grazer's view has a third key row, its pasture (`[p] pasture: none` off pasture). `[p]` or a click on the row opens the pasture picker in place of the sections, the animal's pasture now chosen; each pasture's verdict is what its grass will feed with the animal on it, in the alert colour when it is too small, dim otherwise (24 § Inspection):

```
│ cow                                  [x] │
│ Activity: Keeping to Pasture #1           │
│ At (34, 31, z27)                          │
│ ───────────────────────────────────────── │
│ Pasture for the cow:                      │
│   Off pasture                             │
│ ▶ Pasture #1        Feeds 0 of 6 grazers  │
│   Pasture #2        Feeds 3 of 3 grazers  │
│ [Enter] choose  [Esc] cancel              │
│ ───────────────────────────────────────── │
│ [c] center  [f] follow off                │
│ [h] here  [Bksp] back  [Tab] link         │
│ [p] pasture: Pasture #1                   │
```

`Enter` or a click on a row sends `AssignPasture` and says on the status row what it did, as the Animals panel's `[p]` does; `Esc`, `Backspace` or `[p]` close the picker. A dwarf's view, a wild animal's and a tame animal's that does not graze have no pasture row.

A click on one loose item opens the item's view:

```
│ pine bed                             [x] │
│ Furniture · common · 10 ☼                 │
│ Carried by Roald Deephelm                 │
│ At (61, 88, z27)                          │
│ ───────────────────────────────────────── │
│ Type      bed                             │
│ Material  pine                            │
│ Quality   common                          │
│ Count     1                               │
│ Value     10 ☼                            │
│ Made by   Orm Ironmantle                  │
│ Owner     no one                          │
│ Flags     reserved                        │
│ For       Install furniture, Roald Deephe»│
│ ───────────────────────────────────────── │
│ [c] center  [f] follow off                │
│ [h] here  [Bksp] back  [Tab] link         │
```

It holds the item, not a tile: its place is 13's `items.tileOf`, and the second line says how it is held (`Lying in Stockpile #2`, `Lying on the ground`, `Carried by …`, `Worn by …`, `In oak barrel, Stockpile #1`, `In Wagon #1`). The stockpile, the carrier, the container, the maker, the owner, the reserving job's worker and what a container holds (`Holds 20 bellwine`) are links. `Tab` and `Shift+Tab` focus the links in view one by one, inverted, and `Enter` opens the focused one; a click opens any. `[c]` centres the view on the thing and `[f]` follows it, keeping it inside the middle half of the map view (24 § Inspection); with follow on the foot reads `[f] follow ■ on`. A view whose thing is gone keeps its title and says how (24 § Inspection):

```
│ Roald Deephelm                       [x] │
│ Miner · adult                             │
│ Died on Day 3 of Spring, Year 3.          │
│ Roald Deephelm has been killed by a       │
│ hillfolk bandit.                          │
│ Last at (59, 87, z27)                     │
│                                           │
│ The body lies there:                      │
│ Roald Deephelm's corpse                   │
│ ───────────────────────────────────────── │
│ [c] center  [h] that tile                 │
│ [Bksp] back  [Tab] link                   │
```

A crowd, bare ground, a right click and `k` open the tile list:

```
│ Tile (43, 92, z27)                   [x] │
│ Loam floor                                │
│ ─── Here ──────────────────────────────── │
│ 1 ☺ Brida Darkfell               Drinking │
│ 2 ☺ Ulf Emberaxe                 Sleeping │
│ 3 d dog                         Following │
│   ≡ oak log                     ×5 · 15 ☼ │
│   ⌂ oak barrel                   ×1 · 6 ☼ │
│       20 bellwine                         │
│       stale, rots in 4 days               │
│ 4 ╫ Still               built · 7 inside  │
│ 5 ░ Meeting hall #1              48 tiles │
│ ─── Tile ──────────────────────────────── │
│ Water 2/7                                 │
│ Designated: dig (priority 4)              │
│ ───────────────────────────────────────── │
│ [1]-[9] open  [Enter] the first           │
```

The terrain line comes first. Under `Here` each creature the map shows, each loose item and what it holds, the building with the goods it holds on this tile, and the zone, each a row with its digit (the rows that open something; each stack a building holds opens its item view, `In Wagon #1`, with the digit after the building's), the glyph the map draws, its name and one fact at the right; under `Tile` the fluid line (`Water 5/7`, `Magma 2/7`, `Ice 5/7`; none on a dry tile), the designation and the traffic lines. A tile with nothing on it has no `Here` and no `Tile` rule: its own lines follow the terrain line. The digits number the openable rows in view; `Enter` opens the first row. The arrows move the map cursor and the list follows it.

Under each perishable item, and each item of food, a line of its own gives its rot (24 § Panels): `stale, rots in 4 days`, `fresh, not rotting here`, `keeps, never rots`; in the alert colour from the stale stage, dim before it. An item's flags (`forbidden, dump`) are a dim line under it too.

The wireframes are drawn wider than the sidebar; in the 36-column sidebar a name that does not fit ends with `»`, and a line that gives a fact wraps under itself (24 § Input model): a thought (`-1 I have not talked to anyone` / `in a while.`), a rune or channel line, a note under an item. Inspecting a creature (from Units, Mood or a log line) opens its view; a row of the list opened by its digit, `Enter` or a click, a link, and `[h]`, keep the view before for `Backspace`. So does a building's panel or a zone's settings opened from a row or a link: the panel's last row reads `[Bksp] back` while it does.

The mood prints as a whole number (`Mood: Unhappy (37)`), as the thoughts under it do (a thought whose weight rounds to 0 is not listed), and so do a body part's hit points (`torso ▓▓▓░░ 41/60 hp`), which wasting takes in fractions.

A runecaster (a creature with a `Rune`) has its rune line after the mood, in the value colour: `Rune 31/50, +0.6 an hour (iron helm -20%, iron mail shirt -20%); full tomorrow`. The regen drops trailing zeros; each worn metal piece that lowers it is named with `-METAL_RUNE_PENALTY_PERCENT%` (an ASCII minus, which the glyph set has); the end reads `full`, `full in 5 hours` (later today), `full tomorrow`, `full in 3 days`, or `never full`. A creature holding a channel with a spell has the channel line under it, in the value colour: `Channel: iron staff of embers (fine). Emberbolt: 24 ember, range 12.` (a Frostbind adds `, slows by 50% for 360 ticks`; the other spells read by their kind: `Ward: 7 armour on every part for 720 ticks, range 3.`, `Mend: closes wounds, range 4.`, `Dread: sends up to 4 running for 480 ticks, range 4.`, `Firebloom: 17 ember on the 3x3, 20 ticks after the cast, range 8.`, `Daze: stuns a captain or a big creature for 180 ticks, range 6.`, `Call: brings a stone warden for a day, 2 at a time.`). Under them, in the dim colour, a caster that carries vials or drank today has `Vials: 2 carried, 1 of 3 drunk today.`, and any creature under timed effects `Under: ward 5 (340 ticks), slowed 50% (120 ticks).` (also `healing at 200%`, `pain halved`, `venom, pain +20`, `quickened 25%`, `proof against fire`, `spots within 10 tiles`, each with its ticks). A creature in a draught's rest has `Can take a draught again in 2 days.` after it, or `… tomorrow.` in its last day. Last, in the dim colour, a caster with summons alive has `Summons: stone warden (fades in 9 hours), wisp (fades in 3 hours).`, and a summon `Called by Urist Ironvein; fades in 9 hours.`, or `Fades in 9 hours.` when it has no caster (a loose wisp, a turned shade).

A channel among the items of a tile is named with its spell's suffix (`iron staff of embers (fine)`, its count and value at the right), and a dim line under it gives the spell: `Emberbolt: 24 ember, range 12. Needs a runecaster.` An enchanted item is named with its enchantment's suffix, after the name for one that begins with "of" (`1 steel axe of embers (fine)`) and before it otherwise (`1 keen iron short sword (masterwork)`), and a dim line under it gives what it does at its tier: `+9 ember on a hit.` The stocks panel names an enchanted stack the same way (`keen iron ×1`).

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
- the activity line and the `At` line, then `Needs` and the seven needs in 10's order, two to a row where the panel holds two (one otherwise): the name, a bar of `NEED_BAR_CELLS` cells filled as the need stands of `NEED_MAX`, and the whole number, 0 being satisfied. A need is drawn in the warning colour at or above its critical threshold, in the alert colour at or above its want threshold, and in the normal colour below (10 § Needs);
- `Skills`, each known skill with its level, its tier and a bar of `SKILL_BAR_CELLS` cells filled as the experience it has toward its next level stands of what that level needs (full at `SKILL_MAX_LEVEL`);
- the seven attributes in 10's order, each a short name and its whole value (`Str 61`), as many to a row as the panel holds;
- `Personality`, the dwarf's three traits by their names in the personality table (`Personality Stoic, Gregarious, Brave`);
- `Productivity`, 10's `dwarves.productivity` as a percentage (`Productivity 85%`);
- the mood, its thoughts and the health lines;
- `Equipment`: what the creature holds, in this order: the weapon it fights with, the tool it works with, its shield, its armor from head to feet, its quiver and the ammunition of its launcher (`24 iron bolts`), each named by its material and type with its quality when that is not common, its enchantment's suffix part of its name; `Equipment none` when a dwarf holds nothing;
- `Wearing`: its clothing, body, legs, feet and over; `Wearing nothing` with none;
- `Relations`: its friends, then its grudges (`Relations friends: Brynja Coldhammer; grudges: Orm Ashbrow`), or `Relations none yet`;
- `Title`, the titles it holds in the title table's order (`Title Thane, Warden`); no line without one.

A long line wraps under its text. Another creature has the `Equipment` line when it holds something; the dwarf's other lines are a dwarf's alone. Look assigns no title and edits no labor: titles are given in the units panel (`[t] title`) and labors in the labor panel.

Either view scrolls under its pinned lines, which stay (24 § Inspection): `PageUp` and `PageDown` move it a page less one row, and the wheel over the panel three rows a notch. While rows lie above, a dim `▲` is drawn at the right edge of its first scrolled row, and while rows lie below, a dim `▼` at the right edge of its last. It starts at its top again when Look shows another creature, another item, another tile, or another view.

Sections come from the inspector registry in this order: identity, activity, needs, skills, attributes, personality, productivity, thoughts, health, equipment, relationships, title (dwarf); species, state, owner, pasture, condition, training, health, equipment (tame animal); species, state, huntable, health, equipment (wild animal); party, role, state (hostile); type, material, quality, count, value, rot, maker, owner, flags, reserving job, contents (item); type, state, mode, links, owner, workshop orders (building); type, tiles, settings, room tier with breakdown (zone).

## Designate tool

```
│ Designate                          [x]  │
│ [d] Dig        [c] Channel          │
│ [w] Stairs       [r] Ramp               │
│ [s] Smooth     [e] Engrave          │
│ [x] Remove       [t] Chop trees       │
│ [g] Gather       [h] Harvest            │
│ [f] Traffic    [q] Cut ice            │
│ [S-b] Set a fire                        │
│ Priority [-] 5 [+]   (1–9)              │
│ [Ctrl+Z] undo  [Del] clear              │
│ [p] last batch to priority 5          │
│ Click 2 corners; [<] [>] levels.        │
│ S- is Shift                             │
```

The captions are short so that none is cut at the 36-column sidebar; the tool's full name stays in the status row ("Remove construction · priority 5", "Gather plants", "Traffic (restricted)"). The footer is two whole lines ("[Ctrl+Z] undo  [Del] clear" and "Click 2 corners; [<] [>] levels.", the z-level keys named as they are bound; `Enter` sets a corner too).

`d` opens the panel with Dig chosen (`d` again closes it). The letters that open panels take `Shift` here (`panels.md`).

`[p]` (or a click on its row) gives the tool's priority to the tiles of the last batch that are still designated (`SetDesignationPriority`); with no batch, or no remaining designation in it, it says so.

After the first corner, or while dragging, the box's slice on the current level is inverted on the map and the status bar reads `Dig 12×4 (48 tiles), priority 5`, or `Dig 12×4×3 levels (144 tiles), priority 5` once the level differs from the first corner's (24 § Input model).

Stairs is the only stair tool: it chooses up, down or up/down stairs for each tile (24 § Input model). Hovering its caption shows "Stairs: click a floor for a down stair and the stair beneath it, or a wall for up/down; change level between the two clicks for a whole shaft." With the first corner set and the cursor still on it, the status bar reads `Stairs from z 12: click again, or change level ([<] [>]) for a shaft · [Esc] cancel`. A box that skipped tiles says how many and why, as every designation does: `Stairs: 14 designated, 3 skipped (2 already open, 1 under a building).`

## Build tool

```
│ Build                              [x]  │
│ [c] Constructions [f] Furniture     │
│ [w] Workshops     [m] Mechanisms    │
│ [t] Traps         [s] Special       │
│ ── Workshops ──────────────────────     │
│ ▶Carpenter's workshop   2 logs  (14)    │
│  Butcher's shop                         │
│    1 table+1 stone (0)                  │
│  Still                 barrel+stone (2) │
│  Smelter               3 stone  (31)    │
│ Material: [x] any wood ▸ oak (9)        │
│ [r] rotate                              │
│ ── Ghost at the cursor: green ok,       │
│    red blocked: "needs a floor"         │
```

A footprint on saplings or shrubs is not blocked: the status bar says what the builder will clear ("Door · clears a sapling"; a drag counts them, "clears 3 plants"). A grown tree blocks, and the status bar says to chop it first.

A workshop that may be built of blocks (a loom, a tannery: 14 § Placement, Workshops of stone) has `blocks` last in its material choice, and its `[r] rotate` line reads `Of logs: 2 logs, 200 ticks` or `Of blocks: 4 blocks, 300 ticks` for the choice made. The category captions are two columns, the first as wide as its longest caption (`[c] Constructions`) while the second still holds its own, so no category is cut. Build rows put the name before the inputs and their count; a row whose inputs and count do not fit beside the name wraps them under it, indented two cells, as the Workshop panel's recipes do, each input kept with its number and the count with the last input. An input with alternatives names every one of them, in the singular ("Straw pallet 3 fiber, straw or reed (14)", "Candle stand 1 block or bar (5)"); a single input reads in the plural of its count ("2 logs"). Counts in parentheses are the available units of the first input, every alternative of it counted. A category key opens its list with a row highlighted and nothing armed (status row 2: "↑↓ choose · Enter pick · Esc back"); `Enter` or a click on a row arms the building, `Backspace` returns to the list. The ghost is centred on the map cursor, which follows the pointer and which the arrows move; commands use its north-west tile as origin. `Enter` places at the cursor. While the list is open and nothing is picked, the two help rows under the list say "── ↑↓ choose, Enter picks the" and "building to place." in place of the ghost rows. Placing keeps the tool active until `Esc`. After a successful placement the ghost stays hidden while the pointer remains within the placed footprint, and status row 2 says "Carpenter's workshop placed" (the current building type), with any stock warning. A trade depot placed where some civilization's caravans cannot reach it says so in its place, and the log keeps it as an alert focused on the depot (20 § Movement step 6). A drag keeps its count and skipped-tile summary. The ghost stays hidden until the pointer leaves the footprint or another tool/type is chosen. The success text lasts until then, unless another notice replaces it; that notice does not restore the blocked ghost. A rejected placement still shows its refusal. Returning to the footprint after leaving shows the normal blocked ghost. Placement feedback is presentation state and is not saved.

Placing many (types with a 1×1 footprint, except the hearth and the well): a left drag shows one ghost per tile of the rectangle, `▒` where the tile is valid and `x` where it is blocked, and the status bar reads `Door ×5, 2 tiles blocked`. Releasing places one per valid tile and reports the skipped tiles in one message: `Door ×3 placed, 2 tiles skipped: needs walls on two opposite sides`. A floor tile over open space is valid in a drag when a tile of the same drag beside it is (14 § Constructions, A span of floor): a line or box dragged across a river from its bank plans the whole span, and its floors are placed out from the bank, each after the one that holds it. A click is a drag that stays on its tile and places one. By keyboard, `Shift+Enter` marks a corner and `Enter` at the other corner places the lot; `Esc` drops the corner first.

Out of stock: when the stock of the first input does not cover what was placed with the tool, the two help rows of the panel and the status bar say so, and `o` (the Orders key; the second row is also a button) opens "Add order" preset to the item and the count:

```
│ 0 doors in stock: 5 will wait           │
│ [o] order 5                             │
```

The count records units of the first input not covered at each placement; placements on the same paused tick add up, and the waiting count is buildings waiting for those units. It clears on choosing another type, leaving the tool or taking the offer, and is not saved. The offered item is the first input alternative a recipe makes at a built workshop; Orders opens on that recipe with the waiting quantity. When no built workshop makes the item, the second row names what to build (`build a carpenter's workshop to make them`) and `o` opens Orders as usual. The stock line names the input as the build row does, every alternative counted ("0 fiber, straw or reed in stock: 1 will wait"), and for an input with alternatives the second row names the one the workshop would make (`build a farmer's workshop to make fiber`). Inputs no recipe makes (logs, raw stone) show only the stock line.

## Game menu (Esc with nothing open)

```
        ┌────────────────────────┐
        │  Deepholm · Emberhall  │
        │  [r] Resume            │
        │  [S-s] Save            │
        │  [S-l] Load            │
        │  [S-o] Settings        │
        │  [S-n] Rename fortress │
        │  [S-x] Retire fortress │
        │  [S-a] Abandon fortress│
        │  [S-m] Main menu       │
        └────────────────────────┘
```

Strings: `ui.status.date`, `ui.status.pop`, `ui.panel.units.title`, `ui.tool.designate.*`, `ui.build.category.*`, `ui.menu.*`; every label above is a key.

The status bar fits 80 columns. Row 1 keeps its field order and complete numbers, reducing spaces between fields before cutting any text; the help field stays at the right edge.

Zone drag and resize previews draw qualifying tiles as `▒` on green and rejected tiles as `x` on red. A selected room's open-border tiles draw `x` on red, alongside the panel's "Not enclosed: N open border tiles" explanation. Both palettes use the same glyphs, so these states remain distinguishable without colour.
