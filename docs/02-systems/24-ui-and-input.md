# 24 UI & Input

**Owner:** `ui/`, `platform/input.ts` · **Depends on:** [23-rendering.md](23-rendering.md), [`../01-architecture/module-interfaces.md`](../01-architecture/module-interfaces.md), [`../00-vision/player-experience.md`](../00-vision/player-experience.md)

## Purpose

Give the player every action by keyboard and by mouse and every fact by inspection, with a small consistent set of screens, panels and widgets drawn as text into the cell grid.

## Concepts

- **Screen**: a full-window mode on a stack: `main_menu`, `world_gen`, `world_map`, `embark`, `fortress`, `legend`, `settings`, `load`, `trade_session` (modal over fortress), `labor_manager` (over fortress), `confirm` (modal dialog), `text_input` (modal).
- **Panel**: a sidebar view inside the fortress screen, one active at a time, registered with a hotkey.
- **Tool**: the current map interaction mode: `none` (inspect), a designation kind, a build placement, a zone type, a squad order, a selection for item commands.
- **Widget**: an immediate-mode element: `List`, `Table`, `Menu`, `Toggle`, `Number`, `Text`, `Button`, `Tabs`, `Bar`, `Tree`, `Dropdown`, `Label`, `Separator`.
- **Action**: a named UI action produced by the keymap or by a mouse gesture; panels handle actions and submit commands.
- **Announcement**: a log line with a severity produced from an event by the announcement registry.
- **Hint**: a one-time tip triggered by state.

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
│ status bar row 2: tool and hint line, or the tile summary under the mouse          │
└───────────────────────────────────────────────────────────────────────────────────┘
```

The sidebar is closed until a panel is opened; `Tab` toggles it without changing the panel. In a selected stockpile's editor, `Tab` and `Shift+Tab` move between the category tree and numeric fields instead. The status bar hearth glyph is colored by hall spirit tier; a red cross with a count shows patients; `!n` shows active hostiles (those on discovered tiles that are not hidden, plus those spotted); a scale glyph shows a caravan present.

### Input model

Keyboard:

- Letters open panels and tools (the default keymap table): `d` designate, `b` build, `z` zones, `u` units, `j` jobs, `l` labors, `o` orders, `s` stocks, `m` military, `n` animals, `t` threats, `c` civilizations, `p` population, `e` mood, `a` log, `k` look, `f` overlays, `?` help.
- `Esc` cancels the current tool, then closes the panel, then opens the game menu.
- `Space` pause (in a multi-select list it marks the row; in the stockpile category tree or material checklist it toggles the checkbox instead); `+` and `-` speed (in a stockpile numeric field they adjust its value); `<` and `>` (also `,` and `.`) z-level down and up; arrow keys pan by one cell, `Shift` + arrows by ten; `Home` centers on the hearth (or the wagon).
- Within a designation or zone tool: a click applies to one tile, a drag defines a rectangle, and two presses of `Enter` define its corners. Each press uses the look cursor, otherwise the mouse tile, otherwise the map centre; a stairwell may span levels. `1`–`9` set the priority; `Ctrl+Z` undoes the last batch.
- `F5` quick save, `F9` quick load (with confirmation), `Ctrl+S` save menu, `F12` debug panel.
- Within panels: unshifted arrows move the selection before they pan the map (the labor grid also takes left/right), `Enter` activates, `Tab` moves between fields, letters in `[brackets]` are accelerators, `PageUp`/`PageDown` scroll. State-specific keys are listed in the panel documents.
- Bare panel letters always open or close their panel. Reserved letters come from the live panel bindings; colliding accelerators require Shift, shown `[S-x]`. Fixed captions use the defaults, while zone inspector captions and their Help rows follow the current panel bindings. With default bindings, the free letters are `g h i q r v w x y`; these work with or without Shift. Focused text fields take letters as text. A text field takes a key event only when its `key` is a single printable character, `Space` being a space; control, format, private-use and unassigned code points (Unicode categories Cc, Cf, Co, Cn) are ignored by the field, and a character the bundled font lacks is accepted and drawn `?`. While a text or filter field has focus, `Space` types a space and never reaches the pause key. A name is trimmed and every run of spaces becomes one space; a name that is empty after that is refused with the dialog's "Type at least 1 character." line (the embark screen's "The fortress needs a name."). A panel's filter text is cleared when its panel closes or another opens.
- In the Units table and a squad's add/remove list, `Space` marks a row before it pauses; `*` marks all or none. An action uses every marked row when the cursor row is marked, otherwise just that row.
- In Orders, `=` or numpad `+` adds one, `-` subtracts one, and Shift on either physical key changes ten (main-row `+` is Shift+`=`). These take precedence over speed only while an order is selected.
- With a building tool that places many, `Shift+Enter` sets a corner; `Enter` or a click sets the other. Plain `Enter` places one. `Esc` clears the corner before leaving the tool.
- Every key is rebindable in settings; the keymap is a data table (`keymap.json`).

Mouse:

- Left click: with no tool, inspects the tile (opens the inspection panel); with a tool, applies it (a single tile) or starts a drag rectangle.
- Left drag: rectangle for designations, zones, selections; the rectangle is drawn live with its size in the status bar.
- Right click: cancels the current tool; with no tool, opens the inspection panel for the tile (same as left) with the context list of entities on it.
- Wheel: z-level (down = deeper). `Ctrl` + wheel: zoom. `Shift` + wheel: pan vertically.
- Middle drag (or `Space` + left drag): pan.
- Hover: the status bar's second row shows the tile summary ("Granite wall, undiscovered beyond" / "Ketil Ironvein, Miner, Digging" / "5 dimcaps in a bin"). Clipped labels and table cells register their full text as a tooltip, shown in the status row and a box above the hovered cell; the sidebar retains `SIDEBAR_COLS`.
- Edge scrolling is off by default (a setting).

A drag with no tool selects tiles as presentation state, without saving them. `Delete` undoes designations, cancels planned or constructing buildings, and removes zones wholly inside the selection after confirmation. Selection item commands use `[S-f]` forbid, `[S-d]` dump (confirm), and `[S-t]` move to depot. `Esc` clears the selection before closing the panel. Double-clicking a unit or job row centres the map on it.

Keyboard and mouse produce the same actions; there is no action reachable only one way. The keymap parity scenario checks each Keymap, Fortress panels and Mouse row against the live bindings, panel list and mouse probes.

While paused, submitted commands take effect immediately through the host's command phase, without advancing time. Designations, planned buildings and zones appear before unpausing. Rejections update the status row and alert log immediately with the command's focus. The command log stamps these inputs with the next tick to run, so replay and paused save/load preserve simulation state.

### Panels

Registered by systems through `register.panel`; the design fixes this set and their content is defined in the owning system documents:

`designate` (03), `build` (14), `zones` (14), `units` (10), `labors` (11), `jobs` (11), `orders` (12 + 11 standing orders), `stocks` (13), `military` (16), `animals` (08), `threats` (18), `civilizations` (20), `population` (21), `mood` (15), `log`, `look` (inspection), `overlays` (23), `help`, `debug`.

Panel conventions:

- Title row with the panel name and its hotkey; a filter or search field where lists are long (units, jobs, stocks).
- Lists show at most the visible rows with a scrollbar glyph column; selection is inverted.
- Actions available for the selected row are listed at the bottom with their accelerator letters.
- Clicking a location reference (a job target, an announcement) centers the map.
- Numbers are shown with units; percentages as `71%`; marks as `1,250 ☼`.
- Opening Designate chooses Dig when no designation tool is chosen; `[S-d]` is its Dig accelerator.
- New squads use the first unused UI preset name; choosing their members is a separate action.
- Help and Debug use the global keymap bindings (`?` and `F12` by default). Debug is a sidebar panel, not a screen.

### Inspection

The look panel shows the tile under the cursor or the clicked tile with tabs for what is there: `Tile` (03, 04, 05, 06 sections), `Items`, `Creatures` (one sub-tab per creature with the sections registered by 10, 15, 16, 17, 08, 18), `Building` (14, 12, 19 sections), `Zone` (14, 07, 13, 17 sections). Every number the simulation uses for that thing is shown, in the section registered by its owner. Undiagnosed patients hide wound details (17).

### Announcements and the log

- The announcement registry retains every spec registered for an event type. Before formatting, select the first registered spec whose numeric bounds and allowed field values all match; an unmatched event produces no announcement. The owning system defines each spec's severity. Text comes from the strings table with placeholders filled from the event and readers. Sulk day-off, arguing and weeping kinds are notes; breaking furniture is an alert. Dwarf names resolve from finder, miner, dwarf or creature ids; thought text resolves from the thought content row. Focus resolves from `tile`, the first of `tiles`, an entity named by `defenderId`, `attackerId`, `victimId`, `id`, `creatureId` or `partyId`, or a building named by `workshopId` (its first footprint tile).
- `note`: appended to the log in gray; no interruption.
- `alert`: appended in yellow; the log strip flashes for one second; a sound hook is left for the future.
- `danger`: appended in red; the game pauses (`host.setSpeed(0)`) if the `auto-pause on danger` setting is on (default on); the view centers on the focus; the strip shows the line until dismissed by any key.
- The log panel lists everything with filters by severity and category (combat has its own tab), newest first, and jumps to the focus on click. Log size `LOG_MAX_LINES` in memory; the last `LOG_SAVED_LINES` are saved.
- Repeated identical announcements within `LOG_DEDUP_TICKS` are merged with a count ("×3").
- Job and workshop block messages name the missing input and count and, when one workshop makes it, where to order it. UI actions that cannot act show a status message through the shared message helpers.
- A refused command (`CommandRejected`) shows its reason in the status bar for `STATUS_HINT_SECONDS` (or until replaced earlier by starting a drag, a new ghost state or a new notice) and is appended to the log as an alert with the command's focus. The reason names the thing and why ("Door needs walls on two opposite sides", "that zone no longer exists"); no content id, entity id, reason code or action id is shown. Status row text that does not fit ends with `…` and registers its full text as a tooltip on the row, like any clipped label.

A fortress dwarf’s `CreatureDied` announcement keeps danger severity, the recorded name and the recorded focus tile after simulation cleanup has removed the entity. Species and faction in the event identify that dwarf; other creature deaths retain their ordinary announcement severity.

### Hints

The hint table (content) lists `{ id, trigger: predicate over readers, text, once: true }`. Hints are evaluated once per game hour; a triggered hint is shown as a note prefixed with `☼` and marked shown (saved). A setting disables hints. The design fixes these hints: designate to dig; build a still; place a stockpile; winter is coming; the hearth; stockpiles need containers; smelters need fuel; hunters need crossbows; farms need soil; harvest returns one seed; a room needs enclosure; lock doors on alert; build a depot before summer; hospitals need supplies; immigrants come when spirit is Content; the drawbridge gate; cage traps; trollkin break doors; the Deep (shown on the first deepsilver vein found).

Shown and pending hints belong to `UiState`, not fortress simulation state. A bare-bedroom timer starts at its first hourly observation, is saved by zone id, and clears when the room improves or disappears. The headless hint scenario uses the same presentation engine and world-event listener.

### Confirmations

Modal `confirm` dialogs with `Yes`/`No` (keys `y`/`n`, `Enter` for the default) use the shared `confirmThen` helper for destructive panel actions. Every default is No. They ask for: mining deepsilver (once per fortress), retiring, quick load, removing any zone or work order, disbanding, taking apart any built building, suspending a workshop, marking items for melt or dump, marking an animal for slaughter, releasing a caged creature, loading a snapshot, deleting a save, and embarking without a pick or without food or drink. Crop and occupied-stockpile removals show their specific counts. Clearing marks or resuming does not ask; neither do forbidding, returning depot goods to stock, removing a trade request, opening the squad member removal chooser, cancelling a job or cancelling a building plan. Dialog rows and texts are in the content table.

### Screens outside the fortress

- **Main menu**: `New world`, `Continue` (loads the newest save), `Load`, `Legends`, `Settings`, `About`. Arrow keys and mouse.
- **World generation** (01): seed text field, size dropdown, `Generate`, progress with the preview, `Continue`.
- **World map** (01): the map with the cursor; the region panel on the right; the filter panel (`f`); `Embark` (`Enter` on a valid region). Legend of biome glyphs (`?`).
- **Embark** (02): three tabs, footer with budget and `Embark`; Balanced is applied on opening. Missing pick or food/drink asks the default-No confirmation before embarking.
- **Trade session** (20): modal two-column table.
- **Legend**: the record of a fortress (see 24 › Legend record below); `Back`.
- **Settings**: keybindings (rebind by selecting a row and pressing a key), auto-pause toggles per severity, hints on/off, zoom, colorblind palette, edge scrolling, autosave on/off, `Reset to defaults`.
- **Load**: manual saves and autosaves with thumbnails; `Load`, `Delete` (confirm), `Export`, `Import`.

### The legend record

Written by the app when the fortress ends: name, seed, region name and ratings, years and days survived, peak population, deepest level reached, final wealth, milestones with dates (content `milestones`: first hearth, first metal, first cavern, fifty dwarves, magma forge, first deepsilver, a Hollow-born slain, a decade), kills of note, the last 50 alert or danger announcements, and the cause of the end ("The hall fell silent on Day 4 of Winter, Year 6. The last dwarf, Solveig Deephand, died of her wounds." or "Retired in Year 8 with 61 dwarves."). Shown on the legend screen and listed under `Legends` in the main menu.

Sea of Fire is awarded on `CavernBreached` 3. Kills of note are the three highest positive dwarf kill counts; the journal retains every count. After a tick carrying a creature death, the app checks extinction once, using the event's name and cause for the end record. The legend and view-only save share `final-<fortressSlug>`; its host never ticks and returns false for commands.

### Settings

The stored zoom applies to every game, new or loaded: a save records the zoom that was in effect, and loading fits again from the setting. Viewport fitting may use smaller cells without changing the requested zoom (23 § Canvas and cells). The binding table includes panel hotkeys and refuses collisions within a context and with global/map bindings that take precedence. Failed rebinding uses registry strings through the shared message helpers. Modifier errors say "Use a key with optional Ctrl or Shift."; conflicts say "Conflicts with {context}: {action}", using the player-facing context heading and Help wording, never binding ids. The bindings remain unchanged on failure. Only overrides of content defaults are saved. Additional binding contexts are appended after the panel bindings so older saved binding indices stay stable.

### Game menu (Esc from the fortress with no tool or panel)

`Resume`, `Save`, `Load`, `Settings`, `Rename fortress`, `Retire fortress` (confirm), `Main menu` (confirm if unsaved changes since the last save).

The game menu's Rename fortress row also works by mouse and is disabled in a view-only final save, as Save and Retire are. Its text input starts with the current name and uses the core `FORTRESS_NAME_MAX_CHARS` limit. Empty input remains in the dialog with its minimum-length reason; a command refusal uses the normal message path and names the 1–32-character rule. Help lists the menu action.

Unsaved changes are ticks elapsed or commands applied since the last save. A command given while the game is paused takes effect at once without the calendar advancing, so it counts as an unsaved change too; the count of applied commands is kept beside the last-save tick and is not saved.

### Accessibility and comfort

- No information is conveyed by color alone: state glyphs differ or the inspector states it in words.
- The colorblind palette setting.
- All text is at the cell size; zoom 1.5 is the large-text mode.
- The game never requires holding a key or fast input.

## State

Presentation-only: screen stack, active panel, tool state, cursor, selection, log lines, hints shown, settings, keymap overrides. Camera, z, zoom, overlays, hints shown and pending, bare-bedroom observation ticks, the open panel, whether a deepsilver vein has been found (it unlocks the Deep gauge, 18) and the last `LOG_SAVED_LINES` log lines with their categories are saved in the `ui` section; settings and keymap in the settings store.

## Interfaces

- `ui.registerPanel(spec)`, `ui.registerInspector(kind, section)`, `ui.registerAnnouncement(type, spec)`, `ui.registerHint(hint)`
- `ui.pushScreen(screen)`, `ui.popScreen()`, `ui.confirm(text) → Promise<boolean>`
- `ui.announce(severity, text, focus?)` (for app-level messages such as save errors)
- Input: `input.onKey`, `input.onMouse` from the platform; the keymap resolves to `UiAction`s.

### Reader (`readers.legend`)

The presentation UI exposes no simulation reader. The legend journal, a saved simulation system that shares id 24 and records what the legend record needs, exposes:

- `legend.peakPopulation()` — the highest population reached
- `legend.deepestZ()` — the deepest level reached
- `legend.kills()` — the kill tally, as name and count

### Events consumed (presentation subscriber)

All events, filtered through the announcement registry; `CommandRejected` (shows the reason in the status bar for `STATUS_HINT_SECONDS` and appends it to the log as an alert with the command's focus); `SeasonChanged` (autosave trigger lives in the app).

### Commands emitted

All commands, from panels and tools.

## Player-facing behavior

This entire document.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `LOG_MAX_LINES` | 2000 | In memory |
| `LOG_SAVED_LINES` | 200 | |
| `LOG_DEDUP_TICKS` | 100 | |
| `STATUS_HINT_SECONDS` | 4 | Rejection reason display time |
| `HINT_CHECK_HOURS` | 1 | |
| `UI_NORMAL_SPACING` | 3 | Normal gap between tabs and status fields |
| `UI_COMPACT_SPACING` | 1 | Gap when normal spacing does not fit the viewport |
| `EMBARK_PRESET_SPACING` | 4 | Normal gap before the Presets button |

## Keymap, screens, hints and milestones

The complete default keymap, the screen and panel lists with hotkeys, the mouse model table, the overlay list, the hint table with triggers and texts, the milestone table, the confirmation dialogs and the settings list are in [`../03-content/ui-keymap-and-screens.md`](../03-content/ui-keymap-and-screens.md). That file is the source of `keymap.json`, `hints.json` and `milestones.json`.

## Extension points

- New panels and inspector sections through registration.
- Localization: the strings table.
- Touch: a gesture layer producing the same actions.
- Macros and command scripting: commands are data; a panel that records and replays them fits the command log.
