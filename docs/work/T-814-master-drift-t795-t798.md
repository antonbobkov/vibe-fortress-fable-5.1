# T-814 — Master's deaths drifted from 108.5 to 121.75 across T-795 and T-798, each just inside the bar

**Source:** the master sweeps after [T-796](../archive/tasks/T-796-threat-needs-a-path.md) and [T-798](../archive/tasks/T-798-glowcap-has-a-source.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

Each rule change is adopted when its own paired sweep stays within about 8 deaths of its base. Two changes merged in a row each came in just under that:

| Master commit | What it adds | Sweep run | Living | Deaths |
|---|---|---|---|---|
| `9a13599a` | T-796/T-797/T-801 | 45911220303 | 1139.75 | 108.5 |
| `7f37335f` | T-795 tomb keeps coffins ready (paired +7.75 deaths, −16.5 living) | — | — | — |
| `1ebabe1d` | T-798..T-800 (own sweep +7 deaths on an older base) | 45959693912 | 1093.75 | 121.75 |

So master is now about 13 deaths and 46 living worse than two merges ago, still inside the bounds (≥ 1046.63, ≤ 132.5) but drifting toward them. Shift 0 is 997 living. The p2-4 shift 150 job failure in that run is the dig invariant fixed in T-811 (test only).

## What to do

1. Sweep `7f37335f` (T-795 merged, before T-798) on a temporary branch, so each step is paired: 9a13599a → 7f37335f → 1ebabe1d.
2. For the step that costs most, split it by rule. T-798..T-800's rules: the glowcap request roll, the caravan stay pausing during raids, the Broker's stand-in trader, the re-queued trade job. T-795: the tomb's coffins-ready order. Sweep each rule off, paired with its base, using local seed runs first to narrow it.
3. Back out the rule or rules that carry the deaths, keeping their UI. Record the figures here and in the rule's archived work file.

Target: master back within about 8 deaths of 108.5, or a recorded reason why the cost is worth it.

## Done

- [ ] The paired steps measured, the costly rule named.
- [ ] The rule backed out or the cost justified; master re-swept.
