# T-157 — Every command, event, job type and building type is exercised by a test

**Source:** T-114 and its report, [`../../reports/audits/2026-10-08-playthrough-coverage.md`](../../reports/audits/2026-10-08-playthrough-coverage.md) (gap 10; § Never touched; bug 3) · **Size:** M · **Needs:** — · **Status:** open

## Why

The audit's recorder found things that no test which steps a world ever reaches:

- command: `ReleaseCage` (tested only as "the panel sends it");
- events: `WorldGenerated`, `HuntAbandoned`, `FishPoolDepleted`, `DwarfNearSpring`, `LegendaryReached`, `AmbushSprung`, `MonsterSpawned`, `TrapJammed`, `TrapRearmed`, `DangerAnnounced`;
- job types: `bandage_animal`, `carve_ramp`, `clean_trap`, `dress_burn`, `give_crutch`, `rearm_trap`, `suture`;
- building types: `armor_stand`, `weapon_rack`, `magma_kiln`, `ramp`, `stairs_down`, `stairs_up`, `stairs_updown`.

Some have unit tests of their rule. Six are named in no test at all: `bandage_animal`, `clean_trap`, `carve_ramp`, `weapon_rack`, `armor_stand`, `DangerAnnounced`. And seven ambush parties arrived in the measured peril-4 run without one `AmbushSprung`.

A catalogue entry that nothing can produce is either dead content or a bug. Nobody knows which until something tries.

## Decisions

- **One inventory test, `test/scenarios/inventory.test.ts`.** It runs every scenario of `test/scenarios` except the long ones with the recorder helper attached, and fails when a command of `COMMAND_TYPES`, an event of `EVENT_TYPES`, a row of `jobTypes`, or a row of `buildings` is reached by none of them and is not in the exception list. If T-156 has not landed, this task adds the recorder helper (`test/scenarios/recorder.ts`) and T-156 uses it.
- **The exception list is a table in the test**, each entry with a reason: "emitted outside the tick loop" (`WorldGenerated`), the unit or property test file that applies or emits it through a stepped world (the audit's counts file names one for each of the 51 commands that no scenario or playthrough sends), or the id of the backlog row that tracks it. An entry with no reason is not allowed.
- **Each item above gets a short acceptance scenario** in `test/scenarios/`, driven by commands and jobs, or an exception with a row:
  - `df_release_cage`: a caged creature released by `ReleaseCage`;
  - `df_trap_upkeep`: a weapon trap that jams, is cleaned and rearmed (`TrapJammed`, `clean_trap`, `rearm_trap`, `TrapRearmed`);
  - `th_ambush`: an ambush party that springs (`AmbushSprung`);
  - `th_cavern_spawn`: a breached cavern that spawns a creature (`MonsterSpawned`);
  - `fo_hunt_abandoned` and `fo_pool_depleted`;
  - `dw_legendary` and `dw_near_spring`;
  - `tr_ramp_and_stairs`: `carve_ramp` and the four construction types `ramp`, `stairs_down`, `stairs_up`, `stairs_updown`;
  - `bd_racks`: `armor_stand` and `weapon_rack` built and used by a squad;
  - `ws_magma_kiln`: the kiln built and one recipe completed;
  - `ui_danger_announced`: whatever is meant to emit `DangerAnnounced`.
  - `suture`, `dress_burn`, `give_crutch` and `bandage_animal` belong to T-152; this task lists them as exceptions naming T-152 until it lands.
- **When a scenario cannot be written because no code path produces the thing**, that is the finding. File a bug row with the evidence, add the exception naming the row, and move on. Do not write code for the feature in this task.

## What to do

1. Add the recorder helper if it is not there.
2. Write the scenarios and add each to `04-implementation/acceptance-tests.md`.
3. Write the inventory test and its exception table.
4. File the bug rows.

## Done

- `inventory.test.ts` passes, and every exception names a reason or an open backlog row.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
