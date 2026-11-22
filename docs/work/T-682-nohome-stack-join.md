# T-682 — An item judged full is not looked at again when a stack it could join arrives

**Source:** T-676 · **Size:** S · **Needs:** — · **Status:** open

## Why

While tracing T-676, items that went to `noHome` as `full` while a stockpile's last empty tiles were reserved stayed there after the first of their kind was delivered and made a stack they could join: a bolt in a testing embark's wagon on day 1 (and, before T-676's fix, the wagon's meals once the drink barrels reached an Everything stockpile) had a slot (`bestFor` found one) yet waited in `noHome` for a day or more, until something else returned the set. 13 returns `noHome` when a full stockpile gains space, a stockpile changes or a container arrives; a delivery that leaves a loose stack with room is none of these.

## What to do

When a haul delivers onto a loose tile of a stockpile and the stack there has room for more of its kind, return the `noHome` items of that type (not the whole set, which costs a pass) to `wants`. Check the cost on the perf tier's large fortress.

## Done

- [x] A unit test: a stockpile whose empty tiles are all reserved, a second bolt judged full, the first bolt delivered: the second gets a haul job to join it within a few items ticks (`test/unit/items/t682-nohome-stack-join.test.ts`: a one-tile Weapons and armor stockpile, two stacks of five oak bolts; the second's haul comes within three items ticks of the first's delivery and the two make a stack of ten; it fails with the return turned off). On delivery 13 returns the `noHome` items of the delivered stack's type, material and quality to the wants set when the loose stack on a stockpile is below its type's `stack` (`Hauling.stackJoinable`, one pass over `noHome` per such delivery). The cost on the perf tier's 80-dwarf reference (`per-system.test.ts`): 13 averages 0.066 ms a tick against its 0.30 ms budget.
