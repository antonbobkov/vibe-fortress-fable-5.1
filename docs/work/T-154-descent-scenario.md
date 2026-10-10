# T-154 — A descent: caverns, deepsilver, the Deep, magma workshops

**Source:** T-114 and its report, [`../../reports/audits/2026-10-08-playthrough-coverage.md`](../../reports/audits/2026-10-08-playthrough-coverage.md) (gap 5) · **Size:** L · **Needs:** — · **Status:** open

## Why

The late game is played by nothing. Measured: no long run breaches a cavern, mines deepsilver, stirs the Deep, meets a cavern monster or builds a magma workshop. `th_deep`, `tr_discovery`, `tr_deepsilver_gate`, `ws_magma` and `ma_*` test the rules on flat-test maps with carved rooms. `MonsterSpawned` is delivered in no test that steps a world. The three-year fixture mines only between z = 23 and z = 26.

## Decisions

- **A new long scenario, `descent`**, in `test/scenarios/descent.scenario.ts`, with its script in `test/scenarios/descent_fortress.ts`.
- **World:** a generated standard-size local map (not 48 × 48, so that every cavern band and the magma sea are generated as a player meets them), from a region spec with wealth 3, peril 1, igneous geology. Seed `descent`.
- **Start:** the scenario may use setup helpers for the surface fortress only: a stocked hall with food and drink for the run, a forge, an anvil, picks, and twelve dwarves. Everything below the hall is done by commands.
- **What it plays, by command:**
  - a stairwell from the hall down to the first cavern, then to the second, then to the magma sea, with `Designate` kinds `channel`, `ramp` and single stairs used at least once each on the way;
  - a wall and a door built across each breach;
  - a deepsilver vein dug after `ConfirmDeepsilver`, the ore smelted and one deepsilver item forged;
  - a magma smelter, a magma forge and a magma kiln built at the sea, each with one order;
  - a squad stationed at the lowest door.
- **Assertions:**
  - `CavernBreached` for each cavern reached, and `TilesDiscovered` for cavern tiles;
  - a cavern creature is spawned and seen (`MonsterSpawned` or the event 18 defines for it; if no event is delivered, file a bug row);
  - digging deepsilver without the confirmation is rejected `deepsilver_unconfirmed`, and accepted after it;
  - `DeepsilverMined`, then `DeepStirred` at the level the amount mined calls for (`deepThresholds`), then `MonsterEmerged` if the threshold is reached;
  - each magma workshop completes one recipe with no fuel item consumed;
  - a dwarf who walks beside magma is not burnt, and no magma leaves the sea (the fluid total of magma is unchanged);
  - no command of the script is rejected, except those the script lists as expected.
- **Deaths are reported, not asserted.** The Deep is meant to kill.
- **Where it runs.** If the scenario takes longer than the three-year scenario does, it goes to the performance tier (`test/perf/descent.test.ts`) and `testing-strategy.md` says so. Otherwise it runs in `npm test` with `milestone: 8`.

## What to do

1. Write the script and the scenario.
2. Add it to `04-implementation/acceptance-tests.md` and to `testing-strategy.md` § The long scenarios.
3. File a row for every step that commands cannot do and for every event that is never delivered.

## Progress

### 2026-10-09 — Stage 1 complete

- Stage 1 completed: standard 96×96×48 local map with seed `descent`, wealth 3, peril 1, igneous geology; surface start with 12 dwarves and stocked hall (food, drink, tools, forge, smelter, materials); single stairs down at z=32, single stairs updown at z=31, shaft down to z=20, hallway at z=20, channel to ramp at z=19, ramp at (20, 46, 19), corridor breaching Cavern 1 at (23, 45, 19).
- Assertions verified: `CavernBreached` (cavern: 1), `TilesDiscovered`, cavern tile discovered.
- `MonsterSpawned` not delivered upon cavern breach (only wakeCavernMonsters flips state); filed bug row T-193 (`docs/work/T-193-cavern-breach-monster-event.md`).

### 2026-10-09 — Stage 2 complete

- Stage 2 completed:
  - Wall built at (22, 46, 19) and door built at (22, 45, 19) across Breach 1.
  - Shaft dug down column (21, 48) from z=20 to z=11 through solid rock.
  - Corridor at z=11 dug: (21, 49, 11) to (15, 49, 11), breaching Cavern 2 at (14, 49, 11).
  - Assertions verified: `CavernBreached` (cavern: 2), `TilesDiscovered`, cavern 2 tile discovered.
  - Wall built at (15, 48, 11) and door built at (15, 49, 11) across Breach 2.
  - Squad created ("Deep Guard"), 2 soldiers assigned, mode set to 'active', and stationed at lowest door (15, 49, 11).
  - Verified soldiers on duty and squad stationed at door.
### 2026-10-09 — Stage 3 complete

- Stage 3 completed:
  - Shaft dug down column (21, 48) from z=10 to z=5 through solid rock, discovering deepsilver vein at (21, 48, 4).
  - Designating deepsilver tile (21, 48, 4) before confirmation rejected with `deepsilver_unconfirmed`.
  - Applied `ConfirmDeepsilver` and verified `fortress.deepsilverConfirmed === true`.
  - Designating deepsilver tile accepted after confirmation; mined to stairs_updown emitting `DeepsilverMined`.
  - Mined 4 more deepsilver tiles at z=4 (5 total deepsilver mined).
  - Assertions verified: `DeepsilverMined` (count >= 5), `DeepStirred` (level 1), `MonsterEmerged` (with faction 'deep' creatures).
  - Surface smelter executed `smelt_deepsilver_ore` work order, consuming mined deepsilver ore and fuel to produce deepsilver bar.
  - Surface forge executed `forge_dagger` work order, forging deepsilver dagger (`material === 'deepsilver'`).
- Remaining stages:
  - Stage 4: descent to magma sea (z=3), channel over magma, build magma smelter, magma forge, magma kiln, issue 1 order each without fuel consumed, assert dwarf near magma is not burned and magma fluid total is unchanged.

## Done

- `descent` passes where it runs.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.

