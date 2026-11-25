# T-697 — Taking a trap apart gives back its load twice

**Closed:** 2026-11-24, in 6a922bf7,ccb8eef3,152b28e0.

**Source:** T-695 (found while testing a ruin's armed trap) · **Size:** S · **Needs:** — · **Status:** open

## Why

A built trap keeps its loaded items installed (`trapLoaded`, 19's `TrapRecord.loaded`), and 14's build completion also writes each loaded unit into the building's consumed inputs (`settings.inputs`, `complete` in `src/systems/buildings/build.ts`, both the delivered path and `TestWorld.build`'s). Taken apart, `dismantle` makes a new item for every consumed input, and 19's `BuildingRemoved` drops the installed load on the tile as well. A probe in T-695: a weapon trap built with one mechanism and one bow, taken apart, left one mechanism and two bows. So a fortress can copy a weapon (or a cage, or a stone) by building a trap and taking it apart; a stone-fall trap that has fallen and been rearmed gives back a stone it no longer has.

A ruin's armed trap (14 § Wrecks) is placed with only its mechanism as its input, so it gives back exactly what it holds; the fortress's own traps do not.

## What to do

Keep a trap's loaded units out of `settings.inputs` in `complete` (they are not consumed: 19 returns them through `BuildingRemoved`), so a trap taken apart gives back its mechanism and what it is loaded with now, once. Check that nothing else reads a trap's `settings.inputs` (the ruin composition reads only its first unit). Say in 14 § Placement (build completion) and 19 § Trap kinds that a trap's load is installed, not consumed, and returns once. Fresh embarks that build traps change state (the three-year script builds them), so run the twenty-seed sweep.

## Decisions

- **Only the mechanism is consumed.** `complete` installs a trap's load (every input after its mechanism) and no longer writes it into `settings.inputs`, on the delivered path and on `TestWorld.build`'s; 19 drops the installed load on `BuildingRemoved`. A built trap's `settings.inputs` is its one mechanism.
- **Older saves.** A trap built before this keeps its load in `settings.inputs`; `dismantle` returns only a trap's first unit (its mechanism), so such a trap gives its load back once too, with no save migration.
- **Other readers.** Nothing else reads a trap's `settings.inputs`: the ruin composition gives a trap's wreck nothing and an armed old trap its loaded items from 19's record (`src/app/ruins.ts`), the panel's wreck line reads only wrecks, `constructionItemAt` only constructions. T-695's armed ruin traps are placed with only their mechanism as input and still give back exactly what they hold.
- **Value and wealth unchanged.** A building's value is its material's value plus its type's bonus (14 § Value) and does not read `settings.inputs`; the trap's material is still its mechanism's (its first unit). The installed load stays in the item totals and wealth as before. Only taking a trap apart changes: one copy of the load fewer.

## Done

- [x] Tests: a weapon trap and a stone-fall trap (spent, then rearmed) taken apart give back one mechanism and their current load, once (`test/unit/buildings/t697-trap-load-once.test.ts`: a dwarf-built weapon trap keeps only its mechanism as input, its dagger installed, and gives back one mechanism and one dagger, the world's weapon count unchanged; a stone-fall trap fallen and rearmed gives back one mechanism and the world's stones are the fallen one and the new one, no third; a trap from an older save with its load among its inputs gives it back once). T-695's `test/unit/embark/t695-ruin-traps.test.ts`, the world hashes and the m6 `df_*` scenarios pass unchanged.
- [x] Spec: 14 § Placement (a trap's load is installed, not consumed), 19 § Trap kinds (the load returns once, through `BuildingRemoved`).
