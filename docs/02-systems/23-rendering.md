# 23 Rendering

**Owner:** `render/` · **Depends on:** [`../01-architecture/constants.md`](../01-architecture/constants.md), [`../01-architecture/module-interfaces.md`](../01-architecture/module-interfaces.md), [`../01-architecture/tech-stack.md`](../01-architecture/tech-stack.md), [24-ui-and-input.md](24-ui-and-input.md)

## Purpose

Draw the world and the interface as colored glyphs on one canvas, fast, with rules that make a z-level readable at a glance: one glyph per thing, color for material and state, levels below showing through, and overlays that never hide what matters.

## Concepts

- **Cell**: one screen position: `{ glyph, fg, bg }`. The whole screen is a cell grid: map viewport, sidebar, status bar and log all share it.
- **Glyph**: an index into the glyph set (CP437 plus the extras in `glyphs-and-colors.md`).
- **Palette**: named colors: 16 base colors, material colors, state colors, and tints derived by dimming.
- **Atlas**: pre-rendered glyph bitmaps for one zoom and one foreground color, cached per color.
- **Compositor**: the rules that decide each map cell's glyph and colors from readers.
- **Overlay**: an optional layer drawn over the map cells (designations, zones, fluid levels, temperature, jobs, debug).
- **Viewport**: the tile rectangle shown: `(camX, camY, z, cols, rows)`.

## Rules

### Canvas and cells

- One `<canvas>` filling the window, sized in device pixels (`devicePixelRatio` aware), CSS-sized to the window. Cell size `CELL_PX_ZOOM_1 × zoom`.
- `cols = floor(canvasWidth / cellPx)`, `rows = floor(canvasHeight / cellPx)`. If `cols < MIN_VIEW_COLS` or `rows < MIN_VIEW_ROWS`, the zoom steps down to the next available level; below the smallest zoom the canvas is scaled with CSS (blurry but complete).
- Two zooms exist. The *requested* zoom is the Zoom setting (`Auto` or a level of `ZOOM_LEVELS`); it changes only in Settings or with `Ctrl+↑` and `Ctrl+↓`. The *fitted* zoom is what the rule above gives for the present canvas; it is never written back to the setting. Every resize fits again from the requested zoom, so a window that grows back gets its cell size back.
- `Auto` asks for the largest level of 1 or more at which the grid has at least `AUTO_ZOOM_MIN_COLS` × `AUTO_ZOOM_MIN_ROWS` cells, and for 1 when no level does. A 1280 × 800 canvas gives 80 × 50 cells at zoom 1, 1920 × 1080 stays at zoom 1, 2560 × 1440 uses 1.5, 3840 × 2160 uses 2 (120 × 67 cells). `Ctrl+↑` and `Ctrl+↓` leave `Auto` for a fixed level one step from the one shown.
- Layout: status bar takes the bottom `STATUS_ROWS`; the log strip takes `LOG_ROWS` above it; the sidebar takes the right `SIDEBAR_COLS` when open; the map viewport is the rest.
- The frame draws every cell from the cell buffer: fill `bg` rect, then draw the glyph from the atlas for `fg`. Cells with the same `bg` in a run are filled as one rect (an optimization the renderer may apply; the result is identical).
- A frame is skipped when nothing changed: the simulation tick count, the UI state hash, the camera, and the animation phase are compared with the last frame's.

### Atlas

- The font is drawn once per zoom into an offscreen canvas per foreground color on demand (`glyphCount × cellPx²`), cached in an LRU of `ATLAS_COLOR_CACHE` colors. Glyph shapes are identical for every color: they are read from the font once per atlas and each color's sheet is written pixel by pixel from them.
- Glyphs are crisp: every atlas pixel is the color at full opacity or empty, and each glyph stays inside its own cell of the sheet. The bundled font is a bitmap design `ATLAS_FONT_DESIGN_PX` pixels square. Its shapes are read by drawing each glyph at `ATLAS_FONT_SAMPLE` times that size, where `█` fills its square exactly, and taking a design pixel as on when at least half of its sample square is covered, so no anti-aliased edge survives.
- A glyph is drawn at the largest whole multiple of the design size that fits the cell, centred at whole-pixel offsets; a cell that is not a whole multiple keeps the rest as an empty margin, and a glyph is never stretched by a fraction. The block elements, the shades and the box-drawing glyphs (U+2500 to U+259F) instead cover the whole cell, each cell pixel taking the design pixel under it, so they join their neighbours edge to edge.

### Palette

