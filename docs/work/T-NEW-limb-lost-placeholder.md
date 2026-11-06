# T-NEW — A limb lost by a creature that dies in the same tick is logged as "{dwarf} has lost a limb."

**Source:** T-514 (the screenshots of `three-years-p4-3`'s year-2 siege, a save of day 185 played on 100 ticks) · **Size:** S · **Needs:** — · **Status:** open

## Why

The log of the siege picture reads "A cat has died." then "! {dwarf} has lost a limb.": the placeholder is printed as it stands. `announce.limb_lost` (`src/ui/strings.ts`) names its creature through `{dwarf}`, which `Announcements.params` (`src/ui/announcements.ts`) fills from the event's `id` only while that creature still exists. `LimbLost` carries `id, part` and no name, so when the blow that cuts the limb also kills the creature, the entity is gone by the time the batch is announced and nothing fills `{dwarf}`. The line also says "dwarf" for a cat or a gloam.

## What to do

- Give `LimbLost` the name and species the announcement needs (as `CreatureDied` carries `name` and `species`), or have the announcement fall back to them, so the line names the creature whether or not it lives.
- Use a placeholder that suits any creature (`{name}`), keeping "has lost a limb" for a dwarf and the species name for an animal or a raider, in the way `CreatureDied`'s line names its creature.
- A unit test: a creature that loses a limb and dies in one tick is logged by its name, with no `{` left in the line.

## Done

- No announcement of a lost limb prints a raw placeholder; the test above passes.
