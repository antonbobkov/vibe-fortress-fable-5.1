# T-NEW — A creature called by its species is shown by its species id

**Source:** T-713 ([work file](T-713-hostile-view-sections.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

Spawn gives a creature without a name of its own its species's id as its `Creature.name` (`src/core/spawn.ts`, `name: overrides.name ?? row.id`). Every place that writes `Creature.name` for such a creature shows the id, underscores and all: a gloam captain's view in Look is titled `gloam_captain`, and the hover line and the tile list read `gloam_captain, Attacking` (`creatureSummary` in `src/ui/panels/look.ts`, `lookTitle` in `src/ui/screens/fortress.ts`). A cow or a wolf hides it because its id and its name are the same word. `fortress.ts`'s `namedCreatures` and T-713's `Leader` row already tell such a creature apart (its name equals its species id) and use the species's name (`gloam captain`).

## What to do

- One helper in `src/ui` gives a creature's display name: its own name, else its species's name from the creatures table; the view's title, the gone view's title, the tile list's row, the hover summary, Units All and the log's links use it.
- Keep `Creature.name` as it is (saves hold it); the change is presentation only.

## Done

- [ ] Tests (`describe` with the task id): a gloam captain's view is titled `gloam captain`, its tile-list row and hover line say `gloam captain`; a named dwarf and a cow are unchanged.
- [ ] UI only: world hashes unchanged.
