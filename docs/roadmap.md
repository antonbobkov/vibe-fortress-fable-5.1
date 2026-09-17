# Roadmap

**Detail level:** W1 · **Owner:** vision · **Depends on:** [README.md](README.md)

The specification is delivered in four waves. Each wave is one commit on `master`. Each later wave adds detail without contradicting an earlier one; where a later wave must change an earlier decision, the change is called out in the commit message and the earlier document is updated in the same commit.

## Wave 1 — Foundation (done)

- `README.md` — index, conventions, wave status.
- `00-vision/` — vision, player experience, glossary, scope and traceability.
- `01-architecture/` — architecture overview, tech stack, global constants.
- `02-systems/README.md` — the fixed list of systems with order, cadence, ownership and one-page summaries.
- `roadmap.md` — this file.

## Wave 2 — System designs (done)

Added the rest of `01-architecture/`:

- `simulation-core.md` — the tick loop in full, the scheduler, the frame loop and catch-up policy, rng streams, calendar, event and command queues, determinism tests.
- `data-model.md` — `Map3D` layout bit by bit, the entity store, every component type with its owner, ids, chunks, dirty flags.
- `module-interfaces.md` — the system contract in full, reader conventions, registration APIs (job producers, recipes, thought sources, overlays, panels), the `SimulationHost` interface.
- `content-pipeline.md` — table schema conventions, validation, id rules, how systems read the registry, how content references content.
- `persistence.md` — save structure, versioning, migrations, snapshots, export and import.
- `performance-budget.md` — per-system tick budget, memory budget, and the mitigation each system uses.
- `extension-guide.md` — step-by-step recipes for adding a material, a creature, a recipe, a building, a system, a panel.

Added one design document per system in `02-systems/` (`01-world-generation.md` through `24-ui-and-input.md`). Each follows the section order in `README.md` and decides every mechanic: all rules, all state, all interfaces, all player-facing behavior, all extension points. Numbers that are tuning rather than structure are named as constants and given values in Wave 3.

## Wave 3 — Content and balance

Adds `03-content/`, every table complete with glyph, color, and every numeric property:

- `materials.md`, `minerals-and-metals.md`, `items.md`, `weapons-and-armor.md`, `creatures.md`, `plants.md`, `skills-and-professions.md`, `jobs.md`, `buildings-and-furniture.md`, `workshops-and-recipes.md`, `regions-biomes-and-traits.md`, `personality-and-thoughts.md`, `names.md`, `glyphs-and-colors.md`, `embark-catalog.md`, `threat-schedules.md`, `caravan-goods.md`.

Fills the "Tuning constants" table in every system document with values, and adds the formulas each system uses (growth, decay, value, hit chance, wave size, prices) with worked examples.

Adds to `24-ui-and-input.md`: the complete screen list, panel list, keymap and mouse model.

## Wave 4 — Implementation-grade

Adds `04-implementation/`:

- `schemas/` — TypeScript-style type definitions for every component, every system's state, every content table row, every event and every command.
- `algorithms/` — step-by-step pseudocode for world generation, local map generation, fluids, temperature, pathfinding and connectivity, job assignment and hauling, workshop operation, combat resolution, health, weather, plant growth, animal behavior, hostile AI, trade valuation, immigration, room detection, compositor.
- `tick-order.md` — the exact per-tick sequence including cadence phases.
- `event-catalog.md` — every event with fields, emitters and consumers.
- `command-catalog.md` — every command with fields, validation rules and owning system.
- `save-format.md` — byte-level layout and the migration procedure.
- `ui-screens/` — an ASCII wireframe of every screen and panel with its keymap and mouse behavior.
- `acceptance-tests.md` — a checklist per system that a build must pass, each written as a scenario with expected outcomes.
- `build-milestones.md` — the order in which to build the game, from a rendered empty map to the full loop, with what is testable at each milestone.

Ends with a consistency pass: no placeholders remain, every content id referenced anywhere exists in a table, every event has at least one emitter and one consumer, every constant is defined exactly once.

## Recommended build order (preview of `build-milestones.md`)

1. Platform, core, registry, renderer, a generated local map you can look at and move through by z-level.
2. Dwarves that walk, designations, digging, items, stockpiles, hauling, jobs.
3. Fluids, temperature, weather, seasons.
4. Plants, farming, animals, foraging, food, drink, needs, sleep, rooms, morale, the hearth.
5. Workshops, recipes, work orders, smelting, forging, professions.
6. Combat, health, medicine, threats, defense, traps.
7. World generation, world map, embark, trade, immigration, save and load, legend.
8. Balance pass against the acceptance tests.
