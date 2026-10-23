# T-NEW — A short piece of music for the intro

**Source:** T-423 (the intro), 2026-10-23 · **Size:** S · **Needs:** T-423 · **Status:** open

## Why

The intro (`docs/04-implementation/ui-screens/menus-and-world.md` § Intro) is its own music scene, `intro`, but its mood is the menu's: the main-menu theme plays under it and runs on into the main menu (`docs/02-systems/24-ui-and-input.md` § Music). The intro task's work file wanted a short piece of its own once the music had landed; T-423 left the hook and did not write one.

## Decisions

1. **Original**, as every tune (`docs/03-content/music.md`): about 45 seconds, light, written for Deepholm.
2. **A tune role `intro`** in `music.md` § Tunes; `moodOf('intro')` in `src/ui/music.ts` returns it, and the director plays it once (not again after a gap). When it ends or the intro is skipped, the menu theme starts after `MUSIC_CHANGE_GAP_S` as on any change of mood.
3. At launch no audio exists before the first key or click, which also skips the intro, so the piece is heard only when the intro is opened from the main menu. Say so in 24 § Music; do not try to start audio earlier.

## Done

- The piece plays under the intro from the menu entry and stops on a skip; a unit test covers the director's choice for the `intro` scene; the content checks, `npm test` and e2e pass.
