# T-422 — Music

**Source:** the owner, 2026-10-22 · **Size:** L · **Needs:** T-113 · **Status:** open

## Why

The owner asked for music. Audio is in scope as a presentation-layer listener on the event bus ([scope.md](../00-vision/scope.md), extensions), and the tech stack ships no audio files ([tech-stack.md](../01-architecture/tech-stack.md)).

## Decisions

1. **Synthesized, not sampled.** The music is played by the Web Audio API from note data. There are no audio files, so the tech stack's rule holds. Tunes and instruments (oscillator shapes, envelopes, a little reverb) are content, defined like the other content tables and checked by `content:check`.
2. **Original.** Every tune is written for Deepholm. Nothing is transcribed or adapted from another game's soundtrack or from any copyrighted piece. Traditional public-domain folk tunes may be used only if their source is named in the content table.
3. **What plays.**
   - A main-menu theme.
   - Fortress music: several pieces that play in turn with silence between them, as a background that does not tire over hours.
   - A tense piece while the hearth alert or a siege stands, chosen from events on the bus. Music never affects the simulation, its rng or its hashes.
4. **Settings.** Music volume (0 to 100) and a mute key, saved in the settings store. A sound-effect volume is reserved, but no sound effects are in this task.
5. **The browser's rules.** Audio starts only after the first key press or click (autoplay policy). Headless runs, tests and e2e create no audio context.
6. **Spec first.** A new section in 24 UI and input (or a new presentation doc) says the above before the code lands. tech-stack.md says "no audio files", not "no audio".

## Done

- The menu, fortress and alert music play in the browser. Volume and mute work and persist across reloads.
- Unit tests cover track selection from events and that no audio context exists headless. An e2e test checks that the settings change persists, without asserting sound.
- `npm test`, e2e and the build pass. The bundle-size change is reported.
