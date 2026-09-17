# Implementation Specification

**Detail level:** W4 · **Owner:** implementation

Everything a developer needs beyond the system designs and content tables to write the code without inventing anything.

| Path | Contents |
|---|---|
| [`schemas/components.md`](schemas/components.md) | Core scalar types, `Map3D` layout and enums, every component, fortress and calendar state, the component ownership table |
| [`schemas/content-rows.md`](schemas/content-rows.md) | Row types for every content table and the validation rules beyond types |
| [`schemas/system-state.md`](schemas/system-state.md) | Every system's serialized state, the job record, item filters, rebuild-on-load rules |
| [`algorithms/world-generation.md`](algorithms/world-generation.md) | The nine world-generation stages in pseudocode |
| [`algorithms/local-map-generation.md`](algorithms/local-map-generation.md) | Heightmap, rivers, layers, the Sea of Fire, caverns, veins, volcano, vegetation, trait features |
| [`algorithms/fluids.md`](algorithms/fluids.md) | The fluid step, the four rules, contact, freezing, mist |
| [`algorithms/pathfinding-and-connectivity.md`](algorithms/pathfinding-and-connectivity.md) | Passability, costs, edges including ramps, A* with budgets, two-level connectivity labels, the movement helper, line of sight |
| [`algorithms/jobs-and-hauling.md`](algorithms/jobs-and-hauling.md) | Assignment scoring, the job state machine, haul job creation, stockpile slots, item search, the rot queue |
| [`algorithms/combat-and-health.md`](algorithms/combat-and-health.md) | Melee and ranged resolution, projectiles, squads and training, the health tick, wound tables, patients |
| [`algorithms/creature-brains.md`](algorithms/creature-brains.md) | Dwarf behavior selection and activities, animal states, hostile party and member AI, caravans |
| [`algorithms/environment.md`](algorithms/environment.md) | Temperature and overrides, fire, the weather hour, plant growth and plots |
| [`algorithms/economy.md`](algorithms/economy.md) | Workshop operation and quality, room scoring, trade valuation and offers, immigration waves, dwarf generation |
| [`algorithms/compositor.md`](algorithms/compositor.md) | Frame skip, cell composition order, atlas drawing, layout |
| [`tick-order.md`](tick-order.md) | The exact per-tick sequence with cadences and phases |
| [`event-catalog.md`](event-catalog.md) | Every event with fields, emitters and subscribers |
| [`command-catalog.md`](command-catalog.md) | Every command with fields, owner, validation and rejection reasons |
| [`save-format.md`](save-format.md) | Container layout, sections, load procedure, migrations |
| [`ui-screens/fortress-screen.md`](ui-screens/fortress-screen.md) | The fortress screen, status bar, inspection, designate and build tools, game menu |
| [`ui-screens/menus-and-world.md`](ui-screens/menus-and-world.md) | Main menu, world generation, world map, settings, load, legend |
| [`ui-screens/embark.md`](ui-screens/embark.md) | The embark screen |
| [`ui-screens/panels.md`](ui-screens/panels.md) | Every fortress panel |
| [`ui-screens/trade-session.md`](ui-screens/trade-session.md) | The trade session |
| [`acceptance-tests.md`](acceptance-tests.md) | Scenario checklists per system with expected outcomes, and traceability to the brief |
| [`build-milestones.md`](build-milestones.md) | Build order M0–M8 with what is testable at each step |
| [`tooling.md`](tooling.md) | Package, TypeScript and ESLint configuration, test layout, CI, content loop |
