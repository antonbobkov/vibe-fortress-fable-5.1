# T-527 — A workshop's open craft job waits for months while its laborers are idle

**Source:** [T-522's report](../../reports/audits/2026-11-07-t522-defence-repel-rate.md) § After the fix · **Size:** S · **Needs:** — · **Status:** open

On `defence-year-7` (`defence_year`, cadence 20, T-522's branch `16fbba04`, with the door rule and the cage order) the carpenter's current job, a `craft` of `make_bed` (order 1), is `open` with no worker and no blocked reason from day 60 to at least day 120, while four dwarves with the carpentry labor are mostly idle (the journal prints them every ten days). A workshop holds one job at a time, so its other orders wait behind it: the cage order at the head of the list (maintain 2, one cage short after the cage trap caught a bandit) is never run, the trap is never rearmed, and the raid of day 122 loots. On the same seed the mechanic's first `make_mechanism` job waited 60 days with no worker holding the mechanics labor. On `defence-year` (T-522's final commit `9932873e`, cadence 20) the same: job 1923, `craft:16777337:2` (`make_bed`, priority 5, one log, nothing reserved, no blocked reason), created on day 57 and still open on day 118, while four carpenters were idle with the labor enabled at priority 5, their labels joined to its work tile (a passable floor), and 148 logs in stock. Its probe is T-522's journal (`reports/data/2026-11-07-t522-journal.probe.ts.txt`, which prints the job every ten days).

## Decisions

- Journal the job from creation: who could take it, and why each idle carpenter passes it over (its input search, its work tile, a failed walk, the labor's priority, or the job board's claim order).
- Fix the game if an open job with an idle, able worker is passed over; fix the script if it never gave the labor where the work is.

## Done

- The cause is named, and on `defence-year-7` the carpenter's open job is taken within a day while a carpenter is idle.

## Found

The carpenters were not idle (T-522's journal read "no job" at the moment it looked). On `defence-year` at cadence 20 the bed job, priority 5, was open to all four of them, eligible by every check (labor, skill, label, inputs, tool); in days 57 to 62 they asked for work 35 times and each time took one of 465 to 499 open jobs of effective priority 4 or better (planting, harvest, building, other workshops' orders, levers). Priority is strict, so the job waited; the workshop's one job kept the cage order ahead of it from running. The fix is the workshop's: an untaken job gives way to a runnable order ahead of it (12 § Operation, step 1). See [the report](../../reports/audits/2026-11-07-t527-open-craft-job.md).
