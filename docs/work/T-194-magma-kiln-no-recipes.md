# T-194 — magma_kiln lacks magmaVariantOf and has no authored recipes

**Source:** T-154 and its run of `descent.scenario.ts` · **Size:** S · **Needs:** — · **Status:** open

## Why

[`docs/02-systems/12-workshops-and-professions.md`](../02-systems/12-workshops-and-professions.md) § Workshops specifies:
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
