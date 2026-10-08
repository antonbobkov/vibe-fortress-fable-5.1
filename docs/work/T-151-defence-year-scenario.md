# T-151 — A defence year: traps, a gate, a trained squad, a raid repelled

**Source:** T-114 and its report, [`../../reports/audits/2026-10-08-playthrough-coverage.md`](../../reports/audits/2026-10-08-playthrough-coverage.md) (gaps 1 and 6) · **Size:** L · **Needs:** T-140, T-141 · **Status:** open

## Why

No long playthrough plays defence. Measured in the three-year fixture at peril 4: no trap, lever, bridge, floodgate, fortification or hatch is built; the squad has mode `off`, no equipment, no training, no barracks; the only orders are `station` and `cancel`; 32 hostile parties end `looted` or `withdrew` and none `repelled`. Systems 16 and 19 are tested only in hand-built rooms (`cb_*`, `df_*`).

The fortress must also live at peril 2, which it does not before T-140 and T-141.

## Decisions

- **A new long scenario, `defence_year`**, in `test/scenarios/defence_year.scenario.ts`, with its script in `test/scenarios/defence_year_fortress.ts`. It does not change `three_years_fortress.ts`.
- **World:** the region spec of the three-year fixture at peril 2 with no traits, seed `defence-year`, 48 × 48. Length: two years, so that it meets the ambushes of year 1 and a raid of year 2.
- **It plays as a player could:** commands only, no spawned item, no terrain edit, no `build` helper. It may reuse the opening of the three-year fixture by importing its exported functions.
- **What it builds and orders, all by command:**
  - a walled gate with a door set to `lock_on_alert`, a drawbridge linked to a lever (`LinkMechanism`, `PullLever`), and a corridor with one cage trap, one weapon trap and one stone-fall trap (`SetTrapMode` on one of them);
  - a mechanic's workshop making mechanisms, and the cages and trap parts the traps need;
  - a barracks and an archery range with a target, assigned to the squad (`SetZoneSetting`);
  - a squad of four with a leader, iron equipment from the forge (`SetSquadEquipment`), mode `train` in peace;
  - on `ThreatWarning` or `RaidArrived`: alert `watchful` and then `hearth`, the lever pulled, the squad stationed behind the traps, and a `kill` order on a hostile inside the gate; afterwards alert `calm`, the trap rearmed and cleaned by jobs.
- **Assertions:**
  - `TrainingSession` occurs, and a squad member's weapon skill rises;
  - at least one `TrapTriggered`, one `CreatureCaged` or trap kill, and one `MechanismToggled`;
  - at least one party ends `repelled` or `wiped`, with `KillRecorded` for a squad member;
  - the door is `locked` while the alert is `hearth`;
  - `rearm_trap` and `clean_trap` jobs complete;
  - no command of the script is rejected, except those the script lists as expected;
  - at most two dwarves die. If the first implementation cannot meet this bound, the task records the measured figure in its commit and files a balance row; it does not loosen the other assertions.
- **It runs in `npm test`** with `milestone: 8` and its own `timeoutMs`.

## What to do

1. Write the script and the scenario.
2. Add the scenario to `04-implementation/acceptance-tests.md` and describe it in `testing-strategy.md` § The long scenarios.
3. If a step cannot be done with commands a player has, that is a bug: file a row for it and leave the step out with a comment naming the row.

## Done

- `defence_year` passes in `npm test`, with `describe`/scenario id as above.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
