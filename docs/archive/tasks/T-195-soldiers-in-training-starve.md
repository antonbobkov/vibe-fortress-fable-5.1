# T-195 — A squad left in `train` mode starves

**Source:** T-151, the defence-year scenario (Gemini, 2026-10-10); see the Progress section of [`T-151-defence-year-scenario.md`](../../work/T-151-defence-year-scenario.md) · **Size:** M · **Needs:** — · **Status:** closed

## What was seen

In `defence_year` (seed `defence-year`, peril 2), a squad of four set to `train` and left there died of starvation, all four on day 58 (tick 69,602). In an earlier run with no break at all, two died on day 41. Food and drink were in stock. A week in `off` mode in between let them eat and postponed the deaths; putting them back in `train` killed them. The reported cause is that a soldier on duty does not leave training to eat or drink. That cause is the reporting agent's reading and is **not verified**.

If it holds, it also bears on the balance work: every long fixture that arms a squad at perils 2 and 4 keeps it in `train` or `active`, and those fortresses die.

## What the spec says

[`16-combat.md`](../../02-systems/16-combat.md) § Squads says what being on duty means (no flight, the military title, no interruption by the hearth alert, attacking a visible hostile). [`10-dwarves.md`](../../02-systems/10-dwarves.md) § Behavior selection orders the behaviours: `flee`, `retreat`, `need`, `duty`, and so on. If `need` ranks above `duty` there, a soldier with a need at its want or critical threshold must go and serve it, and the code is wrong. If the spec lets duty hold a soldier through a want-level need, it must still release the soldier at the critical threshold; no rule should let a dwarf starve beside food.

## What to do

1. **Reproduce first**, in a small scenario: four dwarves in a squad in `train` mode with a barracks, food and drink within reach, 30 days. Record each soldier's hunger, thirst and rest, its behaviour and its activity over time. If nobody starves, the fault is elsewhere in the defence fixture: say what it is and re-scope this task.
2. Find the rule that keeps the soldier training (the brain's behaviour selection against 10, and the training activity's end condition against 16).
3. Fix it to the spec. If the spec is silent on training against needs, write the rule: training is ordinary duty; a want-level need ends the current training session at its next break point, and a critical need interrupts it at once; the soldier returns to training when the need is served. `active` mode with a hostile in sight holds the soldier only until a need is critical.
4. Regression: the scenario of step 1, with no deaths and each soldier still gaining skill.

## Done

