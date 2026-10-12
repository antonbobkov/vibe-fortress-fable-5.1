# T-281 — The zoom returns when the window grows back; large windows get a larger cell

**Source:** T-116 and its report, [`../../reports/audits/2026-10-12-ui-ux.md`](../../reports/audits/2026-10-12-ui-ux.md) (issue 10, § 6, § 9) · **Size:** S · **Needs:** — · **Status:** open; the second decision changes the default look on large screens, so the owner should see it. Recommendation: add the automatic default

## Why

When the window is made smaller than the zoom allows, the zoom steps down so that the minimum grid fits. When the window grows back, the zoom stays down: 1280×800 then shows 106×66 cells of 12 pixels instead of 80×50 cells of 16. The player's text has shrunk for the rest of the session and nothing says why. At 3840×2160 the default zoom gives a 240×135 grid, and a 96-tile map fills a quarter of the window.

## Reproduction

Any fortress at 1280×800 (grid 80×50). Resize the window to 960×540, then back to 1280×800: the grid is 106×66 (capture 4/48, 6/44, `44-E-back-1280x800-fortress.png`). Code: `resize` writes the fitted zoom over the setting, `this.ui.zoom = fit.zoom` (`src/app/game.ts:1113`). At 3840×2160: `28-E-3840x2160-fortress.png`.

## What the spec says

- [`23-rendering.md`](../02-systems/23-rendering.md) § Canvas and cells: "If `cols < MIN_VIEW_COLS` or `rows < MIN_VIEW_ROWS`, the zoom steps down to the next available level; below the smallest zoom the canvas is scaled with CSS". `ZOOM_LEVELS` = 0.75, 1, 1.5.
- [`menus-and-world.md`](../04-implementation/ui-screens/menus-and-world.md) § Settings: the Zoom row.

## What to do

**Decisions.**
- **Two values.** The *requested* zoom is the player's setting and changes only in Settings or with `Ctrl+↑` and `Ctrl+↓`. The *fitted* zoom is what `computeViewport` returns for the present window and is never written back. Every resize fits again from the requested zoom, so a window that grows back gets its cell size back.
- **Automatic default.** The Zoom setting gains the value `Auto`, which is the default for a new profile: the largest level in `ZOOM_LEVELS` at which the grid is at least `AUTO_ZOOM_MIN_COLS` × `AUTO_ZOOM_MIN_ROWS` = 100 × 56 cells, and zoom 1 when no level reaches that (so 1280×800 stays 80×50 at zoom 1, 1920×1080 stays at zoom 1, 2560×1440 and larger use 1.5). `Ctrl+↑` and `Ctrl+↓` leave `Auto` for a fixed level. A stored setting from before this change keeps its fixed value. Define the two constants in 23 § Tuning constants and `src/render/constants.ts`.
- **A level for very large screens.** `ZOOM_LEVELS` gains 2 (32-pixel cells), so that `Auto` gives 120×67 at 3840×2160. The atlas is built per zoom already.
- **Feedback.** When the fitted zoom is lower than the requested one, Settings shows "Zoom 1 (shown at 0.75: the window is small)".

1. Amend 23 § Canvas and cells and § Tuning constants, `src/core/constants.ts` and `src/render/constants.ts` with them, and `menus-and-world.md` § Settings.
2. Implement in `src/app/game.ts`, `src/render/cellbuffer.ts`, `src/ui/settings.ts`, `src/ui/screens/settings.ts`.
3. Tests, `describe('T-281 …')`: shrink and regrow returns the grid to 80×50; `Auto` at 1280×800, 1920×1080, 2560×1440 and 3840×2160; a stored fixed zoom is kept. The e2e suite runs at 1280×800, where nothing changes; no golden should move.

## Done

- The reproduction ends at 80×50, and a new profile at 3840×2160 opens at 120×67.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
