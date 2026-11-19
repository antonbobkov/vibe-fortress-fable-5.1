# T-633 — A slaughtered animal and a restless dead's end carry a death's fields

**Source:** [T-630's work file](../archive/tasks/T-630-death-event-fields-and-legend-cause.md), found while routing the ice's death through 17's · **Size:** S · **Needs:** — · **Status:** open

## Why

The event catalog's `CreatureDied` row lists the fields every emitter sets (`id, cause, killerId, tile, species, name, faction, ageTicks, wornItems`). Two emitters outside 17's `killCreature` still send less:

- **08's slaughter** (`src/systems/animals/producer.ts`) sends `{ id, cause: 'slaughter', tile, faction, species }`: no `name`, `killerId`, `ageTicks` or `wornItems`. The creature is destroyed in the same step, so a named pet slaughtered is read from the event alone; a line or thought that wants its name gets none.
- **18's restless dead returning to rest** (`src/systems/threats/caverns.ts`) sends `{ id, species: 'restless_dead', tile }`: the species as a content id string where every other death sends the row index, and no `cause`, `faction` or `name`. A reader of `species` as an index (10's grief check, 15's `saw_death`, the legend's kill milestones) reads a string.

## What to do

Give both events the catalog's fields, the way `killCreature` builds them (or route them through it with their own causes, keeping their own corpse and drop handling). Decide the restless dead's cause (`faded`-like: a new `laid_to_rest`, which has no death line and says "has died." if it is ever announced, or none). Check each `CreatureDied` subscriber against the new fields.

Spec: 08 § Slaughter, 18 § Caverns (the restless dead), 17 § Death and corpses, the event catalog.

## Done

Tests that each event carries the catalog's fields; the slaughter line and any grief unchanged except where they now read the name.
