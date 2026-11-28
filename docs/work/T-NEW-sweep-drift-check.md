# T-NEW — A merge's sweep is judged by its paired seed-shifts, and master's drift is watched against a fixed reference

**Source:** [T-814](T-814-master-drift-t795-t798.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

A rule change is adopted when its own paired sweep stays within about 8 deaths of its base. T-814 measured the noise of that pairing: when a change moves every timeline, the pooled difference of a paired sweep has a standard deviation of about 9 to 11 deaths (the standard deviation of the 80 seed-shift differences, 4 to 6 deaths, × √80 / 4). So the 8-death allowance is inside one standard deviation. It neither tells a cost from the timelines parting, nor stops master drifting: T-795 and T-798..T-800 each passed it, and master went from 108.5 to 121.75 deaths with no rule carrying a cost (T-814 swept the raid pause and the stand-in trader off and neither took deaths back; the stand-in off rose by 17.25 instead, past the bound, with nothing in it that adds danger). Only the verdict's bound from the best figures (deaths ≤ best + 30) holds master, and it is far from the per-merge allowance.

## What to do

- Have the sweep verdict, when given a base run, print the paired figures by seed and shift: how many timelines moved, how many seed-shifts rose and fell, the pooled difference and its noise (as T-814's table). Judge a change by that: a cost is a pooled difference well over its noise (about twice), or a rise in most of the moved seed-shifts, not a pooled difference over 8.
- Keep a fixed reference sweep of master and report each master sweep's distance from it, so a drift over several merges is seen and traced before it reaches the bound. Decide in the task how often the reference is renewed.
- Write the rule into testing-strategy.md § The twenty-seed sweep and agent-workflow.md § Verifying.

## Done

- [ ] The verdict prints the paired figures against a base run.
- [ ] Master's drift against a fixed reference is reported.
- [ ] The rule is in the process documents.
