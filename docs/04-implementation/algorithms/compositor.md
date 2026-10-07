# Algorithm: Compositor and Frame

**Owner:** `render/` · **Depends on:** [`../../02-systems/23-rendering.md`](../../02-systems/23-rendering.md), [`../../03-content/glyphs-and-colors.md`](../../03-content/glyphs-and-colors.md)

```
frame(now):
  hash = (host.tickCount, ui.stateHash(), camera, animPhase(now))
  if hash == lastHash: return
  cells = compose(); draw(cells); lastHash = hash
compose():
  layout = computeLayout(canvasCols, canvasRows, sidebarOpen)     // map rect, sidebar rect, log rect, status rect
  for row in 0..map.rows-1: for col in 0..map.cols-1:
    x = camX + col; y = camY + row; z = camZ; if out of map: cells[...] = { ' ', black, black }; continue
    cells[row][col] = composeMapCell(idx(x,y,z), x, y, z)
  ui.drawPanels(cells, layout)     // sidebar, log strip, status bar as text cells
  drawCursor(cells)
  return cells
composeMapCell(i, x, y, z):
  if not (flags[i] & Discovered): c = { ' ', undiscovered, undiscovered }; return overlays(c, i, undiscoveredOnly=true)
  c = terrainCell(i)
  if kind[i] == Open:
    for k in 1..LEVELS_VISIBLE_BELOW: j = idx(x,y,z-k); if z-k < 0: break
      if kind[j] != Open or level(fluid[j]) > 0: c = dim(fullCell(j), k); break
    else: c = { ' ', -, outdoor(i) ? (daylight ? sky_day : sky_night) : abyss }
  c = fluidOver(c, i); c = buildingOver(c, i); c = itemOver(c, i); c = creatureOver(c, i); c = projectileOver(c, i)
  c = overlays(c, i); c = lighting(c, i)
  return c
fullCell(j) = creatureOver(itemOver(buildingOver(fluidOver(terrainCell(j), j), j), j), j)   // levels below show everything, dimmed
terrainCell(i): per the glyph table: kind, flags (Smoothed, Engraved, Constructed, Grass, Mud, Snow, Ash), material color, moss vs grass by outdoor
fluidOver(c, i): f = fluid[i]; if level(f) == 0 or frozen(f): return c
   glyph = level <= 2 ? '~' : '≈'; if active(i) and animPhase odd: glyph = other; fg = ramp[type][band(level)]; bg = type bg; return { glyph, fg, bg }
buildingOver(c, i): b = buildingAt.get(i); if not b: return c; d = def(b.type); glyph = pattern? pattern[tileOffset] : stateGlyph(b); fg = planned ? text_dim : colorOf(b); bg = c.bg (hearth: pulse); return
itemOver(c, i): items = spatial.at(i).items (excluding those inside containers on the tile); if empty: return c; top = corpses first, then max value; return { glyphOf(top), colorOf(top), items.length > 1 ? tint(c.bg) : c.bg }
creatureOver(c, i): cs = spatial.at(i).creatures.filter(drawable: not stealthed); if empty: return c; top = by priority dwarf > hostile > tame > wild; glyph = unconscious and blink ? '_' : glyph(top); fg = stateColor(top); bg = flash(top) ? red : c.bg
overlays(c, i): for ov in activeOverlays (fixed order): c = ov.apply(c, i)    // designation tint bg; zone tint blend; digits replace glyph only if no creature; temperature bg ramp; jobs highlight; stations
lighting(c, i): if outdoor(i): if not daylight: c = dim(c, storm ? 2 : 1); if fog: c = dim(c, 1); return c
dim(c, k): { c.glyph, dimColor(c.fg, k), dimColor(c.bg, k) }   // cached per (color, k)
draw(cells): ctx.clearRect; for each run of equal bg in a row: fillRect; for each cell with glyph != ' ': ctx.drawImage(atlas(fg).canvas, sx, sy, cell, cell, dx, dy, cell, cell)
atlas(fg): LRU get or build: offscreen canvas glyphCount × cell; for each glyph: fillText in white centered; then globalCompositeOperation 'source-in' fillRect with fg
```

Animation phase: `animPhase(now) = floor(now / FLUID_ANIM_MS) & 1`; blink and pulse use the same clock at 1000 ms. `active(i)` for fluids reads the settled bit (settled → no animation).

Mouse mapping: `cellAt(px, py) = (floor(px / cellPx), floor(py / cellPx))`; `tileAt(col, row)` = map rect check then `camX + col, camY + row, camZ`.

Layout: `sidebarCols = open ? SIDEBAR_COLS : 0`; `mapCols = cols − sidebarCols`; `mapRows = rows − STATUS_ROWS − LOG_ROWS`; zoom step-down when the canvas grid has `cols < MIN_VIEW_COLS` or `rows < MIN_VIEW_ROWS` (the test is over the canvas, as 23 § Canvas and cells says, not over the map rectangle that the sidebar, log strip and status bar make smaller).
