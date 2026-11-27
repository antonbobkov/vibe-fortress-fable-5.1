# T-808 — After T-796/T-797 the sweep keeps 27 fewer dwarves alive, with fewer deaths

**Source:** the T-796/T-797/T-801 merge ([T-796](../archive/tasks/T-796-threat-needs-a-path.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

The master sweep at `9a13599a` (run 45911220303), the T-796/T-797/T-801 merge, pooled 1139.75 living and 108.5 deaths, against 1167.25 / 114.75 at `0eb44a30` (run 45831839298). It is deterministic: the branch's own sweep at `2839c422` (run 45883854674) gave the same figures, seed for seed. Living fell by about 27 while deaths fell by about 6, so the loss is not dwarves killed. It is dwarves who never came, or who came later: immigration, births, or a wealth or population cap reached later. Most of it is shift 0 (1088 living against about 1163), and no single seed is past the tracing threshold.

The rule changes in that merge are 16's threat scan (a hostile counts only if it can walk or shoot to the dwarf, so dwarves behind a locked gate keep working) and 18's emergence (the Hollow-born crack the vein's level into floor). Neither obviously touches immigration.

## What to do

Find the mechanism, then decide.

1. Pair the two commits seed by seed (`0eb44a30` is master before; the change set is `c038ce01`, `00654dc0`, `d4b2d985`). List the seed-shifts whose living moved most, and for two or three of them trace the population over the three years: arrivals per wave, births, deaths, and the wealth and cap that set each wave.
2. Split the change: sweep T-796's threat scan alone and T-797's cracks alone, each paired with its base, to say which one moves living.
3. If the cause is a real cost of the rule (for example, dwarves working through a raid behind a gate and the fortress's wealth or mood falling), weigh whether to keep it. If it is a timeline shift with no cost to the player, record that and close.

Record the figures here. Adopt any fix only if paired deaths stay within about 8 of the base and living comes back toward 1167.

## Done

- [ ] The mechanism named, with the seeds and the figures.
- [ ] A decision recorded, and the spec updated if a rule changes.
