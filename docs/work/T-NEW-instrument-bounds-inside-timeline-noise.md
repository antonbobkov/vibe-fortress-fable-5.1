# T-NEW — The annual instrument's bounds are inside master's own timeline noise

**Source:** T-508's instrument samples on master `d96cfc9c` and on the T-508 branch ([report](../../reports/audits/2026-11-05-t508-idle-dwarves-by-the-hearth.md#the-annual-instrument)) · **Size:** M · **Needs:** — · **Status:** open (measurement first)

## Why

testing-strategy.md § Annual wildlife survival says a guarded figure gates a merge because its noise under timeline-only changes is known and the bound is wider than it. On master (T-482's code) the same code shifted 0, 1, 2 and 3 ticks before the opening gives, as median / worst / second-worst / sum / wildlife-free / extinct / need deaths:

| Shift | Row | Bounds |
|---|---|---|
| 0 (T-482, run 42099055474) | 12.5/9/10/149/7/0/0 | pass |
| 1 (T-482, run 42099089334) | 12.5/3/9/139/7/0/0 | pass |
| 2 (run 42129676042) | 10.5/2/3/118/7/0/**11** | median, sum and need deaths fail |
| 3 (run 42129679703) | 12/3/8/136/6/0/0 | sum fails (136 < 137) |

So two ticks of shift on unchanged code fail three bounds at once, and the sum's spread over four samples is 31, against a bound of 12 that "neutral changes moved by up to 9". At shift 2, **`wildlife-taiga-3` starves 11 dwarves on days 110 to 112**: a need death the instrument has not seen since T-260 under a timeline-only change, and on the seed next to the one T-481 stopped starving. Every behaviour change now fails the instrument on some sample by chance, as T-508's four did (each failing one bound by one or two dwarves) while being no worse than master's.

## What to do

1. Journal `wildlife-taiga-3` at shift 2 on `d96cfc9c` from day 80 to day 112: food and drink stocks, farms and cooks, who is sheltering and for how long (the hearth alerts of days 73 to 109), and why eleven dwarves starve in three days.
2. Fix it if it is a fault (a shelter that holds dwarves from food, as T-481's camp walk did), with a failing test.
3. Measure the noise: master at shifts 0 to 5, and set the instrument's bounds (or the number of samples a change must pass) from that spread, in testing-strategy.md and `wildlife_year_constants.ts`, by the owner's leave if a bound widens.

## Done

- The starvation is explained (and fixed, if a fault); the instrument's bounds are wider than master's measured spread, or a change is judged over several samples, as the spec then says.
