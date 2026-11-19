# T-630 — A death frozen into ice carries its creature, and the legend's last words say how

**Source:** [T-625's work file](../archive/tasks/T-625-log-lines-that-explain.md), found while making death lines say their cause · **Size:** S · **Needs:** — · **Status:** open

## Why

- **A creature that the ice closes over** dies by `CreatureDied { id, cause: 'frozen', killerId: 0 }` from 04's freeze (`src/systems/fluids/freeze.ts`), without the `tile`, `species`, `name`, `faction`, `ageTicks` and `wornItems` that 17's `killCreature` gives every other death (event catalog: "`CreatureDied` also carries …"). The death is delivered at the end of the tick, so by the time the log reads the event the creature is gone: a fortress dwarf frozen into ice is announced as a note, "A creature has frozen to death in the ice.", not as a dwarf's death (danger, by name); and 10's `friend_died` thought, which reads the event's `species`, does not come to the dead dwarf's friends. (Systems that read the creature while it still exists, 13's corpse among them, are not affected; check the rest.)
- **The legend's end sentence** reads the raw cause: "The last dwarf, Ivar Coaleye, died of bled out." (`src/app/legend.ts` `endText`), where the log now says "Ivar Coaleye has bled to death."

## What to do

1. The freeze's death goes through the same fields as every other: emit them in `freeze.ts` (or route the death through a core helper that 17 and 04 share), and pin it with a test that a dwarf frozen into ice is announced by name at danger and leaves its grief thoughts. This changes the simulation (thoughts): run the instrument.
2. The legend's end sentence says how the last dwarf died in the words of the death line (`announce.died.<cause>`), with "died." for a cause with no line; 24 § The legend record's example follows.

Spec: 04 § Freezing and thawing, 17 § Death and corpses, the event catalog, 24 § The legend record.

## Done

Tests for the frozen dwarf's line and thoughts and for the legend's end sentence per cause.
