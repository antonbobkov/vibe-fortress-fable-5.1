# Implementation Specification

**Detail level:** W1 (index only; contents arrive in Wave 4) · **Owner:** implementation

This folder will hold the implementation-grade material: everything a developer needs beyond the system designs and content tables to write the code without inventing anything.

## Planned contents

| Path | Contents |
|---|---|
| `schemas/` | TypeScript-style type definitions: components, system states, content rows, events, commands, save structures |
| `algorithms/` | Step-by-step pseudocode for every non-trivial algorithm, one file per algorithm |
| `tick-order.md` | The exact per-tick sequence with cadences and phases |
| `event-catalog.md` | Every event: fields, emitters, consumers |
| `command-catalog.md` | Every command: fields, validation, owning system, resulting events |
| `save-format.md` | Byte-level save layout, versioning and migration |
| `ui-screens/` | ASCII wireframes for every screen and panel, with keymaps and mouse behavior |
| `acceptance-tests.md` | Scenario checklists per system |
| `build-milestones.md` | Build order with what is testable at each milestone |
