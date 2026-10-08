# Extension Guide

**Owner:** architecture · **Depends on:** [module-interfaces.md](module-interfaces.md), [content-pipeline.md](content-pipeline.md), [data-model.md](data-model.md)

Each recipe below lists the files touched. If a recipe would require touching a file not listed, the architecture has a gap that should be fixed rather than worked around.

## Add a material (stone, soil, wood, leather, cloth, gem)

1. Add a row to `materials.md` and its JSON mirror with class, value, density, hardness, color, glyph, burnable, melting point.
2. If it is a stone layer, add it to the geology class lists in `minerals-and-metals.md` so terrain generation places it.
3. Nothing else. Items, constructions, smoothing and value computation read properties.

## Add an ore or a metal

1. Ore: a row in `minerals-and-metals.md` (extends material) with vein shape, host geology classes, rarity per wealth rating, and `yields` (metal ids with counts per bar).
2. Metal: a row with tier, weapon and armor multipliers, alloy inputs if any, and whether it needs flux.
3. Smelting recipes are derived: the loader generates `smelt_<ore>` and `alloy_<metal>` recipes from the yields and alloy fields. No recipe row is needed unless the reaction is unusual.

## Add a plant

1. Row in `plants.md`: kind (tree, shrub, crop, cave crop, fungus tree), seasons, growth stages with durations, light requirement, yields, seed item, products, biome list with weight.
2. If it yields a new item (a new drink, a new cloth fiber), add the item type and the recipe that uses it.

## Add a creature

1. Row in `creatures.md`: body plan id, size, speed, diet, temperament, products, value, glyph, biome or cavern spawn rules, faction default, movement class, attacks (part, damage type, base damage), natural armor.
2. If it needs a new body plan (a six-legged thing), add a row to `bodyPlans` listing parts with hit weights and functions (wield, walk, see). Health and combat read plans.
3. If it is a hostile for the Gloam, reference it in `threat-schedules.md` party compositions.
4. If it is a caravan animal, reference it in `caravan-goods.md`.

## Add an item type

1. Row in `items.md`: category path, value multiplier, stack size, container class, rot time, glyph, tags.
2. Stockpile filters pick it up through the category path. Recipes reference it by id or tag.

## Add a weapon or armor piece

1. Row in `weapons-and-armor.md` (extends item type): class, skill, damage type, base damage, size, two-handed; or slot, coverage of parts, layer, material classes allowed.
2. Add the forge recipe (`forge_<item>`) or, for leather and cloth pieces, the leatherworks or clothier recipe.

## Add a recipe

1. Row in `workshops-and-recipes.md`: workshop, inputs (item type or tag, material class, count), outputs (item type, material source: `from_input`, fixed id, or `alloy`), skill, base time, fuel, output count, quality-bearing flag.
2. The workshop panel lists it automatically.

## Add a workshop or building

1. Row in `buildings-and-furniture.md`: footprint, allowed tiles, materials required, build time, function tag, room value, glyph, and for workshops the recipe list is by workshop id.
2. Function tags are what systems read: `sleep`, `sit`, `eat_at`, `door`, `hatch`, `bridge`, `floodgate`, `lever`, `plate`, `trap:<kind>`, `container`, `well`, `depot`, `hearth`, `workshop`, `training`, `coffin`, `cage`, `chain`.
3. A new function tag that no system understands is a new mechanic and needs a system change; list it in the relevant system document.

## Add a zone type

1. Row in `zoneTypes` with settings schema and which systems care (`room: true` if it forms rooms).
2. The systems that consume it (14 for rooms, 13 for stockpiles, 07 for plots, 08 for pastures, 17 for hospitals, 16 for barracks) already switch on the zone type id lists in their documents; add the new id to the appropriate list.

## Add a thought

1. Row in `personality-and-thoughts.md`: trigger (event type and predicate), value, duration, decay curve, per-cause cap, personality scaling, text.
2. Nothing else unless the trigger needs computation, in which case register a `ThoughtSource`.

## Add a region trait

1. Row in `regions-biomes-and-traits.md`: requirements (biome list, rating ranges), frequency, and effects: local generation hooks (feature placement), threat modifiers, weather modifiers, flora and fauna additions.
2. Effects are chosen from a fixed vocabulary of hooks that 03, 06, 07, 08 and 18 implement. A new hook is a system change.

## Add a job type

1. Row in `jobs.md`: labor, skill, target kind, base duration, whether it needs a tool, and which producer creates it.
2. Implement the producer in the owning system (or extend an existing producer) using `register.jobProducer`.
3. Implement the work step in that system's `handle(JobStepRequested)` or through the workshop mechanism if it is a crafting job.

## Add a command or event

1. Add to `04-implementation/event-catalog.md` with fields and owner.
2. Owner implements `applyCommand` or `emit`. Subscribers add the event to `subscribes` and handle it.
3. If the UI issues the command, add the panel action.

## Add a system

1. Create `src/systems/<id>/` with `index.ts` implementing the contract, `state.ts`, `reader.ts`, `events.ts`, `commands.ts`, `rules/`.
2. Add a row to the order table in `02-systems/README.md` and a design document.
3. Register producers, recipes, thought sources, overlays, panels as needed at `init`.
4. Add the system to the list in `app/game.ts` (the only place systems are enumerated).
5. Add a `serialize` fixture to the determinism test.

## Add a panel or overlay

1. Panel: implement `PanelSpec`, register at `init` of the owning system (or in `ui/` if it is generic), choose an unused hotkey from the keymap table.
2. Overlay: implement `OverlaySpec` with a per-cell function over readers, register with 23; it appears in the overlay menu automatically.

## Change a global constant

1. Change the value in `constants.md` and in `core/constants.ts`.
2. Search all documents and code for the constant name; confirm every use still makes sense.
3. If the constant affects map layout (`LOCAL_MAP_*`, cavern bands) or time (`TICKS_PER_*`), bump the save format version; old saves are incompatible.

## Move the simulation to a worker

1. Implement `WorkerHost` over `platform/worker-bridge.ts`.
2. Implement snapshot readers: each reader used by presentation gets a serializable snapshot form; the compositor reads the snapshot of visible chunks and entities.
3. Presentation code is unchanged except for using `host.readers`, which it already does.
