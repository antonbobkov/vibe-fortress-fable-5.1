# Deepholm — Design Specification

> *A hall beneath the world.*

Deepholm is a single-player colony simulation for the browser, inspired by Dwarf Fortress. It is drawn in colored ASCII on a canvas. The world is three-dimensional and viewed one layer at a time. Dwarves have skills, needs and moods. Water flows and magma glows. There is mining, smelting and smithing; farms, herds and hunts; raids, traps and militia; caravans and newcomers.

This repository holds the **complete specification** of the game and no code. It is written so that a developer can build Deepholm from these documents alone, without making any non-trivial creative decision.

## Reading order

| Folder | Read it to learn | Detail arrives in |
|---|---|---|
| [`00-vision/`](00-vision/vision.md) | What the game is, who it is for, how a session feels, the vocabulary | Wave 1 |
| [`01-architecture/`](01-architecture/architecture-overview.md) | How the software is shaped: layers, modules, contracts, tick loop, persistence, performance | Waves 1–2 |
| [`02-systems/`](02-systems/README.md) | One design document per game system: rules, state, interfaces, player-facing behavior | Waves 1–2 |
| [`03-content/`](03-content/) | Every material, creature, plant, item, skill, job, building, recipe, region trait and thought, as tables with numbers | Wave 3 |
| [`04-implementation/`](04-implementation/) | Type schemas, algorithms in pseudocode, exact tick order, event and command catalogs, save format, screen wireframes, keymaps, acceptance tests, build milestones | Wave 4 |
| [`roadmap.md`](roadmap.md) | What each wave adds and the recommended build order | Wave 1 |
| [`05-plan/`](05-plan/README.md) | The implementation plan: agent workflow, testing strategy, 123 tasks across milestones M0–M8, progress checklist, decision log | Plan |

Start with [`00-vision/vision.md`](00-vision/vision.md), then [`01-architecture/architecture-overview.md`](01-architecture/architecture-overview.md), then [`02-systems/README.md`](02-systems/README.md).

## Wave status

| Wave | Theme | Status | What it adds |
|---|---|---|---|
| 1 | Foundation | done | Vision, pillars, player experience, glossary, scope and traceability, architecture overview, tech stack, global constants, a one-page summary of every system, roadmap |
| 2 | System designs | done | Full architecture set (simulation core, data model, module interfaces, content pipeline, persistence, performance budget, extension guide); every system at design level with all mechanics decided |
| 3 | Content and balance | done | All data tables, formulas and tuning constants; world-generation parameters; embark catalog and prices; threat schedules; UI screen list, layouts, keymap and mouse model |
| 4 | Implementation-grade | done | Schemas, algorithms, tick order, event and command catalogs, save format, ASCII wireframes of every screen, acceptance tests per system, build milestones; final consistency pass |

## Conventions used in every document

- **Header block.** Each document opens with its detail level (`W1`–`W4`), its owner (the module or system it belongs to), and the documents it depends on.
- **Section order for system documents.** Concepts, Rules, State, Interfaces (queries, events consumed, events emitted, commands), Player-facing behavior, Tuning constants, Extension points, Acceptance criteria. Sections that do not apply are omitted, never left empty.
- **Identifiers.** Content IDs are `snake_case` strings (`hematite`, `cave_crawler`, `dig_channel`). They are stable forever once published because they appear in save files. Numeric indices are assigned at load time and never stored.
- **Constants are defined once.** Global scale and time constants live in [`01-architecture/constants.md`](01-architecture/constants.md). A system's tuning constants live in that system's document. Content values live in `03-content/` tables. Every other mention is by name (`FLUID_MAX_LEVEL`), never a repeated literal.
- **Units.** Time in ticks unless a larger unit is clearer (then it is written as `3 days` and the tick conversion is in `constants.md`). Distance in tiles. Vertical distance in z-levels. Money in marks. Percentages are integers 0–100.
- **Names.** Systems are referred to by their numbered name (`04 Fluids`). Events are `PascalCase` (`FluidSettled`). Commands are verbs in `PascalCase` (`DesignateDig`). Components are nouns in `PascalCase` (`Needs`).
- **Cross-links** are relative Markdown links. A link check runs before each wave is committed.

## Directory map

```
docs/
  README.md                 this file
  roadmap.md                wave plan and build order
  00-vision/                vision, player-experience, glossary, scope
  01-architecture/          architecture-overview, tech-stack, constants, (W2) simulation-core,
                            data-model, module-interfaces, content-pipeline, persistence,
                            performance-budget, extension-guide
  02-systems/               README (index + summaries), (W2) 01-world-generation … 24-ui-and-input
  03-content/               (W3) materials, minerals-and-metals, items, weapons-and-armor, creatures,
                            plants, skills-and-professions, jobs, buildings-and-furniture,
                            workshops-and-recipes, regions-biomes-and-traits, personality-and-thoughts,
                            names, glyphs-and-colors
  04-implementation/        (W4) schemas/, algorithms/, tick-order, event-catalog, command-catalog,
                            save-format, ui-screens/, acceptance-tests, build-milestones, tooling
  05-plan/                  README, 00-agent-workflow, 01-testing-strategy, M0-skeleton … M8-polish,
                            PROGRESS (task checklist), DECISIONS (ambiguity log)
```
