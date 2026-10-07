# T-122 — Civilians stay in "Fighting" on a narrow stair until their needs kill them

**Source:** found by Codex while repairing the economy fortress for F-17, 2026-10-07 · **Size:** S–M · **Needs:** F-17 (its report carries the seed, day and trace) · **Status:** open

## What was seen

In the three-year economy fortress, miners working a shaft that touched a cavern level died of thirst and hunger. The trace showed them standing on a narrow stair at the cavern level in the "Fighting" state. They did not take the stairs back to the hall, and they did not leave the state to eat or drink, until a need became lethal.

The fixture now avoids the case by keeping solid rock between its shaft and the cavern levels. The simulation fault is not fixed.

## What to do

1. Reproduce it from the seed and day in the F-17 report (`reports/audits/`, the "Simulation findings" section), in a small scenario test.
2. Find why a civilian keeps the fighting state with no reachable or visible enemy, and why a critical need does not break it. Check the combat system's disengage rule and the need-interrupt rule in the job system against the spec.
3. Fix the code if the spec already says what should happen. If the spec is silent, decide: a civilian with no enemy in reach for N ticks leaves combat, and a critical need always interrupts a civilian's fight. Write the rule into the system spec.
4. Add the scenario as a regression test.

## Done

- The scenario test fails before the fix and passes after it.
- The spec states when a civilian leaves combat.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