- The reproduction fails before the fix and passes after it.
- The spec states how needs and duty rank for a soldier in `train`, `active` and under an alert.
- The verification commands of [`../../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.

## Progress (2026-10-10): reproduction

**Outcome A: Soldiers starve.** The bug reproduced completely in the minimal scenario [`test/scenarios/t195_train_needs.scenario.ts`](../../../test/scenarios/t195_train_needs.scenario.ts). All four soldiers in the training squad died of starvation on day 17 (tick 20,402) without eating or drinking once, despite 100 prepared meals and barrels of drink in a stockpile a short walk (2 tiles) from the barracks. The three civilians in the same fortress ate, drank, and survived the full 30 days.

The scenario is registered with the milestone 8 scenarios in [`test/scenarios/m8.test.ts`](../../../test/scenarios/m8.test.ts).

### Mechanism (measured)

In a tick-by-tick instrumented run over 600 ticks after hunger passed 50:
1. `src/systems/dwarves/activities.ts:371` (`Activities.step`):
   When a need activity starts (e.g. sleep or eating), `this.movement.walkTo(id, p.target, 'need', ctx)` sets the movement target to the need's destination (bed or stockpile meal/drink tile).
2. `src/systems/combat/squads.ts:494` (`stepSquadOrders`):
   Later in the exact same tick, `stepSquadOrders` iterates over all squad members with `soldier.onDuty`. In `train` mode during `calm` alert, `destTile` is the barracks tile. Because it did not check whether `brain.behavior === 'duty'`, it unconditionally executed:
   `ctx.world.services.movement?.walkTo(m, destTile, 'combat', ctx);`
3. `src/core/movement.ts:177–183` (`MovementCore.walkTo`):
   When differing movement targets are submitted in the same tick (`walk.target !== target`), `this.stopWalking(id)` is triggered. Measured on 599 out of 600 ticks: every tick `stopWalking` cleared the path request, so the dwarf was frozen in place and never moved a single tile toward food, drink, or bed.
4. `src/systems/dwarves/brain.ts:251–256` (`select`):
   `if (!civ)` intercepted non-civilian dwarves prior to want-level needs evaluation (lines 258–261), preventing soldiers in `train` mode from ever selecting want-level needs (hunger/thirst 50–84).

### Spec quotes

- [`docs/02-systems/10-dwarves.md`](../../02-systems/10-dwarves.md) § Behavior selection:
  > "4. `need` (critical): satisfy the most critical need. Always applies to soldiers on duty as well as civilians, in every squad mode."
  > "5. `duty`: the dwarf is a soldier on duty (16): 16 controls movement and targets. In `train` mode, training is ordinary duty, and want-level needs (step 6) take precedence so the soldier leaves duty to eat, drink, or sleep and returns when satisfied. In `active` mode with a hostile in sight, or when the squad has an explicit order (`station`, `patrol`, `follow`, `kill`) during an alert (`watchful` or `hearth`), duty holds the soldier against want-level needs; otherwise want-level needs also take precedence."
  > "6. `need` (want): satisfy the highest need over its want threshold, unless a job with priority ≤ `NEED_DEFER_PRIORITY` is available and the need is below its critical threshold."

- [`docs/02-systems/16-combat.md`](../../02-systems/16-combat.md) § Squads and § Training:
  > "While a soldier's brain behavior is `need` (or `flee`, `retreat`, `patient`), squad code does not move the soldier, assign a training partner, or cancel the soldier's activity plan; the squad resumes control only when the soldier returns to `duty`. A critical need always takes precedence over duty in every mode. In `train` mode, want-level needs also take precedence over duty: training is ordinary duty, and the soldier goes to eat, drink or sleep and returns to training afterwards. In `active` mode with a hostile in sight, or when the squad has an explicit station, patrol, follow or kill order during an alert, a want-level need waits, but a critical need still wins."
  > "Sparring: pairs of present members who are currently in `duty` behavior (not satisfying a need, fleeing, or hospitalized)..."

- [`docs/04-implementation/algorithms/creature-brains.md`](../../04-implementation/algorithms/creature-brains.md) § Dwarf brain:
  > "if combat.onDuty(id): dutyHolds = squad.mode == 'active' and (hostileInSight(id) or (alert != 'calm' and hasActiveOrder(squad))); if dutyHolds: b.behavior = 'duty'; return; want = highest need over its want threshold; if want: startNeed(id, want); return; b.behavior = 'duty'; return"
  > "While a soldier's brain behavior is `need` (or `flee`, `retreat`, `patient`), squad positioning and training do not command movement or partner pairing."

### Summary lines

- `[Soldier 0 (ID 16777272)] MaxNeeds(H:100, T:100, R:100) | Behaviors(duty: 1.7%, need: 55.0%, unknown: 43.3%) | Meals:0, Drinks:0, MaxSwordXP: 36 (initial: 0) | Status:DIED (cause: starvation, tick: 20402, day: 17)`
- `[Soldier 1 (ID 16777276)] MaxNeeds(H:100, T:100, R:100) | Behaviors(duty: 1.7%, need: 55.0%, unknown: 43.3%) | Meals:0, Drinks:0, MaxSwordXP: 36 (initial: 0) | Status:DIED (cause: starvation, tick: 20402, day: 17)`
- `[Soldier 2 (ID 16777280)] MaxNeeds(H:100, T:100, R:100) | Behaviors(duty: 1.9%, need: 54.7%, unknown: 43.3%) | Meals:0, Drinks:0, MaxSwordXP: 30 (initial: 0) | Status:DIED (cause: starvation, tick: 20402, day: 17)`
- `[Soldier 3 (ID 16777284)] MaxNeeds(H:100, T:100, R:100) | Behaviors(duty: 1.4%, need: 55.3%, unknown: 43.3%) | Meals:0, Drinks:0, MaxSwordXP: 24 (initial: 0) | Status:DIED (cause: starvation, tick: 20402, day: 17)`
- `[Civilian 4 (ID 16777288)] MaxNeeds(H:100, T:57.6, R:62.4) | Behaviors(idle: 66.7%, need: 33.3%) | Meals:7, Drinks:22 | Status:ALIVE`
- `[Civilian 5 (ID 16777292)] MaxNeeds(H:100, T:59.2, R:64.5) | Behaviors(idle: 63.3%, need: 36.4%, work: 0.3%) | Meals:7, Drinks:21 | Status:ALIVE`
- `[Civilian 6 (ID 16777296)] MaxNeeds(H:100, T:59.2, R:64.7) | Behaviors(idle: 61.7%, need: 38.3%) | Meals:6, Drinks:22 | Status:ALIVE`

### Threshold moments (First hungry soldier: Soldier 3, ID 16777284)

- **Threshold 50** (tick 951, day 0):
  - Hunger: 50.05
  - Behavior: `need`, activity: `sleep` (triggered by sleep window in `brain.ts` L247–248: `hourOf(ctx.tick) === schedule.sleepStartHour && n.rest > 20`).
  - Food reachable: `true` (100 free meals in stockpile, not forbidden, not reserved).
  - Next 600 ticks: For ticks 952–1551 (600 ticks), soldier remained in `behavior: "need"`, `activity: "sleep"`. Hunger rose from 50.05 to 63.0. Soldier never moved to bed because `stepSquadOrders` repeatedly re-ordered combat movement to the barracks.
- **Threshold 75** (tick 2051, day 1):
  - Hunger: 75.05
  - Behavior: `need`, activity: `thirst` (thirst reached critical threshold 90 before hunger reached 75, triggering `ranked(n, true)` in `brain.ts` L245–246).
  - Food reachable: `true` (97 free meals in stockpile, not forbidden, not reserved).
  - Next 600 ticks: For ticks 2052–2651 (600 ticks), soldier remained in `behavior: "need"`, `activity: "thirst"`. Hunger rose from 75.05 to 87.2. Soldier never reached drink because movement was constantly interrupted and redirected to barracks.
- **Threshold 90** (tick 2751, day 2):
  - Hunger: 90.05 (critical hunger threshold reached).
  - Behavior: `need`, activity: `thirst` (unresolved thirst activity was still active in `activities.plans`).
  - Food reachable: `true` (97 free meals in stockpile, not forbidden, not reserved).
  - Next 600 ticks: For ticks 2752–3351 (600 ticks), soldier remained in `behavior: "need"`, `activity: "thirst"`. Hunger reached 100.0. Soldier never moved from barracks and ultimately died of starvation at tick 20,402 (day 17).

### Code location (read in code)

1. `src/systems/dwarves/brain.ts` lines 244–261 (`select()`):
   - Critical needs are checked first (L245–246), followed by sleep schedule (L247–248).
   - If needs are at want-level (e.g. hunger 50..89), they are skipped for military dwarves because lines 251–256 intercept non-civilians:
     ```ts
     if (!civ) {
       b.behavior = 'duty';
       b.activity = 'On duty';
       b.targetTile = ctx.world.services.movement?.tileOf(id) ?? -1;
       return;
     }
     ```
     Want-level needs (L258–261) are only reachable for civilians (`civ === true`).
2. `src/systems/combat/squads.ts` lines 468–496 (`stepSquadOrders()`):
   - For any squad member where `soldier.onDuty` is true (which is always true when `squad.mode === 'train'` and alert is `'calm'`, per lines 21–39 `isSquadEffectiveActive()` and `updateSquadDuty()`), squad orders repeatedly issues:
     ```ts
     if (destTile !== null && destTile !== tileM) {
       ctx.world.services.movement?.walkTo(m, destTile, 'combat', ctx);
     }
     ```
   - Even when a soldier's brain switches to `behavior = 'need'` at critical need levels, `soldier.onDuty` remains true.
3. `src/core/movement.ts` lines 177–183 (`walkTo()`):
   - When dwarf activities calls `movement.walkTo(id, foodOrDrinkTile, 'need', ctx)` and combat subsequently calls `movement.walkTo(id, barracksTile, 'combat', ctx)` within the same tick, `walk.target !== target` triggers `this.stopWalking(id)` every single tick. The path request is repeatedly discarded and recreated, so the soldier never moves a single tile toward food or drink and starves in place.

## Fix (2026-10-10)

1. `src/systems/dwarves/brain.ts` (`select()`):
   - Preserved critical needs ranking before military duty checks for all dwarves.
   - Evaluated `dutyHolds` for active soldiers with hostiles in sight, active orders, or non-calm alert.
   - Allowed want-level needs to be served when in `train` mode or when duty does not hold.
2. `src/systems/combat/training.ts` (`stepTraining()`):
   - Skipped training pairing and sparring movement commands when soldier's brain behavior is `need` (or `flee`, `retreat`, `patient`).
3. `src/systems/combat/squads.ts` (`stepSquadOrders()`):
   - Skipped squad positioning movement commands and hostile targeting when soldier's brain behavior is `need` (unless sleeping on post in active duty).
4. Tests:
   - Unit tests added in `test/unit/combat/soldier-needs.test.ts` verifying want-level and critical-level needs across squad modes and resume of training.
   - Scenario `test/scenarios/t195_train_needs.scenario.ts` registered in `test/scenarios/m8.test.ts`.

