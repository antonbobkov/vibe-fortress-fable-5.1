# T-NEW — The annual instrument holds the hearth alert while a bear lies 25 tiles away

**Source:** T-408, [rest on the walk to bed](../../reports/audits/2026-10-21-rest-on-the-walk-to-bed.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

The annual wildlife instrument (`test/perf/wildlife_year_fixture.ts`, the same policy as `test/e2e/full-year.spec.ts`) raises the hearth alert when a dwarf is attacked and lowers it only once no aggressive animal is within `NEAR` (40 tiles) of the wagon. In `wildlife-temperate_forest-4`, with T-408's sleep rule and `REST_ASLEEP_PER_HOUR` −45, a dwarf was attacked on day 47 while a bear lay 25 tiles from the wagon; the bear stayed there to the end, the alert stood for 44 days (52,840 ticks), the sheltered fortress could not farm outside its shelter, its food ran out and all ten remaining dwarves starved on days 89 to 92. The same seed lives with −40 (12 dwarves, longest shelter 13,620 ticks) and −50 (10, 300 ticks), and it had 9 living before T-408: the seed is unstable. At −40 two taiga fortresses starve the same way behind alerts of 27,680 and 17,840 ticks. Whether the sleep rule makes long alerts likelier is not established; the starvation comes through this policy either way. The probe is `reports/data/2026-10-21-t408-forest-4.probe.ts.txt`.

A player does not keep a fortress in its hall for six weeks because a bear sleeps in the woods.

## Decisions

1. The instrument's (and the browser year's) hearth alert is lowered to `watchful` after at most three days (`HEARTH_HOLD_MAX` = 3,600 ticks in the fixture) unless a dwarf has been attacked again within that time; an animal merely within `NEAR` no longer holds it.
2. The change is a fixture change: the instrument's before and after rows are both recorded, and the guard bounds are re-derived from the after row if it is accepted (testing-strategy.md § Annual wildlife survival).
3. The game's shelter rules (10 § Behavior selection, step 2) do not change in this task.

## Done

- `wildlife-temperate_forest-4` under T-408's rule no longer starves behind a standing alert; the instrument's twelve rows before and after are in a dated report, and `full-year.spec.ts` uses the same policy.
