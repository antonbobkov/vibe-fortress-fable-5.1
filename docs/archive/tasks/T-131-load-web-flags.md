# T-131 — Preserve saved web flags during load bootstrap

Closed by the T-131: preserve saved populations and web flags during load commit.

**Source:** T-130 save/load regression probe · **Size:** M · **Needs:** — · **Status:** open

## Evidence and scope

[Persistence](../../01-architecture/persistence.md) requires a loaded world to retain
its saved state. When cavern floor tiles are carved after world initialization,
a round trip adds Web flags on those floors. The T-130 probe had three initial
fauna on a 5 by 5 floor at z=21; hash `33057243be7e3850` loaded as
`891d9243107b9850`, with equal saved system and entity state but new Web bits.
The fauna regression isolates system 08 using an empty cavern monster spawn
fixture and then passes unchanged hash and repeated-breach assertions.

`src/app/game-save.ts` constructs HeadlessGame from the restored map before
restoring entities and system state. `src/systems/threats/index.ts` initialization
calls `spawnInitialCavernMonsters`; `src/systems/threats/caverns.ts` writes initial
web flags. Deserialization replaces the temporary monsters and web records,
but does not undo their map mutations. This is outside T-130's accepted fauna
and reservation changes.

## Proposed resolution

Make loading bootstrap systems without creating initial populations or their
map side effects, then restore saved populations and web records. Preserve the
ordinary new-world initialization path, budgets, constants and hash algorithm.
Add a failing regression that carves new cavern floors after initialization,
saves and loads, and checks the entire hash both immediately and after stepping.
Also cover existing saved spider webs so the fix does not erase authentic webs.
Edit [save-format.md](../../04-implementation/save-format.md) and the threat system
load rules, run the workflow checks, and close normally.

**Accepted, orchestrator, 2026-10-07** (under the owner's standing instruction to use judgement). A load must not change the world, so this is a bug fix and not a rule change.
