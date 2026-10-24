# T-434 — The deep intro without chapter cards or zooms

**Closed:** 2026-10-23, in 2fe18c0.

**Source:** the owner, 2026-10-23, on T-433 · **Size:** S · **Needs:** — · **Status:** open

## Why

The owner likes "The Deep Answers" (T-433), with two changes:

- The intro is too short for chapters.
- Zoom animations do not look good with ASCII graphics.

## Decisions

1. **No chapter cards.** Remove both cards ("Chapter I: The Lantern" and "Chapter II: The Deep Answers"). The film cuts straight from scene to scene. The lantern-down-the-pit and cyan-crack images may survive as short establishing shots inside the neighbouring scenes, or be dropped, whichever reads better.
2. **No zooms of any kind.**
   - The art is always drawn at its native scale: one art pixel to the strip's cell scale, never enlarged.
   - Remove push-ins, the 2× zoom on the eye, the punch-in on the burst, and any eased scale change.
   - A close-up is a separate image drawn at native scale and reached by a cut.
   - Pans, parallax, shake, flash, fades, static reveals, palette cycling and speckle stay.
   - Remove the zoom effect from the content schema and its doc.
3. **Timing.** The film gets shorter by the cards' time. Retime the music piece "The Deep Answers" to the new timeline, so its hits still land on the flash and the strike, and its close still lands on the title.

## Done

- The deep intro has no chapter card and never changes scale. Its unit tests and e2e frames are updated, with no zoom test left.
- The six static checks, `npm test`, the whole e2e and the build pass. The golden world hashes do not move.
