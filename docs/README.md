# Deepholm — Documentation

> *A hall beneath the world.*

Deepholm is a single-player colony simulation for the browser, inspired by Dwarf Fortress. It is drawn in colored ASCII on a canvas. The world is three-dimensional and viewed one layer at a time. Dwarves have skills, needs and moods. Water flows and magma glows. There is mining, smelting and smithing; farms, herds and hunts; raids, traps and militia; caravans and newcomers.

The game is built and released, and it keeps changing: audits find things, and fixes and features follow. These documents are kept in step with it. The **specification** says how the game behaves today. Everything else here is about changing it: what is open, how work is done, and what was done before.

## The specification

`00-vision/` … `04-implementation/` are the specification. They are always current: when behaviour changes, the commit that changes the code changes these documents too. They carry no history, no dates and no task ids. The code is checked against them by `npm run content:check`, `strings:check`, `interface:check` and the golden files, and the content tables in `03-content/` are the source from which `src/content/*.json` is generated.

| Folder | Read it to learn |
|---|---|
| [`00-vision/`](00-vision/vision.md) | What the game is, who it is for, how a session feels, the vocabulary |
| [`01-architecture/`](01-architecture/architecture-overview.md) | How the software is shaped: layers, modules, contracts, tick loop, persistence, performance |
| [`02-systems/`](02-systems/README.md) | One design document per game system: rules, state, interfaces, player-facing behavior |
| [`03-content/`](03-content/README.md) | Every material, creature, plant, item, skill, job, building, recipe, region trait and thought, as tables with numbers; the balance model |
| [`04-implementation/`](04-implementation/README.md) | Type schemas, algorithms in pseudocode, exact tick order, event and command catalogs, save format, screen wireframes, acceptance tests, tooling |

Start with [`00-vision/vision.md`](00-vision/vision.md), then [`01-architecture/architecture-overview.md`](01-architecture/architecture-overview.md), then [`02-systems/README.md`](02-systems/README.md).

## How work flows

```
report or audit ──► backlog row ──► work file ──► code + tests + spec edit ──► archive
```

| Where | What it holds |
|---|---|
| [`backlog.md`](backlog.md) | Every open item in one table: id, title, source, needs, status. Nothing closed |
| [`work/`](work/) | One file per open task: what to do, the decisions already made, the spec sections it changes, what "done" means |
| [`process/agent-workflow.md`](process/agent-workflow.md) | How a task is picked up, worked, verified, committed and closed; the rules below in full |
| [`process/testing-strategy.md`](process/testing-strategy.md) | Test tiers, the scenario runner, golden files, the commands, the gate |
| [`process/ambiguity-protocol.md`](process/ambiguity-protocol.md) | What to do when the spec is silent or contradicts itself |
| [`process/tooling.md`](process/tooling.md) | How the repository's own scripts and checks are built, where that is a choice; where code constants live outside the systems |
| [`05-plan/DECISIONS.md`](05-plan/DECISIONS.md) | The decision log of the build. It is being folded into the specification, system by system (see [`work/docs-restructure.md`](work/docs-restructure.md)). Until a row is folded it is still in force |
| [`archive/`](archive/README.md) | Closed work, kept as history: the plan that built v1.0.0, the audit fixes, the closed UI fixes, closed task files |
| [`../reports/`](../reports/) | Inputs: `gates/` (frozen gate reports), `audits/` (frozen audits and measurements), `screenshots/` (written by the e2e suite) |

The rules that keep this steady:

- **Spec edits are required.** A task that changes behaviour edits the spec sections that govern it, in the same commit, and lists them in the commit body.
- **Closing a task means folding it.** Its decisions are written into the spec as plain spec text, with no id and no date. Its work file moves to the archive, and its backlog row is deleted. Git is the history.
- **Reports are inputs and are never updated.** A re-measure or a follow-up is a new dated report.
- **One id series for all work**, `T-101` onwards, each item with a source. Items that were open under an older series keep their id until they close.
- **Nothing in the specification links into `work/` or `archive/`.**

## Conventions used in every specification document

- **Header block.** Each document opens with its owner (the module or system it belongs to) and the documents it depends on.
- **Section order for system documents.** Concepts, Rules, State, Interfaces (queries, events consumed, events emitted, commands), Player-facing behavior, Tuning constants, Extension points, Acceptance criteria. Sections that do not apply are omitted, never left empty.
- **Identifiers.** Content IDs are `snake_case` strings (`hematite`, `cave_crawler`, `dig_channel`). They are stable forever once published because they appear in save files. Numeric indices are assigned at load time and never stored.
- **Constants are defined once.** Global scale and time constants live in [`01-architecture/constants.md`](01-architecture/constants.md). A system's tuning constants live in that system's document. Content values live in `03-content/` tables. Every other mention is by name (`FLUID_MAX_LEVEL`), never a repeated literal.
- **Units.** Time in ticks unless a larger unit is clearer (then it is written as `3 days` and the tick conversion is in `constants.md`). Distance in tiles. Vertical distance in z-levels. Money in marks. Percentages are integers 0–100.
- **Names.** Systems are referred to by their numbered name (`04 Fluids`). Events are `PascalCase` (`FluidSettled`). Commands are verbs in `PascalCase` (`PlaceBuilding`). Components are nouns in `PascalCase` (`Needs`).
- **Cross-links** are relative Markdown links. `npm run docs:check` fails on one that points at a file that does not exist; it runs in CI, in the gate and in `npm test`.

## Directory map

```
docs/
  README.md                 this file
  backlog.md                open items only
  00-vision/                vision, player-experience, glossary, scope
  01-architecture/          architecture-overview, tech-stack, constants, simulation-core, data-model,
                            module-interfaces, content-pipeline, persistence, performance-budget,
                            extension-guide
  02-systems/               README (index and summaries), 01-world-generation … 24-ui-and-input
  03-content/               materials, minerals-and-metals, items, weapons-and-armor, creatures, plants,
                            skills-and-professions, jobs, buildings-and-furniture, workshops-and-recipes,
                            regions-biomes-and-traits, personality-and-thoughts, names, glyphs-and-colors,
                            embark-catalog, threat-schedules, caravan-goods, ui-keymap-and-screens, balance
  04-implementation/        schemas/, algorithms/, ui-screens/, tick-order, event-catalog, command-catalog,
                            save-format, acceptance-tests, build-milestones, tooling
  05-plan/                  DECISIONS (the decision log, until it is folded into the spec)
  process/                  agent-workflow, testing-strategy, ambiguity-protocol, tooling
  work/                     one file per open task
  archive/                  build-plan/, fixes/, ui-fixes/, tasks/ (closed work), decisions-archive
reports/
  gates/                    gate reports, frozen
  audits/                   audits and measurements, frozen
  screenshots/              written by the e2e suite
```
