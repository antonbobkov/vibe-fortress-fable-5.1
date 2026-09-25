# F-07 — Recipe constraints as content, not `if (recipe.id === …)` (M)

**Needs:** F-06 (must pass before and after) · **Spec touched:** `schemas/content-rows.md`, `03-content/workshops-and-recipes.md`, `03-content/materials.md`, `03-content/minerals-and-metals.md`, `02-systems/12-workshops-and-professions.md`, `01-architecture/extension-guide.md` (no change: it becomes true again)

## Why

The workflow rule: "Content ids in code appear only in tests and in the content-driven paths the spec names." `src/systems/workshops/operate.ts` special-cases content:

| Line | Hard-coded content |
|---|---|
| 88 | the output items `thread` and `cloth` |
| 203 | fuel is literally `['coal_bar', 'charcoal_bar']` |
| 211 | `recipe.workshop === 'forge'` |
| 214–216 | `recipe.id === 'forge_anvil'` → `['iron', 'steel']` |
| 218 | `make_mechanism_metal` |
| 223 | `melt_metal_item` |
| 230–242 | `fiber`, `wool_raw`, `flour`, and the brewable and same-thread rules (D-126, D-127) |
| 322 | `melt_metal_item` |
| 329 | `'smelter'` |
| 379 | the forge and `make_mechanism_metal` |

`extension-guide.md` line 5 says a recipe that needs a file outside its list means "the architecture has a gap". The spec already states every one of these constraints in the recipe tables, in parentheses. The exporter (`scripts/lib/export/rules.mjs` `recipeInputs`) drops them:

- "(iron or steel)" and "(same material)" both collapse to `material: 'any'`;
- "(brewable species)" and "(magma-safe metal)" drop to nothing;
- the "or 1 wool_raw" alternative is lost.

## Decisions

1. **Decision F-07a — `RecipeDef` input gains four optional fields** (a superset; nothing existing changes meaning):

   ```ts
   materials?: Id<MaterialDef>[];                 // allowed materials: "(iron or steel)", "(barley or cavewheat)", "(flax_fiber, sporecloth_fiber)"
   materialProperty?: 'magma_safe' | 'brewable';  // "(magma-safe metal)", "(brewable species)"
   sameMaterial?: true;                           // "(same material)": every unit of the input shares one material
   flagged?: 'melt';                              // only items carrying the flag (the generated melt recipe)
   ```

   `match` may also be `'any'` (any item type), which only the generated melt recipe uses.
   - `materials`, when present, restricts the input to items whose material is in the list. With `|` alternatives it is the union for all of them: the spin row lists `wool` alongside the fibres.
   - `magma_safe` means a `metal`-class material with `meltsAtC > MAGMA_C`.
   - `brewable` means a material whose plant row has `brew`.
2. **Decision F-07b — output material stage.** `outputs[].material` gains the form `{ from: 'input', index: number, stage: 'next' }`: the output takes the input material's `nextStage`, or the input material itself when it has none (silk web). `MaterialDef` gains `nextStage?: Id<MaterialDef>`, exported by this rule:
   - `<stem>_fiber` → `<stem>_thread` → `<stem>_cloth` wherever those rows exist;
   - `wool` → `wool_thread`.
3. **Decision F-07c — fuel is a tag.** `coal_bar` and `charcoal_bar` carry the item tag `fuel`. Every fuel input and filter is `{ tag: 'fuel' }`, including the generated `alloy_*` rows, whose `coal_bar|charcoal_bar` becomes `fuel`.
4. **Decision F-07d — which input a work order's material filter constrains.** It applies to exactly one input: the one the recipe's first output takes its material from (`material.from.index`), or input 0 when that output's material is `fixed`, `alloy` or `plantDrink`. This replaces the forge special case ("a forge order's chosen metal applies to its bar, not its wooden handle") and fixes the same bug for every other two-input recipe.
   - Example: `brew_hopped` with a barley filter no longer forces its hops to be barley.
5. **Decision F-07e — the melt path.**
   - The loader's generated melt row becomes `{ match: 'any', count: 1, material: 'metal', flagged: 'melt' }`.
   - An input with `flagged` is taken as one whole item, not as units: the per-input rule replaces `data.inputUnits = recipe.id !== 'melt_metal_item'`.
   - The standing order `autoMeltMarked` uses "the workshop types whose recipes include an input with `flagged: 'melt'`" instead of `'smelter'`.
   - `barCost` keeps its documented source order (`weapons`/`armor` `bars`, then a recipe producing the item) but finds "bar" inputs by the item category `bar/metal` instead of the id `bar`.
6. **Decision F-07f — guard.** A unit test fails if `operate.ts` contains a string literal equal to any recipe id, item id, material id or building id in the registry.

## Spec amendments

`docs/04-implementation/schemas/content-rows.md` `RecipeDef`: replace the `inputs` and `outputs` lines with

```ts
  inputs: { match: Id<ItemTypeDef> | string /* tag, class, 'a|b', or 'any' */; material?: MaterialClass | Id<MaterialDef> | 'any' | 'fuel' | 'flux';
            materials?: Id<MaterialDef>[]; materialProperty?: 'magma_safe' | 'brewable'; sameMaterial?: true; flagged?: 'melt';
            count: number; distinct?: boolean }[];
  outputs: { item: Id<ItemTypeDef>; count: number; material: { from: 'input'; index: number; stage?: 'next' } | { fixed: Id<MaterialDef> } | { alloy: Id<MetalDef> } | { plantDrink: true } }[];
```

