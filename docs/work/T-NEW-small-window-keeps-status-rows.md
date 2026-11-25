# T-NEW — A window under 960 × 540 loses the status bar, the key bar and the hover line

**Source:** playtest 2026-11-25 (newcomer) ([report](../../reports/data/2026-11-25-playtest-5.md), finding 4) · **Size:** S · **Needs:** — · **Status:** open

## Why

The step-down rule of 23 § Canvas and cells keeps the grid at `MIN_VIEW_COLS × MIN_VIEW_ROWS` (80 × 45) below the smallest zoom and "scales the canvas with CSS (blurry but complete)". It is not complete. With the fortress open and the window resized:

- **960 × 480** (half a 1920 × 1080 screen beside a guide, or a short laptop browser): the grid is 80 × 45 at 12 px cells, which is 960 × 540 px. The canvas backing store is 960 × 480, so the bottom 60 px (rows 40 to 44) are never drawn. Those rows are the second log line, status row 1 (date, pause, `[Esc] menu  [?] help`), the key bar and the hover line. The element is then CSS-scaled to 853 × 426, so the window's bottom 54 px are black too (`39-960x480.png`).
- **960 × 360** (80 × 30 cells at the smallest zoom): the backing store is 960 × 360 and the element 640 × 240. A third of the window shows a third of the grid, and none of the bottom rows (`38-small-80x30.png`).

So in a small window a newcomer has no status bar (no pause indicator, no date), no key bar, and no `[?] help` button. A click is mapped through `cssScale` onto cells that were never drawn. At 1366 × 650 (zoom 0.75, 113 × 54 cells) everything is drawn (`40-1366x650.png`).

The cause is in `src/platform/canvas.ts` `resize`. Its comment says "the backing store keeps the full grid and the element is drawn smaller", but it sizes the backing store to the window (`cssWidth × dpr`) and then shrinks the element by `cssScale` as well.

## What to do

Decisions:

- **Below the smallest zoom the backing store is the grid**: `MIN_VIEW_COLS × cellPx` by `MIN_VIEW_ROWS × cellPx` device pixels. The element is that size divided by `dpr`, times `cssScale`, so it fits the window and shows every row. The unused strip of the window (right or bottom) stays the page's background.
- Pointer mapping (`cellCenter`, the click and hover cell) uses the same scale, so a click lands on the cell drawn under it.
- At and above the smallest zoom nothing changes: the backing store is the window, `cssScale` is 1.
- 23 § Canvas and cells already states the rule. Add "the backing store keeps the full grid" to it, so the spec says what the comment says.

## Done

- [ ] Tests (`describe` with the task id): `computeViewport` + the surface's resize at 960 × 480 and at 960 × 360 (dpr 1 and 2) give a backing store of 960 × 540 device pixels at dpr 1 and an element that fits the window. A jsdom game at 960 × 480 draws status row 1 and the key bar (their text is in `textRows()`). `cellCenter(0, 44)` lies inside the window, and a click there resolves to row 44.
- [ ] An e2e check at 960 × 480: `[?] help` on status row 1 is clicked and Help opens.
- [ ] Render only: no world hash moves. Render goldens at 1280 × 800 are unchanged.
