# T-352 — A thief party stays in `approach` for over three days (peril 2 sweep seed)

**Closed:** 2026-10-17, in 27d125f.

**Source:** the T-331 review run of `test/perf/three_years_seeds.test.ts` (peril 2 and 4), 2026-10-16; the invariant is `party.approach-over-3d` of the T-176 checker (found before by [T-173](T-173-parties-that-never-leave.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

Seed `three-years-p2-4` fails the sweep's daily invariant check at tick 339,600 (day 283 of year 3): `party 184549661 gloam thief state approach since t334800 arrived t334800 members 1/1 size 1 loot 0 goalUnreachable=false walkUnreachable=false outcome=undefined`. A thief that has been approaching its goal for 4,800 ticks (four days) with a living member is stuck: 18 § Parties says a party in `approach` either reaches its goal, loses it, or leaves.

## What to do

**Decisions.**
- The thief's approach has a bound, like the other party states (`approach-over-3d` is the checker's bound; the spec's own bound for `approach` is stated in 18 § Behavior and is the bound to use).

1. Rerun the seed to tick 339,600 with the fortress script of `test/scenarios/three_years_fortress.ts` (peril 2) and trace the party every 20 ticks from tick 334,800: its member's position, path request and goal.
2. Find why the walk neither arrives nor fails, write the failing stepped test first, then fix.
3. Amend 18 § Parties if the bound is not stated there.

## Done

- The seed passes its daily invariant check past day 283, or the work file records the measured reason and the bound that holds.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green, with the browser suite.
