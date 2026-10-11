# T-260 — Two dwarves starve in the responding wildlife year

**Source:** T-136 twelve-seed instrument, 2026-10-11 · **Size:** M · **Needs:** — · **Status:** open (diagnosis first)

## Reproduction

`npm exec -- vitest run -c vitest.perf.config.ts test/perf/wildlife_year.test.ts`, seed `wildlife-taiga-1`. On a390b2d, two dwarves die with cause `starvation` on days 46 and 74, with 38 Starving events over the year. The same command-only fortress survives the year with eleven dwarves. Read the T-136 raw row for death ticks, alerts and stocks; end stocks alone do not establish availability at the deaths.

## Resolution

Trace both dwarves through their first critical hunger or thirst, meals and drinks, retreat/flee targets, reservations, and exact food/drink stock positions at that time. The health death label alone does not distinguish hunger from thirst; inspect the saved need durations before naming that cause. Check 10 Behavior selection (critical needs override shelter and remembered danger) and 19 Hearth alert retreat. Classify each failed access as a game fault or a player-script omission before changing anything. If a rule is broken, reproduce the minimal state as a failing test, fix it and fold any missing rule into the spec. Do not add farm capacity, supplies or retime the long playthrough to conceal it. Re-measure the twelve-seed instrument before and after; record the browser's before and after end-state lines.

## Done

The two deaths have measured causes and either a regression-backed game fix or an explicit fixture qualification. Six static checks, `npm test`, the full browser suite for src behavior, and the wildlife instrument pass.
