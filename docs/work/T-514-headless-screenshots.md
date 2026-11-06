# T-514 — Screenshots from a headless game or a save

**Source:** the owner, 2026-11-06 ("Can we add a mechanism for headless setups to generate screenshots? Or from a save. Naively it should be as easy as stitching tile images") · **Size:** M · **Needs:** — · **Status:** open

## Why

The interesting moments (a glowcap farm, a spell in flight, an apprentice at the rune circle, a siege) happen in the long headless runs: `pp_runecraft`, the twenty-seed sweep, `defence_year`. Those draw nothing, and only the short browser tests take screenshots. The compositor already fills a cell buffer (glyph, foreground, background per cell; `src/render/cellbuffer.ts`, used by the render goldens), and the atlas holds each glyph as an 8×8 mask (`src/render/atlas.ts`). So a picture is the cell buffer with each cell's mask stamped in its colours: no browser needed.

## What to do

1. **A headless renderer to PNG.** A function that takes a running headless game (or a loaded save), a view (level, origin, size, optional panel or overlay state if cheap), runs the same compositor the browser uses into a cell buffer, and writes a PNG by stamping glyph masks at a chosen scale (1× and 2× at least). Use Node's own `zlib` for the PNG encoder, or a small dev dependency if clearly better; no native canvas. The output must match what the browser draws for the map area, cell for cell (test it against a render golden).
2. **From a save:** `node scripts/screenshot.mjs <save> [--z N] [--at x,y] [--size WxH] [--scale 2] [--out file.png]`.
3. **From a test:** a helper a scenario or perf test can call at a moment (`snapshot(game, name, view?)`) that writes under `out/screenshots/` when an env var such as `SNAPSHOTS=1` is set, and does nothing otherwise, so normal runs are unchanged and fast. Add a few snapshot calls to `pp_runecraft` at its moments (glowcap ripe, attunement, the emberbolts), and let the Measure workflow upload `out/screenshots/` as an artifact.
4. **Docs:** how to use it, in `docs/04-implementation/tooling.md`.

## Done

- A test shows the PNG of a known scene matches the render golden's cells.
- `pp_runecraft` with `SNAPSHOTS=1` writes its moments as PNGs; without it, nothing changes (world hashes, timing).
- The script makes a PNG from `test/fixtures/played-fortress.deepholm`.
