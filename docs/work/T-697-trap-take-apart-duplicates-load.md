# T-697 — Taking a trap apart gives back its load twice

**Source:** T-695 (found while testing a ruin's armed trap) · **Size:** S · **Needs:** — · **Status:** open

## Why

A built trap keeps its loaded items installed (`trapLoaded`, 19's `TrapRecord.loaded`), and 14's build completion also writes each loaded unit into the building's consumed inputs (`settings.inputs`, `complete` in `src/systems/buildings/build.ts`, both the delivered path and `TestWorld.build`'s). Taken apart, `dismantle` makes a new item for every consumed input, and 19's `BuildingRemoved` drops the installed load on the tile as well. A probe in T-695: a weapon trap built with one mechanism and one bow, taken apart, left one mechanism and two bows. So a fortress can copy a weapon (or a cage, or a stone) by building a trap and taking it apart; a stone-fall trap that has fallen and been rearmed gives back a stone it no longer has.

A ruin's armed trap (14 § Wrecks) is placed with only its mechanism as its input, so it gives back exactly what it holds; the fortress's own traps do not.

## What to do

Keep a trap's loaded units out of `settings.inputs` in `complete` (they are not consumed: 19 returns them through `BuildingRemoved`), so a trap taken apart gives back its mechanism and what it is loaded with now, once. Check that nothing else reads a trap's `settings.inputs` (the ruin composition reads only its first unit). Say in 14 § Placement (build completion) and 19 § Trap kinds that a trap's load is installed, not consumed, and returns once. Fresh embarks that build traps change state (the three-year script builds them), so run the twenty-seed sweep.

## Done

- [ ] Tests: a weapon trap and a stone-fall trap (spent, then rearmed) taken apart give back one mechanism and their current load, once.
