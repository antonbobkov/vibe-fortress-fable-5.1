# T-NEW — A −1 thought that decays by halflife is gone at the next hour

**Source:** T-552's `smoky_hall` (`test/unit/t552-making-do-drying.test.ts`) · **Size:** S · **Needs:** — · **Status:** open

15's `currentValue` (`src/systems/morale/mood.ts`) rounds a `halflife` thought to 0 once its magnitude falls under 1. A thought of value −1 that decays by halflife is under 1 as soon as any time has passed, so the next hourly recompute drops it: it never shows in the mood panel and moves no mood. `lab_stink` and `nettles` (both −1, 12 hours, `halflife`) are such rows today, and T-552's `smoky_hall` was until it was made `linear`.

## What to do

Decide the rule: either a halflife thought keeps its sign down to the cut (round away from zero, or cut at 0.5), or the −1 rows become `linear` as `smoky_hall` did. Check every row of `personality-and-thoughts.md` with |value| ≤ 1 and `halflife`. The economy fixture's mood figures may move a little; the instrument and the sweep verdicts should pass.

## Done

A −1 `halflife` thought lasts in the mood panel for a sensible part of its hours; a test holds it; the verdicts pass.
