# T-435 — Grey fringe lines beside glyphs

**Source:** the owner, 2026-10-23 (a screenshot of the main menu) · **Size:** S · **Needs:** — · **Status:** open

## Why

Thin grey vertical lines show at the edges of glyph cells, for example right of `]`, between `L` and `o`, and after `d` in the main menu. The orchestrator reproduced this at device pixel ratios 1, 1.25 and 1.5 at 1280×720. Besides the text colours and black, the menu holds partial-coverage tones: `#525252` is about 35% of the white text, and `#5d5d1f` about 35% of the yellow.

The cause is in `src/render/atlas.ts`:

- `build` draws the bundled bitmap font (unscii-8, an 8-pixel design) with `fillText`, centred in each `cellPx` slot (`textAlign: center` at `g × cellPx + cellPx/2`).
- The size comes from `fitFontPx`, a size fitted to the cell, not a whole multiple of the font's 8-pixel grid.
- The browser anti-aliases the glyph edges, so partly covered pixels land at a slot's edge or spill into the neighbouring slot.
- The renderer then copies each whole slot.

## Decisions

1. Glyphs are drawn crisp: every atlas pixel is either fully on or fully off.
   - Draw each glyph at the largest whole multiple of the font's design size that fits the cell, placed at integer offsets, and clip it to its own slot.
   - Then threshold the alpha (on at 50% or more), so no anti-aliased fringe survives.
   - Where the cell is not a whole multiple of 8, centre the glyph in the cell at integer offsets, with the leftover as empty margin. Do not stretch it by a fraction.
   - The full block `█` and the shade glyphs must still fill their cells edge to edge, because the block art and the map depend on it. Paint the block and shade glyphs (and the box-drawing lines that reach the cell edge) to the full cell, not from the font's smaller multiple.
2. Each slot's content stays inside its slot. A test shows that no pixel of glyph g+1 appears in slot g.
3. 23 or 24 (the renderer's spec) says the glyphs are crisp and how they are fitted.

## Done

- Unit tests:
  - at cell sizes 16, 18, 20, 24 and 30, every atlas alpha is 0 or 255;
  - `█` fills its cell;
  - no slot bleeds into its neighbour.
- The render goldens are re-recorded through golden:update, and the commit lists them.
- An e2e screenshot of the main menu at device pixel ratios 1 and 1.25 shows only palette colours in the text, with no partial-coverage tones.
- The six static checks, `npm test`, the whole e2e and the build pass. The golden world hashes do not move.
