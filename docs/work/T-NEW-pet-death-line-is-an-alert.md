# T-NEW — A pet's death is an alert that says it was a pet

**Source:** [T-633's work file](T-633-slaughter-and-restless-dead-death-fields.md), found while checking each `CreatureDied` subscriber · **Size:** S · **Needs:** — · **Status:** open

## Why

08 § Death says "Tame deaths are announced as notes; pet deaths as alerts", and 17's registrations keep `announce.pet_died` for it. The log (`src/ui/announcements.ts`, the `CreatureDied` branch of `announce`) decides "pet" from the creature's `Tame.petOf`, read through the readers when the line is drawn. By then the animal is gone: 08 destroys a dead tame animal while the event is dispatched, and presentation listeners run after every system. So every pet's death is drawn as a plain note ("A dog has starved to death.", checked on a starving pet dog at the commit that closed T-633), never as an alert, and `announce.pet_died` is never chosen.

## What to do

1. The death event says whether the creature was a pet, taken when it died: 17's `killCreature` adds the owner (`petOf`, the dwarf's id, 0 for none) from `Tame`, as it adds `wildState` from `Wild`.
2. The log reads that field instead of the live `Tame`: a pet's death is an alert, by its cause's line where it has one (as now), else `announce.pet_died`.

Spec: 17 § Death and corpses, the event catalog's `CreatureDied` notes, 08 § Death (the existing rule).

## Done

A test that a pet dying of starvation and a pet slaughtered are alerts naming the pet, and a tame animal that is no pet stays a note.
