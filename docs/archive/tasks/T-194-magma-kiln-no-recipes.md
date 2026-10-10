# T-194 — magma_kiln lacks magmaVariantOf and has no authored recipes

## Progress (2026-10-10, codex-a)

The power claim is verified. A stepped regression first returned false for a built kiln over level 7 magma; detecting power by its authored `magma` tag fixes it and preserves the existing threshold and fluid-type checks. An ordinary smelter over magma still reports false. The descent assertion for kiln power is turned around.

The recipe claim conflicts with the current spec: 12 reserves the magma kiln for future glass, and the authored workshop table says it has no recipes and stays hidden until one exists. There is no base `kiln` row, so adding `magmaVariantOf: kiln` alone would also violate the content reference schema. No input/output quantities, skill, duration or XP for a new glass recipe have been decided. The independent power correction can be committed, but leave this task open pending resolution of its completed-recipe Done item; keep the existing zero-recipes assertion. An owner question is pending. No recipe, balance constant or runtime dependency is added.

**Source:** T-154 and its run of `descent.scenario.ts` · **Size:** S · **Needs:** — · **Status:** open

## Why

[`docs/02-systems/12-workshops-and-professions.md`](../../02-systems/12-workshops-and-professions.md) § Workshops specifies:
> Magma variants: `magma_smelter`, `magma_forge`, `magma_kiln` (unused in version 1 but listed for glass later). A magma workshop is buildable only where at least one footprint tile has, directly below it, a tile with magma of level ≥ `MAGMA_POWER_LEVEL` (a channel over a magma pool or a pipe branch). Placement without that magma rejects with `bad_placement`; `no_magma` is reserved for workshop/job blocking after power is lost. It needs no fuel. If the magma drops below the level, its jobs block with `no_magma`.

In `src/content/buildings.json:905–938`, `magma_kiln` is defined with tag `"magma"`, but is missing `"magmaVariantOf": "kiln"` (unlike `magma_smelter` which has `"magmaVariantOf": "smelter"` and `magma_forge` which has `"magmaVariantOf": "forge"`). Because `WorkshopsReader.isMagmaPowered` (`src/systems/workshops/operate.ts:217`) checks `!this.row(b).magmaVariantOf`, `isMagmaPowered` returns `false` for `magma_kiln` even when properly placed and built directly above level 7 magma. Furthermore, `recipesFor('magma_kiln')` has length 0, so any `AddWorkOrder` command fails with `precondition_failed`.

## Reproduction

In scenario `descent` (or `test/unit/workshops/magma.test.ts:39–45`):
Build `magma_kiln` over level 7 magma at z=3.
1. `w.readers.of<WorkshopsReader>('12').isMagmaPowered(magmaKilnId)` evaluates to `false`.
2. `w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: magmaKilnId, order: { recipeId: 'any', mode: 'once', remaining: 1, priority: 5 } })` returns `{ ok: false, reason: 'precondition_failed' }`.

Read:
- `src/content/buildings.json:905–938`: `magma_kiln` lacks `"magmaVariantOf"`.
- `src/systems/workshops/operate.ts:215–223`: `isMagmaPowered` requires `this.row(b).magmaVariantOf`.
- `test/unit/workshops/magma.test.ts:39–45`: confirms `recipesFor('magma_kiln')` has length 0.

## What to do

1. Add `"magmaVariantOf": "kiln"` or adjust `isMagmaPowered` so that `magma_kiln` over magma is recognized as magma-powered.
2. Author kiln and magma_kiln recipes in `src/content/recipes.json` when the pottery/glass feature is developed.
3. Add unit tests for `magma_kiln` recipes and work orders without fuel.

## Done

- `isMagmaPowered` returns `true` for a built `magma_kiln` positioned over magma.
- `magma_kiln` accepts work orders and completes recipes without consuming fuel.
- `npm test` passes.

## Closed (2026-10-10, orchestrator)

- **The power fault is fixed** (`6e22bfb`): a built magma kiln over magma reports that it is powered.
- **The missing recipes are not a fault.** The specification and the content source reserve the kiln's recipes for glass, which is outside version 1. The Done item that asked for a completed recipe was written without that in view, and is withdrawn. No recipe is added.
- **One question goes to the UI audit (T-116):** a player can build a workshop that can make nothing. Either the build menu should say so, or the kiln should not be offered until it has a recipe.
