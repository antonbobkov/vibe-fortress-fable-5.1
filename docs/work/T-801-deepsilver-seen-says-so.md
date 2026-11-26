# T-801 — Deepsilver seen is deepsilver found: the hint and the gauge come before the first tile is taken

**Source:** playtest 8 ([report](../../reports/data/2026-11-26-playtest-8.md), finding 7) · **Size:** S · **Needs:** — · **Status:** open

## Why

In playtest 8, cavern 3 opened beside a deepsilver vein. Hovering read "Deepsilver wall", and its tiles were discovered.
- No line said anything: `VeinFound` is emitted only when a vein's first tile is mined (03 § Digging as a job). `hint_deep` ("Deepsilver lies beside the Sea of Fire. Taking it wakes the Hollow. The threats panel shows the Deep gauge.") and the Deep gauge therefore came only after the confirmation and the first mined tile.
- Before that, nothing told the player where deepsilver lies. It lies only at z0–6 (`DEEPSILVER_Z_MAX`), within two tiles of magma. On this seed that was 27 levels below the surface, past three cavern bands.
- The site summary says only "deepsilver likely".

## What to do

Decisions taken here:

- **Discovering a deepsilver tile counts as finding it.** When 03 marks a deepsilver tile `discovered`, by digging next to it or by a cavern breach revealing it, 03 emits `VeinFound { material: deepsilver, tile, finderId: 0 }` once per vein. This uses the same `veinsFound` key, so mining that vein later emits nothing more. The announcement reads "Deepsilver has been seen at (20,21,z4)." `hint_deep` and the gauge unlock on it.
- **The embark summary and the hint say how deep.** The site summary reads "deepsilver likely, beside the Sea of Fire (about N levels down)", with N the surface's z less `DEEPSILVER_Z_MAX`. The first cavern-3 breach adds to the breach hint: "Deepsilver lies within two tiles of magma, at the bottom of the world."

## Done

- [ ] `VeinFound` on discovery for deepsilver, once per vein; a test with a breach that reveals a vein and a later mine that emits nothing.
- [ ] The site summary's depth and the hint text; UI tests.
- [ ] 03 § Discovery, § Digging as a job; 18 § Player-facing behavior; 02 § Site summary; `ui-keymap-and-screens.md` § Hints updated.
