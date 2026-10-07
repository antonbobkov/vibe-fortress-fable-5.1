# T-124 — A high-quality meal's joy relief writes the old hunger back

**Source:** F-17 re-measure, [`../../reports/audits/2026-10-07-balance-after-f17.md`](../../reports/audits/2026-10-07-balance-after-f17.md) § Simulation findings (read in code, not yet seen in a run) · **Size:** S · **Needs:** — · **Status:** open

## What is wrong

In `src/systems/dwarves/activities.ts` (about lines 413–426) the eating step captures the dwarf's `Needs` once, as `n`, and then calls `change` twice. Each call writes `{...n, [name]: clamp(n[name] - relief)}`. For a meal of quality 4 or better, the first call writes the hunger relief and the second writes the joy relief from the same old snapshot, so hunger returns to its old value. The meal is consumed and the dwarf is still hungry.

Example: hunger 65 and joy 80 before. After the first write, hunger 0 and joy 80. After the second, hunger 65 and joy 60.

[`../02-systems/10-dwarves.md`](../02-systems/10-dwarves.md) § Needs gives a meal hunger −100 and a fine meal joy −20. Both must persist.

## What to do

1. Write a unit test that feeds a dwarf a quality-4 meal and checks both needs afterwards. It should fail today. If it passes, the report's reading was wrong: say so and close the task with the test kept.
2. Fix the step so each write starts from the current component value, or make one write with both changes.
3. Look for the same pattern (one snapshot, several writes) in the other activities of that file, drinking and resting first.
4. This changes how well lavish meals feed a fortress, so golden files may move. Say which and why in the commit body.

## Done

- The test fails before and passes after.
- The verification commands of [`../process/agent-workflow.md`](../process/agent-workflow.md) are green.
