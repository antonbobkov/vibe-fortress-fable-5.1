# T-433 — A second intro: big block art, much wilder

**Source:** the owner, 2026-10-23 · **Size:** L · **Needs:** — · **Status:** open

## Why

The owner found the intro of T-423 too tame. Classic text-mode fortress games opened with intros drawn in huge block art: the shade glyphs `█ ▓ ▒ ░` used as pixels, figures many cells tall, a harsh 16-colour palette (cyan, white, grey and brown on black) and dramatic, slightly unhinged scenes. The owner's reference is a still of a hooded figure under a breaking cyan wave of shaded blocks. Keep the T-423 intro, and add a second one in that spirit.

## Decisions

1. **Original.** Take the visual style (block-shade pixel art, a 16-colour EGA-like palette, dithering, scale, drama), not the content. No scene, figure, composition or story beat is copied, traced or recreated from Dwarf Fortress's intro or any other game's. A suggested story, "The Deep Answers", keeps Deepholm's world:
   - A lone dwarf with a lantern descends a shaft, shown huge with a swinging lantern glow.
   - Something vast stirs below: an eye the size of the screen opens in the rock.
   - A torrent of glowing cyan water, or magma, bursts through the wall in rolling dithered waves.
   - The dwarf stands, raises a pick, and strikes.
   - A white flash and a screen shake, then rock shatters into the DEEPHOLM title in huge block letters.
   - Keep a wink of humour: for instance, the eye blinks, or the dwarf calmly finishes a mug first.
   - About 40 to 60 seconds, fast cuts, energetic.
2. **The look.**
   - Each art pixel is one cell, filled with a block or shade glyph in a palette colour. Figures are at least 12 to 20 cells tall.
   - The 16 colours are defined in content.
   - Supported effects: palette cycling (water and magma shimmer), camera pans and zooms (2× cell scaling for close-ups), screen shake, white flash frames, dithered fades, and parallax in at least one scene.
   - It fills any window size: the stage scales to the window by whole-cell multiples and the background extends to the edges.
3. **Data, not code.**
   - Scenes are content: compact bitmaps as rows of palette letters, layers, keyframes and effects, in a new content file beside intro.md, checked by `content:check`.
   - The renderer and animator generalise what T-423 built. They do not fork it.
   - Captions, if any, go through strings and are sparse: the pictures carry it.
4. **Both intros stay.**
   - A setting "Intro style" offers the new one ("deep", the default) or the T-423 one ("hall").
   - "Intro at launch" and the main menu's `[i] Intro` play the chosen style.
   - Skipping and the fixed-key rule are as for T-423.
5. **Music.**
   - An original, intense piece for the new intro: low drums, a rising drone and a hit on the flash. Its own tune entry, chosen by intro style; the T-423 piece stays with the hall intro.
   - Within the music content checks: equal voice lengths, and a sawtooth filtered at 2000 Hz or below.
6. **Spec first.** menus-and-world § Intro, the settings tables, 24 § Music, and the new content file's doc.

## Done

- The new intro plays at launch and from the menu by default, and the hall intro by setting.
- The unit tests and the T-423 e2e still pass. A new e2e saves three frames of the new intro to `reports/screenshots/`.
- The six static checks, `npm test`, the whole e2e and the build pass. The golden world hashes do not move.
