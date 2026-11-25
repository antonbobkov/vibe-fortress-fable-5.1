# T-726 — A creature called by its species is shown by its species id

**Source:** T-713 ([work file](../archive/tasks/T-713-hostile-view-sections.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

Spawn gives a creature without a name of its own its species's id as its `Creature.name` (`src/core/spawn.ts`, `name: overrides.name ?? row.id`). Every place that writes `Creature.name` for such a creature shows the id, underscores and all: a gloam captain's view in Look is titled `gloam_captain`, and the hover line and the tile list read `gloam_captain, Attacking` (`creatureSummary` in `src/ui/panels/look.ts`, `lookTitle` in `src/ui/screens/fortress.ts`). A cow or a wolf hides it because its id and its name are the same word. `fortress.ts`'s `namedCreatures` and T-713's `Leader` row already tell such a creature apart (its name equals its species id) and use the species's name (`gloam captain`).

## What to do

- One helper in `src/ui` gives a creature's display name: its own name, else its species's name from the creatures table; the view's title, the gone view's title, the tile list's row, the hover summary, Units All and the log's links use it.
- Keep `Creature.name` as it is (saves hold it); the change is presentation only.

Decided while doing it:

- The fix is in the UI, not the data. `Creature.name` is in every save and in the world hash, and the combat events copy it (`killerName`); storing `''` instead of the id would move every hash and still need the UI fallback for saves already written. The id stays in the data and the UI reads it as no name.
- The helper is `src/ui/creature-name.ts`: `hasOwnName` (not empty, and neither the species' id nor its name), `creatureName` and `creatureNameOf`. Its users: Look's title (`lookTitle`, `showCreature`), the gone view's title and an item's last carrier, the tile list's row, the hover line (the first creature and the one other), the creature links of an item's view, T-713's `Leader` row, Units All's rows, the log's link names (`namedCreatures`: a creature called by its species is still no link, 24 § Inspection), the pasture picker's and slaughter question's "the cow" test and the cage's `Holds a wolf` line, which compared the name with the species' name only (a caged gloam captain read `Holds gloam_captain`). Places that only ever name dwarves (workers, brokers, squads) are unchanged. The Animals panel's own `named` test and the log's `creatureWords` already read the id as no name, and the Animals panel's counted rows already use T-700's plurals; no other place counts creatures by name.
- The rule is in 24 § Inspection (a creature is named by its own name, else its species'; the id is never shown).

## Done

- [x] Tests (`describe` with the task id): a gloam captain's view is titled `gloam captain`, its tile-list row and hover line say `gloam captain`; a named dwarf and a cow are unchanged (`test/unit/ui/t726-species-name-not-id.test.ts`: the captain's title, tile-list row, hover line, summary and Units All row; a second creature on the tile in the hover line; the title of the captain's view once it is out of sight; a named dwarf and a cow; and in `u05-building-panel.test.ts`, a caged gloam captain reads `Holds a gloam captain`).
- [x] UI only: world hashes unchanged (no file under `src/core` or `src/systems` changed).