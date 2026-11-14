# T-544 — A well-armed squad handles wolves and bears

**Source:** [T-543](../archive/tasks/T-543-sweep-deaths-drift.md) ([the report](../../reports/audits/2026-11-10-t543-sweep-deaths-drift.md)); the owner, 2026-11-13 · **Size:** M · **Needs:** — · **Status:** open

## The owner's decision

Asked whether the higher death level from wolves and bears is acceptable, the owner said (2026-11-13): "Generally, a steel-equipped well-trained squad of ~5 fighters, few archers and a wizard should have no problem handling wildlife incursions (wolves/bears). Don't make them come too often - it's a nuisance."

This task is the first half: the squad. [T-545](../archive/tasks/T-545-dangerous-wildlife-less-often.md) is the second: how often they come.

## Why

Since T-538 a struck bear or wolf fights back, and since T-540 a passing dwarf may wake one. The sweep's bear kills went from 1.5 a sweep to 8.25. Since T-539 the three-year script hunts no aggressive animal; it shelters until the pack leaves. In T-543's probe (run 42903590270), twelve of 17 bear deaths followed the bear's first blow with no alert up. One bear in `three-years-p2-7` at shift 100 killed five dwarves over 18 days.

## What to do

1. **An arena for the owner's squad.** Build a measured arena (like T-479's peril arenas): about five melee soldiers in steel arms and armour at a good skill (say Proficient or better), two or three marksdwarves, and one runecaster with a staff or wand, against: a wolf pack at its largest group size, a bear, and the worst case the spawning rules allow (for example `beastwood`'s doubled groups). Several seeds each.
2. **The set rule.** Write it in balance.md and the arena test: such a squad wins every fight in the arena, and a soldier dies rarely (pick the bar, for example under one death in ten fights against a pack, and none against a lone bear). Measure it on master first.
3. **If it fails, find why and fix it.** First check rules that may be wrong: armour that should stop a bite, a squad that does not fight as a squad, marksdwarves who cannot shoot, a runecaster who casts nothing useful. Fix those with tests. Only if the rules are right and the squad still loses, soften wolves and bears in the content rows (damage, blood, or the flee percent T-538 kept), the least change that meets the rule. Leave their behaviour (strike back, wake on noise, heavy sleepers) as it is. Weaker or untrained squads should still find them dangerous; check with a copper-armed squad of novices that the fight is still a risk.
4. **The three-year script.** Once a strong squad can beat them, let the script hunt a wolf pack or a bear near the fortress with its mustered squad when the squad is armed in metal (T-539's muster), and keep sheltering when it is not. Measure it with the pooled sweep.

## Done

- The arena test and its set rule are in, with the measured results. The three-year script's answer is chosen on the sweep's evidence and written in testing-strategy.md's paragraph on the script.
- The sweep and instrument verdicts pass; report the bear and wolf deaths by killer, before and after.
