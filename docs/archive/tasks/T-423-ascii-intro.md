# T-423 — An ASCII-art intro sequence

**Closed:** 2026-10-23, in 7f25072.

**Source:** the owner, 2026-10-22 · **Size:** M · **Needs:** T-113 · **Status:** open

## Why

The owner asked for a playful animated intro made of text glyphs, of the kind classic text-mode fortress games open with.

## Decisions

1. **Original.** The story, the scenes and every frame are written for Deepholm. Nothing is copied or traced from another game's intro. A suggested story: a band of seven dwarves leaves a crowded hold, crosses the surface past a wagon and some wildlife, and strikes the first pick into a mountainside; the title "Deepholm" then rises out of the rock. Keep it short (about 30 to 60 seconds), light in tone, and in the game's own glyphs and palette.
2. **Rendered by the game's renderer.** Scenes are drawn with the game's glyphs and colors on the existing text grid, at any window size. Scenes and their timing are data, kept as content beside the strings so they are checked like other content. Any text goes through `strings`.
3. **When it plays.**
   - Once on first launch, before the main menu.
   - Again from a main-menu entry ("Intro").
   - Any key or click skips it.
   - A setting turns it off at launch.
   - Tests and e2e skip it by default.
4. **Music.** If T-422 has landed, the intro has its own short piece. Otherwise it is silent; it must not wait on T-422.
5. **Spec first.** Add the screen to the menus-and-world screen spec and to the hotkey table before the code.

## Done

- The intro plays on first launch and from the menu, skips on any key, and the setting stops it at launch.
- An e2e test checks the skip and the menu entry, with a screenshot of one frame in `reports/screenshots/`.
- The six static checks, `npm test`, e2e and the build pass.
