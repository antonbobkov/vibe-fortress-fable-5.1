# T-195 — A squad left in `train` mode starves

**Source:** T-151, the defence-year scenario (Gemini, 2026-10-10); see the Progress section of [`T-151-defence-year-scenario.md`](T-151-defence-year-scenario.md) · **Size:** M · **Needs:** — · **Status:** open

## What was seen

In `defence_year` (seed `defence-year`, peril 2), a squad of four set to `train` and left there died of starvation, all four on day 58 (tick 69,602). In an earlier run with no break at all, two died on day 41. Food and drink were in stock. A week in `off` mode in between let them eat and postponed the deaths; putting them back in `train` killed them. The reported cause is that a soldier on duty does not leave training to eat or drink. That cause is the reporting agent's reading and is **not verified**.

If it holds, it also bears on the balance work: every long fixture that arms a squad at perils 2 and 4 keeps it in `train` or `active`, and those fortresses die.

## What the spec says

[`16-combat.md`](../02-systems/16-combat.md) § Squads says what being on duty means (no flight, the military title, no interruption by the hearth alert, attacking a visible hostile). [`10-dwarves.md`](../02-systems/10-dwarves.md) § Behavior selection orders the behaviours: `flee`, `retreat`, `need`, `duty`, and so on. If `need` ranks above `duty` there, a soldier with a need at its want or critical threshold must go and serve it, and the code is wrong. If the spec lets duty hold a soldier through a want-level need, it must still release the soldier at the critical threshold; no rule should let a dwarf starve beside food.

## What to do

1. **Reproduce first**, in a small scenario: four dwarves in a squad in `train` mode with a barracks, food and drink within reach, 30 days. Record each soldier's hunger, thirst and rest, its behaviour and its activity over time. If nobody starves, the fault is elsewhere in the defence fixture: say what it is and re-scope this task.
2. Find the rule that keeps the soldier training (the brain's behaviour selection against 10, and the training activity's end condition against 16).
3. Fix it to the spec. If the spec is silent on training against needs, write the rule: training is ordinary duty; a want-level need ends the current training session at its next break point, and a critical need interrupts it at once; the soldier returns to training when the need is served. `active` mode with a hostile in sight holds the soldier only until a need is critical.
4. Regression: the scenario of step 1, with no deaths and each soldier still gaining skill.

## Done

- The reproduction fails before the fix and passes after it.
- The spec states how needs and duty rank for a soldier in `train`, `active` and under an alert.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green, with the browser suite.
