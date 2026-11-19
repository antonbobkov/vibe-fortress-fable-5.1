# 24 UI & Input

**Owner:** `ui/`, `platform/input.ts`, `platform/audio.ts` · **Depends on:** [23-rendering.md](23-rendering.md), [`../01-architecture/module-interfaces.md`](../01-architecture/module-interfaces.md), [`../00-vision/player-experience.md`](../00-vision/player-experience.md)

## Purpose

Give the player every action by keyboard and by mouse and every fact by inspection, with a small consistent set of screens, panels and widgets drawn as text into the cell grid.

## Concepts

- **Screen**: a full-window mode on a stack: `intro`, `main_menu`, `world_gen`, `world_map`, `embark`, `fortress`, `legend`, `settings`, `load`, `trade_session` (modal over fortress), `labor_manager` (over fortress), `confirm` (modal dialog), `text_input` (modal).
- **Panel**: a sidebar view inside the fortress screen, one active at a time, registered with a hotkey.
- **Tool**: the current map interaction mode: `none` (inspect), a designation kind, a build placement, a zone type, a squad order, a selection for item commands.
- **Widget**: an immediate-mode element: `List`, `Table`, `Menu`, `Toggle`, `Number`, `Text`, `Button`, `Tabs`, `Bar`, `Tree`, `Dropdown`, `Label`, `Separator`.
- **Action**: a named UI action produced by the keymap or by a mouse gesture; panels handle actions and submit commands.
- **Announcement**: a log line with a severity produced from an event by the announcement registry.
- **Hint**: a one-time tip triggered by state.
- **Tutorial**: a scripted sequence of steps over the fortress screen of a new fortress, each with a text, a highlight of the UI and a check that reads state; it only reads and draws (`ui-screens/menus-and-world.md` § Tutorial).

## Rules

### Fortress screen layout

```
┌──────────────────────────────────────────────┬────────────────────────────────────┐
│ map viewport                                 │ sidebar (SIDEBAR_COLS wide)        │
│                                              │ title bar with panel name + hotkey │
│                                              │ panel content                      │
│                                              │                                    │
├──────────────────────────────────────────────┴────────────────────────────────────┤
│ log strip (LOG_ROWS): last announcements, newest at the bottom                    │
├───────────────────────────────────────────────────────────────────────────────────┤
│ status bar row 1: Day 12 of Spring, Year 3 · ☼ clear 14°C · ☺ 34 · hearth ♥ · z 31 · ►► 2× │
│ status bar row 2: tool and hint line, or the hotkey strip                          │
│ status bar row 3 (hover line): Sand floor · water 5/7 · 1 trout                    │
└───────────────────────────────────────────────────────────────────────────────────┘
```

The last row of the status bar is the hover line. It is always shown, whatever tool, panel, zone or selection is active, and describes the tile under the mouse, or under the map cursor when the mouse is off the map: the tile summary of § Inspection, with the fluid on the tile after the terrain or the creature. With neither a mouse tile nor a cursor the row is blank. The tool's own line stays on row 2.

The sidebar is closed until a panel is opened; `Tab` toggles it without changing the panel. In a selected stockpile's editor, `Tab` and `Shift+Tab` move between the category tree and numeric fields instead. The status bar hearth glyph is colored by hall spirit tier; a red cross with a count shows patients; `!n` shows active hostiles (those on discovered tiles that are not hidden, plus those spotted); a scale glyph shows a caravan present.

### Input model

Keyboard:

