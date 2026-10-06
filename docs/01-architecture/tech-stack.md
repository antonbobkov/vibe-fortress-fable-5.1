# Tech Stack

**Owner:** architecture · **Depends on:** [architecture-overview.md](architecture-overview.md)

## Decisions

| Concern | Decision | Why |
|---|---|---|
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true` | Types double as the schema documentation; strictness catches the class of bugs a simulation is most prone to |
| Build | Vite | Fast dev loop, static output, no configuration burden |
| UI framework | None | The UI is a text grid drawn on a canvas; a DOM framework would add nothing |
| Rendering | HTML `Canvas 2D`, one canvas, a pre-rendered glyph atlas | Fast enough for a full redraw of a 160×60 grid at 60 fps; simple; portable |
| Font | A bundled monospace bitmap-style font rendered once into the atlas at each zoom | Deterministic glyph shapes across platforms; no layout jitter |
| Character set | CP437 glyphs plus a small set of extra Unicode glyphs listed in `03-content/glyphs-and-colors.md` (Wave 3) | The Dwarf Fortress visual vocabulary, extended where CP437 lacks a needed shape |
| Randomness | `xoshiro128**` implemented in `core/rng.ts` with per-system streams | Deterministic, fast, seedable, splittable |
| Numbers in simulation | Integers and fixed-point (`× 1000`) | Determinism across engines and easy serialization |
| Storage | IndexedDB via a thin adapter; file export/import through Blob download and file input | Large saves; no server |
| Compression | Browser-native `CompressionStream('deflate')` when available, otherwise uncompressed | No dependency; typed arrays compress well |
| Workers | Not used in version 1; `SimulationHost` interface keeps the door open | Simplicity first; the seam is cheap to keep |
| Tests | Vitest | Fast, TypeScript-native, runs headless simulation |
| Lint and format | ESLint with `typescript-eslint` recommended rules, Prettier | Uniform code |
| Runtime dependencies | None | Everything needed is small enough to own; zero supply-chain surface |
| Browsers | Latest two versions of Chrome, Edge, Firefox and Safari on desktop | PC target; no polyfills |
| Package layout | Single package, ES modules, path aliases per layer (`@core/*`, `@systems/*`, `@render/*`, `@ui/*`, `@app/*`, `@content/*`, `@platform/*`) | Enforces the layer rule with an ESLint import-boundary rule |

## Layer boundary enforcement

An ESLint `no-restricted-imports` configuration (Wave 4 lists it) forbids:

- `@core/*` importing anything except `@platform/*` interfaces.
- `@systems/*` importing `@render/*`, `@ui/*` or `@app/*`.
- `@render/*` and `@ui/*` importing `@systems/*` internals; only `@systems/*/reader` and command types are allowed.
- Any package importing another system's `state.ts`.

## Frame and simulation loop

- `requestAnimationFrame` drives rendering at up to `TARGET_FPS`.
- The simulation host accumulates real time and steps the world by whole ticks at the current speed, at most `MAX_TICKS_PER_FRAME` per frame. If the tab cannot keep up, the game runs slower rather than skipping ticks; the status bar shows the actual ticks per second.
- When the tab is hidden, the simulation pauses. On return it does not catch up.

## Content pipeline

Content is authored as JSON files in `src/content/` with a TypeScript schema (`schema.ts`) and a loader that validates every table at startup and fails loudly with the row and field at fault. Wave 2's `content-pipeline.md` specifies the schema conventions; Wave 3 provides the tables; Wave 4 provides the exact type definitions.

## Assets

- One font file.
- No images, no audio.
- The glyph atlas is generated at startup into an offscreen canvas per zoom level.

## Build output

A static site: `index.html`, one JavaScript bundle, one CSS file for the canvas container, the font. Deployable to any static host. No server component.

## Performance targets

| Measure | Target |
|---|---|
| Simulation tick, standard map, 80 dwarves, year 3 | ≤ 6 ms average, ≤ 20 ms worst case, on a 2020 mid-range laptop |
| Frame render, 160×60 cells | ≤ 4 ms |
| World generation, standard world | ≤ 2 s |
| Local map generation | ≤ 1.5 s |
| Save, standard map | ≤ 1 s; ≤ 8 MB uncompressed, ≤ 2 MB compressed |
| Load | ≤ 1.5 s |
| Memory, steady state | ≤ 300 MB |

The per-system breakdown of the tick budget is in `performance-budget.md` (Wave 2).
