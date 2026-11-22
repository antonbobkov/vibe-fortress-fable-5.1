# T-682 — An item judged full is not looked at again when a stack it could join arrives

**Source:** T-676 · **Size:** S · **Needs:** — · **Status:** open

## Why

While tracing T-676, items that went to `noHome` as `full` while a stockpile's last empty tiles were reserved stayed there after the first of their kind was delivered and made a stack they could join: a bolt in a testing embark's wagon on day 1 (and, before T-676's fix, the wagon's meals once the drink barrels reached an Everything stockpile) had a slot (`bestFor` found one) yet waited in `noHome` for a day or more, until something else returned the set. 13 returns `noHome` when a full stockpile gains space, a stockpile changes or a container arrives; a delivery that leaves a loose stack with room is none of these.

## What to do

When a haul delivers onto a loose tile of a stockpile and the stack there has room for more of its kind, return the `noHome` items of that type (not the whole set, which costs a pass) to `wants`. Check the cost on the perf tier's large fortress.

## Done

- [x] A unit test: a stockpile whose empty tiles are all reserved, a second bolt judged full, the first bolt delivered: the second gets a haul job to join it within a few items ticks (`test/unit/items/t682-nohome-stack-join.test.ts`: a one-tile Weapons and armor stockpile, two stacks of five oak bolts; the second's haul comes within three items ticks of the first's delivery and the two make a stack of ten; it fails with the return turned off). On delivery 13 returns the `noHome` items of the delivered stack's type, material and quality to the wants set when the loose stack on a stockpile is below its type's `stack` (`Hauling.stackJoinable`, one pass over `noHome` per such delivery). The cost on the perf tier's 80-dwarf reference (`per-system.test.ts`): 13 averages 0.066 ms a tick against its 0.30 ms budget.
- [x] The sweep's verdict: `44996870138` on `a193a6ab` (with T-681): Pooled 20 | 7 | 0 | 1137.75 | 120.25 | 0 | 0, **Verdict: pass**, all 80 seeds green (master after T-677, `44983974110`: 1151.75 living, 98.25 deaths, 0 extinct). Peril 0 is unchanged (5 deaths over the four shifts, as on master), need deaths stay 0 and infections are as many (32 against 31). The 22 more deaths a sweep are raid deaths at peril 2 and 4 (raiders killed 361 dwarves over the 80 timelines against 297; bled out 294 against 258, killed 151 against 104), most in ambushes the script stood down (183 against 143), gathered in a few timelines whose raids went worse once the timelines diverged: `p4-4` at shift 100 (34 against 18), `p2-5` at shift 100 (18 against 1), `p4-4` and `p4-5` at shift 150; others fell (`p2-3` at shift 100, 5 against 14). The recent masters' sweeps spread nearly as wide: peril-4 deaths 206 to 262 and raiders' kills 297 to 352 (`44851035279`, `44966730312`, `44975306609`, `44983974110`), against 271 and 361 here. No hauling, need or infection death rose; joining a stack sooner sends no dwarf where the unloading did not already go.