- Letters open panels and tools (the default keymap table): `d` designate, `b` build, `z` zones, `u` units, `j` jobs, `l` labors, `o` orders, `s` stocks, `m` military, `n` animals, `t` threats, `c` civilizations, `p` population, `e` mood, `a` log, `k` look, `f` overlays, `?` help.
- `Esc` cancels the current tool, then closes the panel, then opens the game menu.
- `Space` pause (in a multi-select list it marks the row; in the stockpile category tree or material checklist it toggles the checkbox instead); `+` and `-` speed (in a stockpile numeric field they adjust its value); `<` and `>` (also `,` and `.`) z-level down and up; arrow keys pan by one cell, `Shift` + arrows by ten (with the map cursor shown they move the cursor instead); `Home` centers on the hearth (or the wagon).
- Within a designation tool, two points make a box. The first click or `Enter` sets the first corner at the map cursor, and the map shows the box from it to the cursor; the second click or `Enter` sets the opposite corner and issues the designation. `Esc` drops a first corner before it drops the tool. Between the two, the z-level keys may change the level: the box then covers every level from the first corner's to the second's, the map shows its slice on the current level, and the status row gives its size (`Dig 3×4×5 levels (60 tiles), priority 5`; on one level `Dig 3×4 (12 tiles), priority 5`). One tile is two clicks on it. A drag on one level, from the first corner to the second, issues that box at once, as an alternative to the second click. The stairs tool chooses each tile's stairs itself. Over more than one level, a box is a stair column on each of its tiles: every level but the bottom must lead down, every level but the top must lead up, and an end of the column must also lead toward a stair directly beyond it (above its top, below its bottom). On each level, a `floor` that must lead only down takes down stairs, a `wall` or `floor` that must lead only up takes up stairs, and any other `wall` or `floor` takes up/down stairs; a stair that already leads every way needed is left as it is, and a stair that lacks a way takes up/down stairs (03 re-carves it); an undiscovered tile is taken as rock. A stair directly beyond an end that does not lead toward the column takes up/down stairs too. On one level, a `floor` or a stair is a column from its level to the level below (down stairs there and the stairs beneath that meet them), and a `wall` or an undiscovered tile takes up/down stairs, with a stair directly above or below it that does not lead toward it taking up/down stairs. The stair designations go as one `Designate` per stair kind. Every tool is best effort: a box designates each of its tiles that passes 03's precondition or is undiscovered, in one `Designate`, and skips the rest; a stair column skips only the tiles that cannot take their stairs. When tiles are skipped, the status row says so, with the reasons counted per tile kind (`Dig: 12 designated, 4 skipped (3 floor, 1 open space).`; for stairs, open space reads `already open` and a stair that cannot be re-carved `built stairs`; for dig, stairs and ramps, a constructed wall reads `built wall`; for stairs and channels, a constructed floor reads `built floor`, constructed stairs `built stairs` and a tile under any other building `under a building`, as does a wall under a floor that holds a building for ramps, since 03 cuts nothing under a building). A box where nothing qualifies sends nothing and says what the designation needs (`No tile here can be dug: dig marks rock walls and boulders.`). A batch some of whose tiles no dwarf can reach says so when it is made, on the status row and as a note in the log whose focus is the first such tile. The check works the batch, with every designation already made, through in thought, by 03's stand tiles and 22's edges, from the tiles that share a walker label with a fortress dwarf (so a room designated under a shaft that is designated but not yet carved is in reach): a tile is worked when a dwarf reaches one of its stand tiles, and a worked tile a dwarf can stand on is reached when a step of 22 leads into it from a reached tile, so a box dug in from one side is reached tile by tile, and one that meets the open only at a corner has its corner dug from the diagonal and nothing more (a corner is not a side: 22 cuts no corner past rock). When no tile can be worked the row ends `· no dwarf can reach it yet: open a side or a stair above.` (`Dig: 20 designated · no dwarf can reach it yet: open a side or a stair above.`); when some can, it gives how many cannot (`Dig: 20 designated · 19 out of reach: open a side (not a corner) or a stair.`). A stair column over several levels whose top tile is a ramp (which takes no stairs, so the column below it has no way in) says so in place of the count of skipped tiles: `Stairs: 5 designated · the top is a ramp: start the column on a floor beside it.` The check is presentation only: it changes no designation and no job. Within a zone tool, a click applies to one tile, a drag defines a rectangle, and two presses of `Enter` define its corners, on one level. Each press uses the map cursor. A zone made this way is selected as soon as it exists (at once while paused), and the tool idles: its inspector takes `Enter`, the arrows and the digits until the pointer is pressed on the map or the type's key again (`ui-screens/panels.md` § Zones). `1`–`9` set the priority; `Ctrl+Z` or the undo row undoes the most recent of up to `UNDO_BATCHES_MAX` designation batches, one per press, newest first. This history is presentation state, is not saved, and clears on load or leaving the fortress.
- The map cursor is a tile of the map drawn as an inverted cell. It appears when a tool is armed (designate, build, zones), when a panel asks for a tile or a creature (a zone to select, a squad station or patrol point, a kill or follow order, a link), and while the look panel is open (opened by `k` or by a click on the map). It starts at the mouse tile when the pointer is over the map, otherwise at the centre of the map view, and a cursor already shown stays where it is. While it is shown the arrow keys move it by one tile, `Shift` + arrows by ten, instead of panning the view; the view scrolls to keep the cursor at least `CURSOR_SCROLL_MARGIN` tiles from the edge of the map view, so every tile of the map can be reached with a panel open. Moving the pointer over the map, or clicking it, moves the cursor to the pointer's tile while a tool is armed or a panel asks for a tile, and a key moves it from there. The ghost and the drag count are drawn at the cursor, and the hover line describes the cursor's tile while the mouse is off the map. `Enter` acts at the cursor: the first and the second corner of a rectangle, the placing of a building, the selection of a zone, the choice of a station, a patrol point, a link, or the creature of a kill or follow order (with none there, the status row says "No creature there." or "No dwarf there."). A pick that waits for the map ends when its panel is closed or another panel is opened. Closing the tool or the panel with `Esc` hides the cursor, and `k` pressed again closes the look panel and hides it.
- Build chooses first and places second. A category key opens its list with a row highlighted and no tool armed; `↑` `↓` move the highlight and the status row reads "↑↓ choose · Enter pick · Esc back". `Enter` or a click on a row arms that building: the cursor appears, the arrows move it, `Enter` places at it. `Backspace` returns to the list and drops the tool; `Esc` leaves the list, and a further `Esc` closes the panel. A click on the map while a list is open and nothing is picked places nothing.
- `F5` quick save, `F9` quick load (with confirmation; with no quick save it says "There is no quick save to load." at once and asks nothing), `Ctrl+S` save menu, `F12` debug panel.
- Within panels: unshifted arrows move the selection before they pan the map (the labor grid also takes left/right), `Enter` activates, `Tab` moves between fields, letters in `[brackets]` are accelerators, `PageUp`/`PageDown` scroll. State-specific keys are listed in the panel documents.
- Bare panel letters always open or close their panel. Reserved letters come from the live panel bindings; colliding accelerators require Shift, shown `[S-x]`. Fixed captions use the defaults, while zone inspector captions and their Help rows follow the current panel bindings. With default bindings, the free letters are `g h i q r v w x y`; `g h i q r v w x` work with or without Shift, and `y` works bare only, because `Shift+Y` opens the Calendar. Focused text fields take letters as text. A text field takes a key event only when its `key` is a single printable character, `Space` being a space; control, format, private-use and unassigned code points (Unicode categories Cc, Cf, Co, Cn) are ignored by the field, and a character the bundled font lacks is accepted and drawn `?`. While a text or filter field has focus, `Space` types a space and never reaches the pause key. A name is trimmed and every run of spaces becomes one space; a name that is empty after that is refused with the dialog's "Type at least 1 character." line (the embark screen's "The fortress needs a name."). A panel's filter text is cleared when its panel closes or another opens.
- In the Units table and a squad's add/remove list, `Space` marks a row before it pauses; `*` marks all or none. An action uses every marked row when the cursor row is marked, otherwise just that row.
- In Orders, `=` or numpad `+` adds one, `-` subtracts one, and Shift on either physical key changes ten (main-row `+` is Shift+`=`). These take precedence over speed only while an order is selected.
- A workshop that may be built of blocks (14 § Placement, Workshops of stone) offers "of logs" and "of blocks". Its material choice (`x`, or a click on the line) runs through the logs' materials, then `blocks` with the stone blocks in stock; the line under it, where a rotatable type shows `[r] rotate`, reads "Of logs: 1 stone+1 log, 200 ticks" or "Of blocks: 1 stone+2 blocks, 300 ticks" for the choice made, and placing it sends `materialChoice: 'blocks'`.
- With a building tool that places many, `Shift+Enter` sets a corner; `Enter` or a click sets the other. Plain `Enter` places one. `Esc` clears the corner before leaving the tool.
- Every key the game reacts to is a binding of the keymap, a data table (`keymap.json`) that Settings › Keybindings edits, except the fixed keys of `ui-keymap-and-screens.md` § Fixed keys: `Esc`, which always leads back; typing in a focused text or number field; the editor's own keys; the rows that stand for every letter; the key that skips the intro; and the key that dismisses a pinned danger line. A panel's own keys are rows of the keymap too, one context per panel and per panel state that gives a key another meaning (the zone inspector, the labor manager's templates). A rebound key does what its binding does wherever that binding acts, and the default key it replaced no longer does; a key moved away from a panel's binding still reaches the global, map and panel-letter bindings that have it.

Mouse:

- Left click: with no tool, inspects the tile (opens the inspection panel); with a tool, applies it (a single tile) or starts a drag rectangle.
- Left drag: rectangle for designations, zones, selections; the rectangle is drawn live with its size in the status bar.
- Right click: cancels the current tool; with no tool, opens the inspection panel for the tile (same as left) with the context list of entities on it.
- Wheel: z-level (down = deeper). `Ctrl` + wheel: zoom. `Shift` + wheel: pan vertically.
- Middle drag (or `Space` + left drag): pan.
- Text that does not fit its cell is marked: it ends with `»` and registers a tooltip with the whole text. A panel never writes past its last column.
- Hover: the hover line, the status bar's last row, shows the tile summary ("Granite wall" / "Ketil Ironvein, Digging · water 3/7" / "Granite floor · 3 more here"), with any tool armed or panel open. Clipped labels and table cells register their full text as a tooltip, shown in the status row (one line, cut with `…` when it does not fit) and in a box `[…]` by the hovered cell. The box is one row when the text fits the window's width; a longer text wraps over as many rows as it needs, at most the map view's height, never cutting a word that fits. The box is drawn above the hovered cell when the rows above hold it, otherwise below it; when neither side holds it, it takes the side with more rows and its last row ends with `»`. The sidebar retains `SIDEBAR_COLS`.
- Edge scrolling is off by default (a setting).

A drag with no tool selects tiles as presentation state, without saving them. `Delete` undoes designations, cancels planned or constructing buildings, and removes zones wholly inside the selection after confirmation. Selection item commands use `[S-f]` forbid, `[S-d]` dump (confirm), and `[S-t]` move to depot. `Esc` clears the selection before closing the panel. Double-clicking a unit row inspects that unit (§ Inspection); double-clicking a job row centres the map on it.

Keyboard and mouse produce the same actions; there is no action reachable only one way. The keymap parity scenario checks each Keymap, Fortress panels and Mouse row against the live bindings, panel list and mouse probes.

While paused, submitted commands take effect immediately through the host's command phase, without advancing time. Designations, planned buildings and zones appear before unpausing. Rejections update the status row and alert log immediately with the command's focus. The command log stamps these inputs with the next tick to run, so replay and paused save/load preserve simulation state.

### Panels

Registered by systems through `register.panel`; the design fixes this set and their content is defined in the owning system documents:

`designate` (03), `build` (14), `zones` (14), `units` (10), `labors` (11), `jobs` (11), `orders` (12 + 11 standing orders), `stocks` (13), `military` (16), `animals` (08), `threats` (18), `civilizations` (20), `population` (21), `mood` (15), `log`, `look` (inspection), `overlays` (23), `help`, `debug`.

Panel conventions:

- Title row with the panel name and its hotkey; a filter or search field where lists are long (units, jobs, stocks, log).
- Lists show at most the visible rows with a scrollbar glyph column; selection is inverted.
- Actions available for the selected row are listed at the bottom with their accelerator letters.
- Clicking a location reference (a job target, an announcement) centers the map.
- Numbers are shown with units; percentages as `71%`; marks as `1,250 ☼`.
- Opening Designate chooses Dig when no designation tool is chosen; `[S-d]` is its Dig accelerator.
- The designation menu has `Cut ice` (`harvest_ice`, `[q]`) and `Set a fire` (`ignite`, `[S-b]`) after Traffic; their tints are dig's and remove's (`glyphs-and-colors.md` § Designation and zone tints).
- New squads use the first unused UI preset name; choosing their members is a separate action.
- Help and Debug use the global keymap bindings (`?` and `F12` by default). Debug is a sidebar panel, not a screen.
- The stockpile inspector's cellar line toggles the setting with `[S-c]` or a click (`SetStockpileCellar`) and says whether the cellar works and why not: "Cellar: off", "Cellar: working", "Cellar: lit", "Cellar: too warm (16 °C)", "Cellar: too cold (1 °C)" (13 § Aging in a cellar).
- The farm plot inspector's fertilize line toggles the plot's `fertilize` setting with `[w]` or a click (`SetZoneSetting`) and counts the fertilizer in stock (units of items tagged `fertilizer`, whatever their flags): "Fertilize: on (12 in stock)", "Fertilize: off (0 in stock)" (07 § Fertilizer). The compost heap's inspector counts the items on it waiting to turn: "Turning: 4 items" (13 § The compost heap).
- The stocks panel names an aged stack's stage before its material and its years in the cellar after its count: "aged bellwine ×20 (aged, 1 year in the cellar)"; the look panel's item lines name the stage too ("20 aged bellwine drink").
- Rot is shown where the food is (13 § Rot, `items.rotOutlook`). Its words are the stage and the whole days left, rounded up, at the speed the item rots at now: "fresh, rots in 9 days", "stale, rots in 4 days", "rotten, gone in 2 days"; "stale, not rotting here" for an item that lies frozen, on a rack or dry in a bag; "keeps, never rots" for food with no rot timer (cured meat and fish, honey, an aged cheese); nothing for anything else without one. The stocks panel draws in the alert colour the name of a stack that is stale or rots within `ROT_ALERT_DAYS`, and its line under the tree speaks of the selected row: a stack by its name and those words ("turnip ×20 · stale, rots in 4 days"); a type or category that holds perishable stacks, by the units under it that rot within `ROT_ALERT_DAYS` ("52 rot within 3 days", in the alert colour when there are any). The stocks panel opens on its first row, the food. Look writes the words on a line of their own under each perishable item and each item of food, indented under it, in the alert colour from the stale stage and dim before it.
- The units panel and the creature inspector say "Tipsy" after a tipsy dwarf's activity ("Hauling · Tipsy", 10 § Tipsy).
- The units panel's Thane line: while the season has a whim, a line under the filter says it and whether it is met now, "The Thane wishes for a lantern in the dining hall: not yet" (dim) or "…: met" (10 § The Thane's whim).
- A drying rack's building panel lists its items with their days left and its drying checklist, one line a row that `Enter` or a click turns on or off (`SetRackDrying`, 14 § The drying rack).
- A candle stand's building panel shows its candles ("Candles: 3 of 5") and its burning candle's material and days left ("Burning: tallow, 4 days left"), or in the warning colour "No candle: dark" (14 § Candle stands and lanterns).
- A `container` building's panel (the wagon, a chest) summarises what it holds, with what lies inside the barrels and bags it holds: units by item type, grouped by the stocks panel's top categories in its order (`food 60: easy meal ×10, plant ×40, raw meat ×10`; a category whose one type has its name reads `drink 60`), and `[v] see the items`, which opens Look on the tile where they lie at its `Items` tab (`ui-screens/panels.md` § Building).
- A hive's building panel shows its combs ("Combs: 1 of 2"), its flowers in reach ("Flowers in reach: 12 within 6 tiles", or in the warning colour "Too few flowers: 2 of 3 within 6 tiles.") and what the season does ("The bees fill a comb every 14 days", "Winter: the bees are silent") (08 § Hives).