- Base 16: black, dark gray, gray, white, dark red, red, dark green, green, dark yellow (brown), yellow, dark blue, blue, dark magenta, magenta, dark cyan, cyan.
- Material colors: each material row names a color from an extended list of about 60 (`granite_gray`, `hematite_red`, `oak_brown`, `copper_orange`, `deepsilver_blue` …) defined in `glyphs-and-colors.md`.
- State colors: `dwarf_normal`, `dwarf_need`, `dwarf_wounded`, `dwarf_asleep`, `dwarf_child`, `dwarf_soldier`, `hostile`, `trader_<civ>`, water and magma ramps (4 shades each), designation tints, zone tints, `undiscovered`, `sky_day`, `sky_night`, `abyss`.
- Dimming: `dim(color, level)` multiplies RGB by `DIM_FACTOR^level` (`level` 1 or 2 for tiles below, plus night and fog steps). Computed once per color and cached.
- A colorblind-safe alternative palette swaps the reds and greens used for state to blue/orange pairs; state glyphs also differ in shape so color is never the only signal. Both palettes hold CIEDE2000 ΔE ≥ 15 for the side-by-side state pairs, including hostile/wounded dwarf and key text/alert.

### Compositor

For each viewport cell, tile `t = (camX + col, camY + row, z)`:

1. **Undiscovered**: if not `discovered(t)`: `{ ' ', undiscovered, undiscovered }`. Skip the rest, except overlays that the player placed there (a designation on an undiscovered tile is drawn as `░` in its tint over the undiscovered background).
2. **Terrain base** by kind and flags:
   - `wall`: rough `▒`, smoothed `█`, engraved `☼`-style engraved glyph (`03-content/glyphs-and-colors.md` fixes the set), `fg = material color`, `bg = black`. Constructed walls use the block glyph regardless.
   - `floor`: rough `.`, smoothed `+`, engraved engraved-floor glyph, `fg = material color`; grass → glyph `"` with `fg` grass green (cave moss: blue-green); mud → `fg` brown; snow → `bg` white and `fg` gray; ash → `fg` dark gray; paved → `≡`.
   - `ramp` `▲`, `stairs_up` `<`, `stairs_down` `>`, `stairs_updown` `X`, `fortification` `╬`, `tree` species glyph (`♣`, `♠`, `↑`), `sapling` `τ`, `shrub` `"` in species color, `boulder` `○`.
   - `open`: look down through `open` tiles up to `LEVELS_VISIBLE_BELOW` levels; draw the first non-open tile's base cell dimmed by its depth; if the column is open all the way down that far, draw `{ ' ', -, outdoor ? sky : abyss }`. Fluids in `open` tiles below are drawn dimmed too.
3. **Fluid** on `t`: water `~` for levels 1–2, `≈` for 3–7, `fg` from the water ramp by level band, `bg` `water_bg` for levels 1–6 and `blue` at level 7; magma the same with the magma ramp, `magma_bg` and `dark_red` at level 7. Ice is a `wall`/`floor` with the `ice` material color. Mist sets the `bg` to `mist_bg`. A burning tile is drawn after the fluid: `^` in `yellow` on the even phase of the 1000 ms clock and `‼` in `red` on the odd one.
4. **Building** on `t`: the building's glyph and color from its type row (workshops have a 3×3 glyph pattern; the pattern cell for this tile is used), planned buildings dimmed (`text_dim`), with `bg` from the terrain. A built construction is terrain and step 4 leaves it to step 2; a planned one draws its row glyph. A workshop with no pattern draws its row glyph. A pattern takes the footprint offset turned by the building's orientation (quarter turns clockwise), and a magma variant draws it in `magma_2`. Doors: `+` closed, `/` open (drawn open while a creature is on it), locked doors in red. Bridges: `═` lowered, `▓` raised. Floodgates `╪`. Levers `/` and `\` by state. Traps: `^` in trap color (only visible to the player; hostiles' knowledge is not modeled). The hearth `☼` in orange with a `bg` that pulses between `black` and `#3A1A00` on the 1000 ms clock.
5. **Items** on `t`: the top item (highest value; corpses win over other items so the player notices them) with the category glyph and material color; if more than one item, the `bg` is blended with `gray` at `ZONE_TINT_ALPHA`. Items inside buildings (stockpile containers) show the container's glyph.
6. **Creature** on `t` (if any, topmost by priority: dwarves > hostiles > tame > wild > vermin): species glyph, color by state; unconscious creatures alternate with `_` each second; stealthed hostiles are not drawn; a creature carrying an item shows the item's glyph in the inspector, not on the map.
   Creature classes are fortress dwarf, hostile (`hostile*` or `deep`), tame (`Tame` or another fortress creature), and wild; ties use the lowest id. A dwarf's state colour takes precedence in this order: wounded or unconscious, asleep, on duty, child, need, normal. Harvest uses `des_gather`. The `priority_digits` overlay is off by default and never replaces a creature glyph.