and add `nextStage?: Id<MaterialDef>` to `MaterialDef`. Add these validation rules:

- every `materials` entry and every `nextStage` is an existing material;
- `stage: 'next'` only on outputs whose input has materials with `nextStage`;
- at least one item type carries the tag `fuel`.

`docs/03-content/workshops-and-recipes.md` line 40 (the legend): append

> Parenthesised constraints are data: "(a or b)" and "(a, b)" list the allowed materials; "(brewable species)" and "(magma-safe metal)" name a material property; "(same material)" makes every unit of the input share one material; "(matching thread material)" and "(matching cloth material)" take the next stage of the input's material (`materials.md` § Cloth and fiber); a work order's material filter constrains only the input the first output takes its material from.

`docs/03-content/workshops-and-recipes.md` `spin_thread` row: `1 fiber (flax_fiber, sporecloth_fiber) or 1 wool_raw` → `1 fiber or 1 wool_raw (flax_fiber, sporecloth_fiber, wool)`.

`docs/03-content/materials.md` § Cloth and fiber: add

> Stages: `flax_fiber` → `flax_thread` → `flax_cloth`; `sporecloth_fiber` → `sporecloth_thread` → `sporecloth_cloth`; `wool` → `wool_thread` → `wool_cloth`; `silk_web` has no further stage.

`docs/03-content/minerals-and-metals.md` § Fuel: add "Both fuels carry the item tag `fuel`."

`docs/02-systems/12-workshops-and-professions.md` § Work orders: add the rule of Decision F-07d as one sentence.

## Code

| File | Change |
|---|---|
| `scripts/lib/export/rules.mjs` | `recipeInputs`: parse the parentheses as the legend says. Materials lists (every token an existing material id) → `materials`; `brewable species` → `materialProperty: 'brewable'`; `magma-safe metal` → `'magma_safe'`; `same material` → `sameMaterial: true`; `X or 1 Y` alternatives → `match: 'X\|Y'`. Stop emitting `material: 'any'` for material lists. `parseOutputs`: "(matching … material)" → `{ from: 'input', index: 0, stage: 'next' }`. |
| `scripts/lib/export/materials.mjs` | `nextStage` by Decision F-07b. |
| `scripts/lib/export/items.mjs` | Tag `fuel` on `coal_bar` and `charcoal_bar` (the two fuels of `minerals-and-metals.md` § Fuel). |
| `src/content/schema.ts`, `src/content/generate.ts` | Schema fields and validation (F-07a/b/c); generated alloy fuel inputs `match: 'fuel'`; the melt row per F-07e. |
| `src/content/*.json` | Regenerate with `npm run content:export` and commit (allowed generated artifacts). |
| `src/systems/workshops/operate.ts` | `recipeInputFilter` handles `materials`, `materialProperty` (`magma_safe` computed as `class === 'metal' && meltsAtC > MAGMA_C`; `brewable` from the `plants` table's `brew` rows by material id), `flagged`, and `match: 'any'`. `sameMaterial` generalises today's "same thread" search: pick the first material, in material index order, with enough available units. Order scope per F-07d. `fuelFilter` → `{ tag: 'fuel' }`. `resolveOutputMaterial` uses `stage: 'next'` and `nextStage`. Auto-melt and `barCost` per F-07e. Delete every branch listed under Why. |
| `src/systems/jobs/board.ts`, `src/systems/jobs/producers.ts` | The job-input spec (not the content row) gains an optional runtime field `wholeItem?: true`. An input counts units when `job.data.inputUnits === true` and it is not `wholeItem`. The workshop producer sets `inputUnits: true` on every craft job and `wholeItem: true` on inputs whose recipe input has `flagged`. |

## Tests

- F-06's smoke test passes before and after, with the same 151 recipes.
- `test/unit/content.test.ts` "F-07: recipe constraints are exported":
  - `forge_anvil` inputs `[{ match: 'bar', count: 5, materials: ['iron', 'steel'] }]`;
  - `make_mechanism_metal` `materialProperty: 'magma_safe'`;
  - `brew` `materialProperty: 'brewable'`;
  - `mill_flour` `materials: ['barley', 'cavewheat']`;
  - `weave_cloth` `sameMaterial: true` with output `stage: 'next'`;
  - `spin_thread` `match: 'fiber|wool_raw'`, `materials: ['flax_fiber', 'sporecloth_fiber', 'wool']`, output `stage: 'next'`;
  - both fuel items tagged `fuel`;
  - `flax_fiber.nextStage === 'flax_thread'`.
- `test/unit/workshops/operation.test.ts` "F-07: an order's material filter constrains only the principal input":
  - a steel `forge_spear` order accepts an oak log (existing forge test, now through the rule);
  - a `barley` filter on `brew_hopped` still accepts hops.
- `test/unit/workshops/no-content-ids.test.ts` "F-07: operate.ts names no content": read `src/systems/workshops/operate.ts` as text, collect every string literal (`'…'`), and assert none equals an id in the `recipes`, `items`, `materials` or `buildings` tables of `contentRegistry()`.
- The existing D-126 and D-127 tests in `remaining-recipes.test.ts` and `forge.test.ts` keep passing unchanged: they now pin the data path.

## Done

- `npm run content:check` green with the new validation. Suite green. Regenerated content JSON committed.
- One `DECISIONS.md` row: "F-07 supersedes the code paths of D-126, D-127, D-128 and D-150's recipe-id branches with recipe data."
- Spec amendments applied verbatim.