### Inspection

The look panel shows the tile under the cursor or the clicked tile with tabs for what is there: `Tile` (03, 04, 05, 06 sections), `Items`, `Creatures` (one sub-tab per creature with the sections registered by 10, 15, 16, 17, 08, 18), `Building` (14, 12, 19 sections), `Zone` (14, 07, 13, 17 sections). Every number the simulation uses for that thing is shown, in the section registered by its owner. Undiagnosed patients hide wound details (17). The tabs line names each tab with its count, "Tabs: [1]Tile [2]Items(52) [3]Creatures(7)"; where that does not fit the panel it drops "Tabs:", then shortens the labels ("[1]Tile [2]Items 52 [3]Who 7"), before it cuts a word.

Inspecting a creature opens Look on its tile at the `Creatures` tab with that creature's sub-tab first, the others after it in the tile's order, and centres the map on it: `Enter` on a dwarf in Units or Mood, a double click on a unit row, and a click on a creature's name in a log line (a creature with a name of its own; one called by its species is not a link). Look opened from the map (`k`, a click, a right click) opens on the `Tile` tab with the creatures in the tile's order.

The `Tile` tab, the one the panel opens on, lists everything on the tile, so nothing there is seen only on another tab: the terrain line, the fluid line, the designation and traffic lines, the building and zone lines, then under `Here:` one line per item on the tile and in the containers there (as the `Items` tab writes it) and one line per creature (its name and activity). The items in the containers there include what a `container` building holds on that tile (the wagon's goods lie at its centre) and what lies inside those. The `Items` and `Creatures` tabs give the details. The fluid line names a discovered tile's fluid (04's `levelAt` of `FLUID_MAX_LEVEL`): `Water 5/7`, `Magma 2/7`, and `Ice 5/7` for frozen water, which keeps its level; a tile with no fluid has no fluid line. The terrain line, and the hover summary's terrain, name what grows on a floor after it: `Clay floor, grass` for an outdoor floor with grass, `Loam floor, flowers` where the map draws a flower (07's `flowerAt`), and `Cave loam floor, moss` for grass below ground (cave moss). The hover summary names the first creature on the tile, or the terrain, then the fluid in the same words in lower case, then what else is there: the one other thing by name (`Granite floor · 1 granite stone`, `Sand floor · water 5/7 · 1 trout`), or how many (`Granite floor · 3 more here`).

### Announcements and the log

- The announcement registry retains every spec registered for an event type. Before formatting, select the first registered spec whose numeric bounds and allowed field values all match; an unmatched event produces no announcement. The owning system defines each spec's severity. Text comes from the strings table with placeholders filled from the event and readers. Sulk day-off, arguing and weeping kinds are notes; breaking furniture is an alert. Dwarf names resolve from finder, miner, dwarf or creature ids; thought text resolves from the thought content row. Focus resolves from `tile`, the first of `tiles`, an entity named by `defenderId`, `attackerId`, `victimId`, `id`, `creatureId` or `partyId`, or a building named by `workshopId` (its first footprint tile).
- `note`: appended to the log in gray; no interruption.
- `alert`: appended in yellow; the log strip flashes for one second; a sound hook is left for the future.
- `danger`: appended in red; the game pauses (`host.setSpeed(0)`) if the `auto-pause on danger` setting is on (default on); the view centers on the focus; the strip shows the line until dismissed by any key. Examples are a dwarf's death and a gate that the alert has locked with every dwarf outside (14).
- The log panel lists everything with filters by severity and category (combat has its own tab), newest first, and jumps to the focus on click. Each entry wraps under its own text, clear of the date column, over as many rows as it needs, never cutting a word that fits. Its list counts entries, not rows: `↑` `↓` move the selection by one entry, `PageUp` `PageDown` by a page of entries less one, and the wheel by three. The newest entry is selected and nothing is inverted until the player chooses: the first `↑` or `↓` marks the selected entry, and a chosen entry is inverted over all its rows. A click on any row of an entry chooses it and centres the map on its focus, and `Enter` centres on the selected entry's focus. The view scrolls to show the selected entry whole (an entry taller than the panel from its top); an entry at the foot that the panel cannot hold whole ends its last row with `»` and has the whole entry as its tooltip. Under the tabs is the filter field: it keeps, within the chosen tab, the entries whose text as shown contains the typed text, ignoring case. Choosing another tab, or changing the filter text, selects the newest entry again, unmarked; a selection below the newest stays on its entry while newer ones arrive. Log size `LOG_MAX_LINES` in memory; the last `LOG_SAVED_LINES` are saved. The log belongs to its fortress: a new fortress starts with an empty log (its first hint the first line), and a loaded one with the lines its save holds, never with the lines of the fortress played before it.
- Some lines are made by the UI rather than one to an event:
  - Starving: the `Starving` events of a day are one line, which names each dwarf once as its event comes: "Asa Forgehall is starving." for the first, then "3 dwarves are starving: Asa, Njal, Liv." (first names, in the order they came); the line keeps its place, takes the time of the latest and focuses the first dwarf. The next day starts a new line.
  - Miasma: the `MiasmaSpread` line names what rots and where, from the rotting items lying on the event's tiles (not in a container): their units summed by material, or by species for corpses, within each place, and the largest of those groups: "Miasma spreads from 20 rotten turnip in Stockpile #2 (Food).", "Miasma spreads from a rotting deer corpse in the halls."; its focus is that group's first tile. The first such line of a fortress adds "A refuse stockpile outdoors, or a dump, takes rotten food away." (the flag is saved in the UI state). With no rotting item on those tiles the line is "Miasma spreads.".
  - Before food rots: on each `DayPassed`, when the edible units not yet rotting that will rot within `ROT_ALERT_DAYS` at the speed they rot now (13's `items.rotOutlook`; merchants' goods excluded) would feed the fortress for a day, one unit for each `HINT_FOOD_DAYS_PER_ITEM` dwarves, an alert says so and names the largest such stack and its place: "40 food will rot within 3 days; the largest stack is 20 turnip in Stockpile #2 (Food)."; its focus is that stack's tile. So it comes at most once a day, while the food lasts.
  - A place in these lines is the stockpile on the tile by its name ("Stockpile #2 (Food)"), another zone ("Dining hall #1"), the building on the tile ("Wagon #1"), else "the open" outdoors and "the halls" indoors.
- Repeated identical announcements are merged with a count ("×3") when they fall within `LOG_DEDUP_TICKS` of each other or on the same day, whatever other lines came between; the merged line keeps its place and takes the time of the latest. An event that can fire many times a day, such as `ObsidianFormed`, therefore makes one line a day.
- An announcement never prints a raw `{placeholder}` or an empty hole. A creature in a line is its name, or its species with an article ("a deer") when it has no name of its own; a species or a plant that an event names by its content id reads as its name ("A glow beetle has arrived."), and a civilization as the panels name it, "Hillfolk", after "the" where the sentence wants one ("A caravan has arrived from the Hillfolk."); the event carries what the line needs of a creature that is gone by the time the line is drawn (`KillRecorded`, `HuntKill`). The kill of a hunt job's quarry has the `HuntKill` line as its only kill line (the creature's death note stays); any other kill is a `KillRecorded` line. An item is named by its material and its type, and a word that both contain is said once ("wool cloth", "easy meals", "leather boots") in every list that names items. Raw food (a category `food/<kind>/raw`: raw meat, raw fish, plants) and drink are named by their material alone, with no plural, as the stocks panel names their stacks: "10 boar meat", "20 turnip", "20 ale", "dimcap ale"; a cured or salted form keeps its word ("cured boar meat").
- Every character of a player-facing string, in `strings.json`, the hint table and the interface defaults, is a glyph of the glyph set or an alias the glyph map folds onto one. Menu paths in text are written with `>` ("[b > Workshops]"), never `›`.
- Job and workshop block messages name the missing input and count and, when one workshop makes it, where to order it. UI actions that cannot act show a status message through the shared message helpers.
- A refused command (`CommandRejected`) shows its reason in the status bar for `STATUS_HINT_SECONDS` (or until replaced earlier by starting a drag, a new ghost state or a new notice) and is appended to the log as an alert with the command's focus. The reason names the thing and why ("Door needs walls on two opposite sides", "that zone no longer exists"); no content id, entity id, reason code or action id is shown. Status row text that does not fit ends with `…` and registers its full text as a tooltip on the row, like any clipped label.

A fortress dwarf’s `CreatureDied` announcement keeps danger severity, the recorded name and the recorded focus tile after simulation cleanup has removed the entity. Species and faction in the event identify that dwarf; other creature deaths retain their ordinary announcement severity.

Refusal text for each command whose handler returns `precondition_failed` names its specific cause; the generic precondition line is reserved for malformed commands. An undo that leaves working designations reports the number of unique batch tiles still designated after the command: "{n} designations kept: work has begun there".

A missing-input workshop note names its type and ordinal and the missing input, once per workshop and reason until that workshop next completes a craft job. Its suppression ids are saved in UI state and cleared on completion, workshop removal or entering a new fortress; older UI sections default to empty. A seed shortage names the farm plot's ordinal.

The first dangerous-species arrival in a fortress pauses the game once, as a first raid does (when the danger auto-pause setting is on), and never again for wildlife; the flag is saved with the hint flags in the UI state. Several dangerous animals of one species arriving together are one line with the count ("3 wolves have come to the valley.").

### Hints

The hint table (content) lists `{ id, trigger: predicate over readers, text, once: true }`. Hints are evaluated once per game hour; a triggered hint is shown as a note prefixed with `☼` and marked shown (saved). A setting disables hints. The design fixes these hints: designate to dig; build a still; place a stockpile; winter is coming; wild beasts will come (a shelter and a squad with spears); a dangerous beast is near; food is running low; the hearth; stockpiles need containers; smelters need fuel; hunters need crossbows; farms need soil; harvest returns one seed; a room needs enclosure; lock doors on alert; build a depot before summer; hospitals need supplies; immigrants come when spirit is Content; the drawbridge gate; cage traps; trollkin break doors; the Deep (shown on the first deepsilver vein found).

Shown and pending hints belong to `UiState`, not fortress simulation state. The unreachable-job clock starts at first hourly observation, is saved by job id, and clears when the job is observed with another state/reason or emits unblocked, cancelled or completed. A whole game day of observed unreachable blocking triggers its once-only hint. A bare-bedroom timer starts at its first hourly observation, is saved by zone id, and clears when the room improves or disappears. The headless hint scenario uses the same presentation engine and world-event listener.

### Confirmations

Modal `confirm` dialogs with `Yes`/`No` (keys `y`/`n`, `Enter` for the default) use the shared `confirmThen` helper for destructive panel actions. Every default is No. They ask for: mining deepsilver (once per fortress), the first fire set on purpose (once per fortress: the first `ignite` box opens `c_first_ignite`; Yes sends `ConfirmIgnite` and then the designation, No drops it; later ones need none), retiring, quick load, removing any zone or work order, disbanding, taking apart any built building, suspending a workshop, marking items for melt or dump, marking an animal for slaughter, releasing a caged creature, loading a snapshot, deleting a save, and embarking without a pick or without food or drink; the first `New world` also asks whether to play the tutorial. Crop and occupied-stockpile removals show their specific counts. Clearing marks or resuming does not ask; neither do forbidding, returning depot goods to stock, removing a trade request, opening the squad member removal chooser, cancelling a job or cancelling a building plan. Dialog rows and texts are in the content table.

### Screens outside the fortress

- **Intro**: a short animated film in one of two styles, chosen by the Intro style setting (`ui-screens/menus-and-world.md` § Intro): `deep`, the default, in big block art (its scenes are content, `03-content/deep-intro.md`), or `hall`, in the game's glyphs (`03-content/intro.md`). It plays at launch before the main menu as the Intro at launch setting says (`first time`: only at the first launch; `always`; `off`), and from the main menu's `Intro`. Any key or click skips it; when it ends or is skipped, the main menu opens.
- **Main menu**: `New world`, `Tutorial`, `Continue` (loads the newest save), `Load`, `Legends`, `Settings`, `About` (hidden until it has a screen), `Intro`. Arrow keys and mouse. The first `New world` ever chosen offers the tutorial first.
- **Tutorial**: a fortress on a friendly site of a fixed world, with a box over the map view that gives one step at a time, highlights the part of the UI the step uses, and goes on when the step's check holds; any step can be skipped and the tutorial ended at any time (`ui-screens/menus-and-world.md` § Tutorial; the steps are content, `03-content/ui-keymap-and-screens.md` § Tutorial).
- **World generation** (01): seed text field, size dropdown, `Generate`, progress with the preview, `Continue`.
- **World map** (01): the map with the cursor; the region panel on the right, with the site summary of 02 and its missing essentials in the alert colour, and after it the rows **This site has:** and **This site lacks:** (02 § What a site has and lacks), the lacks in the alert colour, scrolled by `PageUp` `PageDown` and the wheel when it is longer than the window; the filter panel (`f`); `Embark` (`Enter` on a valid region). Legend of biome glyphs (`?`).
- **Embark** (02): three tabs (a fourth, Items, in testing mode), footer with budget and `Embark`, and the testing mode switch below it (off by default); Balanced is applied on opening. Missing pick or food/drink asks the default-No confirmation before embarking.
- **Trade session** (20): modal two-column table; a merchant good priced at the scarcity price says "scarce here" (20 § The scarcity price).
- **Legend**: the record of a fortress (see 24 › Legend record below); `Back`.
- **Settings**: keybindings (rebind by selecting a row and pressing a key), auto-pause toggles per severity, hints on/off, zoom, colorblind palette, edge scrolling, autosave on/off, music volume, music on/off, intro at launch (first time, always, off), intro style (deep, hall), `Reset to defaults`.
- **Load**: manual saves and autosaves with thumbnails; `Load`, `Delete` (confirm), `Export`, `Import`.

### The legend record

Written by the app when the fortress ends: name, seed, region name and ratings, years and days survived, peak population, deepest level reached, final wealth, milestones with dates (content `milestones`: first hearth, first metal, first cavern, fifty dwarves, magma forge, first deepsilver, a Hollow-born slain, a decade, the first stone set, the first runecaster), kills of note, the last 50 alert or danger announcements, and the cause of the end ("The hall fell silent on Day 4 of Winter, Year 6. The last dwarf, Solveig Deephand, died of her wounds." or "Retired in Year 8 with 61 dwarves."). Shown on the legend screen and listed under `Legends` in the main menu. A fortress started in the embark's testing mode (02 § Testing mode) is marked in its record (`testing`): the list and the record name it "(testing)", the record says "A testing fortress: it began with an unlimited loadout, so its milestones were not earned in normal play." under its name, and its milestones are headed "Milestones (testing start)".

Sea of Fire is awarded on `CavernBreached` 3. Kills of note are the three highest positive dwarf kill counts; the journal retains every count. After a tick carrying a creature death, the app checks extinction once, using the event's name and cause for the end record. The legend and view-only save share `final-<fortressSlug>`; its host never ticks and returns false for commands.

### Settings

The stored zoom applies to every game, new or loaded: a save records the zoom that was in effect, and loading fits again from the setting. Viewport fitting may use smaller cells without changing the requested zoom (23 § Canvas and cells). Settings › Keybindings lists every binding, the panel hotkeys and the fixed keys included, under the heading of its context, grouped by screen in the order of `ui-keymap-and-screens.md` § Keymap: the fortress screen and its panels, the screens over the fortress, then the screens before it. A row shows the action in Help's wording and the key it has now; a rebound row also names its default, and a fixed row says "fixed". `Enter` or a click on a row captures the next key (`Esc` cancels the capture, and a modifier alone waits for the key it goes with); `Delete` or `Backspace` gives the row its default back; `[d]` gives every binding its default back; the settings menu's `Reset to defaults` resets the preferences and the bindings together.

A key is refused when a binding that can act at the same time already has it: another binding of the same context; a global key, against every context; a list key of § Panels, against every context; a map key, against the panel letters, the list keys and every panel's own keys; a map selection key and a panel's own key, against each other; the zone types and the zone inspector, against each other; and a panel's own bare letter, against the panel letters. A panel letter may take a letter that panels use only as an accelerator, which then takes Shift. A browser shortcut that a page cannot keep from the browser (`Ctrl` with `W`, `T`, `N`, `Q`, `Tab`, `PageUp`, `PageDown` or `F4`, with or without `Shift`) is refused for every binding: "{key} belongs to the browser, which acts on it first.". A binding may always take its own default key back unless another binding of its context has it. Some defaults are shared by two contexts that act together, and the context that reads the key first takes it: `Space` pauses and marks a row in a multi-select list, `Enter` acts at the map cursor and activates a panel's row, the digits set a priority on the map and choose a tab in a panel, and `[S-p]` is both the zone types' pasture and the zone inspector's preset dropdown. Rebinding one of the two moves that one only; the other keeps the key, and the pair is not separated for the player. Failed rebinding uses registry strings through the shared message helpers. Modifier errors say "Use a key with optional Ctrl or Shift."; conflicts say "Conflicts with {context}: {action}", using the player-facing context heading and Help wording, never binding ids, and the conflicting row is drawn in the bad color; a fixed row says "{key} is a fixed key and cannot be rebound.". The bindings remain unchanged on failure.

A rebinding takes effect at once and is saved with the preferences in the settings store, so it survives a reload. Only overrides of content defaults are saved, each under its binding's name: the context, the action and the argument its key gives, numbered when an action has several keys (`map/z_down`, `map/z_down#2`, `map/pan:←`), so a later change of a default key does not move a saved rebinding to another binding. A keymap saved with bindings named by context and default key (`map/<`) still loads, and one saved before the names, which keyed each override by the index of its expanded row, is read through the row order of that version. An override for a fixed key, for a browser shortcut or for no binding is skipped. An override that would share a key with a binding that acts beside it, by the rules above, is dropped (of two overrides, the later in table order), and the others still load. Wherever a key is named (Help, the hints, a panel's captions and notes, the status rows, a dialog's buttons) it is shown as its binding has it now, and what a caption makes clickable is measured on the text as drawn: a key whose name is longer or shorter than the default moves the captions after it, and each caption is clickable from its first drawn cell to its last. A function key or a `Ctrl` key that a binding has is kept from the browser's own use.

### Game menu (Esc from the fortress with no tool or panel)

`Resume`, `Save`, `Load`, `Settings`, `Rename fortress`, `Retire fortress` (confirm), `Main menu` (confirm if unsaved changes since the last save).

`Save` writes the save and shows "Saved {fortress}, {date}." under the menu's title for `GAME_MENU_MESSAGE_MS`; the same line goes to the log, as the quick save's does. The menu stays open. The game menu's Rename fortress row also works by mouse and is disabled in a view-only final save, as Save and Retire are. Its text input starts with the current name and uses the core `FORTRESS_NAME_MAX_CHARS` limit. Empty input remains in the dialog with its minimum-length reason; a command refusal uses the normal message path and names the 1–32-character rule. Help lists the menu action.

Unsaved changes are ticks elapsed or commands applied since the last save. A command given while the game is paused takes effect at once without the calendar advancing, so it counts as an unsaved change too; the count of applied commands is kept beside the last-save tick and is not saved.

### Music

Music is a presentation listener on the event bus. It reads events and readers and nothing else; it never submits a command and never draws on the simulation's random streams, so it cannot change a world or its hash.

- **Synthesized.** Each tune of [`../03-content/music.md`](../03-content/music.md) is note data played by the Web Audio API through the instruments of that file: an oscillator per pitch (two, a few cents apart, for an instrument with detune), a gentle low-pass filter, an attack, decay, sustain and release envelope, and a share sent to a cave reverb `MUSIC_REVERB_S` long. A piece's notes are handed to the synthesizer `MUSIC_LOOKAHEAD_S` ahead of the audio clock; a note whose time passed unplayed is skipped.
- **What plays.** The screens before a fortress (the main menu, world generation, the world map, embark, load, legends and settings from the main menu) play the `menu` tune, again after `MUSIC_MENU_GAP_S`. The intro is a music scene of its own, `intro`, with a mood of its own for each intro style: the `deep_intro` tune under the deep intro, the `intro` tune under the hall intro. The intro's tune starts after `MUSIC_CHANGE_GAP_S` and plays once, and is not repeated after a pause. When it ends, or when the intro is skipped or ends, the `menu` tune starts after `MUSIC_CHANGE_GAP_S` as on any change of mood. At launch no audio exists until the first key press or click, which also skips the intro, so the intro's piece is heard only when the intro is opened from the main menu. While a fortress runs, on the fortress screen and every screen over it, the `fortress` tunes play one after another in id order, starting at a random one, with a silence between two pieces drawn from `MUSIC_SILENCE_MIN_S` to `MUSIC_SILENCE_MAX_S` seconds. While the hearth alert or a siege stands, the `tense` tune plays instead, again after `MUSIC_TENSE_GAP_S`. The alert stands from an `AlertChanged` to `hearth` until the next `AlertChanged`; a siege stands from a `RaidArrived` of kind `siege` until the `RaidEnded` of that party. A new or loaded fortress starts from its readers: the combat alert and the threats' active parties whose purpose is a siege.
- **A hidden tab.** While the document is hidden the music pauses: the piece in progress fades out and the director's clock stops, so the piece is not lost and its length does not run down. When the document is shown again the piece goes on from the place it had reached; if the mood changed meanwhile, it is a change of mood like any other (the new mood's piece starts after `MUSIC_CHANGE_GAP_S`).
- **Changes.** When the mood changes (an intro's, menu, fortress, tense) the playing piece fades out over `MUSIC_FADE_S` and the new mood's piece starts after `MUSIC_CHANGE_GAP_S`; when the danger ends, the fortress pieces come back after a whole silence. A piece lasts its score plus `MUSIC_TAIL_S` for its last notes to die away.
- **Volume and the mute key.** The Music volume setting (0 to 100, default 50) sets the loudness as `MUSIC_MASTER_GAIN × (volume / 100)²`. The Music setting turns it on and off, and so does the music key (`Ctrl+M` by default, a Global row of the keymap that Settings › Keybindings can rebind). The key acts on every screen: a screen that does not use the key passes it to the app. A key capture keeps it; a text field passes it on, as it passes every Ctrl key (typing never makes one), so the key works while a filter is focused. On the fortress screen the status row says "Music on." or "Music off.". Music off, or volume 0, stops the piece at once; music turned on starts the mood's piece after `MUSIC_CHANGE_GAP_S`. Both settings, and a sound-effect volume that is kept for sound effects to come, are saved in the settings store.
- **The browser's rules.** No audio context exists before the player's first key press or click, nor while music is off or at volume 0 before one was made. While music is off or the volume is 0 the context is suspended, `MUSIC_SUSPEND_DELAY_S` after the last piece began to fade, so nothing runs on the battery; music turned on resumes it, and so does the next key press or click if the browser asks for a gesture. A key press or click, with music on, resumes a context in any state but running or closed (a browser may leave one `interrupted`, after a call for example). Headless runs, the tests and the e2e build create no audio context.

### Accessibility and comfort

- No information is conveyed by color alone: state glyphs differ or the inspector states it in words.
- The colorblind palette setting.
- All text is at the cell size; zoom 1.5 is the large-text mode.
- The game never requires holding a key or fast input.

## State

Presentation-only: screen stack, active panel, tool state, cursor, selection, log lines, hints shown, the tutorial and its step, settings, keymap overrides. The tutorial is not saved; whether it has been offered is kept in the settings store. Camera, z, zoom, overlays, hints shown and pending, bare-bedroom observation ticks, the open panel, whether a deepsilver vein has been found (it unlocks the Deep gauge, 18) and the last `LOG_SAVED_LINES` log lines with their categories are saved in the `ui` section; settings, keymap and the saved embark loadouts in the settings store.

## Interfaces

- `ui.registerPanel(spec)`, `ui.registerInspector(kind, section)`, `ui.registerAnnouncement(type, spec)`, `ui.registerHint(hint)`
- `ui.pushScreen(screen)`, `ui.popScreen()`, `ui.confirm(text) → Promise<boolean>`
- `ui.announce(severity, text, focus?)` (for app-level messages such as save errors)
- Input: `input.onKey`, `input.onMouse` from the platform; the keymap resolves to `UiAction`s.

### Reader (`readers.legend`)

The presentation UI exposes no simulation reader. The legend journal, a saved simulation system that shares id 24 and records what the legend record needs, exposes:

- `legend.peakPopulation()` — the highest population reached
- `legend.deepestZ()` — the deepest level reached
- `legend.kills()` — the kill tally, as name and count; a fortress killer is counted unless it is a summon (25 § Summons), whose kills still award the milestones

### Events consumed (presentation subscriber)

All events, filtered through the announcement registry; `AlertChanged`, `RaidArrived` and `RaidEnded` for the music (§ Music); `CommandRejected` (shows the reason in the status bar for `STATUS_HINT_SECONDS` and appends it to the log as an alert with the command's focus); `SeasonChanged` (autosave trigger lives in the app).

### Commands emitted

All commands, from panels and tools.

## Player-facing behavior

This entire document.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `LOG_MAX_LINES` | 2000 | In memory (*unmeasured*) |
| `LOG_SAVED_LINES` | 200 | *unmeasured* |
| `LOG_DEDUP_TICKS` | 100 | *unmeasured* |
| `CURSOR_SCROLL_MARGIN` | 3 | Tiles the keyboard cursor keeps from the edge of the map view; the camera scrolls to keep it (*unmeasured*) |
| `STATUS_HINT_SECONDS` | 4 | Rejection reason display time (*unmeasured*) |
| `GAME_MENU_MESSAGE_MS` | 3000 | How long the game menu shows what saving did (*unmeasured*) |
| `HINT_CHECK_HOURS` | 1 | *unmeasured* |
| `HINT_FOOD_DAYS` | 2 | `hint_food`: the edible stock is below this many days of eating for the population (*unmeasured*) |
| `HINT_FOOD_DAYS_PER_ITEM` | 4 | Days one edible unit is counted to feed one dwarf, by the UI's food lines (*unmeasured*) |
| `ROT_ALERT_DAYS` | 3 | Days ahead the stocks panel counts, and the alert warns of, food that will rot (*unmeasured*) |
| `UNDO_BATCHES_MAX` | 10 | Designation batches retained for undo (*unmeasured*) |
| `BREEDING_CAP_MIN` | 0 | Animals cap editor lower bound |
| `BREEDING_CAP_MAX` | 100 | Animals cap editor upper bound |
| `BREEDING_CAP_BIG_STEP` | 10 | Cap editor Shift increment (*unmeasured*) |
| `UI_NORMAL_SPACING` | 3 | Normal gap between tabs and status fields (*unmeasured*) |
| `UI_COMPACT_SPACING` | 1 | Gap when normal spacing does not fit the viewport (*unmeasured*) |
| `EMBARK_PRESET_SPACING` | 4 | Normal gap before the Presets button (*unmeasured*) |
| `EMBARK_PRESETS_WIDTH` | 78 | Widest the embark presets menu opens, cells: room for each preset's total and description |
| `EMBARK_WHEEL_ROWS` | 3 | Rows a mouse wheel notch scrolls an embark list (*unmeasured*) |
| `EMBARK_LOADOUT_NAME_MAX` | 32 | Longest saved loadout name, characters (02 § Loadouts) |
| `SITE_LIST_NAMES` | 2 | Names a row of the world map's site summary lists before "and N more" (*unmeasured*) |
| `SITE_LABEL_COLS` | 9 | Width of the site summary's row labels, cells |
| `SETTINGS_VOLUME_STEP` | 10 | Step of the music and sound volumes |
| `TUTORIAL_WORLD_SEED` | tutorial-vale | The seed of the tutorial's world (standard size) |
| `TUTORIAL_BOX_COLS` | 44 | Width of the tutorial's box, cells (*unmeasured*) |
| `TUTORIAL_CHECK_MS` | 250 | Longest time between two checks of the tutorial's step while no key or click comes, ms (*unmeasured*) |
| `INTRO_STAGE_COLS` | 64 | Width of the intro's stage, cells |
| `INTRO_STAGE_ROWS` | 16 | Height of the intro's stage, cells |
| `INTRO_FRAME_MS` | 250 | How long an intro cue shows each frame when its row gives no step, ms (*unmeasured*) |
| `INTRO_RISE_ROWS` | 6 | How far below its place each column of rising intro art starts, rows |
| `DEEP_INTRO_STAGE_COLS` | 80 | Width of the deep intro's strip, art pixels |
| `DEEP_INTRO_STAGE_ROWS` | 30 | Height of the deep intro's strip, art pixels |
| `DEEP_INTRO_NOISE_MS` | 80 | How often the deep intro's static and speckle are drawn anew, ms (*unmeasured*) |
| `DEEP_INTRO_SHAKE_MS` | 40 | How often a shake of the deep intro moves the picture, ms (*unmeasured*) |
| `DEEP_INTRO_BLOCK_COLS` | 8 | Width of a stone block of the pillars beside the deep intro's strip, art pixels |
| `DEEP_INTRO_COURSE_ROWS` | 4 | Height of a course of those stones, art pixels |
| `MUSIC_SILENCE_MIN_S` | 60 | Shortest silence between two fortress pieces, seconds (*unmeasured*) |
| `MUSIC_SILENCE_MAX_S` | 180 | Longest silence between two fortress pieces, seconds (*unmeasured*) |
| `MUSIC_MENU_GAP_S` | 8 | Pause before the menu theme plays again, seconds (*unmeasured*) |
| `MUSIC_TENSE_GAP_S` | 3 | Pause before the tense piece plays again, seconds (*unmeasured*) |
| `MUSIC_CHANGE_GAP_S` | 3 | Pause after a change of mood, or music turned on, seconds (*unmeasured*) |
| `MUSIC_FADE_S` | 2.5 | Fade-out of a stopped piece, seconds (*unmeasured*) |
| `MUSIC_LOOKAHEAD_S` | 1 | How far ahead notes are scheduled, seconds |
| `MUSIC_TAIL_S` | 2 | Time a piece's last notes take to die away, seconds |
| `MUSIC_MASTER_GAIN` | 0.6 | Loudness at volume 100 (*unmeasured*) |
| `MUSIC_REVERB_S` | 2.4 | Length of the cave reverb, seconds (*unmeasured*) |
| `MUSIC_SUSPEND_DELAY_S` | 3 | Time after music turns off, or the volume reaches 0, before the audio context is suspended, seconds (*unmeasured*) |

## Keymap, screens, hints and milestones

The complete default keymap, the screen and panel lists with hotkeys, the mouse model table, the overlay list, the hint table with triggers and texts, the tutorial's steps, the milestone table, the confirmation dialogs and the settings list are in [`../03-content/ui-keymap-and-screens.md`](../03-content/ui-keymap-and-screens.md). That file is the source of `keymap.json`, `hints.json`, `tutorial.json` and `milestones.json`.

## Extension points

- New panels and inspector sections through registration.
- Localization: the strings table.
- Touch: a gesture layer producing the same actions.
- Macros and command scripting: commands are data; a panel that records and replays them fits the command log.
