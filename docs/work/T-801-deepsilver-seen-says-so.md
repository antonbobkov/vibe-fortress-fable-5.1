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

## Decisions taken while doing it

- **Where it is emitted.** 03's batched discovery flush (`terrain/api.ts`): after the tick's `TilesDiscovered`, each newly discovered tile that is natural rock (wall, boulder or fortification) of a deepsilver mineral, in tile order, records its vein key and emits `VeinFound { material, tile, finderId: 0 }` the first time. Every way of discovering counts (digging beside it, a creature beside it, a breach). Other minerals keep "found by mining" only.
- **The line.** `VeinFound` with no finder is announced with `announce.vein_seen` ("Deepsilver has been seen at (20,21,z4)."), a note like the mined one. The material reads "deepsilver" (the `deepsilver_ore` material's name).
- **No system reads `VeinFound`** (only the UI's hint, gauge unlock and line), so this changes no simulation; the event catalog's "15, 18" consumers are the UI's.
- **The breach hint is a new hint row**, `hint_deep_cavern`, on the first breach of cavern three (as `hint_magma` is on cavern two's), rather than a second sentence on `hint_breach`, which fires on whichever cavern is breached first: "The third cavern lies open. Deepsilver lies within two tiles of magma, at the bottom of the world: the Sea of Fire's rim and the magma pools of the deep caverns." `hint_deep` keeps its text.
- **N levels down** is the base surface of 03 stage 1 (`baseSurfaceZ(elevation)`) less `DEEPSILVER_Z_MAX`, a new `deepsilverDepth` field of the site summary.

## Done

- [x] `VeinFound` on discovery for deepsilver, once per vein; a test with a breach that reveals a vein and a later mine that emits nothing.
- [x] The site summary's depth and the hint text; UI tests.
- [x] 03 § Discovery, § Digging as a job; 18 § Player-facing behavior; 02 § Site summary; `ui-keymap-and-screens.md` § Hints updated.
