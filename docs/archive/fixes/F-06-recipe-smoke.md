# F-06 — Every recipe once through the real workshop loop (S)

**Needs:** — · **Blocks:** F-07 (its safety net) · **Spec touched:** `05-plan/01-testing-strategy.md` (one paragraph)

## Why

Most M5 workshop tests call the workshop producer's completion hook directly:

```ts
op.producer().onComplete?.({ id: 0, workerId, target, inputs, data: { recipe } } as unknown as Job, fakeCtx)
```

That covers `forge.test.ts` "executes all 40 recipes", `alloys`, `melting`, `mechanic-jeweler`, `metal-fuel`, `first-recipes`, `remaining-recipes`, and the gate scenarios `ws_masterwork`, `it_value` and `it_wealth`. These tests check output arithmetic, not whether a dwarf can run the recipe: that `inputFilter` matches real items, that inputs are reserved and hauled, that fuel and containers are found, and that the job is claimed and worked. Only a handful of recipes went through order → claim → haul → craft.

A prototype of the test below ran all **151 recipes** (129 authored, plus 22 generated: 16 `smelt_*`, 5 `alloy_*` and `melt_metal_item`), each in its own small world:

- **150 crafted** through the real loop within **500 ticks** each;
- the whole file took about **18 seconds**;
- the only miss was `melt_metal_item`, a fixture gap (its input is "any melt-flagged metal item").

So the recipes do work. This test keeps them working, and it is F-07's safety net.

## Decisions

1. **Decision F-06a.** One test file, one fresh world per recipe (so no recipe's leftovers feed another), on the compact `buildFlatTestMap(registry, 32, 32)`, `embark: 'none'`, one shared `contentRegistry()`. Magma variants are covered by `ws_magma` and `magma.test.ts` and are not repeated here.
2. **Decision F-06b — how inputs are spawned.** Every input is spawned on one drop tile, `(16, 14, 32)`, as a single stack of `count` units unless noted.

   The item type:
   - a `match` with `|` → its first alternative;
   - a `match` that is an item id → that item;
   - otherwise (a tag) → see the `ingredient` rule below.

   The material:
   - `input.material` when it names an existing material;
   - `limestone` when it is `flux`;
   - for `fuel`, a `charcoal_bar` of `charcoal`;
   - for `plant_food` in `brew`, `dimcap`; in `mill_flour`, `barley`;
   - otherwise the default from this table:

   | item | material | item | material |
   |---|---|---|---|
   | `log` | `oak` | `leather_piece` | `leather` |
   | `raw_stone` | `granite` | `bone_pile` | `bone` |
   | `stone_block` | `granite` | `shell_piece` | `shell` |
   | `bar` | `iron` | `skull` | `skull_bone` |
   | `cloth` | `flax_cloth` | `rough_gem` | `quartz` |
   | `thread` | `flax_thread` | `milk` | `milk` |
   | `fiber` | `flax_fiber` | `fat` | `tallow` |
   | `plant_food` | `dimcap` | `raw_hide` | `cow_hide` |
   | `ore` | the input's own material | `wool_raw` | `wool` |

   - The tag `ingredient` (distinct or not): `count` single units cycling through `plant_food`/`dimcap`, `raw_meat`/`cow_meat`, `cheese`/`cheese` and `egg`/`egg`.
   - `recipe.fuel`: one extra `charcoal_bar`/`charcoal`.
   - `recipe.container`: one empty `barrel` of `pine` or `bag` of `flax_cloth`.
   - `melt_metal_item`: spawn one `axe` of `iron` and submit `MeltItem { itemId, on: true }` before the order.
   - A default whose material id is missing from the registry fails the test with the item and material named. Fix the table, never the recipe.
3. **Decision F-06c — the worker and the bound.**
   - The workshop is built instantly with `w.build(type, w.index(12, 12, 32), 'granite')`. Only the recipe is under test, not construction; F-01 covers construction.
   - One dwarf at `(16, 16, 32)` with `skills: { [recipe.skill]: 10 }` and all labors on.
   - After `w.step(1)`, an `AddWorkOrder { mode: 'once', remaining: 1, priority: 5 }`, then steps of 50 ticks until `ItemCrafted { recipeId }`, bound **1,000 ticks** (twice the measured maximum).

## Spec amendment

`docs/05-plan/01-testing-strategy.md` § Tiers (or wherever unit-test conventions are listed), add:

> Recipe behaviour is tested through the real loop: `test/unit/workshops/recipe-smoke.test.ts` runs every recipe once from order to `ItemCrafted`. Tests that call a producer's `onComplete` directly may check output arithmetic, but a scenario named in `acceptance-tests.md` must run the loop (orders, claims, hauling, work), not call internals.

## Code and tests

- New file `test/unit/workshops/recipe-smoke.test.ts`, `describe('F-06 every recipe through the real loop')`:
  - one `it` per workshop type, looping over `readers.of<WorkshopsReader>('12').recipesFor(type)` for `carpenter`, `mason`, `craftdwarf`, `jeweler`, `mechanic`, `wood_furnace`, `smelter`, `forge`, `kitchen`, `still`, `tannery`, `leatherworks`, `loom`, `clothier`, `farmers_workshop` and `bowyer`;
  - each `it` collects the failing recipe ids with their `WorkshopBlocked` and `JobBlocked` reasons, and asserts the list is empty, so one run reports every broken recipe at once;
  - plus one assertion that the recipe count over all types is 151 (`workshops-and-recipes.md` § totals).
- Rewrite the three gate scenarios so they run the loop:
  - `ws_masterwork`: a legendary carpenter (skill 20; all other labors off), a `once` order for 100 beds, 100 oak logs on a `wood` stockpile beside the workshop. Run until 100 `ItemCrafted { recipeId: 'make_bed' }` (bound 30,000 ticks). Assert ≥ 40 `MasterworkCreated` and the `made_masterwork` thought.
  - `it_value`: a skill-20 armorsmith (all other labors off), 40 steel bars and 10 charcoal beside a `forge`, a `once` order for 10 `forge_breastplate`. Run until a breastplate of quality 5 exists (bound 20,000 ticks) and assert its value is 4,000. Keep the existing directly-constructed value check as a second assertion.
  - `it_wealth`: a mason, 10 granite raw stones, an order for 10 `make_table_stone`. Assert wealth rises by exactly the sum of the crafted tables' values, and by 80 when all ten are common. Keep the direct check.
- Keep the existing `onComplete` unit tests. They test arithmetic, which is fine for unit tests.

## Done

- The smoke test passes in under 30 seconds on the gate machine (measured 18 s for the prototype, including start-up).
- `ws_masterwork`, `it_value` and `it_wealth` run the loop and pass.
- Spec amendment applied.