7. **Projectile** on `t`: `-`, `|`, `/`, `\` by direction, in `white`, over everything.
8. **Overlays** (each toggled in the overlay menu, 24):
   - `designations` (default on): `bg` tinted by designation kind (dig blue, channel cyan, stairs magenta, ramp purple, smooth light gray, engrave white, remove red, chop green, gather yellow-green), priority digit as glyph when the `priority digits` sub-toggle is on.
   - `zones` (default on): `bg` tinted by zone type at low alpha, blended at `ZONE_TINT_ALPHA` over the cell's own `bg` and never darker than `ZONE_TINT_MIN_LUMA` in relative luminance (a tint on a black cell is lifted to that floor; glyph colours do not change); the tiles of the zone selected in the Zones panel blend at twice the alpha, with the same floor (where the floor makes that equal to an unselected zone's tint, its channels are scaled up by `1 + ZONE_TINT_ALPHA`, so the selection always shows); stockpiles gray-blue, farm plots brown, pastures green, bedrooms violet, dining halls gold, hearth hall orange, hospital white-red, barracks steel, tomb dark gray, dump dark yellow, fishing blue, gather olive.
   - `fluid levels`: level digits over fluid tiles.
   - `temperature`: `bg` ramp from `blue` at `TEMPERATURE_RAMP_COLD_C` and below to `red` at `TEMPERATURE_RAMP_HOT_C` and above, blended in between (computed for visible tiles only).
   - `jobs`: tints claimed jobs' target tiles `alert` and their workers' remaining routes `text_value`.
   - `squad stations`: station tiles take the `zone_barracks` tint and patrol tiles the `zone_range` tint, blended into the `bg` at `ZONE_TINT_ALPHA`.
   - `stockpile usage`: a stockpile's fullness is its used slots over its tiles, `(tiles − freeSlots) / tiles`; each of its tiles blends `green` (below one half), `yellow` (below full) or `red` (full) into its `bg` at `ZONE_TINT_ALPHA`.
   - Debug `paths` tints every mover's remaining route `text_value`; `connectivity` tints walker labels through a cycle of base palette colours, leaving label 0 untinted; `chunks` tints chunk-edge cells `panel_border`. All four jobs/debug overlays change only `bg` through `blend` at `ZONE_TINT_ALPHA`. Claimed jobs and movers are indexed once per frame, never per cell.
   Overlays alter `bg` or replace the glyph but never hide a creature; when an overlay glyph would cover a creature, the creature wins.
9. **Lighting**: outdoor tiles at night are dimmed one step (two under storm); fog dims the surface one step; underground tiles are not dimmed (the player sees what the dwarves know). A cell whose look-down found only sky keeps the colour step 2 gave it (`sky_night` at night) and is not dimmed again.
10. **Cursor and selection**: the look cursor is drawn as an inverted cell (`fg`/`bg` swapped); a selection rectangle inverts its border cells; a building ghost draws a black `▒` on `ghost_ok` or `x` on `ghost_bad` as `bg` by validity. Clipped UI text has a full-text tooltip in the status row and a box above the hovered cell.

The world-map compositor draws a biome cell, replaces it with blue `~` for a river region, then with the civilization home glyph and color if present. A rejected filter region dims one step via `dim(c, 1)`; matching regions retain full color. The cursor inverts foreground and background after filtering.

### Animation

Only presentation state animates; the simulation is discrete:

- The presentation clock is `ViewState.animFrame`, the app's wall clock in periods of `FLUID_ANIM_MS` (`core` never reads it). The fast phase is its parity; the 1000 ms clock (fire, blink, the hearth pulse) is `animFrame >> 1`.
- Active fluid tiles (04's `isActive`) alternate `≈`/`~` on the fast phase; settled tiles do not animate (a still lake looks still; a river shimmers).
- Crop foreground uses `grass_green` dimmed by 3/2/1/0 for stages 0/1/2/3; a ready crop flashes `green` for one 500 ms phase in each four-phase cycle. Read readiness through `plants.cropReady`, which requires the fourth stage to finish.
- Fire alternates `^`/`‼` and yellow/red.
- The hearth `bg` pulses.
- Rain (and storm) draws `'` on a few random outdoor cells per frame; snow draws `*`. The cells are the outdoor `open` cells with no creature, one in `PARTICLE_ONE_IN` chosen by a hash of the cell and the frame, so that a golden stays reproducible.
- A designated tile whose job is not done blinks on the fast phase (about 2 Hz), as 03's `terrain.designationWork(i)` says: **queued** (no worker has its job yet, or it has no job yet) alternates between the designation tint and the bare tile; **assigned** (a worker holds its job) keeps the tint and alternates between it and the tint brightened by `DESIGNATION_PULSE_FACTOR`; **blocked** keeps the steady tint. An undiscovered designation's outline does not blink. Phase 0 of the fast clock draws the steady tint, so a still frame (`animFrame` 0) shows every designation steady. With `ViewState.reducedMotion` (the Reduced motion setting, and always in a test build: e2e and screenshots) no designation blinks.
- Unconscious creatures blink; danger-flagged creatures (a dwarf being attacked) get a red `bg` flash for one second on the first attack of an attacker and defender pair; later attacks of the same pair do not flash again (the engagement boundary of 16's combat announcements).

### Viewport and camera

- The camera is clamped so the viewport never shows outside the map; the map is not wrapped.
- `centerOn(tile)` sets the camera so the tile is centered and switches `z`.
- Changing `z` keeps `camX, camY`.
- Zoom changes keep the tile under the mouse cursor fixed.

### Text cells

Panels and bars are drawn as text into the same cell buffer by the UI's widgets: `fg` text colors (white, gray, yellow for shortcuts, cyan for values, red/green for bad/good), `bg` black or a dark panel color, inverted for selection. Panel borders use box-drawing glyphs. The renderer does not know the difference between a map cell and a text cell.

## State

Presentation-only: atlases, cell buffers (two, for change detection), camera, animation phase, overlay toggles, last-frame hashes. None of it is saved except camera, `z`, the zoom in effect and overlay toggles (in the `ui` save section).

## Interfaces

- `render.compose(readers, uiState) → CellBuffer`
- `render.draw(cellBuffer)`
- `render.registerOverlay(spec)` (from the registration API)
- `render.cellAt(mouseX, mouseY) → { col, row }`, `render.tileAt(col, row) → TileIndex | null`
- `render.centerOn(tile)`, `render.setZoom(z)`, `render.camera()`

### Events consumed (presentation subscriber)

`TilesChanged`, `FluidsChanged`, `EntitiesMoved`, `BuildingStateChanged`, `ZoneChanged` (mark chunk render-dirty; the compositor may cache unchanged chunks' base cells), `AttackResolved` (flash). The announcement log pauses and centers through its presentation path, without an additional simulation event.

### Registrations

None; this is the registrar for overlays.

## Player-facing behavior

Everything visible. The overlay menu (24) lists overlays with their toggles; the legend panel (`?` › Legend) lists glyphs and colors by category, generated from the content tables.

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `LOG_ROWS` | 3 | Announcement strip above the status bar (*unmeasured*) |
| `ATLAS_COLOR_CACHE` | 128 | Colored atlases kept (*unmeasured*) |
| `ATLAS_FONT_DESIGN_PX` | 8 | The bundled font's design grid, pixels square |
| `ATLAS_FONT_SAMPLE` | 4 | Times the design size at which the font's shapes are read |
| `DIM_FACTOR` | 0.55 | Per dimming step (*unmeasured*) |
| `FLUID_ANIM_MS` | 500 | *unmeasured* |
| `AUTO_ZOOM_MIN_COLS` | 100 | Columns the `Auto` zoom keeps at least (*unmeasured*) |
| `AUTO_ZOOM_MIN_ROWS` | 56 | Rows the `Auto` zoom keeps at least (*unmeasured*) |
| `ZONE_TINT_ALPHA` | 0.25 | Blend factor for zone backgrounds (*unmeasured*) |
| `DESIGNATION_PULSE_FACTOR` | 1.5 | An assigned designation's tint on its bright phase, every channel times this (*unmeasured*) |
| `ZONE_TINT_MIN_LUMA` | 0.18 | Least relative luminance of a zone's background (*unmeasured*) |
| `TEMPERATURE_RAMP_COLD_C` | −20 | At or below this the `temperature` overlay is `blue` (*unmeasured*) |
| `TEMPERATURE_RAMP_HOT_C` | 40 | At or above this the `temperature` overlay is `red` (*unmeasured*) |
| `PARTICLE_ONE_IN` | 16 | One eligible outdoor cell in this many carries a rain or snow particle each frame (*unmeasured*) |

Glyphs and colors per thing are content.

## Extension points

- Tileset support: swap the atlas source for an image of the same glyph indices; the compositor is unchanged.
- WebGL renderer: implement `draw(cellBuffer)` with instanced quads; the compositor is unchanged.
- Multi-level view (drawing several levels at once, transparency): the compositor's step 2 already walks levels below; a mode could draw levels above at low alpha.
- Smooth camera scrolling: presentation-only interpolation of the camera between frames.
