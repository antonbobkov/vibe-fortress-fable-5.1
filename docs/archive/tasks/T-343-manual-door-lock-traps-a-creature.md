# T-343 — A door locked by hand still traps a creature in its doorway

**Closed:** 2026-10-16, in dce21bf.

**Source:** the review of T-303 (2026-10-16) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-303 made a `lock_on_alert` door wait until its doorway is clear. A door the player sets to `locked` while a creature stands in it still locks at once (`doorLocked` returns true for `mode === 'locked'` first, `src/systems/buildings/build.ts`), leaving the creature on an impassable tile: the fault T-303 removed, by another path. The invariant `creature.on-impassable` would report it.

## What to do

- Decide and implement one rule for both: a door does not become impassable while any creature (a hostile included) is in its doorway; a manual lock takes effect when the doorway clears, and the door panel says it is waiting. A unit test with a dwarf in the doorway when the lock is set, failing first.
- The review's nits on T-303: say "any creature, a hostile included" in 19 § Hearth alert retreat; add "once the doorway is clear" to the `cb_alert_hearth` row of acceptance-tests.md; one test assertion with a door-opening hostile in the doorway.

## Done

- No path locks a door on an occupied doorway; the nits are done; gates as for a simulation change.
