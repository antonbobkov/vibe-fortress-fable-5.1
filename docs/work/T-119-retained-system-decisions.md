# T-119 — Resolve retained systems 01–07 decision/code mismatches

**Source:** [T-104 triage](../archive/tasks/T-104-triage-systems-01-07.md) · **Size:** M · **Needs:** owner resolutions below · **Status:** open

## Scope

T-104 verified the decisions against the implementation. The five whole rows
remain in [the decision log](../05-plan/DECISIONS.md) because code disagrees.
This file reports the mismatches; it does not choose a rule or authorize a
simulation change. Obtain the owner's resolution before implementation.

| Row | Decision | Code evidence |
|---|---|---|
| D-048 | Sunken hall site is the highest dry floor in the far half of the map, equal heights tied by column. | `src/systems/terrain/generate/traits.ts:109` scores height times 1,000 plus inward distance; equal heights prefer greater inward distance before column order. |
| D-053 | The tick's collapses emit one `ConstructionCollapsed` batch. | `src/systems/terrain/api.ts:107` and `:146` settle each terrain action; `:264` emits and clears the collapse batch per settle call, allowing multiple batches in one tick. |
| D-076 | A tree cleared for the wagon drops its species' log range and wood. | `src/systems/embark/arrival.ts:114` captures material indices, but `:299` passes them to the plants table's `byIndex`, whose indices differ. Compare the material-index mapping at `src/systems/terrain/facts.ts:88`. |
| D-101 | Lightning visits exposed tiles in ascending tile order. | `src/systems/weather/index.ts:410` sorts chunk indices and then enumerates each chunk's tiles, so tiles in one chunk's later rows precede lower tile indices in the next horizontal chunk. |

| D-102 | The `EntitiesMoved` handler writes only the dwarf's `Brain`. | `src/systems/dwarves/index.ts:488` also writes `Needs` for masterwork joy relief. The movement-effects helper at `src/systems/dwarves/movement-effects.ts:33` changes only `Brain`, but the row applies to the whole handler. |

## Resolution and verification

For each row, the owner decides whether the recorded rule or the current code
stands. Implement only that decision, edit every affected spec section and
pin the selected behavior with a T-117 regression. Never resolve it by silently
deleting the row, loosening a test, or changing unrelated simulation rules.
If behavior or hashes change, regenerate only the predicted named goldens and
include the required `golden:` paragraph. Close each resolved row by folding
the resulting rule and deleting only its exact decision-log row.

Run [the required checks](../process/agent-workflow.md) before each commit.
The normal task closure rules apply once all five owner resolutions are done.
