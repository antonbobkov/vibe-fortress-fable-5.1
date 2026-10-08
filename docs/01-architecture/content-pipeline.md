# Content Pipeline

**Owner:** architecture (`content/`, `core/registry.ts`) · **Depends on:** [architecture-overview.md](architecture-overview.md), [data-model.md](data-model.md)

## Principle

Content is data. The Markdown tables in `03-content/` are the source of truth; the JSON files in `src/content/` mirror them one to one with identical field names. A system reads content only through the registry and only by id or by property. No system names a specific content row.

## Tables

| Table | Row type | Referenced by |
|---|---|---|
| `materials` | `MaterialDef` | tiles, items, buildings, recipes |
| `minerals` | `MineralDef` (extends material with geology and yields) | terrain generation, smelting |
| `metals` | `MetalDef` (extends material with tier and alloy inputs) | smelting, weapons, armor |
| `items` | `ItemTypeDef` | items, recipes, stockpile filters, embark catalog |
| `weapons` | `WeaponDef` (extends item type) | combat |
| `armor` | `ArmorDef` (extends item type) | combat |
| `creatures` | `SpeciesDef` | animals, threats, embark, caravans |
| `bodyPlans` | `BodyPlanDef` | health, combat |
| `plants` | `PlantDef` | plants, terrain generation, foraging |
| `skills` | `SkillDef` | dwarves, jobs, recipes |
| `labors` | `LaborDef` | jobs |
| `jobTypes` | `JobTypeDef` | jobs |
| `buildings` | `BuildingDef` | buildings, defense, workshops |
| `zoneTypes` | `ZoneTypeDef` | buildings |
| `workshops` | `WorkshopDef` (extends building) | workshops |
| `recipes` | `RecipeDef` | workshops |
| `biomes` | `BiomeDef` | worldgen, terrain, weather, plants, animals |
| `regionTraits` | `RegionTraitDef` | worldgen, terrain, threats |
| `civilizations` | `CivDef` | worldgen, trade, threats, immigration |
| `personality` | `TraitDef` | dwarves, morale |
| `thoughts` | `ThoughtDef` | morale |
| `names` | syllable tables | dwarves, immigration, embark |
| `glyphs` | `GlyphDef` (extra glyphs beyond CP437) | render |
| `palette` | `ColorDef` | render |
| `embarkCatalog` | `EmbarkEntryDef` | embark |
| `threatSchedules` | `ThreatScheduleDef` | threats |
| `caravanGoods` | `CaravanGoodsDef` | trade |
| `weatherTables` | `WeatherTransitionDef` | weather |
| `strings` | `Record<StringKey, string>` | ui, announcements |
| `hints` | `HintDef` | ui |
| `milestones` | `MilestoneDef` | legend |

## Row conventions

Every row has:

- `id: string` — `snake_case`, unique within its table, never reused after removal.
- `name: string` — display name, singular.
- `plural?: string` — when the plural is not `name + "s"`.
- `glyph?: string` and `fg?: ColorId`, `bg?: ColorId` — for drawable things.
- `tags?: string[]` — free-form classification used by filters (`stockpile` filters, `recipe` inputs by tag).

Field types are: `string`, `number` (integer), `Fixed` (integer, scale 1000; written in tables as decimals and converted by the loader), `boolean`, `Id<Table>` (a string id validated against another table), `Id<Table>[]`, enumerations (a string from a fixed set), and nested objects for structured fields (body plans, recipe inputs).

Numbers in Markdown tables are written in the unit named in the column header. The loader converts durations given in hours or days to ticks and decimals to `Fixed`.

## Loading

`content/loader.ts` runs at startup, before `World` is constructed:

1. Parse every JSON table.
2. Validate each row against its schema (`schema.ts`, hand-written validators matching the type definitions). A failure reports table, row id, field and expected type, and stops the game with a visible error.
3. Resolve references: every `Id<Table>` must exist. A dangling reference is a validation failure.
4. Assign indices: rows are sorted by id and numbered from 1 (0 is reserved for "none" everywhere).
5. Build derived structures: per-class material lists, recipes by workshop, thoughts by trigger event, species by biome and season, item types by category path.
6. Compute the content hash (a stable hash over the sorted JSON) and store it in the registry for save compatibility checks.
7. Freeze everything.

The registry is immutable for the life of the process. Reloading content means restarting.

## Reading content from systems

```
registry.materials.byId('hematite')          // MaterialDef | undefined
registry.materials.byIndex(idx)              // MaterialDef
registry.materials.index('hematite')         // number (throws if unknown; used only in tests and content-driven code paths)
registry.materials.where(m => m.class === 'ore')     // precomputed on first use; returns a frozen array
registry.recipes.forWorkshop(workshopId)
registry.thoughts.forTrigger(eventType)
```

Systems that need fast per-tick lookups copy the property they need into a typed array at `init` (for example 04 copies `materials[i].meltsAtC` into an `Int16Array`).

## Referencing content from content

- Recipes reference item types and material classes or tags, never specific materials, except for reactions that are specific by nature (steel needs `flux`-tagged stone).
- Species reference body plans by id and biomes by id.
- Biomes reference plant and species lists by id with spawn weights.
- Thoughts reference event types and optional field predicates (`{ event: 'MealEaten', where: { quality: '>=fine' } }`).
- Embark catalog entries reference item types with a material, or species.

## Strings

Player-facing text uses `strings.json` and the `UI_STRINGS` defaults in `ui/strings.ts`, keyed by a `StringKey`; a content row overrides a default of the same key, with placeholders in braces (`"{dwarf} has found {material}."`). Announcements, thoughts, hints, panel labels and rejection reasons are keys. Content `name` fields are the exception: they are display text directly.

## Saves and content

A save records the content hash. On load with a different hash, the loader attempts a *soft match*: if every content id referenced by the save (gathered from the component id fields generated from `schemas/components.md` per `save-format.md`) exists in the current tables, the load proceeds with a warning; if any id is missing, the load fails with a list of missing ids (`checkContent(header, content, referencedIds)` returns `exact`, `soft` or `failed` with the sorted missing list). There is no content migration in version 1.

The content check exports every Markdown table into an isolated temporary directory and compares its bytes with committed JSON. Missing, unexpected or differing tables fail the check; validation and source parity must both pass. Checking never writes committed content.

## Authoring rules for content tables

- One table per Markdown file; columns in the schema order; id first, name second.
- Every row that a system document names must exist. The consistency checks compare every backticked `snake_case` token in `02-systems/` against the union of table ids and constants.
- Numbers are integers or decimals with at most three decimal places.
- Glyphs are written as the character itself with its code point in a comment column when it is not printable ASCII.
