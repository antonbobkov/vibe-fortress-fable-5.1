# Tooling Notes

**Owner:** implementation · **Depends on:** [`../04-implementation/tooling.md`](../04-implementation/tooling.md), [testing-strategy.md](testing-strategy.md), [agent-workflow.md](agent-workflow.md)

How the repository's own scripts and checks are built, where that is a choice an agent would otherwise have to rediscover. The specification of the tooling (dependencies, compiler options, lint boundaries, test layout, CI) is [`../04-implementation/tooling.md`](../04-implementation/tooling.md). The test tiers, the scenario runner and the gate are in [testing-strategy.md](testing-strategy.md). Nothing here is a game rule.

One short entry per choice. An entry is changed when the script changes, in the same commit.

## Scripts are plain Node

No script may need a loader or a dependency that `package.json` does not list. Each script below gets at the TypeScript sources in the way that keeps this true.

- **`content:check`** (`scripts/content-check.mjs`). `src/content/schema.ts` and `src/content/generate.ts` import nothing, so the script loads them directly through Node's built-in type stripping and runs exactly the loader's rules. There is no JavaScript copy of the schemas to drift. `--fixture <file.json>` merges a JSON object of table overrides; the tests use it to feed the script a broken table.
- **`hash`** (`scripts/world-hash.mjs`). The script cannot import the sources (they use extensionless relative specifiers and path aliases). It parses the save container of `save-format.md` § Container itself and hashes the canonical section stream, which is the saved world state, so equal saves print equal hashes. It carries its own copy of `StateHasher`; `test/unit/world-hash-script.test.ts` asserts that the copy is identical to the one in `src/core/serialize.ts`.
- **`interface:check`** (`scripts/interface-check.mjs`). It uses the TypeScript compiler API, which is already a dev dependency. For every system it collects the callable properties of the exported `*Reader` interface (inherited ones included), the event types dispatched (literal types, narrow factories, batches, job notifications; a callback that forwards any `GameEvent` is not an emitter), and the commands the system owns. It compares the three sets with the `### Reader`, `### Events emitted` and `### Commands` subsections of the system's document and fails on a name that is in one and not in the other. In those subsections a name in backticks is a declaration unless it is inside parentheses, so a reference to something another system owns is written in parentheses or in another subsection. The script also fails on any line in `docs/00-` … `docs/04-` that starts with `Implementation note:`.
- **`build`** (`scripts/build-check.mjs`, run after `vite build`). It checks the shape of `dist/`: exactly one JavaScript bundle, one stylesheet and one font, linked with relative paths; the bundled font covers every glyph of the CP437 table and of `glyphs.json`; and the test hook `window.__deepholm` is absent from a production build and present in a test build.

## Where code constants live outside the systems

`src/systems/<id>/constants.ts` holds a system's tuning constants and `src/core/constants.ts` the global ones. Three owners are not system directories, and their constants are not rows of `01-architecture/constants.md`, so each has its own file, holding the rows of its document's § Tuning constants verbatim:

- `src/core/path-constants.ts`: 22's rows. It also holds `SNOW_MOVE_COST_PERCENT` (06) and `WADE_LARGE_SIZE` (19), which the cost and passability formulas need and which the core may not import from a system; 06 and 19 re-export them from here.
- `src/render/constants.ts`: 23's rows.
- `src/ui/constants.ts`: 24's rows.
