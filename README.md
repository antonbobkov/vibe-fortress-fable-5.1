# Deepholm

A browser fortress simulation drawn as a grid of colored glyphs. Dig a hall,
keep your dwarves fed and supplied, trade, and defend the fortress.

Requires Node.js 22 or later and npm. No runtime dependencies or server component.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Choose **New world**, generate a world, select
a region, and embark with the **Balanced** preset. A peril-0 region is a gentler
starting point. The fortress starts paused.

Useful keys:

| Key | Action |
|---|---|
| Space | Pause or resume |
| + / − | Change simulation speed |
| Arrows / Shift+arrows | Pan one / ten cells |
| < / > | Change z-level |
| d / b / z | Designations / buildings / zones |
| ? | Help and glyph legend |
| Esc | Cancel, return, or open the game menu |
| F5 / F9 | Quick save / confirm quick load |

Select a tool and drag on the map to designate tiles. Plan food, drink and beds
early; watch jobs and announcements for missing materials or blocked paths.
Saves live in the browser's local storage; the game menu offers export and import.

Build and serve the release:

```sh
npm run build
npm run preview
```

`dist/` contains `index.html`, one JavaScript bundle (plus its source map), one CSS
file and one font. Copy it to any static host; asset references are relative.
The build check verifies this layout, font coverage and absence of the test hook.
The bundled font's source and license are in [src/assets/README.md](src/assets/README.md).

Verification:

```sh
npm run lint
npm run typecheck
npm run content:check
npm run strings:check
npm run interface:check
npm run docs:check
npm test
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
npm run test:perf
```

E2E starts a test-mode development server and a separate static server for a
test-mode build of `dist/`. `boot-dist` runs the same boot assertions as `boot`.
Production builds omit `window.__deepholm`; run `npm run build` after E2E to
restore production output. Golden files are updated intentionally with
`npm run golden:update` and the reason recorded in the commit.

The full rules and controls are in [docs/](docs/README.md), including the
[system designs](docs/02-systems/README.md),
[implementation plan](docs/archive/build-plan/README.md),
[progress](docs/archive/build-plan/PROGRESS.md) and
[decision log](docs/05-plan/DECISIONS.md).
