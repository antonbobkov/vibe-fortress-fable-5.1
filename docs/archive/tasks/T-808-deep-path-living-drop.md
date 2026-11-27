# T-808 — After T-796/T-797 the sweep keeps 27 fewer dwarves alive, with fewer deaths

**Closed:** 2026-11-27, in fda4823a.

**Source:** the T-796/T-797/T-801 merge ([T-796](T-796-threat-needs-a-path.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

The master sweep at `9a13599a` (run 45911220303), the T-796/T-797/T-801 merge, pooled 1139.75 living and 108.5 deaths, against 1167.25 / 114.75 at `0eb44a30` (run 45831839298). It is deterministic: the branch's own sweep at `2839c422` (run 45883854674) gave the same figures, seed for seed. Living fell by about 27 while deaths fell by about 6, so the loss is not dwarves killed. It is dwarves who never came, or who came later: immigration, births, or a wealth or population cap reached later. Most of it is shift 0 (1088 living against about 1163), and no single seed is past the tracing threshold.

The rule changes in that merge are 16's threat scan (a hostile counts only if it can walk or shoot to the dwarf, so dwarves behind a locked gate keep working) and 18's emergence (the Hollow-born crack the vein's level into floor). Neither obviously touches immigration.

## What to do

Find the mechanism, then decide.

1. Pair the two commits seed by seed (`0eb44a30` is master before; the change set is `c038ce01`, `00654dc0`, `d4b2d985`). List the seed-shifts whose living moved most, and for two or three of them trace the population over the three years: arrivals per wave, births, deaths, and the wealth and cap that set each wave.
2. Split the change: sweep T-796's threat scan alone and T-797's cracks alone, each paired with its base, to say which one moves living.
3. If the cause is a real cost of the rule (for example, dwarves working through a raid behind a gate and the fortress's wealth or mood falling), weigh whether to keep it. If it is a timeline shift with no cost to the player, record that and close.

Record the figures here. Adopt any fix only if paired deaths stay within about 8 of the base and living comes back toward 1167.

## What was found

**The pair.** The merge's first parent is `234354ec`, not `0eb44a30`, but nothing between them moves the sweep: the sweep at `1b293acd` (run 45868894717, the T-795 base; `1b293acd`..`234354ec` changes only the UI and hints) equals `0eb44a30`'s seed for seed. So the T-796/T-797/T-801 change set alone moved it.

**By shift** (living / deaths, before → after): shift 0 1188/117 → 1088/132; shift 50 1145/128 → 1174/103; shift 100 1168/111 → 1129/115; shift 150 1168/103 → 1168/84. Pooled 1167.25/114.75 → 1139.75/108.5. Paired over the 80 seed-shifts, living moved by −1.38 a run (SD 8.95, t −1.37; 50 of 80 moved) and deaths by −0.31 (SD 4.21, t −0.66). Shift 0 lost 100 living and gained 15 deaths; shift 50 gained 29 and lost 25 deaths.

**Which change.** T-796 alone (`c038ce01`, run locally) reproduces the after figures exactly on the two seeds traced: `p2-2` shift 0 (41 living, 14 deaths, 48 immigrants, as at `9a13599a`) and `p4-1` shift 0 (the same ten deaths on the same days). T-797's cracks act only at an emergence of the Deep, and no seed log of the after sweep has one; T-801 changes the site summary and a hint. The split sweeps were not run: these two seeds settle it, and the quota is high.

**The seeds that moved most** (shift 0): `p4-1` 69 → 33, `p2-5` 56 → 26, `p2-2` 65 → 41, `p2-4` 60 → 46, `p4-2` 53 → 39. Every one lost waves (9 → 6, 9 → 6, 8 → 7, 8 → 7, 8 → 7), and in each the lost waves are skipped for hall spirit:
- `p4-1`: three deaths in the day-59 ambush and day-62 raid instead of one; spirit 59 at the winter check against 68, then 44, 33, 34, 41: four seasons skipped for spirit at 10, 7, 6, 6 dwarves, where before it took waves of 10, 12 and 4 (13 → 37 dwarves by year 3).
- `p2-5`: deaths on days 54 to 70 (six instead of five, a different set) leave 7 dwarves; three seasons skipped for spirit (50, 51, 50) where before waves of 4, 5 and 9 came at 57 to 60.
- `p2-2`: identical to day 200; the day-209 ambush kills two instead of one and the day-225 raid three instead of none, all soldiers on duty or dwarves at a need; spirit 46 at the year-3 spring check against 56 skips a wave of 12, and the autumn one too.

**The mechanism.** Before the change, 1,329 `ThreatNearby` reached dwarves in `p2-2` over the three years; after it, 241. Classified at the old commit with the new rule, 1,198 of them were from hostiles that could not come: raiders and archers outside the locked gate, ambushers across a wall, archers with no line of fire. 926 went to soldiers on duty, who ignore them, and 271 to civilians at a need, who used to drop it and flee. The other change of T-796, a threat interrupt that blocks its job `threatened`, first acted in `p4-1` on day 22 (a thief), and that is where its timeline parts. From there the same raids and ambushes meet dwarves in other places: in `p4-1` the day-59 ambush shot the miner at the map's edge instead of by the gate, and the day-62 raid fought the squad at (23,15) instead of (29,13). No traced fight points at the rule: the hits are mostly on soldiers on duty, dwarves already fleeing an ambush in the open, and wolves, with three civilians caught at a need or at work in a raid or ambush. The hall-spirit gate of 21 then amplifies a few early deaths: a fortress that loses two or three dwarves in year 1 falls below the spirit bar and misses three or four waves, about 25 to 35 dwarves by year 3.

## Decision

A timeline shift, with no cost to the player found: deaths fell over the four shifts, living's paired change is within its spread (t −1.37), and the shifts disagree in sign (−100, +29, −39, 0). T-796 is kept as it is; no rule, spec or fix. The amplifier (a few early deaths costing three or four waves through hall spirit) is the immigration rule doing what 21 says, and it is the same before and after.

## Done

- [x] The mechanism named, with the seeds and the figures.
- [x] A decision recorded, and the spec updated if a rule changes (no rule changes).
