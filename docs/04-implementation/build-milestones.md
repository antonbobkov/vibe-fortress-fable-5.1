# Build Milestones

**Owner:** implementation · **Depends on:** [acceptance-tests.md](acceptance-tests.md), [tooling.md](tooling.md)

The scenario runner groups the acceptance suite by milestone. Every group runs in `npm test`; these groups describe coverage, with no deferred feature or reduced verification gate.

| Milestone | Coverage |
|---|---|
| M0 — Skeleton | Core determinism, calendar, commands, events, persistence and basic rendering |
| M1 — Ground | World and local generation, terrain, designations, pathfinding and movement |
| M2 — Things | Jobs, hauling, items, stockpiles, buildings, zones, rooms and save/load |
| M3 — Water, fire, sky | Fluids, temperature, weather, mist, ice and fire |
| M4 — Life | Plants, animals, foraging, needs, activities, workshops and morale |
| M5 — Metal | Production, recipes, professions, quality, value and wealth |
| M6 — Steel and blood | Combat, health, threats, defense, mechanisms and the combat-dependent scenarios |
| M7 — The outside world | Trade, immigration, UI and the year-one scenario |
| M8 — Polish and balance | Three-year behavior and world/render goldens; reference measurements in the separate performance tier |

## Verification

Every task runs lint, type checking, content, strings, interface and documentation-link checks, and the complete unit, scenario, property and golden suite. Determinism and save round-trips run with the registered systems. Rendering and UI interactions have snapshot and browser coverage; budgeted workloads have performance coverage. Test tiers and commands are defined in [the testing strategy](../process/testing-strategy.md).
